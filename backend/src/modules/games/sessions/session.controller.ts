import { FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin } from '../../../infrastructure/supabase/client';
import { AppError } from '../../../shared/errors/AppError';
import { gameRegistry } from '../core/GameRegistry';

// Bắt đầu game từ Room
export const startGame = async (request: FastifyRequest, reply: FastifyReply) => {
  const { roomId } = request.params as any;
  const userId = request.user!.id;

  // 1. Kiểm tra phòng
  const { data: room } = await supabaseAdmin.from('game_rooms').select('*, players:game_room_players(user_id)').eq('id', roomId).single();
  if (!room) throw new AppError(404, 'NOT_FOUND', 'Phòng không tồn tại');
  if (room.owner_id !== userId) throw new AppError(403, 'FORBIDDEN', 'Chỉ chủ phòng mới được bắt đầu game');
  if (room.status !== 'WAITING') throw new AppError(400, 'BAD_REQUEST', 'Phòng đang chơi rồi.');
  
  const players = room.players.map((p: any) => p.user_id);
  if (players.length < 2) throw new AppError(400, 'NOT_ENOUGH_PLAYERS', 'Cần ít nhất 2 người để bắt đầu.');

  // 2. Khởi tạo Game Engine
  const engine = gameRegistry.getEngine(room.game_id);
  const initialState = engine.initialize(players, {});

  // 3. Lưu vào DB
  const { data: session, error } = await supabaseAdmin.from('game_sessions')
    .insert({ room_id: roomId, game_id: room.game_id, current_state: initialState })
    .select().single();

  if (error) throw new AppError(500, 'DB_ERROR', error.message);

  // 4. Cập nhật trạng thái Phòng thành RUNNING
  await supabaseAdmin.from('game_rooms').update({ status: 'RUNNING' }).eq('id', roomId);

  return reply.send({ success: true, data: { sessionId: session.id }, error: null });
};

// Lấy thông tin ván đấu (Đã ẩn bài người khác)
export const getSessionState = async (request: FastifyRequest, reply: FastifyReply) => {
  const { sessionId } = request.params as any;
  const userId = request.user!.id;

  const { data: session } = await supabaseAdmin.from('game_sessions').select('*').eq('id', sessionId).single();
  if (!session) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy ván đấu');

  const engine = gameRegistry.getEngine(session.game_id);
  const publicState = engine.getPublicState(session.current_state, userId);

  return reply.send({ success: true, data: { session: { id: session.id, status: session.status }, state: publicState }, error: null });
};

// Người chơi đánh bài
export const playAction = async (request: FastifyRequest, reply: FastifyReply) => {
  const { sessionId } = request.params as any;
  const { action } = request.body as any; // { type: 'PLAY_CARD', payload: { ... } }
  const userId = request.user!.id;

  const { data: session } = await supabaseAdmin.from('game_sessions').select('*').eq('id', sessionId).single();
  if (!session || session.status !== 'PLAYING') throw new AppError(400, 'INVALID', 'Game không khả dụng');

  const engine = gameRegistry.getEngine(session.game_id);
  
  // Validate bằng Server-Authoritative
  if (!engine.validateAction(session.current_state, action, userId)) {
    throw new AppError(400, 'INVALID_ACTION', 'Nước đi không hợp lệ (Không đúng lượt hoặc sai luật).');
  }

  // Cập nhật State
  const { newState, events } = engine.applyAction(session.current_state, action, userId);
  
  // Lưu State mới xuống DB
  let status = 'PLAYING';
  let winner = null;
  if (engine.isFinished(newState)) {
    status = 'FINISHED';
    winner = engine.calculateResult(newState).winner;
    await supabaseAdmin.from('game_rooms').update({ status: 'WAITING' }).eq('id', session.room_id); // Mở lại phòng
  }

  await supabaseAdmin.from('game_sessions')
    .update({ current_state: newState, status, winner_id: winner, updated_at: new Date().toISOString() })
    .eq('id', sessionId);

  // TODO: Tương lai sẽ bắn `events` qua Realtime Channels để UI giật hiệu ứng.

  // Trả về State Public cho chính người đánh
  const publicState = engine.getPublicState(newState, userId);
  return reply.send({ success: true, data: { state: publicState, events }, error: null });
};
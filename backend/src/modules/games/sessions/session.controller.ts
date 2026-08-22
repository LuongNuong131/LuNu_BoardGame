import { FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin } from '../../../infrastructure/supabase/client';
import { AppError } from '../../../shared/errors/AppError';
import { gameRegistry } from '../core/GameRegistry';

const getActiveRoomPlayers = async (roomId: string) => {
  const { data, error } = await supabaseAdmin.from('game_room_players').select('user_id, role, seat_index').eq('room_id', roomId);
  if (error) throw new AppError(500, 'DB_ERROR', `Không thể đọc ghế trong phòng: ${error.message}`);
  return (data || []).filter((participant: any) => participant.role !== 'SPECTATOR');
};

const requireActivePlayer = async (roomId: string, userId: string) => {
  const players = await getActiveRoomPlayers(roomId);
  if (!players.some((player: any) => player.user_id === userId)) {
    throw new AppError(403, 'SPECTATOR_READ_ONLY', 'Khán giả chỉ có thể xem trận đấu, không thể thực hiện nước đi.');
  }
  return players;
};

export const startGame = async (request: FastifyRequest, reply: FastifyReply) => {
  const { roomId } = request.params as any;
  const userId = request.user!.id;
  const { data: room, error: roomError } = await supabaseAdmin.from('game_rooms').select('*').eq('id', roomId).single();
  if (roomError || !room) throw new AppError(404, 'NOT_FOUND', 'Phòng không tồn tại');
  if (room.owner_id !== userId) throw new AppError(403, 'FORBIDDEN', 'Chỉ chủ phòng mới được bắt đầu game');
  if (room.status !== 'WAITING') throw new AppError(400, 'BAD_REQUEST', 'Phòng đang chơi rồi.');

  const players = await requireActivePlayer(roomId, userId);
  if (players.length < 2) throw new AppError(400, 'NOT_ENOUGH_PLAYERS', 'Cần ít nhất 2 người để bắt đầu.');

  const engine = gameRegistry.getEngine(room.game_id);
  const initialState = engine.initialize(players.map((player: any) => player.user_id), {});
  const { data: session, error: sessionError } = await supabaseAdmin.from('game_sessions')
    .insert({ room_id: roomId, game_id: room.game_id, current_state: initialState, status: 'PLAYING' })
    .select().single();
  if (sessionError || !session) throw new AppError(500, 'DB_ERROR', sessionError?.message || 'Không thể tạo phiên chơi.');

  const { error: statusError } = await supabaseAdmin.from('game_rooms').update({ status: 'RUNNING', updated_at: new Date().toISOString() }).eq('id', roomId);
  if (statusError) throw new AppError(500, 'DB_ERROR', `Không thể cập nhật trạng thái phòng: ${statusError.message}`);
  return reply.send({ success: true, data: { sessionId: session.id, gameId: session.game_id }, error: null });
};

export const getSessionState = async (request: FastifyRequest, reply: FastifyReply) => {
  const { sessionId } = request.params as any;
  const userId = request.user!.id;
  const { data: session, error } = await supabaseAdmin.from('game_sessions').select('*').eq('id', sessionId).single();
  if (error || !session) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy ván đấu');

  const engine = gameRegistry.getEngine(session.game_id);
  const publicState = engine.getPublicState(session.current_state, userId);
  return reply.send({ success: true, data: {
    session: { id: session.id, room_id: session.room_id, game_id: session.game_id, status: session.status, started_at: session.started_at, updated_at: session.updated_at },
    state: publicState
  }, error: null });
};

export const playAction = async (request: FastifyRequest, reply: FastifyReply) => {
  const { sessionId } = request.params as any;
  const { action } = request.body as any;
  const userId = request.user!.id;
  const { data: session, error } = await supabaseAdmin.from('game_sessions').select('*').eq('id', sessionId).single();
  if (error || !session || session.status !== 'PLAYING') throw new AppError(400, 'INVALID', 'Game không khả dụng');
  await requireActivePlayer(session.room_id, userId);

  const engine = gameRegistry.getEngine(session.game_id);
  if (!engine.validateAction(session.current_state, action, userId)) throw new AppError(400, 'INVALID_ACTION', 'Nước đi không hợp lệ (Không đúng lượt hoặc sai luật).');
  const { newState, events } = engine.applyAction(session.current_state, action, userId);
  let status = 'PLAYING';
  let winner = null;
  if (engine.isFinished(newState)) {
    status = 'FINISHED';
    winner = engine.calculateResult(newState).winner;
    await supabaseAdmin.from('game_rooms').update({ status: 'WAITING', updated_at: new Date().toISOString() }).eq('id', session.room_id);
  }

  const { error: updateError } = await supabaseAdmin.from('game_sessions')
    .update({ current_state: newState, status, winner_id: winner, updated_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (updateError) throw new AppError(500, 'DB_ERROR', `Không thể lưu nước đi: ${updateError.message}`);

  const publicState = engine.getPublicState(newState, userId);
  return reply.send({ success: true, data: { state: publicState, events }, error: null });
};

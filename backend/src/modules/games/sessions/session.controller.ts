import { FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin } from '../../../infrastructure/supabase/client';
import { AppError } from '../../../shared/errors/AppError';
import { gameRegistry } from '../core/GameRegistry';

const getActiveRoomPlayers = async (roomId: string) => {
  const modern = await supabaseAdmin.from('game_room_players').select('user_id, role, seat_index').eq('room_id', roomId);
  if (!modern.error) return (modern.data || []).filter((participant: any) => participant.role !== 'SPECTATOR');
  const message = String(modern.error.message || '').toLowerCase();
  if (!message.includes('role') && !message.includes('seat_index')) throw new AppError(500, 'DB_ERROR', `Không thể đọc ghế trong phòng: ${modern.error.message}`);
  const legacy = await supabaseAdmin.from('game_room_players').select('user_id').eq('room_id', roomId);
  if (legacy.error) throw new AppError(500, 'DB_ERROR', `Không thể đọc người chơi trong phòng: ${legacy.error.message}`);
  return (legacy.data || []).map((participant: any) => ({ ...participant, role: 'PLAYER', seat_index: null }));
};

const requireActivePlayer = async (roomId: string, userId: string) => {
  const players = await getActiveRoomPlayers(roomId);
  if (!players.some((player: any) => player.user_id === userId)) {
    throw new AppError(403, 'SPECTATOR_READ_ONLY', 'Khán giả chỉ có thể xem trận đấu, không thể thực hiện nước đi.');
  }
  return players;
};

const getSessionParticipants = async (roomId: string, state: any) => {
  const { data: seats } = await supabaseAdmin.from('game_room_players').select('user_id, role, seat_index').eq('room_id', roomId);
  const ids = (seats || []).map((seat: any) => seat.user_id).filter(Boolean);
  const { data: profiles } = ids.length ? await supabaseAdmin.from('profiles').select('id, username, display_name, avatar_url').in('id', ids) : { data: [] as any[] };
  const byId = new Map((profiles || []).map((profile: any) => [profile.id, profile]));
  const statePlayers = (state.players || []).map((entry: any) => typeof entry === 'string' ? { id: entry, seat: undefined } : { id: entry.playerId, seat: entry.seat });
  const participants = statePlayers.map(({ id, seat: stateSeat }: any, index: number) => {
    const seat = (seats || []).find((item: any) => item.user_id === id);
    const profile = byId.get(id);
    return profile ? { ...profile, role: seat?.role || 'PLAYER', seat_index: seat?.seat_index || stateSeat || index + 1 } : { id, username: id.toLowerCase().startsWith('ai_') ? id : 'player', display_name: id.toLowerCase().startsWith('ai_') ? `Máy · ${id.replace('AI_', '')}` : 'Người chơi', avatar_url: null, role: 'PLAYER', seat_index: index + 1, is_ai: id.toLowerCase().startsWith('ai_') };
  });
  return participants;
};

const resolveEngine = (gameId: string) => {
  try { return gameRegistry.getEngine(gameId); }
  catch { throw new AppError(409, 'ENGINE_NOT_READY', `Engine cho game ${gameId} chưa sẵn sàng. Phòng vẫn có thể dùng để chờ và xem bàn.`); }
};

export const startGame = async (request: FastifyRequest, reply: FastifyReply) => {
  const { roomId } = request.params as any;
  const userId = request.user!.id;
  const { data: room, error: roomError } = await supabaseAdmin.from('game_rooms').select('*').eq('id', roomId).single();
  if (roomError || !room) throw new AppError(404, 'NOT_FOUND', 'Phòng không tồn tại');
  if (room.owner_id !== userId) throw new AppError(403, 'FORBIDDEN', 'Chỉ chủ phòng mới được bắt đầu game');
  if (room.status !== 'WAITING') {
    const { data: activeSession } = await supabaseAdmin.from('game_sessions').select('id, game_id').eq('room_id', roomId).eq('status', 'PLAYING').order('started_at', { ascending: false }).limit(1).maybeSingle();
    if (activeSession) return reply.send({ success: true, data: { sessionId: activeSession.id, gameId: activeSession.game_id, alreadyStarted: true }, error: null });
    throw new AppError(400, 'BAD_REQUEST', 'Phòng đang chơi rồi.');
  }

  const requestBody = (request.body || {}) as any;
  const againstAi = Boolean(requestBody.against_ai);
  const aiDifficulty = ['EASY', 'MEDIUM', 'HARD'].includes(String(requestBody.ai_level).toUpperCase()) ? String(requestBody.ai_level).toUpperCase() : 'MEDIUM';
  const players = await requireActivePlayer(roomId, userId);
  if (!againstAi && players.length < 2) throw new AppError(400, 'NOT_ENOUGH_PLAYERS', 'Cần ít nhất 2 người để bắt đầu.');
  if (againstAi && players.length !== 1) throw new AppError(400, 'AI_SETUP_INVALID', 'Chế độ đấu máy cần đúng một người thật trong bàn.');

  const engine = resolveEngine(room.game_id);
  const sessionPlayers = againstAi ? [...players.map((player: any) => player.user_id), `AI_${aiDifficulty}`] : players.map((player: any) => player.user_id);
  const initialState: any = engine.initialize(sessionPlayers, {});
  if (againstAi) initialState.aiDifficulty = aiDifficulty;
  let { data: session, error: sessionError } = await supabaseAdmin.from('game_sessions')
    .insert({ room_id: roomId, game_id: room.game_id, current_state: initialState, status: 'PLAYING' })
    .select().single();
  if (sessionError?.code === '23505') {
    const active = await supabaseAdmin.from('game_sessions').select('*').eq('room_id', roomId).eq('status', 'PLAYING').order('started_at', { ascending: false }).limit(1).maybeSingle();
    session = active.data;
    sessionError = active.error;
  }
  if (sessionError || !session) throw new AppError(500, 'DB_ERROR', sessionError?.message || 'Không thể tạo phiên chơi.');

  const { error: statusError } = await supabaseAdmin.from('game_rooms').update({ status: 'RUNNING', updated_at: new Date().toISOString() }).eq('id', roomId);
  if (statusError) throw new AppError(500, 'DB_ERROR', `Không thể cập nhật trạng thái phòng: ${statusError.message}`);
  return reply.send({ success: true, data: { sessionId: session.id, gameId: session.game_id, againstAi, aiDifficulty: againstAi ? aiDifficulty : null }, error: null });
};

export const getActiveRoomSession = async (request: FastifyRequest, reply: FastifyReply) => {
  const { roomId } = request.params as any;
  const userId = request.user!.id;
  const { data: session, error } = await supabaseAdmin.from('game_sessions').select('*').eq('room_id', roomId).eq('status', 'PLAYING').order('started_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new AppError(500, 'DB_ERROR', `Không thể đọc phiên đang chạy: ${error.message}`);
  if (!session) return reply.send({ success: true, data: null, error: null });
  const players = await getActiveRoomPlayers(roomId);
  const engine = resolveEngine(session.game_id);
  const state = engine.getPublicState(session.current_state, userId);
  return reply.send({ success: true, data: { session: { id: session.id, room_id: session.room_id, game_id: session.game_id, status: session.status, started_at: session.started_at, updated_at: session.updated_at }, state, participants: await getSessionParticipants(roomId, session.current_state), isPlayer: players.some((player: any) => player.user_id === userId) }, error: null });
};

export const getSessionState = async (request: FastifyRequest, reply: FastifyReply) => {
  const { sessionId } = request.params as any;
  const userId = request.user!.id;
  const { data: session, error } = await supabaseAdmin.from('game_sessions').select('*').eq('id', sessionId).single();
  if (error || !session) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy ván đấu');

  const engine = resolveEngine(session.game_id);
  const players = await getActiveRoomPlayers(session.room_id);
  const publicState = engine.getPublicState(session.current_state, userId);
  return reply.send({ success: true, data: {
    session: { id: session.id, room_id: session.room_id, game_id: session.game_id, status: session.status, started_at: session.started_at, updated_at: session.updated_at },
    state: publicState,
    participants: await getSessionParticipants(session.room_id, session.current_state),
    isPlayer: players.some((player: any) => player.user_id === userId)
  }, error: null });
};

export const playAction = async (request: FastifyRequest, reply: FastifyReply) => {
  const { sessionId } = request.params as any;
  const { action } = request.body as any;
  const userId = request.user!.id;
  const { data: session, error } = await supabaseAdmin.from('game_sessions').select('*').eq('id', sessionId).single();
  if (error || !session || session.status !== 'PLAYING') throw new AppError(400, 'INVALID', 'Game không khả dụng');
  await requireActivePlayer(session.room_id, userId);

  const engine = resolveEngine(session.game_id);
  if (!engine.validateAction(session.current_state, action, userId)) throw new AppError(400, 'INVALID_ACTION', 'Nước đi không hợp lệ (Không đúng lượt hoặc sai luật).');
  let { newState, events } = engine.applyAction(session.current_state, action, userId);
  const aiEvents: any[] = [];
  for (let turn = 0; turn < 3; turn += 1) {
    const currentEntry = newState.players?.[newState.currentTurnIndex];
    const currentPlayer = typeof currentEntry === 'string' ? currentEntry : currentEntry?.playerId;
    if (!currentPlayer?.startsWith('AI_') || typeof (engine as any).getAiAction !== 'function') break;
    const aiDifficulty = newState.aiDifficulty || 'MEDIUM';
    const aiAction = (engine as any).getAiAction(newState, currentPlayer, aiDifficulty);
    if (!aiAction || !(engine as any).validateAction(newState, aiAction, currentPlayer)) break;
    const aiTurn = (engine as any).applyAction(newState, aiAction, currentPlayer);
    newState = aiTurn.newState;
    aiEvents.push(...aiTurn.events.map((event: any) => ({ ...event, automated: true })));
  }
  events = [...events, ...aiEvents];
  const safeEvents = events.map((event: any) => ({ type: event.type, playerId: event.playerId, winner: event.winner, target: event.target, amount: event.amount, action: event.action, dice: event.dice, position: event.position, automated: event.automated, at: new Date().toISOString() }));
  newState.actionLog = [...(session.current_state.actionLog || []), ...safeEvents].slice(-24);
  newState.revision = Number(session.current_state.revision || 0) + 1;
  let status = 'PLAYING';
  let winner = null;
  let finished = false;
  if (engine.isFinished(newState)) {
    status = 'FINISHED';
    const result = engine.calculateResult(newState) as any;
    winner = result.winner || result.winnerPlayerId || result.winnerTeam || null;
    finished = true;
  }

  const { data: persistedAction, error: updateError } = await supabaseAdmin.from('game_sessions')
    .update({ current_state: newState, status, winner_id: winner, updated_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('updated_at', session.updated_at)
    .select('id')
    .maybeSingle();
  if (updateError) throw new AppError(500, 'DB_ERROR', `Không thể lưu nước đi: ${updateError.message}`);
  if (!persistedAction) throw new AppError(409, 'STALE_SESSION', 'Ván vừa có nước đi mới từ người chơi khác. Bàn sẽ tự đồng bộ lại.');
  if (finished) await supabaseAdmin.from('game_rooms').update({ status: 'WAITING', updated_at: new Date().toISOString() }).eq('id', session.room_id).eq('status', 'RUNNING');

  const publicState = engine.getPublicState(newState, userId);
  return reply.send({ success: true, data: { state: publicState, events }, error: null });
};

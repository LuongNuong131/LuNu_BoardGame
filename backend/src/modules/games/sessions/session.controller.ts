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

const profileIdPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const playerIdOf = (player: any): string | undefined => typeof player === 'string' ? player : player?.playerId;

const getSessionParticipants = async (state: any) => {
  const roster: string[] = (state.players || []).map(playerIdOf).filter((id: unknown) => typeof id === 'string');
  const ids = roster.filter((id) => profileIdPattern.test(id));
  const { data: profiles } = ids.length ?
    await supabaseAdmin.from('profiles').select('id, username, display_name, avatar_url').in('id', ids) : { data: [] };
  const byId = new Map((profiles || []).map((profile) => [profile.id, profile]));
  return roster.map((id, index) => {
    const profile = byId.get(id);
    const isAi = id.startsWith('AI_');
    const member = profile ?? {
      id,
      username: isAi ? id : 'player',
      display_name: isAi ? `Máy · ${id.slice(3)}` : 'Người chơi',
      avatar_url: null,
    };
    return { ...member, role: 'PLAYER', seat_index: index + 1, is_ai: isAi };
  });
};

const resolveEngine = (gameId: string) => {
  try { return gameRegistry.getEngine(gameId); }
  catch { throw new AppError(409, 'ENGINE_NOT_READY', `Engine cho game ${gameId} chưa sẵn sàng. Phòng vẫn có thể dùng để chờ và xem bàn.`); }
};

const participates = (state: any, id: string) => state.players?.some((player: any) => playerIdOf(player) === id);
const nextUpdatedAt = (updatedAt: string) => new Date(Math.max(Date.now(), Date.parse(updatedAt) + 1)).toISOString();

function outcomeColumns(engine: ReturnType<typeof resolveEngine>, state: any) {
  if (!engine.isFinished(state)) return { status: 'PLAYING', winner_id: null };
  const result = engine.calculateResult(state) as any;
  const winner = result.winner || result.winnerPlayerId;
  const isProfileId = typeof winner === 'string' && profileIdPattern.test(winner);
  return { status: 'FINISHED', winner_id: isProfileId ? winner : null };
}

async function reconcileExpired(session: any) {
  if (session.status !== 'PLAYING') return session;
  const engine = resolveEngine(session.game_id);
  const next = engine.advanceExpired?.(session.current_state);
  if (!next || next === session.current_state) return session;
  next.revision = Number(session.current_state.revision || 0) + 1;
  const { data, error } = await supabaseAdmin.from('game_sessions')
    .update({ current_state: next, ...outcomeColumns(engine, next), updated_at: nextUpdatedAt(session.updated_at) })
    .eq('id', session.id).eq('updated_at', session.updated_at).eq('status', 'PLAYING').select().maybeSingle();
  if (error) throw new AppError(500, 'DB_ERROR', `Không thể cập nhật giai đoạn: ${error.message}`);
  if (data) return data;
  const latest = await supabaseAdmin.from('game_sessions').select('*').eq('id', session.id).maybeSingle();
  return latest.data ?? session;
}

async function sessionView(session: any, userId: string) {
  const { current_state, id, room_id, game_id, status, started_at, updated_at } = session;
  const wasSeated = participates(current_state, userId);
  const isPlayer = Boolean(wasSeated && (status !== 'PLAYING' ||
    (await getActiveRoomPlayers(room_id)).some((player) => player.user_id === userId)));
  const engine = resolveEngine(session.game_id);
  return {
    session: { id, room_id, game_id, status, started_at, updated_at },
    state: { ...engine.getPublicState(current_state, isPlayer ? userId : ''), revision: current_state.revision || 0 },
    participants: await getSessionParticipants(current_state),
    isPlayer,
  };
}

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
  const players = (await requireActivePlayer(roomId, userId)).sort((a, b) => (a.seat_index ?? 0) - (b.seat_index ?? 0));
  const { data: game, error: gameError } = await supabaseAdmin.from('games').select('min_players, max_players, is_active').eq('id', room.game_id).single();
  if (gameError || !game?.is_active) throw new AppError(409, 'GAME_DISABLED', 'Trò chơi hiện không khả dụng.');
  if (!againstAi && (players.length < game.min_players || players.length > game.max_players)) {
    throw new AppError(400, 'INVALID_PLAYER_COUNT', `Cần ${game.min_players}–${game.max_players} người để bắt đầu.`);
  }
  if (againstAi && (players.length !== 1 || !['CHESS', 'CO_TUONG'].includes(room.game_id))) {
    throw new AppError(400, 'AI_SETUP_INVALID', 'Đấu máy trực tuyến dành cho bàn cờ có một người thật.');
  }

  const engine = resolveEngine(room.game_id);
  const sessionPlayers = againstAi ? [...players.map((player: any) => player.user_id), `AI_${aiDifficulty}`] : players.map((player: any) => player.user_id);
  const initialState: any = engine.initialize(sessionPlayers, { roomId, gameId: room.game_id });
  if (againstAi) initialState.aiDifficulty = aiDifficulty;
  let { data: session, error: sessionError } = await supabaseAdmin.from('game_sessions')
    .insert({ room_id: roomId, game_id: room.game_id, current_state: initialState, status: 'PLAYING' })
    .select().single();
  if (sessionError?.code === '23505' || sessionError?.message === 'lunu_room_running') {
    const active = await supabaseAdmin.from('game_sessions').select('*').eq('room_id', roomId).eq('status', 'PLAYING').order('started_at', { ascending: false }).limit(1).maybeSingle();
    session = active.data;
    sessionError = active.error;
  }
  if (sessionError?.message === 'INSUFFICIENT_BALANCE') throw new AppError(409, 'INSUFFICIENT_BALANCE', 'Có người chơi không đủ xu để vào ván.');
  if (sessionError?.message === 'lunu_ai_free_only') throw new AppError(400, 'AI_FREE_ONLY', 'Đấu máy trực tuyến chỉ có ở phòng miễn phí.');
  if (sessionError?.message === 'lunu_roster_changed') throw new AppError(409, 'ROSTER_CHANGED', 'Ghế trong phòng vừa thay đổi. Hãy thử bắt đầu lại.');
  if (sessionError || !session) throw new AppError(500, 'DB_ERROR', sessionError?.message || 'Không thể tạo phiên chơi.');

  return reply.send({ success: true, data: { sessionId: session.id, gameId: session.game_id, againstAi, aiDifficulty: againstAi ? aiDifficulty : null }, error: null });
};

export const getActiveRoomSession = async (request: FastifyRequest, reply: FastifyReply) => {
  const { roomId } = request.params as any;
  const userId = request.user!.id;
  const { data: session, error } = await supabaseAdmin.from('game_sessions').select('*').eq('room_id', roomId).eq('status', 'PLAYING').order('started_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new AppError(500, 'DB_ERROR', `Không thể đọc phiên đang chạy: ${error.message}`);
  if (!session) return reply.send({ success: true, data: null, error: null });
  const current = await reconcileExpired(session);
  return reply.send({ success: true, data: current.status === 'PLAYING' ? await sessionView(current, userId) : null, error: null });
};

export const getSessionState = async (request: FastifyRequest, reply: FastifyReply) => {
  const { sessionId } = request.params as any;
  const { data: session, error } = await supabaseAdmin.from('game_sessions').select('*').eq('id', sessionId).single();
  if (error || !session) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy ván đấu');
  return reply.send({ success: true, data: await sessionView(await reconcileExpired(session), request.user!.id), error: null });
};

export const playAction = async (request: FastifyRequest, reply: FastifyReply) => {
  const { sessionId } = request.params as any;
  const { action, revision } = (request.body || {}) as any;
  if (!action || typeof action !== 'object' || typeof action.type !== 'string') {
    throw new AppError(400, 'INVALID_ACTION', 'Hành động không hợp lệ.');
  }
  const userId = request.user!.id;
  const { data: storedSession, error } = await supabaseAdmin.from('game_sessions').select('*').eq('id', sessionId).single();
  const session = storedSession && await reconcileExpired(storedSession);
  if (error || !session || session.status !== 'PLAYING') throw new AppError(400, 'INVALID', 'Game không khả dụng');
  await requireActivePlayer(session.room_id, userId);
  if (revision !== undefined && revision !== Number(session.current_state.revision || 0)) {
    throw new AppError(409, 'STALE_SESSION', 'Bàn có nước đi mới. Hãy thử lại sau khi đồng bộ.');
  }

  if (!participates(session.current_state, userId)) throw new AppError(403, 'SPECTATOR_READ_ONLY', 'Ghế này sẽ có hiệu lực từ ván tiếp theo.');

  const engine = resolveEngine(session.game_id);
  if (!engine.validateAction(session.current_state, action, userId)) throw new AppError(400, 'INVALID_ACTION', 'Nước đi không hợp lệ (Không đúng lượt hoặc sai luật).');
  let { newState, events } = engine.applyAction(session.current_state, action, userId);
  const aiEvents: any[] = [];
  for (let turn = 0; turn < 64; turn += 1) {
    const currentPlayer = newState.currentPlayer || playerIdOf(newState.players?.[newState.currentTurnIndex]);
    if (!currentPlayer?.startsWith('AI_') || typeof (engine as any).getAiAction !== 'function') break;
    const aiDifficulty = newState.aiDifficulty || 'MEDIUM';
    const aiAction = (engine as any).getAiAction(newState, currentPlayer, aiDifficulty);
    if (!aiAction || !(engine as any).validateAction(newState, aiAction, currentPlayer)) break;
    const aiTurn = (engine as any).applyAction(newState, aiAction, currentPlayer);
    newState = aiTurn.newState;
    aiEvents.push(...aiTurn.events.map((event: any) => ({ ...event, automated: true })));
  }
  events = [...events, ...aiEvents];
  const safeEvents = events.map((event: any) => ({ type: event.type, playerId: event.playerId, winner: event.winner, amount: event.amount, action: event.action, dice: event.dice, notation: event.notation, reason: event.reason, automated: event.automated, at: new Date().toISOString() }));
  newState.actionLog = [...(session.current_state.actionLog || []), ...safeEvents].slice(-24);
  newState.revision = Number(session.current_state.revision || 0) + 1;
  const { data: persistedAction, error: updateError } = await supabaseAdmin.from('game_sessions')
    .update({ current_state: newState, ...outcomeColumns(engine, newState), updated_at: nextUpdatedAt(session.updated_at) })
    .eq('id', sessionId)
    .eq('updated_at', session.updated_at)
    .eq('status', 'PLAYING')
    .select('id')
    .maybeSingle();
  if (updateError) throw new AppError(500, 'DB_ERROR', `Không thể lưu nước đi: ${updateError.message}`);
  if (!persistedAction) throw new AppError(409, 'STALE_SESSION', 'Ván vừa có nước đi mới từ người chơi khác. Bàn sẽ tự đồng bộ lại.');

  const publicState = engine.getPublicState(newState, userId);
  return reply.send({ success: true, data: { state: { ...publicState, revision: newState.revision }, events: safeEvents }, error: null });
};

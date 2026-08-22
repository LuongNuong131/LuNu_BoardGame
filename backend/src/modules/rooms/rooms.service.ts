import { supabaseAdmin } from '../../infrastructure/supabase/client';
import { AppError } from '../../shared/errors/AppError';
import { gameRegistry } from '../games/core/GameRegistry';

const isSeatingSchemaError = (error: any) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('role') || message.includes('seat_index') || message.includes('joined_at') || message.includes('participants');
};

export class RoomsService {
  async getLobbyRooms() {
    const modern = await supabaseAdmin
      .from('game_rooms')
      .select('id, name, game_id, owner_id, max_players, status, entry_fee, created_at, owner:profiles!game_rooms_owner_id_fkey(display_name), participants:game_room_players(role)')
      .in('status', ['WAITING', 'RUNNING'])
      .order('status', { ascending: true })
      .order('created_at', { ascending: false });

    if (!modern.error) {
      return (modern.data || []).map((room: any) => {
        const participants = room.participants || [];
        return {
          ...room,
          player_count: participants.filter((participant: any) => participant.role !== 'SPECTATOR').length,
          spectator_count: participants.filter((participant: any) => participant.role === 'SPECTATOR').length,
          participants: undefined
        };
      });
    }

    if (!isSeatingSchemaError(modern.error)) throw new AppError(500, 'DB_ERROR', `Lỗi tải sảnh: ${modern.error.message}`);

    const legacy = await supabaseAdmin
      .from('game_rooms')
      .select('id, name, game_id, owner_id, max_players, status, entry_fee, created_at, owner:profiles!game_rooms_owner_id_fkey(display_name), players:game_room_players(count)')
      .in('status', ['WAITING', 'RUNNING'])
      .order('status', { ascending: true })
      .order('created_at', { ascending: false });
    if (legacy.error) throw new AppError(500, 'DB_ERROR', `Lỗi tải sảnh: ${legacy.error.message}`);
    return (legacy.data || []).map((room: any) => ({ ...room, player_count: room.players?.[0]?.count || 0, spectator_count: 0 }));
  }

  async createRoom(ownerId: string, gameId: string, name: string, maxPlayers: number, entryFee: number = 0) {
    const { data: game, error: gameError } = await supabaseAdmin.from('games').select('*').eq('id', gameId).single();
    if (gameError) throw new AppError(500, 'DB_ERROR', `Lỗi lấy thông tin Game: ${gameError.message}`);
    if (!game) throw new AppError(404, 'GAME_NOT_FOUND', 'Game không tồn tại hệ thống.');
    if (maxPlayers < game.min_players || maxPlayers > game.max_players) {
      throw new AppError(400, 'VALIDATION_ERROR', `Giới hạn người chơi của ${game.name} là ${game.min_players} - ${game.max_players} người.`);
    }

    const { data: room, error: roomError } = await supabaseAdmin
      .from('game_rooms')
      .insert({ game_id: gameId, name, owner_id: ownerId, max_players: maxPlayers, entry_fee: entryFee })
      .select()
      .single();
    if (roomError) throw new AppError(500, 'CREATE_FAILED', `Lỗi DB tạo phòng: ${roomError.message}`);

    const modernJoin = await supabaseAdmin.from('game_room_players').insert({
      room_id: room.id, user_id: ownerId, role: 'PLAYER', seat_index: 1, is_ready: true, joined_at: new Date().toISOString()
    });
    if (modernJoin.error && isSeatingSchemaError(modernJoin.error)) {
      const legacyJoin = await supabaseAdmin.from('game_room_players').insert({ room_id: room.id, user_id: ownerId, is_ready: true });
      if (legacyJoin.error) throw new AppError(500, 'JOIN_FAILED', `Lỗi DB tự động vào phòng: ${legacyJoin.error.message}`);
    } else if (modernJoin.error) {
      throw new AppError(500, 'JOIN_FAILED', `Lỗi DB tự động vào phòng: ${modernJoin.error.message}`);
    }
    return room;
  }

  private async syncRunningSessionPlayer(roomId: string, userId: string) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { data: session } = await supabaseAdmin.from('game_sessions').select('id, game_id, current_state, updated_at').eq('room_id', roomId).eq('status', 'PLAYING').order('started_at', { ascending: false }).limit(1).maybeSingle();
      if (!session) return null;
      if (session.current_state?.players?.includes(userId)) return session.id;
      const engine = gameRegistry.getEngine(session.game_id) as any;
      if (typeof engine.addPlayer !== 'function') throw new AppError(409, 'SESSION_ADMISSION_UNSUPPORTED', 'Engine hiện tại chưa hỗ trợ nhận người chơi mới trong ván đang diễn ra.');
      let nextState = engine.addPlayer(session.current_state, userId);
      const aiId = session.current_state.players?.find((player: string) => player.startsWith('AI_'));
      if (aiId) {
        const aiIndex = session.current_state.players.indexOf(aiId);
        const admittedHand = nextState.hands[userId];
        nextState.players = session.current_state.players.map((player: string, index: number) => index === aiIndex ? userId : player);
        nextState.hands[userId] = admittedHand;
        delete nextState.hands[aiId]; delete nextState.scores[aiId]; delete nextState.bets[aiId]; delete nextState.folded[aiId]; delete nextState.done[aiId]; delete nextState.positions[aiId];
        if (nextState.roles) { nextState.roles[userId] = nextState.roles[aiId] || 'VILLAGER'; delete nextState.roles[aiId]; }
        if (nextState.votes) { Object.entries(nextState.votes).forEach(([voter, target]) => { if (voter === aiId) delete nextState.votes[voter]; else if (target === aiId) nextState.votes[voter] = userId; }); }
      }
      const { data: persisted, error: updateError } = await supabaseAdmin.from('game_sessions').update({ current_state: nextState, updated_at: new Date().toISOString() }).eq('id', session.id).eq('updated_at', session.updated_at).select('id').maybeSingle();
      if (updateError) throw new AppError(500, 'SESSION_ADMISSION_FAILED', `Không thể đồng bộ ghế vào phiên chơi: ${updateError.message}`);
      if (persisted) return session.id;
      await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)));
    }
    throw new AppError(409, 'SESSION_ADMISSION_CONFLICT', 'Bàn vừa nhận người chơi khác. Vui lòng mở lại bàn để nhận ghế mới nhất.');
  }

  async joinRoom(roomId: string, userId: string) {
    const atomicJoin = await supabaseAdmin.rpc('join_room', { p_room_id: roomId, p_user_id: userId });
    if (!atomicJoin.error) {
      const result = atomicJoin.data as any;
      if (result?.mode === 'PLAYER') return { ...result, activeSessionId: await this.syncRunningSessionPlayer(roomId, userId) };
      if (result?.mode === 'SPECTATOR') { const { data: activeSession } = await supabaseAdmin.from('game_sessions').select('id').eq('room_id', roomId).eq('status', 'PLAYING').order('started_at', { ascending: false }).limit(1).maybeSingle(); return { ...result, activeSessionId: activeSession?.id || null }; }
      return result;
    }
    const atomicMessage = String(atomicJoin.error?.message || '').toLowerCase();
    if (!atomicMessage.includes('function') && !atomicMessage.includes('join_room') && !atomicMessage.includes('existing_record') && !isSeatingSchemaError(atomicJoin.error)) {
      if (atomicMessage.includes('room_not_found')) throw new AppError(404, 'ROOM_NOT_FOUND', 'Phòng không tồn tại.');
      throw new AppError(500, 'JOIN_FAILED', `Lỗi DB join phòng: ${atomicJoin.error.message}`);
    }

    const modern = await supabaseAdmin
      .from('game_rooms')
      .select('id, status, max_players, players:game_room_players(user_id, role, seat_index)')
      .eq('id', roomId)
      .single();

    if (!modern.error) {
      const room = modern.data as any;
      if (!room) throw new AppError(404, 'ROOM_NOT_FOUND', 'Phòng không tồn tại.');
      const participants = room.players || [];
      const existing = participants.find((participant: any) => participant.user_id === userId);
      if (existing) { if (existing.role !== 'SPECTATOR' && room.status === 'RUNNING') return { mode: 'PLAYER', seatIndex: existing.seat_index, activeSessionId: await this.syncRunningSessionPlayer(roomId, userId) }; return { mode: existing.role === 'SPECTATOR' ? 'SPECTATOR' : 'PLAYER', seatIndex: existing.seat_index }; }
      const activePlayers = participants.filter((participant: any) => participant.role !== 'SPECTATOR');
      const occupiedSeats = activePlayers.map((participant: any) => participant.seat_index).filter((seat: any) => Number.isInteger(seat));
      const availableSeat = Array.from({ length: room.max_players }, (_, index) => index + 1).find((seat) => !occupiedSeats.includes(seat));
      const role = availableSeat ? 'PLAYER' : 'SPECTATOR';
      const { error } = await supabaseAdmin.from('game_room_players').insert({
        room_id: roomId, user_id: userId, role, seat_index: availableSeat || null, is_ready: role === 'PLAYER', joined_at: new Date().toISOString()
      });
      if (error) throw new AppError(500, 'JOIN_FAILED', `Lỗi DB join phòng: ${error.message}`);
      if (role === 'PLAYER' && room.status === 'RUNNING') return { mode: role, seatIndex: availableSeat || null, activeSessionId: await this.syncRunningSessionPlayer(roomId, userId) };
      return { mode: role, seatIndex: availableSeat || null };
    }

    if (!isSeatingSchemaError(modern.error)) throw new AppError(500, 'DB_ERROR', `Lỗi DB kiểm tra phòng: ${modern.error.message}`);

    const legacy = await supabaseAdmin.from('game_rooms').select('id, status, max_players, players:game_room_players(user_id)').eq('id', roomId).single();
    if (legacy.error || !legacy.data) throw new AppError(404, 'ROOM_NOT_FOUND', 'Phòng không tồn tại.');
    const room = legacy.data as any;
    if ((room.players || []).some((player: any) => player.user_id === userId)) { if (room.status === 'RUNNING') return { mode: 'PLAYER', seatIndex: null, activeSessionId: await this.syncRunningSessionPlayer(roomId, userId) }; return { mode: 'PLAYER', seatIndex: null }; }
    if ((room.players || []).length >= room.max_players) { const { data: activeSession } = await supabaseAdmin.from('game_sessions').select('id').eq('room_id', roomId).eq('status', 'PLAYING').order('started_at', { ascending: false }).limit(1).maybeSingle(); return { mode: 'SPECTATOR', seatIndex: null, activeSessionId: activeSession?.id || null }; }
    const { error } = await supabaseAdmin.from('game_room_players').insert({ room_id: roomId, user_id: userId });
    if (error) throw new AppError(500, 'JOIN_FAILED', `Lỗi DB join phòng: ${error.message}`);
    if (room.status === 'RUNNING') return { mode: 'PLAYER', seatIndex: null, activeSessionId: await this.syncRunningSessionPlayer(roomId, userId) };
    return { mode: 'PLAYER', seatIndex: null };
  }

  async deleteRoom(roomId: string, requesterId: string, requesterRole?: string) {
    const { data: room, error: lookupError } = await supabaseAdmin.from('game_rooms').select('id, owner_id, status').eq('id', roomId).single();
    if (lookupError || !room) throw new AppError(404, 'ROOM_NOT_FOUND', 'Phòng không tồn tại.');
    const isAdmin = requesterRole === 'ADMIN' || requesterRole === 'SUPER_ADMIN';
    if (room.owner_id !== requesterId && !isAdmin) throw new AppError(403, 'FORBIDDEN', 'Chỉ chủ phòng hoặc admin mới được xóa phòng.');
    if (room.status === 'RUNNING' && !isAdmin) throw new AppError(409, 'ROOM_RUNNING', 'Không thể xóa phòng đang diễn ra. Hãy kết thúc ván trước.');
    const { error } = await supabaseAdmin.from('game_rooms').delete().eq('id', roomId);
    if (error) throw new AppError(500, 'DELETE_FAILED', `Không thể xóa phòng: ${error.message}`);
    return { id: roomId };
  }

  async leaveRoom(roomId: string, userId: string) {
    const { error } = await supabaseAdmin.from('game_room_players').delete().eq('room_id', roomId).eq('user_id', userId);
    if (error) throw new AppError(500, 'LEAVE_FAILED', `Lỗi rời phòng: ${error.message}`);
    return { releasedSeat: true };
  }

  async getRoomDetail(roomId: string) {
    const modern = await supabaseAdmin
      .from('game_rooms')
      .select(`*, owner:profiles!game_rooms_owner_id_fkey(id, display_name, username), participants:game_room_players(role, seat_index, joined_at, is_ready, user:profiles(id, display_name, username, avatar_url, level))`)
      .eq('id', roomId)
      .single();
    if (!modern.error && modern.data) {
      const data: any = modern.data;
      const participants = data.participants || [];
      return {
        ...data,
        players: participants.filter((participant: any) => participant.role !== 'SPECTATOR'),
        spectators: participants.filter((participant: any) => participant.role === 'SPECTATOR'),
        spectator_count: participants.filter((participant: any) => participant.role === 'SPECTATOR').length
      };
    }
    if (modern.error && !isSeatingSchemaError(modern.error)) throw new AppError(404, 'NOT_FOUND', 'Phòng không tồn tại.');

    const legacy = await supabaseAdmin
      .from('game_rooms')
      .select(`*, owner:profiles!game_rooms_owner_id_fkey(id, display_name, username), players:game_room_players(is_ready, user:profiles(id, display_name, username, avatar_url, level))`)
      .eq('id', roomId)
      .single();
    if (legacy.error || !legacy.data) throw new AppError(404, 'NOT_FOUND', 'Phòng không tồn tại.');
    return { ...(legacy.data as any), spectators: [], spectator_count: 0 };
  }
}

export const roomsService = new RoomsService();

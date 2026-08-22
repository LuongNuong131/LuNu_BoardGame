import { supabaseAdmin } from '../../infrastructure/supabase/client';
import { AppError } from '../../shared/errors/AppError';

const isSeatingSchemaError = (error: any) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('role') || message.includes('seat_index') || message.includes('joined_at') || message.includes('participants');
};

export class RoomsService {
  async getLobbyRooms() {
    const modern = await supabaseAdmin
      .from('game_rooms')
      .select('id, name, game_id, max_players, status, entry_fee, created_at, owner:profiles!game_rooms_owner_id_fkey(display_name), participants:game_room_players(role)')
      .eq('status', 'WAITING')
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
      .select('id, name, game_id, max_players, status, entry_fee, created_at, owner:profiles!game_rooms_owner_id_fkey(display_name), players:game_room_players(count)')
      .eq('status', 'WAITING')
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

  async joinRoom(roomId: string, userId: string) {
    const atomicJoin = await supabaseAdmin.rpc('join_room', { p_room_id: roomId, p_user_id: userId });
    if (!atomicJoin.error) return atomicJoin.data;
    const atomicMessage = String(atomicJoin.error?.message || '').toLowerCase();
    if (!atomicMessage.includes('function') && !atomicMessage.includes('join_room') && !isSeatingSchemaError(atomicJoin.error)) {
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
      if (existing) return { mode: existing.role === 'SPECTATOR' ? 'SPECTATOR' : 'PLAYER', seatIndex: existing.seat_index };
      if (room.status !== 'WAITING') {
        const { error } = await supabaseAdmin.from('game_room_players').insert({ room_id: roomId, user_id: userId, role: 'SPECTATOR', seat_index: null, is_ready: false, joined_at: new Date().toISOString() });
        if (error) throw new AppError(500, 'JOIN_FAILED', `Lỗi DB vào chế độ khán giả: ${error.message}`);
        return { mode: 'SPECTATOR', seatIndex: null };
      }

      const activePlayers = participants.filter((participant: any) => participant.role !== 'SPECTATOR');
      const occupiedSeats = activePlayers.map((participant: any) => participant.seat_index).filter((seat: any) => Number.isInteger(seat));
      const availableSeat = Array.from({ length: room.max_players }, (_, index) => index + 1).find((seat) => !occupiedSeats.includes(seat));
      const role = availableSeat ? 'PLAYER' : 'SPECTATOR';
      const { error } = await supabaseAdmin.from('game_room_players').insert({
        room_id: roomId, user_id: userId, role, seat_index: availableSeat || null, is_ready: role === 'PLAYER', joined_at: new Date().toISOString()
      });
      if (error) throw new AppError(500, 'JOIN_FAILED', `Lỗi DB join phòng: ${error.message}`);
      return { mode: role, seatIndex: availableSeat || null };
    }

    if (!isSeatingSchemaError(modern.error)) throw new AppError(500, 'DB_ERROR', `Lỗi DB kiểm tra phòng: ${modern.error.message}`);

    const legacy = await supabaseAdmin.from('game_rooms').select('id, status, max_players, players:game_room_players(user_id)').eq('id', roomId).single();
    if (legacy.error || !legacy.data) throw new AppError(404, 'ROOM_NOT_FOUND', 'Phòng không tồn tại.');
    const room = legacy.data as any;
    if ((room.players || []).some((player: any) => player.user_id === userId)) return { mode: 'PLAYER', seatIndex: null };
    if (room.status !== 'WAITING') throw new AppError(400, 'ROOM_NOT_WAITING', 'Trận đấu đang diễn ra. Hãy apply migration để bật chế độ khán giả.');
    if ((room.players || []).length >= room.max_players) throw new AppError(400, 'ROOM_FULL', 'Phòng đầy. Hãy apply migration để bật chế độ khán giả.');
    const { error } = await supabaseAdmin.from('game_room_players').insert({ room_id: roomId, user_id: userId });
    if (error) throw new AppError(500, 'JOIN_FAILED', `Lỗi DB join phòng: ${error.message}`);
    return { mode: 'PLAYER', seatIndex: null };
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

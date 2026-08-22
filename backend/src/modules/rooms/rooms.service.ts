import { supabaseAdmin } from '../../infrastructure/supabase/client';
import { AppError } from '../../shared/errors/AppError';

export class RoomsService {
  async getLobbyRooms() {
    const { data, error } = await supabaseAdmin
      .from('game_rooms')
      .select('id, name, game_id, max_players, status, entry_fee, created_at, owner:profiles!game_rooms_owner_id_fkey(display_name), participants:game_room_players(role)')
      .eq('status', 'WAITING')
      .order('created_at', { ascending: false });

    if (error) throw new AppError(500, 'DB_ERROR', `Lỗi tải sảnh: ${error.message}`);
    return (data || []).map((room: any) => {
      const participants = room.participants || [];
      return {
        ...room,
        player_count: participants.filter((participant: any) => participant.role !== 'SPECTATOR').length,
        spectator_count: participants.filter((participant: any) => participant.role === 'SPECTATOR').length,
        participants: undefined
      };
    });
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

    const { error: joinError } = await supabaseAdmin.from('game_room_players').insert({
      room_id: room.id,
      user_id: ownerId,
      role: 'PLAYER',
      seat_index: 1,
      is_ready: true,
      joined_at: new Date().toISOString()
    });
    if (joinError) throw new AppError(500, 'JOIN_FAILED', `Lỗi DB tự động vào phòng: ${joinError.message}`);
    return room;
  }

  async joinRoom(roomId: string, userId: string) {
    const { data: room, error: fetchError } = await supabaseAdmin
      .from('game_rooms')
      .select('id, status, max_players, players:game_room_players(user_id, role, seat_index)')
      .eq('id', roomId)
      .single();
    if (fetchError) throw new AppError(500, 'DB_ERROR', `Lỗi DB kiểm tra phòng: ${fetchError.message}`);
    if (!room) throw new AppError(404, 'ROOM_NOT_FOUND', 'Phòng không tồn tại.');
    if (room.status !== 'WAITING') throw new AppError(400, 'ROOM_NOT_WAITING', 'Trận đấu đang diễn ra. Bạn có thể vào xem bàn.');

    const participants = room.players || [];
    const existing = participants.find((participant: any) => participant.user_id === userId);
    if (existing) return { mode: existing.role === 'SPECTATOR' ? 'SPECTATOR' : 'PLAYER', seatIndex: existing.seat_index };

    const activePlayers = participants.filter((participant: any) => participant.role !== 'SPECTATOR');
    const occupiedSeats = activePlayers.map((participant: any) => participant.seat_index).filter((seat: any) => Number.isInteger(seat));
    const availableSeat = Array.from({ length: room.max_players }, (_, index) => index + 1).find((seat) => !occupiedSeats.includes(seat));
    const role = availableSeat ? 'PLAYER' : 'SPECTATOR';

    const { error } = await supabaseAdmin.from('game_room_players').insert({
      room_id: roomId,
      user_id: userId,
      role,
      seat_index: availableSeat || null,
      is_ready: role === 'PLAYER',
      joined_at: new Date().toISOString()
    });
    if (error) throw new AppError(500, 'JOIN_FAILED', `Lỗi DB join phòng: ${error.message}`);
    return { mode: role, seatIndex: availableSeat || null };
  }

  async leaveRoom(roomId: string, userId: string) {
    const { error } = await supabaseAdmin.from('game_room_players').delete().eq('room_id', roomId).eq('user_id', userId);
    if (error) throw new AppError(500, 'LEAVE_FAILED', `Lỗi rời phòng: ${error.message}`);
    return { releasedSeat: true };
  }

  async getRoomDetail(roomId: string) {
    const { data, error } = await supabaseAdmin
      .from('game_rooms')
      .select(`
        *,
        owner:profiles!game_rooms_owner_id_fkey(id, display_name, username),
        participants:game_room_players(
          role,
          seat_index,
          joined_at,
          is_ready,
          user:profiles(id, display_name, username, avatar_url, level)
        )
      `)
      .eq('id', roomId)
      .single();
    if (error || !data) throw new AppError(404, 'NOT_FOUND', 'Phòng không tồn tại.');

    const participants = data.participants || [];
    return {
      ...data,
      players: participants.filter((participant: any) => participant.role !== 'SPECTATOR'),
      spectators: participants.filter((participant: any) => participant.role === 'SPECTATOR'),
      spectator_count: participants.filter((participant: any) => participant.role === 'SPECTATOR').length
    };
  }
}

export const roomsService = new RoomsService();

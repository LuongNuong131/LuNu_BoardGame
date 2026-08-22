import { supabaseAdmin } from '../../infrastructure/supabase/client';
import { AppError } from '../../shared/errors/AppError';

export class RoomsService {
  async getLobbyRooms() {
    const { data, error } = await supabaseAdmin
      .from('game_rooms')
      .select('id, name, game_id, max_players, status, entry_fee, owner:profiles!game_rooms_owner_id_fkey(display_name), players:game_room_players(count)')
      .eq('status', 'WAITING')
      .order('created_at', { ascending: false });

    if (error) throw new AppError(500, 'DB_ERROR', `Lỗi tải sảnh: ${error.message}`);
    return data;
  }

  async createRoom(ownerId: string, gameId: string, name: string, maxPlayers: number, entryFee: number = 0) {
    // 1. Kiểm tra cấu hình game có hợp lệ không
    const { data: game, error: gameError } = await supabaseAdmin.from('games').select('*').eq('id', gameId).single();
    if (gameError) throw new AppError(500, 'DB_ERROR', `Lỗi lấy thông tin Game: ${gameError.message}`);
    if (!game) throw new AppError(404, 'GAME_NOT_FOUND', 'Game không tồn tại hệ thống.');
    
    if (maxPlayers < game.min_players || maxPlayers > game.max_players) {
      throw new AppError(400, 'VALIDATION_ERROR', `Giới hạn người chơi của ${game.name} là ${game.min_players} - ${game.max_players} người.`);
    }

    // 2. Tạo phòng
    const { data: room, error: roomError } = await supabaseAdmin
      .from('game_rooms')
      .insert({ game_id: gameId, name, owner_id: ownerId, max_players: maxPlayers, entry_fee: entryFee })
      .select()
      .single();

    if (roomError) throw new AppError(500, 'CREATE_FAILED', `Lỗi DB tạo phòng: ${roomError.message}`);

    // 3. Tự động đẩy Chủ phòng vào
    const { error: joinError } = await supabaseAdmin.from('game_room_players').insert({ room_id: room.id, user_id: ownerId, is_ready: true });
    if (joinError) throw new AppError(500, 'JOIN_FAILED', `Lỗi DB tự động vào phòng: ${joinError.message}`);

    return room;
  }

  async joinRoom(roomId: string, userId: string) {
    const { data: room, error: fetchError } = await supabaseAdmin.from('game_rooms').select('*, players:game_room_players(*)').eq('id', roomId).single();
    
    if (fetchError) throw new AppError(500, 'DB_ERROR', `Lỗi DB kiểm tra phòng: ${fetchError.message}`);
    if (!room) throw new AppError(404, 'ROOM_NOT_FOUND', 'Phòng không tồn tại.');
    if (room.status !== 'WAITING') throw new AppError(400, 'ROOM_NOT_WAITING', 'Trận đấu đang diễn ra hoặc đã kết thúc.');
    if (room.players.length >= room.max_players) throw new AppError(400, 'ROOM_FULL', 'Phòng đã đầy.');
    
    const isAlreadyIn = room.players.find((p: any) => p.user_id === userId);
    if (isAlreadyIn) return room;

    const { error } = await supabaseAdmin.from('game_room_players').insert({ room_id: roomId, user_id: userId });
    if (error) throw new AppError(500, 'JOIN_FAILED', `Lỗi DB join phòng: ${error.message}`);
    
    return room;
  }

  async getRoomDetail(roomId: string) {
    const { data, error } = await supabaseAdmin
      .from('game_rooms')
      .select(`
        *,
        owner:profiles!game_rooms_owner_id_fkey(id, display_name, username),
        players:game_room_players(
          is_ready,
          user:profiles(id, display_name, username, avatar_url, level)
        )
      `)
      .eq('id', roomId)
      .single();

    if (error || !data) throw new AppError(404, 'NOT_FOUND', 'Phòng không tồn tại.');
    return data;
  }
}

export const roomsService = new RoomsService();
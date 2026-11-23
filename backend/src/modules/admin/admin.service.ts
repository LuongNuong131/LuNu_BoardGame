import { supabaseAdmin } from '../../infrastructure/supabase/client';
import { AppError } from '../../shared/errors/AppError';

const countRows = async (table: string, filter?: (query: any) => any) => {
  let query = supabaseAdmin.from(table).select('*', { count: 'exact', head: true });
  if (filter) query = filter(query);
  const { count, error } = await query;
  if (error) throw new AppError(500, 'DB_ERROR', `Không thể đọc ${table}: ${error.message}`);
  return count || 0;
};

export class AdminService {
  async getOverview() {
    const [users, rooms, sessions, transactions] = await Promise.all([
      countRows('profiles'),
      countRows('game_rooms'),
      countRows('game_sessions', (query) => query.eq('status', 'PLAYING')),
      countRows('wallet_transactions')
    ]);

    const { data: recentTransactions, error: transactionError } = await supabaseAdmin
      .from('wallet_transactions')
      .select('id, user_id, amount, type, reason, admin_id, created_at')
      .order('created_at', { ascending: false })
      .limit(6);
    if (transactionError) throw new AppError(500, 'DB_ERROR', `Không thể đọc giao dịch gần đây: ${transactionError.message}`);
    const recentUserIds = [...new Set((recentTransactions || []).map((item: any) => item.user_id))];
    const { data: recentProfiles } = recentUserIds.length
      ? await supabaseAdmin.from('profiles').select('id, username, display_name').in('id', recentUserIds)
      : { data: [] };
    const recentProfileMap = new Map((recentProfiles || []).map((profile: any) => [profile.id, profile]));

    const { data: activeRooms, error: roomError } = await supabaseAdmin
      .from('game_rooms')
      .select('id, name, game_id, status, max_players, entry_fee, created_at, owner:profiles!game_rooms_owner_id_fkey(display_name), participants:game_room_players(role)')
      .in('status', ['WAITING', 'RUNNING'])
      .order('created_at', { ascending: false })
      .limit(5);
    if (roomError) throw new AppError(500, 'DB_ERROR', `Không thể đọc phòng đang hoạt động: ${roomError.message}`);

    return {
      metrics: { users, rooms, liveSessions: sessions, transactions },
      recentTransactions: (recentTransactions || []).map((transaction: any) => ({ ...transaction, type: transaction.type || 'LEGACY', reason: transaction.reason || 'Giao dịch cũ', user: recentProfileMap.get(transaction.user_id) || null })),
      activeRooms: (activeRooms || []).map((room: any) => ({
        ...room,
        player_count: (room.participants || []).filter((item: any) => item.role !== 'SPECTATOR').length,
        spectator_count: (room.participants || []).filter((item: any) => item.role === 'SPECTATOR').length,
        participants: undefined
      }))
    };
  }

  async getUsers() {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, status, level, xp, created_at, wallets(balance)')
      .order('created_at', { ascending: false });
    if (error) throw new AppError(500, 'DB_ERROR', `Không thể lấy danh sách người chơi: ${error.message}`);
    return data || [];
  }

  async getRooms() {
    const { data, error } = await supabaseAdmin
      .from('game_rooms')
      .select('id, name, game_id, status, max_players, entry_fee, created_at, owner:profiles!game_rooms_owner_id_fkey(display_name), participants:game_room_players(role)')
      .order('created_at', { ascending: false });
    if (error) throw new AppError(500, 'DB_ERROR', `Không thể lấy danh sách phòng: ${error.message}`);
    return (data || []).map((room: any) => ({
      ...room,
      player_count: (room.participants || []).filter((item: any) => item.role !== 'SPECTATOR').length,
      spectator_count: (room.participants || []).filter((item: any) => item.role === 'SPECTATOR').length,
      participants: undefined
    }));
  }

  async getGames() {
    const { data, error } = await supabaseAdmin.from('games').select('*').order('name');
    if (error) throw new AppError(500, 'DB_ERROR', `Không thể lấy catalog game: ${error.message}`);
    return data || [];
  }

  async getTransactions(limit = 100) {
    const { data, error } = await supabaseAdmin
      .from('wallet_transactions')
      .select('id, user_id, amount, type, reason, admin_id, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new AppError(500, 'DB_ERROR', `Không thể lấy lịch sử giao dịch: ${error.message}`);
    const profileIds = [...new Set((data || []).flatMap((item: any) => [item.user_id, item.admin_id].filter(Boolean)))];
    const { data: profiles } = profileIds.length
      ? await supabaseAdmin.from('profiles').select('id, username, display_name').in('id', profileIds)
      : { data: [] };
    const profileMap = new Map((profiles || []).map((profile: any) => [profile.id, profile]));
    return (data || []).map((transaction: any) => ({ ...transaction, type: transaction.type || 'LEGACY', reason: transaction.reason || 'Giao dịch cũ', user: profileMap.get(transaction.user_id) || null, admin: profileMap.get(transaction.admin_id) || null }));
  }

  async deleteUser(userId: string, requesterId: string) {
    if (userId === requesterId) throw new AppError(400, 'SELF_DELETE_NOT_ALLOWED', 'Không thể tự xóa tài khoản admin đang đăng nhập.');
    const { data: target, error: targetError } = await supabaseAdmin.from('profiles').select('id, role').eq('id', userId).single();
    if (targetError || !target) throw new AppError(404, 'USER_NOT_FOUND', 'Không tìm thấy người dùng.');
    if (target.role === 'SUPER_ADMIN') throw new AppError(403, 'PROTECTED_USER', 'Không thể xóa tài khoản SUPER_ADMIN.');
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new AppError(500, 'DELETE_FAILED', `Không thể xóa tài khoản: ${error.message}`);
    return { id: userId };
  }

  async updateUserStatus(userId: string, status: string) {
    const allowed = ['ACTIVE', 'SUSPENDED', 'BANNED', 'DISABLED'];
    if (!allowed.includes(status)) throw new AppError(400, 'VALIDATION_ERROR', 'Trạng thái tài khoản không hợp lệ.');
    const { data, error } = await supabaseAdmin.from('profiles').update({ status }).eq('id', userId).select('id, username, status').single();
    if (error || !data) throw new AppError(500, 'UPDATE_FAILED', error?.message || 'Không thể cập nhật trạng thái tài khoản.');
    return data;
  }

  async updateRoomStatus(roomId: string, status: string) {
    const allowed = ['WAITING', 'RUNNING', 'FINISHED', 'CANCELLED'];
    if (!allowed.includes(status)) throw new AppError(400, 'VALIDATION_ERROR', 'Trạng thái phòng không hợp lệ.');
    const { data, error } = await supabaseAdmin.from('game_rooms').update({ status }).eq('id', roomId).select('id, status').single();
    if (error?.message === 'lunu_no_active_session') throw new AppError(409, 'INVALID_ROOM_STATE', 'Hãy bắt đầu ván từ trong phòng trước.');
    if (error || !data) throw new AppError(500, 'UPDATE_FAILED', error?.message || 'Không thể cập nhật trạng thái phòng.');
    return data;
  }
}

export const adminService = new AdminService();

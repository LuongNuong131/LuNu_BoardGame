import { supabaseAdmin } from '../../infrastructure/supabase/client';
import { AppError } from '../../shared/errors/AppError';

export class AuthService {
  async login(username: string, password: string) {
    // Trick: Supabase yêu cầu email, mình map username nội bộ thành định dạng email
    const internalEmail = `${username}@gameverse.local`;

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email: internalEmail,
      password,
    });

    if (error) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Sai tên đăng nhập hoặc mật khẩu.');
    }

    return data;
  }

  async getMe(userId: string) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, display_name, avatar_url, avatar_path, role, status, level, xp, created_at')
      .eq('id', userId)
      .single();

    if (error || !data) {
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy thông tin hồ sơ.');
    }

    return data;
  }

  async updateProfile(userId: string, payload: { display_name?: string; avatar_url?: string | null; avatar_path?: string | null }) {
    const displayName = payload.display_name?.trim();
    if (displayName !== undefined && (displayName.length < 2 || displayName.length > 40)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Tên hiển thị phải từ 2 đến 40 ký tự.');
    }
    const update: Record<string, unknown> = {};
    if (displayName !== undefined) update.display_name = displayName;
    if (payload.avatar_url !== undefined) update.avatar_url = payload.avatar_url;
    if (payload.avatar_path !== undefined) update.avatar_path = payload.avatar_path;
    if (!Object.keys(update).length) throw new AppError(400, 'VALIDATION_ERROR', 'Không có thông tin cần cập nhật.');

    const { data, error } = await supabaseAdmin.from('profiles').update(update).eq('id', userId)
      .select('id, username, display_name, avatar_url, avatar_path, role, status, level, xp, created_at').single();
    if (error || !data) throw new AppError(500, 'UPDATE_FAILED', error?.message || 'Không thể cập nhật hồ sơ.');
    return data;
  }
}

export const authService = new AuthService();
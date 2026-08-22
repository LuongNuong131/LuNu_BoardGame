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
      .select('id, username, display_name, avatar_url, role, status, level, xp, created_at')
      .eq('id', userId)
      .single();

    if (error || !data) {
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy thông tin hồ sơ.');
    }

    return data;
  }
}

export const authService = new AuthService();
import { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../shared/errors/AppError';
import { supabaseAdmin } from '../infrastructure/supabase/client';

export const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  const authHeader = request.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(401, 'AUTH_REQUIRED', 'Missing or invalid authorization header.');
  }

  const token = authHeader.split(' ')[1];
  
  // Xác thực token với Supabase
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    throw new AppError(401, 'AUTH_REQUIRED', 'Invalid or expired token.');
  }

  // Lấy thêm Role và Status từ bảng profiles để xác thực quyền
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, status')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    throw new AppError(401, 'AUTH_REQUIRED', 'User profile not found.');
  }

  // Chặn tài khoản vi phạm
  if (profile.status === 'BANNED') {
    throw new AppError(403, 'USER_BANNED', 'This account has been banned permanently.');
  }
  if (profile.status === 'SUSPENDED') {
    throw new AppError(403, 'USER_SUSPENDED', 'This account is currently suspended.');
  }
  if (profile.status === 'DISABLED') {
    throw new AppError(403, 'USER_DISABLED', 'This account has been disabled by admin.');
  }

  // Gắn data vào request để các route bên trong sử dụng
  request.user = {
    id: user.id,
    role: profile.role,
    status: profile.status
  };
};

export const requireRole = (allowedRoles: string[]) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Đảm bảo phải chạy qua requireAuth trước
    if (!request.user) {
      throw new AppError(401, 'AUTH_REQUIRED', 'Authentication required.');
    }
    
    if (!allowedRoles.includes(request.user.role)) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action.');
    }
  };
};
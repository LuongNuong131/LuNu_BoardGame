import { FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin } from '../../infrastructure/supabase/client';
import { AppError } from '../../shared/errors/AppError';

// Lấy danh sách người dùng (Kèm ví)
export const getUsers = async (request: FastifyRequest, reply: FastifyReply) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select(`
      *,
      wallets ( balance )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError(500, 'DB_ERROR', 'Không thể lấy danh sách người chơi.');
  }

  return reply.send({ success: true, data, error: null });
};

// Admin tạo người chơi mới
export const createUser = async (request: FastifyRequest, reply: FastifyReply) => {
  const { username, password, display_name, role } = request.body as any;

  if (!username || !password || !display_name) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Vui lòng nhập đủ thông tin (Username, Password, Display Name).');
  }

  const internalEmail = `${username}@gameverse.local`;

  // Gọi Auth Admin để tạo tài khoản (Sẽ kích hoạt Trigger SQL tạo Ví và mồi 10,000 tiền)
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: internalEmail,
    password: password,
    email_confirm: true,
    user_metadata: {
      username,
      display_name,
      role: role || 'USER'
    }
  });

  if (error) {
    throw new AppError(400, 'CREATE_USER_FAILED', error.message);
  }

  return reply.send({ success: true, data: data.user, error: null });
};
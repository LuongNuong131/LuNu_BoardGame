import { FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin } from '../../infrastructure/supabase/client';
import { AppError } from '../../shared/errors/AppError';
import { adminService } from './admin.service';

export const getOverview = async (_request: FastifyRequest, reply: FastifyReply) => {
  const data = await adminService.getOverview();
  return reply.send({ success: true, data, error: null });
};

export const getUsers = async (_request: FastifyRequest, reply: FastifyReply) => {
  const data = await adminService.getUsers();
  return reply.send({ success: true, data, error: null });
};

export const getRooms = async (_request: FastifyRequest, reply: FastifyReply) => {
  const data = await adminService.getRooms();
  return reply.send({ success: true, data, error: null });
};

export const getGames = async (_request: FastifyRequest, reply: FastifyReply) => {
  const data = await adminService.getGames();
  return reply.send({ success: true, data, error: null });
};

export const getTransactions = async (request: FastifyRequest, reply: FastifyReply) => {
  const limit = Math.min(Number((request.query as any)?.limit || 100), 500);
  const data = await adminService.getTransactions(limit);
  return reply.send({ success: true, data, error: null });
};

export const deleteUser = async (request: FastifyRequest, reply: FastifyReply) => {
  const { id } = request.params as any;
  const data = await adminService.deleteUser(id, request.user!.id);
  return reply.send({ success: true, data, error: null });
};

export const updateUserStatus = async (request: FastifyRequest, reply: FastifyReply) => {
  const { id } = request.params as any;
  const { status } = request.body as any;
  const data = await adminService.updateUserStatus(id, status);
  return reply.send({ success: true, data, error: null });
};

export const updateRoomStatus = async (request: FastifyRequest, reply: FastifyReply) => {
  const { id } = request.params as any;
  const { status } = request.body as any;
  const data = await adminService.updateRoomStatus(id, status);
  return reply.send({ success: true, data, error: null });
};

export const createUser = async (request: FastifyRequest, reply: FastifyReply) => {
  const { username, password, display_name, role } = request.body as any;
  if (!username || !password || !display_name) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Vui lòng nhập đủ thông tin (Username, Password, Display Name).');
  }

  const accountRole = role || 'USER';
  if (!['USER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN'].includes(accountRole)) throw new AppError(400, 'INVALID_ROLE', 'Vai trò không hợp lệ.');
  if (request.user!.role !== 'SUPER_ADMIN' && ['ADMIN', 'SUPER_ADMIN'].includes(accountRole)) {
    throw new AppError(403, 'FORBIDDEN', 'Chỉ SUPER_ADMIN có thể tạo tài khoản quản trị.');
  }
  const internalEmail = `${username}@gameverse.local`;
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: internalEmail,
    password,
    email_confirm: true,
    user_metadata: { username, display_name },
    app_metadata: { role: accountRole }
  });
  if (error) throw new AppError(400, 'CREATE_USER_FAILED', error.message);
  return reply.send({ success: true, data: data.user, error: null });
};

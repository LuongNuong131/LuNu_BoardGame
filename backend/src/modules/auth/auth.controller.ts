import { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from './auth.service';

export const login = async (request: FastifyRequest, reply: FastifyReply) => {
  const { username, password } = request.body as any;
  
  if (!username || !password) {
    return reply.status(400).send({ 
      success: false, 
      data: null, 
      error: { code: 'VALIDATION_ERROR', message: 'Vui lòng nhập Username và Password.' } 
    });
  }

  const sessionData = await authService.login(username, password);
  
  return reply.send({ 
    success: true, 
    data: sessionData, 
    error: null 
  });
};

export const logout = async (request: FastifyRequest, reply: FastifyReply) => {
  // Với JWT của Supabase, thao tác logout chủ yếu xử lý ở client (xóa token).
  // Endpoint này để dự phòng mở rộng logic ghi log hoặc invalidate session sau này.
  return reply.send({ 
    success: true, 
    data: { message: 'Đăng xuất thành công.' }, 
    error: null 
  });
};

export const getMe = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user!.id;
  const profile = await authService.getMe(userId);
  
  return reply.send({ 
    success: true, 
    data: profile, 
    error: null 
  });
};
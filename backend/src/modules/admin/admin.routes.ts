import { FastifyInstance } from 'fastify';
import * as adminController from './admin.controller';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';

export async function adminRoutes(server: FastifyInstance) {
  // Guard bảo vệ cấp độ Module: Bắt buộc Đăng nhập + Quyền Admin
  server.addHook('preHandler', requireAuth);
  server.addHook('preHandler', requireRole(['SUPER_ADMIN', 'ADMIN']));

  server.get('/users', adminController.getUsers);
  server.post('/users', adminController.createUser);
}
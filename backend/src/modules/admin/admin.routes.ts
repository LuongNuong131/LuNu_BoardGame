import { FastifyInstance } from 'fastify';
import * as adminController from './admin.controller';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';

export async function adminRoutes(server: FastifyInstance) {
  server.addHook('preHandler', requireAuth);
  server.addHook('preHandler', requireRole(['SUPER_ADMIN', 'ADMIN']));

  server.get('/overview', adminController.getOverview);
  server.get('/users', adminController.getUsers);
  server.post('/users', adminController.createUser);
  server.patch('/users/:id/status', adminController.updateUserStatus);
  server.get('/rooms', adminController.getRooms);
  server.patch('/rooms/:id/status', adminController.updateRoomStatus);
  server.get('/games', adminController.getGames);
  server.get('/transactions', adminController.getTransactions);
}

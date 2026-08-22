import { FastifyInstance } from 'fastify';
import * as roomsController from './rooms.controller';
import { requireAuth } from '../../middleware/auth.middleware';

export async function roomsRoutes(server: FastifyInstance) {
  server.addHook('preHandler', requireAuth); // Khóa toàn bộ Room, phải login mới được vào Sảnh
  
  server.get('/', roomsController.getRooms);
  server.post('/', roomsController.createRoom);
  server.post('/:id/join', roomsController.joinRoom);
  server.post('/:id/leave', roomsController.leaveRoom);
  server.get('/:id', roomsController.getRoomDetail);
}
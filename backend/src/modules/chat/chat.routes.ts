import { FastifyInstance } from 'fastify';
import * as chatController from './chat.controller';
import { requireAuth } from '../../middleware/auth.middleware';

export async function chatRoutes(server: FastifyInstance) {
  server.addHook('preHandler', requireAuth);
  
  server.get('/:channelId/history', chatController.getHistory);
  server.post('/:channelId/messages', chatController.sendMessage);
}
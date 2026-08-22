import { FastifyInstance } from 'fastify';
import * as sessionController from './session.controller';
import { requireAuth } from '../../../middleware/auth.middleware';

export async function sessionRoutes(server: FastifyInstance) {
  server.addHook('preHandler', requireAuth);
  
  server.post('/room/:roomId/start', sessionController.startGame);
  server.get('/:sessionId', sessionController.getSessionState);
  server.post('/:sessionId/action', sessionController.playAction);
}
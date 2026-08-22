import { FastifyInstance } from 'fastify';
import * as authController from './auth.controller';
import { requireAuth } from '../../middleware/auth.middleware';

export async function authRoutes(server: FastifyInstance) {
  // Public routes
  server.post('/login', authController.login);
  server.post('/logout', authController.logout);
  
  // Protected routes (Bắt buộc phải có token)
  server.get('/me', { preHandler: [requireAuth] }, authController.getMe);
}
import { FastifyInstance } from 'fastify';
import * as walletController from './wallet.controller';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';

export async function walletRoutes(server: FastifyInstance) {
  server.addHook('preHandler', requireAuth);

  // User routes
  server.get('/balance', walletController.getMyBalance);
  server.get('/history', walletController.getMyHistory);

  // Admin routes
  server.post('/admin/modify', { preHandler: [requireRole(['SUPER_ADMIN', 'ADMIN'])] }, walletController.adminModifyWallet);
}
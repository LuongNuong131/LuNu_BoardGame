import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import { authRoutes } from './modules/auth/auth.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { walletRoutes } from './modules/wallet/wallet.routes';
import { roomsRoutes } from './modules/rooms/rooms.routes';
import { chatRoutes } from './modules/chat/chat.routes';
import { sessionRoutes } from './modules/games/sessions/session.routes';
import { initializeGames } from './modules/games/core/init-games';

dotenv.config();

// KÍCH HOẠT ENGINE CÁC GAME
initializeGames();

const server = fastify({ logger: { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' } } } });

server.register(helmet);
server.register(cors, { origin: '*', credentials: true });
server.setErrorHandler(errorHandler);

server.get('/api/health', async (request, reply) => reply.send({ success: true, data: { status: 'ONLINE' }, error: null }));

server.register(authRoutes, { prefix: '/api/auth' });
server.register(adminRoutes, { prefix: '/api/admin' });
server.register(walletRoutes, { prefix: '/api/wallet' });
server.register(roomsRoutes, { prefix: '/api/rooms' });
server.register(chatRoutes, { prefix: '/api/chat' });
server.register(sessionRoutes, { prefix: '/api/sessions' }); // Đăng ký API Game Session

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';
    try {
      const multipartModuleName: string = '@fastify/multipart';
      const multipart: any = await import(multipartModuleName);
      await server.register(multipart.default, { limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
      server.log.info('Avatar multipart upload is enabled.');
    } catch {
      server.log.warn('Optional @fastify/multipart is not installed; avatar upload is temporarily disabled.');
    }
    await server.listen({ port, host });
    server.log.info(`GameVerse Backend is running on http://${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};
start();
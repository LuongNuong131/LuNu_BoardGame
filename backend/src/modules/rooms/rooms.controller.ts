import { FastifyRequest, FastifyReply } from 'fastify';
import { roomsService } from './rooms.service';
import { AppError } from '../../shared/errors/AppError';

export const getRooms = async (_request: FastifyRequest, reply: FastifyReply) => {
  const rooms = await roomsService.getLobbyRooms();
  return reply.send({ success: true, data: rooms, error: null });
};

export const createRoom = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user!.id;
  const { game_id, name, max_players, entry_fee } = request.body as any;
  if (!game_id || !name || !max_players) throw new AppError(400, 'VALIDATION_ERROR', 'Vui lòng nhập đủ thông tin tạo phòng.');
  const room = await roomsService.createRoom(userId, game_id, name, parseInt(max_players), parseInt(entry_fee) || 0);
  return reply.send({ success: true, data: room, error: null });
};

export const joinRoom = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user!.id;
  const { id } = request.params as any;
  const result = await roomsService.joinRoom(id, userId);
  return reply.send({
    success: true,
    data: {
      message: result.mode === 'PLAYER' ? 'Đã giữ ghế trong phòng.' : 'Phòng đã đủ ghế. Bạn đã vào chế độ khán giả.',
      mode: result.mode,
      seatIndex: result.seatIndex
    },
    error: null
  });
};

export const deleteRoom = async (request: FastifyRequest, reply: FastifyReply) => {
  const { id } = request.params as any;
  const result = await roomsService.deleteRoom(id, request.user!.id, request.user!.role);
  return reply.send({ success: true, data: result, error: null });
};

export const leaveRoom = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user!.id;
  const { id } = request.params as any;
  const result = await roomsService.leaveRoom(id, userId);
  return reply.send({ success: true, data: result, error: null });
};

export const getRoomDetail = async (request: FastifyRequest, reply: FastifyReply) => {
  const { id } = request.params as any;
  const room = await roomsService.getRoomDetail(id);
  return reply.send({ success: true, data: room, error: null });
};

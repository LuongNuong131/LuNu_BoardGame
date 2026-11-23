import { FastifyRequest, FastifyReply } from 'fastify';
import { roomsService } from './rooms.service';
import { AppError } from '../../shared/errors/AppError';

export const getRooms = async (_request: FastifyRequest, reply: FastifyReply) => {
  const rooms = await roomsService.getLobbyRooms();
  return reply.send({ success: true, data: rooms, error: null });
};

export const createRoom = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user!.id;
  const { game_id, name, max_players, entry_fee = 0 } = (request.body || {}) as Record<string, unknown>;
  if (typeof game_id !== 'string' || typeof name !== 'string' || !name.trim() || name.trim().length > 80 ||
      typeof max_players !== 'number' || !Number.isSafeInteger(max_players) ||
      typeof entry_fee !== 'number' || !Number.isSafeInteger(entry_fee) || entry_fee < 0 || entry_fee > 1000000) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Tên phòng tối đa 80 ký tự. Số ghế và mức phí phải là số nguyên hợp lệ.');
  }
  const room = await roomsService.createRoom(userId, game_id, name.trim(), max_players, entry_fee);
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
      seatIndex: result.seatIndex,
      activeSessionId: result.activeSessionId || null
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

import { FastifyRequest, FastifyReply } from 'fastify';
import { walletService } from './wallet.service';
import { AppError } from '../../shared/errors/AppError';

export const getMyBalance = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user!.id;
  const balance = await walletService.getBalance(userId);
  return reply.send({ success: true, data: { balance }, error: null });
};

export const getMyHistory = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user!.id;
  const history = await walletService.getHistory(userId);
  return reply.send({ success: true, data: history, error: null });
};

// Admin Action
export const adminModifyWallet = async (request: FastifyRequest, reply: FastifyReply) => {
  const adminId = request.user!.id;
  const { target_user_id, amount, action, reason } = request.body as any;

  if (!target_user_id || !amount || !action || !reason) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Thiếu dữ liệu nạp/rút.');
  }

  const parsedAmount = parseInt(amount, 10);
  if (parsedAmount <= 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Số tiền phải lớn hơn 0.');
  }

  const finalAmount = action === 'DEDUCT' ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);
  const type = action === 'DEDUCT' ? 'ADMIN_DEDUCT' : 'ADMIN_GRANT';

  const result = await walletService.processTransaction(target_user_id, finalAmount, type, reason, adminId);
  return reply.send({ success: true, data: result, error: null });
};
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
  const { target_user_id, amount, action, reason } = (request.body || {}) as Record<string, unknown>;
  if (typeof target_user_id !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(target_user_id) ||
      typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0 ||
      (action !== 'GRANT' && action !== 'DEDUCT') || typeof reason !== 'string' || !reason.trim() || reason.trim().length > 200) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Chọn loại giao dịch, nhập số xu nguyên dương và lý do tối đa 200 ký tự.');
  }

  const finalAmount = action === 'DEDUCT' ? -amount : amount;
  const type = action === 'DEDUCT' ? 'ADMIN_DEDUCT' : 'ADMIN_GRANT';

  const result = await walletService.processTransaction(target_user_id, finalAmount, type, reason.trim(), adminId);
  return reply.send({ success: true, data: result, error: null });
};
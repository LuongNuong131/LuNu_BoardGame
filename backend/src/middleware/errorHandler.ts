import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../shared/errors/AppError';

export const errorHandler = (error: FastifyError | AppError | Error, request: FastifyRequest, reply: FastifyReply) => {
  request.log.error(error);

  // Trick: Dùng duck-typing kiểm tra thuộc tính thay vì instanceof để chống lỗi class kế thừa
  if ('statusCode' in error && 'code' in error) {
    const appErr = error as AppError;
    return reply.status(appErr.statusCode).send({
      success: false,
      data: null,
      error: {
        code: appErr.code,
        message: appErr.message
      }
    });
  }

  // Nếu là lỗi hệ thống / Supabase quăng ra, lôi thẳng message ra để dễ debug
  const errorMessage = error.message || 'Internal Server Error';
  
  return reply.status(500).send({
    success: false,
    data: null,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: `Lỗi Hệ Thống: ${errorMessage}` // Bây giờ Frontend sẽ hiển thị chính xác lỗi này
    }
  });
};
import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../shared/errors/AppError';

export const errorHandler = (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
  request.log.error({ err: error }, 'Global error handler caught an error');

  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      success: false,
      data: null,
      error: {
        code: error.code,
        message: error.message
      }
    });
  }

  // Fallback for unhandled/native errors
  return reply.status(500).send({
    success: false,
    data: null,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.'
    }
  });
};
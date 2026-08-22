import { FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin } from '../../infrastructure/supabase/client';
import { AppError } from '../../shared/errors/AppError';

export const getHistory = async (request: FastifyRequest, reply: FastifyReply) => {
  const { channelId } = request.params as { channelId: string };

  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .select('*')
    .eq('channel_id', channelId)
    .gt('expires_at', new Date().toISOString()) // Chỉ lấy tin nhắn chưa hết hạn
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) throw new AppError(500, 'DB_ERROR', 'Lỗi khi tải lịch sử chat.');
  return reply.send({ success: true, data, error: null });
};

export const sendMessage = async (request: FastifyRequest, reply: FastifyReply) => {
  const user = request.user!;
  const { channelId } = request.params as { channelId: string };
  const { content } = request.body as { content: string };

  if (!content || content.trim().length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Tin nhắn không được để trống.');
  }

  // Lấy thông tin user để lưu cứng vào dòng chat (Giúp Realtime render lẹ)
  const { data: profile } = await supabaseAdmin.from('profiles').select('display_name, role').eq('id', user.id).single();

  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .insert({
      channel_id: channelId,
      user_id: user.id,
      user_display_name: profile?.display_name || 'Unknown',
      user_role: profile?.role || 'USER',
      content: content.trim()
    })
    .select()
    .single();

  if (error) throw new AppError(500, 'DB_ERROR', 'Lỗi gửi tin nhắn.');
  return reply.send({ success: true, data, error: null });
};
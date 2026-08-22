import { FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin } from '../../infrastructure/supabase/client';
import { AppError } from '../../shared/errors/AppError';

const normalizeMessage = (row: any) => ({
  ...row,
  content: row.content ?? row.message ?? '',
  user_display_name: row.user_display_name ?? 'Thành viên',
  user_role: row.user_role ?? 'USER'
});

export const getHistory = async (request: FastifyRequest, reply: FastifyReply) => {
  const { channelId } = request.params as { channelId: string };
  const modern = await supabaseAdmin.from('chat_messages')
    .select('*')
    .eq('channel_id', channelId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(100);

  if (!modern.error) return reply.send({ success: true, data: (modern.data || []).map(normalizeMessage), error: null });
  const legacy = await supabaseAdmin.from('chat_messages')
    .select('*')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: true })
    .limit(100);
  if (legacy.error) throw new AppError(500, 'DB_ERROR', `Lỗi khi tải lịch sử chat: ${legacy.error.message}`);
  return reply.send({ success: true, data: (legacy.data || []).map(normalizeMessage), error: null });
};

export const sendMessage = async (request: FastifyRequest, reply: FastifyReply) => {
  const user = request.user!;
  const { channelId } = request.params as { channelId: string };
  const { content } = request.body as { content: string };
  const cleanContent = content?.trim();
  if (!cleanContent || cleanContent.length > 500) throw new AppError(400, 'VALIDATION_ERROR', 'Tin nhắn phải dài từ 1 đến 500 ký tự.');

  const { data: profile } = await supabaseAdmin.from('profiles').select('display_name, role').eq('id', user.id).single();
  const modern = await supabaseAdmin.from('chat_messages').insert({
    channel_id: channelId,
    user_id: user.id,
    content: cleanContent,
    user_display_name: profile?.display_name || 'Thành viên',
    user_role: profile?.role || 'USER'
  }).select().single();

  if (!modern.error && modern.data) return reply.send({ success: true, data: normalizeMessage(modern.data), error: null });

  const legacy = await supabaseAdmin.from('chat_messages').insert({ channel_id: channelId, user_id: user.id, message: cleanContent }).select().single();
  if (legacy.error || !legacy.data) throw new AppError(500, 'DB_ERROR', `Lỗi gửi tin nhắn: ${legacy.error?.message || 'Không nhận được bản ghi.'}`);
  return reply.send({ success: true, data: normalizeMessage(legacy.data), error: null });
};

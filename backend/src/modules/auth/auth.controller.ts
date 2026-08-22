import { FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin } from '../../infrastructure/supabase/client';
import { AppError } from '../../shared/errors/AppError';
import { buildUserAssetPath } from '../../shared/storage/storageNaming';
import { authService } from './auth.service';

export const login = async (request: FastifyRequest, reply: FastifyReply) => {
  const { username, password } = request.body as any;
  if (!username || !password) throw new AppError(400, 'VALIDATION_ERROR', 'Vui lòng nhập Username và Password.');
  const sessionData = await authService.login(username, password);
  return reply.send({ success: true, data: sessionData, error: null });
};

export const logout = async (_request: FastifyRequest, reply: FastifyReply) => {
  return reply.send({ success: true, data: { message: 'Đăng xuất thành công.' }, error: null });
};

export const getMe = async (request: FastifyRequest, reply: FastifyReply) => {
  const profile = await authService.getMe(request.user!.id);
  return reply.send({ success: true, data: profile, error: null });
};

export const updateProfile = async (request: FastifyRequest, reply: FastifyReply) => {
  const profile = await authService.updateProfile(request.user!.id, request.body as any);
  return reply.send({ success: true, data: profile, error: null });
};

export const uploadAvatar = async (request: FastifyRequest, reply: FastifyReply) => {
  const file = await request.file();
  if (!file) throw new AppError(400, 'FILE_REQUIRED', 'Vui lòng chọn một ảnh đại diện.');
  if (!file.mimetype.startsWith('image/')) throw new AppError(400, 'INVALID_FILE', 'Chỉ chấp nhận file hình ảnh.');

  const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('username, avatar_path').eq('id', request.user!.id).single();
  if (profileError || !profile) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Không tìm thấy hồ sơ.');

  const buffer = await file.toBuffer();
  const extension = (file.filename.split('.').pop() || file.mimetype.split('/')[1] || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = buildUserAssetPath(request.user!.id, String(profile.username || 'user'), extension, 'avatar');
  const { error: uploadError } = await supabaseAdmin.storage.from('avatars').upload(path, buffer, { contentType: file.mimetype, upsert: false, cacheControl: '3600' });
  if (uploadError) throw new AppError(500, 'UPLOAD_FAILED', `Không thể lưu avatar: ${uploadError.message}`);

  const publicUrl = supabaseAdmin.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  try {
    const updated = await authService.updateProfile(request.user!.id, { avatar_url: publicUrl, avatar_path: path });
    if (profile.avatar_path && profile.avatar_path !== path) await supabaseAdmin.storage.from('avatars').remove([profile.avatar_path]);
    return reply.send({ success: true, data: updated, error: null });
  } catch (error) {
    await supabaseAdmin.storage.from('avatars').remove([path]);
    throw error;
  }
};

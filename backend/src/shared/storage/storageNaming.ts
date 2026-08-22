import { randomUUID } from 'node:crypto';

export const buildUserAssetPath = (userId: string, username: string, extension: string, kind = 'avatar') => {
  const safeUsername = username.toLowerCase().replace(/[^a-z0-9_-]/g, '-') || 'user';
  const safeExtension = extension.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  return `${userId}/${kind}-${safeUsername}-${Date.now()}-${randomUUID().slice(0, 8)}.${safeExtension}`;
};

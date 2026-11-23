import { supabaseAdmin } from '../infrastructure/supabase/client';

async function seedAdmin() {
  const username = process.env.LUNU_ADMIN_USERNAME || 'admin';
  const password = process.env.LUNU_ADMIN_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error('Đặt LUNU_ADMIN_PASSWORD ít nhất 12 ký tự trước khi tạo tài khoản.');
  }
  const { error } = await supabaseAdmin.auth.admin.createUser({
    email: `${username}@gameverse.local`,
    password,
    email_confirm: true,
    user_metadata: { username, display_name: 'LuNu (Super Admin)' },
    app_metadata: { role: 'SUPER_ADMIN' },
  });
  if (error) throw error;
  console.log(`Đã tạo tài khoản quản trị ${username}.`);
}

seedAdmin().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});

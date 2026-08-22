import { supabaseAdmin } from '../infrastructure/supabase/client';
import dotenv from 'dotenv';

dotenv.config();

async function seedAdmin() {
  console.log('Đang khởi tạo tài khoản SUPER_ADMIN...');
  const username = 'admin';
  const password = '0907987126_LuNu';
  const internalEmail = `${username}@gameverse.local`;
  
  // 1. Lấy danh sách users để tìm admin cũ
  const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  
  if (listError) {
    console.error('Lỗi khi lấy danh sách User:', listError.message);
    return;
  }

  // 2. Tìm admin cũ bằng email và XÓA (để reset)
  const oldAdmin = usersData.users.find(u => u.email === internalEmail);
  if (oldAdmin) {
    console.log(`Tìm thấy tài khoản admin cũ (ID: ${oldAdmin.id}). Tiến hành xóa...`);
    await supabaseAdmin.auth.admin.deleteUser(oldAdmin.id);
    console.log('Đã xóa tài khoản admin cũ.');
  }

  // 3. Tạo lại Admin mới với mật khẩu mới
  console.log('Đang tạo SUPER_ADMIN mới...');
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: internalEmail,
    password: password,
    email_confirm: true,
    user_metadata: {
      username: username,
      display_name: 'LuNu (Super Admin)', // Đổi tên hiển thị cho oai luôn
      role: 'SUPER_ADMIN'
    }
  });

  if (error) {
    console.error('Lỗi khi tạo Admin:', error.message);
  } else {
    console.log('✅ Tạo SUPER_ADMIN thành công!');
    console.log(`Username: ${username}`);
    console.log(`Password: ${password}`);
    console.log('Bạn có thể dùng tài khoản này để đăng nhập vào Frontend ngay bây giờ.');
  }
}

seedAdmin();
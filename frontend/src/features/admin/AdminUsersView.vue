<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { apiClient } from '@/services/api/apiClient';

const users = ref<any[]>([]);
const loading = ref(false);
const creating = ref(false);
const newUser = ref({ username: '', password: '', display_name: '', role: 'USER' });

// Modal State
const showModal = ref(false);
const selectedUser = ref<any>(null);
const walletForm = ref({ amount: 0, action: 'GRANT', reason: '' });
const isProcessing = ref(false);

const fetchUsers = async () => {
  loading.value = true;
  try {
    const res: any = await apiClient.get('/admin/users');
    if (res.success) users.value = res.data;
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
};

const handleCreateUser = async () => {
  creating.value = true;
  try {
    const res: any = await apiClient.post('/admin/users', newUser.value);
    if (res.success) {
      alert('Tạo người chơi thành công!');
      newUser.value = { username: '', password: '', display_name: '', role: 'USER' };
      await fetchUsers();
    }
  } catch (err: any) {
    alert(err.message || 'Lỗi khi tạo user');
  } finally {
    creating.value = false;
  }
};

// Mở modal Nạp/Trừ tiền
const openWalletModal = (user: any) => {
  selectedUser.value = user;
  walletForm.value = { amount: 0, action: 'GRANT', reason: '' };
  showModal.value = true;
};

// Xử lý Giao dịch
const handleWalletAction = async () => {
  if (walletForm.value.amount <= 0 || !walletForm.value.reason) {
    alert('Vui lòng nhập số tiền hợp lệ và lý do.');
    return;
  }

  isProcessing.value = true;
  try {
    const res: any = await apiClient.post('/wallet/admin/modify', {
      target_user_id: selectedUser.value.id,
      amount: walletForm.value.amount,
      action: walletForm.value.action,
      reason: walletForm.value.reason
    });
    
    if (res.success) {
      alert('Giao dịch thành công!');
      showModal.value = false;
      await fetchUsers(); // Refresh lại số dư
    }
  } catch (err: any) {
    alert(err.message || 'Giao dịch thất bại');
  } finally {
    isProcessing.value = false;
  }
};

onMounted(() => fetchUsers());
</script>

<template>
  <div class="container-fluid py-4 px-4">
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h2 class="fw-bold" style="color: var(--gv-primary)"><i class="bi bi-shield-lock-fill me-2"></i>QUẢN TRỊ HỆ THỐNG</h2>
      <router-link to="/" class="btn btn-outline-light btn-sm"><i class="bi bi-house me-1"></i> Về Sảnh</router-link>
    </div>

    <div class="row g-4">
      <div class="col-md-3">
        <div class="glass-panel p-4">
          <h5 class="fw-bold mb-3"><i class="bi bi-person-plus-fill me-2"></i>Tạo Tài Khoản</h5>
          <form @submit.prevent="handleCreateUser">
            <div class="mb-3"><input v-model="newUser.username" type="text" class="form-control bg-dark text-light border-secondary" placeholder="Username" required></div>
            <div class="mb-3"><input v-model="newUser.password" type="password" class="form-control bg-dark text-light border-secondary" placeholder="Password" required></div>
            <div class="mb-3"><input v-model="newUser.display_name" type="text" class="form-control bg-dark text-light border-secondary" placeholder="Display Name" required></div>
            <div class="mb-3">
              <select v-model="newUser.role" class="form-select bg-dark text-light border-secondary">
                <option value="USER">USER</option>
                <option value="MODERATOR">MODERATOR</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
            <button type="submit" class="btn w-100 fw-bold text-white" style="background: var(--gv-primary);" :disabled="creating">
              {{ creating ? 'ĐANG TẠO...' : 'TẠO MỚI' }}
            </button>
          </form>
        </div>
      </div>

      <div class="col-md-9">
        <div class="glass-panel p-4 h-100">
          <h5 class="fw-bold mb-3"><i class="bi bi-people-fill me-2"></i>Danh Sách Tài Khoản</h5>
          <div v-if="loading" class="text-center py-4"><div class="spinner-border text-info" role="status"></div></div>
          
          <div v-else class="table-responsive">
            <table class="table table-dark table-hover align-middle">
              <thead>
                <tr class="text-muted">
                  <th>USERNAME</th>
                  <th>TÊN HIỂN THỊ</th>
                  <th>CẤP ĐỘ</th>
                  <th class="text-end">SỐ DƯ VÍ</th>
                  <th class="text-center">THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="user in users" :key="user.id">
                  <td class="fw-bold">@{{ user.username }}</td>
                  <td>{{ user.display_name }}</td>
                  <td><span class="badge bg-secondary">{{ user.role }}</span></td>
                  <td class="text-end text-success fw-bold">{{ user.wallets[0]?.balance.toLocaleString() }} <i class="bi bi-coin"></i></td>
                  <td class="text-center">
                    <button @click="openWalletModal(user)" class="btn btn-sm btn-outline-warning">
                      <i class="bi bi-wallet-fill"></i> Nạp/Rút
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Can Thiệp Ví -->
    <div v-if="showModal" class="gv-modal-overlay">
      <div class="gv-modal glass-panel p-4">
        <h4 class="mb-1 fw-bold text-warning">CAN THIỆP VÍ</h4>
        <p class="text-muted small mb-4">Mục tiêu: <span class="fw-bold text-light">@{{ selectedUser?.username }}</span></p>
        
        <form @submit.prevent="handleWalletAction">
          <div class="mb-3">
            <label class="form-label text-muted small fw-bold">HÀNH ĐỘNG</label>
            <select v-model="walletForm.action" class="form-select bg-dark text-light border-secondary">
              <option value="GRANT">CỘNG TIỀN (+)</option>
              <option value="DEDUCT">TRỪ TIỀN (-)</option>
            </select>
          </div>
          
          <div class="mb-3">
            <label class="form-label text-muted small fw-bold">SỐ TIỀN</label>
            <input v-model="walletForm.amount" type="number" min="1" class="form-control bg-dark text-light border-secondary fs-4 fw-bold text-warning" required>
          </div>
          
          <div class="mb-4">
            <label class="form-label text-muted small fw-bold">LÝ DO (Bắt buộc ghi log)</label>
            <input v-model="walletForm.reason" type="text" class="form-control bg-dark text-light border-secondary" placeholder="VD: Thưởng sự kiện, trừ tiền vi phạm..." required>
          </div>
          
          <div class="d-flex gap-2 justify-content-end">
            <button type="button" class="btn btn-secondary px-4" @click="showModal = false">Hủy</button>
            <button type="submit" class="btn btn-warning px-4 fw-bold" :disabled="isProcessing">
              {{ isProcessing ? 'ĐANG XỬ LÝ...' : 'XÁC NHẬN' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.glass-panel {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
}
.table-dark { --bs-table-bg: transparent; }

/* Modal CSS */
.gv-modal-overlay {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(0, 0, 0, 0.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}
.gv-modal {
  width: 100%; max-width: 450px;
  animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-30px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
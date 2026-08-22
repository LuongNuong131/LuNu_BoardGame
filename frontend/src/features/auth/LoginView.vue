<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';

const router = useRouter();
const authStore = useAuthStore();

const username = ref('');
const password = ref('');

const handleLogin = async () => {
  if (!username.value || !password.value) return;
  
  const success = await authStore.login(username.value, password.value);
  if (success) {
    router.push('/');
  }
};
</script>

<template>
  <div class="glass-panel text-center p-5 login-card">
    <div class="mb-4">
      <h1 class="display-5 fw-bold mb-1" style="color: var(--gv-primary)">GAMEVERSE</h1>
      <p class="text-muted small">Đăng nhập để vào sảnh</p>
    </div>

    <form @submit.prevent="handleLogin" class="text-start">
      <div class="mb-3">
        <label class="form-label text-muted small fw-bold">USERNAME</label>
        <div class="input-group">
          <span class="input-group-text bg-dark border-secondary text-muted">
            <i class="bi bi-person-fill"></i>
          </span>
          <input 
            v-model="username" 
            type="text" 
            class="form-control gv-input" 
            placeholder="Nhập tên đăng nhập" 
            required 
          />
        </div>
      </div>
      
      <div class="mb-4">
        <label class="form-label text-muted small fw-bold">PASSWORD</label>
        <div class="input-group">
          <span class="input-group-text bg-dark border-secondary text-muted">
            <i class="bi bi-shield-lock-fill"></i>
          </span>
          <input 
            v-model="password" 
            type="password" 
            class="form-control gv-input" 
            placeholder="Nhập mật khẩu" 
            required 
          />
        </div>
      </div>

      <div v-if="authStore.error" class="alert alert-danger bg-danger bg-opacity-10 border-danger text-danger py-2 px-3 small" role="alert">
        <i class="bi bi-exclamation-triangle-fill me-2"></i> {{ authStore.error }}
      </div>

      <button 
        type="submit" 
        class="btn w-100 gv-btn-primary fw-bold py-2 mt-2"
        :disabled="authStore.loading"
      >
        <span v-if="authStore.loading" class="spinner-border spinner-border-sm me-2" role="status"></span>
        <span v-else><i class="bi bi-box-arrow-in-right me-2"></i></span>
        {{ authStore.loading ? 'ĐANG KẾT NỐI...' : 'VÀO GAME' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.login-card {
  max-width: 420px;
  width: 90%;
  animation: floatIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.gv-input {
  background-color: rgba(0, 0, 0, 0.2);
  border-color: #334155;
  color: var(--gv-text-main);
}

.gv-input:focus {
  background-color: rgba(0, 0, 0, 0.4);
  border-color: var(--gv-primary);
  box-shadow: 0 0 0 0.25rem rgba(99, 102, 241, 0.25);
  color: white;
}

.input-group-text {
  border-color: #334155;
}

.gv-btn-primary {
  background: linear-gradient(135deg, var(--gv-primary) 0%, var(--gv-primary-hover) 100%);
  color: white;
  border: none;
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
  transition: all 0.3s ease;
}

.gv-btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
  color: white;
}

@keyframes floatIn {
  0% { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
}
</style>
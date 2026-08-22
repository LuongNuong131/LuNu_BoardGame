<script setup lang="ts">
import { useAuthStore } from '@/stores/auth.store';
import { useWalletStore } from '@/stores/wallet.store';
import { useRouter } from 'vue-router';
import { onMounted } from 'vue';

const authStore = useAuthStore();
const walletStore = useWalletStore();
const router = useRouter();

onMounted(() => {
  walletStore.fetchBalance();
});

const handleLogout = async () => {
  await authStore.logout();
  router.push('/login');
};
</script>

<template>
  <div class="glass-panel text-center p-5 home-card">
    <div class="mb-4">
      <img :src="authStore.profile?.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + authStore.profile?.username" 
           alt="Avatar" class="rounded-circle mb-3 border border-2 border-primary" width="90" height="90">
      <h2 class="fw-bold mb-1" style="color: var(--gv-text-main)">{{ authStore.profile?.display_name }}</h2>
      <p class="text-muted small mb-3">@{{ authStore.profile?.username }}</p>
      <div class="d-flex justify-content-center gap-2 mb-4">
        <span class="badge bg-secondary px-3 py-2"><i class="bi bi-shield-check me-1"></i>{{ authStore.profile?.role }}</span>
        <span class="badge px-3 py-2" style="background-color: var(--gv-primary)">Lv {{ authStore.profile?.level }}</span>
      </div>
      <div class="wallet-box p-3 mb-4 mx-auto rounded-3">
        <p class="text-muted small mb-1 fw-bold">SỐ DƯ HIỆN TẠI</p>
        <h2 class="fw-bold text-warning mb-0">{{ walletStore.balance.toLocaleString() }} <i class="bi bi-coin"></i></h2>
      </div>
    </div>
    
    <div class="d-flex flex-wrap justify-content-center gap-3">
      <!-- CẬP NHẬT: Sửa thành router-link trỏ vào /rooms -->
      <router-link to="/rooms" class="btn gv-btn-primary px-4 py-2">
        <i class="bi bi-controller me-2"></i> Vào Sảnh
      </router-link>
      <router-link to="/wallet-history" class="btn btn-outline-info px-4 py-2">
        <i class="bi bi-clock-history me-2"></i> Lịch sử ví
      </router-link>
      <router-link v-if="authStore.profile?.role === 'SUPER_ADMIN' || authStore.profile?.role === 'ADMIN'" to="/admin" class="btn btn-outline-warning px-4 py-2">
        <i class="bi bi-gear-fill me-2"></i> Quản trị
      </router-link>
      <button @click="handleLogout" class="btn btn-outline-danger px-4 py-2">
        <i class="bi bi-box-arrow-left me-2"></i>
      </button>
    </div>
  </div>
</template>

<style scoped>
.home-card { max-width: 500px; width: 95%; animation: floatIn 0.5s ease-out forwards; }
.wallet-box { background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.1); max-width: 250px; }
.gv-btn-primary { background: linear-gradient(135deg, var(--gv-primary) 0%, var(--gv-primary-hover) 100%); color: white; border: none; }
.gv-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4); color: white;}
@keyframes floatIn { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
</style>
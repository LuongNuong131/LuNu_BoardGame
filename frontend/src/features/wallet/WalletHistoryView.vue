<script setup lang="ts">
import { onMounted } from 'vue';
import { useWalletStore } from '@/stores/wallet.store';
import { formatDate } from '@/utils/formatters';

const walletStore = useWalletStore();

onMounted(() => {
  walletStore.fetchHistory();
});
</script>

<template>
  <div class="container py-5 max-w-800">
    <div class="glass-panel p-4">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h3 class="fw-bold mb-0 text-info"><i class="bi bi-clock-history me-2"></i>Lịch Sử Giao Dịch</h3>
        <router-link to="/" class="btn btn-outline-secondary btn-sm"><i class="bi bi-arrow-left me-1"></i> Quay lại</router-link>
      </div>

      <div v-if="walletStore.loading" class="text-center py-5">
        <div class="spinner-border text-info" role="status"></div>
      </div>

      <div v-else-if="walletStore.history.length === 0" class="text-center py-5 text-muted">
        <i class="bi bi-inbox fs-1 mb-2"></i>
        <p>Chưa có giao dịch nào.</p>
      </div>

      <div v-else class="table-responsive">
        <table class="table table-dark table-hover align-middle">
          <thead>
            <tr class="text-muted small">
              <th>THỜI GIAN</th>
              <th>LOẠI</th>
              <th>LÝ DO</th>
              <th class="text-end">SỐ TIỀN</th>
              <th class="text-end">SỐ DƯ CUỐI</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="tx in walletStore.history" :key="tx.id">
              <td class="small">{{ formatDate(tx.created_at) }}</td>
              <td><span class="badge bg-dark border border-secondary text-light">{{ tx.transaction_type }}</span></td>
              <td class="small text-muted">{{ tx.reason }}</td>
              <td class="text-end fw-bold" :class="tx.amount > 0 ? 'text-success' : 'text-danger'">
                {{ tx.amount > 0 ? '+' : ''}}{{ tx.amount.toLocaleString() }}
              </td>
              <td class="text-end text-warning">{{ tx.balance_after.toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.max-w-800 { max-width: 800px; }
.glass-panel {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
}
.table-dark {
  --bs-table-bg: transparent;
}
</style>
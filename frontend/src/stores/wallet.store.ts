import { defineStore } from 'pinia';
import { apiClient } from '@/services/api/apiClient';

export const useWalletStore = defineStore('wallet', {
  state: () => ({
    balance: 0,
    history: [] as any[],
    loading: false
  }),
  actions: {
    async fetchBalance() {
      try {
        const res: any = await apiClient.get('/wallet/balance');
        if (res.success) this.balance = res.data.balance;
      } catch (err) {
        console.error('Lỗi khi lấy số dư ví', err);
      }
    },
    async fetchHistory() {
      this.loading = true;
      try {
        const res: any = await apiClient.get('/wallet/history');
        if (res.success) this.history = res.data;
      } catch (err) {
        console.error('Lỗi khi lấy lịch sử', err);
      } finally {
        this.loading = false;
      }
    }
  }
});
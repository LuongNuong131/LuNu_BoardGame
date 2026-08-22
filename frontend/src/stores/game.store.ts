import { defineStore } from 'pinia';
import { apiClient } from '@/services/api/apiClient';

export const useGameStore = defineStore('game', {
  state: () => ({
    session: null as any,
    gameState: null as any,
    loading: false
  }),
  actions: {
    async fetchGameState(sessionId: string) {
      this.loading = true;
      try {
        const res: any = await apiClient.get(`/sessions/${sessionId}`);
        if (res.success) {
          this.session = res.data.session;
          this.gameState = res.data.state;
        }
      } catch (err) {
        console.error('Lỗi tải ván đấu:', err);
        throw err;
      } finally {
        this.loading = false;
      }
    },
    
    async playAction(sessionId: string, action: any) {
      try {
        const res: any = await apiClient.post(`/sessions/${sessionId}/action`, { action });
        if (res.success) {
          this.gameState = res.data.state; // Cập nhật ngay state mới
        }
      } catch (err: any) {
        alert(err.message || 'Nước đi không hợp lệ!');
      }
    }
  }
});
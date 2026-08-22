import { defineStore } from 'pinia';
import { apiClient } from '@/services/api/apiClient';

export const useRoomStore = defineStore('room', {
  state: () => ({
    rooms: [] as any[],
    currentRoom: null as any,
    loading: false
  }),
  actions: {
    async fetchRooms() {
      this.loading = true;
      try {
        const res: any = await apiClient.get('/rooms');
        if (res.success) this.rooms = res.data;
      } finally {
        this.loading = false;
      }
    },
    async createRoom(payload: any) {
      const res: any = await apiClient.post('/rooms', payload);
      if (res.success) return res.data.id;
      throw new Error('Lỗi tạo phòng');
    },
    async joinRoom(roomId: string) {
      await apiClient.post(`/rooms/${roomId}/join`);
    },
    async fetchRoomDetail(roomId: string) {
      const res: any = await apiClient.get(`/rooms/${roomId}`);
      if (res.success) this.currentRoom = res.data;
    }
  }
});
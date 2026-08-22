import { defineStore } from 'pinia';
import { apiClient } from '@/services/api/apiClient';

export const useRoomStore = defineStore('room', {
  state: () => ({
    rooms: [] as any[],
    currentRoom: null as any,
    loading: false,
    lastJoinMode: null as 'PLAYER' | 'SPECTATOR' | null,
    lastSeatIndex: null as number | null
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
      const res: any = await apiClient.post(`/rooms/${roomId}/join`);
      this.lastJoinMode = res.data?.mode || 'PLAYER';
      this.lastSeatIndex = res.data?.seatIndex ?? null;
      return res.data;
    },
    async leaveRoom(roomId: string) {
      const res: any = await apiClient.post(`/rooms/${roomId}/leave`);
      this.lastJoinMode = null;
      this.lastSeatIndex = null;
      return res.data;
    },
    async fetchRoomDetail(roomId: string) {
      const res: any = await apiClient.get(`/rooms/${roomId}`);
      if (res.success) this.currentRoom = res.data;
    }
  }
});

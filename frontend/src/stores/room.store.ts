import { defineStore } from 'pinia';
import { apiClient } from '@/services/api/apiClient';
import { prepareRealtimeAuth, supabase } from '@/services/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

let lobbyChannel: RealtimeChannel | null = null;
let lobbyRefreshTimer: ReturnType<typeof setTimeout> | undefined;
let lobbyReconnectTimer: ReturnType<typeof setTimeout> | undefined;
let lobbyStarting = false;

export const useRoomStore = defineStore('room', {
  state: () => ({
    rooms: [] as any[],
    currentRoom: null as any,
    loading: false,
    lastJoinMode: null as 'PLAYER' | 'SPECTATOR' | null,
    lastSeatIndex: null as number | null,
    realtimeStatus: 'DISCONNECTED' as string
  }),
  actions: {
    async fetchRooms() {
      this.loading = true;
      try {
        const res: any = await apiClient.get('/rooms');
        if (res.success) this.rooms = res.data || [];
      } finally {
        this.loading = false;
      }
    },

    scheduleLobbyRefresh() {
      if (lobbyRefreshTimer) clearTimeout(lobbyRefreshTimer);
      lobbyRefreshTimer = setTimeout(() => this.fetchRooms().catch(() => undefined), 120);
    },

    async subscribeToLobby() {
      if (lobbyChannel || lobbyStarting) return;
      lobbyStarting = true;
      await prepareRealtimeAuth();
      this.realtimeStatus = 'CONNECTING';
      lobbyChannel = supabase.channel('lobby_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'game_rooms' }, () => this.scheduleLobbyRefresh())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'game_room_players' }, () => this.scheduleLobbyRefresh())
        .subscribe((status) => {
          this.realtimeStatus = status;
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            this.realtimeStatus = 'RECONNECTING';
            if (lobbyReconnectTimer) clearTimeout(lobbyReconnectTimer);
            lobbyReconnectTimer = setTimeout(() => {
              lobbyChannel = null;
              this.subscribeToLobby();
            }, 1800);
          }
        });
      lobbyStarting = false;
    },

    unsubscribeFromLobby() {
      lobbyStarting = false;
      if (lobbyChannel) supabase.removeChannel(lobbyChannel);
      lobbyChannel = null;
      if (lobbyRefreshTimer) clearTimeout(lobbyRefreshTimer);
      if (lobbyReconnectTimer) clearTimeout(lobbyReconnectTimer);
      this.realtimeStatus = 'DISCONNECTED';
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

    async deleteRoom(roomId: string) {
      const res: any = await apiClient.delete(`/rooms/${roomId}`);
      if (!res.success) throw new Error('Không thể xóa phòng.');
      this.rooms = this.rooms.filter((room: any) => room.id !== roomId);
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

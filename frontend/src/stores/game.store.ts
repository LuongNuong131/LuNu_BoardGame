import { defineStore } from 'pinia';
import { apiClient } from '@/services/api/apiClient';
import { supabase } from '@/services/supabase/client';

export const useGameStore = defineStore('game', {
  state: () => ({
    session: null as any,
    gameState: null as any,
    participants: [] as any[],
    isPlayer: false,
    loading: false,
    realtimeStatus: 'DISCONNECTED' as string,
    activeSessionId: null as string | null,
    channel: null as any,
    refreshTimer: undefined as ReturnType<typeof setTimeout> | undefined,
    reconnectTimer: undefined as ReturnType<typeof setTimeout> | undefined
  }),
  actions: {
    async fetchGameState(sessionId: string) {
      this.loading = true;
      try {
        const res: any = await apiClient.get(`/sessions/${sessionId}`);
        if (res.success) {
          this.session = res.data.session;
          this.gameState = res.data.state;
          this.participants = res.data.participants || [];
          this.isPlayer = Boolean(res.data.isPlayer);
        }
      } finally {
        this.loading = false;
      }
    },

    scheduleRefresh(sessionId: string) {
      if (this.refreshTimer) clearTimeout(this.refreshTimer);
      this.refreshTimer = setTimeout(() => this.fetchGameState(sessionId).catch(() => undefined), 100);
    },

    subscribeToSession(sessionId: string) {
      this.activeSessionId = sessionId;
      if (this.channel) supabase.removeChannel(this.channel as any);
      this.realtimeStatus = 'CONNECTING';
      this.channel = supabase.channel(`game_session_realtime_${sessionId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_sessions', filter: `id=eq.${sessionId}` }, () => this.scheduleRefresh(sessionId))
        .subscribe((status) => {
          this.realtimeStatus = status;
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            this.realtimeStatus = 'RECONNECTING';
            if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => this.subscribeToSession(sessionId), 1800);
          }
        });
    },

    unsubscribeFromSession() {
      if (this.channel) supabase.removeChannel(this.channel as any);
      if (this.refreshTimer) clearTimeout(this.refreshTimer);
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.channel = null;
      this.activeSessionId = null;
      this.realtimeStatus = 'DISCONNECTED';
    },

    async playAction(sessionId: string, action: any) {
      const res: any = await apiClient.post(`/sessions/${sessionId}/action`, { action });
      if (res.success) {
        this.gameState = res.data.state;
        this.scheduleRefresh(sessionId);
      }
      return res;
    }
  }
});

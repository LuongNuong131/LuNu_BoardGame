import { defineStore } from 'pinia';
import { markRaw, toRaw } from 'vue';
import { apiClient } from '@/services/api/apiClient';
import { supabase } from '@/services/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export const useGameStore = defineStore('game', {
  state: () => ({
    session: null as any,
    gameState: null as any,
    participants: [] as any[],
    isPlayer: false,
    loading: false,
    realtimeStatus: 'DISCONNECTED',
    activeSessionId: null as string | null,
    channel: null as RealtimeChannel | null,
    refreshTimer: undefined as ReturnType<typeof setTimeout> | undefined,
    sessionPollTimer: undefined as ReturnType<typeof setInterval> | undefined,
    epoch: 0,
  }),
  actions: {
    async fetchGameState(sessionId: string) {
      const epoch = this.epoch;
      this.loading = true;
      try {
        const res: any = await apiClient.get(`/sessions/${sessionId}`);
        if (!res.success || this.epoch !== epoch || this.activeSessionId !== sessionId) return;
        if ((res.data.state?.revision ?? 0) < (this.gameState?.revision ?? 0)) return;
        this.session = res.data.session;
        this.gameState = res.data.state;
        this.participants = res.data.participants || [];
        this.isPlayer = Boolean(res.data.isPlayer);
        if (this.session.status !== 'PLAYING' && this.sessionPollTimer) clearInterval(this.sessionPollTimer);
      } finally {
        if (epoch === this.epoch) this.loading = false;
      }
    },

    scheduleRefresh(sessionId: string) {
      if (this.activeSessionId !== sessionId) return;
      if (this.refreshTimer) clearTimeout(this.refreshTimer);
      this.refreshTimer = setTimeout(() => this.fetchGameState(sessionId).catch(() => undefined), 100);
    },

    subscribeToSession(sessionId: string) {
      this.unsubscribeFromSession();
      this.activeSessionId = sessionId;
      this.realtimeStatus = 'CONNECTING';
      const epoch = this.epoch;
      this.sessionPollTimer = setInterval(() => {
        if (!this.loading) this.fetchGameState(sessionId).catch(() => undefined);
      }, 2500);
      this.channel = markRaw(supabase.channel(`game_session_realtime_${sessionId}_${epoch}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_session_signals', filter: `id=eq.${sessionId}` }, () => this.scheduleRefresh(sessionId))
        .subscribe((status) => {
          if (epoch === this.epoch) this.realtimeStatus = status;
        }));
    },

    unsubscribeFromSession() {
      this.epoch++;
      if (this.channel) void supabase.removeChannel(toRaw(this.channel) as RealtimeChannel);
      if (this.refreshTimer) clearTimeout(this.refreshTimer);
      if (this.sessionPollTimer) clearInterval(this.sessionPollTimer);
      this.channel = null;
      this.activeSessionId = null;
      this.session = null;
      this.gameState = null;
      this.participants = [];
      this.isPlayer = false;
      this.loading = false;
      this.realtimeStatus = 'DISCONNECTED';
    },

    async playAction(sessionId: string, action: any) {
      const epoch = this.epoch;
      try {
        const res: any = await apiClient.post(`/sessions/${sessionId}/action`, { action, revision: this.gameState?.revision ?? 0 });
        if (res.success && epoch === this.epoch && sessionId === this.activeSessionId &&
            (res.data.state?.revision ?? 0) >= (this.gameState?.revision ?? 0)) this.gameState = res.data.state;
        return res;
      } finally {
        if (epoch === this.epoch) this.scheduleRefresh(sessionId);
      }
    },
  },
});

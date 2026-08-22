import { defineStore } from 'pinia';
import { apiClient } from '@/services/api/apiClient';
import { supabase } from '@/services/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export const useChatStore = defineStore('chat', {
  state: () => ({
    messages: {} as Record<string, any[]>,
    channels: {} as Record<string, RealtimeChannel>,
    statuses: {} as Record<string, string>,
    reconnectTimers: {} as Record<string, ReturnType<typeof setTimeout>>
  }),
  actions: {
    async fetchHistory(channelId: string) {
      if (!this.messages[channelId]) this.messages[channelId] = [];
      const res: any = await apiClient.get(`/chat/${channelId}/history`);
      if (res.success) {
        const merged = [...(res.data || []), ...(this.messages[channelId] || [])];
        this.messages[channelId] = [...new Map(merged.filter((item) => item?.id).map((item) => [item.id, item])).values()].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
    },

    async sendMessage(channelId: string, content: string) {
      if (!content.trim()) return;
      const res: any = await apiClient.post(`/chat/${channelId}/messages`, { content: content.trim() });
      if (res.success && res.data) {
        // Optimistic insert is safe because the Realtime handler de-duplicates by id.
        this.appendMessage(channelId, res.data);
      }
    },

    appendMessage(channelId: string, message: any) {
      if (!this.messages[channelId]) this.messages[channelId] = [];
      if (!message?.id || this.messages[channelId].some((item) => item.id === message.id)) return;
      this.messages[channelId].push(message);
    },

    subscribeToChannel(channelId: string) {
      if (this.channels[channelId]) return;
      this.statuses[channelId] = 'CONNECTING';
      const channel = supabase.channel(`chat_realtime_${channelId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${channelId}` }, (payload) => this.appendMessage(channelId, payload.new))
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${channelId}` }, (payload) => {
          this.messages[channelId] = (this.messages[channelId] || []).filter((item) => item.id !== payload.old.id);
        })
        .subscribe((status) => {
          this.statuses[channelId] = status;
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            this.statuses[channelId] = 'RECONNECTING';
            if (this.reconnectTimers[channelId]) clearTimeout(this.reconnectTimers[channelId]);
            this.reconnectTimers[channelId] = setTimeout(() => {
              delete this.channels[channelId];
              this.subscribeToChannel(channelId);
            }, 1800);
          }
        });
      this.channels[channelId] = channel;
    },

    unsubscribeFromChannel(channelId: string) {
      if (this.channels[channelId]) supabase.removeChannel(this.channels[channelId]);
      if (this.reconnectTimers[channelId]) clearTimeout(this.reconnectTimers[channelId]);
      delete this.channels[channelId];
      delete this.statuses[channelId];
      delete this.reconnectTimers[channelId];
    }
  }
});

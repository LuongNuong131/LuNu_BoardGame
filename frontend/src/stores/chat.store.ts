import { defineStore } from 'pinia';
import { apiClient } from '@/services/api/apiClient';
import { supabase } from '@/services/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export const useChatStore = defineStore('chat', {
  state: () => ({
    messages: {} as Record<string, any[]>, // Key là channelId, value là mảng tin nhắn
    channels: {} as Record<string, RealtimeChannel>
  }),
  
  actions: {
    async fetchHistory(channelId: string) {
      if (!this.messages[channelId]) this.messages[channelId] = [];
      try {
        const res: any = await apiClient.get(`/chat/${channelId}/history`);
        if (res.success) {
          this.messages[channelId] = res.data;
        }
      } catch (err) {
        console.error('Lỗi tải lịch sử chat:', err);
      }
    },

    async sendMessage(channelId: string, content: string) {
      try {
        await apiClient.post(`/chat/${channelId}/messages`, { content });
        // Không push vào mảng messages ở đây, vì Realtime sẽ tự bắt sự kiện INSERT và push vào
      } catch (err) {
        console.error('Lỗi gửi tin nhắn:', err);
      }
    },

    subscribeToChannel(channelId: string) {
      if (this.channels[channelId]) return; // Đã sub rồi thì thôi

      const channel = supabase.channel(`chat_${channelId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${channelId}` },
          (payload) => {
            if (!this.messages[channelId]) this.messages[channelId] = [];
            this.messages[channelId].push(payload.new);
          }
        )
        .subscribe();

      this.channels[channelId] = channel;
    },

    unsubscribeFromChannel(channelId: string) {
      if (this.channels[channelId]) {
        supabase.removeChannel(this.channels[channelId]);
        delete this.channels[channelId];
      }
    }
  }
});
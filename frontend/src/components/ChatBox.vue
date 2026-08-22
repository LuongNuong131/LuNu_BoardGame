<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useChatStore } from '@/stores/chat.store';
import { useAuthStore } from '@/stores/auth.store';
import { formatDate } from '@/utils/formatters';

const props = defineProps<{
  channelId: string;
  title: string;
}>();

const chatStore = useChatStore();
const authStore = useAuthStore();

const newMessage = ref('');
const chatScrollRef = ref<HTMLElement | null>(null);

const scrollToBottom = () => {
  nextTick(() => {
    if (chatScrollRef.value) {
      chatScrollRef.value.scrollTop = chatScrollRef.value.scrollHeight;
    }
  });
};

onMounted(async () => {
  await chatStore.fetchHistory(props.channelId);
  chatStore.subscribeToChannel(props.channelId);
  scrollToBottom();
});

onUnmounted(() => {
  chatStore.unsubscribeFromChannel(props.channelId);
});

// Lắng nghe sự thay đổi của tin nhắn để auto cuộn xuống
watch(() => chatStore.messages[props.channelId], () => {
  scrollToBottom();
}, { deep: true });

const handleSend = async () => {
  if (!newMessage.value.trim()) return;
  const content = newMessage.value;
  newMessage.value = ''; // Xóa input ngay lập tức cho mượt
  await chatStore.sendMessage(props.channelId, content);
};

const getRoleBadge = (role: string) => {
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return 'bg-danger';
  if (role === 'MODERATOR') return 'bg-info text-dark';
  return 'bg-secondary';
};
</script>

<template>
  <div class="chat-container d-flex flex-column h-100">
    <div class="chat-header p-2 border-bottom border-secondary bg-dark text-light fw-bold text-center">
      <i class="bi bi-chat-dots-fill me-2 text-info"></i>{{ title }}
    </div>
    
    <div class="chat-messages p-3 flex-grow-1 overflow-auto" ref="chatScrollRef">
      <div v-for="msg in chatStore.messages[props.channelId]" :key="msg.id" class="mb-3">
        
        <!-- Tin nhắn của mình -->
        <div v-if="msg.user_id === authStore.profile?.id" class="d-flex flex-column align-items-end">
          <div class="d-flex align-items-baseline mb-1">
            <small class="text-muted me-2" style="font-size: 0.65rem;">{{ formatDate(msg.created_at) }}</small>
            <span class="fw-bold text-primary">{{ msg.user_display_name }}</span>
          </div>
          <div class="chat-bubble my-msg">{{ msg.content }}</div>
        </div>

        <!-- Tin nhắn người khác -->
        <div v-else class="d-flex flex-column align-items-start">
          <div class="d-flex align-items-baseline mb-1">
            <span class="fw-bold text-light me-2">{{ msg.user_display_name }}</span>
            <span class="badge me-2" style="font-size: 0.6rem;" :class="getRoleBadge(msg.user_role)" v-if="msg.user_role !== 'USER'">
              {{ msg.user_role }}
            </span>
            <small class="text-muted" style="font-size: 0.65rem;">{{ formatDate(msg.created_at) }}</small>
          </div>
          <div class="chat-bubble other-msg">{{ msg.content }}</div>
        </div>

      </div>
    </div>

    <div class="chat-input p-2 border-top border-secondary bg-dark">
      <form @submit.prevent="handleSend" class="d-flex gap-2">
        <input v-model="newMessage" type="text" class="form-control bg-black text-light border-secondary" placeholder="Nhập tin nhắn..." maxlength="200">
        <button type="submit" class="btn btn-primary" :disabled="!newMessage.trim()">
          <i class="bi bi-send-fill"></i>
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.chat-container {
  background: rgba(15, 20, 25, 0.7);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--glass-border);
}

.chat-messages {
  max-height: 400px;
}

.chat-messages::-webkit-scrollbar { width: 4px; }
.chat-messages::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }

.chat-bubble {
  max-width: 85%;
  padding: 8px 12px;
  border-radius: 16px;
  font-size: 0.9rem;
  word-wrap: break-word;
}

.my-msg {
  background-color: var(--gv-primary);
  color: white;
  border-bottom-right-radius: 4px;
}

.other-msg {
  background-color: #334155;
  color: #f8fafc;
  border-bottom-left-radius: 4px;
}
</style>
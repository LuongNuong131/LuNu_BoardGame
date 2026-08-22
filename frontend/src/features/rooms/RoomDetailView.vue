<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useRoomStore } from '@/stores/room.store';
import { useAuthStore } from '@/stores/auth.store';
import { apiClient } from '@/services/api/apiClient';
import { supabase } from '@/services/supabase/client';
import ChatBox from '@/components/ChatBox.vue';

const route = useRoute();
const router = useRouter();
const roomStore = useRoomStore();
const authStore = useAuthStore();
const isStarting = ref(false);
let roomSubscription: any;

onMounted(async () => {
  const roomId = route.params.id as string;
  try {
    await roomStore.fetchRoomDetail(roomId);
    
    // Đăng ký Realtime để nghe ngóng trạng thái phòng thay đổi (khi Game bắt đầu)
    roomSubscription = supabase.channel(`room_${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomId}` }, async (payload) => {
        if (payload.new.status === 'RUNNING') {
          // Lấy sessionId hiện tại (vì lúc này phòng đã tạo session)
          const { data } = await supabase.from('game_sessions').select('id').eq('room_id', roomId).eq('status', 'PLAYING').single();
          if (data) router.push(`/game/${data.id}`);
        }
      })
      .subscribe();

  } catch (err) {
    alert('Không thể vào phòng!');
    router.push('/rooms');
  }
});

onUnmounted(() => {
  if (roomSubscription) supabase.removeChannel(roomSubscription);
});

const handleStartGame = async () => {
  isStarting.value = true;
  try {
    const res: any = await apiClient.post(`/sessions/room/${roomStore.currentRoom.id}/start`);
    if (res.success) {
      router.push(`/game/${res.data.sessionId}`);
    }
  } catch (err: any) {
    alert(err.message || 'Lỗi khởi tạo trận đấu');
  } finally {
    isStarting.value = false;
  }
};
</script>

<template>
  <div class="container-fluid py-4" v-if="roomStore.currentRoom">
    <div class="row g-4 max-w-1200 mx-auto">
      <div class="col-lg-8">
        <div class="glass-panel p-4 mb-4 text-center">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <router-link to="/rooms" class="btn btn-sm btn-outline-secondary"><i class="bi bi-arrow-left"></i> Thoát</router-link>
            <span class="badge bg-primary fs-6">{{ roomStore.currentRoom.game_id }}</span>
            <div style="width: 70px;"></div>
          </div>
          <h2 class="fw-bold text-white mb-0">{{ roomStore.currentRoom.name }}</h2>
        </div>

        <div class="glass-panel p-4 h-100">
          <h5 class="fw-bold mb-4 text-info"><i class="bi bi-people-fill me-2"></i>NGƯỜI CHƠI ({{ roomStore.currentRoom.players.length }}/{{ roomStore.currentRoom.max_players }})</h5>
          
          <div class="row g-3">
            <div v-for="p in roomStore.currentRoom.players" :key="p.user.id" class="col-md-6 col-xl-4">
              <div class="p-3 border rounded-3 position-relative" :class="p.user.id === roomStore.currentRoom.owner_id ? 'border-warning bg-warning bg-opacity-10' : 'border-secondary bg-dark'">
                <div v-if="p.user.id === roomStore.currentRoom.owner_id" class="position-absolute top-0 start-50 translate-middle badge bg-warning text-dark"><i class="bi bi-star-fill"></i> CHỦ PHÒNG</div>
                <div class="text-center mt-2">
                  <img :src="p.user.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + p.user.username" width="60" height="60" class="rounded-circle mb-2 bg-secondary">
                  <h6 class="fw-bold mb-0 truncate" :class="p.user.id === authStore.profile?.id ? 'text-primary' : 'text-light'">{{ p.user.display_name }}</h6>
                  <small class="text-muted">Lv {{ p.user.level }}</small>
                </div>
              </div>
            </div>
          </div>
          
          <div class="mt-5 text-center">
            <button v-if="authStore.profile?.id === roomStore.currentRoom.owner_id" 
                    @click="handleStartGame"
                    class="btn btn-lg fw-bold px-5 py-3 text-white" 
                    style="background: var(--gv-primary)"
                    :disabled="isStarting || roomStore.currentRoom.players.length < 2">
              <span v-if="isStarting" class="spinner-border spinner-border-sm me-2"></span>
              <i v-else class="bi bi-play-fill fs-4 me-1"></i> 
              {{ roomStore.currentRoom.players.length < 2 ? 'ĐỢI THÊM NGƯỜI...' : 'BẮT ĐẦU GAME' }}
            </button>
            <div v-else class="alert alert-info d-inline-block px-5 py-3 fw-bold">
              <i class="bi bi-hourglass-split me-2"></i> ĐANG CHỜ CHỦ PHÒNG BẮT ĐẦU...
            </div>
          </div>
        </div>
      </div>

      <div class="col-lg-4" style="height: calc(100vh - 100px);">
        <ChatBox :channelId="`ROOM_${roomStore.currentRoom.id}`" title="KÊNH PHÒNG CHỜ" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.max-w-1200 { max-width: 1200px; }
.glass-panel { background: var(--glass-bg); backdrop-filter: var(--glass-blur); border: 1px solid var(--glass-border); border-radius: 12px; }
.truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
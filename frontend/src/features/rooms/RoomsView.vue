<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useRoomStore } from '@/stores/room.store';
import ChatBox from '@/components/ChatBox.vue';

const router = useRouter();
const roomStore = useRoomStore();
const showCreateModal = ref(false);
const createForm = ref({ game_id: 'UNO', name: 'Phòng của LuNu', max_players: 4, entry_fee: 0 });

onMounted(() => roomStore.fetchRooms());

const handleCreate = async () => {
  try {
    const roomId = await roomStore.createRoom(createForm.value);
    router.push(`/room/${roomId}`);
  } catch (err: any) { alert(err.message || 'Lỗi tạo phòng'); }
};

const handleJoin = async (roomId: string) => {
  try {
    await roomStore.joinRoom(roomId);
    router.push(`/room/${roomId}`);
  } catch (err: any) { alert(err.message || 'Phòng đầy hoặc lỗi.'); }
};
</script>

<template>
  <div class="container-fluid py-4 px-lg-5">
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h2 class="fw-bold" style="color: var(--gv-primary)"><i class="bi bi-controller me-2"></i>SẢNH TRUNG TÂM</h2>
      <div>
        <button @click="roomStore.fetchRooms()" class="btn btn-outline-info me-2"><i class="bi bi-arrow-clockwise"></i> Cập nhật</button>
        <button @click="showCreateModal = true" class="btn text-white fw-bold" style="background: var(--gv-primary)"><i class="bi bi-plus-lg me-1"></i> TẠO PHÒNG</button>
        <router-link to="/" class="btn btn-outline-light ms-2"><i class="bi bi-house"></i> Về Home</router-link>
      </div>
    </div>

    <div class="row g-4">
      <!-- Cột trái: Danh sách phòng -->
      <div class="col-lg-8">
        <div class="row g-3">
          <div v-if="roomStore.loading" class="col-12 text-center py-5"><div class="spinner-border text-info"></div></div>
          <div v-else-if="roomStore.rooms.length === 0" class="col-12 text-center py-5 text-muted">
            <i class="bi bi-hdd-network fs-1 mb-3"></i><h4>Chưa có phòng nào</h4>
          </div>
          
          <div v-for="room in roomStore.rooms" :key="room.id" class="col-md-6">
            <div class="glass-panel p-3 room-card transition">
              <div class="d-flex justify-content-between mb-2">
                <span class="badge bg-dark border border-secondary">{{ room.game_id === 'UNO' ? 'BÀI UNO' : 'MA SÓI' }}</span>
                <span class="badge bg-success" v-if="room.entry_fee === 0">MIỄN PHÍ</span>
                <span class="badge bg-warning text-dark" v-else>{{ room.entry_fee }} <i class="bi bi-coin"></i></span>
              </div>
              <h5 class="fw-bold mb-1 text-light truncate">{{ room.name }}</h5>
              
              <!-- Áp dụng Optional Chaining bảo vệ chống null -->
              <p class="text-muted small mb-3">Chủ phòng: @{{ room.owner?.display_name || 'Người chơi ẩn danh' }}</p>
              
              <div class="d-flex justify-content-between align-items-center">
                <div class="text-info small fw-bold"><i class="bi bi-people-fill me-1"></i> {{ room.players?.[0]?.count || 0 }} / {{ room.max_players }}</div>
                <button @click="handleJoin(room.id)" class="btn btn-sm btn-outline-primary fw-bold" :disabled="(room.players?.[0]?.count || 0) >= room.max_players">
                  {{ (room.players?.[0]?.count || 0) >= room.max_players ? 'ĐÃ ĐẦY' : 'THAM GIA' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Cột phải: WORLD CHAT -->
      <div class="col-lg-4" style="height: calc(100vh - 150px);">
        <ChatBox channelId="WORLD" title="KÊNH THẾ GIỚI" />
      </div>
    </div>

    <!-- Modal Tạo phòng -->
    <div v-if="showCreateModal" class="gv-modal-overlay">
      <div class="gv-modal glass-panel p-4">
        <h4 class="mb-4 fw-bold text-white"><i class="bi bi-plus-square-fill me-2 text-primary"></i>THIẾT LẬP PHÒNG CHƠI</h4>
        <form @submit.prevent="handleCreate">
          <div class="mb-3">
            <label class="form-label text-muted small fw-bold">CHỌN GAME</label>
            <select v-model="createForm.game_id" class="form-select bg-dark text-light border-secondary">
              <option value="UNO">Bài UNO</option>
              <option value="WEREWOLF">Ma Sói (Sắp ra mắt)</option>
            </select>
          </div>
          <div class="mb-3">
            <label class="form-label text-muted small fw-bold">TÊN PHÒNG</label>
            <input v-model="createForm.name" type="text" class="form-control bg-dark text-light border-secondary" required>
          </div>
          <div class="row">
            <div class="col-6 mb-3">
              <label class="form-label text-muted small fw-bold">SỐ NGƯỜI TỐI ĐA</label>
              <input v-model="createForm.max_players" type="number" min="2" max="15" class="form-control bg-dark text-light border-secondary" required>
            </div>
            <div class="col-6 mb-4">
              <label class="form-label text-muted small fw-bold">PHÍ VÀO PHÒNG</label>
              <input v-model="createForm.entry_fee" type="number" min="0" class="form-control bg-dark text-light border-secondary text-warning fw-bold">
            </div>
          </div>
          <div class="d-flex gap-2 justify-content-end">
            <button type="button" class="btn btn-secondary px-4" @click="showCreateModal = false">Hủy</button>
            <button type="submit" class="btn px-4 fw-bold text-white" style="background: var(--gv-primary)">TẠO PHÒNG</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.glass-panel { background: var(--glass-bg); backdrop-filter: var(--glass-blur); border: 1px solid var(--glass-border); border-radius: 12px; }
.room-card:hover { transform: translateY(-5px); border-color: var(--gv-primary); box-shadow: 0 8px 20px rgba(99, 102, 241, 0.2); }
.truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gv-modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(4px); }
.gv-modal { width: 100%; max-width: 500px; animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes slideDown { from { opacity: 0; transform: translateY(-30px); } to { opacity: 1; transform: translateY(0); } }
</style>
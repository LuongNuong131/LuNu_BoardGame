<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGameStore } from '@/stores/game.store';
import { useAuthStore } from '@/stores/auth.store';
import { useUiStore } from '@/stores/ui.store';
import ChatBox from '@/components/ChatBox.vue';

const route = useRoute();
const router = useRouter();
const gameStore = useGameStore();
const authStore = useAuthStore();
const uiStore = useUiStore();
let refreshInterval: any;

const showColorPicker = ref(false);
const pendingWildCardId = ref<string | null>(null);

onMounted(async () => {
  await fetchState();
  // MVP: Polling tạm mỗi 2 giây để cập nhật state. (Tương lai sẽ dùng Realtime channel)
  refreshInterval = setInterval(fetchState, 2000);
});

onUnmounted(() => {
  clearInterval(refreshInterval);
});

const fetchState = async () => {
  try {
    await gameStore.fetchGameState(route.params.sessionId as string);
    if (gameStore.gameState.winner) {
      uiStore.success(`Trận đấu kết thúc! Người thắng: ${gameStore.gameState.winner === authStore.profile?.id ? 'BẠN' : 'ĐỐI THỦ'}`, 'Kết thúc ván đấu');
      clearInterval(refreshInterval);
      router.push('/rooms');
    }
  } catch {
    router.push('/rooms');
  }
};

const topCard = computed(() => {
  const pile = gameStore.gameState?.discardPile;
  return pile && pile.length > 0 ? pile[pile.length - 1] : null;
});

const isMyTurn = computed(() => {
  const state = gameStore.gameState;
  return state && state.players[state.currentTurnIndex] === authStore.profile?.id;
});

const handleDraw = async () => {
  if (!isMyTurn.value) return;
  await gameStore.playAction(route.params.sessionId as string, { type: 'DRAW_CARD', payload: {} });
  fetchState();
};

const handlePlayCard = async (card: any) => {
  if (!isMyTurn.value) return;
  if (card.color === 'WILD') {
    pendingWildCardId.value = card.id;
    showColorPicker.value = true;
    return;
  }
  
  await gameStore.playAction(route.params.sessionId as string, { 
    type: 'PLAY_CARD', 
    payload: { cardId: card.id } 
  });
  fetchState();
};

const handlePickColor = async (color: string) => {
  showColorPicker.value = false;
  await gameStore.playAction(route.params.sessionId as string, { 
    type: 'PLAY_CARD', 
    payload: { cardId: pendingWildCardId.value, chosenColor: color } 
  });
  pendingWildCardId.value = null;
  fetchState();
};

const getCardClass = (color: string) => {
  const map: any = { RED: 'uno-red', GREEN: 'uno-green', BLUE: 'uno-blue', YELLOW: 'uno-yellow', WILD: 'uno-wild' };
  return map[color] || 'uno-wild';
};
</script>

<template>
  <div class="container-fluid py-4 h-100 d-flex flex-column" v-if="gameStore.gameState">
    <div class="row flex-grow-1 g-4 max-w-1400 mx-auto w-100">
      
      <!-- Bàn chơi chính -->
      <div class="col-lg-8 d-flex flex-column">
        <div class="glass-panel flex-grow-1 p-4 d-flex flex-column position-relative">
          
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h4 class="fw-bold text-white mb-0">BÀN CHƠI UNO</h4>
            <div class="badge px-3 py-2" :class="isMyTurn ? 'bg-success' : 'bg-secondary'">
              {{ isMyTurn ? 'TỚI LƯỢT CỦA BẠN' : 'ĐANG CHỜ ĐỐI THỦ...' }}
            </div>
            <router-link to="/rooms" class="btn btn-sm btn-outline-danger"><i class="bi bi-box-arrow-right"></i> Thoát</router-link>
          </div>

          <!-- Khu vực Đối thủ -->
          <div class="opponents-area d-flex justify-content-center gap-4 mb-auto pt-3">
            <div v-for="(count, playerId) in gameStore.gameState.playerCardCounts" :key="playerId" 
                 class="opponent-card p-3 rounded text-center"
                 v-show="playerId !== authStore.profile?.id"
                 :class="{ 'active-turn': gameStore.gameState.players[gameStore.gameState.currentTurnIndex] === playerId }">
              <i class="bi bi-person-circle fs-2"></i>
              <div class="fw-bold text-light mt-1">Đối thủ</div>
              <div class="badge bg-warning text-dark mt-2">{{ count }} lá</div>
            </div>
          </div>

          <!-- Nọc bài & Bài đã đánh -->
          <div class="center-table d-flex justify-content-center align-items-center gap-5 my-5">
            <!-- Nọc bài -->
            <div class="deck text-center cursor-pointer" @click="handleDraw">
              <div class="uno-card uno-back">UNO</div>
              <span class="badge bg-dark mt-2">{{ gameStore.gameState.deckCount }} lá</span>
            </div>

            <!-- Lá bài hiện tại -->
            <div class="discard-pile text-center position-relative">
              <div v-if="topCard" class="uno-card shadow-lg" :class="getCardClass(gameStore.gameState.currentColor)">
                <span class="card-inner">{{ topCard.type === 'WILD_DRAW_FOUR' ? '+4' : topCard.type === 'DRAW_TWO' ? '+2' : topCard.type }}</span>
              </div>
              <span class="badge bg-info mt-2">Màu hiện tại</span>
            </div>
            
            <div class="turn-direction text-white-50">
              <i class="bi" :class="gameStore.gameState.direction === 1 ? 'bi-arrow-repeat fs-1' : 'bi-arrow-counterclockwise fs-1'"></i>
            </div>
          </div>

          <!-- Tay bài của mình -->
          <div class="my-hand-area mt-auto pt-4 border-top border-secondary text-center">
            <h6 class="text-muted mb-3">TAY BÀI CỦA BẠN</h6>
            <div class="d-flex justify-content-center flex-wrap gap-2">
              <div v-for="card in gameStore.gameState.myHand" :key="card.id" 
                   class="uno-card transition cursor-pointer"
                   :class="[getCardClass(card.color), { 'disabled-card': !isMyTurn }]"
                   @click="handlePlayCard(card)">
                <span class="card-inner">{{ card.type === 'WILD_DRAW_FOUR' ? '+4' : card.type === 'DRAW_TWO' ? '+2' : card.type }}</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- Khung Chat -->
      <div class="col-lg-4 d-flex flex-column">
        <ChatBox :channelId="`GAME_${route.params.sessionId}`" title="KÊNH TRẬN ĐẤU" />
      </div>

    </div>

    <!-- Modal Chọn Màu cho bài Wild -->
    <div v-if="showColorPicker" class="gv-modal-overlay">
      <div class="gv-modal glass-panel p-4 text-center">
        <h4 class="mb-4 fw-bold text-white">CHỌN MÀU MỚI</h4>
        <div class="d-flex justify-content-center gap-3">
          <button class="color-btn uno-red" @click="handlePickColor('RED')"></button>
          <button class="color-btn uno-green" @click="handlePickColor('GREEN')"></button>
          <button class="color-btn uno-blue" @click="handlePickColor('BLUE')"></button>
          <button class="color-btn uno-yellow" @click="handlePickColor('YELLOW')"></button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.max-w-1400 { max-width: 1400px; }
.glass-panel { background: var(--glass-bg); backdrop-filter: var(--glass-blur); border: 1px solid var(--glass-border); border-radius: 12px; }

.opponent-card { background: rgba(0,0,0,0.4); border: 2px solid transparent; transition: all 0.3s; }
.opponent-card.active-turn { border-color: var(--gv-primary); box-shadow: 0 0 15px rgba(99, 102, 241, 0.5); }

/* UNO Cards CSS */
.uno-card {
  width: 70px; height: 105px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-weight: 900; font-size: 1.8rem;
  border: 4px solid white; box-shadow: 0 4px 8px rgba(0,0,0,0.3);
  user-select: none;
}
.card-inner { background: white; border-radius: 50%; width: 45px; height: 65px; display: flex; align-items: center; justify-content: center; color: inherit; transform: rotate(-15deg); }

.uno-card:hover:not(.disabled-card) { transform: translateY(-15px) scale(1.1); z-index: 10; }
.disabled-card { filter: brightness(0.6); cursor: not-allowed !important; }
.cursor-pointer { cursor: pointer; }

.uno-red { background: #ef4444; color: #ef4444; }
.uno-green { background: #10b981; color: #10b981; }
.uno-blue { background: #3b82f6; color: #3b82f6; }
.uno-yellow { background: #eab308; color: #eab308; }
.uno-wild { background: #1e293b; color: #1e293b; border-color: #a855f7; }
.uno-back { background: #000; color: #ef4444; border-color: #ef4444; font-size: 1.2rem; }

/* Modal CSS */
.gv-modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(4px); }
.gv-modal { width: 100%; max-width: 400px; animation: slideDown 0.3s ease-out; }
.color-btn { width: 60px; height: 60px; border-radius: 50%; border: 4px solid white; cursor: pointer; transition: transform 0.2s; }
.color-btn:hover { transform: scale(1.2); }
@keyframes slideDown { from { opacity: 0; transform: translateY(-30px); } to { opacity: 1; transform: translateY(0); } }
</style>
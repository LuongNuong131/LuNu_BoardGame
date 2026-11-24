<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGameStore } from '@/stores/game.store';
import { useAuthStore } from '@/stores/auth.store';
import { useRoomStore } from '@/stores/room.store';
import { useUiStore } from '@/stores/ui.store';
import { DEMO_ROOMS, GAME_BY_ID } from '@/data/games';
import ChatBox from '@/components/ChatBox.vue';
import ArenaBoard from './ArenaBoard.vue';
import ArenaCard from './ArenaCard.vue';
import ArenaControls from './ArenaControls.vue';
import type { createPractice } from './practice';

type Practice = ReturnType<typeof createPractice>;
const route = useRoute();
const router = useRouter();
const roomStore = useRoomStore();
const ui = useUiStore();
const gameStore = useGameStore();
const auth = useAuthStore();
const sessionId = computed(() => String(route.params.sessionId));
const practiceMode = computed(() => sessionId.value.startsWith('demo-'));
const practiceGameId = computed(() => DEMO_ROOMS.find((room) => room.id === sessionId.value)?.game_id || sessionId.value.slice(5).toUpperCase());
const gameId = computed(() => practiceMode.value ? practiceGameId.value : gameStore.session?.game_id);
const game = computed(() => GAME_BY_ID[gameId.value]);
const practice = shallowRef<Practice>();
const localState = shallowRef<any>();
const state = computed(() => practiceMode.value ? localState.value : gameStore.gameState);
const participants = computed(() => practiceMode.value ? practice.value?.participants ?? [] : gameStore.participants);
const playerId = computed(() => practiceMode.value ? 'practice-player' : auth.profile?.id || '');
const isPlayer = computed(() => practiceMode.value || gameStore.isPlayer);
const busy = ref(false);
const error = ref('');
const fetched = ref(false);
const version = ref(0);
const choice = ref<'EASY' | 'MEDIUM' | 'HARD'>('MEDIUM');
const playerCount = ref(2);
const clock = ref(Date.now());
const clockTimer = setInterval(() => { clock.value = Date.now(); }, 1000);
const backPath = computed(() => practiceMode.value ? '/practice' : gameStore.session?.room_id && gameStore.session.status !== 'PLAYING' ? `/room/${gameStore.session.room_id}` : '/rooms');
const boardGame = computed(() => ['CHESS', 'CO_TUONG'].includes(gameId.value));
const bettingGame = computed(() => ['POKER', 'LIENG'].includes(gameId.value));
const finished = computed(() => practiceMode.value ? Boolean(state.value && practice.value?.finished()) :
  (Boolean(gameStore.session && gameStore.session.status !== 'PLAYING') || ['FINISHED', 'GAME_OVER', 'ROUND_END'].includes(state.value?.phase) || Boolean(state.value?.winner)));
const turn = computed(() => state.value?.currentPlayer || state.value?.players?.[state.value.currentTurnIndex]);
const deckTop = computed(() => state.value?.discardPile?.at(-1));
const tableCards = computed<any[]>(() => state.value?.communityCards?.length ? state.value.communityCards :
  gameId.value === 'TIEN_LEN' ? state.value.lastPlay?.cards ?? [] : deckTop.value ? [deckTop.value] : []);
const pot = computed(() => Object.values<number>(state.value?.invested ?? state.value?.bets ?? {}).reduce((a, b) => a + b, 0));
const nameOf = (id: string) => participants.value.find((participant: any) => participant.id === id)?.display_name || 'Người chơi';
const viewer = computed(() => state.value?.players?.find((player: any) => player.playerId === playerId.value));
const phaseLabels: Record<string, string> = {
  NIGHT: 'Ban đêm', DISCUSSION: 'Thảo luận', VOTING: 'Bỏ phiếu', LAST_WORD: 'Lời cuối', GAME_OVER: 'Kết thúc',
  PREFLOP: 'Pre-flop', FLOP: 'Flop', TURN: 'Turn', RIVER: 'River', SHOWDOWN: 'Mở bài',
};
const outcomes: Record<string, string> = { WIN: 'Thắng nhà cái', LOSS: 'Thua nhà cái', PUSH: 'Hòa với nhà cái' };
const timerLabel = computed(() => {
  if (!state.value?.phaseEndsAt || finished.value || practiceMode.value) return '';
  const seconds = Math.max(0, Math.ceil((Date.parse(state.value.phaseEndsAt) - clock.value) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
});
const resultTitle = computed(() => {
  if (!practiceMode.value && gameStore.session?.status === 'ABANDONED') return state.value?.endReason === 'PLAYER_LEFT' ? 'Ván đã dừng do người chơi rời bàn' : 'Ván đã dừng';
  if (state.value?.winnerTeam) return state.value.winnerTeam === 'VILLAGE' ? 'Phe Làng thắng' : 'Phe Sói thắng';
  if (state.value?.outcomes?.[playerId.value]) return outcomes[state.value.outcomes[playerId.value]];
  const winners: string[] = state.value?.winners ?? (state.value?.winner ? [state.value.winner] : []);
  if (winners.length > 1) return `Đồng thắng: ${winners.map(nameOf).join(', ')}`;
  return winners[0] ? (winners[0] === playerId.value ? 'Bạn thắng ván này' : `${nameOf(winners[0])} thắng ván này`) : 'Ván kết thúc hòa';
});
const turnLabel = computed(() => {
  if (finished.value) return 'Ván đã kết thúc';
  if (gameId.value === 'WEREWOLF') return phaseLabels[state.value?.phase] || 'Đang chia vai';
  if (turn.value === playerId.value) return 'Đến lượt bạn';
  return turn.value ? `Lượt của ${nameOf(turn.value)}` : 'Đang chia bàn';
});

const events: Record<string, string> = {
  PIECE_MOVED: 'đã đi quân', CARDS_PLAYED: 'đã đánh bài', CARD_PLAYED: 'đã đánh bài', PLAYER_DRAWN: 'đã rút bài',
  DRAW_CARD: 'đã rút bài', DISCARD: 'đã đánh lá rác', TAKE_DISCARD: 'đã ăn bài', BET_PLACED: 'đã đặt cược',
  STAND: 'đã dừng bài', HIT: 'đã rút thêm', PLAYER_FOLDED: 'đã úp bài', DEFUSE: 'đã gỡ bom',
  ROLL_DICE: 'đã tung xúc xắc', MOVE_HORSE: 'đã đi quân', HAND_SUBMITTED: 'đã chốt bài', BUY: 'đã mua đất',
  UPGRADE: 'đã nâng cấp', END_TURN: 'đã kết thúc lượt', PASS: 'đã bỏ lượt', PLAYER_PASSED: 'đã bỏ lượt',
  GAME_OVER: 'Ván đã kết thúc', GAME_FINISHED: 'Ván đã kết thúc', DEATH_RECORDED: 'Một người đã bị loại',
  PLAYER_DIED: 'đã bị loại', VOTE_CAST: 'đã gửi phiếu', PHASE_CHANGED: 'Đã chuyển giai đoạn',
  VOTE_FINISHED: 'Đã kiểm phiếu', UNO_PENALTY: 'bị phạt hai lá', TRICK_RESET: 'Đã mở vòng mới',
  GAME_STARTED: 'Ván bắt đầu', DEALT: 'Đã chia bài', PLAYER_FINISHED: 'đã hết bài', HUNTER_TRIGGERED: 'Thợ săn có thể bắn',
};
const log = computed<any[]>(() => (gameId.value === 'WEREWOLF' ? state.value?.events ?? [] : state.value?.actionLog ?? state.value?.eventLog ?? []).slice(-12).reverse());
function historyLine(event: any) {
  const id = event.playerId ?? event.actorId;
  const label = events[event.type] || 'Đã cập nhật bàn';
  return `${id && label[0] === label[0]?.toLowerCase() ? nameOf(id) + ' ' : ''}${label}${event.notation ? ' · ' + event.notation : ''}${event.amount ? ' · ' + event.amount + ' chip' : ''}`;
}
function participantInfo(p: any) {
  const info = state.value?.players?.find((entry: any) => entry.playerId === p.id);
  if (gameId.value === 'WEREWOLF') return [info?.alive ? 'Đang sống' : 'Đã bị loại', info?.roleName].filter(Boolean).join(' · ');
  if (state.value?.folded?.[p.id]) return 'Đã bị loại';
  if (bettingGame.value && state.value?.stacks) return `${state.value.stacks[p.id]} chip`;
  if (gameId.value === 'CO_TY_PHU') return `${state.value?.scores?.[p.id] ?? 0} xu`;
  if (info?.rank) return `Hạng ${info.rank}`;
  const cards = info?.cardsCount ?? state.value?.playerCardCounts?.[p.id];
  if (cards > 0) return `${cards} lá`;
  return p.is_ai ? 'Máy' : p.id === playerId.value ? 'Bạn' : 'Người chơi';
}

const racePositions = computed(() => {
  const map: Record<number, string[]> = {};
  if (gameId.value !== 'CO_CA_NGUA') return map;
  const players: string[] = state.value?.players || [];
  players.forEach((id, seat) => (state.value?.horses?.[id] || []).forEach((progress: number, index: number) => {
    if (progress >= 0 && progress < 48) (map[(progress + seat * 48 / players.length) % 48] ??= []).push(`${seat + 1}·${index + 1}`);
  }));
  return map;
});

async function startPractice() {
  if (!game.value) return;
  const current = sessionId.value;
  busy.value = true;
  error.value = '';
  try {
    const module = await import('./practice');
    if (sessionId.value !== current) return;
    practice.value = module.createPractice(gameId.value, playerCount.value, choice.value);
    localState.value = practice.value.view();
    version.value++;
  } catch (cause: any) {
    error.value = cause.message || 'Không thể mở bàn luyện tập.';
  } finally { if (sessionId.value === current) busy.value = false; }
}

async function connect() {
  const current = sessionId.value;
  error.value = '';
  fetched.value = false;
  gameStore.subscribeToSession(current);
  try {
    await gameStore.fetchGameState(current);
  } catch (cause: any) {
    if (current === sessionId.value) error.value = cause.message || 'Không thể kết nối bàn.';
  } finally {
    if (current === sessionId.value) fetched.value = true;
  }
}

watch(sessionId, () => {
  gameStore.unsubscribeFromSession();
  error.value = '';
  busy.value = false;
  practice.value = undefined;
  localState.value = undefined;
  if (!practiceMode.value) { void connect(); return; }
  if (game.value) playerCount.value = Math.max(2, game.value.minPlayers);
  void startPractice();
}, { immediate: true });

watch(() => gameStore.session?.id, (id) => { if (id === sessionId.value) error.value = ''; });

async function act(action: any) {
  if (busy.value || finished.value || !isPlayer.value) return;
  const current = sessionId.value;
  busy.value = true;
  error.value = '';
  try {
    if (practiceMode.value && practice.value) {
      practice.value.play(action);
      localState.value = practice.value.view();
    } else await gameStore.playAction(current, action);
  } catch (cause: any) {
    if (current === sessionId.value) error.value = cause.message || 'Nước đi này chưa hợp lệ.';
  } finally {
    if (current === sessionId.value) busy.value = false;
  }
}

async function leaveActiveRoom() {
  const roomId = gameStore.session?.room_id;
  if (!roomId || !await ui.confirmAction('Rời bàn sẽ dừng ván đang chơi và hoàn phí vào ví.', { title: 'Rời bàn chơi', confirmLabel: 'Rời bàn' })) return;
  busy.value = true;
  try {
    await roomStore.leaveRoom(roomId);
    await router.push('/rooms');
  } catch (cause: any) {
    error.value = cause.message || 'Không thể rời bàn.';
  } finally { busy.value = false; }
}

onUnmounted(() => { clearInterval(clockTimer); gameStore.unsubscribeFromSession(); });
</script>

<template>
  <main class="arena-root" :style="{ '--game-accent': game?.accent || '#e6c085' }">
    <header class="arena-top">
      <RouterLink :to="backPath" class="arena-brand"><i class="bi bi-diamond-half" aria-hidden="true"></i><span>LuNu</span><small>{{ practiceMode ? 'Sảnh luyện tập' : 'Sảnh trực tuyến' }}</small></RouterLink>
      <div class="arena-nav-actions"><div class="connection"><span aria-hidden="true"></span>{{ practiceMode ? 'Chơi với máy' : gameStore.realtimeStatus === 'SUBSCRIBED' ? 'Trực tuyến' : 'Đồng bộ định kỳ' }}</div><button v-if="!practiceMode && state && isPlayer && !finished" class="btn btn-quiet" :disabled="busy" @click="leaveActiveRoom">Rời bàn</button></div>
    </header>
    <section v-if="!state" class="arena-empty">
      <h1>{{ game?.name ?? (practiceMode ? 'Bàn không có trong danh mục' : 'Bàn trực tuyến') }}</h1>
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-else-if="busy || !practiceMode && !fetched">Đang mở bàn…</p>
      <button v-if="error && !practiceMode" class="btn btn-gold" @click="connect">Thử lại</button>
      <button v-if="error && practiceMode" class="btn btn-gold" @click="startPractice">Thử lại</button>
      <RouterLink v-if="practiceMode && !game" class="btn btn-gold" to="/practice">Chọn trò chơi</RouterLink>
    </section>
    <div v-else class="arena-content">
      <div class="match-heading">
        <div><p class="match-mode"><i :class="`bi ${game?.icon || 'bi-controller'}`" aria-hidden="true"></i> {{ practiceMode ? 'Bàn luyện tập' : isPlayer ? 'Người chơi' : 'Khán giả' }}</p><h1>{{ game?.name || 'Bàn chơi' }}</h1></div>
        <div class="turn-banner" role="status"><i class="bi bi-circle-fill" aria-hidden="true"></i>{{ turnLabel }}<strong v-if="timerLabel">{{ timerLabel }}</strong></div>
      </div>

      <p v-if="error" class="arena-error" role="alert"><i class="bi bi-exclamation-circle" aria-hidden="true"></i> {{ error }}</p>
      <section v-if="finished" class="arena-result" aria-live="polite">
        <i class="bi bi-trophy" aria-hidden="true"></i><div><h2>{{ resultTitle }}</h2><p v-if="state.endReason === 'CHECKMATE'">Chiếu hết</p><p v-else-if="state.endReason === 'STALEMATE'">Hết nước đi hợp lệ</p></div>
        <button v-if="practiceMode" class="btn btn-gold" @click="startPractice">Chơi lại</button>
        <div v-else class="arena-result-actions">
          <RouterLink v-if="isPlayer" to="/match-history" class="btn btn-quiet">Lịch sử ván</RouterLink>
          <RouterLink :to="backPath" class="btn btn-gold">Về phòng</RouterLink>
        </div>
      </section>

      <div class="arena-grid">
        <div class="arena-table" :class="{ 'night-table': gameId === 'WEREWOLF' }">
          <div class="table-seats">
            <article v-for="p in participants" :key="p.id" class="arena-seat" :class="{ current: turn === p.id && !finished, mine: p.id === playerId }">
              <img v-if="p.avatar_url" :src="p.avatar_url" alt="">
              <span v-else class="initial" aria-hidden="true">{{ p.display_name.slice(0, 1) }}</span>
              <div><strong>{{ p.display_name }}</strong><small>{{ participantInfo(p) }}</small></div>
            </article>
          </div>

          <ArenaBoard v-if="boardGame" :game-id="gameId" :state="state" :busy="busy || finished || !isPlayer" @action="act"/>
          <div v-else-if="gameId === 'WEREWOLF'" class="werewolf-table">
            <i class="bi bi-moon-stars" aria-hidden="true"></i>
            <strong>{{ phaseLabels[state.phase] }}</strong>
            <p>Ngày {{ state.day }} · Đêm {{ state.night }}</p>
            <p v-if="viewer?.roleName" class="role-label">Vai của bạn · {{ viewer.roleName }}</p>
          </div>
          <div v-else-if="gameId === 'CO_CA_NGUA'" class="race-table">
            <p v-if="state.dice" class="dice"><i class="bi bi-dice-5" aria-hidden="true"></i> {{ state.dice }}</p>
            <div class="race-track" aria-label="Đường đua cá ngựa">
              <div v-for="cell in 48" :key="cell" :class="{ marked: racePositions[cell - 1]?.length }"><small>{{ cell }}</small><strong>{{ racePositions[cell - 1]?.join(' ') }}</strong></div>
            </div>
            <p v-for="(positions, id) in state.horses" :key="id" class="horse-stable"><strong>{{ nameOf(String(id)) }}</strong> <span>{{ positions.filter((pos: number) => pos < 0).length }} trong chuồng · {{ positions.filter((pos: number) => pos === 53).length }}/4 về đích</span></p>
          </div>
          <div v-else-if="gameId === 'CO_TY_PHU'" class="city-table">
            <p v-if="state.dice" class="dice"><i class="bi bi-dice-5" aria-hidden="true"></i> {{ state.dice }}</p>
            <div class="city-grid" aria-label="Bàn cờ thành phố">
              <div v-for="cell in state.cityCells" :key="cell.index" :class="{ owned: state.properties?.[cell.index] }">
                <strong>{{ cell.name }}</strong>
                <small v-if="state.properties?.[cell.index]">{{ nameOf(state.properties[cell.index].owner) }} · cấp {{ state.properties[cell.index].level + 1 }}</small>
                <small v-else-if="cell.price">{{ cell.price }} xu</small>
                <span v-for="id in state.players.filter((id: string) => !state.folded[id] && state.positions[id] === cell.index)" :key="id" class="city-token">{{ nameOf(id) }}</span>
              </div>
            </div>
          </div>
          <div v-else class="felt-center">
            <div v-if="bettingGame" class="pot"><strong>{{ pot }} chip</strong><span>{{ gameId === 'POKER' ? phaseLabels[state.bettingRound] : 'Tiền cược trong bàn' }}</span></div>
            <div v-else-if="state.dealerId || state.dealerCards" class="pot"><strong>{{ state.dealerId ? nameOf(state.dealerId) : 'Nhà cái' }}</strong><span>Nhà cái</span></div>
            <div class="table-cards">
              <div v-if="!bettingGame && state.deckCount !== undefined && !state.dealerCards" class="deck"><i class="bi bi-diamond-half" aria-hidden="true"></i><span>{{ state.deckCount }} lá</span></div>
              <ArenaCard v-for="card in (state.dealerCards?.length ? state.dealerCards : tableCards)" :key="card.id ?? card.cardId" :card="card"/>
              <div v-if="state.dealerCards?.length && !finished" class="deck" aria-label="Lá úp"><i class="bi bi-diamond-half" aria-hidden="true"></i></div>
              <p v-if="!state.dealerCards?.length && !tableCards.length && state.deckCount === undefined">Bàn chưa có lá nào</p>
            </div>
            <p v-if="state.currentColor" class="color-label">Màu hiện tại <strong>{{ ({ RED: 'Đỏ', GREEN: 'Xanh lá', BLUE: 'Xanh dương', YELLOW: 'Vàng' } as Record<string, string>)[state.currentColor] }}</strong></p>
          </div>
          <div v-if="finished && state.shownHands" class="showdown">
            <h2>Bài mở cuối ván</h2>
            <div v-for="(hand, id) in state.shownHands" :key="id" class="showdown-row">
              <strong>{{ nameOf(String(id)) }}<small v-if="state.payouts?.[id]"> +{{ state.payouts[id] }} chip</small><small v-else-if="state.scores?.[id] !== undefined"> · {{ state.scores[id] }} điểm</small></strong>
              <div class="table-cards"><ArenaCard v-for="card in hand" :key="card.id" :card="card"/></div>
            </div>
          </div>
        </div>

        <aside class="arena-sidebar">
          <ArenaControls :key="`${sessionId}-${version}`" :game-id="gameId" :state="state" :player-id="playerId" :is-player="isPlayer" :busy="busy" :finished="finished" :name-of="nameOf" @action="act"/>
          <details v-if="practiceMode && game" class="arena-details">
            <summary>Cài đặt ván luyện tập</summary>
            <form class="practice-settings" @submit.prevent="startPractice">
              <label>Số người<select v-model.number="playerCount"><option v-for="count in game.maxPlayers - Math.max(2, game.minPlayers) + 1" :key="count" :value="count + Math.max(2, game.minPlayers) - 1">{{ count + Math.max(2, game.minPlayers) - 1 }}</option></select></label>
              <label v-if="boardGame">Độ khó<select v-model="choice"><option value="EASY">Dễ</option><option value="MEDIUM">Vừa</option><option value="HARD">Khó</option></select></label>
              <button class="btn btn-quiet" :disabled="busy" type="submit">Bắt đầu ván mới</button>
            </form>
          </details>
          <details v-if="game" class="arena-details">
            <summary>Luật chơi</summary>
            <ul><li v-for="rule in game.rules" :key="rule">{{ rule }}</li></ul>
          </details>
          <details v-if="!practiceMode && gameStore.session?.room_id" class="arena-details">
            <summary>Trò chuyện tại bàn</summary>
            <ChatBox :key="gameStore.session.room_id" :channel-id="`ROOM_${gameStore.session.room_id}`" title="Chat bàn chơi"/>
          </details>
          <details class="arena-details" open>
            <summary>Nhật ký ván</summary>
            <ul v-if="log.length" class="action-log"><li v-for="(event, index) in log" :key="event.id ?? index">{{ historyLine(event) }}</li></ul>
            <p v-else>Chưa có nước đi.</p>
          </details>
        </aside>
      </div>
    </div>
  </main>
</template>

<style scoped>
.arena-root{min-height:100vh;background:radial-gradient(ellipse at 45% 0%,#18342b,#0b1312 45%);color:#f7efdf;font-family:'Manrope',sans-serif}
.arena-top{height:68px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 clamp(15px,5vw,65px);border-bottom:1px solid #fff2;background:#0b1513}
.arena-brand{display:flex;align-items:center;gap:12px;color:#eee5d2;text-decoration:none}.arena-brand i{color:#ebc782;font-size:1.2rem}.arena-brand span{font:700 1.45rem Georgia,serif}.arena-brand small{padding-left:12px;border-left:1px solid #ffffff2a;color:#c4cdc2;font-size:.88rem}
.arena-nav-actions{display:flex;align-items:center;gap:10px}.arena-nav-actions .btn{padding:4px 8px;min-height:32px}.connection{display:flex;align-items:center;gap:7px;color:#c9d7cd;white-space:nowrap;font-size:.85rem}.connection span{width:7px;height:7px;border-radius:50%;background:#7dd6a9}
.arena-content{max-width:1400px;margin:auto;padding:27px clamp(12px,4vw,55px) 52px}.arena-empty{padding:55px clamp(18px,5vw,64px)}
.match-heading{display:flex;justify-content:space-between;align-items:end;gap:10px;margin-bottom:22px}.match-heading h1,.arena-empty h1{font:600 clamp(2rem,5vw,3.8rem)/1 'Playfair Display',Georgia,serif;margin:7px 0 0}
.match-mode{color:var(--game-accent);margin:0;font-weight:800;font-size:.87rem}.match-mode i{margin-right:4px}.turn-banner{display:flex;align-items:center;gap:9px;padding:9px 13px;background:#10211d;border:1px solid #2e564a;border-radius:999px;font-size:.92rem}.turn-banner i{font-size:.49rem;color:#8bdab4}.turn-banner strong{font-variant-numeric:tabular-nums;color:#efcd87}
.arena-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(290px,360px);gap:18px;align-items:start}.arena-sidebar{display:grid;gap:12px;min-width:0}
.arena-table{min-height:490px;padding:clamp(15px,3vw,27px);border:1px solid #e3c58755;border-radius:22px;background:radial-gradient(ellipse at 50% 45%,#256451,#143b31 70%,#102b25);box-shadow:inset 0 0 38px #071a13aa,0 15px 38px #0003}
.night-table{background:radial-gradient(ellipse at 50% 38%,#2b2f54,#1a2438 70%,#151b2c);border-color:#9d81ff51}
.table-seats{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:22px}.arena-seat{display:flex;align-items:center;gap:8px;min-width:min(125px,100%);flex:1 1 130px;max-width:280px;padding:7px 9px;border:1px solid #e0b9793b;border-radius:9px;background:#0d1e1bba}.arena-seat.current{border-color:#e3c780;box-shadow:0 0 0 1px #e3c78080}.arena-seat.mine .initial{background:#e7c88f;color:#2a2118}.arena-seat strong,.arena-seat small{display:block;overflow-wrap:anywhere}.arena-seat small{color:#bdc9be;font-size:.84rem}.arena-seat img,.initial{width:34px;height:34px;border-radius:7px;flex:0 0 auto}.arena-seat img{object-fit:cover}.initial{display:grid;place-items:center;background:#384946;color:#f2d69d;font-weight:800}
.felt-center,.werewolf-table{min-height:320px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:21px}.table-cards{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:9px}
.deck{display:grid;gap:5px;place-content:center;text-align:center;width:clamp(46px,6vw,65px);aspect-ratio:2/3;border:1px solid #c8a96d;border-radius:8px;color:#f0d298;background:repeating-linear-gradient(45deg,#122d26 0 4px,#1c3930 4px 8px);box-shadow:0 6px 13px #0005}.deck i{font-size:1.3rem}.deck span{font-size:.72rem}
.pot{display:grid;gap:4px;text-align:center}.pot strong{color:#f9d89b;font:700 1.7rem Georgia,serif}.pot span{font-size:.9rem;color:#c1d4c8}.color-label{margin:0;color:#dbe4d8}.color-label strong{color:#f0d196;margin-left:4px}
.werewolf-table i{font-size:3.6rem;color:#e5cdfb}.werewolf-table strong{font:700 2rem Georgia,serif}.werewolf-table p{margin:0;color:#d9d7e9}.role-label{border:1px solid #ceb2e465;border-radius:8px;padding:9px 14px}
.arena-details{padding:14px 16px;background:#111d1a;border:1px solid #d9e9d624;border-radius:12px}.arena-details summary{font-weight:800;cursor:pointer}.arena-details ul,.arena-details p{margin:8px 0 0;color:#c2d0c3}.arena-details ul{padding-left:20px}.arena-details li{margin:5px 0}.arena-details .action-log{padding:0;list-style:none}.action-log li{border-top:1px solid #ffffff17;padding-top:6px}
.practice-settings{margin-top:11px;display:flex;flex-wrap:wrap;align-items:end;gap:9px}.practice-settings label{display:grid;gap:4px;font-size:.87rem}.practice-settings select{min-height:36px;background:#0b1513;color:#f7efdf;border:1px solid #ffffff36;border-radius:6px;padding:4px 9px}
.arena-error,.arena-result{display:flex;align-items:center;gap:12px;padding:13px 17px;margin:0 0 14px;border:1px solid #d68b7c70;background:#412322;border-radius:10px}.arena-result{background:#243728;border-color:#d9bd7a68}.arena-result h2{font:700 1.35rem Georgia,serif;margin:0}.arena-result p{margin:4px 0 0}.arena-result > .btn,.arena-result-actions{margin-left:auto}.arena-result-actions{display:flex;flex-wrap:wrap;gap:7px;justify-content:flex-end}.arena-result>i{color:#f3cd83;font-size:1.5rem}
.race-track,.city-grid{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:3px;padding:8px;background:#101f1d;border-radius:10px}.race-track>div,.city-grid>div{min-height:48px;padding:4px;border-radius:5px;background:#263d34;display:flex;flex-direction:column;align-items:start;gap:3px}.race-track>div.marked,.city-grid>div.owned{background:#90683b;color:#fff5e5}.race-track strong,.race-track small{font-size:.76rem}.horse-stable{display:flex;justify-content:space-between;gap:8px;margin:8px 0 0;color:#e0e6d6}
.city-grid{grid-template-columns:repeat(6,minmax(0,1fr))}.city-grid>div{min-height:82px;padding:5px}.city-grid strong{font-size:.85rem;line-height:1.18}.city-grid small{color:#e3dcbe;font-size:.76rem}.city-token{font-size:.68rem;background:#151c19;color:#fbdda3;border-radius:4px;padding:2px 4px;overflow-wrap:anywhere}.dice{text-align:center;color:#f7d996;font-weight:900;font-size:1.1rem}
.showdown{border-top:1px solid #f2df9b45;padding-top:15px}.showdown h2{font:700 1.24rem Georgia,serif}.showdown-row{margin-top:13px}.showdown-row .table-cards{justify-content:start;margin-top:6px}.showdown-row small{font-weight:500;color:#ecd39f}
@media(max-width:940px){.arena-grid{grid-template-columns:1fr}.arena-table{min-height:0}.felt-center,.werewolf-table{min-height:220px}}@media(max-width:520px){.arena-result{flex-wrap:wrap}.arena-result-actions{flex:1 0 100%}.arena-content{padding-top:18px}.arena-brand{gap:7px}.arena-brand small{padding-left:7px;font-size:.73rem}.connection{font-size:.73rem}.match-heading{align-items:start;flex-direction:column}.arena-table{padding:10px}.arena-seat{flex-basis:110px}.table-seats{margin-bottom:12px}.city-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.horse-stable{font-size:.82rem}.turn-banner{font-size:.85rem}}
</style>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useRoomStore } from '@/stores/room.store';
import { DEMO_ROOMS, GAME_CATALOG, GAME_BY_ID, formatCoins, type GameCategory } from '@/data/games';

const router = useRouter();
const route = useRoute();
const roomStore = useRoomStore();
const showCreateModal = ref(false);
const searchTerm = ref('');
const activeTab = ref<'all' | GameCategory>('all');
const selectedGame = ref('WEREWOLF');
const createForm = ref({ game_id: 'WEREWOLF', name: 'Phòng của LuNu', max_players: 12, entry_fee: 150 });
const loadError = ref('');

const rooms = computed(() => roomStore.rooms.length ? roomStore.rooms : import.meta.env.VITE_DEMO_MODE === 'true' ? DEMO_ROOMS : []);
const filteredRooms = computed(() => rooms.value.filter((room: any) => {
  const game = GAME_BY_ID[room.game_id];
  const matchesTab = activeTab.value === 'all' || game?.category === activeTab.value;
  const matchesGame = selectedGame.value === 'all' || room.game_id === selectedGame.value;
  const matchesSearch = !searchTerm.value || `${room.name} ${game?.name || room.game_id} ${room.ownerName || room.owner?.display_name || ''}`.toLowerCase().includes(searchTerm.value.toLowerCase());
  return matchesTab && matchesGame && matchesSearch;
}));
const roomCount = computed(() => filteredRooms.value.length);
const selectedDefinition = computed(() => GAME_BY_ID[createForm.value.game_id]);

onMounted(async () => {
  if (route.query.create === '1') showCreateModal.value = true;
  if (route.query.game && GAME_BY_ID[route.query.game as string]) selectedGame.value = route.query.game as string;
  try { await roomStore.fetchRooms(); roomStore.subscribeToLobby(); } catch (error: any) { loadError.value = error.message || 'Không thể tải danh sách phòng từ Supabase.'; }
});

onUnmounted(() => roomStore.unsubscribeFromLobby());

const updateGameDefaults = () => {
  const game = selectedDefinition.value;
  if (game) {
    createForm.value.max_players = game.maxPlayers;
    createForm.value.entry_fee = game.id === 'WEREWOLF' ? 150 : game.id === 'POKER' ? 500 : 50;
  }
};

const isRoomFull = (room: any) => (room.occupied ?? room.player_count ?? room.players?.[0]?.count ?? room.players?.length ?? 0) >= room.max_players;
const occupiedCount = (room: any) => room.occupied ?? room.player_count ?? room.players?.[0]?.count ?? room.players?.length ?? 0;
const spectatorCount = (room: any) => room.spectators ?? room.spectator_count ?? 0;
const roomState = (room: any) => room.status === 'RUNNING' ? 'ĐANG DIỄN RA' : isRoomFull(room) ? 'ĐẦY BÀN' : 'ĐANG MỞ';

const enterRoom = async (room: any) => {
  if (!String(room.id).startsWith('demo-')) {
    try {
      if (!isRoomFull(room)) await roomStore.joinRoom(room.id);
    } catch (err: any) { alert(err.message || 'Không thể vào phòng.'); return; }
  }
  router.push(`/room/${room.id}`);
};

const handleCreate = async () => {
  try {
    const roomId = await roomStore.createRoom(createForm.value);
    showCreateModal.value = false;
    router.push(`/room/${roomId}`);
  } catch (err: any) { alert(err.message || 'Không thể tạo phòng. Kiểm tra lại cấu hình.'); }
};
</script>

<template>
  <div class="page-frame rooms-page">
    <div class="rooms-heading">
      <div><div class="eyebrow">LuNu Club · Open tables</div><h1 class="page-title mb-2">Sảnh game</h1><p class="heading-copy">Chọn bàn phù hợp với nhịp chơi của bạn. <strong>{{ roomCount }} phòng</strong> đang chờ người tham gia.</p></div>
      <div class="heading-actions"><button class="btn btn-quiet" @click="roomStore.fetchRooms()"><i class="bi bi-arrow-clockwise me-2"></i>Làm mới</button><button class="btn btn-gold" @click="showCreateModal = true"><i class="bi bi-plus-lg me-2"></i>Tạo phòng</button></div>
    </div>

    <div v-if="loadError" class="load-error mt-3"><i class="bi bi-database-x me-2"></i><span>{{ loadError }}</span><button class="btn btn-sm btn-quiet ms-auto" @click="loadError = ''; roomStore.fetchRooms().catch((error: any) => loadError = error.message)">Thử lại</button></div>
    <div class="lobby-toolbar glass-panel mt-4">
      <div class="search-box"><i class="bi bi-search"></i><input v-model="searchTerm" placeholder="Tìm phòng, game hoặc chủ bàn..."></div>
      <div class="filter-tabs"><button :class="{active: activeTab === 'all'}" @click="activeTab = 'all'">Tất cả</button><button :class="{active: activeTab === 'cards'}" @click="activeTab = 'cards'">Bài</button><button :class="{active: activeTab === 'board'}" @click="activeTab = 'board'">Cờ & bàn</button><button :class="{active: activeTab === 'social'}" @click="activeTab = 'social'">Social</button></div>
      <select v-model="selectedGame" class="form-select game-filter"><option value="all">Mọi game</option><option v-for="game in GAME_CATALOG" :key="game.id" :value="game.id">{{ game.name }}</option></select>
    </div>

    <div class="lobby-layout mt-4">
      <main>
        <div class="d-flex align-items-center justify-content-between mb-3"><div class="section-title">Phòng đang mở <span class="result-count">{{ roomCount }}</span></div><div class="sort-label"><i class="bi bi-sliders2 me-1"></i> Ưu tiên bàn sắp đầy</div></div>
        <div v-if="roomStore.loading" class="glass-panel loading-state"><div class="spinner-border text-warning"></div><span>Đang cập nhật sảnh...</span></div>
        <div v-else-if="filteredRooms.length === 0" class="glass-panel empty-state"><i class="bi bi-search"></i><h3>Chưa thấy bàn phù hợp</h3><p>Thử đổi bộ lọc hoặc tạo một phòng mới cho nhóm của bạn.</p></div>
        <div v-else class="room-grid">
          <article v-for="room in filteredRooms" :key="room.id" class="room-card" :class="{ featured: room.featured }">
            <div class="room-card-top"><div class="game-token" :style="{ color: GAME_BY_ID[room.game_id]?.accent, background: `${GAME_BY_ID[room.game_id]?.accent}16` }"><i :class="`bi ${GAME_BY_ID[room.game_id]?.icon || 'bi-controller'}`"></i></div><div class="room-status" :class="room.status === 'RUNNING' ? 'running' : isRoomFull(room) ? 'full' : 'open'"><span></span>{{ roomState(room) }}</div><button class="more-button"><i class="bi bi-three-dots"></i></button></div>
            <div class="room-card-body"><div class="room-game-label">{{ GAME_BY_ID[room.game_id]?.name || room.game_id }} <span>·</span> {{ GAME_BY_ID[room.game_id]?.players || 'Bàn mở' }}</div><h3>{{ room.name }}</h3><p>{{ GAME_BY_ID[room.game_id]?.description || 'Bàn chơi đang chờ những người đồng điệu.' }}</p></div>
            <div class="room-card-bottom"><div class="room-owner"><span class="owner-avatar">{{ (room.ownerName || room.owner?.display_name || 'L').charAt(0) }}</span><span><small>Chủ bàn</small><strong>{{ room.ownerName || room.owner?.display_name || 'Người chơi' }}</strong></span></div><div class="room-economy"><strong>{{ room.entry_fee ? formatCoins(room.entry_fee) : 'Miễn phí' }}</strong><small>phí vào bàn</small></div></div>
            <div class="room-card-footer"><div class="seat-meter"><div class="seat-label"><span><i class="bi bi-person-fill me-1"></i>{{ occupiedCount(room) }}/{{ room.max_players }} chỗ ngồi</span><span class="watch-label"><i class="bi bi-eye me-1"></i>{{ spectatorCount(room) }} xem</span></div><div class="seat-track"><span :style="{ width: `${Math.min(100, occupiedCount(room) / room.max_players * 100)}%` }"></span></div></div><button @click="enterRoom(room)" class="btn btn-sm room-enter-btn">{{ isRoomFull(room) || room.status === 'RUNNING' ? 'Xem bàn' : 'Vào bàn' }}<i class="bi bi-arrow-up-right ms-2"></i></button></div>
          </article>
        </div>
      </main>

      <aside class="side-rail">
        <section class="rail-card glass-panel"><div class="rail-title"><div><div class="eyebrow">Luật bàn</div><h2>Không còn chỗ?</h2></div><i class="bi bi-eye text-mint"></i></div><p>Khi đủ người, bạn vẫn có thể <strong>vào xem trực tiếp</strong>. Khi có ghế trống, hệ thống ưu tiên người đã chờ lâu nhất.</p><div class="policy-row"><span class="policy-icon"><i class="bi bi-shield-check"></i></span><span><strong>Minh bạch</strong><small>Ghế và phí hiển thị theo thời gian thực</small></span></div><div class="policy-row"><span class="policy-icon"><i class="bi bi-arrow-repeat"></i></span><span><strong>Luân phiên</strong><small>Rời bàn sẽ mở ghế cho người xem</small></span></div></section>
        <section class="guide-card"><div class="eyebrow">Cẩm nang nhanh</div><h2>Chơi đúng luật,<br><span>vui đúng gu.</span></h2><p>Mỗi loại game có luật tiền, nhịp chơi và hướng dẫn riêng ngay trong phòng.</p><router-link to="/room/demo-werewolf" class="guide-link">Xem một phòng mẫu <i class="bi bi-arrow-up-right"></i></router-link></section>
      </aside>
    </div>

    <div v-if="showCreateModal" class="modal-backdrop-custom" @click.self="showCreateModal = false"><div class="create-modal glass-panel"><div class="modal-header-custom"><div><div class="eyebrow">New table</div><h2>Tạo phòng chơi</h2><p>Thiết lập một bàn riêng cho nhóm của bạn.</p></div><button class="close-button" @click="showCreateModal = false"><i class="bi bi-x-lg"></i></button></div><form @submit.prevent="handleCreate"><label>Chọn game<select v-model="createForm.game_id" class="form-select mt-2" @change="updateGameDefaults"><option v-for="game in GAME_CATALOG" :key="game.id" :value="game.id">{{ game.name }} · {{ game.players }}</option></select></label><div class="selected-game-note mt-3"><div class="game-token" :style="{color:selectedDefinition?.accent, background:`${selectedDefinition?.accent}16`}"><i :class="`bi ${selectedDefinition?.icon}`"></i></div><div><strong>{{ selectedDefinition?.name }}</strong><small>{{ selectedDefinition?.description }}</small></div></div><label class="mt-3">Tên phòng<input v-model="createForm.name" class="form-control mt-2" required></label><div class="row g-3 mt-0"><label class="col-6 mt-3">Số ghế<input v-model.number="createForm.max_players" type="number" :min="selectedDefinition?.minPlayers" :max="selectedDefinition?.maxPlayers" class="form-control mt-2" required></label><label class="col-6 mt-3">Phí vào bàn<input v-model.number="createForm.entry_fee" type="number" min="0" class="form-control mt-2" required></label></div><div class="rule-note mt-4"><i class="bi bi-info-circle"></i><span>Phòng đầy sẽ chuyển người vào sau sang <strong>chế độ khán giả</strong>. Ghế trống được mở lại tự động khi có người rời bàn.</span></div><div class="modal-actions mt-4"><button type="button" class="btn btn-quiet" @click="showCreateModal = false">Hủy</button><button type="submit" class="btn btn-gold">Tạo phòng <i class="bi bi-arrow-right ms-2"></i></button></div></form></div></div>
  </div>
</template>

<style scoped>
.rooms-page { padding-top:30px }.load-error{display:flex;align-items:center;padding:10px 12px;border:1px solid rgba(239,127,133,.22);border-radius:11px;color:#ef9a9e;background:rgba(239,127,133,.07);font-size:.62rem}.rooms-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:20px}.heading-copy{color:var(--gv-text-muted);font-size:.82rem}.heading-copy strong{color:var(--gv-text-main)}.heading-actions{display:flex;gap:9px}.lobby-toolbar{display:flex;align-items:center;gap:18px;padding:12px 14px;border-radius:16px}.search-box{display:flex;align-items:center;gap:10px;flex:1;color:var(--gv-text-dim)}.search-box input{width:100%;border:0;outline:0;color:var(--gv-text-main);background:transparent;font-size:.76rem}.filter-tabs{display:flex;gap:4px}.filter-tabs button{border:0;border-radius:9px;padding:8px 11px;color:var(--gv-text-muted);background:transparent;font-size:.68rem;font-weight:700}.filter-tabs button.active,.filter-tabs button:hover{color:var(--gv-primary);background:rgba(214,173,98,.1)}.game-filter{width:145px!important;font-size:.68rem!important;padding:8px 10px!important}.lobby-layout{display:grid;grid-template-columns:minmax(0,1fr) 275px;gap:24px}.result-count{color:var(--gv-primary);font:500 .66rem 'DM Mono',monospace;margin-left:5px}.sort-label{color:var(--gv-text-dim);font-size:.65rem}.room-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.room-card{position:relative;min-width:0;border:1px solid rgba(255,255,255,.07);border-radius:19px;background:linear-gradient(145deg,rgba(25,48,42,.78),rgba(11,26,23,.8));overflow:hidden;transition:transform .2s,border-color .2s,box-shadow .2s}.room-card:hover{transform:translateY(-3px);border-color:rgba(214,173,98,.28);box-shadow:0 17px 32px rgba(0,0,0,.22)}.room-card.featured{border-color:rgba(214,173,98,.22)}.room-card.featured::before{content:'GỢI Ý';position:absolute;top:0;right:0;color:#16201d;background:var(--gv-primary);padding:4px 9px 4px 11px;border-radius:0 0 0 9px;font-size:.49rem;font-weight:800;letter-spacing:.12em}.room-card-top{display:flex;align-items:center;gap:10px;padding:17px 17px 7px}.game-token{width:37px;height:37px;display:grid;place-items:center;border-radius:12px;font-size:.95rem}.room-status{display:flex;align-items:center;gap:6px;font-size:.57rem;font-weight:800;letter-spacing:.08em}.room-status span{width:6px;height:6px;border-radius:50%;background:var(--gv-accent-success)}.room-status.running span{background:var(--gv-accent-warning);box-shadow:0 0 0 4px rgba(234,185,106,.1)}.room-status.full{color:var(--gv-text-muted)}.room-status.full span{background:var(--gv-text-dim);box-shadow:none}.more-button{margin-left:auto;border:0;background:transparent;color:var(--gv-text-dim)}.room-card-body{padding:7px 17px 15px}.room-game-label{color:var(--gv-primary);font-size:.6rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase}.room-game-label span{color:var(--gv-text-dim);margin:0 3px}.room-card h3{font-size:.94rem;font-weight:800;letter-spacing:-.025em;margin:8px 0 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.room-card p{height:31px;overflow:hidden;color:var(--gv-text-muted);font-size:.65rem;line-height:1.5;margin:0}.room-card-bottom{display:flex;align-items:center;justify-content:space-between;padding:12px 17px;border-top:1px solid rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.06)}.room-owner{display:flex;align-items:center;gap:8px}.owner-avatar{display:grid;place-items:center;width:25px;height:25px;border-radius:8px;color:var(--gv-secondary);background:rgba(88,199,176,.14);font-size:.65rem;font-weight:800}.room-owner small,.room-owner strong,.room-economy small,.room-economy strong{display:block}.room-owner small,.room-economy small{color:var(--gv-text-dim);font-size:.56rem}.room-owner strong{font-size:.62rem}.room-economy{text-align:right}.room-economy strong{color:var(--gv-primary);font-size:.64rem}.room-card-footer{display:flex;align-items:flex-end;gap:11px;padding:13px 17px}.seat-meter{flex:1}.seat-label{display:flex;justify-content:space-between;color:var(--gv-text-muted);font-size:.56rem;margin-bottom:7px}.watch-label{color:var(--gv-text-dim)}.seat-track{height:4px;border-radius:6px;background:#29423b;overflow:hidden}.seat-track span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--gv-secondary),var(--gv-primary))}.room-enter-btn{color:var(--gv-text-main);border:1px solid rgba(214,173,98,.24);background:rgba(214,173,98,.08);font-size:.61rem;font-weight:800;white-space:nowrap}.room-enter-btn:hover{color:#17211d;background:var(--gv-primary);border-color:var(--gv-primary)}.side-rail{display:flex;flex-direction:column;gap:15px}.rail-card{padding:21px}.rail-title{display:flex;justify-content:space-between;align-items:flex-start}.rail-title h2,.guide-card h2{font-size:1.05rem;font-weight:800;margin:5px 0 0}.rail-card>p{color:var(--gv-text-muted);font-size:.69rem;line-height:1.65;margin:18px 0}.rail-card>p strong{color:var(--gv-text-main)}.policy-row{display:flex;gap:10px;margin-top:15px}.policy-icon{width:29px;height:29px;display:grid;place-items:center;flex:0 0 auto;color:var(--gv-secondary);border-radius:9px;background:rgba(88,199,176,.1)}.policy-row strong,.policy-row small{display:block}.policy-row strong{font-size:.68rem}.policy-row small{color:var(--gv-text-muted);font-size:.58rem;line-height:1.4;margin-top:3px}.guide-card{position:relative;min-height:193px;padding:23px;border-radius:19px;overflow:hidden;background:linear-gradient(135deg,#193c34,#0f2421)}.guide-card::after{content:'♞';position:absolute;right:21px;bottom:-18px;color:rgba(214,173,98,.18);font:7rem Georgia,serif;transform:rotate(-12deg)}.guide-card h2{position:relative;z-index:1;font-family:'Playfair Display',serif;font-size:1.55rem;line-height:1.15}.guide-card h2 span{color:var(--gv-primary-hover)}.guide-card p{position:relative;z-index:1;max-width:180px;color:#a9c1b8;font-size:.67rem;line-height:1.55;margin:12px 0 17px}.guide-link{position:relative;z-index:1;color:var(--gv-primary);font-size:.64rem;font-weight:800}.loading-state,.empty-state{padding:55px;text-align:center;color:var(--gv-text-muted)}.loading-state span{display:block;font-size:.7rem;margin-top:12px}.empty-state i{font-size:2rem;color:var(--gv-text-dim)}.empty-state h3{font-size:1rem;margin:14px 0 5px}.empty-state p{font-size:.7rem}.modal-backdrop-custom{position:fixed;z-index:100;inset:0;display:grid;place-items:center;padding:16px;background:rgba(1,8,7,.78);backdrop-filter:blur(8px)}.create-modal{width:min(100%,520px);padding:27px}.modal-header-custom{display:flex;justify-content:space-between;gap:18px}.modal-header-custom h2{font-size:1.4rem;font-weight:800;margin:6px 0}.modal-header-custom p{color:var(--gv-text-muted);font-size:.7rem}.close-button{width:31px;height:31px;border:1px solid rgba(255,255,255,.08);border-radius:9px;color:var(--gv-text-muted);background:rgba(255,255,255,.03)}.selected-game-note{display:flex;align-items:center;gap:11px;padding:11px;border:1px solid rgba(214,173,98,.17);border-radius:12px;background:rgba(214,173,98,.05)}.selected-game-note strong,.selected-game-note small{display:block}.selected-game-note strong{font-size:.72rem}.selected-game-note small{color:var(--gv-text-muted);font-size:.6rem;margin-top:2px}.create-modal label{display:block;color:var(--gv-text-muted);font-size:.66rem;font-weight:700}.rule-note{display:flex;gap:9px;padding:11px;border-radius:11px;color:var(--gv-text-muted);background:rgba(88,199,176,.06);font-size:.6rem;line-height:1.55}.rule-note i{color:var(--gv-secondary)}.rule-note strong{color:var(--gv-text-main)}.modal-actions{display:flex;justify-content:flex-end;gap:9px}
@media (max-width: 1100px){.lobby-layout{grid-template-columns:1fr}.side-rail{display:grid;grid-template-columns:1fr 1fr}.room-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media (max-width: 700px){.rooms-heading{display:block}.heading-actions{margin-top:18px}.lobby-toolbar{display:block}.filter-tabs{margin:12px 0}.game-filter{width:100%!important}.room-grid,.side-rail{grid-template-columns:1fr}.room-card-footer{padding-bottom:15px}}
</style>

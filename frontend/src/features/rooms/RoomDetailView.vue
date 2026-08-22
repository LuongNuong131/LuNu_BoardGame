<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useRoomStore } from '@/stores/room.store';
import { useAuthStore } from '@/stores/auth.store';
import { apiClient } from '@/services/api/apiClient';
import { prepareRealtimeAuth, supabase } from '@/services/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import ChatBox from '@/components/ChatBox.vue';
import { DEMO_ROOMS, GAME_BY_ID, formatCoins } from '@/data/games';

const route = useRoute();
const router = useRouter();
const roomStore = useRoomStore();
const authStore = useAuthStore();
const isStarting = ref(false);
const activeGuide = ref(0);
const realtimeStatus = ref('CONNECTING');
let roomSubscription: RealtimeChannel | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let roomStarting = false;

const demoRoom = computed(() => DEMO_ROOMS.find((item) => item.id === route.params.id));
const room = computed(() => roomStore.currentRoom || demoRoom.value);
const game = computed(() => room.value ? GAME_BY_ID[room.value.game_id] : GAME_BY_ID.WEREWOLF);
const demoPlayers = computed(() => {
  if (!demoRoom.value) return [];
  const names = ['Linh Mộc', 'Khanh Vu', 'An Khang', 'Mỹ Hạnh', 'Tú Anh', 'Duy Minh', 'Hà My', 'Bảo Long'];
  return names.slice(0, demoRoom.value.occupied).map((name, index) => ({ id: `demo-player-${index}`, display_name: name, username: name.toLowerCase().replaceAll(' ', ''), level: 8 + index * 2, avatar_url: `https://api.dicebear.com/9.x/shapes/svg?seed=${name}&backgroundColor=193a31`, is_ready: true, seat: index + 1, isOwner: index === 0 }));
});
const players = computed(() => room.value?.players?.map((item: any, index: number) => ({ ...item.user, ...item, seat: item.seat_index || item.seat || index + 1, isOwner: item.user?.id === room.value?.owner_id })) || demoPlayers.value);
const spectators = computed(() => Array.isArray(room.value?.spectators) ? room.value.spectators.length : demoRoom.value?.spectators || room.value?.spectators_count || 0);
const realtimeLabel = computed(() => realtimeStatus.value === 'SUBSCRIBED' ? 'Realtime đang bật' : realtimeStatus.value === 'RECONNECTING' ? 'Đang kết nối lại' : realtimeStatus.value === 'CHANNEL_ERROR' ? 'Realtime lỗi kết nối' : 'Đang kết nối realtime');
const seats = computed(() => Array.from({ length: room.value?.max_players || game.value.maxPlayers }, (_, index) => players.value.find((player: any) => player.seat === index + 1) || null));
const isFull = computed(() => players.value.length >= (room.value?.max_players || game.value.maxPlayers));
const currentUserIsOwner = computed(() => authStore.profile?.id && room.value?.owner_id === authStore.profile.id);
const canDeleteRoom = computed(() => Boolean(currentUserIsOwner.value || ['ADMIN', 'SUPER_ADMIN'].includes(authStore.profile?.role)));

const scheduleRoomRefresh = (roomId: string) => {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => roomStore.fetchRoomDetail(roomId).catch(() => undefined), 80);
};

const subscribeToRoom = async (roomId: string) => {
  if (roomSubscription || roomStarting) return;
  roomStarting = true;
  await prepareRealtimeAuth();
  realtimeStatus.value = 'CONNECTING';
  roomSubscription = supabase.channel(`room_realtime_${roomId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomId}` }, () => scheduleRoomRefresh(roomId))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_room_players', filter: `room_id=eq.${roomId}` }, () => scheduleRoomRefresh(roomId))
    .subscribe((status) => {
      realtimeStatus.value = status;
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        realtimeStatus.value = 'RECONNECTING';
        const failedChannel = roomSubscription;
        roomSubscription = null;
        if (failedChannel) supabase.removeChannel(failedChannel);
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => subscribeToRoom(roomId), 1800);
      }
    });
  roomStarting = false;
};

onMounted(async () => {
  const roomId = route.params.id as string;
  if (String(roomId).startsWith('demo-')) return;
  try {
    await roomStore.fetchRoomDetail(roomId);
    await subscribeToRoom(roomId);
  } catch {
    router.push('/rooms');
  }
});

onUnmounted(() => {
  roomStarting = false;
  if (roomSubscription) supabase.removeChannel(roomSubscription);
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (refreshTimer) clearTimeout(refreshTimer);
});

const handleStartGame = async () => {
  if (!room.value || String(room.value.id).startsWith('demo-')) { router.push(`/game/demo-${room.value?.game_id || 'WEREWOLF'}`); return; }
  isStarting.value = true;
  try {
    const res: any = await apiClient.post(`/sessions/room/${room.value.id}/start`);
    if (res.success) router.push(`/game/${res.data.sessionId}`);
  } catch (err: any) { alert(err.message || 'Không thể bắt đầu trận đấu.'); } finally { isStarting.value = false; }
};

const deleteCurrentRoom = async () => {
  if (!room.value || !canDeleteRoom.value || !window.confirm(`Xóa phòng “${room.value.name}”? Tất cả ghế và phiên chờ sẽ bị dọn.`)) return;
  try { await roomStore.deleteRoom(room.value.id); router.push('/rooms'); } catch (error: any) { alert(error.message || 'Không thể xóa phòng.'); }
};

const leaveRoomAndExit = async () => {
  if (room.value && !String(room.value.id).startsWith('demo-')) {
    try { await roomStore.leaveRoom(room.value.id); } catch { /* still allow the user to leave the view if the network is unavailable */ }
  }
  router.push('/rooms');
};

const takeSeat = async () => {
  if (!room.value || String(room.value.id).startsWith('demo-')) { router.push(`/game/${room.value?.id || 'demo'}`); return; }
  try { await roomStore.joinRoom(room.value.id); await roomStore.fetchRoomDetail(room.value.id); } catch (err: any) { alert(err.message || 'Ghế vừa được người khác chọn.'); }
};
</script>

<template>
  <div class="page-frame room-page" v-if="room">
    <div class="room-topline"><button class="back-link" @click="leaveRoomAndExit"><i class="bi bi-arrow-left"></i> Sảnh game</button><div class="room-breadcrumb">{{ game.category === 'cards' ? 'Bàn bài' : game.category === 'board' ? 'Bàn cờ' : 'Social room' }} <span>/</span> {{ room.id.startsWith('demo-') ? 'Phòng mẫu' : 'Phòng riêng' }}</div><div class="room-top-actions"><span class="secure-label realtime-status" :class="realtimeStatus.toLowerCase()"><span class="status-signal"></span><i class="bi bi-wifi"></i> {{ realtimeLabel }}</span><button v-if="canDeleteRoom" class="icon-button danger-icon" title="Xóa phòng" @click="deleteCurrentRoom"><i class="bi bi-trash3"></i></button><button class="icon-button"><i class="bi bi-share"></i></button></div></div>
    <div class="room-header mt-4"><div><div class="eyebrow"><span class="live-dot"></span> {{ room.status === 'RUNNING' ? 'Trận đấu đang diễn ra' : 'Phòng chờ · mở cửa' }}</div><h1 class="page-title mb-2">{{ room.name }}</h1><p>{{ game.description }}</p></div><div class="room-header-stats"><div><small>Phí vào bàn</small><strong>{{ room.entry_fee ? formatCoins(room.entry_fee) : 'Miễn phí' }}</strong></div><div><small>Thời lượng</small><strong>{{ game.duration }}</strong></div><div><small>Người xem</small><strong><i class="bi bi-eye me-1"></i>{{ spectators }}</strong></div></div></div>

    <div class="room-grid-layout mt-4">
      <main>
        <section class="table-shell glass-panel">
          <div class="table-toolbar"><div class="table-label"><span class="table-light"></span><strong>{{ game.name }}</strong><small>· {{ game.players }}</small></div><div class="table-toolbar-actions"><span class="turn-chip"><i class="bi bi-lightning-charge-fill"></i> Bàn cân bằng</span><button class="icon-button"><i class="bi bi-three-dots"></i></button></div></div>
          <div class="felt-table" :class="game.category"><div class="felt-glow"></div><div class="felt-brand"><span>LuNu</span><small>PLAY WITH INTENT</small></div><div class="table-center-info"><div class="pot-label">{{ game.category === 'cards' ? 'POT HIỆN TẠI' : 'TRẠNG THÁI BÀN' }}</div><strong>{{ game.category === 'cards' ? '2.450 xu' : room.status === 'RUNNING' ? 'ĐANG CHƠI' : 'SẴN SÀNG' }}</strong><small>{{ room.status === 'RUNNING' ? 'Ván #24 · vòng quyết định' : 'Đợi chủ bàn bắt đầu' }}</small></div><div class="table-surface-decoration"><span></span><i class="bi bi-diamond-fill"></i><span></span></div>
            <div v-for="(seat, index) in seats" :key="index" class="seat-position" :class="[`seat-${index + 1}`, { empty: !seat, mine: seat?.id === authStore.profile?.id }]">
              <div v-if="seat" class="player-seat"><div class="player-avatar-wrap"><img :src="seat.avatar_url || `https://api.dicebear.com/9.x/shapes/svg?seed=${seat.username || seat.display_name}`" :alt="seat.display_name"><span v-if="seat.isOwner" class="crown"><i class="bi bi-star-fill"></i></span></div><strong>{{ seat.display_name }}</strong><small>{{ seat.isOwner ? 'Chủ bàn' : `Ghế ${index + 1}` }}</small></div>
              <button v-else @click="takeSeat" class="empty-seat"><i class="bi bi-plus-lg"></i><span>Ghế trống</span><small>Chọn chỗ</small></button>
            </div>
          </div>
          <div class="table-footer"><div class="table-footer-stat"><i class="bi bi-people-fill"></i><span><strong>{{ players.length }}/{{ room.max_players }}</strong><small>ghế đã chọn</small></span></div><div class="table-footer-stat"><i class="bi bi-eye"></i><span><strong>{{ spectators }}</strong><small>đang xem</small></span></div><div class="table-footer-note"><i class="bi bi-info-circle"></i> Khi bàn đầy, người mới vào sẽ tự động ở chế độ xem.</div></div>
        </section>

        <section class="room-control-row mt-3"><div class="ready-state"><span class="ready-check"><i class="bi bi-check-lg"></i></span><div><strong>{{ isFull ? 'Bàn đã đủ người' : `${room.max_players - players.length} ghế đang mở` }}</strong><small>{{ isFull ? 'Bạn có thể theo dõi trực tiếp từ khu vực khán giả.' : 'Ghế được giữ theo thứ tự người chọn.' }}</small></div></div><button v-if="currentUserIsOwner || room.id.startsWith('demo-')" @click="handleStartGame" class="btn btn-gold px-4" :disabled="isStarting || (players.length < game.minPlayers)"><span v-if="isStarting" class="spinner-border spinner-border-sm me-2"></span><i v-else class="bi bi-play-fill me-1"></i>{{ players.length < game.minPlayers ? `Đợi đủ ${game.minPlayers} người` : 'Bắt đầu ván' }}</button><span v-else class="waiting-owner"><i class="bi bi-hourglass-split me-2"></i>Chờ chủ bàn bắt đầu</span></section>

        <section class="guide-panel glass-panel mt-3"><div class="guide-header"><div><div class="eyebrow">How to play</div><h2>Hướng dẫn {{ game.name }}</h2></div><span class="guide-tag"><i class="bi bi-book me-1"></i> Luật riêng của bàn</span></div><div class="guide-content"><div class="guide-tabs"><button v-for="(_, index) in game.howToPlay" :key="index" :class="{active: activeGuide === index}" @click="activeGuide = index"><span>0{{ index + 1 }}</span>{{ index === 0 ? 'Bắt đầu' : index === 1 ? 'Trong ván' : 'Kết thúc' }}</button></div><div class="guide-step"><span class="step-number">0{{ activeGuide + 1 }}</span><div><h3>{{ game.howToPlay[activeGuide] }}</h3><p>{{ game.rules[activeGuide] || game.rules[0] }}</p></div></div></div></section>
      </main>

      <aside class="room-side"><ChatBox :channelId="`ROOM_${room.id}`" title="BÀN CHAT" /><section class="side-rules glass-panel"><div class="rules-heading"><div><div class="eyebrow">Table rules</div><h2>Luật & tiền</h2></div><i class="bi bi-receipt-cutoff text-gold"></i></div><div class="rule-list"><div><span>Phí vào bàn</span><strong>{{ room.entry_fee ? formatCoins(room.entry_fee) : '0 xu' }}</strong></div><div><span>Cơ chế bàn</span><strong>Luân phiên ghế</strong></div><div><span>Luật kết toán</span><strong>{{ game.fee }}</strong></div><div><span>Người mới</span><strong>{{ isFull ? 'Chỉ xem' : 'Có thể chọn ghế' }}</strong></div></div><div class="rule-callout"><i class="bi bi-shield-lock"></i><span>LuNu khóa hành động và kết quả theo từng ván để mọi giao dịch đều rõ ràng.</span></div></section></aside>
    </div>
  </div>
</template>

<style scoped>
.room-page{padding-top:25px}.room-topline{display:flex;align-items:center;gap:15px}.back-link{border:0;background:transparent;color:var(--gv-text-muted);font-size:.72rem;font-weight:700;padding:0}.back-link:hover{color:var(--gv-primary)}.room-breadcrumb{color:var(--gv-text-dim);font-size:.65rem}.room-breadcrumb span{margin:0 7px;color:#42544e}.room-top-actions{display:flex;align-items:center;gap:12px;margin-left:auto}.secure-label{color:var(--gv-accent-success);font-size:.62rem}.realtime-status{display:flex;align-items:center;gap:5px}.realtime-status.connecting{color:var(--gv-accent-warning)}.realtime-status.reconnecting,.realtime-status.channel_error,.realtime-status.timed_out{color:#ef9a9e}.status-signal{width:6px;height:6px;border-radius:50%;background:currentColor;box-shadow:0 0 0 4px rgba(98,213,163,.1)}.room-top-actions .icon-button{width:31px;height:31px}.room-top-actions .danger-icon{color:#ef9a9e;border-color:rgba(239,127,133,.2)}.room-header{display:flex;align-items:flex-end;justify-content:space-between;gap:25px}.room-header p{color:var(--gv-text-muted);font-size:.76rem;margin:0}.room-header-stats{display:flex;gap:27px;padding-bottom:3px}.room-header-stats div{min-width:80px}.room-header-stats small,.room-header-stats strong{display:block}.room-header-stats small{color:var(--gv-text-dim);font-size:.57rem;margin-bottom:6px}.room-header-stats strong{font-size:.78rem}.room-grid-layout{display:grid;grid-template-columns:minmax(0,1fr) 292px;gap:18px}.table-shell{overflow:hidden;border-radius:22px}.table-toolbar{display:flex;justify-content:space-between;align-items:center;padding:13px 17px;border-bottom:1px solid rgba(255,255,255,.06)}.table-label,.table-toolbar-actions{display:flex;align-items:center;gap:8px}.table-label strong{font-size:.74rem}.table-label small{color:var(--gv-text-muted);font-size:.62rem}.table-light{width:7px;height:7px;border-radius:50%;background:var(--gv-accent-success);box-shadow:0 0 0 4px rgba(98,213,163,.1)}.turn-chip{color:var(--gv-primary);border:1px solid rgba(214,173,98,.16);border-radius:999px;padding:5px 9px;background:rgba(214,173,98,.06);font-size:.57rem;font-weight:700}.turn-chip i{margin-right:4px}.felt-table{position:relative;min-height:525px;margin:20px;border:10px solid #162a24;border-radius:35px;background:radial-gradient(ellipse at 50% 45%,#1e5747 0%,#164437 40%,#0f3029 100%);box-shadow:inset 0 0 0 1px rgba(224,193,122,.28),inset 0 0 70px rgba(0,0,0,.34),0 15px 22px rgba(0,0,0,.2);overflow:hidden}.felt-table::before{content:'';position:absolute;inset:12px;border:1px solid rgba(225,195,128,.17);border-radius:25px;pointer-events:none}.felt-glow{position:absolute;inset:0;background:radial-gradient(circle at 50% 45%,rgba(112,230,191,.08),transparent 38%)}.felt-brand{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;color:rgba(226,194,117,.24);font-family:'Playfair Display',serif;font-size:1.8rem;letter-spacing:.06em}.felt-brand small{font:500 .42rem 'DM Mono',monospace;letter-spacing:.22em}.table-center-info{position:absolute;top:45%;left:50%;transform:translate(-50%,-50%);text-align:center}.table-center-info .pot-label{color:rgba(231,211,164,.62);font-size:.5rem;letter-spacing:.18em}.table-center-info strong{display:block;color:#f4d78e;font:700 1.05rem 'DM Mono',monospace;margin:5px 0}.table-center-info small{color:rgba(203,226,212,.55);font-size:.58rem}.table-surface-decoration{position:absolute;top:35%;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:12px;color:rgba(232,204,136,.5)}.table-surface-decoration span{width:54px;height:1px;background:linear-gradient(90deg,transparent,rgba(232,204,136,.4))}.table-surface-decoration span:last-child{transform:scaleX(-1)}.table-surface-decoration i{font-size:.5rem}.seat-position{position:absolute;z-index:2}.seat-1{top:20px;left:50%;transform:translateX(-50%)}.seat-2{top:28%;right:16px}.seat-3{bottom:18%;right:16px}.seat-4{bottom:18%;left:16px}.seat-5{top:28%;left:16px}.seat-6{bottom:6px;left:50%;transform:translateX(-50%)}.seat-7{top:8%;right:24%}.seat-8{top:8%;left:24%}.seat-9{bottom:6%;right:24%}.player-seat{display:flex;flex-direction:column;align-items:center;min-width:78px}.player-avatar-wrap{position:relative}.player-avatar-wrap img{width:41px;height:41px;border-radius:13px;border:2px solid rgba(225,195,128,.65);background:#193a31}.player-seat strong{max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#eaf0e7;font-size:.61rem;margin-top:5px}.player-seat small{color:rgba(216,226,216,.52);font-size:.52rem;margin-top:2px}.crown{position:absolute;top:-8px;right:-8px;display:grid;place-items:center;width:17px;height:17px;color:#17211d;border-radius:6px;background:var(--gv-primary);font-size:.5rem}.empty-seat{display:flex;flex-direction:column;align-items:center;justify-content:center;width:72px;height:70px;border:1px dashed rgba(223,203,151,.34);border-radius:15px;color:rgba(224,221,195,.75);background:rgba(4,27,22,.17);font-size:.62rem}.empty-seat:hover{border-color:var(--gv-primary);color:var(--gv-primary);background:rgba(214,173,98,.08);transform:scale(1.03)}.empty-seat i{font-size:1rem;margin-bottom:2px}.empty-seat small{color:rgba(205,224,212,.45);font-size:.5rem;margin-top:3px}.table-footer{display:flex;align-items:center;gap:25px;padding:13px 20px;border-top:1px solid rgba(255,255,255,.06)}.table-footer-stat{display:flex;align-items:center;gap:8px;color:var(--gv-secondary)}.table-footer-stat>i{font-size:.9rem}.table-footer-stat strong,.table-footer-stat small{display:block}.table-footer-stat strong{font-size:.7rem;color:var(--gv-text-main)}.table-footer-stat small{font-size:.55rem;color:var(--gv-text-muted)}.table-footer-note{margin-left:auto;color:var(--gv-text-dim);font-size:.59rem}.room-control-row{display:flex;align-items:center;justify-content:space-between;padding:14px 3px}.ready-state{display:flex;align-items:center;gap:10px}.ready-check{display:grid;place-items:center;width:29px;height:29px;color:#12211b;border-radius:9px;background:var(--gv-accent-success);font-size:.8rem}.ready-state strong,.ready-state small{display:block}.ready-state strong{font-size:.7rem}.ready-state small{color:var(--gv-text-muted);font-size:.58rem;margin-top:3px}.waiting-owner{color:var(--gv-text-muted);font-size:.68rem}.guide-panel{padding:19px}.guide-header{display:flex;justify-content:space-between;align-items:flex-start}.guide-header h2{font-size:1rem;font-weight:800;margin:6px 0 0}.guide-tag{color:var(--gv-text-muted);font-size:.58rem;padding:6px 8px;border:1px solid rgba(255,255,255,.08);border-radius:8px}.guide-content{display:flex;gap:18px;margin-top:18px}.guide-tabs{display:flex;flex-direction:column;gap:5px;width:160px}.guide-tabs button{display:flex;align-items:center;gap:8px;padding:8px;border:0;border-radius:9px;text-align:left;color:var(--gv-text-muted);background:transparent;font-size:.62rem}.guide-tabs button.active,.guide-tabs button:hover{color:var(--gv-primary);background:rgba(214,173,98,.08)}.guide-tabs button span{font:500 .56rem 'DM Mono',monospace;color:var(--gv-text-dim)}.guide-step{display:flex;gap:13px;flex:1;padding:13px;border-radius:12px;background:rgba(255,255,255,.03)}.step-number{color:var(--gv-primary);font:500 .85rem 'DM Mono',monospace}.guide-step h3{font-size:.74rem;font-weight:800;margin:0 0 6px}.guide-step p{color:var(--gv-text-muted);font-size:.63rem;line-height:1.55;margin:0}.room-side{display:flex;flex-direction:column;gap:15px}.room-side :deep(.chat-box),.room-side :deep(.glass-panel){border-radius:20px!important}.side-rules{padding:19px}.rules-heading{display:flex;align-items:flex-start;justify-content:space-between}.rules-heading h2{font-size:1rem;font-weight:800;margin-top:6px}.rule-list{margin:18px 0}.rule-list div{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:.62rem}.rule-list span{color:var(--gv-text-muted)}.rule-list strong{font-size:.62rem}.rule-callout{display:flex;gap:8px;padding:10px;border-radius:10px;color:var(--gv-text-muted);background:rgba(214,173,98,.06);font-size:.58rem;line-height:1.5}.rule-callout i{color:var(--gv-primary)}
@media(max-width:1100px){.room-grid-layout{grid-template-columns:1fr}.room-side{display:grid;grid-template-columns:1fr 1fr}.felt-table{min-height:480px}}@media(max-width:700px){.room-topline .room-breadcrumb,.secure-label{display:none}.room-header{display:block}.room-header-stats{margin-top:20px;gap:20px}.room-header-stats div{min-width:auto}.room-grid-layout,.room-side{display:block}.room-side{margin-top:15px}.felt-table{margin:12px;min-height:430px;border-width:7px}.seat-7,.seat-8,.seat-9{display:none}.seat-2{right:5px}.seat-3{right:5px}.seat-4{left:5px}.seat-5{left:5px}.table-footer{gap:14px;flex-wrap:wrap}.table-footer-note{width:100%;margin-left:0}.room-control-row{align-items:flex-start;gap:12px}.guide-content{display:block}.guide-tabs{width:auto;flex-direction:row;margin-bottom:10px}.guide-tabs button{flex:1;justify-content:center}.guide-tabs button span{display:none}}
</style>

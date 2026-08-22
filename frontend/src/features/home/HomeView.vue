<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { useWalletStore } from '@/stores/wallet.store';
import { useRoomStore } from '@/stores/room.store';
import { DEMO_ROOMS, GAME_BY_ID, GAME_CATALOG } from '@/data/games';

const router = useRouter();
const authStore = useAuthStore();
const walletStore = useWalletStore();
const roomStore = useRoomStore();
const featuredGames = computed(() => GAME_CATALOG.filter((game) => game.featured).slice(0, 4));
const liveRooms = computed(() => roomStore.rooms.length ? roomStore.rooms.filter((room: any) => room.status === 'RUNNING').slice(0, 3) : import.meta.env.VITE_DEMO_MODE === 'true' ? DEMO_ROOMS.filter((room) => room.status === 'RUNNING') : []);
const firstName = computed(() => (authStore.profile?.display_name || 'bạn').split(' ')[0]);

onMounted(() => { walletStore.fetchBalance(); roomStore.fetchRooms().then(() => roomStore.subscribeToLobby()).catch(() => undefined); });
onUnmounted(() => roomStore.unsubscribeFromLobby());

const enterRoom = (roomId: string) => router.push(`/room/${roomId}`);
</script>

<template>
  <div class="page-frame home-page">
    <section class="hero-panel mb-4">
      <img src="@/assets/boardgame-hero.webp" alt="Không gian câu lạc bộ LuNu" class="hero-art">
      <div class="hero-overlay"></div>
      <div class="hero-copy">
        <div class="eyebrow mb-3"><span class="live-dot"></span> Câu lạc bộ đang mở cửa</div>
        <h1 class="display-serif">Chào mừng trở lại,<br><span>{{ firstName }}</span>.</h1>
        <p>Chọn một bàn chơi. Gặp những người cùng gu. Tạo nên ván đấu đáng nhớ.</p>
        <div class="hero-actions mt-4">
          <router-link to="/rooms" class="btn btn-gold px-4 py-2"><i class="bi bi-controller me-2"></i>Khám phá sảnh game</router-link>
          <button class="btn btn-quiet px-4 py-2" @click="router.push('/rooms?create=1')"><i class="bi bi-plus-lg me-2"></i>Tạo phòng riêng</button>
        </div>
      </div>
      <div class="hero-stamp d-none d-md-flex"><span>LuNu</span><small>EST. 2026 · PLAY WITH INTENT</small></div>
    </section>

    <div class="row g-4">
      <div class="col-xl-8">
        <section class="section-block">
          <div class="section-heading"><div><div class="eyebrow">Tuyển chọn hôm nay</div><h2 class="page-title mb-0">Bàn chơi nổi bật</h2></div><router-link to="/rooms" class="section-link">Xem tất cả <i class="bi bi-arrow-up-right"></i></router-link></div>
          <div class="row g-3 mt-1">
            <div v-for="game in featuredGames" :key="game.id" class="col-md-6">
              <router-link :to="`/rooms?game=${game.id}`" class="game-feature-card">
                <div class="game-icon" :style="{ color: game.accent, background: `${game.accent}18` }"><i :class="`bi ${game.icon}`"></i></div>
                <div class="flex-grow-1"><div class="d-flex justify-content-between gap-2"><h3>{{ game.name }}</h3><span class="game-arrow"><i class="bi bi-arrow-up-right"></i></span></div><p>{{ game.description }}</p><div class="game-meta"><span><i class="bi bi-people me-1"></i>{{ game.players }}</span><span><i class="bi bi-clock me-1"></i>{{ game.duration }}</span></div></div>
              </router-link>
            </div>
          </div>
        </section>

        <section class="section-block mt-5">
          <div class="section-heading"><div><div class="eyebrow">Đang diễn ra</div><h2 class="page-title mb-0">Bàn đang nóng</h2></div><router-link to="/rooms" class="section-link">Vào sảnh <i class="bi bi-arrow-right"></i></router-link></div>
          <div class="table-list mt-3">
            <div v-for="room in liveRooms" :key="room.id" class="table-row">
              <div class="table-game-icon" :style="{ color: GAME_BY_ID[room.game_id]?.accent }"><i :class="`bi ${GAME_BY_ID[room.game_id]?.icon}`"></i></div>
              <div class="table-name"><strong>{{ room.name }}</strong><small>{{ GAME_BY_ID[room.game_id]?.name || room.game_id }} · Chủ bàn {{ room.ownerName || room.owner?.display_name || 'Người chơi' }}</small></div>
              <div class="table-occupancy"><span class="live-dot"></span>{{ room.occupied ?? room.player_count ?? 0 }}/{{ room.max_players }} chỗ</div>
              <div class="table-viewers"><i class="bi bi-eye me-1"></i>{{ room.spectators ?? room.spectator_count ?? 0 }}</div>
              <button @click="enterRoom(room.id)" class="btn btn-sm btn-quiet">Xem bàn</button>
            </div>
          </div>
        </section>
      </div>

      <div class="col-xl-4">
        <section class="balance-card glass-panel mb-4">
          <div class="d-flex align-items-start justify-content-between"><div><div class="eyebrow">Ví của bạn</div><div class="balance-caption">Số dư khả dụng</div></div><div class="wallet-mark"><i class="bi bi-wallet2"></i></div></div>
          <div class="balance-amount">{{ walletStore.balance.toLocaleString('vi-VN') }} <small>xu</small></div>
          <div class="balance-line"><span>Phí bàn đã dùng tháng này</span><strong>1.240 xu</strong></div>
          <div class="progress-track"><span style="width: 36%"></span></div>
          <div class="d-flex gap-2 mt-3"><router-link to="/wallet-history" class="btn btn-sm btn-gold flex-grow-1">Quản lý ví</router-link><button class="btn btn-sm btn-quiet"><i class="bi bi-plus-lg"></i></button></div>
        </section>

        <section class="club-status glass-panel">
          <div class="d-flex align-items-center justify-content-between mb-3"><div><div class="eyebrow">Hồ sơ câu lạc bộ</div><h3 class="mini-title">Thành tích mùa này</h3></div><div class="rank-badge">#24</div></div>
          <div class="profile-mini"><img :src="authStore.profile?.avatar_url || `https://api.dicebear.com/9.x/shapes/svg?seed=${authStore.profile?.username || 'lunu'}&backgroundColor=193a31`" alt="Avatar"><div><strong>{{ authStore.profile?.display_name || 'Người chơi LuNu' }}</strong><small>Hạng Bạch Kim · Lv {{ authStore.profile?.level || 12 }}</small></div><i class="bi bi-chevron-right ms-auto text-muted"></i></div>
          <div class="club-stats"><div><strong>68%</strong><small>Tỷ lệ thắng</small></div><div><strong>42</strong><small>Ván đã chơi</small></div><div><strong>08</strong><small>Huy hiệu</small></div></div>
          <div class="next-reward"><div class="d-flex justify-content-between small mb-2"><span>Tiến độ huy hiệu</span><strong class="text-gold">72%</strong></div><div class="progress-track"><span style="width: 72%"></span></div><small class="text-muted d-block mt-2">Thắng thêm 3 ván để mở khóa “Người đọc vị”.</small></div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-page { padding-top: 30px; }
.hero-panel { position:relative; min-height: 370px; overflow:hidden; border:1px solid rgba(214,173,98,.16); border-radius: 26px; background:#0a1715; box-shadow:var(--glass-shadow); }
.hero-art { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:center; opacity:.88; }
.hero-overlay { position:absolute; inset:0; background:linear-gradient(90deg, #081310 0%, rgba(8,19,16,.92) 26%, rgba(8,19,16,.42) 60%, rgba(8,19,16,.15)); }
.hero-copy { position:relative; z-index:1; max-width:550px; padding: 58px 50px; }
.hero-copy h1 { color:var(--gv-text-main); font-size: clamp(2.1rem, 5vw, 3.55rem); line-height:1.04; letter-spacing:-.055em; margin:0; }
.hero-copy h1 span { color:var(--gv-primary-hover); }
.hero-copy p { color:#b4c2bc; font-size:.9rem; line-height:1.7; max-width:410px; margin-top:18px; }
.hero-actions { display:flex; gap:10px; flex-wrap:wrap; }
.live-dot { display:inline-block; width:7px; height:7px; margin-right:7px; border-radius:50%; background:var(--gv-accent-success); box-shadow:0 0 0 4px rgba(98,213,163,.1); }
.hero-stamp { position:absolute; z-index:1; right:40px; bottom:28px; flex-direction:column; align-items:center; color:rgba(232,194,117,.75); transform:rotate(-8deg); }
.hero-stamp span { font-family:'Playfair Display',serif; font-size:1.5rem; border:1px solid rgba(232,194,117,.45); border-radius:50%; padding:8px 17px; }
.hero-stamp small { font-size:.46rem; letter-spacing:.18em; margin-top:6px; }
.section-heading { display:flex; align-items:flex-end; justify-content:space-between; gap:12px; }
.section-link { color:var(--gv-primary); font-size:.72rem; font-weight:800; white-space:nowrap; }
.section-link:hover { color:var(--gv-primary-hover); }
.game-feature-card { display:flex; gap:14px; min-height:138px; padding:19px; border:1px solid rgba(255,255,255,.07); border-radius:18px; background:linear-gradient(145deg, rgba(26,51,45,.7), rgba(13,28,25,.65)); transition:transform .2s ease,border-color .2s ease,background .2s ease; }
.game-feature-card:hover { transform:translateY(-3px); border-color:rgba(214,173,98,.32); background:linear-gradient(145deg, rgba(32,63,55,.82), rgba(13,28,25,.78)); }
.game-icon { width:42px; height:42px; flex:0 0 auto; display:grid; place-items:center; border-radius:13px; font-size:1.1rem; }
.game-feature-card h3 { font-size:.95rem; font-weight:800; margin:2px 0 5px; }
.game-feature-card p { color:var(--gv-text-muted); font-size:.7rem; line-height:1.55; margin:0 0 13px; }
.game-arrow { color:var(--gv-text-dim); font-size:.8rem; }
.game-meta { display:flex; gap:13px; color:var(--gv-text-dim); font-size:.62rem; font-weight:600; }
.table-list { display:flex; flex-direction:column; gap:7px; }
.table-row { display:flex; align-items:center; gap:13px; padding:12px 14px; border:1px solid rgba(255,255,255,.06); border-radius:14px; background:rgba(255,255,255,.025); }
.table-row:hover { border-color:rgba(214,173,98,.25); }
.table-game-icon { width:34px; height:34px; display:grid; place-items:center; border-radius:10px; background:rgba(255,255,255,.05); font-size:.95rem; }
.table-name { min-width:0; flex:1; }.table-name strong,.table-name small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.table-name strong { font-size:.75rem; }.table-name small { color:var(--gv-text-muted); font-size:.62rem; margin-top:3px; }
.table-occupancy,.table-viewers { color:var(--gv-text-muted); font-size:.65rem; white-space:nowrap; }.table-viewers { color:var(--gv-text-dim); }
.balance-card, .club-status { padding:22px; }.balance-caption { color:var(--gv-text-muted); font-size:.75rem; margin-top:7px; }.wallet-mark { color:var(--gv-primary); width:34px;height:34px;display:grid;place-items:center;border:1px solid rgba(214,173,98,.2);border-radius:11px;background:rgba(214,173,98,.08); }.balance-amount { margin:25px 0 18px; font-size:2rem; font-weight:800; letter-spacing:-.06em; }.balance-amount small { color:var(--gv-primary); font-size:.72rem; font-weight:700; letter-spacing:0; }.balance-line { display:flex; justify-content:space-between; color:var(--gv-text-muted); font-size:.63rem; }.balance-line strong { color:var(--gv-text-main); }.progress-track { height:5px; margin-top:8px; overflow:hidden; border-radius:10px; background:#223631; }.progress-track span { display:block; height:100%; border-radius:inherit; background:linear-gradient(90deg,var(--gv-secondary),var(--gv-primary)); }
.mini-title { font-size:1rem; font-weight:800; margin:6px 0 0; }.rank-badge { color:#17211d; background:var(--gv-primary); border-radius:10px; padding:7px 9px; font:500 .72rem 'DM Mono',monospace; }.profile-mini { display:flex; align-items:center; gap:10px; padding:13px 0; border-top:1px solid rgba(255,255,255,.07); border-bottom:1px solid rgba(255,255,255,.07); }.profile-mini img { width:37px;height:37px;border-radius:12px;background:#193a31;border:1px solid rgba(214,173,98,.25); }.profile-mini strong,.profile-mini small { display:block; }.profile-mini strong { font-size:.76rem; }.profile-mini small { color:var(--gv-text-muted);font-size:.62rem;margin-top:3px; }.club-stats { display:flex; justify-content:space-between; padding:18px 0; }.club-stats div { text-align:center; flex:1; border-right:1px solid rgba(255,255,255,.07); }.club-stats div:last-child { border:0; }.club-stats strong,.club-stats small { display:block; }.club-stats strong { font-size:1rem; }.club-stats small { color:var(--gv-text-muted);font-size:.59rem;margin-top:4px; }.next-reward { padding:14px; border-radius:13px; background:rgba(255,255,255,.03); }.next-reward .small { color:var(--gv-text-muted);font-size:.63rem; }
@media (max-width: 767px) { .hero-copy { padding:42px 26px; }.hero-copy p { font-size:.8rem; }.table-occupancy,.table-viewers { display:none; }.table-row { gap:9px; } }
</style>

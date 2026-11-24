<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { useWalletStore } from './stores/wallet.store';
import ToastViewport from './components/ToastViewport.vue';
import ConfirmDialog from './components/ConfirmDialog.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const walletStore = useWalletStore();

const isGuestRoute = computed(() => ['Login', 'PracticeLobby', 'GameArena'].includes(String(route.name)));
const displayName = computed(() => authStore.profile?.display_name || 'Khách quý');
const username = computed(() => authStore.profile?.username || 'guest');
const avatar = computed(() => authStore.profile?.avatar_url || `https://api.dicebear.com/9.x/shapes/svg?seed=${username.value}&backgroundColor=193a31`);

const pageNames: Record<string, string> = {
  RoomsLobby: 'Sảnh game',
  RoomDetail: 'Phòng chơi',
  Profile: 'Hồ sơ cá nhân',
  AdminDashboard: 'Quản trị hệ thống',
  MatchHistory: 'Lịch sử ván',
  Leaderboard: 'Bảng xếp hạng',
  WalletHistory: 'Ví và giao dịch',
};
const pageLabel = computed(() => pageNames[String(route.name)] || 'Tổng quan');

watch([isGuestRoute, () => authStore.isAuthenticated], ([standalone, signedIn]) => {
  if (!standalone && signedIn) void walletStore.fetchBalance();
}, { immediate: true });

const logout = async () => {
  await authStore.logout();
  router.push('/login');
};
</script>

<template>
  <div class="app-shell">
    <ToastViewport />
    <ConfirmDialog />
    <template v-if="isGuestRoute">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in"><component :is="Component" v-if="Component" /></transition>
      </router-view>
    </template>

    <template v-else>
      <aside class="sidebar d-none d-lg-flex flex-column">
        <router-link to="/" class="brand-mark mb-5">
          <span class="brand-glyph"><i class="bi bi-diamond-half"></i></span>
          <span><strong>LuNu</strong><small>Board Game Club</small></span>
        </router-link>
        <div class="sidebar-label">Không gian chơi</div>
        <nav class="sidebar-nav">
          <router-link to="/" class="sidebar-link" exact-active-class="active"><i class="bi bi-grid-1x2-fill"></i><span>Tổng quan</span></router-link>
          <router-link to="/rooms" class="sidebar-link" active-class="active"><i class="bi bi-controller"></i><span>Sảnh game</span></router-link>
          <router-link to="/wallet-history" class="sidebar-link" active-class="active"><i class="bi bi-wallet2"></i><span>Ví & giao dịch</span></router-link>
          <router-link v-if="authStore.profile?.role === 'SUPER_ADMIN' || authStore.profile?.role === 'ADMIN'" to="/admin" class="sidebar-link" active-class="active"><i class="bi bi-shield-lock"></i><span>Quản trị hệ thống</span><span class="admin-tag">ADMIN</span></router-link>
        </nav>
        <nav class="sidebar-nav mt-4" aria-label="Thành tích và luyện tập">
          <router-link to="/match-history" class="sidebar-link" active-class="active"><i class="bi bi-clock-history" aria-hidden="true"></i><span>Lịch sử ván</span></router-link>
          <router-link to="/leaderboard" class="sidebar-link" active-class="active"><i class="bi bi-trophy" aria-hidden="true"></i><span>Bảng xếp hạng</span></router-link>
          <router-link to="/practice" class="sidebar-link"><i class="bi bi-mortarboard"></i><span>Sảnh luyện tập</span></router-link>
        </nav>
        <div class="sidebar-spacer"></div>
        <button @click="logout" class="sidebar-link border-0 bg-transparent text-start mt-3"><i class="bi bi-box-arrow-left"></i><span>Đăng xuất</span></button>
      </aside>

      <main class="main-content">
        <header class="topbar">
          <div class="d-lg-none"><router-link to="/" class="brand-mark"><span class="brand-glyph"><i class="bi bi-diamond-half"></i></span><span><strong>LuNu</strong></span></router-link></div>
          <div class="topbar-context d-none d-md-flex"><span class="context-dot"></span><span>LuNu Club</span><span class="context-divider">/</span><span>{{ pageLabel }}</span></div>
          <div class="topbar-actions ms-auto">
            <router-link to="/match-history" class="mobile-results d-lg-none" aria-label="Lịch sử ván"><i class="bi bi-clock-history" aria-hidden="true"></i></router-link>
            <router-link to="/leaderboard" class="mobile-results d-lg-none" aria-label="Bảng xếp hạng"><i class="bi bi-trophy" aria-hidden="true"></i></router-link>
            <div class="top-wallet"><i class="bi bi-coin"></i><strong>{{ walletStore.balance.toLocaleString('vi-VN') }}</strong><small>xu</small></div>
            <router-link to="/profile" class="profile-chip"><img :src="avatar" :alt="displayName"><div class="d-none d-sm-block"><strong>{{ displayName }}</strong><small>@{{ username }}</small></div><i class="bi bi-chevron-down text-muted small"></i></router-link>
          </div>
        </header>
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in"><component :is="Component" v-if="Component" /></transition>
        </router-view>
      </main>
    </template>
  </div>
</template>

<style scoped>
.sidebar { position: fixed; z-index: 10; inset: 0 auto 0 0; width: 248px; padding: 28px 18px 20px; border-right: 1px solid rgba(255,255,255,.07); background: rgba(6, 17, 15, .85); backdrop-filter: blur(20px); }
.main-content { min-height: 100vh; margin-left: 248px; }
.topbar { height: 78px; display: flex; align-items: center; padding: 0 38px; border-bottom: 1px solid rgba(255,255,255,.06); background: rgba(7,16,15,.55); backdrop-filter: blur(16px); position: relative; z-index: 5; }
.brand-mark { display: inline-flex; align-items: center; gap: 10px; color: var(--gv-text-main); letter-spacing: -.03em; }
.brand-mark strong { display:block; font-size: 1.18rem; font-weight: 800; line-height:1; }
.brand-mark small { display:block; margin-top: 4px; color: var(--gv-text-muted); font-size:.55rem; letter-spacing:.14em; text-transform:uppercase; }
.brand-glyph { width: 33px; height: 33px; display:grid; place-items:center; color:#19211d; background:linear-gradient(135deg,#f0cc82,#ae7f3e); border-radius: 10px 3px 10px 3px; transform:rotate(45deg); }
.brand-glyph i { transform:rotate(-45deg); font-size: 1.05rem; }
.sidebar-label { color: #566862; font-size: .63rem; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; padding: 0 14px 10px; }
.sidebar-nav { display:flex; flex-direction:column; gap: 5px; }
.sidebar-link { position:relative; display:flex; align-items:center; gap: 12px; color: var(--gv-text-muted); border-radius: 12px; padding: 11px 14px; font-size: .84rem; font-weight: 600; }
.sidebar-link i { font-size: 1rem; width: 18px; text-align:center; }
.sidebar-link:hover, .sidebar-link.active { color: var(--gv-text-main); background: linear-gradient(90deg, rgba(214,173,98,.14), rgba(214,173,98,.03)); }
.sidebar-link.active::before { content:''; position:absolute; left:-18px; top: 10px; bottom: 10px; width:3px; border-radius:4px; background:var(--gv-primary); }
.nav-ping { margin-left:auto; color:#14211d; background:var(--gv-secondary); border-radius:999px; padding: 2px 7px; font-size:.62rem; font-weight:800; }
.admin-tag { margin-left:auto; color:var(--gv-primary); font:500 .48rem 'DM Mono',monospace; letter-spacing:.06em; }
.sidebar-spacer { flex:1; }
.club-card { padding: 14px; border: 1px solid rgba(214,173,98,.2); border-radius: 15px; background: linear-gradient(145deg, rgba(214,173,98,.12), rgba(214,173,98,.03)); }
.club-card p { color: var(--gv-text-muted); font-size: .68rem; line-height:1.55; margin: 0 0 12px; }
.topbar-context { color: var(--gv-text-muted); font-size: .76rem; font-weight: 600; }
.context-dot { width:7px; height:7px; border-radius:50%; background:var(--gv-accent-success); box-shadow:0 0 0 4px rgba(98,213,163,.1); }
.context-divider { color:#3f504b; margin: 0 8px; }
.mobile-results { display:inline-grid; place-items:center; width:38px; height:38px; border:1px solid #ffffff24; border-radius:9px; color:var(--gv-primary-hover); }
.mobile-results[aria-current="page"] { border-color:var(--gv-primary); background:#d6ad6220; }
.topbar-actions { display:flex; align-items:center; gap: 14px; }
.icon-button { position:relative; width:36px; height:36px; border:1px solid rgba(255,255,255,.08); border-radius:10px; color:var(--gv-text-muted); background:rgba(255,255,255,.03); }
.icon-button:hover { color:var(--gv-primary); border-color:rgba(214,173,98,.35); }
.icon-button span { position:absolute; width:5px; height:5px; right:8px; top:7px; background:#ef7f85; border-radius:50%; }
.top-wallet { display:flex; align-items:baseline; gap:5px; padding: 7px 12px; border-left:1px solid rgba(255,255,255,.08); color:var(--gv-primary); }
.top-wallet i { font-size:.84rem; }
.top-wallet strong { color:var(--gv-text-main); font-size:.84rem; }
.top-wallet small { color:var(--gv-text-muted); font-size:.65rem; }
.profile-chip { display:flex; align-items:center; gap:8px; padding-left: 8px; }
.profile-chip img { width:33px; height:33px; border-radius:10px; background:#193a31; border:1px solid rgba(214,173,98,.35); }
.profile-chip strong, .profile-chip small { display:block; line-height:1.25; }
.profile-chip strong { font-size:.74rem; }
.profile-chip small { color:var(--gv-text-muted); font-size:.6rem; }
@media (max-width: 991px) { .main-content { margin-left:0; } .topbar { padding: 0 16px; } .topbar-actions { gap:9px; } }
@media (max-width: 370px) { .top-wallet { padding:5px; } .profile-chip { padding-left:0; } .profile-chip > i { display:none; } }
</style>

import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';

const routes: Array<RouteRecordRaw> = [
  { path: '/login', name: 'Login', component: () => import('@/features/auth/LoginView.vue'), meta: { requiresGuest: true } },
  { path: '/', name: 'Home', component: () => import('@/features/home/HomeView.vue'), meta: { requiresAuth: true } },
  { path: '/admin', name: 'AdminDashboard', component: () => import('@/features/admin/AdminUsersView.vue'), meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/wallet-history', name: 'WalletHistory', component: () => import('@/features/wallet/WalletHistoryView.vue'), meta: { requiresAuth: true } },
  { path: '/profile', name: 'Profile', component: () => import('@/features/profile/ProfileView.vue'), meta: { requiresAuth: true } },
  { path: '/match-history', name: 'MatchHistory', component: () => import('@/features/results/MatchHistoryView.vue'), meta: { requiresAuth: true } },
  { path: '/leaderboard', name: 'Leaderboard', component: () => import('@/features/results/LeaderboardView.vue'), meta: { requiresAuth: true } },
  { path: '/rooms', name: 'RoomsLobby', component: () => import('@/features/rooms/RoomsView.vue'), meta: { requiresAuth: true } },
  { path: '/room/:id', name: 'RoomDetail', component: () => import('@/features/rooms/RoomDetailView.vue'), meta: { requiresAuth: true } },
  { path: '/practice', name: 'PracticeLobby', component: () => import('@/features/games/PracticeLobby.vue') },
  { path: '/game/:sessionId', name: 'GameArena', component: () => import('@/features/games/GameSessionView.vue'), meta: { requiresAuth: true } }
];

const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore();
  await authStore.initialize();

  const isAuth = authStore.isAuthenticated;
  const role = authStore.profile?.role;
  if (to.meta.requiresAuth && !isAuth && !(to.name === 'GameArena' && String(to.params.sessionId).startsWith('demo-'))) next({ name: 'Login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } });
  else if (to.meta.requiresGuest && isAuth) next({ name: 'Home' });
  else if (to.meta.requiresAdmin && role !== 'SUPER_ADMIN' && role !== 'ADMIN') next({ name: 'Home' });
  else next();
});

export default router;

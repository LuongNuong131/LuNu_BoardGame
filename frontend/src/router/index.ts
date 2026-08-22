import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';

const routes: Array<RouteRecordRaw> = [
  { path: '/login', name: 'Login', component: () => import('@/features/auth/LoginView.vue'), meta: { requiresGuest: true } },
  { path: '/', name: 'Home', component: () => import('@/features/home/HomeView.vue'), meta: { requiresAuth: true } },
  { path: '/admin', name: 'AdminDashboard', component: () => import('@/features/admin/AdminUsersView.vue'), meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/wallet-history', name: 'WalletHistory', component: () => import('@/features/wallet/WalletHistoryView.vue'), meta: { requiresAuth: true } },
  { path: '/rooms', name: 'RoomsLobby', component: () => import('@/features/rooms/RoomsView.vue'), meta: { requiresAuth: true } },
  { path: '/room/:id', name: 'RoomDetail', component: () => import('@/features/rooms/RoomDetailView.vue'), meta: { requiresAuth: true } },
  { path: '/game/:sessionId', name: 'GameUNO', component: () => import('@/features/games/uno/UnoBoardView.vue'), meta: { requiresAuth: true } }
];

const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();
  if (!authStore.isAuthenticated) await authStore.initialize();
  const isAuth = authStore.isAuthenticated;
  const role = authStore.profile?.role;

  if (to.meta.requiresAuth && !isAuth) next({ name: 'Login' });
  else if (to.meta.requiresGuest && isAuth) next({ name: 'Home' });
  else if (to.meta.requiresAdmin && role !== 'SUPER_ADMIN' && role !== 'ADMIN') next({ name: 'Home' });
  else next();
});
export default router;
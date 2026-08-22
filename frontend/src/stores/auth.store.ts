import { defineStore } from 'pinia';
import { apiClient } from '@/services/api/apiClient';
import { prepareRealtimeAuth, supabase } from '@/services/supabase/client';

let initializePromise: Promise<boolean> | null = null;

export const useAuthStore = defineStore('auth', {
  state: () => ({
    profile: null as any | null,
    isAuthenticated: false,
    initialized: false,
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async login(username: string, password: string) {
      this.loading = true;
      this.error = null;
      try {
        const response: any = await apiClient.post('/auth/login', { username, password });
        if (response.success && response.data.session) {
          const { access_token, refresh_token } = response.data.session;
          await supabase.auth.setSession({ access_token, refresh_token });
          await prepareRealtimeAuth();
          await this.fetchMe();
          this.initialized = true;
          return true;
        }
        this.error = 'Đăng nhập thất bại. Vui lòng kiểm tra thông tin.';
        return false;
      } catch (err: any) {
        this.error = err.message || 'Đăng nhập thất bại. Vui lòng thử lại.';
        return false;
      } finally { this.loading = false; }
    },

    async fetchMe() {
      try {
        const response: any = await apiClient.get('/auth/me');
        if (response.success) {
          this.profile = response.data;
          this.isAuthenticated = true;
          this.error = null;
          return true;
        }
      } catch (error: any) {
        this.profile = null;
        if (error?.code === 'NETWORK_ERROR') {
          this.isAuthenticated = true;
          this.error = 'Đang chờ kết nối máy chủ. Phiên đăng nhập vẫn được giữ.';
          return false;
        }
        this.isAuthenticated = false;
        await supabase.auth.signOut();
      }
      return false;
    },

    async logout() {
      try { await apiClient.post('/auth/logout'); } catch { /* local session cleanup must still complete */ }
      await supabase.auth.signOut();
      this.profile = null;
      this.isAuthenticated = false;
      this.initialized = true;
    },

    async initialize() {
      if (this.initialized) return this.isAuthenticated;
      if (initializePromise) return initializePromise;
      initializePromise = (async () => {
        try {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            let session = data.session;
            if (session.expires_at && session.expires_at * 1000 < Date.now() + 30_000) {
              const refreshed = await supabase.auth.refreshSession();
              session = refreshed.data.session || session;
            }
            if (session.access_token) supabase.realtime.setAuth(session.access_token);
            await this.fetchMe();
          } else {
            this.profile = null;
            this.isAuthenticated = false;
          }
          return this.isAuthenticated;
        } finally {
          this.initialized = true;
          initializePromise = null;
        }
      })();
      return initializePromise;
    }
  }
});

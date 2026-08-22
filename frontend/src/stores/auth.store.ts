import { defineStore } from 'pinia';
import { apiClient } from '@/services/api/apiClient';
import { supabase } from '@/services/supabase/client';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    profile: null as any | null,
    isAuthenticated: false,
    loading: false,
    error: null as string | null,
  }),
  
  actions: {
    async login(username: string, password: string) {
      this.loading = true;
      this.error = null;
      try {
        // 1. Gọi Backend API để lấy session
        const response: any = await apiClient.post('/auth/login', { username, password });
        
        if (response.success && response.data.session) {
          // 2. Gắn token vào Supabase Client của Frontend để API Interceptor tự lấy gửi đi
          const { access_token, refresh_token } = response.data.session;
          await supabase.auth.setSession({ access_token, refresh_token });
          
          // 3. Lấy thông tin Profile
          await this.fetchMe();
          return true;
        }
      } catch (err: any) {
        this.error = err.message || 'Đăng nhập thất bại. Vui lòng thử lại.';
        return false;
      } finally {
        this.loading = false;
      }
    },

    async fetchMe() {
      try {
        const response: any = await apiClient.get('/auth/me');
        if (response.success) {
          this.profile = response.data;
          this.isAuthenticated = true;
        }
      } catch (error) {
        this.profile = null;
        this.isAuthenticated = false;
        await supabase.auth.signOut();
      }
    },

    async logout() {
      await apiClient.post('/auth/logout');
      await supabase.auth.signOut();
      this.profile = null;
      this.isAuthenticated = false;
    },
    
    // Hàm này chạy 1 lần khi app khởi động để check session cũ
    async initialize() {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        await this.fetchMe();
      }
    }
  }
});
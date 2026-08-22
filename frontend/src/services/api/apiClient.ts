import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { prepareRealtimeAuth, supabase } from '../supabase/client';

type RetryConfig = InternalAxiosRequestConfig & { _authRetried?: boolean };

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
});

apiClient.interceptors.request.use(async (config) => {
  const session = await prepareRealtimeAuth();
  const token = session?.access_token;
  if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, (error) => Promise.reject(error));

apiClient.interceptors.response.use(
  (response) => response.data,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined;
    if (error.response?.status === 401 && config && !config._authRetried) {
      config._authRetried = true;
      const refreshed = await supabase.auth.refreshSession();
      const token = refreshed.data.session?.access_token;
      if (token) {
        await prepareRealtimeAuth();
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
        return apiClient.request(config);
      }
    }
    const customError = (error.response?.data as any)?.error || { code: 'NETWORK_ERROR', message: error.message || 'Không thể kết nối máy chủ.' };
    return Promise.reject(customError);
  }
);

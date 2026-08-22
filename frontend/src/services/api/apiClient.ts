import axios from 'axios';
import { supabase } from '../supabase/client';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request Interceptor: Tự động lấy JWT Token từ Supabase nhét vào Header gửi đi
apiClient.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response Interceptor: Chuẩn hóa định dạng lỗi từ Backend trả về
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // Trích xuất mã lỗi chuẩn AppError từ Backend
    const customError = error.response?.data?.error || {
      code: 'NETWORK_ERROR',
      message: error.message
    };
    return Promise.reject(customError);
  }
);
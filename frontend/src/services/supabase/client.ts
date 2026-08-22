import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables in frontend. Vui lòng check file .env');
}

// Client logic only. Frontend dùng Anon Key (bị RLS giới hạn quyền lực).
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
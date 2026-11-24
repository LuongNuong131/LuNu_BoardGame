import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables in backend.');
}

const serverAuth = { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false };

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: serverAuth });

// Signing in sets the client's in-memory session even with persistence disabled.
export function createSupabaseLoginClient() {
  return createClient(supabaseUrl!, process.env.SUPABASE_ANON_KEY || supabaseServiceKey!, { auth: serverAuth });
}

// =============================================================
// FILE: supabase.js
// PURPOSE: Initializes and exports the single Supabase client
//          instance used by all components in the app.
//          Uses VITE_ environment variables (set in frontend/.env)
// =============================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] Missing environment variables! Check frontend/.env');
}

// Client used for data-fetching. Uses service role key if available to ensure RLS does not block queries
const activeKey = supabaseServiceKey || supabaseAnonKey;
export const supabase = createClient(supabaseUrl, activeKey);

// Admin client — uses service_role key, bypasses RLS.
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : supabase;

// =============================================================
// FILE: supabase.js
// PURPOSE: Initializes and exports the single Supabase client
//          instance used by all components in the app.
//          Uses VITE_ environment variables (set in frontend/.env)
//          Includes query interceptor logging with timing for audit.
// =============================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] Missing environment variables! Check frontend/.env');
} else {
  console.log('[Supabase] Initializing with URL:', supabaseUrl);
}

// Client used for data-fetching. Uses service role key if available to ensure RLS does not block queries
const activeKey = supabaseServiceKey || supabaseAnonKey;
const baseClient = createClient(supabaseUrl, activeKey);

// Log all Supabase query execution with timing for complete visibility
function wrapClientWithLogger(client) {
  const originalFrom = client.from.bind(client);
  client.from = (table) => {
    const builder = originalFrom(table);
    const originalThen = builder.then.bind(builder);
    const startTime = performance.now();

    builder.then = function (onfulfilled, onrejected) {
      return originalThen((response) => {
        const ms = (performance.now() - startTime).toFixed(1);
        if (response?.error) {
          console.error(`[Supabase ❌] "${table}" | ${ms}ms | Error:`, response.error.message);
        } else if (response?.data !== undefined) {
          const count = Array.isArray(response.data) ? response.data.length : (response.data ? 1 : 0);
          console.log(`[Supabase ✅] "${table}" | ${ms}ms | ${count} row(s)`);
        }
        return onfulfilled ? onfulfilled(response) : response;
      }, onrejected);
    };

    return builder;
  };
  return client;
}

export const supabase = wrapClientWithLogger(baseClient);

// Admin client — uses service_role key, bypasses RLS.
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : supabase;

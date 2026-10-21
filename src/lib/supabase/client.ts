import { createBrowserClient } from '@supabase/ssr'

/**
 * Cookie-backed Supabase client for the browser (singleton).
 * Sessions are stored in cookies so `proxy.ts` and server code can read them.
 * Safe to import from client components; on the server it is only evaluated,
 * never used for requests (server code uses `createServerSupabase`).
 */
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

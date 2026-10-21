'use client'

import { supabase } from '@/app/lib/supabase'

/**
 * `fetch` that attaches the current Supabase access token as a Bearer header.
 * Every call to our own /api/* routes must go through this.
 */
export async function authedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const headers = new Headers(init.headers ?? {})
  if (token && !headers.has('authorization')) headers.set('Authorization', `Bearer ${token}`)
  return fetch(input, { ...init, headers })
}

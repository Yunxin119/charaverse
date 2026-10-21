import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { log } from '@/lib/log'

export interface RateLimitRule { bucket: string; limit: number; windowSeconds: number }

export const RATE_LIMITS = {
  chat: { bucket: 'chat', limit: 30, windowSeconds: 60 },
  summary: { bucket: 'summary', limit: 6, windowSeconds: 60 },
  connectionTest: { bucket: 'conn-test', limit: 12, windowSeconds: 60 },
} satisfies Record<string, RateLimitRule>

// per-instance fallback when the RPC is unavailable (e.g. migration not applied yet)
const local = new Map<string, { window: number; count: number }>()

/**
 * Returns null when the request may proceed, or a 429 response.
 * Uses the DB-backed fixed window (consume_rate_limit); falls back to an in-memory
 * counter if the RPC fails so a missing migration never blocks the app.
 */
export async function enforceRateLimit(supabase: SupabaseClient, userId: string, rule: RateLimitRule): Promise<NextResponse | null> {
  let allowed = true
  let resetAt: string | undefined
  try {
    const { data, error } = await supabase.rpc('consume_rate_limit', {
      p_bucket: rule.bucket, p_limit: rule.limit, p_window_seconds: rule.windowSeconds,
    })
    if (error) throw error
    const r = (Array.isArray(data) ? data[0] : data) as { allowed?: boolean; reset_at?: string } | null
    if (r && typeof r.allowed === 'boolean') {
      allowed = r.allowed
      resetAt = r.reset_at
    }
  } catch (e) {
    log.warn('rate-limit rpc unavailable, using local counter', { bucket: rule.bucket, reason: e instanceof Error ? e.message : 'unknown' })
    const key = `${userId}:${rule.bucket}`
    const win = Math.floor(Date.now() / 1000 / rule.windowSeconds)
    const cur = local.get(key)
    if (!cur || cur.window !== win) local.set(key, { window: win, count: 1 })
    else { cur.count += 1; allowed = cur.count <= rule.limit }
    if (local.size > 5000) local.clear()
  }
  if (allowed) return null
  const retry = resetAt ? Math.max(1, Math.ceil((new Date(resetAt).getTime() - Date.now()) / 1000)) : rule.windowSeconds
  return NextResponse.json(
    { error: `请求太频繁了，请 ${retry} 秒后再试` },
    { status: 429, headers: { 'Retry-After': String(retry) } }
  )
}

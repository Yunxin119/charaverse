import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { requireUser } from '@/lib/server/auth'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/server/rateLimit'
import { GuardError, summarizeUpstreamError } from '@/lib/server/llmGuards'
import { CONNECTION_HEADER, decodeConnection } from '@/lib/llm/connection'
import { resolveModel } from '@/lib/llm/providers'

export const runtime = 'nodejs'
export const maxDuration = 30

/** Ping a connection with a tiny completion; returns latency or a safe error. */
export async function POST(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  const limited = await enforceRateLimit(auth.supabase, auth.user.id, RATE_LIMITS.connectionTest)
  if (limited) return limited
  const conn = decodeConnection(request.headers.get(CONNECTION_HEADER))
  if (!conn) return NextResponse.json({ error: '连接信息不合法' }, { status: 400 })

  const started = Date.now()
  try {
    const { model, label } = resolveModel(conn)
    const r = await generateText({
      model,
      prompt: 'Reply with the single word: pong',
      maxOutputTokens: 8,
      temperature: 0,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(20_000),
    })
    return NextResponse.json({ ok: true, latencyMs: Date.now() - started, label, sample: r.text.slice(0, 40) })
  } catch (error) {
    if (error instanceof GuardError) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    const e = error as { statusCode?: number; responseBody?: string; name?: string; message?: string }
    let msg = 'AI 调用失败'
    if (typeof e?.statusCode === 'number') msg = summarizeUpstreamError(e.statusCode, e.responseBody ?? '')
    else if (e?.name === 'TimeoutError' || e?.name === 'AbortError') msg = '连接超时（20s）'
    else if (/fetch failed|ENOTFOUND|ECONNREFUSED/i.test(e?.message ?? '')) msg = '无法连接到该地址'
    return NextResponse.json({ ok: false, error: msg, latencyMs: Date.now() - started })
  }
}

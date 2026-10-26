import { NextRequest, NextResponse } from 'next/server'
import { streamText, type ModelMessage } from 'ai'
import { z } from 'zod'
import { requireUser } from '@/lib/server/auth'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/server/rateLimit'
import { GuardError, summarizeUpstreamError } from '@/lib/server/llmGuards'
import { CONNECTION_HEADER, decodeConnection } from '@/lib/llm/connection'
import { needsUserLast, resolveModel } from '@/lib/llm/providers'
import { loadPreset } from '@/lib/chat/loadContext'
import { parseCharacterCard } from '@/lib/chat/characterCard'
import { parseLorebook } from '@/lib/lorebook/schema'
import { activateLorebooks } from '@/lib/lorebook/activate'
import { assemble } from '@/lib/prompt/assemble'

/**
 * 「试聊」 for the character editor: run one reply against an UNSAVED draft card.
 * Nothing is persisted; the client keeps the scratch conversation and sends it back each turn.
 * Same auth, connection header, SSRF guard and rate limit as /api/chat.
 */

export const runtime = 'nodejs'
export const maxDuration = 120

const bodySchema = z.object({
  character: z.object({
    name: z.string().min(1).max(200),
    prompt_template: z.record(z.string(), z.unknown()),
    lorebook: z.unknown().optional(),
  }),
  /** scratch history, oldest first; empty + opening=true → the character speaks first */
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(8000) })).max(30),
  opening: z.boolean().optional(),
  presetId: z.string().uuid().nullable().optional(),
  userName: z.string().max(60).optional(),
})
const MAX_TEMPLATE_CHARS = 200_000

export async function POST(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  const { user, supabase } = auth
  const limited = await enforceRateLimit(supabase, user.id, RATE_LIMITS.chat)
  if (limited) return limited

  const conn = decodeConnection(request.headers.get(CONNECTION_HEADER))
  if (!conn) return NextResponse.json({ error: '没有可用的模型连接，请先在设置里配置 API' }, { status: 400 })

  let body: z.infer<typeof bodySchema>
  try {
    const raw = await request.json()
    if (JSON.stringify(raw?.character?.prompt_template ?? {}).length > MAX_TEMPLATE_CHARS) throw new Error('too large')
    body = bodySchema.parse(raw)
  } catch {
    return NextResponse.json({ error: '请求参数不合法' }, { status: 400 })
  }
  const opening = !!body.opening && body.messages.length === 0
  if (!opening && body.messages[body.messages.length - 1]?.role !== 'user') {
    return NextResponse.json({ error: '最后一条需要是用户消息' }, { status: 400 })
  }

  try {
    const { model } = resolveModel(conn)
    const card = parseCharacterCard({ name: body.character.name, prompt_template: body.character.prompt_template })
    const preset = await loadPreset(supabase, user.id, body.presetId ?? null)
    const userName = body.userName?.trim() || card.userName

    const lb = parseLorebook(body.character.lorebook)
    const books = lb.ok && lb.book.entries.length > 0 ? [lb.book] : []
    const history = body.messages
    const lore = books.length ? activateLorebooks({ books, recent: history }) : null

    const assembled = assemble({
      preset,
      character: {
        name: card.name, description: card.description, personality: card.personality,
        age: card.age, gender: card.gender, scenario: card.scenario, modules: card.modules,
      },
      user: { name: userName, persona: card.persona },
      worldInfo: lore ? { before: lore.before, after: lore.after } : undefined,
      dialogueExamples: card.exampleDialogue,
      history,
      ensureUserLast: opening || needsUserLast(conn),
      continueUserMessage: opening ? '【现在请你作为角色主动开始对话，根据设定和初始情景开场。】' : undefined,
    })

    const sampling = assembled.sampling
    const result = streamText({
      model,
      instructions: assembled.instructions || undefined,
      messages: assembled.messages as ModelMessage[],
      allowSystemInMessages: true,
      temperature: sampling.temperature ?? 1,
      topP: sampling.top_p,
      topK: sampling.top_k,
      frequencyPenalty: sampling.frequency_penalty,
      presencePenalty: sampling.presence_penalty,
      maxOutputTokens: Math.min(sampling.max_tokens ?? 2048, 4096),
      abortSignal: request.signal,
      maxRetries: 1,
    })
    return result.toUIMessageStreamResponse({ onError: (err) => describeError(err), sendReasoning: false })
  } catch (error) {
    if (error instanceof GuardError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('[api/chat/preview] unexpected:', error instanceof Error ? error.name : 'unknown')
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
  }
}

function describeError(err: unknown): string {
  const e = err as { name?: string; statusCode?: number; responseBody?: string; message?: string }
  if (e?.name === 'AbortError' || e?.name === 'TimeoutError') return '生成已停止'
  if (typeof e?.statusCode === 'number') return summarizeUpstreamError(e.statusCode, e.responseBody ?? '')
  const msg = typeof e?.message === 'string' ? e.message : ''
  if (/api key|unauthorized|401/i.test(msg)) return 'API Key 无效或已过期'
  if (/rate|429/i.test(msg)) return '请求过于频繁，请稍后再试'
  return 'AI 调用失败，请检查连接设置后重试'
}

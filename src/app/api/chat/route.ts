import { NextRequest, NextResponse } from 'next/server'
import { streamText, type ModelMessage } from 'ai'
import { z } from 'zod'
import { requireUser } from '@/lib/server/auth'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/server/rateLimit'
import { GuardError, summarizeUpstreamError } from '@/lib/server/llmGuards'
import { CONNECTION_HEADER, decodeConnection } from '@/lib/llm/connection'
import { needsUserLast, resolveModel } from '@/lib/llm/providers'
import { loadChatContext, ContextError } from '@/lib/chat/loadContext'
import { assemble, trimHistory } from '@/lib/prompt/assemble'
import { activateLorebooks } from '@/lib/lorebook/activate'

/**
 * Streaming chat endpoint (AI SDK UI message stream).
 *
 * Headers: Authorization: Bearer <supabase jwt>; x-cv-connection: base64url(JSON Connection)
 * Body:    { sessionId, action, text?, messageId? }
 *   send       – persist `text` as a user message, stream the reply, persist it
 *   opening    – no user text; the character speaks first; persist the reply
 *   regenerate – re-roll the last assistant message; the reply is appended as a new swipe
 *   continue   – extend the last assistant message
 *   inspire    – suggest what the user could say next (not persisted)
 * History, card, memories, summaries and the preset are loaded server-side; the
 * client never sends the conversation.
 */

export const runtime = 'nodejs'
export const maxDuration = 120

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  action: z.enum(['send', 'opening', 'regenerate', 'continue', 'inspire']),
  text: z.string().max(20000).optional(),
  messageId: z.number().int().positive().optional(),
})

const CONTINUE_MSG = '【请直接接着你上一条回复继续写，不要重复已有内容，不要加开场白。】'
const inspireMsg = (charName: string, userName: string) =>
  `现在请你跳出"${charName}"的角色。如果你是"${userName}"，面对上一条消息你会怎么回复？用第一人称直接写出这句回复本身，不要解释，不要开场白。`

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
    body = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: '请求参数不合法' }, { status: 400 })
  }
  if (body.action === 'send' && !body.text?.trim()) {
    return NextResponse.json({ error: '消息不能为空' }, { status: 400 })
  }

  try {
    const { model, label } = resolveModel(conn)
    const ctx = await loadChatContext(supabase, body.sessionId, user.id)
    const { card, preset, session } = ctx
    const userName = session.settings.userName || card.userName

    // ---- figure out the history slice for this action ----
    let history = ctx.history.filter((m) => m.role !== 'system')
    let userMessageId: number | undefined
    let targetId: number | undefined // regenerate / continue target

    if (body.action === 'send') {
      const { data: inserted, error } = await supabase
        .from('chat_messages')
        .insert({ session_id: session.id, role: 'user', content: body.text!.trim(), type: 'message' })
        .select('id, role, content, created_at')
        .single()
      if (error || !inserted) throw new ContextError(500, '保存消息失败')
      userMessageId = inserted.id
      history = [...history, inserted]
    } else if (body.action === 'regenerate') {
      const last = [...history].reverse().find((m) => m.role === 'assistant')
      if (!last) throw new ContextError(400, '没有可以重新生成的回复')
      if (body.messageId && body.messageId !== last.id) throw new ContextError(400, '只能重新生成最后一条回复')
      targetId = last.id
      history = history.filter((m) => m.id !== last.id)
    } else if (body.action === 'continue') {
      const last = history[history.length - 1]
      if (!last || last.role !== 'assistant') throw new ContextError(400, '只能续写最后一条 AI 回复')
      targetId = last.id
    }

    const { kept } = trimHistory(
      history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { maxTokens: session.settings.context.maxTokens, keepRecent: session.settings.context.keepRecent }
    )

    const extraUserMessage =
      body.action === 'continue' ? CONTINUE_MSG : body.action === 'inspire' ? inspireMsg(card.name, userName) : undefined

    const lore = ctx.lorebooks.length
      ? activateLorebooks({ books: ctx.lorebooks, recent: kept, extraText: body.action === 'send' ? body.text : undefined })
      : null

    const assembled = assemble({
      preset,
      character: {
        name: card.name, description: card.description, personality: card.personality,
        age: card.age, gender: card.gender, scenario: card.scenario, modules: card.modules,
      },
      user: { name: userName, persona: card.persona },
      memoryTable: ctx.memoryTable,
      summaries: ctx.summaries,
      worldInfo: lore ? { before: lore.before, after: lore.after } : undefined,
      dialogueExamples: card.exampleDialogue,
      history: kept,
      ensureUserLast: !!extraUserMessage || needsUserLast(conn) || body.action === 'opening',
      continueUserMessage:
        extraUserMessage ?? (body.action === 'opening' ? '【现在请你作为角色主动开始对话，根据设定和初始情景开场。】' : undefined),
    })

    // ---- stream ----
    let partial = ''
    const persist = async (text: string, finishReason: string, aborted: boolean) => {
      const content = text.trim()
      if (!content || body.action === 'inspire') return
      const meta = { model: label, finishReason, aborted, presetName: preset.name, at: new Date().toISOString() }
      if (body.action === 'regenerate' && targetId) {
        await supabase.rpc('append_message_swipe', { p_message_id: targetId, p_content: content, p_meta: meta })
      } else if (body.action === 'continue' && targetId) {
        const prev = ctx.history.find((m) => m.id === targetId)?.content ?? ''
        const joined = prev.endsWith('\n') || content.startsWith('\n') ? prev + content : `${prev}\n${content}`
        await supabase.from('chat_messages').update({ content: joined, meta }).eq('id', targetId)
      } else {
        await supabase.from('chat_messages').insert({ session_id: session.id, role: 'assistant', content, type: 'message', meta })
      }
      await supabase.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', session.id)
    }

    // session overrides win over the preset's sampling
    const sampling = { ...assembled.sampling, ...stripUndefined(session.settings.sampling) }
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
      maxOutputTokens: sampling.max_tokens ?? 4096,
      abortSignal: request.signal,
      maxRetries: 1,
      onChunk({ chunk }) {
        if (chunk.type === 'text-delta') partial += chunk.text
      },
      async onEnd({ text, finishReason }) {
        await persist(text || partial, finishReason, false)
      },
      async onAbort() {
        await persist(partial, 'aborted', true)
      },
    })

    return result.toUIMessageStreamResponse({
      headers: userMessageId ? { 'x-cv-user-message-id': String(userMessageId) } : undefined,
      onError: (err) => describeError(err),
      sendReasoning: false,
    })
  } catch (error) {
    if (error instanceof GuardError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof ContextError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('[api/chat] unexpected:', error instanceof Error ? error.name : 'unknown')
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
  }
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}

/** Short, safe error text for the stream (never the raw upstream body). */
function describeError(err: unknown): string {
  const e = err as { name?: string; statusCode?: number; responseBody?: string; message?: string }
  if (e?.name === 'AbortError' || e?.name === 'TimeoutError') return '生成已停止'
  if (typeof e?.statusCode === 'number') return summarizeUpstreamError(e.statusCode, e.responseBody ?? '')
  const msg = typeof e?.message === 'string' ? e.message : ''
  if (/api key|unauthorized|401/i.test(msg)) return 'API Key 无效或已过期'
  if (/rate|429/i.test(msg)) return '请求过于频繁，请稍后再试'
  return 'AI 调用失败，请检查连接设置后重试'
}

import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/server/auth'
import {
  GuardError,
  MAX_BODY_BYTES,
  assertSafeBaseUrl,
  assertSafeModel,
  summarizeUpstreamError,
} from '@/lib/server/llmGuards'

/**
 * LLM proxy (P0 hardened version; will be replaced by an AI SDK streaming route in P2).
 *
 * Contract (unchanged for existing clients):
 *   POST { messages, systemPrompt, apiKey, model, thinkingBudget?, baseUrl?, actualModel?, customUserMessage? }
 *   -> { content, apiUsed }
 *
 * Security:
 *   - caller must be a signed-in Supabase user (Bearer token)
 *   - relay baseUrl must be a public https host (no IPs / private names / query / creds)
 *   - upstream error bodies are summarized, never echoed
 *   - nothing about keys, prompts or responses is logged
 */

export const runtime = 'nodejs'
export const maxDuration = 60

const UPSTREAM_TIMEOUT_MS = 55_000
const MAX_OUTPUT_TOKENS = 8192

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface ChatRequest {
  messages: ChatMessage[]
  systemPrompt: string
  apiKey?: string
  model: string
  thinkingBudget?: number
  baseUrl?: string
  actualModel?: string
  customUserMessage?: string
}

class UpstreamError extends Error {
  constructor(public provider: string, public status: number, message: string) {
    super(message)
  }
}

function withTimeout(): AbortSignal {
  return AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
}

async function readUpstreamError(provider: string, res: Response): Promise<never> {
  const text = await res.text().catch(() => '')
  throw new UpstreamError(provider, res.status, summarizeUpstreamError(res.status, text))
}

function buildOpenAiMessages(messages: ChatMessage[], systemPrompt: string, customUserMessage?: string) {
  const out: ChatMessage[] = [{ role: 'system', content: systemPrompt }, ...messages]
  if (customUserMessage) out.push({ role: 'user', content: customUserMessage })
  return out
}

// ---------- OpenAI-compatible (OpenAI, DeepSeek, relays) ----------
async function callOpenAiCompatible(opts: {
  provider: string
  endpoint: string
  apiKey: string
  model: string
  messages: ChatMessage[]
  systemPrompt: string
  customUserMessage?: string
  thinkingBudget?: number
}): Promise<string> {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: buildOpenAiMessages(opts.messages, opts.systemPrompt, opts.customUserMessage),
    temperature: 1,
    max_tokens: MAX_OUTPUT_TOKENS,
  }
  // Relays that front Gemini 2.5 accept a thinkingConfig passthrough
  if (opts.model.includes('gemini-2.5') && opts.thinkingBudget !== undefined) {
    body.thinkingConfig = opts.thinkingBudget > 0 ? { thinkingBudget: opts.thinkingBudget } : {}
  }

  const res = await fetch(opts.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
      'User-Agent': 'Charaverse/2.0',
    },
    body: JSON.stringify(body),
    signal: withTimeout(),
  })
  if (!res.ok) await readUpstreamError(opts.provider, res)

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new UpstreamError(opts.provider, 502, 'AI 返回了空响应，可能是内容被过滤')
  }
  return content
}

// ---------- Gemini (native REST) ----------
const GEMINI_SAFETY = [
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  'HARM_CATEGORY_DANGEROUS_CONTENT',
  'HARM_CATEGORY_HATE_SPEECH',
].map((category) => ({ category, threshold: 'BLOCK_ONLY_HIGH' }))

function buildGeminiContents(messages: ChatMessage[], systemPrompt: string, customUserMessage?: string) {
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = []

  // Gemini wants strict user/model alternation; the system prompt goes in as the first user turn.
  if (systemPrompt) {
    contents.push({ role: 'user', parts: [{ text: systemPrompt }] })
    const first = messages[0]
    const ack = first?.role === 'assistant' ? first.content : '我明白了，我会按照这些设定来扮演角色。'
    contents.push({ role: 'model', parts: [{ text: ack }] })
  }
  const rest = systemPrompt && messages[0]?.role === 'assistant' ? messages.slice(1) : messages
  for (const m of rest) {
    if (m.role === 'user') contents.push({ role: 'user', parts: [{ text: m.content }] })
    else if (m.role === 'assistant') contents.push({ role: 'model', parts: [{ text: m.content }] })
  }
  if (contents.length === 0) throw new GuardError('没有可发送的消息')
  if (contents[contents.length - 1].role !== 'user') {
    contents.push({ role: 'user', parts: [{ text: customUserMessage || '【请继续。】' }] })
  }
  return contents
}

async function callGemini(opts: {
  apiKey: string
  model: string
  messages: ChatMessage[]
  systemPrompt: string
  thinkingBudget?: number
  customUserMessage?: string
}): Promise<string> {
  const generationConfig: Record<string, unknown> = {
    temperature: 1.0,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    topP: 0.95,
  }
  if (opts.model.includes('2.5') || opts.model.startsWith('gemini-3')) {
    if (opts.model.includes('pro')) generationConfig.thinkingConfig = {}
    else if (opts.thinkingBudget !== undefined && opts.thinkingBudget >= 0) {
      generationConfig.thinkingConfig = { thinkingBudget: opts.thinkingBudget }
    }
  }
  const body = {
    contents: buildGeminiContents(opts.messages, opts.systemPrompt, opts.customUserMessage),
    generationConfig,
    safetySettings: GEMINI_SAFETY,
  }

  const maxRetries = 2
  for (let attempt = 0; ; attempt++) {
    let res: Response
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': opts.apiKey },
          body: JSON.stringify(body),
          signal: withTimeout(),
        }
      )
    } catch (err) {
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 1000))
        continue
      }
      throw err
    }

    if (!res.ok) {
      if (res.status >= 500 && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 1000))
        continue
      }
      await readUpstreamError('Gemini', res)
    }

    const data = await res.json()
    if (data?.promptFeedback?.blockReason) {
      throw new UpstreamError('Gemini', 422, `请求被 Gemini 拦截：${data.promptFeedback.blockReason}`)
    }
    const candidate = data?.candidates?.[0]
    if (!candidate) throw new UpstreamError('Gemini', 502, 'Gemini 没有返回候选回复')
    if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'BLOCKED_REASON_UNSPECIFIED') {
      throw new UpstreamError('Gemini', 422, '回复被 Gemini 安全过滤拦截')
    }
    if (candidate.finishReason === 'RECITATION') {
      throw new UpstreamError('Gemini', 422, '回复因版权复述问题被拦截')
    }
    const text = (candidate.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? '')
      .join('')
    if (!text.trim()) {
      const reason = candidate.finishReason || 'unknown'
      if (reason === 'MAX_TOKENS') throw new UpstreamError('Gemini', 502, '回复超出长度限制且没有内容返回')
      throw new UpstreamError('Gemini', 502, `Gemini 返回了空内容（${reason}）`)
    }
    return text
  }
}

// ---------- handler ----------
export async function POST(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 })

  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: '请求体过大' }, { status: 413 })
  }

  try {
    const body = (await request.json()) as ChatRequest
    const { messages, systemPrompt, customUserMessage } = body
    const apiKey = body.apiKey?.trim()
    const thinkingBudget = body.thinkingBudget
    let model = body.model?.trim() ?? ''

    if (!Array.isArray(messages) || !systemPrompt?.trim() || !model) {
      return NextResponse.json({ error: '缺少必要参数：messages / systemPrompt / model' }, { status: 400 })
    }
    for (const m of messages) {
      if (!m || typeof m.content !== 'string' || !['user', 'assistant', 'system'].includes(m.role)) {
        return NextResponse.json({ error: 'messages 格式不合法' }, { status: 400 })
      }
    }
    if (!apiKey) {
      return NextResponse.json({ error: '没有可用的 API Key，请在设置中添加' }, { status: 400 })
    }

    let content: string
    let apiUsed: string

    if (model.startsWith('named-relay-')) {
      if (!body.baseUrl || !body.actualModel) {
        return NextResponse.json({ error: '中转配置缺少 baseUrl 或模型名' }, { status: 400 })
      }
      const base = assertSafeBaseUrl(body.baseUrl)
      const actualModel = assertSafeModel(body.actualModel)
      const endpoint = `${base.endsWith('/v1') ? base : `${base}/v1`}/chat/completions`
      content = await callOpenAiCompatible({
        provider: '中转API', endpoint, apiKey, model: actualModel,
        messages, systemPrompt, customUserMessage, thinkingBudget,
      })
      apiUsed = `中转API (${actualModel})`
    } else {
      model = assertSafeModel(model)
      if (model.startsWith('deepseek')) {
        content = await callOpenAiCompatible({
          provider: 'DeepSeek', endpoint: 'https://api.deepseek.com/v1/chat/completions',
          apiKey, model, messages, systemPrompt, customUserMessage,
        })
      } else if (model.startsWith('gemini')) {
        content = await callGemini({ apiKey, model, messages, systemPrompt, thinkingBudget, customUserMessage })
      } else if (model.startsWith('gpt') || model.startsWith('o')) {
        content = await callOpenAiCompatible({
          provider: 'OpenAI', endpoint: 'https://api.openai.com/v1/chat/completions',
          apiKey, model, messages, systemPrompt, customUserMessage,
        })
      } else {
        return NextResponse.json({ error: `不支持的模型：${model}` }, { status: 400 })
      }
      apiUsed = model
    }

    return NextResponse.json({ content, apiUsed })
  } catch (error) {
    if (error instanceof GuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof UpstreamError) {
      console.warn(`[api/chat] upstream ${error.provider} failed: ${error.status}`)
      const status = error.status === 401 || error.status === 403 ? 401 : error.status >= 500 ? 502 : error.status
      return NextResponse.json(
        { error: `${error.provider} 调用失败：${error.message}` },
        { status: status >= 400 && status < 600 ? status : 502 }
      )
    }
    const isTimeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    if (isTimeout) {
      return NextResponse.json({ error: 'AI 响应超时，请重试' }, { status: 504 })
    }
    console.error('[api/chat] unexpected error:', error instanceof Error ? error.name : 'unknown')
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
  }
}

import 'server-only'
import type { LanguageModel } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogle } from '@ai-sdk/google'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createAnthropic } from '@ai-sdk/anthropic'
import { assertSafeBaseUrl, assertSafeModel, GuardError } from '@/lib/server/llmGuards'
import type { Connection } from './connection'

/**
 * Turn a user-supplied connection into an AI SDK model.
 * Every baseUrl passes the SSRF guard; the key is used for this one request only.
 */
export function resolveModel(conn: Connection): { model: LanguageModel; label: string } {
  const modelId = assertSafeModel(conn.model)
  const baseURL = conn.baseUrl ? assertSafeBaseUrl(conn.baseUrl) : undefined

  switch (conn.kind) {
    case 'openai-compatible': {
      if (!baseURL) throw new GuardError('中转连接缺少 baseUrl')
      const base = baseURL.endsWith('/v1') ? baseURL : `${baseURL}/v1`
      const provider = createOpenAICompatible({ name: 'relay', baseURL: base, apiKey: conn.apiKey })
      return { model: provider.chatModel(modelId), label: `${conn.label ?? '中转'} · ${modelId}` }
    }
    case 'openai': {
      const provider = createOpenAI({ apiKey: conn.apiKey, baseURL })
      return { model: provider.chat(modelId), label: `OpenAI · ${modelId}` }
    }
    case 'google': {
      const provider = createGoogle({ apiKey: conn.apiKey, baseURL })
      return { model: provider(modelId), label: `Gemini · ${modelId}` }
    }
    case 'deepseek': {
      const provider = createDeepSeek({ apiKey: conn.apiKey, baseURL })
      return { model: provider(modelId), label: `DeepSeek · ${modelId}` }
    }
    case 'anthropic': {
      const provider = createAnthropic({ apiKey: conn.apiKey, baseURL })
      return { model: provider(modelId), label: `Claude · ${modelId}` }
    }
  }
}

/** Gemini wants the conversation to end on a user turn. */
export function needsUserLast(conn: Connection): boolean {
  return conn.kind === 'google'
}

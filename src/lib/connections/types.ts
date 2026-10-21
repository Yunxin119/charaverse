import { z } from 'zod'
import { connectionKinds } from '@/lib/llm/connection'

/**
 * A saved API connection (plan P4). Lives only in the browser (zustand + localStorage).
 * One connection = one provider endpoint + key + the models you want to use from it.
 */
export const savedConnectionSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(60),
  kind: z.enum(connectionKinds),
  apiKey: z.string().min(1).max(512),
  baseUrl: z.string().max(512).optional(),
  models: z.array(z.string().min(1).max(128)).min(1).max(50),
  /** model used when none is chosen */
  defaultModel: z.string().max(128).optional(),
  enabled: z.boolean().default(true),
  createdAt: z.number().default(() => Date.now()),
  lastTest: z.object({ ok: z.boolean(), at: z.number(), latencyMs: z.number().optional(), error: z.string().optional() }).optional(),
})
export type SavedConnection = z.infer<typeof savedConnectionSchema>

/** `chat_sessions.settings.model` now stores a model ref: `<connectionId>/<model>` (legacy ids are still resolvable). */
export interface ModelRef {
  connectionId: string
  model: string
}

export const MODEL_REF_SEP = '/'

export function formatModelRef(ref: ModelRef): string {
  return `${ref.connectionId}${MODEL_REF_SEP}${ref.model}`
}

export function parseModelRef(s: string | undefined | null): ModelRef | null {
  if (!s) return null
  const i = s.indexOf(MODEL_REF_SEP)
  if (i <= 0) return null
  const connectionId = s.slice(0, i)
  const model = s.slice(i + 1)
  if (!connectionId || !model) return null
  return { connectionId, model }
}

export const KIND_LABEL: Record<SavedConnection['kind'], string> = {
  'openai-compatible': 'OpenAI 兼容 / 中转',
  openai: 'OpenAI',
  google: 'Google Gemini',
  deepseek: 'DeepSeek',
  anthropic: 'Anthropic Claude',
}

export const KIND_DEFAULT_MODELS: Record<SavedConnection['kind'], string[]> = {
  'openai-compatible': [],
  openai: ['gpt-5', 'gpt-5-mini', 'gpt-4.1'],
  google: ['gemini-2.5-flash', 'gemini-2.5-pro'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  anthropic: ['claude-sonnet-4-5', 'claude-opus-4-1'],
}

export const KIND_NEEDS_BASE_URL: Record<SavedConnection['kind'], boolean> = {
  'openai-compatible': true, openai: false, google: false, deepseek: false, anthropic: false,
}

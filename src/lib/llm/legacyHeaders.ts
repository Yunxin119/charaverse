import { CONNECTION_HEADER, decodeConnection, type Connection } from './connection'

/**
 * Build a Connection from either the new `x-cv-connection` header or the legacy
 * `x-api-key` / `x-model` / `x-base-url` / `x-actual-model` headers that the memory
 * and diary pages still send. Remove once those pages are rewritten (P5).
 */
export function connectionFromRequest(headers: Headers): Connection | null {
  const modern = decodeConnection(headers.get(CONNECTION_HEADER))
  if (modern) return modern

  const apiKey = headers.get('x-api-key')?.trim()
  const model = headers.get('x-model')?.trim() || 'deepseek-chat'
  if (!apiKey) return null
  const baseUrl = headers.get('x-base-url')?.trim() || undefined
  const actualModel = headers.get('x-actual-model')?.trim() || undefined

  if (model.startsWith('named-relay-') || baseUrl) {
    if (!baseUrl) return null
    return { kind: 'openai-compatible', apiKey, baseUrl, model: actualModel || model }
  }
  if (model.startsWith('gemini')) return { kind: 'google', apiKey, model }
  if (model.startsWith('deepseek')) return { kind: 'deepseek', apiKey, model }
  if (model.startsWith('claude')) return { kind: 'anthropic', apiKey, model }
  return { kind: 'openai', apiKey, model }
}

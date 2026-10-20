import { z } from 'zod'

/**
 * A "connection" is everything the server needs to call one model on behalf of the user.
 * It travels in the `x-cv-connection` request header (JSON, base64url-encoded) and is never stored server-side.
 */
export const connectionKinds = ['openai-compatible', 'openai', 'google', 'deepseek', 'anthropic'] as const
export type ConnectionKind = (typeof connectionKinds)[number]

export const connectionSchema = z.object({
  kind: z.enum(connectionKinds),
  apiKey: z.string().min(1).max(512),
  /** required for openai-compatible; optional override for the others */
  baseUrl: z.string().max(512).optional(),
  model: z.string().min(1).max(128),
  /** display name, only for UI */
  label: z.string().max(80).optional(),
})
export type Connection = z.infer<typeof connectionSchema>

export const CONNECTION_HEADER = 'x-cv-connection'

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(b64)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeConnection(c: Connection): string {
  return toBase64Url(JSON.stringify(c))
}

export function decodeConnection(header: string | null): Connection | null {
  if (!header) return null
  try {
    const r = connectionSchema.safeParse(JSON.parse(fromBase64Url(header)))
    return r.success ? r.data : null
  } catch {
    return null
  }
}

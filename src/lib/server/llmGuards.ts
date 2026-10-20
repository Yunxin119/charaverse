/**
 * Input guards for the LLM proxy routes.
 * The client supplies its own API key and (for relays) a base URL, so the server must make sure
 * it only ever talks to public HTTPS hosts and never echoes raw upstream bodies back.
 */

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /\.localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /^metadata\.google\.internal$/i,
]

function isIpLiteral(host: string): boolean {
  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true
  // IPv6 (URL.hostname keeps the brackets)
  if (host.startsWith('[') || host.includes(':')) return true
  return false
}

export class GuardError extends Error {
  status = 400
}

/** Returns a normalized `https://host[/path]` with no query, hash or credentials. */
export function assertSafeBaseUrl(raw: string): string {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    throw new GuardError('baseUrl 不是合法的 URL')
  }
  if (url.protocol !== 'https:') throw new GuardError('baseUrl 必须使用 https')
  if (url.username || url.password) throw new GuardError('baseUrl 不能包含账号密码')
  if (url.search || url.hash) throw new GuardError('baseUrl 不能包含查询参数或锚点')
  const host = url.hostname
  if (!host || isIpLiteral(host)) throw new GuardError('baseUrl 不能是 IP 地址')
  if (PRIVATE_HOST_PATTERNS.some((re) => re.test(host))) throw new GuardError('baseUrl 不能指向内部地址')
  if (!host.includes('.')) throw new GuardError('baseUrl 主机名不合法')
  // normalize: strip trailing slash
  return url.origin + url.pathname.replace(/\/+$/, '')
}

const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._:\-/]{0,127}$/

export function assertSafeModel(model: string): string {
  const m = model.trim()
  if (!MODEL_RE.test(m)) throw new GuardError('模型名不合法')
  return m
}

export const MAX_BODY_BYTES = 512 * 1024 // 512 KB of JSON is plenty for a chat window

/**
 * Turn an upstream error response into a short, safe message.
 * Keeps the provider's own `error.message` (users need it to debug their relay/quota),
 * but never the raw body, and never more than ~300 chars.
 */
export function summarizeUpstreamError(status: number, bodyText: string): string {
  let msg = ''
  try {
    const j = JSON.parse(bodyText)
    msg = j?.error?.message ?? j?.message ?? j?.error ?? ''
    if (typeof msg !== 'string') msg = JSON.stringify(msg)
  } catch {
    msg = ''
  }
  msg = msg.replace(/\s+/g, ' ').slice(0, 300)
  return msg ? `HTTP ${status}: ${msg}` : `HTTP ${status}`
}

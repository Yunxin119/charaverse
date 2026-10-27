import { z } from 'zod'

/**
 * Chat log import/export.
 *   - CharaVerse JSON: lossless (title, settings, swipes, timestamps)
 *   - common JSONL: header line { user_name, character_name, create_date } then one message per line
 *     { name, is_user, mes, send_date, swipes?, swipe_id? }
 *   - Markdown: read-only export
 */

export const chatLogMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().max(200_000),
  created_at: z.string().optional(),
  swipes: z.array(z.string().max(200_000)).max(50).optional(),
  swipe_index: z.number().int().min(0).optional(),
})
export const chatLogSchema = z.object({
  format: z.literal('charaverse-chat'),
  version: z.literal(1).default(1),
  title: z.string().max(200).nullable().optional(),
  character: z.object({ name: z.string().max(100), id: z.number().optional() }),
  user_name: z.string().max(60).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  exported_at: z.string().optional(),
  messages: z.array(chatLogMessageSchema).max(20_000),
})
export type ChatLog = z.infer<typeof chatLogSchema>
export type ChatLogMessage = z.infer<typeof chatLogMessageSchema>

export interface ExportInput {
  title?: string | null
  characterName: string
  characterId?: number
  userName?: string
  settings?: Record<string, unknown>
  messages: { role: 'user' | 'assistant' | 'system'; content: string; created_at?: string; swipes?: string[] | null; swipe_index?: number | null }[]
}

export function toChatLog(input: ExportInput): ChatLog {
  return chatLogSchema.parse({
    format: 'charaverse-chat',
    version: 1,
    title: input.title ?? null,
    character: { name: input.characterName, id: input.characterId },
    user_name: input.userName,
    settings: input.settings,
    exported_at: new Date().toISOString(),
    messages: input.messages.map((m) => ({
      role: m.role,
      content: m.content,
      created_at: m.created_at,
      ...(m.swipes && m.swipes.length > 1 ? { swipes: m.swipes, swipe_index: m.swipe_index ?? 0 } : {}),
    })),
  })
}

export function toJsonl(input: ExportInput): string {
  const header = { user_name: input.userName ?? '用户', character_name: input.characterName, create_date: new Date().toISOString(), chat_metadata: {} }
  const lines = input.messages
    .filter((m) => m.role !== 'system')
    .map((m) => JSON.stringify({
      name: m.role === 'user' ? (input.userName ?? '用户') : input.characterName,
      is_user: m.role === 'user',
      mes: m.content,
      send_date: m.created_at ?? '',
      ...(m.swipes && m.swipes.length > 1 ? { swipes: m.swipes, swipe_id: m.swipe_index ?? 0 } : {}),
      extra: {},
    }))
  return [JSON.stringify(header), ...lines].join('\n') + '\n'
}

export interface TextExportOptions {
  /** also write the other rerolls of a message (not just the chosen one) */
  includeSwipes?: boolean
}

/** Alternate replies other than the chosen one, in their original order (empty when there is nothing to show). */
function otherSwipes(m: ExportInput['messages'][number]): { index: number; text: string }[] {
  if (!m.swipes || m.swipes.length < 2) return []
  const chosen = m.swipe_index ?? 0
  return m.swipes.map((text, index) => ({ index, text })).filter((s) => s.index !== chosen)
}

export function toMarkdown(input: ExportInput, opts: TextExportOptions = {}): string {
  const title = input.title?.trim() || `与 ${input.characterName} 的对话`
  const out: string[] = [`# ${title}`, '', `角色：${input.characterName}　用户：${input.userName ?? '用户'}`, '']
  for (const m of input.messages) {
    if (m.role === 'system') continue
    const who = m.role === 'user' ? (input.userName ?? '用户') : input.characterName
    const when = m.created_at ? ` · ${new Date(m.created_at).toLocaleString('zh-CN')}` : ''
    out.push(`## ${who}${when}`, '', m.content.trim(), '')
    if (opts.includeSwipes) {
      for (const s of otherSwipes(m)) {
        out.push(`<details><summary>备选回复 ${s.index + 1}/${m.swipes!.length}</summary>`, '', s.text.trim(), '', '</details>', '')
      }
    }
  }
  return out.join('\n')
}

/** Plain text: `名字：内容` blocks separated by blank lines; easy to paste anywhere. */
export function toPlainText(input: ExportInput, opts: TextExportOptions = {}): string {
  const title = input.title?.trim() || `与 ${input.characterName} 的对话`
  const out: string[] = [title, '']
  for (const m of input.messages) {
    if (m.role === 'system') continue
    const who = m.role === 'user' ? (input.userName ?? '用户') : input.characterName
    out.push(`${who}：`, m.content.trim(), '')
    if (opts.includeSwipes) {
      for (const s of otherSwipes(m)) out.push(`（备选回复 ${s.index + 1}/${m.swipes!.length}）`, s.text.trim(), '')
    }
  }
  return out.join('\n')
}

export interface ImportedChat {
  title: string | null
  characterName: string
  userName?: string
  settings?: Record<string, unknown>
  messages: ChatLogMessage[]
  source: 'charaverse' | 'jsonl'
}

function parseJsonl(text: string): ImportedChat | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return null
  let header: Record<string, unknown>
  try { header = JSON.parse(lines[0]) } catch { return null }
  if (!header || typeof header !== 'object' || !('character_name' in header || 'user_name' in header)) return null
  const messages: ChatLogMessage[] = []
  for (const line of lines.slice(1)) {
    let m: Record<string, unknown>
    try { m = JSON.parse(line) } catch { continue }
    if (typeof m?.mes !== 'string') continue
    const swipes = Array.isArray(m.swipes) ? (m.swipes as unknown[]).filter((s): s is string => typeof s === 'string') : []
    messages.push({
      role: m.is_user ? 'user' : 'assistant',
      content: m.mes,
      created_at: typeof m.send_date === 'string' && !Number.isNaN(Date.parse(m.send_date)) ? new Date(m.send_date).toISOString() : typeof m.send_date === 'number' ? new Date(m.send_date).toISOString() : undefined,
      ...(swipes.length > 1 ? { swipes, swipe_index: typeof m.swipe_id === 'number' ? Math.max(0, Math.min(swipes.length - 1, m.swipe_id)) : 0 } : {}),
    })
  }
  if (!messages.length) return null
  return {
    title: null,
    characterName: typeof header.character_name === 'string' ? header.character_name : '角色',
    userName: typeof header.user_name === 'string' ? header.user_name : undefined,
    messages,
    source: 'jsonl',
  }
}

export function importChatText(text: string): { ok: true; chat: ImportedChat } | { ok: false; error: string } {
  const trimmed = text.trim()
  if (!trimmed) return { ok: false, error: '文件是空的' }
  if (trimmed.startsWith('{') && !trimmed.includes('\n{')) {
    try {
      const raw = JSON.parse(trimmed)
      const r = chatLogSchema.safeParse(raw)
      if (r.success) {
        return { ok: true, chat: { title: r.data.title ?? null, characterName: r.data.character.name, userName: r.data.user_name, settings: r.data.settings, messages: r.data.messages, source: 'charaverse' } }
      }
      // a single-line JSON that is not ours: fall through to jsonl (will fail) for a clean error
    } catch { /* fall through */ }
  }
  const jl = parseJsonl(trimmed)
  if (jl) return { ok: true, chat: jl }
  return { ok: false, error: '不是可识别的聊天记录（支持 CharaVerse JSON 或 JSONL 格式）' }
}

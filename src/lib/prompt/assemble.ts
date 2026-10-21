import { applyMacros } from './macros'
import { estimateMessagesTokens, estimateTokens } from './tokens'
import type { MarkerId, PresetFile } from './presets'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type ChatRole = 'system' | 'user' | 'assistant'

export interface ChatMessageLike {
  role: ChatRole
  content: string
}

export interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AssembleCharacter {
  name: string
  description?: string
  personality?: string
  age?: string
  gender?: string
  scenario?: string
  modules?: { type: string; content: string }[]
  customFields?: Record<string, string>
}

export interface AssembleInput {
  preset: PresetFile
  character: AssembleCharacter
  user: { name: string; persona?: string }
  /** Pre-formatted memory table text; may be empty. */
  memoryTable?: string
  /** Oldest first. */
  summaries?: string[]
  worldInfo?: { before?: string; after?: string }
  dialogueExamples?: string
  /** Oldest first, already trimmed to budget. */
  history: HistoryMessage[]
  /** Append a user message when the final message is not from the user. */
  ensureUserLast?: boolean
  /** Text for that appended user message. */
  continueUserMessage?: string
}

export interface AssembleOutput {
  /** Leading consecutive system entries, joined by "\n\n". */
  instructions: string
  /** Everything after the first non-system entry (system entries inside are allowed). */
  messages: ChatMessageLike[]
  sampling: PresetFile['sampling']
  stats: {
    instructionTokens: number
    messageTokens: number
    droppedMarkers: MarkerId[]
  }
}

export const DEFAULT_CONTINUE_MESSAGE = '【请继续。】'

/* ------------------------------------------------------------------ */
/* Delimiters                                                          */
/* ------------------------------------------------------------------ */

export const MARKER_TAGS: Record<Exclude<MarkerId, 'chatHistory'>, string> = {
  charDescription: 'character_description',
  charPersonality: 'character_personality',
  scenario: 'scenario',
  charModules: 'character_modules',
  personaDescription: 'user_persona',
  memoryTable: 'memory_table',
  summaries: 'story_summaries',
  worldInfoBefore: 'world_info_before',
  worldInfoAfter: 'world_info_after',
  dialogueExamples: 'dialogue_examples',
}

const GENDER_LABELS: Record<string, string> = {
  male: '男',
  female: '女',
  none: '无性别',
  other: '其他',
}

function isBlank(s: string | undefined | null): boolean {
  return !s || s.trim().length === 0
}

/**
 * Wrap data in `<tag>...</tag>`. A literal closing tag inside the data is defanged
 * so untrusted text (memory rows, summaries, world info) cannot close the block early.
 */
export function wrapBlock(tag: string, body: string): string {
  const closeRe = new RegExp(`</\\s*${tag}\\s*>`, 'gi')
  const safe = body.trim().replace(closeRe, `<\\/${tag}>`)
  return `<${tag}>\n${safe}\n</${tag}>`
}

/* ------------------------------------------------------------------ */
/* Marker rendering                                                    */
/* ------------------------------------------------------------------ */

function renderCharDescription(c: AssembleCharacter): string {
  if (isBlank(c.description) && isBlank(c.age) && isBlank(c.gender)) return ''
  const lines: string[] = [`名字：${c.name}`]
  if (!isBlank(c.gender)) {
    const g = c.gender!.trim()
    lines.push(`性别：${GENDER_LABELS[g] ?? g}`)
  }
  if (!isBlank(c.age)) lines.push(`年龄：${c.age!.trim()}`)
  if (!isBlank(c.description)) lines.push(c.description!.trim())
  return lines.join('\n')
}

function renderCharModules(c: AssembleCharacter): string {
  const parts: string[] = []
  for (const m of c.modules ?? []) {
    if (isBlank(m.content)) continue
    const type = isBlank(m.type) ? '自定义模块' : m.type.trim()
    parts.push(`【${type}】\n${m.content.trim()}`)
  }
  for (const [key, value] of Object.entries(c.customFields ?? {})) {
    if (isBlank(key) || isBlank(value)) continue
    parts.push(`【${key.trim()}】\n${value.trim()}`)
  }
  return parts.join('\n\n')
}

function renderPersona(user: AssembleInput['user']): string {
  if (isBlank(user.persona)) return ''
  return `名字：${user.name}\n${user.persona!.trim()}`
}

function renderSummaries(summaries: string[] | undefined): string {
  const items = (summaries ?? []).filter((s) => !isBlank(s))
  if (items.length === 0) return ''
  return items.map((s, i) => `[${i + 1}] ${s.trim()}`).join('\n\n')
}

/** Returns the raw (unwrapped) body for a non-history marker, or '' when there is no data. */
function markerBody(id: Exclude<MarkerId, 'chatHistory'>, input: AssembleInput): string {
  switch (id) {
    case 'charDescription':
      return renderCharDescription(input.character)
    case 'charPersonality':
      return input.character.personality?.trim() ?? ''
    case 'scenario':
      return input.character.scenario?.trim() ?? ''
    case 'charModules':
      return renderCharModules(input.character)
    case 'personaDescription':
      return renderPersona(input.user)
    case 'memoryTable':
      return input.memoryTable?.trim() ?? ''
    case 'summaries':
      return renderSummaries(input.summaries)
    case 'worldInfoBefore':
      return input.worldInfo?.before?.trim() ?? ''
    case 'worldInfoAfter':
      return input.worldInfo?.after?.trim() ?? ''
    case 'dialogueExamples':
      return input.dialogueExamples?.trim() ?? ''
  }
}

/* ------------------------------------------------------------------ */
/* Assembly                                                            */
/* ------------------------------------------------------------------ */

interface AbsoluteInjection {
  depth: number
  message: ChatMessageLike
}

export function assemble(input: AssembleInput): AssembleOutput {
  const { preset, history } = input
  const macroCtx = { char: input.character.name, user: input.user.name }
  const mac = (text: string) => applyMacros(text, macroCtx)

  const droppedMarkers: MarkerId[] = []
  const before: ChatMessageLike[] = []
  const after: ChatMessageLike[] = []
  const absolute: AbsoluteInjection[] = []
  let historyAnchorSeen = false

  const sink = () => (historyAnchorSeen ? after : before)

  for (const prompt of preset.prompts) {
    if (!prompt.enabled) continue

    if (prompt.marker) {
      const id = prompt.id as MarkerId
      if (id === 'chatHistory') {
        if (!historyAnchorSeen) {
          historyAnchorSeen = true
          if (history.length === 0) droppedMarkers.push('chatHistory')
        }
        continue
      }
      const body = mac(markerBody(id, input))
      if (isBlank(body)) {
        droppedMarkers.push(id)
        continue
      }
      sink().push({ role: 'system', content: wrapBlock(MARKER_TAGS[id], body) })
      continue
    }

    const content = mac(prompt.content)
    if (isBlank(content)) continue

    if (prompt.injection?.position === 'absolute') {
      absolute.push({
        depth: prompt.injection.depth,
        message: { role: prompt.injection.role, content },
      })
      continue
    }
    sink().push({ role: prompt.role, content })
  }

  const historyBlock: ChatMessageLike[] = history.map((h) => ({ role: h.role, content: h.content }))

  let laidOut: ChatMessageLike[]
  if (historyAnchorSeen) {
    laidOut = [...before, ...injectAbsolute(historyBlock, absolute), ...after]
  } else {
    // No chatHistory marker: history is not emitted, absolute prompts go at the end.
    laidOut = [...before, ...absolute.map((a) => a.message)]
  }

  // Split: leading run of system messages → instructions; the rest → messages.
  let firstNonSystem = laidOut.findIndex((m) => m.role !== 'system')
  if (firstNonSystem < 0) firstNonSystem = laidOut.length
  const instructions = laidOut
    .slice(0, firstNonSystem)
    .map((m) => m.content)
    .join('\n\n')
  const messages = laidOut.slice(firstNonSystem)

  if (input.ensureUserLast) {
    const last = messages[messages.length - 1]
    if (!last || last.role !== 'user') {
      messages.push({ role: 'user', content: input.continueUserMessage ?? DEFAULT_CONTINUE_MESSAGE })
    }
  }

  const prefill = preset.formatting.assistantPrefill
  if (prefill && !isBlank(prefill)) {
    messages.push({ role: 'assistant', content: mac(prefill) })
  }

  return {
    instructions,
    messages,
    sampling: { ...preset.sampling },
    stats: {
      instructionTokens: estimateTokens(instructions),
      messageTokens: estimateMessagesTokens(messages),
      droppedMarkers,
    },
  }
}

/**
 * Insert absolute-position prompts into the history block, `depth` messages from the end
 * (0 = after the last history message, 1 = before the last, ...). Injections sharing a
 * slot keep preset order. A depth beyond the history length lands before the first message.
 */
function injectAbsolute(history: ChatMessageLike[], injections: AbsoluteInjection[]): ChatMessageLike[] {
  if (injections.length === 0) return history
  const slots = new Map<number, ChatMessageLike[]>()
  for (const inj of injections) {
    const pos = Math.max(0, history.length - inj.depth)
    const bucket = slots.get(pos)
    if (bucket) bucket.push(inj.message)
    else slots.set(pos, [inj.message])
  }
  const out: ChatMessageLike[] = []
  for (let i = 0; i <= history.length; i++) {
    const bucket = slots.get(i)
    if (bucket) out.push(...bucket)
    if (i < history.length) out.push(history[i])
  }
  return out
}

/* ------------------------------------------------------------------ */
/* History trimming                                                    */
/* ------------------------------------------------------------------ */

export interface TrimHistoryOptions {
  /** Token budget for the kept history (estimate). */
  maxTokens: number
  /** Always keep this many most-recent messages, even over budget. */
  keepRecent: number
}

export function trimHistory<T extends { content: string }>(
  history: T[],
  { maxTokens, keepRecent }: TrimHistoryOptions,
): { kept: T[]; dropped: number } {
  const keep = Math.max(0, Math.min(keepRecent, history.length))
  const recent = keep > 0 ? history.slice(-keep) : []
  let used = estimateMessagesTokens(recent)
  const older: T[] = []
  for (let i = history.length - keep - 1; i >= 0; i--) {
    const cost = estimateTokens(history[i].content)
    if (used + cost > maxTokens) break
    used += cost
    older.unshift(history[i])
  }
  const kept = [...older, ...recent]
  return { kept, dropped: history.length - kept.length }
}

import { z } from 'zod'

/* ------------------------------------------------------------------ */
/* Markers                                                             */
/* ------------------------------------------------------------------ */

export const MARKER_IDS = [
  'charDescription',
  'charPersonality',
  'scenario',
  'charModules',
  'personaDescription',
  'memoryTable',
  'summaries',
  'chatHistory',
  'worldInfoBefore',
  'worldInfoAfter',
  'dialogueExamples',
] as const

export type MarkerId = (typeof MARKER_IDS)[number]

export const MARKER_LABELS: Record<MarkerId, string> = {
  charDescription: '角色描述',
  charPersonality: '角色性格',
  scenario: '初始情景',
  charModules: '角色卡其他模块（注意事项/特殊要求/自定义）',
  personaDescription: '用户人设',
  memoryTable: '记忆表',
  summaries: '剧情摘要',
  chatHistory: '聊天历史',
  worldInfoBefore: '世界书（前置）',
  worldInfoAfter: '世界书（后置）',
  dialogueExamples: '对话示例',
}

const MARKER_ID_SET: ReadonlySet<string> = new Set(MARKER_IDS)

export function isMarkerId(id: string): id is MarkerId {
  return MARKER_ID_SET.has(id)
}

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

/** Serialized preset size cap (characters of JSON). */
export const PRESET_MAX_SERIALIZED_CHARS = 300_000

const roleSchema = z.enum(['system', 'user', 'assistant'])

export const presetPromptSchema = z
  .object({
    id: z.string().min(1).max(80),
    name: z.string().max(120).optional(),
    enabled: z.boolean().default(true),
    marker: z.boolean().optional(),
    role: roleSchema.default('system'),
    content: z.string().max(50_000).default(''),
    injection: z
      .object({
        position: z.enum(['relative', 'absolute']).default('relative'),
        depth: z.number().int().min(0).default(0),
        role: roleSchema.default('system'),
      })
      .optional(),
  })
  .superRefine((p, ctx) => {
    if (p.marker && !isMarkerId(p.id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['id'],
        message: `marker prompt id "${p.id}" is not a known marker (${MARKER_IDS.join(', ')})`,
      })
    }
  })

export const samplingSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  top_k: z.number().int().min(0).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  max_tokens: z.number().int().min(1).max(65_536).optional(),
})

export const formattingSchema = z.object({
  assistantPrefill: z.string().max(2000).optional(),
})

export const presetSchema = z.object({
  name: z.string().min(1).max(80),
  version: z.literal(1).default(1),
  prompts: z.array(presetPromptSchema).max(200),
  sampling: samplingSchema.prefault({}),
  formatting: formattingSchema.prefault({}),
  source: z
    .object({
      // Unknown/legacy format labels collapse to 'external' so old rows keep parsing.
      format: z.enum(['external', 'charaverse']).catch('external'),
      raw: z.unknown().optional(),
    })
    .optional(),
})

export type PresetFile = z.output<typeof presetSchema>
export type PresetFileInput = z.input<typeof presetSchema>
export type PresetPrompt = z.output<typeof presetPromptSchema>
export type PresetSampling = PresetFile['sampling']

export type ParseResult = { ok: true; preset: PresetFile } | { ok: false; error: string }

export function parsePreset(json: unknown): ParseResult {
  let serialized: string
  try {
    serialized = JSON.stringify(json) ?? ''
  } catch {
    return { ok: false, error: '预设无法序列化为 JSON' }
  }
  if (serialized.length > PRESET_MAX_SERIALIZED_CHARS) {
    return {
      ok: false,
      error: `预设过大（${serialized.length} 字符，上限 ${PRESET_MAX_SERIALIZED_CHARS}）`,
    }
  }
  const result = presetSchema.safeParse(json)
  if (!result.success) {
    return { ok: false, error: z.prettifyError(result.error) }
  }
  return { ok: true, preset: result.data }
}

/* ------------------------------------------------------------------ */
/* Built-in default preset                                             */
/* ------------------------------------------------------------------ */

function markerPrompt(id: MarkerId, enabled = true): PresetPrompt {
  return { id, name: MARKER_LABELS[id], enabled, marker: true, role: 'system', content: '' }
}

/**
 * Port of the legacy single-character `buildSystemPrompt` + memory table / summary
 * injection. The role-play instruction wording is preserved verbatim; the character
 * card sections, memory table and summaries now flow in through markers in the same
 * order the old builder emitted them.
 */
export const BUILTIN_DEFAULT_PRESET: PresetFile = {
  name: 'CharaVerse 默认',
  version: 1,
  prompts: [
    {
      id: 'main',
      name: '主提示',
      enabled: true,
      role: 'system',
      content:
        '来玩角色扮演，接下来，你将完全成为"{{char}}"与我对话。注意回复简短自然，日常对话即可。你不可以自己预测我的行为。你必须给予回复。',
    },
    markerPrompt('charDescription'),
    markerPrompt('charPersonality'),
    markerPrompt('scenario'),
    markerPrompt('charModules'),
    markerPrompt('personaDescription'),
    markerPrompt('worldInfoBefore'),
    markerPrompt('summaries'),
    markerPrompt('memoryTable'),
    markerPrompt('worldInfoAfter'),
    markerPrompt('dialogueExamples', false),
    markerPrompt('chatHistory'),
  ],
  sampling: { temperature: 1, top_p: 0.95, max_tokens: 4096 },
  formatting: {},
  source: { format: 'charaverse' },
}

/* ------------------------------------------------------------------ */
/* External preset import                                            */
/* ------------------------------------------------------------------ */

/** Marker identifiers in the external preset format that map 1:1 onto ours. */
const EXTERNAL_MARKER_IDS: ReadonlySet<string> = new Set([
  'chatHistory',
  'dialogueExamples',
  'worldInfoBefore',
  'worldInfoAfter',
  'charDescription',
  'charPersonality',
  'scenario',
  'personaDescription',
])

/** Markers we add on import so CharaVerse data still flows into an imported preset. */
const CHARAVERSE_EXTRA_MARKERS: readonly MarkerId[] = ['charModules', 'memoryTable', 'summaries']

type Role = z.infer<typeof roleSchema>

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

function asFiniteNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

function asRole(v: unknown): Role {
  return v === 'user' || v === 'assistant' ? v : 'system'
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/** Detects the external (prompt-manager style) chat-completion preset shape (vs. our own format). */
export function isExternalPresetFormat(raw: unknown): boolean {
  if (!isRecord(raw) || !Array.isArray(raw.prompts)) return false
  if (Array.isArray(raw.prompt_order)) return true
  return raw.prompts.some((p) => isRecord(p) && typeof p.identifier === 'string' && !('id' in p))
}

function importSampling(raw: Record<string, unknown>): PresetSampling {
  const sampling: PresetSampling = {}
  const temperature = asFiniteNumber(raw.temperature)
  if (temperature !== undefined) sampling.temperature = clamp(temperature, 0, 2)
  const topP = asFiniteNumber(raw.top_p)
  if (topP !== undefined) sampling.top_p = clamp(topP, 0, 1)
  const topK = asFiniteNumber(raw.top_k)
  if (topK !== undefined) sampling.top_k = Math.max(0, Math.round(topK))
  const freq = asFiniteNumber(raw.frequency_penalty)
  if (freq !== undefined) sampling.frequency_penalty = clamp(freq, -2, 2)
  const pres = asFiniteNumber(raw.presence_penalty)
  if (pres !== undefined) sampling.presence_penalty = clamp(pres, -2, 2)
  const maxTokens = asFiniteNumber(raw.openai_max_tokens)
  if (maxTokens !== undefined) sampling.max_tokens = clamp(Math.round(maxTokens), 1, 65_536)
  return sampling
}

interface ExternalPromptEntry {
  identifier: string
  raw: Record<string, unknown>
}

function pickPromptOrder(raw: Record<string, unknown>): { identifier: string; enabled: boolean }[] | null {
  if (!Array.isArray(raw.prompt_order) || raw.prompt_order.length === 0) return null
  const groups = raw.prompt_order.filter(isRecord)
  const chosen =
    groups.find((g) => g.character_id === 100001) ??
    groups.find((g) => g.character_id === 100000) ??
    groups[0]
  if (!chosen || !Array.isArray(chosen.order)) return null
  const order: { identifier: string; enabled: boolean }[] = []
  for (const item of chosen.order) {
    if (!isRecord(item)) continue
    const identifier = asString(item.identifier)
    if (!identifier) continue
    order.push({ identifier, enabled: item.enabled !== false })
  }
  return order
}

export function importExternalPreset(raw: unknown): ParseResult {
  if (!isRecord(raw) || !Array.isArray(raw.prompts)) {
    return { ok: false, error: '不是可识别的外部预设：缺少 prompts 数组' }
  }

  // Index external prompts by identifier (first wins on duplicates).
  const byIdentifier = new Map<string, ExternalPromptEntry>()
  raw.prompts.forEach((p, i) => {
    if (!isRecord(p)) return
    const identifier = asString(p.identifier)?.trim() || `prompt_${i}`
    if (!byIdentifier.has(identifier)) byIdentifier.set(identifier, { identifier, raw: p })
  })

  // Resolve ordering: listed prompts first (with their enabled flag), then the rest disabled.
  const order = pickPromptOrder(raw)
  const sequence: { entry: ExternalPromptEntry; enabled: boolean }[] = []
  const seen = new Set<string>()
  if (order) {
    for (const item of order) {
      const entry = byIdentifier.get(item.identifier)
      if (!entry || seen.has(item.identifier)) continue
      seen.add(item.identifier)
      sequence.push({ entry, enabled: item.enabled })
    }
  }
  for (const entry of byIdentifier.values()) {
    if (seen.has(entry.identifier)) continue
    seen.add(entry.identifier)
    // Without a prompt_order, honour the prompt's own `enabled` (default true).
    const enabled = order ? false : entry.raw.enabled !== false
    sequence.push({ entry, enabled })
  }

  const usedIds = new Set<string>()
  const prompts: PresetPrompt[] = []
  for (const { entry, enabled } of sequence) {
    const p = entry.raw
    let id = entry.identifier.slice(0, 80)
    if (usedIds.has(id)) {
      let n = 2
      while (usedIds.has(`${id.slice(0, 76)}_${n}`)) n++
      id = `${id.slice(0, 76)}_${n}`
    }
    usedIds.add(id)

    const name = asString(p.name)?.slice(0, 120)
    const role = asRole(p.role)

    if (EXTERNAL_MARKER_IDS.has(entry.identifier)) {
      prompts.push({ id, name, enabled, marker: true, role: 'system', content: '' })
      continue
    }

    const content = asString(p.content) ?? ''
    if (content.length > 50_000) {
      return {
        ok: false,
        error: `条目 "${name ?? id}" 内容过长（${content.length} 字符，上限 50000）`,
      }
    }

    const prompt: PresetPrompt = { id, name, enabled, role, content }
    if (p.injection_position === 1) {
      const depth = asFiniteNumber(p.injection_depth)
      prompt.injection = {
        position: 'absolute',
        depth: depth === undefined ? 4 : Math.max(0, Math.round(depth)),
        role,
      }
    }
    prompts.push(prompt)
  }

  // Ensure CharaVerse-only markers exist so memory table / summaries / modules still flow in.
  const present = new Set(prompts.filter((p) => p.marker).map((p) => p.id))
  const missing = CHARAVERSE_EXTRA_MARKERS.filter((m) => !present.has(m)).map((m) => markerPrompt(m))
  if (missing.length > 0) {
    const historyIdx = prompts.findIndex((p) => p.marker && p.id === 'chatHistory')
    if (historyIdx >= 0) {
      prompts.splice(historyIdx, 0, ...missing)
    } else {
      prompts.push(...missing)
    }
  }
  if (!present.has('chatHistory')) {
    prompts.push(markerPrompt('chatHistory'))
  }

  const formatting: PresetFile['formatting'] = {}
  const prefill = asString(raw.assistant_prefill)
  if (prefill && prefill.trim()) formatting.assistantPrefill = prefill.slice(0, 2000)

  const name = asString(raw.name)?.trim().slice(0, 80) || '导入的预设'

  const candidate: PresetFileInput = {
    name,
    version: 1,
    prompts,
    sampling: importSampling(raw),
    formatting,
    source: { format: 'external', raw },
  }

  return parsePreset(candidate)
}

/* ------------------------------------------------------------------ */
/* JSON import / export                                                */
/* ------------------------------------------------------------------ */

export function importPresetJson(json: string): ParseResult {
  if (typeof json !== 'string' || json.length > PRESET_MAX_SERIALIZED_CHARS * 2) {
    return { ok: false, error: '预设文件过大或不是文本' }
  }
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { ok: false, error: '不是合法的 JSON' }
  }
  if (isExternalPresetFormat(raw)) return importExternalPreset(raw)
  return parsePreset(raw)
}

/** Pretty JSON for download; the original imported `source.raw` blob is omitted. */
export function exportPreset(preset: PresetFile): string {
  const { source, ...rest } = preset
  const out: PresetFile = source ? { ...rest, source: { format: source.format } } : rest
  return JSON.stringify(out, null, 2)
}

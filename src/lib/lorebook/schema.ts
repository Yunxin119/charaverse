import { z } from 'zod'

/**
 * World book ("lorebook"): keyword-triggered background knowledge injected into the prompt.
 * Our format is a trimmed superset of the common world-info JSON used by roleplay front-ends,
 * so those files import directly (see importExternalLorebook).
 */
export const lorebookEntrySchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().max(120).default(''),
  enabled: z.boolean().default(true),
  /** primary trigger keywords; empty + constant=false → never fires */
  keys: z.array(z.string().min(1).max(100)).max(50).default([]),
  /** optional secondary keywords; when `selective`, one of these must also match */
  secondaryKeys: z.array(z.string().min(1).max(100)).max(50).default([]),
  selective: z.boolean().default(false),
  caseSensitive: z.boolean().default(false),
  /** always injected regardless of keywords */
  constant: z.boolean().default(false),
  content: z.string().max(20000).default(''),
  /** where it goes: before or after the character card */
  position: z.enum(['before', 'after']).default('after'),
  /** lower comes first within the same position */
  order: z.number().int().min(-10000).max(10000).default(100),
  /** 0–100; entries with lower probability are skipped sometimes (0 = never, 100 = always) */
  probability: z.number().int().min(0).max(100).default(100),
  /** how many recent messages to scan for this entry (0 = use the book default) */
  depth: z.number().int().min(0).max(100).default(0),
  /** free-form; keeps unknown fields from imports */
  extra: z.record(z.string(), z.unknown()).optional(),
})
export type LorebookEntry = z.infer<typeof lorebookEntrySchema>

export const lorebookSchema = z.object({
  version: z.literal(1).default(1),
  name: z.string().max(120).default(''),
  description: z.string().max(2000).default(''),
  /** default number of recent messages to scan */
  scanDepth: z.number().int().min(1).max(100).default(6),
  /** total character budget for injected content */
  tokenBudget: z.number().int().min(100).max(60000).default(2000),
  /** matched entries' content is scanned again to trigger more entries (one extra pass) */
  recursive: z.boolean().default(false),
  entries: z.array(lorebookEntrySchema).max(500).default([]),
})
export type Lorebook = z.infer<typeof lorebookSchema>

export const EMPTY_LOREBOOK: Lorebook = lorebookSchema.parse({})

export function parseLorebook(raw: unknown): { ok: true; book: Lorebook } | { ok: false; error: string } {
  const r = lorebookSchema.safeParse(raw ?? {})
  if (r.success) return { ok: true, book: r.data }
  const i = r.error.issues[0]
  return { ok: false, error: `${i?.path.join('.') || 'lorebook'}: ${i?.message ?? '格式错误'}` }
}

// ---------------------------------------------------------------------------
// Import of the widely used external world-info JSON
//   { entries: { "0": { uid, key[], keysecondary[], comment, content, constant, selective,
//                       order, position (0 before / 1 after / others), disable, probability,
//                       useProbability, depth, caseSensitive, ... }, ... } }
// and of a card-embedded book
//   { name, entries: [ { keys[], secondary_keys[], content, enabled, insertion_order,
//                        case_sensitive, constant, selective, position: 'before_char'|'after_char', ... } ] }
// ---------------------------------------------------------------------------

type AnyRec = Record<string, unknown>
const asStrArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((s) => s.trim()) : [])
const asBool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d)
const asInt = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Math.round(Number(v)) : d)

function slug(s: string, i: number) {
  const base = s.toLowerCase().replace(/[^a-z0-9一-龥]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  return `${base || 'entry'}-${i}`
}

function entryFromExternal(e: AnyRec, i: number): LorebookEntry | null {
  const keys = asStrArr(e.key ?? e.keys)
  const content = typeof e.content === 'string' ? e.content : ''
  if (!content.trim()) return null
  const posRaw = e.position
  const position: 'before' | 'after' =
    posRaw === 0 || posRaw === 'before_char' || posRaw === 'before' ? 'before' : 'after'
  const enabled = e.disable !== undefined ? !asBool(e.disable, false) : asBool(e.enabled, true)
  const useProb = e.useProbability === undefined ? true : asBool(e.useProbability, true)
  const name = typeof e.comment === 'string' ? e.comment : typeof e.name === 'string' ? e.name : keys[0] ?? ''
  const uid = e.uid ?? e.id
  return lorebookEntrySchema.parse({
    id: uid !== undefined && uid !== null && String(uid).trim() ? String(uid).slice(0, 64) : slug(name, i),
    name: name.slice(0, 120),
    enabled,
    keys,
    secondaryKeys: asStrArr(e.keysecondary ?? e.secondary_keys ?? e.secondaryKeys),
    selective: asBool(e.selective, false),
    caseSensitive: asBool(e.caseSensitive ?? e.case_sensitive, false),
    constant: asBool(e.constant, false),
    content: content.slice(0, 20000),
    position,
    order: Math.max(-10000, Math.min(10000, asInt(e.order ?? e.insertion_order, 100))),
    probability: useProb ? Math.max(0, Math.min(100, asInt(e.probability, 100))) : 100,
    depth: Math.max(0, Math.min(100, asInt(e.depth ?? e.scan_depth, 0))),
  })
}

export function isExternalLorebook(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false
  const r = raw as AnyRec
  if (!r.entries) return false
  if (Array.isArray(r.entries)) return r.entries.some((e) => e && typeof e === 'object' && ('keys' in e || 'key' in e))
  if (typeof r.entries === 'object') return Object.values(r.entries as AnyRec).some((e) => e && typeof e === 'object' && ('key' in (e as AnyRec) || 'keys' in (e as AnyRec)))
  return false
}

export function importExternalLorebook(raw: unknown): { ok: true; book: Lorebook } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: '不是合法的世界书 JSON' }
  const r = raw as AnyRec
  const list: AnyRec[] = Array.isArray(r.entries)
    ? (r.entries as AnyRec[])
    : r.entries && typeof r.entries === 'object'
      ? Object.values(r.entries as AnyRec).filter((e): e is AnyRec => !!e && typeof e === 'object')
      : []
  if (!list.length) return { ok: false, error: '世界书里没有条目' }
  const entries: LorebookEntry[] = []
  const seen = new Set<string>()
  list.forEach((e, i) => {
    const entry = entryFromExternal(e, i)
    if (!entry) return
    let id = entry.id
    let n = 2
    while (seen.has(id)) id = `${entry.id}-${n++}`
    seen.add(id)
    entries.push({ ...entry, id })
  })
  if (!entries.length) return { ok: false, error: '没有可导入的条目（内容为空）' }
  const name = typeof r.name === 'string' ? r.name : ''
  const description = typeof r.description === 'string' ? r.description : ''
  return parseLorebook({ version: 1, name: name.slice(0, 120), description: description.slice(0, 2000), scanDepth: Math.max(1, Math.min(100, asInt(r.scan_depth ?? r.scanDepth, 6))), tokenBudget: Math.max(100, Math.min(60000, asInt(r.token_budget ?? r.tokenBudget, 2000))), recursive: asBool(r.recursive_scanning ?? r.recursive, false), entries })
}

/** Accepts our format or the external one. */
export function importLorebookJson(json: string): { ok: true; book: Lorebook } | { ok: false; error: string } {
  let raw: unknown
  try { raw = JSON.parse(json) } catch { return { ok: false, error: 'JSON 格式错误' } }
  if (isExternalLorebook(raw) && !(raw as AnyRec).version) return importExternalLorebook(raw)
  const own = parseLorebook(raw)
  if (own.ok && own.book.entries.length) return own
  return importExternalLorebook(raw)
}

export function exportLorebook(book: Lorebook): string {
  return JSON.stringify(book, null, 2)
}

/**
 * SillyTavern-compatible "regex scripts": ordered find/replace rules applied to
 * message text for display. Pure TypeScript; runs in browser and node.
 */
import { z } from 'zod'

export const regexScriptSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().max(120).default(''),
  enabled: z.boolean().default(true),
  /** Regex source, WITHOUT surrounding slashes. */
  find: z.string().min(1).max(2000),
  flags: z
    .string()
    .regex(/^[gimsuy]*$/)
    .default('g'),
  /** May contain `$1…$9`, `$&`, `$0`, `$<name>`, `{{match}}`. */
  replace: z.string().max(20000).default(''),
  trimStrings: z.array(z.string().max(200)).max(50).default([]),
  target: z.enum(['ai', 'user', 'both']).default('ai'),
  /** Output of this script is HTML; it is wrapped in sentinels and rendered in a sandbox. */
  renderAsHtml: z.boolean().default(false),
})

export type RegexScript = z.infer<typeof regexScriptSchema>
export type RegexScriptInput = z.input<typeof regexScriptSchema>

export type ParseResult = { ok: true; scripts: RegexScript[] } | { ok: false; error: string }

/** Sentinel markers around `renderAsHtml` output. */
export const HTML_BLOCK_OPEN = '\u0000cv-html\u0000'
export const HTML_BLOCK_CLOSE = '\u0000/cv-html\u0000'

/** Scripts are skipped on texts longer than this to bound regex work. */
export const MAX_TEXT_LENGTH = 60_000

/* ------------------------------------------------------------------------ */
/* helpers                                                                   */
/* ------------------------------------------------------------------------ */

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&')
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function deriveId(name: unknown, index: number, prefix: string): string {
  const slug = typeof name === 'string' ? slugify(name) : ''
  return slug ? `${prefix}-${slug}-${index}` : `${prefix}-${index}`
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Accept a single object, an array, or `{ scripts: [...] }`. */
function toList(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw
  if (isRecord(raw)) {
    if (Array.isArray(raw.scripts)) return raw.scripts
    return [raw]
  }
  return null
}

function formatZodError(err: z.ZodError): string {
  return err.issues
    .slice(0, 5)
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ')
}

/**
 * Split a SillyTavern `findRegex` of the form `/pattern/flags` into its parts.
 * Returns null when the string is not in slash form.
 */
export function splitSlashRegex(src: string): { pattern: string; flags: string } | null {
  const s = src.trim()
  if (s.length < 2 || s[0] !== '/') return null
  const last = s.lastIndexOf('/')
  if (last <= 0) return null
  // The closing slash must not be escaped (odd number of preceding backslashes).
  let backslashes = 0
  for (let i = last - 1; i > 0 && s[i] === '\\'; i--) backslashes++
  if (backslashes % 2 === 1) return null
  const flags = s.slice(last + 1)
  if (!/^[gimsuy]*$/.test(flags)) return null
  return { pattern: s.slice(1, last), flags }
}

/** ST uses `{{match}}` for the whole match; JS uses `$&`. */
function translateReplace(replace: string): string {
  return replace.replace(/\{\{match\}\}/gi, () => '$&')
}

/* ------------------------------------------------------------------------ */
/* parsing / import                                                          */
/* ------------------------------------------------------------------------ */

/** Parse scripts already in our own format (tolerant about missing ids). */
export function parseRegexScripts(raw: unknown): ParseResult {
  const list = toList(raw)
  if (!list) return { ok: false, error: '需要一个脚本对象或脚本数组' }
  const prepared = list.map((item, index) => {
    if (!isRecord(item)) return item
    if (typeof item.id !== 'string' || !item.id) {
      return { ...item, id: deriveId(item.name, index, 'rx') }
    }
    return item
  })
  const result = z.array(regexScriptSchema).safeParse(prepared)
  if (!result.success) return { ok: false, error: formatZodError(result.error) }
  return { ok: true, scripts: result.data }
}

/** SillyTavern regex_placement: 0 MD_DISPLAY, 1 USER_INPUT, 2 AI_OUTPUT, 3 SLASH, 5 WORLD_INFO, 6 REASONING. */
function mapPlacement(placement: unknown): RegexScript['target'] {
  if (!Array.isArray(placement)) return 'ai'
  const nums = placement.filter((p): p is number => typeof p === 'number')
  const user = nums.includes(1)
  const ai = nums.includes(2)
  if (user && ai) return 'both'
  if (user) return 'user'
  if (ai) return 'ai'
  // Only MD_DISPLAY (0): affects every displayed message.
  if (nums.includes(0)) return 'both'
  return 'ai'
}

/** Import SillyTavern regex script JSON (single object, array, or `{ scripts }`). */
export function importSillyTavernRegex(raw: unknown): ParseResult {
  const list = toList(raw)
  if (!list) return { ok: false, error: '需要一个酒馆正则脚本对象或数组' }

  const converted: RegexScriptInput[] = []
  for (let index = 0; index < list.length; index++) {
    const item = list[index]
    if (!isRecord(item)) return { ok: false, error: `第 ${index + 1} 项不是对象` }

    const findRaw = item.findRegex
    if (typeof findRaw !== 'string' || !findRaw.trim()) {
      return { ok: false, error: `第 ${index + 1} 项缺少 findRegex` }
    }
    const split = splitSlashRegex(findRaw)
    const find = split ? split.pattern : findRaw
    const flags = split ? split.flags : 'g'
    if (!find) return { ok: false, error: `第 ${index + 1} 项的 findRegex 为空` }

    const promptOnly = item.promptOnly === true
    let name = typeof item.scriptName === 'string' ? item.scriptName : ''
    if (promptOnly) name = `${name} (promptOnly, 未支持)`.trim()

    const id =
      typeof item.id === 'string' && item.id.trim() ? item.id.trim().slice(0, 64) : deriveId(name, index, 'st')

    const trimStrings = Array.isArray(item.trimStrings)
      ? item.trimStrings.filter((t): t is string => typeof t === 'string' && t.length > 0)
      : []

    converted.push({
      id,
      name: name.slice(0, 120),
      enabled: !promptOnly && item.disabled !== true,
      find,
      flags,
      replace: translateReplace(typeof item.replaceString === 'string' ? item.replaceString : ''),
      trimStrings,
      target: mapPlacement(item.placement),
      renderAsHtml: false,
    })
  }

  const result = z.array(regexScriptSchema).safeParse(converted)
  if (!result.success) return { ok: false, error: formatZodError(result.error) }
  return { ok: true, scripts: result.data }
}

function looksLikeSillyTavern(raw: unknown): boolean {
  const list = toList(raw)
  if (!list || list.length === 0) return false
  const first = list[0]
  return isRecord(first) && ('findRegex' in first || 'scriptName' in first)
}

/** JSON-parse then auto-detect SillyTavern vs our own format. */
export function importRegexJson(json: string): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return { ok: false, error: 'JSON 解析失败' }
  }
  return looksLikeSillyTavern(data) ? importSillyTavernRegex(data) : parseRegexScripts(data)
}

/* ------------------------------------------------------------------------ */
/* apply                                                                     */
/* ------------------------------------------------------------------------ */

export interface ApplyContext {
  role: 'user' | 'assistant'
  char?: string
  user?: string
}

function substituteMacros(text: string, ctx: ApplyContext, forRegex: boolean): string {
  const char = ctx.char ?? ''
  const user = ctx.user ?? ''
  return text
    .replace(/\{\{\s*char\s*\}\}/gi, () => (forRegex ? escapeRegExp(char) : char))
    .replace(/\{\{\s*user\s*\}\}/gi, () => (forRegex ? escapeRegExp(user) : user))
}

function stripTrim(value: string | undefined, trimStrings: string[]): string {
  if (value === undefined) return ''
  let out = value
  for (const t of trimStrings) {
    if (t) out = out.split(t).join('')
  }
  return out
}

/**
 * Expand a JS-style replacement template against one match, with ST trimStrings
 * applied to `$&`/`$0`/`$n`/`$<name>` before insertion.
 */
function expandTemplate(
  template: string,
  whole: string,
  groups: (string | undefined)[],
  named: Record<string, string | undefined> | undefined,
  trimStrings: string[],
): string {
  return template.replace(/\$(\$|&|\d{1,2}|<([^>]+)>)/g, (token, kind: string, name: string | undefined) => {
    if (kind === '$') return '$'
    if (kind === '&') return stripTrim(whole, trimStrings)
    if (name !== undefined) {
      if (!named || !(name in named)) return token
      return stripTrim(named[name], trimStrings)
    }
    // numeric
    let n = parseInt(kind, 10)
    if (n === 0) return stripTrim(whole, trimStrings)
    if (n > groups.length && kind.length === 2) {
      // `$12` with fewer groups → JS treats as `$1` + '2'
      n = parseInt(kind[0], 10)
      if (n === 0 || n > groups.length) return token
      return stripTrim(groups[n - 1], trimStrings) + kind[1]
    }
    if (n > groups.length) return token
    return stripTrim(groups[n - 1], trimStrings)
  })
}

function scriptMatchesRole(target: RegexScript['target'], role: ApplyContext['role']): boolean {
  if (target === 'both') return true
  return role === 'user' ? target === 'user' : target === 'ai'
}

export function applyRegexScripts(text: string, scripts: RegexScript[], ctx: ApplyContext): string {
  let out = text
  for (const script of scripts) {
    if (!script.enabled) continue
    if (!scriptMatchesRole(script.target, ctx.role)) continue
    if (out.length > MAX_TEXT_LENGTH) continue

    let re: RegExp
    try {
      re = new RegExp(substituteMacros(script.find, ctx, true), script.flags)
    } catch {
      continue
    }

    const template = substituteMacros(script.replace, ctx, false)
    const trimStrings = script.trimStrings

    try {
      out = out.replace(re, (...args: unknown[]) => {
        // args: match, p1..pn, offset, string, [groups]
        const whole = args[0] as string
        const last = args[args.length - 1]
        const hasGroupsObj = typeof last === 'object' && last !== null
        const groupsEnd = hasGroupsObj ? args.length - 3 : args.length - 2
        const groups = args.slice(1, groupsEnd) as (string | undefined)[]
        const named = hasGroupsObj ? (last as Record<string, string | undefined>) : undefined
        const replaced = expandTemplate(template, whole, groups, named, trimStrings)
        return script.renderAsHtml ? `${HTML_BLOCK_OPEN}${replaced}${HTML_BLOCK_CLOSE}` : replaced
      })
    } catch {
      // A pathological regex/template must never break rendering.
      continue
    }
  }
  return out
}

/**
 * Sanitize + scope author-supplied chat skin CSS (REFACTOR_PLAN A9).
 *
 * Pure TypeScript, runs in browser and node. Uses a real CSS parser (css-tree):
 * the stylesheet is parsed to an AST, walked/rewritten, then re-generated.
 * Regexes are only used for the HTML unwrap step before parsing.
 */
import {
  clone,
  generate,
  parse,
  type Atrule,
  type Block,
  type CssNode,
  type Declaration,
  type List,
  type ListItem,
  type Rule,
  type Selector,
  type SelectorList,
  type StyleSheet,
} from 'css-tree'

export interface SanitizeOptions {
  /** Selector every rule is scoped under. Default `#cv_chat_root`. */
  scope?: string
  /** Extra https hosts allowed in `url()` (exact hostname match). */
  allowedUrlHosts?: string[]
  /** Reject inputs longer than this. Default 100_000. */
  maxChars?: number
}

export interface SanitizeResult {
  css: string
  warnings: string[]
}

export const DEFAULT_SCOPE = '#cv_chat_root'
export const DEFAULT_MAX_CHARS = 100_000

/** Hosts always allowed in `url()` (https only). */
export const BASE_ALLOWED_URL_HOSTS: readonly string[] = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'i.imgur.com',
  'img.heliar.top',
]

/** At-rules that are kept and whose block is recursed into (rules inside get scoped). */
const RECURSIVE_AT_RULES = new Set(['media', 'supports', 'container'])
/** At-rules kept verbatim except for declaration sanitizing (inner selectors are NOT scoped). */
const KEYFRAME_AT_RULES = new Set(['keyframes', '-webkit-keyframes', '-moz-keyframes', '-o-keyframes'])

const BANNED_PROPERTIES = new Set(['behavior', '-moz-binding'])
const BANNED_VALUE_FRAGMENTS = ['expression(', 'javascript:', 'vbscript:', '-webkit-binding']
/** Functions whose string arguments are URLs. */
const URL_STRING_FUNCTIONS = new Set(['image-set', '-webkit-image-set', 'image', 'src'])

/* ------------------------------------------------------------------------ */
/* helpers                                                                   */
/* ------------------------------------------------------------------------ */

function supabaseHost(): string | null {
  try {
    const raw = typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SUPABASE_URL : undefined
    if (!raw) return null
    return new URL(raw).hostname.toLowerCase()
  } catch {
    return null
  }
}

function buildAllowedHosts(extra: string[] | undefined): Set<string> {
  const set = new Set<string>(BASE_ALLOWED_URL_HOSTS)
  for (const h of extra ?? []) {
    const v = h.trim().toLowerCase()
    if (v) set.add(v)
  }
  const sb = supabaseHost()
  if (sb) set.add(sb)
  return set
}

/** Unwrap `<style>…</style>` and strip any other HTML tags. */
function stripHtml(raw: string): string {
  let text = raw
  const styleMatch = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/i.exec(text)
  if (styleMatch) text = styleMatch[1]
  // Remove any remaining HTML tags (opening, closing, self-closing).
  text = text.replace(/<\/?[a-zA-Z][^<>]*>/g, '')
  return text
}

/** Decode CSS escapes so `expr\65ssion(` cannot sneak past the substring check. */
function unescapeCss(value: string): string {
  return value
    .replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, hex: string) => {
      const cp = parseInt(hex, 16)
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ''
    })
    .replace(/\\(.)/g, '$1')
}

function normalizeValue(value: string): string {
  return unescapeCss(value).replace(/\s+/g, '').toLowerCase()
}

type UrlVerdict = { ok: true } | { ok: false; reason: string }

function checkUrl(value: string, allowedHosts: Set<string>): UrlVerdict {
  const v = value.trim()
  const lower = v.toLowerCase()
  if (lower.startsWith('data:')) {
    const mime = lower.slice(5)
    if (
      mime.startsWith('image/') ||
      mime.startsWith('font/') ||
      mime.startsWith('application/font') ||
      mime.startsWith('application/x-font')
    ) {
      return { ok: true }
    }
    return { ok: false, reason: 'url() 仅允许 image/font 类型的 data: 资源' }
  }
  if (v.startsWith('/')) {
    if (v.startsWith('//')) return { ok: false, reason: 'url() 不允许协议相对地址（//）' }
    return { ok: true }
  }
  let parsed: URL
  try {
    parsed = new URL(v)
  } catch {
    return { ok: false, reason: 'url() 仅允许 https 绝对地址、以 / 开头的站内路径或 data: 资源' }
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: `url() 仅允许 https 地址（${parsed.protocol.replace(':', '')}）` }
  }
  const host = parsed.hostname.toLowerCase()
  if (!allowedHosts.has(host)) {
    return { ok: false, reason: `url() 域名不在白名单: ${host}` }
  }
  return { ok: true }
}

/* ------------------------------------------------------------------------ */
/* sanitizer                                                                 */
/* ------------------------------------------------------------------------ */

class Sanitizer {
  private warnings = new Set<string>()
  private scopeSelector: Selector
  private scopeText: string
  private allowedHosts: Set<string>

  constructor(scope: string, allowedHosts: Set<string>) {
    this.allowedHosts = allowedHosts
    const parsedScope = parse(scope, { context: 'selector', positions: false }) as CssNode
    if (parsedScope.type !== 'Selector' || parsedScope.children.isEmpty) {
      throw new Error('invalid scope selector')
    }
    this.scopeSelector = parsedScope
    this.scopeText = generate(parsedScope)
  }

  warn(msg: string) {
    this.warnings.add(msg)
  }

  getWarnings(): string[] {
    return [...this.warnings]
  }

  /** Process a list of top-level / block children (rules + at-rules). */
  processRuleList(list: List<CssNode>, inKeyframes: boolean) {
    list.forEach((node, item) => {
      switch (node.type) {
        case 'Rule':
          this.processRule(node, item, list, inKeyframes)
          break
        case 'Atrule':
          this.processAtrule(node, item, list)
          break
        case 'Declaration':
          // Declarations directly in a rule list (CSS nesting) – not supported, drop.
          list.remove(item)
          break
        case 'Comment':
        case 'WhiteSpace':
          break
        case 'Raw':
          // Unparseable garbage: never emit it.
          list.remove(item)
          this.warn('已移除无法解析的 CSS 片段')
          break
        default:
          list.remove(item)
      }
    })
  }

  private processAtrule(node: Atrule, item: ListItem<CssNode>, list: List<CssNode>) {
    const name = node.name.toLowerCase()
    if (RECURSIVE_AT_RULES.has(name)) {
      if (!node.block) {
        list.remove(item)
        return
      }
      this.processRuleList(node.block.children, false)
      if (node.block.children.isEmpty) list.remove(item)
      return
    }
    if (KEYFRAME_AT_RULES.has(name)) {
      if (!node.block) {
        list.remove(item)
        return
      }
      this.processRuleList(node.block.children, true)
      return
    }
    if (name === 'font-face') {
      if (!node.block) {
        list.remove(item)
        return
      }
      const ok = this.processFontFace(node.block)
      if (!ok) {
        list.remove(item)
        this.warn('已移除 @font-face：其 src 包含不在白名单内的地址')
      }
      return
    }
    list.remove(item)
    this.warn(`已移除不支持的 @${name} 规则`)
  }

  /** Returns false when the font-face must be dropped. */
  private processFontFace(block: Block): boolean {
    let bad = false
    block.children.forEach((child, item, list) => {
      if (child.type !== 'Declaration') {
        list.remove(item)
        return
      }
      const verdict = this.checkDeclaration(child)
      if (verdict === 'drop') {
        if (child.property.toLowerCase() === 'src') bad = true
        list.remove(item)
      }
    })
    return !bad
  }

  private processRule(node: Rule, item: ListItem<CssNode>, list: List<CssNode>, inKeyframes: boolean) {
    // Declarations (and nested rules, which we drop) inside the block.
    node.block.children.forEach((child, childItem, childList) => {
      if (child.type === 'Declaration') {
        if (this.checkDeclaration(child) === 'drop') childList.remove(childItem)
        return
      }
      if (child.type === 'Rule' || child.type === 'Atrule') {
        // CSS nesting: unsupported; drop so nothing escapes the scope.
        childList.remove(childItem)
        this.warn('已移除嵌套规则（不支持 CSS 嵌套语法）')
        return
      }
      if (child.type === 'Raw') {
        childList.remove(childItem)
        return
      }
    })

    if (node.block.children.isEmpty) {
      list.remove(item)
      return
    }

    if (inKeyframes) return

    if (node.prelude.type !== 'SelectorList') {
      list.remove(item)
      this.warn('已移除无法解析选择器的规则')
      return
    }
    this.scopeSelectorList(node.prelude)
    if (node.prelude.children.isEmpty) list.remove(item)
  }

  private scopeSelectorList(selectorList: SelectorList) {
    selectorList.children.forEach((sel, item, list) => {
      if (sel.type !== 'Selector') {
        list.remove(item)
        this.warn('已移除无法解析的选择器')
        return
      }
      this.scopeSelector_(sel)
    })
  }

  private scopeSelector_(sel: Selector) {
    const children = sel.children
    // Trim leading whitespace / descendant combinators.
    while (children.first && (children.first.type === 'WhiteSpace' || (children.first.type === 'Combinator' && children.first.name === ' '))) {
      children.shift()
    }
    if (children.isEmpty) return

    const text = generate(sel)
    if (text === this.scopeText || text.startsWith(this.scopeText + ' ') || text.startsWith(this.scopeText + '>') || text.startsWith(this.scopeText + ':') || text.startsWith(this.scopeText + '.') || text.startsWith(this.scopeText + '[')) {
      return
    }

    // Replace leading `html`, `body`, `:root` (possibly chained: `html body`) with the scope.
    let replaced = false
    for (;;) {
      const first = children.first
      if (!first) break
      const isRootish =
        (first.type === 'TypeSelector' && (first.name.toLowerCase() === 'html' || first.name.toLowerCase() === 'body')) ||
        (first.type === 'PseudoClassSelector' && first.name.toLowerCase() === 'root')
      if (!isRootish) break
      children.shift()
      replaced = true
      // `html body .x` → strip the following descendant combinator + next rootish compound head.
      const next = children.first
      if (next && next.type === 'Combinator' && next.name === ' ') {
        const after = next ? this.peekSecond(children) : null
        const afterRootish =
          after &&
          ((after.type === 'TypeSelector' && (after.name.toLowerCase() === 'html' || after.name.toLowerCase() === 'body')) ||
            (after.type === 'PseudoClassSelector' && after.name.toLowerCase() === 'root'))
        if (afterRootish) {
          children.shift() // combinator
          continue
        }
      }
      break
    }

    const scopeNodes = (clone(this.scopeSelector) as Selector).children
    if (replaced) {
      // `body.dark .x` → `#scope.dark .x`; `body` alone → `#scope`.
      children.prependList(scopeNodes)
      return
    }
    // Generic prefix: `#scope <selector>`.
    const prefix = scopeNodes
    prefix.appendData({ type: 'Combinator', name: ' ' })
    children.prependList(prefix)
  }

  private peekSecond(list: List<CssNode>): CssNode | null {
    let i = 0
    for (const n of list) {
      if (i === 1) return n
      i++
    }
    return null
  }

  /** Validate / rewrite a declaration. Returns 'drop' when it must be removed. */
  private checkDeclaration(decl: Declaration): 'keep' | 'drop' {
    const property = decl.property.toLowerCase()
    if (BANNED_PROPERTIES.has(property)) {
      this.warn(`已移除危险属性 ${property}`)
      return 'drop'
    }

    const valueText = normalizeValue(generate(decl.value))
    for (const frag of BANNED_VALUE_FRAGMENTS) {
      if (valueText.includes(frag)) {
        this.warn(`已移除包含 ${frag} 的声明`)
        return 'drop'
      }
    }

    if (decl.value.type === 'Raw') {
      // Could not be parsed into a value tree; if it smuggles a url() we cannot vet it.
      if (valueText.includes('url(')) {
        this.warn('已移除无法解析且包含 url() 的声明')
        return 'drop'
      }
      return 'keep'
    }

    // url() allowlist
    let badUrl: string | null = null
    const visit = (node: CssNode) => {
      if (badUrl) return
      if (node.type === 'Url') {
        const verdict = checkUrl(unescapeCss(node.value), this.allowedHosts)
        if (!verdict.ok) badUrl = verdict.reason
        return
      }
      if (node.type === 'Function' && URL_STRING_FUNCTIONS.has(node.name.toLowerCase())) {
        // image-set("a.png" 1x) / image("a.png") / src("a.png") take bare strings as URLs.
        for (const child of node.children) {
          if (child.type === 'String') {
            const verdict = checkUrl(unescapeCss(child.value), this.allowedHosts)
            if (!verdict.ok) {
              badUrl = verdict.reason
              return
            }
          }
        }
      }
      if ('children' in node && node.children) {
        for (const child of node.children as List<CssNode>) visit(child)
      }
    }
    visit(decl.value)
    if (badUrl) {
      this.warn(badUrl)
      return 'drop'
    }

    // position: fixed → absolute
    if (property === 'position') {
      let rewritten = false
      for (const child of decl.value.children) {
        if (child.type === 'Identifier' && child.name.toLowerCase() === 'fixed') {
          child.name = 'absolute'
          rewritten = true
        }
      }
      if (rewritten) this.warn('position: fixed 已改写为 absolute')
    }

    return 'keep'
  }
}

/* ------------------------------------------------------------------------ */
/* public API                                                                */
/* ------------------------------------------------------------------------ */

export function sanitizeCss(raw: string, opts: SanitizeOptions = {}): SanitizeResult {
  const maxChars = opts.maxChars ?? DEFAULT_MAX_CHARS
  const scope = (opts.scope ?? DEFAULT_SCOPE).trim() || DEFAULT_SCOPE

  if (typeof raw !== 'string') return { css: '', warnings: [] }
  if (raw.length > maxChars) return { css: '', warnings: ['CSS 超过大小限制'] }

  const source = stripHtml(raw)
  if (!source.trim()) return { css: '', warnings: [] }

  let sanitizer: Sanitizer
  try {
    sanitizer = new Sanitizer(scope, buildAllowedHosts(opts.allowedUrlHosts))
  } catch {
    return { css: '', warnings: ['无效的作用域选择器'] }
  }

  let ast: StyleSheet
  try {
    ast = parse(source, {
      context: 'stylesheet',
      positions: false,
      parseCustomProperty: true,
    }) as StyleSheet
  } catch {
    return { css: '', warnings: ['CSS 解析失败'] }
  }

  try {
    sanitizer.processRuleList(ast.children, false)
  } catch {
    return { css: '', warnings: ['CSS 处理失败'] }
  }

  return { css: generate(ast), warnings: sanitizer.getWarnings() }
}

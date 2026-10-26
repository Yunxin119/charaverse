/**
 * Regex script test bench: run one script (and the ones before it) against a sample
 * text so authors can see matches and output without opening a chat. Pure; used by
 * the skin editor and unit-tested.
 */
import { applyRegexScripts, escapeRegExp, type ApplyContext, type RegexScript, type RegexScriptInput } from './regexScripts'

export interface MatchSpan { start: number; end: number; text: string }

export interface ScriptTestResult {
  /** the regex compiled */
  ok: boolean
  error?: string
  /** text this script sees: the sample after every enabled script before it */
  input: string
  matches: MatchSpan[]
  /** text after this script (input when disabled / invalid) */
  output: string
  skipped?: 'disabled' | 'role'
}

function substitute(text: string, ctx: ApplyContext): string {
  return text
    .replace(/\{\{\s*char\s*\}\}/gi, () => escapeRegExp(ctx.char ?? ''))
    .replace(/\{\{\s*user\s*\}\}/gi, () => escapeRegExp(ctx.user ?? ''))
}

/** Where `script` (index `i` of `scripts`) matches in the sample, and what it turns the text into. */
export function testRegexScript(scripts: RegexScript[], i: number, sample: string, ctx: ApplyContext): ScriptTestResult {
  const script = scripts[i]
  const input = applyRegexScripts(sample, scripts.slice(0, i), ctx)
  if (!script.enabled) return { ok: true, input, matches: [], output: input, skipped: 'disabled' }
  const roleOk = script.target === 'both' || (ctx.role === 'user' ? script.target === 'user' : script.target === 'ai')
  if (!roleOk) return { ok: true, input, matches: [], output: input, skipped: 'role' }

  let re: RegExp
  try {
    re = new RegExp(substitute(script.find, ctx), script.flags.includes('g') ? script.flags : script.flags + 'g')
  } catch (e) {
    return { ok: false, error: (e as Error).message, input, matches: [], output: input }
  }
  const matches: MatchSpan[] = []
  for (const m of input.matchAll(re)) {
    if (m.index === undefined) continue
    if (m[0].length === 0) { if (matches.length > 200) break; continue }
    matches.push({ start: m.index, end: m.index + m[0].length, text: m[0] })
    if (matches.length >= 200) break
  }
  const output = applyRegexScripts(input, [script], ctx)
  return { ok: true, input, matches, output }
}

export interface RegexTemplate {
  id: string
  name: string
  desc: string
  script: Omit<RegexScriptInput, 'id'>
  /** sample text that shows the template doing something */
  sample: string
}

/** Starter scripts for the most common beautification needs. */
export const REGEX_TEMPLATES: RegexTemplate[] = [
  {
    id: 'status-bar',
    name: '状态栏',
    desc: '把回复里的 <status>…</status> 渲染成一个玻璃卡片',
    script: {
      name: '状态栏',
      find: '<status>([\\s\\S]*?)<\\/status>',
      flags: 'g',
      replace: '<div style="margin:8px 0;padding:10px 14px;border-radius:12px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);font:13px/1.6 system-ui,sans-serif;white-space:pre-wrap">$1</div>',
      target: 'ai',
      renderAsHtml: true,
    },
    sample: '她把杯子推过来。\n<status>\n好感度：42 ▲\n时间：22:10 · 雨\n</status>',
  },
  {
    id: 'hide-thinking',
    name: '隐藏思考过程',
    desc: '不显示 <think>…</think>（模型的推理草稿），发给模型的内容不变',
    script: { name: '隐藏思考过程', find: '<think(?:ing)?>[\\s\\S]*?<\\/think(?:ing)?>\\s*', flags: 'g', replace: '', target: 'ai', renderAsHtml: false },
    sample: '<think>用户在试探，我应该保持距离。</think>「你问得太多了。」',
  },
  {
    id: 'strip-ooc',
    name: '去掉 OOC 括号',
    desc: '隐藏 (OOC: …) / （OOC：…）这类出戏说明',
    script: { name: '去掉 OOC 括号', find: '[（(]\\s*OOC[:：][^)）]*[)）]\\s*', flags: 'gi', replace: '', target: 'both', renderAsHtml: false },
    sample: '（OOC：这段按慢节奏写）他没有回头。',
  },
  {
    id: 'bold-dialogue',
    name: '对白加粗',
    desc: '把「…」和 “…” 里的对白加粗，动作描写保持原样',
    script: { name: '对白加粗', find: '([「“])([^」”\\n]+)([」”])', flags: 'g', replace: '**$1$2$3**', target: 'ai', renderAsHtml: false },
    sample: '他抬眼看了看钟。「再等十分钟，雨就停了。」',
  },
]

'use client'

import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, Copy, FlaskConical, LayoutTemplate, Plus, Trash2, Upload } from 'lucide-react'
import type { Skin } from '@/lib/skins/schema'
import { sanitizeCss } from '@/lib/skins/sanitizeCss'
import { importRegexJson, regexScriptSchema, type RegexScript } from '@/lib/skins/regexScripts'
import { REGEX_TEMPLATES } from '@/lib/skins/regexTest'
import { composeSkinCss } from '@/lib/skins/knobs'
import { SELECTOR_GROUPS, CSS_PRESETS, SAMPLE_AI_MESSAGE } from '@/lib/skins/docs'
import { KnobsPanel } from './KnobsPanel'
import { RegexTester } from './RegexTester'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GlassPanel, IconButton } from '@/components/glass'
import { cn } from '@/lib/utils'

interface Props {
  value: Skin
  onChange: (next: Skin) => void
  /** the sample AI reply the regex test benches run on (shared with the live preview) */
  sample: string
  onSampleChange: (v: string) => void
  /** macro values for the test benches */
  char: string
  user: string
}

/** id suffix for scripts added in the editor (module scope: keeps Date.now out of render code) */
const uid = () => Date.now().toString(36)
const emptyScript = (i: number): RegexScript => regexScriptSchema.parse({ id: `script_${uid()}_${i}`, name: `脚本 ${i + 1}`, find: '', replace: '' })
const templateScript = (t: (typeof REGEX_TEMPLATES)[number]): RegexScript => regexScriptSchema.parse({ id: `${t.id}_${uid()}`, ...t.script })

/**
 * The skin's editor: knobs + CSS (with presets and the selector list), regex scripts
 * (each with a test bench) and options. Pure controlled fields; the host owns the draft,
 * saves it with the card, and shows the result in the live preview.
 */
export function SkinFields({ value: skin, onChange, sample, onSampleChange, char, user }: Props) {
  const [copied, setCopied] = useState<string | null>(null)
  const [regexImport, setRegexImport] = useState('')
  const [regexImportError, setRegexImportError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const composedCss = useMemo(() => composeSkinCss(skin.knobs, skin.css), [skin.knobs, skin.css])
  const sanitized = useMemo(() => sanitizeCss(composedCss, { allowedUrlHosts: skin.allowedUrlHosts }), [composedCss, skin.allowedUrlHosts])

  const set = <K extends keyof Skin>(k: K, v: Skin[K]) => onChange({ ...skin, [k]: v })
  const setScript = (i: number, patch: Partial<RegexScript>) => set('regexScripts', skin.regexScripts.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  const copySel = async (sel: string) => { try { await navigator.clipboard.writeText(sel); setCopied(sel); setTimeout(() => setCopied(null), 1200) } catch {} }

  const importRegex = (text: string) => {
    setRegexImportError(null)
    const r = importRegexJson(text)
    if (!r.ok) { setRegexImportError(r.error); return }
    set('regexScripts', [...skin.regexScripts, ...r.scripts].slice(0, 100))
    setRegexImport('')
  }

  const testCtx = useMemo(() => ({ role: 'assistant' as const, char, user }), [char, user])
  const addTemplate = (id: string) => {
    const t = REGEX_TEMPLATES.find((x) => x.id === id)
    if (!t) return
    set('regexScripts', [...skin.regexScripts, templateScript(t)].slice(0, 100))
    // give the tester something to bite on when the sample is still the default
    if (sample === SAMPLE_AI_MESSAGE || !sample.trim()) onSampleChange(`${sample.trim()}\n\n${t.sample}`.trim())
  }
  const applyPreset = (p: (typeof CSS_PRESETS)[number]) => {
    if (skin.css.trim() && !confirm('替换当前 CSS？')) return
    const t = p.regexTemplateId ? REGEX_TEMPLATES.find((x) => x.id === p.regexTemplateId) : undefined
    // presets that need a regex (e.g. dialogue colouring) bring it along, once
    const scripts = t && !skin.regexScripts.some((r) => r.name === t.script.name)
      ? [...skin.regexScripts, templateScript(t)].slice(0, 100)
      : skin.regexScripts
    onChange({ ...skin, css: p.css, regexScripts: scripts })
    if (t && (sample === SAMPLE_AI_MESSAGE || !sample.trim())) onSampleChange(`${sample.trim()}\n\n${t.sample}`.trim())
  }

  return (
    <Tabs defaultValue="css" className="min-w-0">
      <TabsList className="w-full"><TabsTrigger value="css">外观</TabsTrigger><TabsTrigger value="regex">正则脚本 {skin.regexScripts.length ? `(${skin.regexScripts.length})` : ''}</TabsTrigger><TabsTrigger value="options">选项</TabsTrigger></TabsList>

      <TabsContent value="css" className="space-y-4 pt-3">
        <KnobsPanel value={skin.knobs} onChange={(v) => set('knobs', v)} />
        <div className="space-y-1.5">
          <Label htmlFor="skin-css" className="text-xs font-semibold tracking-wide text-cv-fg-muted">高级 CSS</Label>
          <Textarea id="skin-css" value={skin.css} onChange={(e) => set('css', e.target.value)} spellCheck={false} placeholder={'#cv_chat_root { background: #0c0c0e; }\n.cv_ai_message_bubble { border-radius: 14px; }'} className="min-h-[220px] font-mono text-xs leading-5" />
          <p className="text-xs text-cv-fg-subtle">只作用于聊天区域，自动限定到 <code className="font-mono">#cv_chat_root</code> 下；右边的预览就是玩家会看到的聊天页。</p>
        </div>
        {sanitized.warnings.length > 0 && (
          <div className="rounded-cv-md border border-cv-warning/30 bg-[color-mix(in_oklab,var(--cv-warning)_10%,transparent)] px-3 py-2 text-xs text-cv-warning">
            <div className="mb-1 flex items-center gap-1 font-semibold"><AlertTriangle className="size-3.5" />清洗时做了这些处理</div>
            <ul className="list-disc pl-4">{sanitized.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-cv-fg-subtle">起手模板</span>
          {CSS_PRESETS.map((p) => (
            <Button key={p.name} type="button" size="sm" variant="neu" title={p.desc} onClick={() => applyPreset(p)}>{p.name}</Button>
          ))}
        </div>
        <details className="group">
          <summary className="cursor-pointer select-none text-xs font-semibold text-cv-fg-muted hover:text-cv-fg">可用选择器 <span className="font-normal text-cv-fg-subtle">· 点击复制</span></summary>
          <GlassPanel padding="sm" className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
            {SELECTOR_GROUPS.map((g) => (
              <div key={g.label}>
                <div className="mb-1 text-[11px] uppercase tracking-wider text-cv-fg-subtle">{g.label}</div>
                {g.items.map((it) => (
                  <button key={it.selector} type="button" onClick={() => copySel(it.selector)} className="flex w-full items-center gap-2 rounded-cv-sm px-2 py-1 text-left text-xs hover:bg-cv-fg/5">
                    <code className="shrink-0 font-mono text-cv-accent">{it.selector}</code>
                    <span className="min-w-0 flex-1 truncate text-cv-fg-muted">{it.desc}</span>
                    {copied === it.selector ? <Check className="size-3 text-cv-success" /> : <Copy className="size-3 opacity-40" />}
                  </button>
                ))}
              </div>
            ))}
          </GlassPanel>
        </details>
      </TabsContent>

      <TabsContent value="regex" className="space-y-4 pt-3">
        <p className="text-xs text-cv-fg-muted">正则脚本只改变显示，不改变发给模型的内容。兼容通用格式：`find` 是正则，`replace` 里可用 <code>$1</code> 和 <code>{'{{match}}'}</code>；勾选「输出为 HTML」后替换结果会在沙箱 iframe 里渲染（手机壳、状态栏这类美化卡就靠它）。每条脚本下面有测试台，跑的是预览里的「测试回复」。</p>
        <div className="space-y-3">
          {skin.regexScripts.map((r, i) => (
            <GlassPanel key={r.id} padding="sm" className={cn(!r.enabled && 'opacity-60')}>
              <div className="mb-2 flex items-center gap-2">
                <Switch checked={r.enabled} onCheckedChange={(v) => setScript(i, { enabled: v })} />
                <Input value={r.name} onChange={(e) => setScript(i, { name: e.target.value })} placeholder="脚本名" className="h-9 flex-1" />
                <select value={r.target} onChange={(e) => setScript(i, { target: e.target.value as RegexScript['target'] })} className="neu-in h-9 rounded-cv-sm px-2 text-xs text-cv-fg">
                  <option value="ai">AI 消息</option><option value="user">用户消息</option><option value="both">两者</option>
                </select>
                <IconButton label="删除" variant="ghost" size="sm" onClick={() => set('regexScripts', skin.regexScripts.filter((_, j) => j !== i))}><Trash2 /></IconButton>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_80px]">
                <Input value={r.find} onChange={(e) => setScript(i, { find: e.target.value })} placeholder="查找（正则，不带斜杠）" className="h-9 font-mono text-xs" spellCheck={false} />
                <Input value={r.flags} onChange={(e) => setScript(i, { flags: e.target.value.replace(/[^gimsuy]/g, '') })} placeholder="flags" className="h-9 font-mono text-xs" />
              </div>
              <Textarea value={r.replace} onChange={(e) => setScript(i, { replace: e.target.value })} placeholder="替换为（可含 HTML）" className="mt-2 min-h-20 font-mono text-xs" spellCheck={false} />
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5"><Switch checked={r.renderAsHtml} onCheckedChange={(v) => setScript(i, { renderAsHtml: v })} />输出为 HTML（沙箱渲染）</label>
                <Input value={r.trimStrings.join('\n')} onChange={(e) => setScript(i, { trimStrings: e.target.value.split('\n').filter(Boolean) })} placeholder="trim 字符串（每行一个）" className="h-8 flex-1 font-mono text-xs" />
              </div>
              <RegexTester scripts={skin.regexScripts} index={i} sample={sample} ctx={testCtx} />
            </GlassPanel>
          ))}
        </div>
        {skin.regexScripts.length === 0 && (
          <GlassPanel padding="sm" className="flex items-center gap-3 text-xs text-cv-fg-muted">
            <FlaskConical className="size-4 shrink-0 text-cv-accent" />
            还没有脚本。从模板加一个试试，或者导入美化卡自带的正则 JSON。
          </GlassPanel>
        )}
        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button type="button" size="sm" variant="accent"><LayoutTemplate /> 从模板添加</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              {REGEX_TEMPLATES.map((t) => (
                <DropdownMenuItem key={t.id} onSelect={() => addTemplate(t.id)} className="flex-col items-start gap-0.5 py-2">
                  <span className="font-semibold">{t.name}</span>
                  <span className="text-xs text-cv-fg-muted">{t.desc}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button type="button" size="sm" variant="neu" onClick={() => set('regexScripts', [...skin.regexScripts, emptyScript(skin.regexScripts.length)])}><Plus /> 空白脚本</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) importRegex(await f.text()); e.target.value = '' }} />
          <Button type="button" size="sm" variant="neu" onClick={() => fileRef.current?.click()}><Upload /> 导入正则脚本 JSON</Button>
        </div>
        <Textarea value={regexImport} onChange={(e) => setRegexImport(e.target.value)} placeholder="或把正则脚本 JSON（兼容通用格式）粘贴到这里…" className="min-h-20 font-mono text-xs" />
        {regexImport.trim() && <Button type="button" size="sm" onClick={() => importRegex(regexImport)}>导入粘贴的内容</Button>}
        {regexImportError && <p className="text-xs text-cv-danger">{regexImportError}</p>}
      </TabsContent>

      <TabsContent value="options" className="space-y-4 pt-3">
        <div className="flex items-center justify-between gap-4 rounded-cv-md neu px-4 py-3">
          <div><div className="text-sm font-semibold">渲染 AI 回复里的原生 HTML</div><div className="text-xs text-cv-fg-muted">默认开启：模型输出的 &lt;div&gt;/&lt;style&gt; 块在沙箱 iframe 里显示（状态栏、手机壳这类美化卡靠它）。关掉则按纯文本 / Markdown 显示。</div></div>
          <Switch checked={skin.renderHtml} onCheckedChange={(v) => set('renderHtml', v)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold tracking-wide text-cv-fg-muted">额外允许加载图片 / 字体的域名</Label>
          <Input value={skin.allowedUrlHosts.join(', ')} onChange={(e) => set('allowedUrlHosts', e.target.value.split(/[,\s]+/).map((h) => h.trim().toLowerCase()).filter(Boolean).slice(0, 20))} placeholder="img.example.com, cdn.example.com" />
          <p className="text-xs text-cv-fg-subtle">CSS 里 url() 默认只允许 Supabase 存储、Google Fonts 和这里列出的域名，其余会被移除。HTML 与脚本在沙箱里运行，拿不到主站任何数据。</p>
        </div>
      </TabsContent>
    </Tabs>
  )
}

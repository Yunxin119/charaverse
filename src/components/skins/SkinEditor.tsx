'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { qk } from '@/queries/keys'
import { ArrowLeft, Save, Loader2, Plus, Trash2, Upload, Copy, Check, AlertTriangle, LayoutTemplate, FlaskConical, Eye, PencilLine } from 'lucide-react'
import { supabase, type Character } from '@/app/lib/supabase'
import { parseSkin, skinSchema, type Skin } from '@/lib/skins/schema'
import { sanitizeCss } from '@/lib/skins/sanitizeCss'
import { importRegexJson, regexScriptSchema, type RegexScript } from '@/lib/skins/regexScripts'
import { REGEX_TEMPLATES } from '@/lib/skins/regexTest'
import { composeSkinCss } from '@/lib/skins/knobs'
import { KnobsPanel } from './KnobsPanel'
import { RegexTester } from './RegexTester'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { SELECTOR_GROUPS, CSS_PRESETS, SAMPLE_AI_MESSAGE } from '@/lib/skins/docs'
import { parseCharacterCard } from '@/lib/chat/characterCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Chip, GlassPanel, IconButton } from '@/components/glass'
import { SkinPreview } from './SkinPreview'
import { cn } from '@/lib/utils'

interface Props { character: Character }

const emptyScript = (i: number): RegexScript => regexScriptSchema.parse({ id: `script_${Date.now()}_${i}`, name: `脚本 ${i + 1}`, find: '', replace: '' })

export function SkinEditor({ character }: Props) {
  const router = useRouter()
  const qc = useQueryClient()
  const card = useMemo(() => parseCharacterCard(character), [character])
  const initial = useMemo(() => {
    const s = parseSkin(character.skin)
    return s.css || !card.customCss ? s : { ...s, css: card.customCss }
  }, [character.skin, card.customCss])

  const [skin, setSkin] = useState<Skin>(initial)
  const [baseline, setBaseline] = useState<Skin>(initial)
  const [pane, setPane] = useState<'edit' | 'preview'>('edit')
  const [sample, setSample] = useState(SAMPLE_AI_MESSAGE)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [regexImport, setRegexImport] = useState('')
  const [regexImportError, setRegexImportError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const dirty = JSON.stringify(skin) !== JSON.stringify(baseline)
  const composedCss = useMemo(() => composeSkinCss(skin.knobs, skin.css), [skin.knobs, skin.css])
  const sanitized = useMemo(() => sanitizeCss(composedCss, { allowedUrlHosts: skin.allowedUrlHosts }), [composedCss, skin.allowedUrlHosts])

  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const set = <K extends keyof Skin>(k: K, v: Skin[K]) => setSkin((s) => ({ ...s, [k]: v }))
  const setScript = (i: number, patch: Partial<RegexScript>) => setSkin((s) => ({ ...s, regexScripts: s.regexScripts.map((r, j) => (j === i ? { ...r, ...patch } : r)) }))

  const save = async () => {
    setSaving(true); setError(null)
    try {
      const data = skinSchema.parse(skin)
      const patch: Record<string, unknown> = { skin: data }
      // legacy custom_css lives inside prompt_template; move it out so there is one source of truth
      const tpl = (character.prompt_template ?? {}) as Record<string, unknown>
      if (tpl.custom_css !== undefined) {
        const next = { ...tpl }
        delete next.custom_css
        patch.prompt_template = next
      }
      const { error } = await supabase.from('characters').update(patch).eq('id', character.id)
      if (error) throw error
      setBaseline(skin)
      qc.setQueryData<Character>(qk.character(character.id), (old) => (old ? { ...old, ...patch } : old))
      void qc.invalidateQueries({ queryKey: qk.characters(character.user_id) })
      setSaved(true); setTimeout(() => setSaved(false), 1500)
    } catch (e) {
      setError((e as Error).message || '保存失败')
    } finally { setSaving(false) }
  }

  const copySel = async (sel: string) => { try { await navigator.clipboard.writeText(sel); setCopied(sel); setTimeout(() => setCopied(null), 1200) } catch {} }

  const importRegex = (text: string) => {
    setRegexImportError(null)
    const r = importRegexJson(text)
    if (!r.ok) { setRegexImportError(r.error); return }
    set('regexScripts', [...skin.regexScripts, ...r.scripts].slice(0, 100))
    setRegexImport('')
  }

  const testCtx = useMemo(() => ({ role: 'assistant' as const, char: card.name, user: card.userName }), [card.name, card.userName])
  const addTemplate = (id: string) => {
    const t = REGEX_TEMPLATES.find((x) => x.id === id)
    if (!t) return
    const script = regexScriptSchema.parse({ id: `${t.id}_${Date.now().toString(36)}`, ...t.script })
    set('regexScripts', [...skin.regexScripts, script].slice(0, 100))
    // give the tester something to bite on when the sample is still the default
    if (sample === SAMPLE_AI_MESSAGE || !sample.trim()) setSample(`${sample.trim()}\n\n${t.sample}`.trim())
  }
  const applyPreset = (p: (typeof CSS_PRESETS)[number]) => {
    if (skin.css.trim() && !confirm('替换当前 CSS？')) return
    set('css', p.css)
    // presets that need a regex (e.g. dialogue colouring) bring it along, once
    const t = p.regexTemplateId ? REGEX_TEMPLATES.find((x) => x.id === p.regexTemplateId) : undefined
    if (t && !skin.regexScripts.some((r) => r.name === t.script.name)) addTemplate(t.id)
  }
  return (
    <div className="flex h-dvh flex-col px-3 pt-3 sm:px-5 sm:pt-4">
      <header className="mb-3 flex flex-wrap items-center gap-3">
        <IconButton label="返回" variant="ghost" onClick={() => { if (!dirty || confirm('有未保存的修改，确定离开？')) router.back() }}><ArrowLeft /></IconButton>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-semibold sm:text-2xl">皮肤 · {card.name}</h1>
          <p className="hidden text-xs text-cv-fg-muted sm:block">CSS 只作用于聊天区域；HTML 与脚本在沙箱里运行，拿不到主站任何数据。右边就是玩家会看到的聊天页，改什么立刻能看见。</p>
        </div>
        {dirty && <Chip tone="warning">未保存</Chip>}
        <div className="neu-in inline-flex rounded-full p-0.5 lg:hidden" role="tablist" aria-label="编辑或预览">
          {([['edit', '编辑', PencilLine], ['preview', '预览', Eye]] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" role="tab" aria-selected={pane === id} onClick={() => setPane(id)} className={cn('flex items-center gap-1 rounded-full px-3 py-1 text-xs', pane === id ? 'bg-cv-bg-elevated shadow-neu-sm' : 'text-cv-fg-muted')}><Icon className="size-3.5" />{label}</button>
          ))}
        </div>
        <Button onClick={save} disabled={saving || !dirty}>{saving ? <Loader2 className="animate-spin" /> : saved ? <Check /> : <Save />}{saved ? '已保存' : '保存'}</Button>
      </header>
      {error && <p className="mb-3 text-sm text-cv-danger">{error}</p>}

      <div className="grid min-h-0 flex-1 gap-4 pb-3 lg:grid-cols-[minmax(360px,0.75fr)_minmax(0,1.25fr)] sm:pb-5">
        {/* ---------------- editor ---------------- */}
        <Tabs defaultValue="css" className={cn('min-h-0 min-w-0 overflow-y-auto pr-1', pane === 'preview' && 'hidden lg:block')}>
          <TabsList className="w-full"><TabsTrigger value="css">CSS</TabsTrigger><TabsTrigger value="regex">正则脚本 {skin.regexScripts.length ? `(${skin.regexScripts.length})` : ''}</TabsTrigger><TabsTrigger value="options">选项</TabsTrigger></TabsList>

          <TabsContent value="css" className="space-y-4 pt-3">
            <KnobsPanel value={skin.knobs} onChange={(v) => set('knobs', v)} />
            <div className="space-y-1.5">
              <Label htmlFor="skin-css">高级 CSS</Label>
              <Textarea id="skin-css" value={skin.css} onChange={(e) => set('css', e.target.value)} spellCheck={false} placeholder={'#cv_chat_root { background: #0c0c0e; }\n.cv_ai_message_bubble { border-radius: 14px; }'} className="min-h-[260px] font-mono text-xs leading-5" />
            </div>
            {sanitized.warnings.length > 0 && (
              <div className="rounded-cv-md border border-cv-warning/30 bg-[color-mix(in_oklab,var(--cv-warning)_10%,transparent)] px-3 py-2 text-xs text-cv-warning">
                <div className="mb-1 flex items-center gap-1 font-semibold"><AlertTriangle className="size-3.5" />清洗时做了这些处理</div>
                <ul className="list-disc pl-4">{sanitized.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {CSS_PRESETS.map((p) => (
                <Button key={p.name} size="sm" variant="neu" title={p.desc} onClick={() => applyPreset(p)}>{p.name}</Button>
              ))}
            </div>
            <GlassPanel padding="sm">
              <div className="mb-2 flex items-center justify-between text-xs"><span className="font-semibold">可用选择器</span><span className="text-cv-fg-subtle">点击复制</span></div>
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
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
              </div>
            </GlassPanel>
          </TabsContent>

          <TabsContent value="regex" className="space-y-4 pt-3">
            <p className="text-xs text-cv-fg-muted">正则脚本只改变显示，不改变发给模型的内容。兼容通用格式：`find` 是正则，`replace` 里可用 <code>$1</code> 和 <code>{'{{match}}'}</code>；勾选「输出为 HTML」后替换结果会在沙箱 iframe 里渲染（手机壳、状态栏这类美化卡就靠它）。</p>
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
                还没有脚本。从模板加一个试试：每条脚本下面都有测试台，用预览上方的「测试回复」改它要处理的文本。
              </GlassPanel>
            )}
            <div className="flex flex-wrap gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button size="sm" variant="accent"><LayoutTemplate /> 从模板添加</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72">
                  {REGEX_TEMPLATES.map((t) => (
                    <DropdownMenuItem key={t.id} onSelect={() => addTemplate(t.id)} className="flex-col items-start gap-0.5 py-2">
                      <span className="font-semibold">{t.name}</span>
                      <span className="text-xs text-cv-fg-muted">{t.desc}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" variant="neu" onClick={() => set('regexScripts', [...skin.regexScripts, emptyScript(skin.regexScripts.length)])}><Plus /> 空白脚本</Button>
              <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) importRegex(await f.text()); e.target.value = '' }} />
              <Button size="sm" variant="neu" onClick={() => fileRef.current?.click()}><Upload /> 导入正则脚本 JSON</Button>
            </div>
            <Textarea value={regexImport} onChange={(e) => setRegexImport(e.target.value)} placeholder="或把正则脚本 JSON（兼容通用格式）粘贴到这里…" className="min-h-20 font-mono text-xs" />
            {regexImport.trim() && <Button size="sm" onClick={() => importRegex(regexImport)}>导入粘贴的内容</Button>}
            {regexImportError && <p className="text-xs text-cv-danger">{regexImportError}</p>}
          </TabsContent>

          <TabsContent value="options" className="space-y-4 pt-3">
            <div className="flex items-center justify-between rounded-cv-md neu px-4 py-3">
              <div><div className="text-sm font-semibold">渲染 AI 回复里的原生 HTML</div><div className="text-xs text-cv-fg-muted">默认开启：模型输出的 &lt;div&gt;/&lt;style&gt; 块在沙箱 iframe 里显示（状态栏、手机壳这类美化卡靠它）。关掉则按纯文本 / Markdown 显示。</div></div>
              <Switch checked={skin.renderHtml} onCheckedChange={(v) => set('renderHtml', v)} />
            </div>
            <div className="space-y-1.5">
              <Label>额外允许加载图片 / 字体的域名</Label>
              <Input value={skin.allowedUrlHosts.join(', ')} onChange={(e) => set('allowedUrlHosts', e.target.value.split(/[,\s]+/).map((h) => h.trim().toLowerCase()).filter(Boolean).slice(0, 20))} placeholder="img.example.com, cdn.example.com" />
              <p className="text-xs text-cv-fg-subtle">CSS 里 url() 默认只允许 Supabase 存储、Google Fonts 和这里列出的域名，其余会被移除。</p>
            </div>
          </TabsContent>
        </Tabs>

        {/* ---------------- preview: the real chat page ---------------- */}
        <SkinPreview character={character} skin={skin} sample={sample} onSampleChange={setSample} className={cn('min-h-[70dvh] lg:min-h-0', pane === 'edit' && 'hidden lg:flex')} />
      </div>
    </div>
  )
}

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Loader2, Plus, Trash2, Upload, Copy, Check, AlertTriangle } from 'lucide-react'
import { supabase, type Character } from '@/app/lib/supabase'
import { parseSkin, skinSchema, type Skin } from '@/lib/skins/schema'
import { sanitizeCss } from '@/lib/skins/sanitizeCss'
import { importRegexJson, regexScriptSchema, type RegexScript } from '@/lib/skins/regexScripts'
import { SELECTOR_GROUPS, CSS_PRESETS, SAMPLE_AI_MESSAGE } from '@/lib/skins/docs'
import { parseCharacterCard } from '@/lib/chat/characterCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Chip, GlassPanel, IconButton } from '@/components/glass'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { MessageContent } from '@/components/chat/MessageContent'
import { SkinStyle } from '@/components/chat/SkinStyle'
import { cn } from '@/lib/utils'

interface Props { character: Character }

const emptyScript = (i: number): RegexScript => regexScriptSchema.parse({ id: `script_${Date.now()}_${i}`, name: `脚本 ${i + 1}`, find: '', replace: '' })

export function SkinEditor({ character }: Props) {
  const router = useRouter()
  const card = useMemo(() => parseCharacterCard(character), [character])
  const initial = useMemo(() => {
    const s = parseSkin(character.skin)
    return s.css || !card.customCss ? s : { ...s, css: card.customCss }
  }, [character.skin, card.customCss])

  const [skin, setSkin] = useState<Skin>(initial)
  const [sample, setSample] = useState(SAMPLE_AI_MESSAGE)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [regexImport, setRegexImport] = useState('')
  const [regexImportError, setRegexImportError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const dirty = JSON.stringify(skin) !== JSON.stringify(initial)
  const sanitized = useMemo(() => sanitizeCss(skin.css, { allowedUrlHosts: skin.allowedUrlHosts }), [skin.css, skin.allowedUrlHosts])

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
      setSaved(true); setTimeout(() => setSaved(false), 1500)
      router.refresh()
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

  const renderSkin = { regexScripts: skin.regexScripts, renderHtml: skin.renderHtml, char: card.name, user: card.userName }
  const noop = () => {}
  const now = new Date().toISOString()
  const previewMsgs = [
    { id: 1, session_id: 'p', role: 'assistant' as const, content: '雨还没停。你要是不急着走，我这儿还有半壶热茶。', type: 'message' as const, created_at: now },
    { id: 2, session_id: 'p', role: 'user' as const, content: '不急。茶就茶吧，反正也睡不着。', type: 'message' as const, created_at: now },
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <IconButton label="返回" variant="ghost" onClick={() => { if (!dirty || confirm('有未保存的修改，确定离开？')) router.back() }}><ArrowLeft /></IconButton>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-semibold">皮肤 · {card.name}</h1>
          <p className="text-xs text-cv-fg-muted">CSS 只作用于聊天区域；HTML 与脚本在沙箱里运行，拿不到主站任何数据。</p>
        </div>
        {dirty && <Chip tone="warning">未保存</Chip>}
        <Button onClick={save} disabled={saving || !dirty}>{saving ? <Loader2 className="animate-spin" /> : saved ? <Check /> : <Save />}{saved ? '已保存' : '保存'}</Button>
      </header>
      {error && <p className="mb-3 text-sm text-cv-danger">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
        {/* ---------------- editor ---------------- */}
        <Tabs defaultValue="css" className="min-w-0">
          <TabsList className="w-full"><TabsTrigger value="css">CSS</TabsTrigger><TabsTrigger value="regex">正则脚本 {skin.regexScripts.length ? `(${skin.regexScripts.length})` : ''}</TabsTrigger><TabsTrigger value="options">选项</TabsTrigger></TabsList>

          <TabsContent value="css" className="space-y-4 pt-3">
            <Textarea value={skin.css} onChange={(e) => set('css', e.target.value)} spellCheck={false} placeholder={'#cv_chat_root { background: #0c0c0e; }\n.cv_ai_message_bubble { border-radius: 14px; }'} className="min-h-[320px] font-mono text-xs leading-5" />
            {sanitized.warnings.length > 0 && (
              <div className="rounded-cv-md border border-cv-warning/30 bg-[color-mix(in_oklab,var(--cv-warning)_10%,transparent)] px-3 py-2 text-xs text-cv-warning">
                <div className="mb-1 flex items-center gap-1 font-semibold"><AlertTriangle className="size-3.5" />清洗时做了这些处理</div>
                <ul className="list-disc pl-4">{sanitized.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {CSS_PRESETS.map((p) => <Button key={p.name} size="sm" variant="neu" onClick={() => { if (!skin.css.trim() || confirm('替换当前 CSS？')) set('css', p.css) }}>{p.name}</Button>)}
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
            <p className="text-xs text-cv-fg-muted">正则脚本只改变显示，不改变发给模型的内容。格式与酒馆一致：`find` 是正则，`replace` 里可用 <code>$1</code> 和 <code>{'{{match}}'}</code>；勾选「输出为 HTML」后替换结果会在沙箱 iframe 里渲染（手机壳、状态栏这类美化卡就靠它）。</p>
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
                </GlassPanel>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="neu" onClick={() => set('regexScripts', [...skin.regexScripts, emptyScript(skin.regexScripts.length)])}><Plus /> 新建脚本</Button>
              <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) importRegex(await f.text()); e.target.value = '' }} />
              <Button size="sm" variant="neu" onClick={() => fileRef.current?.click()}><Upload /> 导入酒馆正则 JSON</Button>
            </div>
            <Textarea value={regexImport} onChange={(e) => setRegexImport(e.target.value)} placeholder="或把酒馆的 regex 脚本 JSON 粘贴到这里…" className="min-h-20 font-mono text-xs" />
            {regexImport.trim() && <Button size="sm" onClick={() => importRegex(regexImport)}>导入粘贴的内容</Button>}
            {regexImportError && <p className="text-xs text-cv-danger">{regexImportError}</p>}
          </TabsContent>

          <TabsContent value="options" className="space-y-4 pt-3">
            <div className="flex items-center justify-between rounded-cv-md neu px-4 py-3">
              <div><div className="text-sm font-semibold">渲染 AI 回复里的原生 HTML</div><div className="text-xs text-cv-fg-muted">让模型直接输出的 &lt;div&gt;/&lt;style&gt; 块在沙箱里显示（design by censy 那类美化卡需要开启）</div></div>
              <Switch checked={skin.renderHtml} onCheckedChange={(v) => set('renderHtml', v)} />
            </div>
            <div className="space-y-1.5">
              <Label>额外允许加载图片 / 字体的域名</Label>
              <Input value={skin.allowedUrlHosts.join(', ')} onChange={(e) => set('allowedUrlHosts', e.target.value.split(/[,\s]+/).map((h) => h.trim().toLowerCase()).filter(Boolean).slice(0, 20))} placeholder="img.example.com, cdn.example.com" />
              <p className="text-xs text-cv-fg-subtle">CSS 里 url() 默认只允许 Supabase 存储、Google Fonts 和这里列出的域名，其余会被移除。</p>
            </div>
          </TabsContent>
        </Tabs>

        {/* ---------------- preview ---------------- */}
        <div className="min-w-0 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-cv-fg-subtle">实时预览</div>
          <SkinStyle css={skin.css} allowedUrlHosts={skin.allowedUrlHosts} />
          <div id="cv_chat_root" className="relative flex h-[560px] flex-col overflow-hidden rounded-cv-lg border border-cv-border bg-cv-bg">
            <div id="cv_background_overlay" aria-hidden className="pointer-events-none absolute inset-0 -z-10" />
            <div id="cv_chat_header" className="px-3 pt-3"><div className="glass flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold"><span id="cv_back_button" className="text-cv-fg-muted">←</span>{card.name}</div></div>
            <div id="cv_chat_body" className="min-h-0 flex-1 overflow-y-auto">
              <div id="cv_messages_container" className="flex flex-col gap-4 px-3 py-4">
                {previewMsgs.map((m) => (
                  <MessageBubble key={m.id} message={m} speaker={m.role === 'user' ? { name: card.userName } : { name: card.name, avatarUrl: character.avatar_url }} skin={renderSkin} isLast={false} selected={false} onSelect={noop} editing={false} onEditSave={noop} onEditCancel={noop} />
                ))}
                <div className="cv_message_row cv_message_row_ai flex items-end gap-2.5">
                  <div className="cv_message_avatar cv_ai_avatar flex size-9 items-center justify-center rounded-cv-sm bg-cv-secondary text-xs font-semibold">{card.name.slice(0, 1)}</div>
                  <div className="cv_message_bubble cv_ai_message_bubble glass-strong max-w-[82%] rounded-cv-lg rounded-bl-md px-4 py-2.5 text-cv-fg">
                    <MessageContent text={sample} role="assistant" skin={renderSkin} />
                  </div>
                </div>
              </div>
            </div>
            <div id="cv_chat_input_container" className="px-3 pb-3"><div id="cv_chat_input_box" className="neu-in flex items-center gap-2 rounded-cv-xl py-2 pl-4 pr-2"><span id="cv_chat_input_textarea" className="flex-1 text-sm text-cv-fg-subtle">说点什么…</span><span id="cv_send_button" className="flex size-9 items-center justify-center rounded-full bg-cv-accent text-white">↑</span></div></div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="skin-sample">测试用的 AI 回复（可粘贴美化卡输出）</Label>
            <Textarea id="skin-sample" value={sample} onChange={(e) => setSample(e.target.value)} className="min-h-28 font-mono text-xs" spellCheck={false} />
          </div>
        </div>
      </div>
    </div>
  )
}

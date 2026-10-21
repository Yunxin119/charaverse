'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Save, RotateCcw, Check, Copy } from 'lucide-react'
import { useAuth } from '@/providers/AuthProvider'
import { useResetSummaryTask, useSaveSummaryTask, useSummaryTask } from '@/queries/useTaskPrompts'
import { DEFAULT_SUMMARY_TASK, SUMMARY_PLACEHOLDERS, summaryTaskSchema, type SummaryTask } from '@/lib/tasks/summary'
import { estimateTokens } from '@/lib/prompt/tokens'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Chip, GlassPanel } from '@/components/glass'

function Area({ id, label, value, onChange, rows = 10, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between"><Label htmlFor={id}>{label}</Label><span className="text-[11px] text-cv-fg-subtle">≈ {estimateTokens(value)} tokens</span></div>
      <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={rows} spellCheck={false} className="font-mono text-xs leading-5" />
      {hint && <p className="text-xs text-cv-fg-subtle">{hint}</p>}
    </div>
  )
}

export default function TaskPromptsPage() {
  const { user } = useAuth()
  const q = useSummaryTask(user?.id)
  const save = useSaveSummaryTask(user?.id)
  const reset = useResetSummaryTask(user?.id)
  const [draft, setDraft] = useState<SummaryTask | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => { if (q.data && !draft) setDraft(q.data.task) }, [q.data, draft])
  const dirty = useMemo(() => !!draft && !!q.data && JSON.stringify(draft) !== JSON.stringify(q.data.task), [draft, q.data])

  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  if (!user || q.isLoading || !draft) return <div className="flex h-dvh items-center justify-center text-cv-fg-muted"><Loader2 className="mr-2 size-5 animate-spin" />加载…</div>

  const set = <K extends keyof SummaryTask>(k: K, v: SummaryTask[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d))
  const onSave = async () => {
    setError(null)
    const r = summaryTaskSchema.safeParse(draft)
    if (!r.success) { setError(r.error.issues[0]?.message ?? '格式错误'); return }
    try { await save.mutateAsync(r.data); setSaved(true); setTimeout(() => setSaved(false), 1500) } catch (e) { setError((e as Error).message || '保存失败') }
  }
  const onReset = async () => {
    if (!confirm('恢复默认的任务提示词？你的修改会被删除。')) return
    await reset.mutateAsync()
    setDraft(DEFAULT_SUMMARY_TASK)
  }
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); setCopied(t); setTimeout(() => setCopied(null), 1200) } catch {} }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">任务提示词</h1>
          <p className="mt-1 text-sm text-cv-fg-muted">「摘要 + 记忆提取」用的 prompt。对话本身的 prompt 由预设决定，这里只管后台任务。</p>
        </div>
        <div className="flex items-center gap-2">
          {q.data?.isCustom ? <Chip tone="info">已自定义</Chip> : <Chip tone="outline">默认</Chip>}
          {dirty && <Chip tone="warning">未保存</Chip>}
          <Button variant="ghost" size="sm" onClick={onReset} disabled={reset.isPending || !q.data?.isCustom}><RotateCcw /> 恢复默认</Button>
          <Button size="sm" onClick={onSave} disabled={!dirty || save.isPending}>{save.isPending ? <Loader2 className="animate-spin" /> : saved ? <Check /> : <Save />}{saved ? '已保存' : '保存'}</Button>
        </div>
      </header>
      {error && <p className="mb-3 text-sm text-cv-danger">{error}</p>}

      <GlassPanel padding="sm" className="mb-4">
        <div className="mb-2 text-xs font-semibold">可用占位符（点击复制）</div>
        <div className="flex flex-wrap gap-1.5">
          {SUMMARY_PLACEHOLDERS.map((p) => (
            <Chip key={p.token} tone="outline" interactive onClick={() => copy(p.token)} title={p.desc}>
              <code className="font-mono">{p.token}</code>{copied === p.token ? <Check className="size-3 text-cv-success" /> : <Copy className="size-3 opacity-40" />}
            </Chip>
          ))}
        </div>
      </GlassPanel>

      <Tabs defaultValue="memory">
        <TabsList className="w-full sm:w-auto"><TabsTrigger value="memory">摘要 + 记忆表</TabsTrigger><TabsTrigger value="story">纯故事摘要</TabsTrigger><TabsTrigger value="style">风格范例 / 采样</TabsTrigger></TabsList>
        <TabsContent value="memory" className="space-y-4 pt-3">
          <Area id="m-sys" label="System 指令" value={draft.memory.system} onChange={(v) => set('memory', { ...draft.memory, system: v })} rows={4} />
          <Area id="m-tpl" label="任务模板" value={draft.memory.template} onChange={(v) => set('memory', { ...draft.memory, template: v })} rows={28}
            hint="模型必须返回 { summary, memories[] } 的 JSON；memories 的 type 只认 8 种，服务端会校验并丢掉不合格的条目。" />
        </TabsContent>
        <TabsContent value="story" className="space-y-4 pt-3">
          <Area id="s-sys" label="System 指令" value={draft.story.system} onChange={(v) => set('story', { ...draft.story, system: v })} rows={4} />
          <Area id="s-tpl" label="任务模板" value={draft.story.template} onChange={(v) => set('story', { ...draft.story, template: v })} rows={28} hint="在记忆页关闭「记忆表格格式」时使用，只生成故事化摘要。" />
        </TabsContent>
        <TabsContent value="style" className="space-y-4 pt-3">
          <Area id="style" label="风格范例（{{style_example}}）" value={draft.styleExample} onChange={(v) => set('styleExample', v)} rows={16} hint="一段「输入对话 → 输出故事」的示范，教模型你想要的文风。留空则不注入。" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="temp">Temperature</Label><Input id="temp" type="number" min={0} max={2} step={0.05} value={draft.sampling.temperature} onChange={(e) => set('sampling', { ...draft.sampling, temperature: Number(e.target.value) })} /></div>
            <div className="space-y-1.5"><Label htmlFor="maxt">最大输出 token</Label><Input id="maxt" type="number" min={256} max={65536} step={256} value={draft.sampling.max_tokens} onChange={(e) => set('sampling', { ...draft.sampling, max_tokens: Number(e.target.value) })} /></div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

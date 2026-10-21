'use client'

import { useState } from 'react'
import { Plus, Plug, Trash2, Pencil, Zap, Loader2, Check, X, Star } from 'lucide-react'
import { useConnectionsStore } from '@/stores/connections'
import { KIND_LABEL, KIND_DEFAULT_MODELS, KIND_NEEDS_BASE_URL, savedConnectionSchema, type SavedConnection } from '@/lib/connections/types'
import { encodeConnection, CONNECTION_HEADER, connectionKinds } from '@/lib/llm/connection'
import { authedFetch } from '@/lib/authedFetch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Chip, GlassPanel, IconButton, PosterCard, PosterTitle, StatusDot } from '@/components/glass'
import { cn } from '@/lib/utils'

type Draft = { id?: string; name: string; kind: SavedConnection['kind']; apiKey: string; baseUrl: string; modelsText: string; defaultModel: string; enabled: boolean }
const emptyDraft = (): Draft => ({ name: '', kind: 'openai-compatible', apiKey: '', baseUrl: '', modelsText: '', defaultModel: '', enabled: true })
const toDraft = (c: SavedConnection): Draft => ({ id: c.id, name: c.name, kind: c.kind, apiKey: c.apiKey, baseUrl: c.baseUrl ?? '', modelsText: c.models.join('\n'), defaultModel: c.defaultModel ?? c.models[0] ?? '', enabled: c.enabled })

function mask(key: string) { return key.length <= 8 ? '••••' : `${key.slice(0, 4)}…${key.slice(-4)}` }

export default function ConnectionsPage() {
  const connections = useConnectionsStore((s) => s.connections)
  const hydrated = useConnectionsStore((s) => s.hydrated)
  const add = useConnectionsStore((s) => s.add)
  const update = useConnectionsStore((s) => s.update)
  const remove = useConnectionsStore((s) => s.remove)
  const setLastTest = useConnectionsStore((s) => s.setLastTest)

  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [testing, setTesting] = useState<string | null>(null)

  const save = () => {
    if (!draft) return
    setError(null)
    const models = draft.modelsText.split(/[\n,]+/).map((m) => m.trim()).filter(Boolean)
    const r = savedConnectionSchema.safeParse({
      id: draft.id ?? 'tmp', name: draft.name.trim(), kind: draft.kind, apiKey: draft.apiKey.trim(),
      baseUrl: KIND_NEEDS_BASE_URL[draft.kind] || draft.baseUrl.trim() ? draft.baseUrl.trim() : undefined,
      models, defaultModel: models.includes(draft.defaultModel) ? draft.defaultModel : models[0], enabled: draft.enabled, createdAt: Date.now(),
    })
    if (!r.success) { setError(r.error.issues[0]?.message ?? '填写不完整'); return }
    if (KIND_NEEDS_BASE_URL[draft.kind] && !r.data.baseUrl) { setError('中转连接需要填写 Base URL'); return }
    if (draft.id) update(draft.id, r.data)
    else add(r.data)
    setDraft(null)
  }

  const test = async (c: SavedConnection, model?: string) => {
    setTesting(c.id)
    try {
      const m = model ?? c.defaultModel ?? c.models[0]
      const res = await authedFetch('/api/connections/test', { method: 'POST', headers: { [CONNECTION_HEADER]: encodeConnection({ kind: c.kind, apiKey: c.apiKey, baseUrl: c.baseUrl, model: m, label: c.name }) } })
      const j = await res.json().catch(() => ({}))
      setLastTest(c.id, { ok: !!j.ok, at: Date.now(), latencyMs: j.latencyMs, error: j.ok ? undefined : j.error || `HTTP ${res.status}` })
    } catch (e) {
      setLastTest(c.id, { ok: false, at: Date.now(), error: (e as Error).message })
    } finally { setTesting(null) }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">API 连接</h1>
          <p className="mt-1 text-sm text-cv-fg-muted">Key 只保存在这台设备的浏览器里，每次请求随请求头发给你自己的服务端转发，不会写入数据库。</p>
        </div>
        <Button variant="accent" size="sm" onClick={() => { setError(null); setDraft(emptyDraft()) }}><Plus /> 添加连接</Button>
      </header>

      {!hydrated && <div className="flex items-center gap-2 text-sm text-cv-fg-muted"><Loader2 className="size-4 animate-spin" />读取本地配置…</div>}

      {hydrated && connections.length === 0 && (
        <PosterCard tone="ink" className="mb-6">
          <PosterTitle>还没有任何连接</PosterTitle>
          <p className="mt-2 max-w-md text-sm opacity-80">添加一个 OpenAI 兼容中转、Gemini、DeepSeek、OpenAI 或 Claude 的 Key，聊天才能开始。可以加多个，每个对话单独选模型。</p>
          <Button className="mt-5" variant="accent" onClick={() => setDraft(emptyDraft())}><Plug /> 添加第一个连接</Button>
        </PosterCard>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {connections.map((c) => (
          <GlassPanel key={c.id} padding="sm" className={cn('flex flex-col gap-3', !c.enabled && 'opacity-60')}>
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-cv-sm bg-cv-secondary text-cv-secondary-fg"><Plug className="size-4" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{c.name}</span>
                  <Chip tone="outline">{KIND_LABEL[c.kind]}</Chip>
                  {c.lastTest && (
                    <Chip tone={c.lastTest.ok ? 'success' : 'danger'}><StatusDot tone={c.lastTest.ok ? 'success' : 'danger'} />{c.lastTest.ok ? `${c.lastTest.latencyMs ?? '?'} ms` : '失败'}</Chip>
                  )}
                </div>
                <div className="mt-0.5 truncate font-mono text-[11px] text-cv-fg-subtle">{c.baseUrl ? `${c.baseUrl} · ` : ''}{mask(c.apiKey)}</div>
                {c.lastTest && !c.lastTest.ok && c.lastTest.error && <div className="mt-1 text-xs text-cv-danger">{c.lastTest.error}</div>}
              </div>
              <Switch checked={c.enabled} onCheckedChange={(v) => update(c.id, { enabled: v })} aria-label="启用" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {c.models.map((m) => (
                <button key={m} type="button" title="设为默认模型" onClick={() => update(c.id, { defaultModel: m })} className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', m === (c.defaultModel ?? c.models[0]) ? 'bg-cv-primary text-cv-primary-fg' : 'bg-cv-secondary/60 text-cv-fg')}>
                  {m === (c.defaultModel ?? c.models[0]) && <Star className="size-3" />}{m}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-end gap-1">
              <Button size="sm" variant="neu" disabled={testing === c.id} onClick={() => void test(c)}>{testing === c.id ? <Loader2 className="animate-spin" /> : <Zap />} 测试</Button>
              <IconButton label="编辑" variant="ghost" size="sm" onClick={() => { setError(null); setDraft(toDraft(c)) }}><Pencil /></IconButton>
              <IconButton label="删除" variant="ghost" size="sm" onClick={() => { if (confirm(`删除连接「${c.name}」？用它的对话需要重新选模型。`)) remove(c.id) }}><Trash2 /></IconButton>
            </div>
          </GlassPanel>
        ))}
      </div>

      <Dialog open={!!draft} onOpenChange={(v) => { if (!v) setDraft(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">{draft?.id ? '编辑连接' : '添加连接'}</DialogTitle>
            <DialogDescription>中转站填 Base URL（不含 /chat/completions），官方 API 留空即可。</DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>名称</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="如：主力中转 / 我的 Gemini" /></div>
                <div className="space-y-1.5"><Label>类型</Label>
                  <Select value={draft.kind} onValueChange={(v) => { const kind = v as SavedConnection['kind']; setDraft({ ...draft, kind, modelsText: draft.modelsText || KIND_DEFAULT_MODELS[kind].join('\n') }) }}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{connectionKinds.map((k) => <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {(KIND_NEEDS_BASE_URL[draft.kind] || draft.baseUrl) && (
                <div className="space-y-1.5"><Label>Base URL</Label><Input value={draft.baseUrl} onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })} placeholder="https://api.example.com 或 https://api.example.com/v1" className="font-mono text-xs" /></div>
              )}
              <div className="space-y-1.5"><Label>API Key</Label><Input type="password" autoComplete="off" value={draft.apiKey} onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })} className="font-mono text-xs" /></div>
              <div className="space-y-1.5"><Label>模型（每行一个）</Label>
                <textarea value={draft.modelsText} onChange={(e) => setDraft({ ...draft, modelsText: e.target.value })} rows={4} spellCheck={false} className="neu-in w-full rounded-cv-md px-4 py-3 font-mono text-xs text-cv-fg outline-none focus-visible:ring-2 focus-visible:ring-cv-ring" placeholder={KIND_DEFAULT_MODELS[draft.kind].join('\n') || 'gpt-4o\nclaude-sonnet-4-5'} />
              </div>
              <div className="flex items-center justify-between rounded-cv-md neu px-4 py-3"><span className="text-sm">启用</span><Switch checked={draft.enabled} onCheckedChange={(v) => setDraft({ ...draft, enabled: v })} /></div>
              {error && <p className="flex items-center gap-1 text-sm text-cv-danger"><X className="size-4" />{error}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setDraft(null)}>取消</Button>
                <Button onClick={save}><Check /> 保存</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

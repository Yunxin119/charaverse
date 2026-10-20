'use client'

import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Trash2, Loader2 } from 'lucide-react'
import { GlassSheet, GlassSheetContent } from '@/components/glass'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { SessionSettings } from '@/lib/chat/settings'
import type { UserPreset } from '@/app/lib/supabase'
import { uploadChatBackground, removeChatBackground } from '@/lib/chat/background'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  sessionId: string
  userId: string
  title: string
  settings: SessionSettings
  models: { id: string; label: string }[]
  presets: UserPreset[]
  builtinPresetName: string
  saving?: boolean
  onSave: (patch: { title?: string; settings: Partial<SessionSettings> }) => Promise<void>
  onClearMessages: () => Promise<void>
}

const BUILTIN = '__builtin__'

export function ChatSettingsSheet({ open, onOpenChange, sessionId, userId, title, settings, models, presets, builtinPresetName, saving, onSave, onClearMessages }: Props) {
  const [draft, setDraft] = useState<SessionSettings>(settings)
  const [draftTitle, setDraftTitle] = useState(title)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (open) { setDraft(settings); setDraftTitle(title); setError(null) } }, [open, settings, title])

  const set = <K extends keyof SessionSettings>(k: K, v: SessionSettings[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const pickBackground = async (file: File) => {
    setUploading(true); setError(null)
    try {
      const url = await uploadChatBackground(userId, sessionId, file)
      set('background', { ...draft.background, url })
    } catch (e) {
      setError((e as Error).message || '上传失败')
    } finally {
      setUploading(false)
    }
  }
  const clearBackground = async () => {
    await removeChatBackground(userId, sessionId).catch(() => {})
    set('background', { ...draft.background, url: undefined })
  }

  const save = async () => {
    setError(null)
    try {
      await onSave({ title: draftTitle !== title ? draftTitle : undefined, settings: draft })
      onOpenChange(false)
    } catch (e) {
      setError((e as Error).message || '保存失败')
    }
  }

  return (
    <GlassSheet open={open} onOpenChange={onOpenChange}>
      <GlassSheetContent title="会话设置" side="right">
        <div className="space-y-6 pb-2">
          <section className="space-y-2">
            <Label htmlFor="cv-title">会话标题</Label>
            <Input id="cv-title" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} />
          </section>

          <section className="space-y-2">
            <Label>模型</Label>
            <Select value={draft.model ?? ''} onValueChange={(v) => set('model', v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="选择模型" /></SelectTrigger>
              <SelectContent>
                {models.length === 0 && <div className="px-3 py-2 text-sm text-cv-fg-muted">还没有配置任何 API，去「我的 → API」添加</div>}
                {models.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </section>

          <section className="space-y-2">
            <Label>预设</Label>
            <Select value={draft.presetId ?? BUILTIN} onValueChange={(v) => set('presetId', v === BUILTIN ? null : v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={BUILTIN}>{builtinPresetName}（内置）</SelectItem>
                {presets.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}{p.is_default ? ' · 默认' : ''}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-cv-fg-subtle">预设决定 system prompt 的组装顺序与采样参数。<a href="/settings/presets" className="text-cv-accent underline underline-offset-2">管理 / 导入预设</a></p>
          </section>

          <section className="space-y-3">
            <Label>上下文</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-xs text-cv-fg-muted">历史 token 上限</span>
                <Input type="number" min={1000} max={200000} step={1000} value={draft.context.maxTokens}
                  onChange={(e) => set('context', { ...draft.context, maxTokens: Number(e.target.value) || 8000 })} />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-cv-fg-muted">至少保留最近 N 条</span>
                <Input type="number" min={2} max={200} value={draft.context.keepRecent}
                  onChange={(e) => set('context', { ...draft.context, keepRecent: Number(e.target.value) || 20 })} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-cv-md neu px-4 py-3">
              <span className="text-sm">注入剧情摘要</span>
              <Switch checked={draft.context.useSummaries} onCheckedChange={(v) => set('context', { ...draft.context, useSummaries: v })} />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-cv-fg-muted">每累积 N 条未摘要消息自动整理（0 = 关闭）</span>
              <Input type="number" min={0} max={500} value={draft.context.autoSummaryEvery}
                onChange={(e) => set('context', { ...draft.context, autoSummaryEvery: Math.max(0, Number(e.target.value) || 0) })} />
            </div>
            <div className="flex items-center justify-between rounded-cv-md neu px-4 py-3">
              <span className="text-sm">注入记忆表</span>
              <Switch checked={draft.context.useMemory} onCheckedChange={(v) => set('context', { ...draft.context, useMemory: v })} />
            </div>
          </section>

          <section className="space-y-2">
            <Label htmlFor="cv-username">你在对话里的名字</Label>
            <Input id="cv-username" placeholder="留空则用角色卡里的用户设定" value={draft.userName ?? ''} onChange={(e) => set('userName', e.target.value || undefined)} />
          </section>

          <section className="space-y-3">
            <Label>聊天背景</Label>
            <div className="flex items-center gap-3">
              <div className="size-16 shrink-0 overflow-hidden rounded-cv-md neu-in bg-cover bg-center" style={{ backgroundImage: draft.background.url ? `url(${draft.background.url})` : undefined }} />
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void pickBackground(f); e.target.value = '' }} />
              <Button variant="neu" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />} 上传图片
              </Button>
              {draft.background.url && <Button variant="ghost" size="sm" onClick={clearBackground}><Trash2 /> 移除</Button>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-xs text-cv-fg-muted">不透明度 {Math.round(draft.background.opacity * 100)}%
                <input type="range" min={0.1} max={1} step={0.05} value={draft.background.opacity} className="w-full accent-[var(--cv-accent)]"
                  onChange={(e) => set('background', { ...draft.background, opacity: Number(e.target.value) })} />
              </label>
              <label className="space-y-1 text-xs text-cv-fg-muted">模糊 {draft.background.blur}px
                <input type="range" min={0} max={40} step={1} value={draft.background.blur} className="w-full accent-[var(--cv-accent)]"
                  onChange={(e) => set('background', { ...draft.background, blur: Number(e.target.value) })} />
              </label>
            </div>
          </section>

          {error && <p className="text-sm text-cv-danger">{error}</p>}

          <div className="flex items-center justify-between gap-2 pt-2">
            <Button variant="ghost" size="sm" className="text-cv-danger hover:bg-cv-danger/10" onClick={async () => { if (confirm('清空本会话的所有消息？此操作不可恢复。')) { await onClearMessages(); onOpenChange(false) } }}>
              <Trash2 /> 清空对话
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>取消</Button>
              <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : null}保存</Button>
            </div>
          </div>
        </div>
      </GlassSheetContent>
    </GlassSheet>
  )
}

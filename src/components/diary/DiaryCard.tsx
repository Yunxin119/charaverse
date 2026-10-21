'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Loader2, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import type { Diary } from '@/app/lib/supabase'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Chip, GlassPanel, IconButton } from '@/components/glass'
import { Markdown } from '@/components/chat/Markdown'
import { cn } from '@/lib/utils'

interface Props {
  diary: Diary
  characterName: string
  /** another diary is being generated / regenerated: lock the AI actions */
  busy: boolean
  regenerating: boolean
  deleting: boolean
  saving: boolean
  /** resolves true when saved; the card stays in edit mode otherwise */
  onSave: (content: string) => Promise<boolean>
  onRegenerate: () => void
  onDelete: () => void
}

function dateParts(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { day: '', meta: '' }
  return { day: format(d, 'yyyy年M月d日', { locale: zhCN }), meta: format(d, 'EEEE HH:mm', { locale: zhCN }) }
}

export function DiaryCard({ diary, characterName, busy, regenerating, deleting, saving, onSave, onRegenerate, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(diary.content)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { day, meta } = dateParts(diary.created_at)
  const hasRange = diary.source_message_id_start != null && diary.source_message_id_end != null

  const startEdit = () => {
    setDraft(diary.content)
    setEditing(true)
    setConfirmDelete(false)
  }
  const save = async () => {
    const next = draft.trim()
    if (!next || next === diary.content) {
      setEditing(false)
      return
    }
    if (await onSave(next)) setEditing(false)
  }

  return (
    <GlassPanel padding="none" className={cn('overflow-hidden', deleting && 'opacity-60')}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-7 sm:pt-6">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-semibold leading-tight tracking-tight">{day}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-cv-fg-muted">
            <span>{meta}</span>
            <span aria-hidden>·</span>
            <span>{characterName}</span>
            {hasRange && (
              <Chip tone="outline" className="font-mono font-medium">
                消息 #{diary.source_message_id_start} – #{diary.source_message_id_end}
              </Chip>
            )}
          </div>
        </div>
        {!editing && (
          <div className="flex items-center gap-1">
            <IconButton label="编辑" size="sm" onClick={startEdit} disabled={regenerating || deleting}><Pencil /></IconButton>
            <IconButton label="重新生成" size="sm" onClick={onRegenerate} disabled={busy || deleting}>
              {regenerating ? <Loader2 className="animate-spin" /> : <RotateCcw />}
            </IconButton>
            <IconButton label="删除" size="sm" onClick={() => setConfirmDelete((v) => !v)} disabled={regenerating || deleting} className={cn(confirmDelete && 'text-cv-danger')}>
              <Trash2 />
            </IconButton>
          </div>
        )}
      </header>

      {confirmDelete && !editing && (
        <div className="mx-5 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-cv-md bg-[color-mix(in_oklab,var(--cv-danger)_10%,transparent)] px-4 py-2.5 text-sm text-cv-danger sm:mx-7">
          <span>删除这篇日记？此操作不可撤销。</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>取消</Button>
            <Button size="sm" variant="destructive" onClick={() => { setConfirmDelete(false); onDelete() }} disabled={deleting}>
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}删除
            </Button>
          </div>
        </div>
      )}

      <div className="px-5 pb-5 pt-4 sm:px-7 sm:pb-7">
        {editing ? (
          <div className="space-y-3">
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="编辑日记内容…" className="min-h-60 leading-relaxed" aria-label="日记内容" />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>取消</Button>
              <Button size="sm" onClick={() => void save()} disabled={saving || !draft.trim()}>
                {saving && <Loader2 className="animate-spin" />}保存
              </Button>
            </div>
          </div>
        ) : regenerating ? (
          <div className="flex items-center gap-2 py-8 text-sm text-cv-fg-muted">
            <Loader2 className="size-4 animate-spin" />{characterName} 正在重写这一篇…
          </div>
        ) : (
          <Markdown text={diary.content} className="leading-[1.8] text-cv-fg" />
        )}
      </div>
    </GlassPanel>
  )
}

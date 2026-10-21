'use client'

import { useState } from 'react'
import { Pencil, RefreshCw, Trash2, Loader2, Layers } from 'lucide-react'
import { Chip, IconButton, StatusDot, PosterCard, PosterTitle, CardSkeleton } from '@/components/glass'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { SummaryRow } from '@/queries/useSummaries'

interface Props {
  summaries: SummaryRow[] | undefined
  loading?: boolean
  /** 1-based ordinal of a message id inside the session, when known */
  indexOf?: (messageId: number) => number | null
  /** generation is possible (a model connection is available) */
  canGenerate: boolean
  regeneratingId?: number | null
  deletingId?: number | null
  onSave: (summary: SummaryRow, content: string) => Promise<void>
  onRegenerate: (summary: SummaryRow) => Promise<void>
  onDelete: (summary: SummaryRow) => Promise<void>
}

const fmtTime = (iso: string) => new Date(iso).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

export function rangeLabel(s: Pick<SummaryRow, 'start_message_id' | 'end_message_id'>, indexOf?: (id: number) => number | null): { ids: string; ordinals: string | null } {
  if (!s.start_message_id || !s.end_message_id) return { ids: '范围未知', ordinals: null }
  const a = indexOf?.(s.start_message_id)
  const b = indexOf?.(s.end_message_id)
  return { ids: `#${s.start_message_id}–#${s.end_message_id}`, ordinals: a && b ? `第 ${a}–${b} 条` : null }
}

function SummaryItem({ s, indexOf, canGenerate, regenerating, deleting, onSave, onRegenerate, onDelete }: {
  s: SummaryRow
  indexOf?: Props['indexOf']
  canGenerate: boolean
  regenerating: boolean
  deleting: boolean
  onSave: Props['onSave']
  onRegenerate: Props['onRegenerate']
  onDelete: Props['onDelete']
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(s.content)
  const [expanded, setExpanded] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = regenerating || deleting || saving
  const range = rangeLabel(s, indexOf)
  const long = s.content.length > 320
  const hasRange = !!s.start_message_id && !!s.end_message_id

  const save = async () => {
    setSaving(true); setError(null)
    try { await onSave(s, draft.trim()); setEditing(false) }
    catch (e) { setError((e as Error).message || '保存失败') }
    finally { setSaving(false) }
  }

  return (
    <li className="relative pl-7">
      <span className="absolute left-0 top-5 flex size-4 items-center justify-center">
        <StatusDot tone={regenerating ? 'warning' : deleting ? 'danger' : 'success'} pulse={regenerating} className="size-2.5" />
      </span>
      <div className={cn('glass rounded-cv-lg p-4 transition-opacity', deleting && 'opacity-50')} aria-busy={busy}>
        <header className="flex flex-wrap items-center gap-2">
          <Chip tone="primary" className="font-mono">{range.ids}</Chip>
          {range.ordinals && <Chip tone="outline">{range.ordinals}</Chip>}
          <Chip tone={s.summary_level > 1 ? 'accent' : 'flat'} title="摘要层级"><Layers className="size-3" />L{s.summary_level}</Chip>
          <span className="ml-auto text-[11px] text-cv-fg-subtle">{fmtTime(s.created_at)}</span>
        </header>

        {editing ? (
          <div className="mt-3 space-y-2">
            <Textarea value={draft} rows={8} onChange={(e) => setDraft(e.target.value)} />
            {error && <p role="alert" className="text-sm text-cv-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(s.content) }} disabled={saving}>取消</Button>
              <Button size="sm" variant="accent" onClick={() => void save()} disabled={saving || !draft.trim()}>{saving && <Loader2 className="animate-spin" />}保存</Button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-cv-fg">
              {expanded || !long ? s.content : `${s.content.slice(0, 320)}…`}
            </p>
            {long && (
              <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 text-xs font-semibold text-cv-accent hover:underline">{expanded ? '收起' : '展开全文'}</button>
            )}
          </>
        )}

        {!editing && (
          <footer className="mt-3 flex items-center gap-1 border-t border-cv-border pt-3">
            {confirming ? (
              <div className="flex w-full flex-wrap items-center gap-2 text-xs text-cv-fg-muted">
                <span className="flex-1 min-w-40">删除后摘要会隐藏，由它更新的记忆回退到上一版本，仅由它创建的记忆会被停用。数据保留，可从数据库恢复。</span>
                <Button size="sm" variant="destructive" onClick={() => { setConfirming(false); void onDelete(s) }}>确认删除</Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>取消</Button>
              </div>
            ) : (
              <>
                {error && <span className="text-xs text-cv-danger">{error}</span>}
                <span className="ml-auto flex items-center gap-1">
                  <IconButton label="编辑摘要" size="sm" disabled={busy} onClick={() => { setDraft(s.content); setEditing(true) }}><Pencil /></IconButton>
                  <IconButton label={hasRange ? '重新生成' : '缺少消息范围，无法重新生成'} size="sm" disabled={busy || !canGenerate || !hasRange}
                    onClick={() => { setError(null); onRegenerate(s).catch((e: Error) => setError(e.message || '重新生成失败')) }}>
                    <RefreshCw className={cn(regenerating && 'animate-spin')} />
                  </IconButton>
                  <IconButton label="删除摘要" size="sm" disabled={busy} className="text-cv-danger" onClick={() => setConfirming(true)}><Trash2 /></IconButton>
                </span>
              </>
            )}
          </footer>
        )}
      </div>
    </li>
  )
}

/** Vertical timeline of the session's active summaries, oldest range first. */
export function SummaryTimeline({ summaries, loading, indexOf, canGenerate, regeneratingId, deletingId, onSave, onRegenerate, onDelete }: Props) {
  if (loading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} variant="row" className="min-h-28" />)}</div>
  const list = [...(summaries ?? [])].sort((a, b) => (a.start_message_id ?? 0) - (b.start_message_id ?? 0) || a.created_at.localeCompare(b.created_at))
  if (list.length === 0) {
    return (
      <PosterCard tone="primary" className="min-h-52">
        <PosterTitle>还没有摘要</PosterTitle>
        <p className="mt-2 max-w-sm text-sm opacity-90">摘要把一段对话压缩成角色能记住的叙述，并从中提取记忆。到「上下文」标签页生成第一份。</p>
      </PosterCard>
    )
  }
  return (
    <ol className="relative space-y-3 before:absolute before:bottom-5 before:left-[7px] before:top-5 before:w-px before:bg-cv-border-strong">
      {list.map((s) => (
        <SummaryItem key={s.id} s={s} indexOf={indexOf} canGenerate={canGenerate}
          regenerating={regeneratingId === s.id} deleting={deletingId === s.id}
          onSave={onSave} onRegenerate={onRegenerate} onDelete={onDelete} />
      ))}
    </ol>
  )
}

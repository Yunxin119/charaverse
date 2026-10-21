'use client'

import { useState } from 'react'
import { Pencil, Trash2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { Chip, IconButton } from '@/components/glass'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  MEMORY_TYPE_MAP,
  TASK_STATUS,
  TASK_STATUS_ORDER,
  describeMetadata,
  importanceTier,
  isMemoryEnabled,
  type MemoryEntry,
  type TaskStatus,
} from '@/lib/memory/types'

interface Props {
  memory: MemoryEntry
  busy?: boolean
  onEdit: (memory: MemoryEntry) => void
  onDelete: (memory: MemoryEntry) => Promise<void> | void
  onToggle: (memory: MemoryEntry, enabled: boolean) => void
  onTaskStatus?: (memory: MemoryEntry, status: TaskStatus) => void
}

const STATUS_TONE: Record<TaskStatus, 'warning' | 'info' | 'success' | 'outline'> = {
  pending: 'warning', in_progress: 'info', completed: 'success', cancelled: 'outline',
}

const CLAMP = 160

export function MemoryCard({ memory, busy, onEdit, onDelete, onToggle, onTaskStatus }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const def = MEMORY_TYPE_MAP[memory.type]
  const Icon = def?.icon
  const enabled = isMemoryEnabled(memory)
  const tier = importanceTier(memory.importance)
  const meta = describeMetadata(memory.type, memory.metadata)
  const shownMeta = expanded ? meta : meta.slice(0, 3)
  const long = memory.content.length > CLAMP
  const status = memory.type === 'task' ? (memory.metadata?.status as TaskStatus | undefined) : undefined
  const nextStatus = status ? TASK_STATUS_ORDER[(TASK_STATUS_ORDER.indexOf(status) + 1) % TASK_STATUS_ORDER.length] : 'in_progress'

  return (
    <article className={cn('glass flex flex-col gap-3 rounded-cv-lg p-4 transition-opacity', !enabled && 'opacity-60')} aria-busy={busy}>
      <header className="flex flex-wrap items-center gap-2">
        <Chip tone={def?.tone ?? 'flat'}>{Icon && <Icon className="size-3.5" />}{def?.label ?? memory.type}</Chip>
        <Chip tone={tier.tone} title={`重要度 ${memory.importance}/10`}>★ {memory.importance}</Chip>
        {memory.source === 'auto' && <Chip tone="glass" title={memory.summary_id ? `来自摘要 #${memory.summary_id}` : '由摘要提取'}><Sparkles className="size-3" />自动</Chip>}
        {status && (
          <button type="button" className="ml-auto" title={`点击切换为「${TASK_STATUS[nextStatus]}」`} disabled={busy}
            onClick={() => onTaskStatus?.(memory, nextStatus)}>
            <Chip tone={STATUS_TONE[status]} interactive>{TASK_STATUS[status]}</Chip>
          </button>
        )}
      </header>

      <div className="min-w-0">
        <h3 className="font-semibold leading-snug">{memory.title}</h3>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-cv-fg-muted">
          {expanded || !long ? memory.content : `${memory.content.slice(0, CLAMP)}…`}
        </p>
      </div>

      {shownMeta.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          {shownMeta.map((d) => (
            <div key={d.key} className="contents">
              <dt className="text-cv-fg-subtle">{d.label}</dt>
              <dd className={cn('min-w-0 break-words text-cv-fg', !expanded && 'truncate')}>{d.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {(long || meta.length > 3) && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-fit items-center gap-1 text-xs font-semibold text-cv-accent hover:underline">
          {expanded ? <><ChevronUp className="size-3.5" />收起</> : <><ChevronDown className="size-3.5" />展开{meta.length > 3 && !long ? `（+${meta.length - 3} 项）` : ''}</>}
        </button>
      )}

      <footer className="mt-auto flex items-center gap-2 border-t border-cv-border pt-3">
        <label className="flex items-center gap-2 text-xs text-cv-fg-muted">
          <Switch checked={enabled} disabled={busy} onCheckedChange={(v) => onToggle(memory, v)} aria-label={enabled ? '停用记忆' : '启用记忆'} />
          {enabled ? '已启用' : '已停用'}
        </label>
        <span className="ml-auto flex items-center gap-1">
          {confirming ? (
            <>
              <Button size="sm" variant="destructive" disabled={busy} onClick={() => { void Promise.resolve(onDelete(memory)).finally(() => setConfirming(false)) }}>确认删除</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>取消</Button>
            </>
          ) : (
            <>
              <IconButton label="编辑" size="sm" disabled={busy} onClick={() => onEdit(memory)}><Pencil /></IconButton>
              <IconButton label="删除" size="sm" disabled={busy} className="text-cv-danger" onClick={() => setConfirming(true)}><Trash2 /></IconButton>
            </>
          )}
        </span>
      </footer>
    </article>
  )
}

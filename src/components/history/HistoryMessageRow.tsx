'use client'

import { forwardRef, useState } from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Loader2, Pencil, Trash2 } from 'lucide-react'
import type { ChatMessage } from '@/app/lib/supabase'
import { Button } from '@/components/ui/button'
import { Chip, IconButton } from '@/components/glass'
import { Markdown } from '@/components/chat/Markdown'
import { cn } from '@/lib/utils'

interface Props {
  message: ChatMessage
  userLabel: string
  characterLabel: string
  highlighted: boolean
  deleting: boolean
  onEdit: () => void
  onDelete: () => void
}

function timeOf(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : format(d, 'yyyy-MM-dd HH:mm', { locale: zhCN })
}

export const HistoryMessageRow = forwardRef<HTMLLIElement, Props>(function HistoryMessageRow(
  { message, userLabel, characterLabel, highlighted, deleting, onEdit, onDelete },
  ref
) {
  const [confirm, setConfirm] = useState(false)
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const swipeCount = message.swipes?.length ?? 0

  return (
    <li
      ref={ref}
      id={`msg-${message.id}`}
      className={cn(
        'glass rounded-cv-lg p-4 transition-shadow duration-(--cv-dur) sm:p-5',
        highlighted && 'ring-2 ring-cv-ring shadow-glass',
        deleting && 'opacity-60'
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={isUser ? 'primary' : isSystem ? 'outline' : 'glass'} className="max-w-40 truncate">
          {isUser ? userLabel : isSystem ? '系统' : characterLabel}
        </Chip>
        <span className="font-mono text-[11px] text-cv-fg-subtle">#{message.id}</span>
        <span className="text-[11px] text-cv-fg-subtle">{timeOf(message.created_at)}</span>
        {swipeCount > 1 && (
          <span className="font-mono text-[11px] text-cv-fg-subtle">{(message.swipe_index ?? 0) + 1}/{swipeCount}</span>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <IconButton label="编辑" size="sm" onClick={onEdit} disabled={deleting}><Pencil /></IconButton>
          <IconButton label="删除" size="sm" onClick={() => setConfirm((v) => !v)} disabled={deleting} className={cn(confirm && 'text-cv-danger')}>
            {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
          </IconButton>
        </div>
      </div>

      {confirm && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-cv-md bg-[color-mix(in_oklab,var(--cv-danger)_10%,transparent)] px-3 py-2 text-sm text-cv-danger">
          <span>删除这条消息？不可撤销。</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>取消</Button>
            <Button size="sm" variant="destructive" onClick={() => { setConfirm(false); onDelete() }}>删除</Button>
          </div>
        </div>
      )}

      <Markdown text={message.content} className="mt-3 text-cv-fg" />
    </li>
  )
})

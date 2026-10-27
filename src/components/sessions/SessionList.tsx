'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { GitBranch, MoreHorizontal, Pencil, Trash2, MessageSquare, Check, X, Download } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Chip, IconButton } from '@/components/glass'
import { useDeleteSession, useRenameSession } from '@/queries/useChatMutations'
import type { SessionWithCharacter } from '@/queries'
import { cn } from '@/lib/utils'
import { parseSessionSettings } from '@/lib/chat/settings'
import { ExportChatDialog } from '@/components/chat/ExportChatDialog'

export function relativeTime(iso: string | undefined, now = Date.now()): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  const diff = now - t
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  const d = new Date(t)
  const startOfToday = new Date(now).setHours(0, 0, 0, 0)
  if (t >= startOfToday) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  if (t >= startOfToday - 86_400_000) return '昨天'
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export function sessionTitle(s: SessionWithCharacter) {
  return s.title?.trim() || `与 ${s.character?.name ?? '角色'} 的对话`
}

interface Node { session: SessionWithCharacter; depth: number }

/** Order sessions as a tree: roots newest-first, branches nested under their parent (when it is in the list). */
function toTree(sessions: SessionWithCharacter[]): Node[] {
  const byParent = new Map<string | null, SessionWithCharacter[]>()
  const ids = new Set(sessions.map((s) => s.id))
  for (const s of sessions) {
    const parent = s.parent_session_id && ids.has(s.parent_session_id) ? s.parent_session_id : null
    const list = byParent.get(parent) ?? []
    list.push(s)
    byParent.set(parent, list)
  }
  const out: Node[] = []
  const walk = (parent: string | null, depth: number) => {
    for (const s of byParent.get(parent) ?? []) {
      out.push({ session: s, depth })
      walk(s.id, Math.min(depth + 1, 4))
    }
  }
  walk(null, 0)
  return out
}

interface Props {
  sessions: SessionWithCharacter[]
  userId: string | undefined
  /** highlight this session (e.g. the one currently open) */
  currentId?: string
  limit?: number
  emptyText?: string
  className?: string
}

export function SessionList({ sessions, userId, currentId, limit, emptyText = '还没有对话', className }: Props) {
  const router = useRouter()
  const rename = useRenameSession(userId)
  const remove = useDeleteSession(userId)
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null)
  const [exporting, setExporting] = useState<SessionWithCharacter | null>(null)
  const nodes = useMemo(() => toTree(sessions), [sessions])
  const shown = limit ? nodes.slice(0, limit) : nodes

  if (!sessions.length) return <p className={cn('text-sm text-cv-fg-muted', className)}>{emptyText}</p>

  return (
    <ul className={cn('space-y-1.5', className)}>
      {shown.map(({ session: s, depth }) => {
        const active = s.id === currentId
        return (
          <li key={s.id} style={{ paddingLeft: depth ? `${depth * 1.25}rem` : undefined }}>
            <div className={cn('group flex items-center gap-2 rounded-cv-md px-3 py-2 transition-colors', active ? 'bg-cv-primary text-cv-primary-fg' : 'hover:bg-cv-fg/5')}>
              {depth > 0 ? <GitBranch className={cn('size-4 shrink-0', active ? 'opacity-80' : 'text-cv-fg-subtle')} aria-label="分支" /> : <MessageSquare className={cn('size-4 shrink-0', active ? 'opacity-80' : 'text-cv-fg-subtle')} />}
              {editing?.id === s.id ? (
                <form className="flex min-w-0 flex-1 items-center gap-1" onSubmit={(e) => { e.preventDefault(); rename.mutate({ sessionId: s.id, title: editing.title }); setEditing(null) }}>
                  <Input autoFocus value={editing.title} onChange={(e) => setEditing({ id: s.id, title: e.target.value })} className="h-8 flex-1 bg-cv-bg-elevated text-cv-fg" />
                  <IconButton label="保存" size="sm" variant="ghost" type="submit"><Check /></IconButton>
                  <IconButton label="取消" size="sm" variant="ghost" onClick={() => setEditing(null)}><X /></IconButton>
                </form>
              ) : (
                <button type="button" onClick={() => router.push(`/chat/${s.id}`)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-medium">{sessionTitle(s)}</span>
                  <span className={cn('block truncate text-[11px]', active ? 'opacity-75' : 'text-cv-fg-subtle')}>
                    {relativeTime(s.updated_at ?? s.created_at)}
                    {s.branched_from_message_id ? ` · 分支自 #${s.branched_from_message_id}` : ''}
                  </span>
                </button>
              )}
              {active && <Chip tone="glass" className="hidden sm:inline-flex">当前</Chip>}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <IconButton label="更多" size="sm" variant="ghost" className={cn(active && 'text-cv-primary-fg hover:bg-white/15')}><MoreHorizontal /></IconButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-36">
                  <DropdownMenuItem onClick={() => setEditing({ id: s.id, title: s.title ?? '' })}><Pencil />重命名</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setExporting(s)}><Download />导出对话</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => { if (confirm(`删除「${sessionTitle(s)}」？消息会一并删除。`)) remove.mutate(s.id, { onSuccess: () => { if (active) router.push(`/characters/${s.character_id}`) } }) }}><Trash2 />删除对话</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </li>
        )
      })}
      {exporting && (
        <ExportChatDialog
          open
          onOpenChange={(o) => { if (!o) setExporting(null) }}
          sessionId={exporting.id}
          title={exporting.title}
          characterName={exporting.character?.name ?? '角色'}
          characterId={exporting.character_id}
          userName={parseSessionSettings(exporting.settings).userName || undefined}
          settings={(exporting.settings ?? undefined) as Record<string, unknown> | undefined}
        />
      )}
    </ul>
  )
}

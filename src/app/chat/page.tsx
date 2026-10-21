'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import { Search, MoreHorizontal, Pencil, Trash2, MessageSquare, ChevronRight, GitBranch, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { IconButton, PosterCard, PosterTitle, CardSkeleton } from '@/components/glass'
import { useAuth } from '@/providers/AuthProvider'
import { useSessions, qk, type SessionWithCharacter } from '@/queries'
import { supabase } from '@/app/lib/supabase'

const DAY = 24 * 60 * 60 * 1000

function relativeTime(iso: string | undefined, now: number): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  const diff = now - t
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  const d = new Date(t)
  const startOfToday = new Date(now).setHours(0, 0, 0, 0)
  if (t >= startOfToday) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  if (t >= startOfToday - DAY) return '昨天'
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} 天前`
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

type Group = { id: 'today' | 'week' | 'older'; label: string; items: SessionWithCharacter[] }

function groupByDate(sessions: SessionWithCharacter[], now: number): Group[] {
  const startOfToday = new Date(now).setHours(0, 0, 0, 0)
  const groups: Group[] = [
    { id: 'today', label: '今天', items: [] },
    { id: 'week', label: '本周', items: [] },
    { id: 'older', label: '更早', items: [] },
  ]
  for (const s of sessions) {
    const t = new Date(s.updated_at ?? s.created_at).getTime()
    if (t >= startOfToday) groups[0].items.push(s)
    else if (t >= startOfToday - 6 * DAY) groups[1].items.push(s)
    else groups[2].items.push(s)
  }
  return groups.filter((g) => g.items.length > 0)
}

function sessionTitle(s: SessionWithCharacter) {
  return s.title?.trim() || `与 ${s.character?.name ?? '角色'} 的对话`
}

const listVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.03 } } }
const itemVariants = { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.24, ease: [0.2, 0.8, 0.2, 1] as const } } }

export default function ChatListPage() {
  const { user } = useAuth()
  const router = useRouter()
  const qc = useQueryClient()
  const sessions = useSessions(user?.id)
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  // one clock for grouping and labels; ticks every minute so "刚刚" ages
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = (sessions.data ?? []).filter((s) => !q || sessionTitle(s).toLowerCase().includes(q) || (s.character?.name ?? '').toLowerCase().includes(q))
    return groupByDate(rows, now)
  }, [sessions.data, query, now])

  const invalidate = () => {
    if (user) qc.invalidateQueries({ queryKey: qk.sessions(user.id) })
  }

  const rename = async (s: SessionWithCharacter) => {
    const next = prompt('会话标题', sessionTitle(s))
    if (next === null) return
    setBusyId(s.id)
    const { error } = await supabase.from('chat_sessions').update({ title: next.trim() || null }).eq('id', s.id)
    setBusyId(null)
    if (error) {
      alert('重命名失败，请重试')
      return
    }
    invalidate()
  }

  const remove = async (s: SessionWithCharacter) => {
    if (!confirm(`删除「${sessionTitle(s)}」？消息、摘要和日记会一并删除，无法撤销。`)) return
    setBusyId(s.id)
    const { error } = await supabase.from('chat_sessions').delete().eq('id', s.id)
    setBusyId(null)
    if (error) {
      alert('删除失败，请重试')
      return
    }
    invalidate()
  }

  const total = sessions.data?.length ?? 0

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">对话</h1>
          <p className="mt-1 text-sm text-cv-fg-muted">{total > 0 ? `${total} 段对话，按最近活动排序` : '从一个角色开始新的对话。'}</p>
        </div>
        <Button asChild variant="accent"><Link href="/characters"><Users />选择角色</Link></Button>
      </header>

      {total > 3 && (
        <div className="relative mb-5">
          <Search className="pointer-events-none absolute inset-y-0 left-4 my-auto size-4 text-cv-fg-subtle" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索标题或角色…" className="pl-11" aria-label="搜索对话" />
        </div>
      )}

      {sessions.isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} variant="row" />)}
        </div>
      )}

      {sessions.isError && (
        <PosterCard tone="ink" className="text-center">
          <PosterTitle>加载失败</PosterTitle>
          <p className="mt-2 text-sm opacity-80">网络或权限问题，稍后再试。</p>
          <Button variant="glass" size="sm" className="mt-4" onClick={() => sessions.refetch()}>重试</Button>
        </PosterCard>
      )}

      {sessions.isSuccess && total === 0 && (
        <PosterCard tone="primary" className="flex min-h-64 flex-col items-start justify-between p-6 sm:p-8">
          <span className="flex size-10 items-center justify-center rounded-cv-sm bg-cv-accent text-white shadow-[0_10px_24px_-10px_var(--cv-accent)]"><MessageSquare className="size-5" /></span>
          <div className="mt-8">
            <PosterTitle className="text-3xl sm:text-4xl">还没有对话。</PosterTitle>
            <p className="mt-2 max-w-sm text-sm opacity-80">去「角色」页挑一个角色，点「聊天」就会在这里出现。</p>
            <Button asChild variant="glass" className="mt-5"><Link href="/characters"><Users />去角色页</Link></Button>
          </div>
        </PosterCard>
      )}

      {sessions.isSuccess && total > 0 && groups.length === 0 && (
        <div className="glass rounded-cv-lg p-8 text-center text-sm text-cv-fg-muted">没有匹配的对话。</div>
      )}

      {groups.map((g) => (
        <section key={g.id} className="mb-7">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-cv-fg-subtle">{g.label}</h2>
          <motion.ul variants={listVariants} initial="hidden" animate="visible" className="space-y-3">
            {g.items.map((s) => {
              const name = s.character?.name ?? '已删除的角色'
              const busy = busyId === s.id
              return (
                <motion.li key={s.id} variants={itemVariants} layout>
                  <div className={`glass relative flex items-center gap-3 rounded-cv-lg p-3 transition-shadow hover:shadow-glass ${busy ? 'opacity-60' : ''}`}>
                    <Link href={`/chat/${s.id}`} aria-label={sessionTitle(s)} className="absolute inset-0 z-0 rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-cv-ring" />
                    <Avatar className="size-12 shrink-0 rounded-cv-sm">
                      <AvatarImage src={s.character?.avatar_url ?? undefined} alt="" className="object-cover" />
                      <AvatarFallback className="rounded-cv-sm bg-cv-secondary font-display text-lg font-semibold text-cv-secondary-fg">{name.slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-semibold leading-tight">{sessionTitle(s)}</h3>
                        {s.parent_session_id && <GitBranch className="size-3.5 shrink-0 text-cv-fg-subtle" aria-label="分支会话" />}
                      </div>
                      <p className="truncate text-sm text-cv-fg-muted">
                        {name}
                        <span className="mx-1.5 text-cv-fg-subtle">·</span>
                        <time dateTime={s.updated_at ?? s.created_at}>{relativeTime(s.updated_at ?? s.created_at, now)}</time>
                      </p>
                    </div>
                    <div className="relative z-10 flex shrink-0 items-center gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <IconButton label="会话操作" variant="ghost" size="sm" disabled={busy}><MoreHorizontal /></IconButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-40">
                          <DropdownMenuItem onClick={() => router.push(`/chat/${s.id}`)}><MessageSquare />打开</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void rename(s)}><Pencil />重命名</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => void remove(s)}><Trash2 />删除会话</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <ChevronRight className="hidden size-4 text-cv-fg-subtle sm:block" aria-hidden />
                    </div>
                  </div>
                </motion.li>
              )
            })}
          </motion.ul>
        </section>
      ))}
    </div>
  )
}

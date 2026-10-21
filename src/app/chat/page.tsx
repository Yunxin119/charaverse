'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Search, Users, MessageSquarePlus, ChevronRight, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PosterCard, PosterTitle, CardSkeleton, Chip } from '@/components/glass'
import { useAuth } from '@/providers/AuthProvider'
import { useSessions, type SessionWithCharacter } from '@/queries'
import { useStartSession } from '@/queries/useChatMutations'
import { SessionList, relativeTime, sessionTitle } from '@/components/sessions/SessionList'

interface CharacterGroup {
  characterId: number
  name: string
  avatarUrl?: string | null
  sessions: SessionWithCharacter[]
  latestAt: string
}

const PREVIEW = 3
const listVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.03 } } }
const itemVariants = { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.24, ease: [0.2, 0.8, 0.2, 1] as const } } }

/** Conversations grouped by character; each character's full history lives on its hub page. */
export default function ChatListPage() {
  const { user } = useAuth()
  const router = useRouter()
  const sessions = useSessions(user?.id)
  const start = useStartSession()
  const [query, setQuery] = useState('')

  const groups = useMemo<CharacterGroup[]>(() => {
    const q = query.trim().toLowerCase()
    const byChar = new Map<number, CharacterGroup>()
    for (const s of sessions.data ?? []) {
      if (q && !sessionTitle(s).toLowerCase().includes(q) && !(s.character?.name ?? '').toLowerCase().includes(q)) continue
      const g = byChar.get(s.character_id) ?? {
        characterId: s.character_id, name: s.character?.name ?? '已删除的角色', avatarUrl: s.character?.avatar_url, sessions: [], latestAt: s.updated_at ?? s.created_at,
      }
      g.sessions.push(s)
      byChar.set(s.character_id, g)
    }
    return [...byChar.values()].sort((a, b) => b.latestAt.localeCompare(a.latestAt))
  }, [sessions.data, query])

  const total = sessions.data?.length ?? 0

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">对话</h1>
          <p className="mt-1 text-sm text-cv-fg-muted">{total > 0 ? `${groups.length} 个角色 · ${total} 段对话，按最近活动排序` : '从一个角色开始新的对话。'}</p>
        </div>
        <Button asChild variant="accent"><Link href="/characters"><Users />选择角色</Link></Button>
      </header>

      {total > 3 && (
        <div className="relative mb-5">
          <Search className="pointer-events-none absolute inset-y-0 left-4 my-auto size-4 text-cv-fg-subtle" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索角色或对话标题…" className="pl-11" aria-label="搜索对话" />
        </div>
      )}

      {sessions.isLoading && <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} variant="row" />)}</div>}

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
            <p className="mt-2 max-w-sm text-sm opacity-80">去「角色」页挑一个角色，进角色主页点「开新对话」。</p>
            <Button asChild variant="glass" className="mt-5"><Link href="/characters"><Users />去角色页</Link></Button>
          </div>
        </PosterCard>
      )}

      {sessions.isSuccess && total > 0 && groups.length === 0 && (
        <div className="glass rounded-cv-lg p-8 text-center text-sm text-cv-fg-muted">没有匹配的对话。</div>
      )}

      <motion.div variants={listVariants} initial="hidden" animate="visible" className="space-y-4">
        {groups.map((g) => (
          <motion.section key={g.characterId} variants={itemVariants} className="glass rounded-cv-lg p-3 sm:p-4">
            <div className="mb-2 flex items-center gap-3">
              <Link href={`/characters/${g.characterId}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-cv-md outline-none focus-visible:ring-2 focus-visible:ring-cv-ring">
                <Avatar className="size-12 shrink-0 rounded-cv-sm">
                  <AvatarImage src={g.avatarUrl ?? undefined} alt="" className="object-cover" />
                  <AvatarFallback className="rounded-cv-sm bg-cv-secondary font-display text-lg font-semibold text-cv-secondary-fg">{g.name.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-semibold leading-tight">{g.name}</h2>
                    <Chip tone="flat">{g.sessions.length} 段</Chip>
                  </div>
                  <p className="truncate text-xs text-cv-fg-muted">最近 {relativeTime(g.latestAt)} · 点击进入角色主页</p>
                </div>
                <ChevronRight className="hidden size-4 text-cv-fg-subtle sm:block" aria-hidden />
              </Link>
              <Button size="sm" variant="neu" disabled={start.isPending}
                onClick={() => user && start.mutate({ userId: user.id, characterId: g.characterId, forceNew: true }, { onSuccess: ({ sessionId, needsOpening }) => router.push(`/chat/${sessionId}${needsOpening ? '?opening=1' : ''}`) })}>
                <MessageSquarePlus /> 新对话
              </Button>
            </div>
            <SessionList sessions={g.sessions} userId={user?.id} limit={PREVIEW} />
            {g.sessions.length > PREVIEW && (
              <Link href={`/characters/${g.characterId}`} className="mt-1 block px-3 py-1.5 text-xs text-cv-accent hover:underline">查看全部 {g.sessions.length} 段对话 →</Link>
            )}
          </motion.section>
        ))}
      </motion.div>
    </div>
  )
}

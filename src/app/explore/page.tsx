'use client'

import { useMemo, useState, type MouseEvent } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Heart, Search, Compass, Flame } from 'lucide-react'
import { supabase } from '@/app/lib/supabase'
import { usePublicCharacters, useToggleLike, type PublicCharacter, type PublicSort } from '@/queries/usePublic'
import { useAuth } from '@/providers/AuthProvider'
import { useCharacterStats } from '@/queries'
import { CharacterStatsLine } from '@/components/cards/CharacterCard'
import { PosterCard, PosterTitle, Chip } from '@/components/glass'
import { cn } from '@/lib/utils'

const TONES = ['primary', 'ink', 'accent', 'secondary'] as const
type ExploreSort = PublicSort | 'active'
const SORTS: { id: ExploreSort; label: string }[] = [
  { id: 'latest', label: '最新' },
  { id: 'likes', label: '最热' },
  { id: 'active', label: '最活跃' },
]
type CardStats = { sessions: number; turns: number }

export default function ExplorePage() {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<ExploreSort>('latest')
  const [tag, setTag] = useState<string | undefined>()
  // 「最活跃」 is a client-side re-order of the 「最热」 list by turn count.
  const list = usePublicCharacters({ q, sort: sort === 'active' ? 'likes' : sort, tag })
  const authors = useAuthorNames(list.data)
  const ids = useMemo(() => (list.data ?? []).map((c) => c.id), [list.data])
  const statsQ = useCharacterStats(ids)
  const statsOf = (id: number): CardStats | undefined => {
    const row = statsQ.data?.get(id)
    return row ? { sessions: row.session_count, turns: row.turn_count } : statsQ.data ? { sessions: 0, turns: 0 } : undefined
  }
  const items = useMemo(() => {
    const data = list.data ?? []
    if (sort !== 'active') return data
    const turns = (id: number) => statsQ.data?.get(id)?.turn_count ?? 0
    const sessions = (id: number) => statsQ.data?.get(id)?.session_count ?? 0
    return [...data].sort((a, b) => turns(b.id) - turns(a.id) || sessions(b.id) - sessions(a.id) || b.likes_count - a.likes_count)
  }, [list.data, sort, statsQ.data])

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold">探索</h1>
        <p className="mt-1 text-sm text-cv-fg-muted">别人发布的角色。看到喜欢的，直接开聊，或者复制一份到自己的角色库里改。</p>
      </header>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="neu-in flex flex-1 items-center gap-2 rounded-full px-4 py-2.5">
          <Search className="size-4 shrink-0 text-cv-fg-subtle" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索名字、简介或关键词"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-cv-fg-subtle"
          />
        </label>
        <div className="neu-in inline-flex self-start rounded-full p-1">
          {SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSort(s.id)}
              className={cn('rounded-full px-4 py-1.5 text-sm font-semibold transition-colors', sort === s.id ? 'bg-cv-bg-elevated text-cv-fg shadow-neu-sm' : 'text-cv-fg-muted hover:text-cv-fg')}
            >
              {s.id === 'active' && <Flame className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />}{s.label}
            </button>
          ))}
        </div>
      </div>

      {tag && (
        <div className="mb-4 flex items-center gap-2 text-sm text-cv-fg-muted">
          筛选：<Chip tone="accent" interactive onClick={() => setTag(undefined)}>{tag} ×</Chip>
        </div>
      )}

      {list.isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}
      {list.isError && <PosterCard tone="ink"><PosterTitle>加载失败</PosterTitle><p className="mt-2 text-sm opacity-80">{(list.error as Error).message}</p></PosterCard>}
      {list.data && list.data.length === 0 && (
        <PosterCard tone="secondary" className="min-h-56">
          <Compass className="mb-3 size-8 opacity-80" />
          <PosterTitle>{q || tag ? '没有匹配的角色' : '还没有人发布角色'}</PosterTitle>
          <p className="mt-2 max-w-md text-sm opacity-80">{q || tag ? '换个关键词试试。' : '在角色编辑页点「发布」，你的角色就会出现在这里。'}</p>
        </PosterCard>
      )}
      {list.data && list.data.length > 0 && (
        <motion.div layout className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c, i) => (
            <motion.div key={c.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: Math.min(i, 8) * 0.03 }}>
              <CharacterCard character={c} author={authors[c.user_id]} tone={TONES[i % TONES.length]} stats={statsOf(c.id)} onTag={setTag} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}

function CharacterCard({ character: c, author, tone, stats, onTag }: { character: PublicCharacter; author?: string; tone: (typeof TONES)[number]; stats?: CardStats; onTag: (t: string) => void }) {
  const { user } = useAuth()
  const like = useToggleLike()
  const [optimistic, setOptimistic] = useState<number | null>(null)
  const likes = optimistic ?? c.likes_count
  const date = c.published_at ?? c.created_at

  const onLike = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user || like.isPending) return
    setOptimistic(likes + 1)
    like.mutate(c.id, { onSettled: () => setOptimistic(null) })
  }

  return (
    <Link href={`/character/public/${c.id}`} className="group block h-full outline-none focus-visible:ring-2 focus-visible:ring-cv-ring rounded-cv-lg">
      <PosterCard tone={tone} image={c.avatar_url ?? undefined} className="flex h-full min-h-64 flex-col justify-end transition-transform duration-(--cv-dur) ease-cv group-hover:[translate:0_-2px]">
        <div className="flex items-start justify-between gap-2">
          <PosterTitle className="line-clamp-2">{c.name}</PosterTitle>
          <button
            type="button"
            onClick={onLike}
            aria-label="点赞"
            disabled={!user}
            className="flex shrink-0 items-center gap-1 rounded-full bg-black/25 px-2.5 py-1 text-xs font-semibold backdrop-blur-sm transition-transform active:scale-95 disabled:opacity-70"
          >
            <Heart className={cn('size-3.5', optimistic !== null && 'fill-current')} />{likes}
          </button>
        </div>
        <p className="mt-2 line-clamp-2 text-sm opacity-85">{c.introduction ?? '这位作者还没有写简介。'}</p>
        {c.keywords.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {c.keywords.slice(0, 3).map((k) => (
              <Chip key={k} tone="glass" interactive className="text-[11px]" onClick={(e) => { e.preventDefault(); onTag(k) }}>{k}</Chip>
            ))}
            {c.keywords.length > 3 && <Chip tone="glass" className="text-[11px]">+{c.keywords.length - 3}</Chip>}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] opacity-75">
          <span className="truncate">by {author ?? '创作者'}</span>
          <CharacterStatsLine stats={stats} className="shrink-0" />
          <time dateTime={date} className="shrink-0">{new Date(date).toLocaleDateString('zh-CN')}</time>
        </div>
      </PosterCard>
    </Link>
  )
}

/** One cached lookup of the listed authors' usernames. */
function useAuthorNames(list: PublicCharacter[] | undefined): Record<string, string> {
  const ids = Array.from(new Set((list ?? []).map((c) => c.user_id))).sort()
  const q = useQuery({
    queryKey: ['profiles', 'names', ids],
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, username').in('id', ids)
      const out: Record<string, string> = {}
      for (const p of data ?? []) if (p.username?.trim()) out[p.id as string] = p.username.trim()
      return out
    },
  })
  return q.data ?? {}
}

function SkeletonCard() {
  return (
    <div className="glass min-h-64 animate-pulse rounded-cv-lg p-6">
      <div className="mt-28 h-6 w-2/3 rounded-full bg-cv-fg/10" />
      <div className="mt-3 h-3.5 w-full rounded-full bg-cv-fg/10" />
      <div className="mt-2 h-3.5 w-4/5 rounded-full bg-cv-fg/10" />
      <div className="mt-4 flex gap-1.5"><span className="h-5 w-12 rounded-full bg-cv-fg/10" /><span className="h-5 w-16 rounded-full bg-cv-fg/10" /></div>
    </div>
  )
}

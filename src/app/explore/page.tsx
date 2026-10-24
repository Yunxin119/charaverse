'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Search, Compass, Flame } from 'lucide-react'
import { supabase } from '@/app/lib/supabase'
import { usePublicCharacters, type PublicCharacter, type PublicSort } from '@/queries/usePublic'
import { useCharacterStats } from '@/queries'
import { ExploreTabs } from '@/components/explore/ExploreTabs'
import { CARD_TONES, PublicCardSkeleton, PublicCharacterCard, type CardStats } from '@/components/explore/PublicCharacterCard'
import { PosterCard, PosterTitle, Chip } from '@/components/glass'
import { cn } from '@/lib/utils'

type ExploreSort = PublicSort | 'active'
const SORTS: { id: ExploreSort; label: string }[] = [
  { id: 'latest', label: '最新' },
  { id: 'likes', label: '最热' },
  { id: 'active', label: '最活跃' },
]
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
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">探索</h1>
          <p className="mt-1 text-sm text-cv-fg-muted">别人发布的角色。看到喜欢的，直接开聊或收藏；角色始终属于作者，作者更新后你的对话会自动用上新版本。</p>
        </div>
        <ExploreTabs />
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
          {Array.from({ length: 6 }).map((_, i) => <PublicCardSkeleton key={i} />)}
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
              <PublicCharacterCard character={c} author={authors[c.user_id]} tone={CARD_TONES[i % CARD_TONES.length]} stats={statsOf(c.id)} onTag={setTag} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
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

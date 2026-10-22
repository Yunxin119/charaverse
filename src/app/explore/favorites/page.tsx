'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Bookmark } from 'lucide-react'
import { supabase } from '@/app/lib/supabase'
import { useAuth } from '@/providers/AuthProvider'
import { useCharacterStats } from '@/queries'
import { useFavoriteCharacters } from '@/queries/useFavorites'
import { ExploreTabs } from '@/components/explore/ExploreTabs'
import { CARD_TONES, PublicCardSkeleton, PublicCharacterCard } from '@/components/explore/PublicCharacterCard'
import { PosterCard, PosterTitle } from '@/components/glass'
import { Button } from '@/components/ui/button'

export default function FavoritesPage() {
  const { user, loading } = useAuth()
  const favs = useFavoriteCharacters(user?.id)
  const items = useMemo(() => favs.data?.items ?? [], [favs.data])
  const ids = useMemo(() => items.map((c) => c.id), [items])
  const statsQ = useCharacterStats(ids)
  const authors = useAuthorNames(items.map((c) => c.user_id))

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">我的收藏</h1>
          <p className="mt-1 text-sm text-cv-fg-muted">
            {favs.data ? `${items.length} 个角色${favs.data.hidden > 0 ? ` · ${favs.data.hidden} 个已被作者撤回` : ''} · 只有你自己能看到收藏` : '只有你自己能看到收藏'}
          </p>
        </div>
        <ExploreTabs />
      </header>

      {!loading && !user && (
        <PosterCard tone="ink" className="min-h-48">
          <PosterTitle>登录后可以收藏角色</PosterTitle>
          <Button className="mt-5 self-start" variant="accent" asChild><Link href="/login?next=/explore/favorites">去登录</Link></Button>
        </PosterCard>
      )}
      {user && favs.isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <PublicCardSkeleton key={i} />)}</div>
      )}
      {favs.isError && <PosterCard tone="ink"><PosterTitle>加载失败</PosterTitle><p className="mt-2 text-sm opacity-80">{(favs.error as Error).message}</p></PosterCard>}
      {favs.data && items.length === 0 && (
        <PosterCard tone="secondary" className="min-h-56">
          <Bookmark className="mb-3 size-8 opacity-80" />
          <PosterTitle>还没有收藏</PosterTitle>
          <p className="mt-2 max-w-md text-sm opacity-80">在探索页或角色页点书签图标，喜欢的角色就会收在这里。</p>
          <Button className="mt-5 self-start" variant="accent" asChild><Link href="/explore">去探索</Link></Button>
        </PosterCard>
      )}
      {items.length > 0 && (
        <motion.div layout className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c, i) => {
            const row = statsQ.data?.get(c.id)
            const stats = row ? { sessions: row.session_count, turns: row.turn_count } : statsQ.data ? { sessions: 0, turns: 0 } : undefined
            return (
              <motion.div key={c.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: Math.min(i, 8) * 0.03 }}>
                <PublicCharacterCard
                  character={c}
                  author={authors[c.user_id]}
                  tone={CARD_TONES[i % CARD_TONES.length]}
                  stats={stats}
                  subtitle={`收藏于 ${new Date(c.favorited_at).toLocaleDateString('zh-CN')}`}
                />
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}

function useAuthorNames(userIds: string[]): Record<string, string> {
  const ids = Array.from(new Set(userIds)).sort()
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

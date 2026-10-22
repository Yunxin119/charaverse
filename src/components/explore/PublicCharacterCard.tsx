'use client'

import { useState, type MouseEvent } from 'react'
import Link from 'next/link'
import { Bookmark, Heart } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/providers/AuthProvider'
import { useToggleLike, type PublicCharacter } from '@/queries/usePublic'
import { useMyFavoriteIds, useToggleFavorite } from '@/queries/useFavorites'
import { CharacterStatsLine } from '@/components/cards/CharacterCard'
import { PosterCard, PosterTitle, Chip } from '@/components/glass'
import { cn } from '@/lib/utils'

export const CARD_TONES = ['primary', 'ink', 'accent', 'secondary'] as const
export type CardTone = (typeof CARD_TONES)[number]
export type CardStats = { sessions: number; turns: number }

/**
 * Poster card for a published character (explore grid, favorites page).
 * The whole card links to the public page; like / favorite buttons stop the navigation.
 */
export function PublicCharacterCard({
  character: c, author, tone, stats, onTag, subtitle,
}: {
  character: PublicCharacter
  author?: string
  tone: CardTone
  stats?: CardStats
  onTag?: (t: string) => void
  /** replaces the published date in the footer (e.g. "收藏于 …") */
  subtitle?: string
}) {
  const { user } = useAuth()
  const like = useToggleLike()
  const favIds = useMyFavoriteIds(user?.id)
  const toggleFav = useToggleFavorite(user?.id)
  const [optimistic, setOptimistic] = useState<number | null>(null)
  const likes = optimistic ?? c.likes_count
  const favorited = favIds.data?.has(c.id) ?? false
  const date = c.published_at ?? c.created_at

  const stop = (e: MouseEvent) => { e.preventDefault(); e.stopPropagation() }
  const onLike = (e: MouseEvent) => {
    stop(e)
    if (!user || like.isPending) return
    setOptimistic(likes + 1)
    like.mutate(c.id, { onSettled: () => setOptimistic(null) })
  }
  const onFavorite = (e: MouseEvent) => {
    stop(e)
    if (!user || toggleFav.isPending) return
    toggleFav.mutate({ characterId: c.id, next: !favorited }, {
      onSuccess: (next) => toast.success(next ? `已收藏「${c.name}」` : `已取消收藏「${c.name}」`),
      onError: (err) => toast.error((err as Error).message || '操作失败，请重试'),
    })
  }

  const pill = 'flex shrink-0 items-center gap-1 rounded-full bg-black/25 px-2.5 py-1 text-xs font-semibold backdrop-blur-sm transition-transform active:scale-95 disabled:opacity-70'

  return (
    <Link href={`/character/public/${c.id}`} className="group block h-full outline-none focus-visible:ring-2 focus-visible:ring-cv-ring rounded-cv-lg">
      <PosterCard tone={tone} image={c.avatar_url ?? undefined} className="flex h-full min-h-64 flex-col justify-end transition-transform duration-(--cv-dur) ease-cv group-hover:[translate:0_-2px]">
        <div className="flex items-start justify-between gap-2">
          <PosterTitle className="line-clamp-2">{c.name}</PosterTitle>
          <div className="flex shrink-0 items-center gap-1.5">
            <button type="button" onClick={onLike} aria-label="点赞" disabled={!user} className={pill}>
              <Heart className={cn('size-3.5', optimistic !== null && 'fill-current')} />{likes}
            </button>
            <button
              type="button"
              onClick={onFavorite}
              aria-label={favorited ? '取消收藏' : '收藏'}
              aria-pressed={favorited}
              disabled={!user}
              className={cn(pill, favorited && 'text-cv-accent')}
            >
              <Bookmark className={cn('size-3.5', favorited && 'fill-current')} />
            </button>
          </div>
        </div>
        <p className="mt-2 line-clamp-2 text-sm opacity-85">{c.introduction ?? '这位作者还没有写简介。'}</p>
        {c.keywords.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {c.keywords.slice(0, 3).map((k) => (
              <Chip key={k} tone="glass" interactive={!!onTag} className="text-[11px]" onClick={(e) => { if (!onTag) return; e.preventDefault(); onTag(k) }}>{k}</Chip>
            ))}
            {c.keywords.length > 3 && <Chip tone="glass" className="text-[11px]">+{c.keywords.length - 3}</Chip>}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] opacity-75">
          <span className="truncate">by {author ?? '创作者'}</span>
          <CharacterStatsLine stats={stats} className="shrink-0" />
          {subtitle
            ? <span className="shrink-0">{subtitle}</span>
            : <time dateTime={date} className="shrink-0">{new Date(date).toLocaleDateString('zh-CN')}</time>}
        </div>
      </PosterCard>
    </Link>
  )
}

export function PublicCardSkeleton() {
  return (
    <div className="glass min-h-64 animate-pulse rounded-cv-lg p-6">
      <div className="mt-28 h-6 w-2/3 rounded-full bg-cv-fg/10" />
      <div className="mt-3 h-3.5 w-full rounded-full bg-cv-fg/10" />
      <div className="mt-2 h-3.5 w-4/5 rounded-full bg-cv-fg/10" />
      <div className="mt-4 flex gap-1.5"><span className="h-5 w-12 rounded-full bg-cv-fg/10" /><span className="h-5 w-16 rounded-full bg-cv-fg/10" /></div>
    </div>
  )
}

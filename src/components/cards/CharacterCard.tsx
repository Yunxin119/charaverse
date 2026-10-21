'use client'

import * as React from 'react'
import Link from 'next/link'
import { Heart } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Chip, PosterCard, PosterTitle } from '@/components/glass'
import type { Character } from '@/app/lib/supabase'
import { cn } from '@/lib/utils'

/** The minimum a card needs. Both the owner list and public lists map onto this. */
export interface CharacterCardData {
  id: number
  name: string
  avatarUrl?: string | null
  /** one-line introduction (already resolved from prompt_template / snapshot) */
  intro?: string | null
  keywords?: string[]
  isPublic?: boolean
  likes?: number
}

type PublishedSnapshot = {
  name?: string
  avatar_url?: string | null
  prompt_template?: { basic_info?: { introduction?: string; description?: string; keywords?: string[] } }
}

/**
 * Map a `characters` row onto card data.
 * `preferSnapshot` reads `published_snapshot` first (public pages show what was published, not the draft).
 */
export function characterToCardData(
  c: Character & { likes_count?: number; published_snapshot?: PublishedSnapshot | null },
  opts: { preferSnapshot?: boolean } = {}
): CharacterCardData {
  const snap = opts.preferSnapshot ? c.published_snapshot ?? undefined : undefined
  const basic = (snap?.prompt_template ?? c.prompt_template)?.basic_info ?? {}
  return {
    id: c.id,
    name: snap?.name ?? c.name,
    avatarUrl: snap?.avatar_url ?? c.avatar_url ?? null,
    intro: basic.introduction || basic.description || null,
    keywords: Array.isArray(basic.keywords) ? (basic.keywords as string[]).filter((k) => typeof k === 'string') : [],
    isPublic: c.is_public,
    likes: typeof c.likes_count === 'number' ? c.likes_count : undefined,
  }
}

export interface CharacterCardProps extends Omit<React.ComponentProps<'article'>, 'children'> {
  data: CharacterCardData
  variant?: 'poster' | 'glass'
  /** whole card becomes a link (stretched, so slot buttons still work) */
  href?: string
  /** extra chips next to the built-in ones (e.g. 已发布) */
  chips?: React.ReactNode
  /** top-right slot (menu button) */
  menu?: React.ReactNode
  /** bottom slot (action buttons) */
  footer?: React.ReactNode
  /** show the like count chip when `data.likes` is set */
  showLikes?: boolean
}

const POSTER_TONES = ['primary', 'ink', 'accent'] as const
const MAX_KEYWORDS = 3

function StretchedLink({ href, name, className }: { href: string; name: string; className?: string }) {
  return <Link href={href} aria-label={name} className={cn('absolute inset-0 z-0 outline-none focus-visible:ring-2 focus-visible:ring-cv-ring', className)} />
}

/**
 * Reusable character card.
 * - `poster`: PosterCard cover (avatar as full-bleed image, big display-serif name).
 * - `glass`: compact row for lists.
 */
export function CharacterCard({ data, variant = 'poster', href, chips, menu, footer, showLikes, className, ...props }: CharacterCardProps) {
  const keywords = (data.keywords ?? []).slice(0, MAX_KEYWORDS)
  const extra = (data.keywords?.length ?? 0) - keywords.length
  const likeChip = showLikes && typeof data.likes === 'number'

  if (variant === 'glass') {
    return (
      <article className={cn('glass relative flex items-center gap-3 rounded-cv-lg p-3 transition-shadow hover:shadow-glass', className)} {...props}>
        {href && <StretchedLink href={href} name={data.name} />}
        <Avatar className="size-12 shrink-0 rounded-cv-sm">
          <AvatarImage src={data.avatarUrl ?? undefined} alt="" className="object-cover" />
          <AvatarFallback className="rounded-cv-sm bg-cv-secondary font-display text-lg font-semibold text-cv-secondary-fg">{data.name.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold leading-tight">{data.name}</h3>
            {likeChip && (
              <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-cv-fg-muted"><Heart className="size-3" />{data.likes}</span>
            )}
          </div>
          <p className="truncate text-sm text-cv-fg-muted">{data.intro || '还没有介绍'}</p>
          {(keywords.length > 0 || chips) && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {chips}
              {keywords.map((k) => <Chip key={k} tone="flat" className="px-2 py-0.5 text-[11px]">{k}</Chip>)}
              {extra > 0 && <Chip tone="outline" className="px-2 py-0.5 text-[11px]">+{extra}</Chip>}
            </div>
          )}
        </div>
        {(menu || footer) && (
          <div className="relative z-10 flex shrink-0 items-center gap-1">
            {footer}
            {menu}
          </div>
        )}
      </article>
    )
  }

  // only dark tones so white text / glass buttons in the slots always read
  const tone = POSTER_TONES[Math.abs(data.id) % POSTER_TONES.length]
  const onImage = !!data.avatarUrl
  const posterChip = 'border-white/25 bg-white/15 text-white'

  return (
    <PosterCard
      tone={tone}
      image={data.avatarUrl ?? undefined}
      className={cn('group min-h-72 p-5 transition-[transform,box-shadow] duration-(--cv-dur) ease-cv hover:-translate-y-0.5 hover:shadow-glass', className)}
      {...(props as React.ComponentProps<'div'>)}
    >
      {/* PosterCard wraps children in a `relative` div; the link bleeds out by the padding so it covers the whole card. */}
      {onImage && <span aria-hidden className="pointer-events-none absolute -inset-5 z-0 bg-gradient-to-b from-black/35 via-transparent to-transparent" />}
      {href && <StretchedLink href={href} name={data.name} className="-inset-5" />}
      <div className="flex min-h-[calc(18rem-2.5rem)] flex-col justify-between">
        <div className="relative z-10 flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {likeChip && <Chip tone="outline" className={posterChip}><Heart className="size-3" />{data.likes}</Chip>}
            {chips}
          </div>
          {menu}
        </div>
        <div className="relative z-10 mt-6">
          {!onImage && (
            <span aria-hidden className="mb-3 flex size-12 items-center justify-center rounded-cv-sm bg-white/15 font-display text-2xl font-semibold backdrop-blur-sm">
              {data.name.slice(0, 1)}
            </span>
          )}
          <PosterTitle className="line-clamp-2 text-xl sm:text-2xl">{data.name}</PosterTitle>
          <p className={cn('mt-1.5 line-clamp-2 text-sm', onImage ? 'text-white/85' : 'opacity-80')}>{data.intro || '还没有介绍'}</p>
          {keywords.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {keywords.map((k) => <Chip key={k} tone="outline" className={cn('px-2 py-0.5 text-[11px]', posterChip)}>{k}</Chip>)}
              {extra > 0 && <Chip tone="outline" className={cn('px-2 py-0.5 text-[11px]', posterChip)}>+{extra}</Chip>}
            </div>
          )}
          {footer && <div className="mt-4 flex flex-wrap items-center gap-2">{footer}</div>}
        </div>
      </div>
    </PosterCard>
  )
}

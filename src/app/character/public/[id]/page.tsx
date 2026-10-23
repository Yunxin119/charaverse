'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Bookmark, ChevronDown, Copy, Heart, Link2, Loader2, MessageSquare, MessageCircle, Pencil, Repeat, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/app/lib/supabase'
import { useAuth } from '@/providers/AuthProvider'
import { useForkCharacter, usePublicCharacter, useToggleLike } from '@/queries/usePublic'
import { useCharacterStats, useCharacters } from '@/queries'
import { useMyFavoriteIds, useToggleFavorite } from '@/queries/useFavorites'
import { StatTiles } from '@/components/stats/StatTiles'
import { describeTemplate, type SnapshotModule } from '@/components/character/snapshot'
import { Comments } from '@/components/character/Comments'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { GlassPanel, PosterCard, PosterTitle, Chip, IconButton } from '@/components/glass'
import { cn } from '@/lib/utils'

export default function PublicCharacterPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const characterId = Number(id)
  const q = usePublicCharacter(characterId)
  const fork = useForkCharacter()
  const like = useToggleLike()
  const [optimistic, setOptimistic] = useState<number | null>(null)
  const statsQ = useCharacterStats(Number.isFinite(characterId) ? [characterId] : [])
  const commentsQ = useCommentCount(characterId)
  const favIds = useMyFavoriteIds(user?.id)
  const toggleFav = useToggleFavorite(user?.id)
  const favorited = favIds.data?.has(characterId) ?? false
  const mineQ = useCharacters(user?.id)
  const myCopy = useMemo(() => (mineQ.data ?? []).find((x) => x.source_character_id === characterId), [mineQ.data, characterId])
  // `?comment=<id>` (notification links) → scroll to that comment once loaded
  const [targetComment, setTargetComment] = useState<number | null>(null)
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('comment')
    const n = raw ? Number(raw) : NaN
    setTargetComment(Number.isFinite(n) ? n : null)
  }, [])

  const c = q.data
  const isOwner = !!user && !!c && c.user_id === user.id
  const detail = useMemo(() => describeTemplate(c?.snapshot ? c.snapshot.prompt_template : undefined), [c])
  const likes = optimistic ?? c?.likes_count ?? 0

  const onLike = () => {
    if (!user || !c || like.isPending) return
    setOptimistic(likes + 1)
    like.mutate(c.id, { onSettled: () => setOptimistic(null) })
  }
  const onFavorite = () => {
    if (!user || !c || toggleFav.isPending) return
    toggleFav.mutate({ characterId: c.id, next: !favorited }, {
      onSuccess: (next) => toast.success(next ? '已收藏，在「探索 → 我的收藏」里找它' : '已取消收藏'),
      onError: (err) => toast.error((err as Error).message || '操作失败，请重试'),
    })
  }
  const onShare = async () => {
    if (!c) return
    const url = `${window.location.origin}/character/public/${c.id}`
    const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
    if (coarse && typeof navigator.share === 'function') {
      try { await navigator.share({ title: `${c.name} · CharaVerse`, text: c.introduction ?? '', url }); return } catch { /* cancelled or unsupported: fall back to copying */ }
    }
    try {
      await navigator.clipboard.writeText(url)
      toast.success('链接已复制，发给朋友就能打开这个角色')
    } catch {
      toast.error('复制失败，请手动复制地址栏里的链接')
    }
  }
  const onFork = () => {
    if (!user || !c?.snapshot) return
    fork.mutate({ userId: user.id, snapshot: c.snapshot, source: { id: c.id, published_at: c.published_at } }, {
      onSuccess: (newId) => { toast.success('已复制成你的角色；原角色的评论和更新会同步到它的聊天页'); router.push(`/characters/${newId}`) },
    })
  }

  return (
    <div className="h-dvh overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 pt-4 pb-32 sm:px-6 sm:pt-6 md:pb-12">
        <div className="mb-4">
          <IconButton label="返回" variant="glass" onClick={() => (history.length > 1 ? router.back() : router.push('/explore'))}>
            <ArrowLeft />
          </IconButton>
        </div>

        {q.isLoading && <Skeleton />}
        {q.isError && <PosterCard tone="ink"><PosterTitle>加载失败</PosterTitle><p className="mt-2 text-sm opacity-80">{(q.error as Error).message}</p></PosterCard>}
        {q.isSuccess && (!c || !c.snapshot) && (
          <PosterCard tone="ink" className="min-h-56">
            <PosterTitle>这个角色还没有发布</PosterTitle>
            <p className="mt-2 text-sm opacity-80">它可能被作者撤回了，或者还没点过「发布」。</p>
            <Button className="mt-5" variant="accent" onClick={() => router.push('/explore')}>去探索</Button>
          </PosterCard>
        )}

        {c && c.snapshot && (
          <div className="flex flex-col gap-5">
            <PosterCard tone="primary" image={c.avatar_url ?? undefined} className="flex min-h-72 flex-col justify-end sm:min-h-80">
              {isOwner && <Chip tone="glass" className="mb-3 self-start">这是你的角色</Chip>}
              <PosterTitle className="text-3xl sm:text-4xl">{c.name}</PosterTitle>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm opacity-85">
                <Link href={`/user/${c.user_id}`} className="flex items-center gap-1.5 hover:underline">
                  <Avatar className="size-5">
                    {c.author?.avatar_url && <AvatarImage src={c.author.avatar_url} alt="" />}
                    <AvatarFallback className="bg-cv-secondary text-[10px] text-cv-secondary-fg">{(c.author?.username ?? 'U').charAt(0)}</AvatarFallback>
                  </Avatar>
                  {c.author?.username?.trim() || '创作者'}
                </Link>
                {c.published_at && <time dateTime={c.published_at}>发布于 {new Date(c.published_at).toLocaleDateString('zh-CN')}</time>}
                <span className="flex items-center gap-1"><Heart className="size-3.5" />{likes}</span>
              </div>
            </PosterCard>

            <div className="flex flex-wrap gap-2">
              <Button variant="accent" onClick={() => router.push(`/chat/new?characterId=${c.id}`)} disabled={!user}><MessageSquare />开始聊天</Button>
              {myCopy ? (
                <Button variant="neu" asChild><Link href={`/characters/${myCopy.id}`}><Copy />去我的副本</Link></Button>
              ) : (
                <Button variant="neu" onClick={onFork} disabled={!user || fork.isPending || isOwner}>
                  {fork.isPending ? <Loader2 className="animate-spin" /> : <Copy />}复制成我的角色
                </Button>
              )}
              <Button variant="glass" onClick={onLike} disabled={!user || like.isPending} aria-label="点赞">
                <Heart className={cn(optimistic !== null && 'fill-current text-cv-accent')} />{likes}
              </Button>
              <Button variant="glass" onClick={onFavorite} disabled={!user || toggleFav.isPending} aria-pressed={favorited}>
                <Bookmark className={cn(favorited && 'fill-current text-cv-accent')} />{favorited ? '已收藏' : '收藏'}
              </Button>
              <Button variant="glass" onClick={onShare} aria-label="复制分享链接">
                <Link2 />分享
              </Button>
              {isOwner && (
                <Button variant="outline" asChild><Link href={`/characters/${c.id}/edit`}><Pencil />编辑</Link></Button>
              )}
            </div>
            {fork.isError && <p className="text-xs text-cv-danger">复制失败：{(fork.error as Error).message}</p>}
            {!user && (
              <p className="text-sm text-cv-fg-muted">
                <Link href={`/login?next=/character/public/${c.id}`} className="font-semibold text-cv-accent hover:underline">登录</Link> 后就可以和它聊天、点赞和收藏。
              </p>
            )}

            <StatTiles
              compact
              className="sm:grid-cols-4"
              items={[
                { label: '人聊过', icon: Users, value: statsQ.isSuccess ? statsQ.data.get(c.id)?.session_count ?? 0 : statsQ.isError ? 0 : undefined },
                { label: '轮数', icon: Repeat, value: statsQ.isSuccess ? statsQ.data.get(c.id)?.turn_count ?? 0 : statsQ.isError ? 0 : undefined },
                { label: '点赞', icon: Heart, value: likes },
                { label: '评论', icon: MessageCircle, value: commentsQ.isSuccess ? commentsQ.data : commentsQ.isError ? 0 : undefined },
              ]}
            />

            {(detail.introduction || detail.keywords.length > 0) && (
              <GlassPanel>
                {detail.introduction && <p className="whitespace-pre-wrap text-sm leading-relaxed">{detail.introduction}</p>}
                {detail.keywords.length > 0 && (
                  <div className={cn('flex flex-wrap gap-1.5', detail.introduction && 'mt-4')}>
                    {detail.keywords.map((k) => <Chip key={k}>{k}</Chip>)}
                  </div>
                )}
              </GlassPanel>
            )}

            <GlassPanel className="flex flex-col gap-3">
              <h2 className="font-display text-xl font-semibold">设定</h2>
              {(() => {
                const items: SnapshotModule[] = []
                if (detail.description) items.push({ type: '基本设定', content: detail.description })
                if (detail.personality) items.push({ type: '性格', content: detail.personality })
                items.push(...detail.modules)
                if (detail.initialMessage) items.push({ type: '开场白', content: detail.initialMessage })
                return items.length === 0
                  ? <p className="text-sm text-cv-fg-muted">作者没有公开更多设定。</p>
                  : items.map((m, i) => <ModuleRow key={i} module={m} defaultOpen={i === 0} />)
              })()}
            </GlassPanel>

            <Comments characterId={c.id} authorId={c.user_id} highlightId={targetComment} />
          </div>
        )}
      </div>
    </div>
  )
}

/** Head-only count of comments under a character (public read). */
function useCommentCount(characterId: number) {
  return useQuery({
    queryKey: ['character-comments', 'count', characterId] as const,
    enabled: Number.isFinite(characterId),
    staleTime: 30_000,
    queryFn: async () => {
      const { count, error } = await supabase.from('character_comments').select('id', { count: 'exact', head: true }).eq('character_id', characterId)
      if (error) throw error
      return count ?? 0
    },
  })
}

function ModuleRow({ module: m, defaultOpen }: { module: SnapshotModule; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div className="neu rounded-cv-md">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="flex min-w-0 items-center gap-2">
          <Chip tone="outline" className="shrink-0">{m.type}</Chip>
          {m.title && <span className="truncate text-sm font-semibold">{m.title}</span>}
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-cv-fg-subtle transition-transform', open && 'rotate-180')} />
      </button>
      {open && <p className="whitespace-pre-wrap px-4 pb-4 text-sm leading-relaxed text-cv-fg">{m.content || '（空）'}</p>}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5">
      <div className="glass min-h-72 rounded-cv-lg" />
      <div className="flex gap-2"><span className="h-10 w-28 rounded-full bg-cv-fg/10" /><span className="h-10 w-36 rounded-full bg-cv-fg/10" /></div>
      <div className="glass h-24 rounded-cv-lg" />
      <div className="glass h-40 rounded-cv-lg" />
    </div>
  )
}

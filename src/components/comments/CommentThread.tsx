'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { CornerDownRight, Heart, ImagePlus, Loader2, MessageCircle, Send, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/app/lib/supabase'
import { compressImage, uploadCommentImages, validateImageFile, type CompressedImage } from '@/app/lib/imageUtils'
import ImageViewer from '@/app/components/ImageViewer'
import { useAuth } from '@/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Chip, GlassPanel, IconButton } from '@/components/glass'
import { cn } from '@/lib/utils'

/**
 * Comment thread under a public character (table `character_comments`).
 * One level of replies: `parent_id` always points at a top-level comment.
 * Images (≤ 3, via `uploadCommentImages`) only on top-level comments; replies are text only.
 * Deleting is allowed for the comment's owner and for the character's author (RLS enforces both).
 *
 * `variant="page"`  – stacked layout for the public character page.
 * `variant="panel"` – compact, scrollable list + composer pinned at the bottom (340px chat side column).
 */

export interface CharacterComment {
  id: number
  character_id: number
  user_id: string
  content: string
  images?: string[] | null
  parent_id?: number | null
  likes_count?: number | null
  created_at: string
  author: { username?: string; avatar_url?: string } | null
  /** the viewer has liked it (only known when signed in) */
  liked?: boolean
}

interface Thread {
  root: CharacterComment
  replies: CharacterComment[]
}

const MAX_IMAGES = 3
const MAX_COMMENT = 2000
const MAX_REPLY = 500

export const commentsKey = (characterId: number) => ['comments', characterId] as const

function useComments(characterId: number, viewerId: string | undefined) {
  return useQuery({
    queryKey: [...commentsKey(characterId), viewerId ?? ''],
    enabled: Number.isFinite(characterId),
    queryFn: async (): Promise<CharacterComment[]> => {
      const { data, error } = await supabase
        .from('character_comments')
        .select('id, character_id, user_id, content, images, parent_id, likes_count, created_at')
        .eq('character_id', characterId)
        .order('created_at', { ascending: true })
      if (error) throw error
      const rows = (data ?? []) as Omit<CharacterComment, 'author'>[]
      if (rows.length === 0) return []
      const ids = Array.from(new Set(rows.map((r) => r.user_id)))
      const [{ data: profiles }, { data: myLikes }] = await Promise.all([
        supabase.from('profiles').select('id, username, avatar_url').in('id', ids),
        viewerId
          ? supabase.from('comment_likes').select('comment_id').eq('user_id', viewerId).in('comment_id', rows.map((r) => r.id))
          : Promise.resolve({ data: [] as { comment_id: number }[] }),
      ])
      const byId = new Map((profiles ?? []).map((p) => [p.id as string, p as { username?: string; avatar_url?: string }]))
      const liked = new Set((myLikes ?? []).map((l) => l.comment_id as number))
      return rows.map((r) => ({ ...r, author: byId.get(r.user_id) ?? null, liked: liked.has(r.id) }))
    },
  })
}

/** Group replies under their top-level parent. Roots newest-first, replies oldest-first (rows arrive ascending). */
function buildThreads(rows: CharacterComment[]): Thread[] {
  const byRoot = new Map<number, Thread>()
  const orphans: CharacterComment[] = []
  for (const r of rows) if (r.parent_id == null) byRoot.set(r.id, { root: r, replies: [] })
  for (const r of rows) {
    if (r.parent_id == null) continue
    const t = byRoot.get(r.parent_id)
    if (t) t.replies.push(r)
    else orphans.push(r)
  }
  const threads = [...byRoot.values(), ...orphans.map((root) => ({ root, replies: [] }))]
  return threads.sort((a, b) => b.root.created_at.localeCompare(a.root.created_at))
}

/** PostgrestError is a plain object in some supabase-js builds, so don't rely on `instanceof Error`. */
function errorText(e: unknown, fallback: string) {
  const msg = typeof e === 'object' && e !== null && 'message' in e ? (e as { message?: unknown }).message : null
  return typeof msg === 'string' && msg.trim() ? msg : fallback
}

export interface CommentThreadProps {
  characterId: number
  /** the character's author – gets the 「作者」 badge and may delete any comment */
  authorId: string
  variant?: 'page' | 'panel'
  className?: string
  /** comment to scroll to and flash once the list is loaded (e.g. from a notification link) */
  highlightId?: number | null
}

/** DOM id of a comment's list item, used for deep links (`?comment=<id>`). */
export const commentDomId = (id: number) => `comment-${id}`

export function CommentThread({ characterId, authorId, variant = 'page', className, highlightId }: CommentThreadProps) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const comments = useComments(characterId, user?.id)
  const panel = variant === 'panel'
  const viewerIsAuthor = !!user && user.id === authorId

  const [replyTo, setReplyTo] = useState<{ rootId: number; prefill: string } | null>(null)
  const [viewer, setViewer] = useState<{ images: string[]; index: number } | null>(null)

  const threads = useMemo(() => buildThreads(comments.data ?? []), [comments.data])
  const total = comments.data?.length ?? 0

  // deep link: scroll the target comment into view and flash it once the list has rendered
  const [flashId, setFlashId] = useState<number | null>(null)
  const highlightedRef = useRef<number | null>(null)
  useEffect(() => {
    if (!highlightId || !comments.data || highlightedRef.current === highlightId) return
    highlightedRef.current = highlightId
    const exists = comments.data.some((c) => c.id === highlightId)
    if (!exists) { toast('这条评论已经被删除了'); return }
    // the page above keeps growing for a moment (poster image, stat tiles), so re-scroll a few times
    const scroll = () => document.getElementById(commentDomId(highlightId))?.scrollIntoView({ block: 'center' })
    const timers = [50, 400, 1200].map((ms) => setTimeout(scroll, ms))
    setFlashId(highlightId)
    timers.push(setTimeout(() => setFlashId(null), 3200))
    return () => timers.forEach(clearTimeout)
  }, [highlightId, comments.data])
  const flashClass = (id: number) => flashId === id && 'ring-2 ring-cv-accent/70 bg-cv-accent/10 transition-colors duration-700'

  const invalidate = () => qc.invalidateQueries({ queryKey: commentsKey(characterId) })

  const postReply = useMutation({
    mutationFn: async ({ rootId, content }: { rootId: number; content: string }) => {
      if (!user) throw new Error('请先登录')
      const { error } = await supabase
        .from('character_comments')
        .insert({ character_id: characterId, user_id: user.id, content, parent_id: rootId })
      if (error) throw error
    },
    onSuccess: () => {
      setReplyTo(null)
      toast.success('回复已发布')
      void invalidate()
    },
    onError: (e) => toast.error(errorText(e, '回复失败，请重试')),
  })

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const { data, error } = await supabase.from('character_comments').delete().eq('id', id).select('id')
      if (error) throw error
      if (!data?.length) throw new Error('没有权限删除这条评论')
    },
    onSuccess: () => { toast.success('评论已删除'); void invalidate() },
    onError: (e) => toast.error(errorText(e, '删除失败，请重试')),
  })

  const like = useMutation({
    mutationFn: async (id: number) => {
      const { data, error } = await supabase.rpc('toggle_comment_like', { p_comment_id: id })
      if (error) throw error
      return typeof data === 'number' ? data : null
    },
    onMutate: async (id) => {
      const key = [...commentsKey(characterId), user?.id ?? '']
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<CharacterComment[]>(key)
      qc.setQueryData<CharacterComment[]>(key, (old) => old?.map((c) => (
        c.id === id ? { ...c, liked: !c.liked, likes_count: Math.max(0, (c.likes_count ?? 0) + (c.liked ? -1 : 1)) } : c
      )))
      return { prev, key }
    },
    onError: (e, _id, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev)
      toast.error(errorText(e, '点赞失败，请重试'))
    },
    onSuccess: (count, id, ctx) => {
      if (count === null || !ctx) return
      qc.setQueryData<CharacterComment[]>(ctx.key, (old) => old?.map((c) => (c.id === id ? { ...c, likes_count: count } : c)))
    },
  })
  const onLike = (c: CharacterComment) => {
    if (!user) { toast('登录后可以点赞'); return }
    if (like.isPending) return
    like.mutate(c.id)
  }

  const canDelete = (c: CharacterComment) => !!user && (c.user_id === user.id || viewerIsAuthor)
  const onDelete = (c: CharacterComment) => { if (confirm('确定删除这条评论？')) remove.mutate(c.id) }
  const openReply = (rootId: number, target?: CharacterComment) => {
    if (!user) { toast('登录后可以回复'); return }
    const name = target ? displayName(target) : ''
    setReplyTo({ rootId, prefill: target && target.parent_id != null ? `@${name} ` : '' })
  }

  const countLabel = comments.data ? `${total} 条评论` : null

  const list = (
    <>
      {comments.isLoading && (
        <div className="flex items-center gap-2 py-3 text-sm text-cv-fg-muted"><Loader2 className="size-4 animate-spin" />加载评论…</div>
      )}
      {comments.isError && (
        <p className="py-3 text-sm text-cv-danger">
          评论加载失败：{errorText(comments.error, '请刷新重试')}
          <button type="button" className="ml-2 font-semibold text-cv-accent hover:underline" onClick={() => void comments.refetch()}>重试</button>
        </p>
      )}
      {comments.data?.length === 0 && (
        <p className={cn('text-center text-sm text-cv-fg-muted', panel ? 'py-8' : 'py-6')}>还没有评论，来说第一句吧。</p>
      )}
      <ul className={cn('flex flex-col', panel ? 'gap-2' : 'gap-3')}>
        {threads.map(({ root, replies }) => (
          <li key={root.id} id={commentDomId(root.id)} className={cn(panel ? 'rounded-cv-md bg-cv-bg-elevated/60 p-3' : 'glass rounded-cv-lg p-4', 'scroll-mt-24', flashClass(root.id))}>
            <CommentItem
              comment={root}
              compact={panel}
              isAuthor={root.user_id === authorId}
              deletable={canDelete(root)}
              onDelete={() => onDelete(root)}
              onReply={() => openReply(root.id)}
              onLike={() => onLike(root)}
              onOpenImage={(index) => setViewer({ images: root.images ?? [], index })}
            />
            {replies.length > 0 && (
              <ul className={cn('mt-2 flex flex-col border-l-2 border-cv-border', panel ? 'ml-3 gap-2 pl-3' : 'ml-5 gap-3 pl-4')}>
                {replies.map((r) => (
                  <li key={r.id} id={commentDomId(r.id)} className={cn('scroll-mt-24 rounded-cv-md', flashClass(r.id))}>
                    <CommentItem
                      comment={r}
                      compact
                      isAuthor={r.user_id === authorId}
                      deletable={canDelete(r)}
                      onDelete={() => onDelete(r)}
                      onReply={() => openReply(root.id, r)}
                      onLike={() => onLike(r)}
                    />
                  </li>
                ))}
              </ul>
            )}
            {replyTo?.rootId === root.id && (
              <ReplyBox
                key={replyTo.prefill}
                compact={panel}
                prefill={replyTo.prefill}
                pending={postReply.isPending}
                error={postReply.isError ? errorText(postReply.error, '回复失败，请重试') : null}
                onCancel={() => { postReply.reset(); setReplyTo(null) }}
                onSubmit={(content) => postReply.mutate({ rootId: root.id, content })}
              />
            )}
          </li>
        ))}
      </ul>
    </>
  )

  const composer = (
    <TopLevelComposer
      characterId={characterId}
      compact={panel}
      onPosted={() => { toast.success('评论已发布'); void invalidate() }}
    />
  )

  return (
    <section
      data-variant={variant}
      className={cn('flex flex-col', panel ? 'h-full min-h-0' : 'gap-4', className)}
      aria-label="评论"
    >
      {panel ? (
        <>
          <p className="shrink-0 px-4 pb-1 text-xs text-cv-fg-subtle">{countLabel ?? ' '}</p>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3">{list}</div>
          <div className="shrink-0 border-t border-cv-border p-3">{composer}</div>
        </>
      ) : (
        <>
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
            <MessageCircle className="size-5 text-cv-accent" />评论
            {countLabel && <span className="text-sm font-normal text-cv-fg-muted">{countLabel}</span>}
          </h2>
          {composer}
          {list}
        </>
      )}

      <ImageViewer images={viewer?.images ?? []} isOpen={!!viewer} onClose={() => setViewer(null)} initialIndex={viewer?.index ?? 0} />
    </section>
  )
}

// ---------------------------------------------------------------------------

function displayName(c: CharacterComment) {
  return c.author?.username?.trim() || '评论者'
}

const LONG = (s: string) => s.length > 150 || s.split('\n').length > 3

function CommentItem({
  comment, compact, isAuthor, deletable, onDelete, onReply, onLike, onOpenImage,
}: {
  comment: CharacterComment
  compact?: boolean
  isAuthor: boolean
  deletable: boolean
  onDelete: () => void
  onReply: () => void
  onLike: () => void
  onOpenImage?: (i: number) => void
}) {
  const likes = comment.likes_count ?? 0
  const [expanded, setExpanded] = useState(false)
  const name = displayName(comment)
  const long = LONG(comment.content)
  const shown = long && !expanded ? comment.content.split('\n').slice(0, 3).join('\n').slice(0, 150) : comment.content
  const isReply = comment.parent_id != null
  return (
    <div className={cn('flex', compact ? 'gap-2' : 'gap-3')}>
      <Avatar className={cn('shrink-0', isReply ? 'size-6' : compact ? 'size-7' : 'size-9')}>
        {comment.author?.avatar_url && <AvatarImage src={comment.author.avatar_url} alt="" />}
        <AvatarFallback className="bg-cv-secondary text-xs text-cv-secondary-fg">{name.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className={cn('truncate font-semibold', compact ? 'text-[13px]' : 'text-sm')}>{name}</span>
            {isAuthor && <Chip tone="accent" className="px-2 py-0.5 text-[10px]">作者</Chip>}
            <time className="shrink-0 text-xs text-cv-fg-subtle" dateTime={comment.created_at}>
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: zhCN })}
            </time>
          </div>
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={onLike}
              aria-label={comment.liked ? '取消点赞' : '点赞'}
              aria-pressed={!!comment.liked}
              className={cn('flex h-7 items-center gap-1 rounded-full px-2 text-xs font-semibold transition-colors', comment.liked ? 'text-cv-accent' : 'text-cv-fg-muted hover:text-cv-fg')}
            >
              <Heart className={cn('size-3.5', comment.liked && 'fill-current')} />{likes > 0 && likes}
            </button>
            <IconButton label="回复" size="sm" className="size-7 text-cv-fg-muted hover:text-cv-fg" onClick={onReply}>
              <CornerDownRight className="size-3.5" />
            </IconButton>
            {deletable && (
              <IconButton label="删除评论" size="sm" className="size-7 text-cv-danger" onClick={onDelete}>
                <Trash2 className="size-3.5" />
              </IconButton>
            )}
          </div>
        </div>
        {comment.content && (
          <p className={cn('mt-0.5 whitespace-pre-wrap leading-relaxed text-cv-fg', compact ? 'text-[13px]' : 'text-sm')}>
            {shown}{long && !expanded && '…'}
            {long && (
              <button type="button" onClick={() => setExpanded((v) => !v)} className="ml-1 text-xs font-semibold text-cv-accent hover:underline">
                {expanded ? '收起' : '展开'}
              </button>
            )}
          </p>
        )}
        {!isReply && comment.images && comment.images.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {comment.images.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => onOpenImage?.(i)}
                className={cn('overflow-hidden rounded-cv-md ring-1 ring-cv-border transition hover:ring-cv-accent', compact ? 'size-14' : 'size-20')}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`评论图片 ${i + 1}`} className="size-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function ReplyBox({
  compact, prefill, pending, error, onCancel, onSubmit,
}: {
  compact?: boolean
  prefill: string
  pending: boolean
  error: string | null
  onCancel: () => void
  onSubmit: (content: string) => void
}) {
  const [text, setText] = useState(prefill)
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])
  const trimmed = text.trim()
  const canSend = trimmed.length > 0 && trimmed.length <= MAX_REPLY && !pending
  const submit = () => { if (canSend) onSubmit(trimmed) }
  return (
    <div className={cn('mt-2 flex flex-col gap-2', compact ? 'ml-3 pl-3' : 'ml-5 pl-4')}>
      <Textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MAX_REPLY}
        placeholder="写下你的回复…"
        disabled={pending}
        className="min-h-14 resize-none px-3 py-2 text-sm"
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submit() } }}
      />
      {error && <p className="text-xs text-cv-danger">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-cv-fg-subtle">{text.length}/{MAX_REPLY}</span>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>取消</Button>
          <Button size="sm" variant="accent" disabled={!canSend} onClick={submit}>
            {pending ? <Loader2 className="animate-spin" /> : <Send />}回复
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function TopLevelComposer({ characterId, compact, onPosted }: { characterId: number; compact?: boolean; onPosted: () => void }) {
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [images, setImages] = useState<CompressedImage[]>([])
  const [imgError, setImgError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const post = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('请先登录')
      const { data, error } = await supabase
        .from('character_comments')
        .insert({ character_id: characterId, user_id: user.id, content: text.trim() })
        .select('id')
        .single()
      if (error) throw error
      if (images.length > 0) {
        const urls = await uploadCommentImages(images.map((i) => i.file), String(data.id))
        const { error: upErr } = await supabase.from('character_comments').update({ images: urls }).eq('id', data.id)
        if (upErr) throw upErr
      }
    },
    onSuccess: () => {
      setText('')
      images.forEach((i) => URL.revokeObjectURL(i.preview))
      setImages([])
      onPosted()
    },
    onError: (e) => toast.error(errorText(e, '发布失败，请重试')),
  })

  const pickFiles = async (files: FileList | null) => {
    if (!files) return
    setImgError(null)
    const slots = MAX_IMAGES - images.length
    const next: CompressedImage[] = []
    try {
      for (const f of Array.from(files).slice(0, slots)) {
        validateImageFile(f)
        next.push(await compressImage(f))
      }
      setImages((prev) => [...prev, ...next])
    } catch (e) {
      setImgError(errorText(e, '图片处理失败'))
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const removeImage = (idx: number) =>
    setImages((prev) => {
      URL.revokeObjectURL(prev[idx].preview)
      return prev.filter((_, i) => i !== idx)
    })

  const canPost = !!user && (text.trim().length > 0 || images.length > 0) && text.length <= MAX_COMMENT && !post.isPending

  const body = (
    <>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MAX_COMMENT}
        placeholder={user ? '说点什么…' : '登录后可以评论'}
        disabled={!user || post.isPending}
        className={cn('resize-none', compact ? 'min-h-14 px-3 py-2 text-sm' : 'min-h-20')}
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canPost) { e.preventDefault(); post.mutate() } }}
      />
      {images.length > 0 && (
        <div className="flex gap-2">
          {images.map((img, i) => (
            <div key={img.preview} className={cn('relative overflow-hidden rounded-cv-md', compact ? 'size-12' : 'size-16')}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.preview} alt="" className="size-full object-cover" />
              <button type="button" onClick={() => removeImage(i)} aria-label="移除图片" className="absolute top-1 right-1 rounded-full bg-cv-fg/70 p-0.5 text-cv-bg">
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {(imgError || post.isError) && <p className="text-xs text-cv-danger">{imgError ?? errorText(post.error, '发布失败，请重试')}</p>}
      <div className="flex items-center justify-between gap-2">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => void pickFiles(e.target.files)} />
        <IconButton label="添加图片" variant="neu" size="sm" disabled={!user || images.length >= MAX_IMAGES || post.isPending} onClick={() => fileRef.current?.click()}>
          <ImagePlus />
        </IconButton>
        <Button size="sm" variant="accent" disabled={!canPost} onClick={() => post.mutate()}>
          {post.isPending ? <Loader2 className="animate-spin" /> : <Send />}{compact ? '发布' : '发布评论'}
        </Button>
      </div>
    </>
  )

  return compact
    ? <div className="flex flex-col gap-2">{body}</div>
    : <GlassPanel padding="sm" className="flex flex-col gap-3">{body}</GlassPanel>
}

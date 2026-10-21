'use client'

import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { ImagePlus, Loader2, MessageCircle, Send, Trash2, X } from 'lucide-react'
import { supabase } from '@/app/lib/supabase'
import { compressImage, uploadCommentImages, validateImageFile, type CompressedImage } from '@/app/lib/imageUtils'
import ImageViewer from '@/app/components/ImageViewer'
import { useAuth } from '@/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { GlassPanel, IconButton } from '@/components/glass'
import { cn } from '@/lib/utils'

/**
 * Comments under a public character. Table `character_comments`
 * (id, character_id, user_id, content, images text[], created_at); images go to
 * storage via `uploadCommentImages`; authors are joined from `profiles`.
 */

export interface CharacterComment {
  id: number
  character_id: number
  user_id: string
  content: string
  images?: string[] | null
  created_at: string
  author: { username?: string; avatar_url?: string } | null
}

const MAX_IMAGES = 3
const commentsKey = (characterId: number) => ['character-comments', characterId] as const

function useComments(characterId: number) {
  return useQuery({
    queryKey: commentsKey(characterId),
    enabled: Number.isFinite(characterId),
    queryFn: async (): Promise<CharacterComment[]> => {
      const { data, error } = await supabase
        .from('character_comments')
        .select('id, character_id, user_id, content, images, created_at')
        .eq('character_id', characterId)
        .order('created_at', { ascending: false })
      if (error) throw error
      const rows = (data ?? []) as Omit<CharacterComment, 'author'>[]
      if (rows.length === 0) return []
      const ids = Array.from(new Set(rows.map((r) => r.user_id)))
      const { data: profiles } = await supabase.from('profiles').select('id, username, avatar_url').in('id', ids)
      const byId = new Map((profiles ?? []).map((p) => [p.id as string, p as { username?: string; avatar_url?: string }]))
      return rows.map((r) => ({ ...r, author: byId.get(r.user_id) ?? null }))
    },
  })
}

export function Comments({ characterId }: { characterId: number }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const comments = useComments(characterId)
  const [text, setText] = useState('')
  const [images, setImages] = useState<CompressedImage[]>([])
  const [imgError, setImgError] = useState<string | null>(null)
  const [viewer, setViewer] = useState<{ images: string[]; index: number } | null>(null)
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
      qc.invalidateQueries({ queryKey: commentsKey(characterId) })
    },
  })

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('character_comments').delete().eq('id', id).eq('user_id', user!.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: commentsKey(characterId) }),
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
      setImgError(e instanceof Error ? e.message : '图片处理失败')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const removeImage = (idx: number) =>
    setImages((prev) => {
      URL.revokeObjectURL(prev[idx].preview)
      return prev.filter((_, i) => i !== idx)
    })

  const canPost = !!user && (text.trim().length > 0 || images.length > 0) && !post.isPending

  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
        <MessageCircle className="size-5 text-cv-accent" />评论
        {comments.data && <span className="text-sm font-normal text-cv-fg-muted">{comments.data.length}</span>}
      </h2>

      <GlassPanel padding="sm" className="flex flex-col gap-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={user ? '说点什么…' : '登录后可以评论'}
          disabled={!user || post.isPending}
          className="min-h-20 resize-none"
        />
        {images.length > 0 && (
          <div className="flex gap-2">
            {images.map((img, i) => (
              <div key={img.preview} className="relative size-16 overflow-hidden rounded-cv-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.preview} alt="" className="size-full object-cover" />
                <button type="button" onClick={() => removeImage(i)} aria-label="移除图片" className="absolute top-1 right-1 rounded-full bg-cv-fg/70 p-0.5 text-cv-bg">
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {(imgError || post.isError) && <p className="text-xs text-cv-danger">{imgError ?? (post.error as Error)?.message ?? '发布失败，请重试'}</p>}
        <div className="flex items-center justify-between gap-2">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => void pickFiles(e.target.files)} />
          <IconButton label="添加图片" variant="neu" size="sm" disabled={!user || images.length >= MAX_IMAGES || post.isPending} onClick={() => fileRef.current?.click()}>
            <ImagePlus />
          </IconButton>
          <Button size="sm" variant="accent" disabled={!canPost} onClick={() => post.mutate()}>
            {post.isPending ? <Loader2 className="animate-spin" /> : <Send />}发布评论
          </Button>
        </div>
      </GlassPanel>

      {comments.isLoading && (
        <div className="flex items-center gap-2 text-sm text-cv-fg-muted"><Loader2 className="size-4 animate-spin" />加载评论…</div>
      )}
      {comments.data?.length === 0 && (
        <p className="py-6 text-center text-sm text-cv-fg-muted">还没有评论，来说第一句吧。</p>
      )}
      <ul className="flex flex-col gap-3">
        {comments.data?.map((c) => (
          <CommentItem
            key={c.id}
            comment={c}
            mine={c.user_id === user?.id}
            onDelete={() => { if (confirm('确定删除这条评论？')) remove.mutate(c.id) }}
            onOpenImage={(index) => setViewer({ images: c.images ?? [], index })}
          />
        ))}
      </ul>

      <ImageViewer images={viewer?.images ?? []} isOpen={!!viewer} onClose={() => setViewer(null)} initialIndex={viewer?.index ?? 0} />
    </section>
  )
}

const LONG = (s: string) => s.length > 150 || s.split('\n').length > 3

function CommentItem({ comment, mine, onDelete, onOpenImage }: { comment: CharacterComment; mine: boolean; onDelete: () => void; onOpenImage: (i: number) => void }) {
  const [expanded, setExpanded] = useState(false)
  const name = comment.author?.username?.trim() || '评论者'
  const long = LONG(comment.content)
  const shown = long && !expanded ? comment.content.split('\n').slice(0, 3).join('\n').slice(0, 150) : comment.content
  return (
    <li className="glass flex gap-3 rounded-cv-lg p-4">
      <Avatar className="size-9">
        {comment.author?.avatar_url && <AvatarImage src={comment.author.avatar_url} alt="" />}
        <AvatarFallback className="bg-cv-secondary text-sm text-cv-secondary-fg">{name.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-sm font-semibold">{name}</span>
            <time className="shrink-0 text-xs text-cv-fg-subtle" dateTime={comment.created_at}>
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: zhCN })}
            </time>
          </div>
          {mine && <IconButton label="删除评论" size="sm" className="text-cv-danger" onClick={onDelete}><Trash2 className="size-4" /></IconButton>}
        </div>
        {comment.content && (
          <p className={cn('mt-1 whitespace-pre-wrap text-sm leading-relaxed text-cv-fg')}>
            {shown}{long && !expanded && '…'}
            {long && (
              <button type="button" onClick={() => setExpanded((v) => !v)} className="ml-1 text-xs font-semibold text-cv-accent hover:underline">
                {expanded ? '收起' : '展开'}
              </button>
            )}
          </p>
        )}
        {comment.images && comment.images.length > 0 && (
          <div className="mt-2 flex gap-2">
            {comment.images.map((src, i) => (
              <button key={src} type="button" onClick={() => onOpenImage(i)} className="size-20 overflow-hidden rounded-cv-md ring-1 ring-cv-border transition hover:ring-cv-accent">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`评论图片 ${i + 1}`} className="size-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </li>
  )
}

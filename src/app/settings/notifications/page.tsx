'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Bell, CornerDownRight, MessageCircle, Sparkles, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useAuth } from '@/providers/AuthProvider'
import { useDeleteNotification, useMarkAllNotificationsRead, useNotifications, type NotificationItem } from '@/queries/useNotifications'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { GlassPanel, IconButton, PosterCard, PosterTitle } from '@/components/glass'
import { cn } from '@/lib/utils'

export default function NotificationsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const list = useNotifications(user?.id)
  const markAll = useMarkAllNotificationsRead(user?.id)
  const remove = useDeleteNotification(user?.id)

  // opening the inbox clears the badge; rows keep their unread highlight for this visit
  const hasUnread = !!list.data?.some((n) => !n.read_at)
  useEffect(() => {
    if (hasUnread && !markAll.isPending && !markAll.isSuccess) markAll.mutate()
  }, [hasUnread, markAll])

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex items-center gap-3">
        <IconButton label="返回" variant="glass" onClick={() => (history.length > 1 ? router.back() : router.push('/settings'))}><ArrowLeft /></IconButton>
        <div>
          <h1 className="font-display text-3xl font-semibold">通知</h1>
          <p className="mt-1 text-sm text-cv-fg-muted">别人回复你的评论、评论你的角色，或者你复制 / 收藏的角色有更新时会出现在这里。</p>
        </div>
      </header>

      {list.isLoading && <GlassPanel className="animate-pulse h-40" />}
      {list.isError && <PosterCard tone="ink"><PosterTitle>加载失败</PosterTitle><p className="mt-2 text-sm opacity-80">{(list.error as Error).message}</p></PosterCard>}
      {list.data && list.data.length === 0 && (
        <PosterCard tone="secondary" className="min-h-48">
          <Bell className="mb-3 size-8 opacity-80" />
          <PosterTitle>还没有通知</PosterTitle>
          <p className="mt-2 max-w-md text-sm opacity-80">发布角色、在别人的角色下留言，之后的互动都会在这里提醒你。</p>
        </PosterCard>
      )}
      {list.data && list.data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {list.data.map((n) => <Row key={n.id} n={n} onDelete={() => remove.mutate(n.id)} />)}
        </ul>
      )}
    </div>
  )
}

function Row({ n, onDelete }: { n: NotificationItem; onDelete: () => void }) {
  const name = n.actor?.username?.trim() || '有人'
  const unread = !n.read_at
  const isUpdate = n.kind === 'character_update'
  const copyId = typeof n.payload?.copy_id === 'number' ? n.payload.copy_id : null
  const note = typeof n.payload?.note === 'string' ? n.payload.note.trim() : ''
  const href = isUpdate && copyId != null
    ? `/characters/${copyId}`
    : n.character_id != null
      ? `/character/public/${n.character_id}${n.comment ? `?comment=${n.comment_id}` : ''}`
      : '/explore'
  const verb = isUpdate
    ? (copyId != null ? '更新了你复制的角色' : '更新了你收藏的角色')
    : n.kind === 'reply' ? '回复了你的评论' : (n.comment?.parent_id != null ? '在你的角色下回复了评论' : '评论了你的角色')
  const Icon = isUpdate ? Sparkles : n.kind === 'reply' ? CornerDownRight : MessageCircle
  const body = isUpdate
    ? (note || <span className="text-cv-fg-subtle">（作者没有写更新说明）{copyId != null ? '，去角色主页可以选择是否更新你的副本' : ''}</span>)
    : (n.comment ? n.comment.content : <span className="text-cv-fg-subtle">（这条评论已被删除）</span>)
  return (
    <li className={cn('glass flex items-start gap-3 rounded-cv-lg p-4', unread && 'ring-1 ring-cv-accent/40')}>
      <Avatar className="size-9 shrink-0">
        {n.actor?.avatar_url && <AvatarImage src={n.actor.avatar_url} alt="" />}
        <AvatarFallback className="bg-cv-secondary text-xs text-cv-secondary-fg">{name.charAt(0)}</AvatarFallback>
      </Avatar>
      <Link href={href} className="min-w-0 flex-1 outline-none focus-visible:underline">
        <p className="flex flex-wrap items-center gap-x-1.5 text-sm">
          {unread && <span aria-label="未读" className="size-2 shrink-0 rounded-full bg-cv-accent" />}
          <span className="font-semibold">{name}</span>
          <span className="text-cv-fg-muted">{verb}</span>
          {n.character_name && <span className="font-semibold">「{n.character_name}」</span>}
          <Icon className="size-3.5 text-cv-fg-subtle" aria-hidden />
        </p>
        <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-cv-fg">{body}</p>
        <time className="mt-1 block text-xs text-cv-fg-subtle" dateTime={n.created_at}>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: zhCN })}</time>
      </Link>
      <IconButton label="删除通知" size="sm" className="size-7 shrink-0 text-cv-fg-subtle hover:text-cv-danger" onClick={onDelete}><Trash2 className="size-3.5" /></IconButton>
    </li>
  )
}

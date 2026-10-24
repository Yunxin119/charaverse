'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Brain, History, MoreHorizontal, Settings2, GitBranch, ChevronDown, Palette, MessagesSquare, Download, MessageSquareText, BookOpenText, Rows3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { IconButton } from '@/components/glass'
import type { Speaker } from './MessageBubble'

interface Props {
  sessionId: string
  character: Speaker & { id: number }
  title?: string | null
  modelLabel?: string
  presetLabel?: string
  onOpenSettings: () => void
  onNewBranchFromEnd?: () => void
  /** opens the export dialog (rendered by ChatView) */
  onExport?: () => void
  /** public characters only: comment panel toggle (rendered by ChatView) */
  commentsAvailable?: boolean
  commentsOpen?: boolean
  onToggleComments?: () => void
  /** current layout + switch (saved per session by ChatView) */
  layout?: 'flow' | 'novel'
  onToggleLayout?: () => void
  /** visual-novel mode: overlay the stage, fade in on hover / focus, or when `revealed` */
  floating?: boolean
  revealed?: boolean
}

export function ChatHeader({ sessionId, character, title, modelLabel, presetLabel, onOpenSettings, onNewBranchFromEnd, onExport, commentsAvailable, commentsOpen, onToggleComments, layout, onToggleLayout, floating, revealed }: Props) {
  const router = useRouter()
  return (
    <header
      id="cv_chat_header"
      data-floating={floating ? '' : undefined}
      className={cn(
        'z-20 px-3 pt-3 sm:px-5 sm:pt-4',
        floating
          ? cn('absolute inset-x-0 top-0 transition-opacity duration-(--cv-dur) hover:opacity-100 focus-within:opacity-100', revealed ? 'opacity-100' : 'opacity-0')
          : 'sticky top-0'
      )}
    >
      <div className="glass mx-auto flex max-w-3xl items-center gap-2 rounded-full py-1.5 pl-1.5 pr-1.5">
        <IconButton id="cv_back_button" label="返回" variant="ghost" size="sm" onClick={() => router.push(`/characters/${character.id}`)}>
          <ArrowLeft />
        </IconButton>
        <Avatar className="size-9 rounded-cv-sm">
          <AvatarImage src={character.avatarUrl ?? undefined} alt={character.name} />
          <AvatarFallback className="rounded-cv-sm bg-cv-secondary text-xs font-semibold text-cv-secondary-fg">{character.name.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold leading-tight">{character.name}</div>
          <button type="button" onClick={onOpenSettings} className="flex max-w-full items-center gap-1 truncate text-[11px] text-cv-fg-subtle hover:text-cv-fg">
            <span className="truncate">{modelLabel ?? '未选择模型'}{presetLabel ? ` · ${presetLabel}` : ''}</span>
            <ChevronDown className="size-3 shrink-0" />
          </button>
        </div>
        <IconButton label="记忆" variant="ghost" size="sm" onClick={() => router.push(`/chat/${sessionId}/memory`)} className="hidden sm:inline-flex">
          <Brain />
        </IconButton>
        {commentsAvailable && onToggleComments && (
          <IconButton
            id="cv_comments_button"
            label={commentsOpen ? '收起评论' : '评论'}
            variant="ghost"
            size="sm"
            aria-pressed={!!commentsOpen}
            onClick={onToggleComments}
            className="aria-pressed:bg-[color-mix(in_oklab,var(--cv-accent)_14%,transparent)] aria-pressed:text-cv-accent"
          >
            <MessageSquareText />
          </IconButton>
        )}
        {onToggleLayout && (
          <IconButton
            id="cv_layout_button"
            label={layout === 'novel' ? '切换到对话流' : '切换到视觉小说'}
            variant="ghost"
            size="sm"
            aria-pressed={layout === 'novel'}
            onClick={onToggleLayout}
            className="aria-pressed:bg-[color-mix(in_oklab,var(--cv-accent)_14%,transparent)] aria-pressed:text-cv-accent"
          >
            {layout === 'novel' ? <Rows3 /> : <BookOpenText />}
          </IconButton>
        )}
        <IconButton label="会话设置" variant="ghost" size="sm" onClick={onOpenSettings}>
          <Settings2 />
        </IconButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label="更多" variant="ghost" size="sm"><MoreHorizontal /></IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem asChild><Link href={`/characters/${character.id}`}><MessagesSquare />切换 / 管理对话</Link></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link href={`/chat/${sessionId}/memory`}><Brain />记忆与摘要</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href={`/chat/${sessionId}/history`}><History />完整历史</Link></DropdownMenuItem>
            {onExport && <DropdownMenuItem onClick={onExport}><Download />导出对话</DropdownMenuItem>}
            <DropdownMenuSeparator />
            {onNewBranchFromEnd && <DropdownMenuItem onClick={onNewBranchFromEnd}><GitBranch />从当前进度分支</DropdownMenuItem>}
            <DropdownMenuItem asChild><Link href={`/characters/${character.id}/edit`}><Settings2 />编辑角色卡</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href={`/characters/${character.id}/skin`}><Palette />角色皮肤</Link></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {title && <p className="sr-only">{title}</p>}
    </header>
  )
}

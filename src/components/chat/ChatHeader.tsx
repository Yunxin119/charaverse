'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Brain, History, MoreHorizontal, Settings2, BookOpen, GitBranch, ChevronDown } from 'lucide-react'
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
}

export function ChatHeader({ sessionId, character, title, modelLabel, presetLabel, onOpenSettings, onNewBranchFromEnd }: Props) {
  const router = useRouter()
  return (
    <header id="cv_chat_header" className="sticky top-0 z-20 px-3 pt-3 sm:px-5 sm:pt-4">
      <div className="glass mx-auto flex max-w-3xl items-center gap-2 rounded-full py-1.5 pl-1.5 pr-1.5">
        <IconButton id="cv_back_button" label="返回" variant="ghost" size="sm" onClick={() => router.push('/chat')}>
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
        <IconButton label="会话设置" variant="ghost" size="sm" onClick={onOpenSettings}>
          <Settings2 />
        </IconButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label="更多" variant="ghost" size="sm"><MoreHorizontal /></IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem asChild><Link href={`/chat/${sessionId}/memory`}><Brain />记忆与摘要</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href={`/chat/${sessionId}/history`}><History />完整历史</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href={`/chat/${sessionId}/diary`}><BookOpen />角色日记</Link></DropdownMenuItem>
            <DropdownMenuSeparator />
            {onNewBranchFromEnd && <DropdownMenuItem onClick={onNewBranchFromEnd}><GitBranch />从当前进度分支</DropdownMenuItem>}
            <DropdownMenuItem asChild><Link href={`/characters/${character.id}/edit`}><Settings2 />编辑角色卡</Link></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {title && <p className="sr-only">{title}</p>}
    </header>
  )
}

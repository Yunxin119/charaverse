'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/app/lib/supabase'
import { Markdown } from './Markdown'
import { MessageActions, type MessageActionHandlers } from './MessageActions'
import { TypingIndicator } from './TypingIndicator'

export interface Speaker {
  name: string
  avatarUrl?: string | null
}

interface Props extends MessageActionHandlers {
  message: ChatMessage
  speaker: Speaker
  isLast: boolean
  selected: boolean
  onSelect: () => void
  busy?: boolean
  editing: boolean
  onEditSave: (content: string) => void
  onEditCancel: () => void
  onSwipe?: (index: number) => void
}

export function MessageBubble({ message, speaker, isLast, selected, onSelect, busy, editing, onEditSave, onEditCancel, onSwipe, ...handlers }: Props) {
  const isUser = message.role === 'user'
  const swipes = message.swipes ?? []
  const swipeIndex = message.swipe_index ?? 0
  const showSwipes = !isUser && isLast && swipes.length > 1 && !!onSwipe

  return (
    <div
      className={cn('cv_message_row group flex w-full items-end gap-2.5', isUser ? 'cv_message_row_user flex-row-reverse' : 'cv_message_row_ai')}
      onClick={onSelect}
    >
      <Avatar className={cn('cv_message_avatar size-9 rounded-cv-sm shadow-neu-sm', isUser ? 'cv_user_avatar' : 'cv_ai_avatar')}>
        <AvatarImage src={speaker.avatarUrl ?? undefined} alt={speaker.name} />
        <AvatarFallback className="rounded-cv-sm bg-cv-secondary text-xs font-semibold text-cv-secondary-fg">
          {speaker.name.slice(0, 1)}
        </AvatarFallback>
      </Avatar>

      <div className={cn('flex max-w-[82%] min-w-0 flex-col gap-1 sm:max-w-[72%]', isUser ? 'items-end' : 'items-start')}>
        <motion.div
          layout="position"
          initial={{ opacity: 0, y: 6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className={cn(
            'cv_message_bubble relative px-4 py-2.5 text-cv-fg',
            isUser
              ? 'cv_user_message_bubble rounded-cv-lg rounded-br-md bg-cv-primary text-cv-primary-fg shadow-[0_12px_24px_-12px_var(--cv-primary)]'
              : 'cv_ai_message_bubble glass-strong rounded-cv-lg rounded-bl-md',
            selected && 'cv_message_selected ring-2 ring-cv-ring'
          )}
        >
          {editing ? (
            <EditBox initial={message.content} onSave={onEditSave} onCancel={onEditCancel} />
          ) : (
            <Markdown text={message.content} className={isUser ? '[&_a]:text-cv-cream-200 [&_code]:bg-white/15' : ''} />
          )}
        </motion.div>

        <div className={cn('flex min-h-7 items-center gap-2 px-1 text-[11px] text-cv-fg-subtle', isUser && 'flex-row-reverse')}>
          <span>{speaker.name} · {formatTime(message.created_at)}</span>
          {showSwipes && (
            <span className="inline-flex items-center gap-0.5 rounded-full glass-strong px-1 py-0.5 text-[11px] font-semibold text-cv-fg-muted">
              <button type="button" aria-label="上一个回复" disabled={busy || swipeIndex === 0} onClick={(e) => { e.stopPropagation(); onSwipe!(swipeIndex - 1) }} className="rounded-full p-0.5 hover:bg-cv-fg/10 disabled:opacity-30"><ChevronLeft className="size-3.5" /></button>
              <span className="tabular-nums">{swipeIndex + 1}/{swipes.length}</span>
              <button type="button" aria-label="下一个回复" disabled={busy || swipeIndex >= swipes.length - 1} onClick={(e) => { e.stopPropagation(); onSwipe!(swipeIndex + 1) }} className="rounded-full p-0.5 hover:bg-cv-fg/10 disabled:opacity-30"><ChevronRight className="size-3.5" /></button>
            </span>
          )}
          {!editing && (
            <MessageActions
              role={message.role}
              content={message.content}
              isLast={isLast}
              disabled={busy}
              className={cn('transition-opacity', selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100')}
              {...handlers}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function EditBox({ initial, onSave, onCancel }: { initial: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initial)
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { ref.current?.focus() }, [])
  return (
    <div className="min-w-[min(70vw,520px)] space-y-2" onClick={(e) => e.stopPropagation()}>
      <Textarea ref={ref} value={value} onChange={(e) => setValue(e.target.value)} className="min-h-24 bg-cv-bg-elevated text-cv-fg" />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>取消</Button>
        <Button size="sm" onClick={() => onSave(value)}>保存</Button>
      </div>
    </div>
  )
}

/** Streaming reply that is not persisted yet. */
export function StreamingBubble({ text, speaker }: { text: string; speaker: Speaker }) {
  return (
    <div className="cv_message_row cv_message_row_ai flex w-full items-end gap-2.5">
      <Avatar className="cv_message_avatar cv_ai_avatar size-9 rounded-cv-sm shadow-neu-sm">
        <AvatarImage src={speaker.avatarUrl ?? undefined} alt={speaker.name} />
        <AvatarFallback className="rounded-cv-sm bg-cv-secondary text-xs font-semibold text-cv-secondary-fg">{speaker.name.slice(0, 1)}</AvatarFallback>
      </Avatar>
      <div className="flex max-w-[82%] min-w-0 flex-col gap-1 sm:max-w-[72%]">
        <div className="cv_message_bubble cv_ai_message_bubble glass-strong rounded-cv-lg rounded-bl-md px-4 py-2.5 text-cv-fg">
          {text ? <Markdown text={text} /> : <TypingIndicator />}
        </div>
        <div className="px-1 text-[11px] text-cv-fg-subtle">{speaker.name} · 正在输入…</div>
      </div>
    </div>
  )
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    const now = new Date()
    const sameDay = d.toDateString() === now.toDateString()
    const hm = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    return sameDay ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`
  } catch {
    return ''
  }
}

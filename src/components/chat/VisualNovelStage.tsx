'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, RefreshCw, ScrollText, StepForward } from 'lucide-react'
import type { ChatMessage } from '@/app/lib/supabase'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { IconButton } from '@/components/glass'
import { cn } from '@/lib/utils'
import { MessageContent, type RenderSkin } from './MessageContent'
import { TypingIndicator } from './TypingIndicator'
import { Composer } from './Composer'
import type { Speaker } from './MessageBubble'

export interface VisualNovelComposerProps {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  onStop: () => void
  onInspire?: () => void
  streaming: boolean
  inspiring?: boolean
  placeholder?: string
}

interface Props {
  messages: ChatMessage[] // oldest first
  character: Speaker
  user: Speaker
  skin?: RenderSkin | null
  streamingText: string | null
  busy: boolean
  onSwipe: (m: ChatMessage, index: number) => void
  onRegenerate?: () => void
  onContinue?: () => void
  /** opens the full message log (ChatView renders it in a sheet) */
  onOpenLog: () => void
  /** tap on the stage (outside the dialogue box): ChatView uses it to reveal the floating header */
  onStageTap?: () => void
  notice?: ReactNode
  emptyState?: ReactNode
  composer: VisualNovelComposerProps
}

/**
 * Visual-novel layout: the character image is the page background (ChatView), this
 * component is the bottom dialogue box showing the latest reply with a name tag, the
 * user's last line above it, swipe / regenerate / continue controls and the composer.
 * Ids `#cv_vn_*` are stable hooks for author skins.
 */
export function VisualNovelStage({
  messages, character, user, skin, streamingText, busy, onSwipe, onRegenerate, onContinue, onOpenLog, onStageTap, notice, emptyState, composer,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const textRef = useRef<HTMLDivElement>(null)

  // latest assistant line = the "current page"; the user's line after it (or right before it) shows small above
  const last = messages[messages.length - 1]
  let mainIdx = -1
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'assistant') { mainIdx = i; break }
  const main = mainIdx >= 0 ? messages[mainIdx] : null
  const streaming = streamingText !== null
  const userLine = last?.role === 'user' ? last : mainIdx > 0 && messages[mainIdx - 1].role === 'user' ? messages[mainIdx - 1] : null
  const text = streaming ? streamingText : main?.content ?? ''
  const mainIsLast = !!main && main.id === last?.id && !streaming
  const swipes = main?.swipes ?? []
  const swipeIndex = main?.swipe_index ?? 0
  const showSwipes = mainIsLast && swipes.length > 1

  // streaming: follow the bottom of the box; new page: start at the top
  useEffect(() => {
    const el = textRef.current
    if (!el) return
    if (streaming) el.scrollTop = el.scrollHeight
  }, [text, streaming])
  useEffect(() => {
    const el = textRef.current
    if (el && !streaming) el.scrollTop = 0
  }, [main?.id, swipeIndex, streaming])

  const speakerName = streaming || main ? character.name : null

  return (
    <div id="cv_vn_stage" className="relative flex min-h-0 flex-1 flex-col justify-end" onClick={onStageTap}>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-cv-bg/90 via-cv-bg/35 to-transparent" />

      {notice}

      <section
        id="cv_vn_textbox"
        aria-label="对话框"
        onClick={(e) => e.stopPropagation()}
        className="glass-strong relative mx-auto mb-3 w-[min(100%-1rem,52rem)] rounded-cv-xl px-4 pb-2 pt-5 shadow-glass safe-pb sm:mb-5 sm:px-6"
      >
        {speakerName && (
          <div id="cv_vn_nametag" className="absolute -top-3.5 left-5 flex items-center gap-2 rounded-full bg-cv-accent py-1 pl-1 pr-3 text-xs font-semibold text-white shadow-[0_10px_20px_-8px_var(--cv-accent)]">
            <Avatar className="size-5">
              <AvatarImage src={character.avatarUrl ?? undefined} alt="" />
              <AvatarFallback className="bg-white/20 text-[10px]">{character.name.slice(0, 1)}</AvatarFallback>
            </Avatar>
            {speakerName}
          </div>
        )}

        {userLine && (
          <p id="cv_vn_user_line" className="mb-2 line-clamp-2 text-xs text-cv-fg-muted [overflow-wrap:anywhere]">
            <span className="font-semibold text-cv-fg">{user.name}</span>：{userLine.content}
          </p>
        )}

        <div
          id="cv_vn_text"
          ref={textRef}
          className={cn('min-h-[3.5rem] overflow-y-auto overscroll-contain pr-1 text-[15px] leading-7 text-cv-fg [overflow-wrap:anywhere] transition-[max-height] duration-(--cv-dur)', expanded ? 'max-h-[70dvh]' : 'max-h-[34dvh]')}
        >
          {text
            ? <MessageContent text={text} role="assistant" skin={skin} />
            : streaming
              ? <TypingIndicator />
              : main
                ? <span className="text-cv-fg-subtle">（空）</span>
                : <div className="py-2">{emptyState}</div>}
        </div>

        <div id="cv_vn_controls" className="mt-2 flex items-center justify-between gap-2 text-[11px] text-cv-fg-subtle">
          <span className="truncate">
            {streaming ? `${character.name} · 正在输入…` : main ? `${character.name} · ${formatTime(main.created_at)}` : ' '}
          </span>
          <div className="flex shrink-0 items-center gap-0.5">
            {showSwipes && (
              <span className="mr-1 inline-flex items-center gap-0.5 rounded-full bg-cv-fg/8 px-1 py-0.5 font-semibold text-cv-fg-muted">
                <button type="button" aria-label="上一个回复" disabled={busy || swipeIndex === 0} onClick={() => onSwipe(main!, swipeIndex - 1)} className="rounded-full p-0.5 hover:bg-cv-fg/10 disabled:opacity-30"><ChevronLeft className="size-3.5" /></button>
                <span className="tabular-nums">{swipeIndex + 1}/{swipes.length}</span>
                <button type="button" aria-label="下一个回复" disabled={busy || swipeIndex >= swipes.length - 1} onClick={() => onSwipe(main!, swipeIndex + 1)} className="rounded-full p-0.5 hover:bg-cv-fg/10 disabled:opacity-30"><ChevronRight className="size-3.5" /></button>
              </span>
            )}
            {mainIsLast && onRegenerate && <IconButton label="重新生成" size="sm" variant="ghost" className="size-7" disabled={busy} onClick={onRegenerate}><RefreshCw className="size-3.5" /></IconButton>}
            {mainIsLast && onContinue && <IconButton label="续写" size="sm" variant="ghost" className="size-7" disabled={busy} onClick={onContinue}><StepForward className="size-3.5" /></IconButton>}
            <IconButton label={expanded ? '收起对话框' : '展开对话框'} size="sm" variant="ghost" className="size-7" onClick={() => setExpanded((v) => !v)}>
              {expanded ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </IconButton>
            <IconButton id="cv_vn_log_button" label="对话记录" size="sm" variant="ghost" className="size-7" onClick={onOpenLog}><ScrollText className="size-3.5" /></IconButton>
          </div>
        </div>

        <Composer embedded {...composer} />
      </section>
    </div>
  )
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    const sameDay = d.toDateString() === new Date().toDateString()
    const hm = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    return sameDay ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`
  } catch {
    return ''
  }
}

'use client'

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import type { ChatMessage } from '@/app/lib/supabase'
import { MessageBubble, StreamingBubble, type Speaker } from './MessageBubble'
import type { RenderSkin } from './MessageContent'
import type { MessageActionHandlers } from './MessageActions'

interface Props {
  messages: ChatMessage[] // oldest first
  character: Speaker
  user: Speaker
  skin?: RenderSkin | null
  streamingText: string | null // null = not streaming a visible bubble
  busy: boolean
  selectedId: number | null
  editingId: number | null
  onSelect: (id: number | null) => void
  handlersFor: (m: ChatMessage, isLast: boolean) => MessageActionHandlers
  onEditSave: (m: ChatMessage, content: string) => void
  onEditCancel: () => void
  onSwipe: (m: ChatMessage, index: number) => void
  hasOlder: boolean
  loadingOlder: boolean
  onLoadOlder: () => void
  emptyState?: React.ReactNode
}

const NEAR_BOTTOM = 160

export function MessageList({
  messages, character, user, skin, streamingText, busy, selectedId, editingId, onSelect, handlersFor,
  onEditSave, onEditCancel, onSwipe, hasOlder, loadingOlder, onLoadOlder, emptyState,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true)           // should we keep following the bottom?
  const prevHeightRef = useRef(0)         // for preserving position when older pages load
  const lastCountRef = useRef(0)

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollerRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  // track whether the user is near the bottom
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const onScroll = () => {
      stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // new messages / streaming: follow the bottom if we were there
  useLayoutEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const grewAtTop = messages.length > lastCountRef.current && prevHeightRef.current > 0
    if (grewAtTop) {
      // older page prepended: keep the viewport where it was
      el.scrollTop += el.scrollHeight - prevHeightRef.current
      prevHeightRef.current = 0
    } else if (stickRef.current) {
      scrollToBottom(false)
    }
    lastCountRef.current = messages.length
  }, [messages, streamingText, scrollToBottom])

  // first paint: jump to bottom
  useEffect(() => { scrollToBottom(false) }, [scrollToBottom])

  // load older when the top sentinel shows
  useEffect(() => {
    const el = topRef.current
    const scroller = scrollerRef.current
    if (!el || !scroller || !hasOlder) return
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !loadingOlder) {
        prevHeightRef.current = scroller.scrollHeight
        onLoadOlder()
      }
    }, { root: scroller, rootMargin: '200px 0px 0px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasOlder, loadingOlder, onLoadOlder])

  const lastId = messages[messages.length - 1]?.id

  return (
    <div
      id="cv_chat_body"
      ref={scrollerRef}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      onClick={() => onSelect(null)}
    >
      <div id="cv_messages_container" className="mx-auto flex max-w-3xl flex-col gap-4 px-3 pb-4 pt-4 sm:px-5">
        <div ref={topRef} className="flex h-6 items-center justify-center text-xs text-cv-fg-subtle">
          {loadingOlder ? <Loader2 className="size-4 animate-spin" /> : hasOlder ? '上滑加载更早的消息' : messages.length > 0 ? '· 对话开始 ·' : null}
        </div>
        {messages.length === 0 && !streamingText && emptyState}
        {messages.map((m) => {
          const isLast = m.id === lastId && streamingText === null
          return (
            <MessageBubble
              key={m.id}
              message={m}
              speaker={m.role === 'user' ? user : character}
              skin={skin}
              isLast={isLast}
              selected={selectedId === m.id}
              onSelect={() => onSelect(selectedId === m.id ? null : m.id)}
              busy={busy}
              editing={editingId === m.id}
              onEditSave={(c) => onEditSave(m, c)}
              onEditCancel={onEditCancel}
              onSwipe={(i) => onSwipe(m, i)}
              {...handlersFor(m, isLast)}
            />
          )
        })}
        {streamingText !== null && <StreamingBubble text={streamingText} speaker={character} skin={skin} />}
      </div>
    </div>
  )
}

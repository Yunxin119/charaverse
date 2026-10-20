'use client'

import { useEffect, useRef } from 'react'
import { ArrowUp, Square, Lightbulb, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  onStop: () => void
  onInspire?: () => void
  streaming: boolean
  inspiring?: boolean
  disabled?: boolean
  placeholder?: string
}

export function Composer({ value, onChange, onSend, onStop, onInspire, streaming, inspiring, disabled, placeholder }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // auto-grow
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [value])

  const canSend = value.trim().length > 0 && !streaming && !disabled

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
    const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
    if (coarse ? e.metaKey || e.ctrlKey : !e.shiftKey) {
      e.preventDefault()
      if (canSend) onSend()
    }
  }

  return (
    <div id="cv_chat_input_container" className="px-3 pb-3 pt-1 sm:px-5 sm:pb-5">
      <div id="cv_chat_input_box" className="neu-in mx-auto flex max-w-3xl items-end gap-2 rounded-cv-xl py-2 pl-4 pr-2">
        {onInspire && (
          <button
            type="button"
            aria-label="灵感：帮我想一句"
            title="灵感：帮我想一句"
            disabled={streaming || disabled || inspiring}
            onClick={onInspire}
            className="mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-cv-fg-muted transition-colors hover:bg-cv-fg/10 hover:text-cv-accent disabled:opacity-40"
          >
            {inspiring ? <Loader2 className="size-4 animate-spin" /> : <Lightbulb className="size-4" />}
          </button>
        )}
        <textarea
          id="cv_chat_input_textarea"
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          disabled={disabled}
          placeholder={placeholder ?? '说点什么…'}
          className="max-h-[200px] min-h-[40px] flex-1 resize-none bg-transparent py-2 text-[15px] leading-6 text-cv-fg outline-none placeholder:text-cv-fg-subtle disabled:opacity-50"
        />
        {streaming ? (
          <button
            id="cv_send_button"
            type="button"
            aria-label="停止生成"
            onClick={onStop}
            className="mb-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-cv-danger text-white shadow-[0_10px_20px_-8px_var(--cv-danger)] transition-transform active:scale-95"
          >
            <Square className="size-4 fill-current" />
          </button>
        ) : (
          <button
            id="cv_send_button"
            type="button"
            aria-label="发送"
            disabled={!canSend}
            onClick={onSend}
            className={cn(
              'mb-0.5 flex size-10 shrink-0 items-center justify-center rounded-full text-white transition-[transform,opacity,background-color] active:scale-95',
              canSend ? 'bg-cv-accent shadow-[0_10px_20px_-8px_var(--cv-accent)]' : 'bg-cv-fg/20 opacity-60'
            )}
          >
            <ArrowUp className="size-5" />
          </button>
        )}
      </div>
    </div>
  )
}

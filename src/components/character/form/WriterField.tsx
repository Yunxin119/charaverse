'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { Chip } from '@/components/glass'
import { estimateTokens } from '@/lib/prompt/tokens'
import { cn } from '@/lib/utils'

const MACROS: { token: string; label: string }[] = [
  { token: '{{char}}', label: '角色名' },
  { token: '{{user}}', label: '用户名' },
]

interface Props {
  id: string
  label: ReactNode
  hint?: ReactNode
  error?: string
  required?: boolean
  value: string
  onChange: (v: string) => void
  placeholder?: string
  /** starting height in text lines */
  minRows?: number
  mono?: boolean
  /** show the {{char}} / {{user}} insert chips */
  macros?: boolean
  maxLength?: number
  className?: string
}

/**
 * The one long-text control of the character editor: auto-growing textarea with a
 * live 字数 / token estimate and optional macro chips that insert at the cursor.
 */
export function WriterField({ id, label, hint, error, required, value, onChange, placeholder, minRows = 4, mono, macros, maxLength, className }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.max(el.scrollHeight, minRows * 24 + 20)}px`
  }, [value, minRows])

  const insert = (token: string) => {
    const el = ref.current
    if (!el) { onChange(value + token); return }
    const start = el.selectionStart ?? value.length
    const end = el.selectionEnd ?? value.length
    onChange(value.slice(0, start) + token + value.slice(end))
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + token.length, start + token.length) })
  }

  const chars = value.length
  const tokens = estimateTokens(value)

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-end justify-between gap-3">
        <Label htmlFor={id} className="flex items-center gap-1">
          {label}
          {required && <span aria-hidden className="text-cv-accent">*</span>}
        </Label>
        {chars > 0 && <span className="text-[11px] tabular-nums text-cv-fg-subtle">{chars} 字 · ≈{tokens} tok</span>}
      </div>
      <textarea
        ref={ref}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={!!error}
        spellCheck={!mono}
        className={cn(
          'neu-in w-full resize-none rounded-cv-md px-4 py-3 text-cv-fg outline-none transition-shadow placeholder:text-cv-fg-subtle focus:ring-2 focus:ring-cv-ring',
          mono ? 'font-mono text-xs leading-5' : 'text-[15px] leading-6',
          error && 'ring-2 ring-cv-danger/60'
        )}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {error ? <p role="alert" className="text-xs text-cv-danger">{error}</p> : hint ? <p className="text-xs text-cv-fg-subtle">{hint}</p> : <span />}
        {macros && (
          <span className="flex items-center gap-1.5 text-[11px] text-cv-fg-subtle">
            插入
            {MACROS.map((m) => (
              <Chip key={m.token} tone="outline" interactive className="px-2 py-0.5 text-[11px]" onClick={() => insert(m.token)} title={m.label}>
                <code className="font-mono">{m.token}</code>
              </Chip>
            ))}
          </span>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Chip } from '@/components/glass'
import { cn } from '@/lib/utils'

interface Props {
  id?: string
  value: string[]
  onChange: (next: string[]) => void
  max?: number
  maxLength?: number
  placeholder?: string
  className?: string
}

/** Keyword chips: Enter / comma adds, × or Backspace on an empty field removes. Allows `/regex/i` keys. */
export function TagInput({ id, value, onChange, max = 50, maxLength = 100, placeholder = '输入关键词，回车添加', className }: Props) {
  const [text, setText] = useState('')

  const commit = () => {
    // a `/regex/` key may contain commas; keep it whole
    const raw = text.trim()
    const parts = raw.startsWith('/') ? [raw] : raw.split(/[,，]/).map((s) => s.trim())
    const next = [...value]
    for (const p of parts) if (p && !next.includes(p) && next.length < max && p.length <= maxLength) next.push(p)
    if (next.length !== value.length) onChange(next)
    setText('')
  }

  return (
    <div
      className={cn('neu-in flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-cv-md px-3 py-1.5', 'focus-within:ring-2 focus-within:ring-cv-ring', className)}
      onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus()}
    >
      {value.map((k) => (
        <Chip key={k} tone="flat" className="max-w-full pr-1">
          <span className="truncate font-mono text-[11px] font-medium">{k}</span>
          <button
            type="button"
            aria-label={`移除 ${k}`}
            onClick={(e) => { e.stopPropagation(); onChange(value.filter((v) => v !== k)) }}
            className="shrink-0 rounded-full p-0.5 hover:bg-[color-mix(in_oklab,var(--cv-fg)_12%,transparent)]"
          >
            <X className="size-3" />
          </button>
        </Chip>
      ))}
      <input
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || ((e.key === ',' || e.key === '，') && !text.trim().startsWith('/'))) { e.preventDefault(); commit() }
          else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1))
        }}
        onBlur={commit}
        placeholder={value.length ? '' : placeholder}
        disabled={value.length >= max}
        className="min-w-20 flex-1 bg-transparent text-base text-cv-fg outline-none placeholder:text-cv-fg-subtle md:text-sm"
      />
    </div>
  )
}

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
  placeholder?: string
}

/** Chip input: Enter / comma adds, × or Backspace on an empty field removes. */
export function KeywordInput({ id, value, onChange, max = 20, placeholder = '输入后按回车添加' }: Props) {
  const [text, setText] = useState('')

  const commit = () => {
    const parts = text.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
    if (!parts.length) { setText(''); return }
    const next = [...value]
    for (const p of parts) if (!next.includes(p) && next.length < max && p.length <= 24) next.push(p)
    onChange(next)
    setText('')
  }

  const remove = (k: string) => onChange(value.filter((v) => v !== k))

  return (
    <div
      className={cn('neu-in flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-cv-md px-3 py-2', 'focus-within:ring-2 focus-within:ring-cv-ring')}
      onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus()}
    >
      {value.map((k) => (
        <Chip key={k} tone="flat" className="pr-1">
          {k}
          <button type="button" aria-label={`移除 ${k}`} onClick={(e) => { e.stopPropagation(); remove(k) }} className="rounded-full p-0.5 hover:bg-[color-mix(in_oklab,var(--cv-fg)_12%,transparent)]">
            <X className="size-3" />
          </button>
        </Chip>
      ))}
      <input
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',' || e.key === '，') { e.preventDefault(); commit() }
          else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1))
        }}
        onBlur={commit}
        placeholder={value.length ? '' : placeholder}
        disabled={value.length >= max}
        className="min-w-24 flex-1 bg-transparent text-base text-cv-fg outline-none placeholder:text-cv-fg-subtle md:text-sm"
      />
    </div>
  )
}

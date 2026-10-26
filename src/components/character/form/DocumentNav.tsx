'use client'

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DocSection {
  id: string
  label: string
  icon: LucideIcon
  /** small status text (count, ✓) */
  meta?: string
  /** validation error inside */
  error?: boolean
}

interface Props {
  sections: DocSection[]
  active: string
  onSelect: (id: string) => void
  /** 'rail' = sticky vertical list (desktop), 'tabs' = horizontal pills (mobile) */
  variant: 'rail' | 'tabs'
}

/** Anchor navigation for the one-page editor; the active item follows the scroll position. */
export function DocumentNav({ sections, active, onSelect, variant }: Props) {
  if (variant === 'tabs') {
    return (
      <nav aria-label="文档分区" className="neu-in -mx-1 flex gap-1 overflow-x-auto rounded-full p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-current={s.id === active ? 'location' : undefined}
            onClick={() => onSelect(s.id)}
            className={cn(
              'relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors',
              s.id === active ? 'bg-cv-bg-elevated text-cv-fg shadow-neu-sm' : 'text-cv-fg-muted hover:text-cv-fg'
            )}
          >
            <s.icon className="size-4" />
            {s.label}
            {s.error && <span aria-label="有错误" className="size-1.5 rounded-full bg-cv-danger" />}
          </button>
        ))}
      </nav>
    )
  }
  return (
    <nav aria-label="文档分区" className="glass sticky top-24 rounded-cv-lg p-2">
      <ul className="space-y-0.5">
        {sections.map((s) => {
          const isActive = s.id === active
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-current={isActive ? 'location' : undefined}
                onClick={() => onSelect(s.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-cv-md px-2.5 py-2 text-left text-sm font-semibold transition-colors',
                  isActive ? 'bg-cv-bg-elevated text-cv-fg shadow-neu-sm' : 'text-cv-fg-muted hover:text-cv-fg'
                )}
              >
                <s.icon className={cn('size-4 shrink-0', isActive ? 'text-cv-accent' : 'text-cv-fg-subtle')} />
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                {s.error ? <span aria-label="有错误" className="size-1.5 rounded-full bg-cv-danger" /> : s.meta ? <span className="text-[11px] text-cv-fg-subtle">{s.meta}</span> : null}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

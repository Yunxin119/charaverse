'use client'

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SectionId = 'basic' | 'modules' | 'opening' | 'lorebook' | 'skin' | 'publish'

export interface NavSection {
  id: SectionId
  label: string
  icon: LucideIcon
  /** show a danger dot (validation error inside) */
  error?: boolean
  /** small count / status text on desktop */
  meta?: string
}

interface Props {
  sections: NavSection[]
  active: SectionId
  onSelect: (id: SectionId) => void
  /** 'rail' = sticky vertical list (desktop), 'tabs' = horizontal pills (mobile) */
  variant: 'rail' | 'tabs'
}

export function SectionNav({ sections, active, onSelect, variant }: Props) {
  if (variant === 'tabs') {
    return (
      <nav aria-label="表单分区" className="neu-in -mx-1 flex gap-1 overflow-x-auto rounded-full p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sections.map((s) => {
          const isActive = s.id === active
          return (
            <button
              key={s.id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onSelect(s.id)}
              className={cn(
                'relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors',
                isActive ? 'bg-cv-bg-elevated text-cv-fg shadow-neu-sm' : 'text-cv-fg-muted hover:text-cv-fg'
              )}
            >
              <s.icon className="size-4" />
              {s.label}
              {s.error && <span aria-label="有错误" className="size-1.5 rounded-full bg-cv-danger" />}
            </button>
          )
        })}
      </nav>
    )
  }

  return (
    <nav aria-label="表单分区" className="glass sticky top-24 rounded-cv-lg p-2">
      <ul className="space-y-0.5">
        {sections.map((s) => {
          const isActive = s.id === active
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelect(s.id)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-cv-md px-3 py-2 text-left text-sm font-semibold transition-colors',
                  isActive ? 'bg-cv-bg-elevated text-cv-fg shadow-neu-sm' : 'text-cv-fg-muted hover:bg-[color-mix(in_oklab,var(--cv-fg)_6%,transparent)] hover:text-cv-fg'
                )}
              >
                <s.icon className={cn('size-4 shrink-0', isActive && 'text-cv-accent')} />
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                {s.error ? <span aria-label="有错误" className="size-2 rounded-full bg-cv-danger" /> : s.meta ? <span className="font-mono text-[11px] text-cv-fg-subtle">{s.meta}</span> : null}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

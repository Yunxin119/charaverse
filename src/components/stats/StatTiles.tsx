import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { Skeleton } from '@/components/glass'
import { cn } from '@/lib/utils'

const compactFormat = new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 })

/** `1234` → `1234`, `12345` → `1.2万`; missing → `0`. */
export function formatCount(n: number | null | undefined): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0
  return v < 10_000 ? v.toLocaleString('zh-CN') : compactFormat.format(v)
}

export interface StatTileItem {
  label: string
  /** `undefined` renders a skeleton (still loading) */
  value: number | string | undefined
  hint?: string
  icon?: LucideIcon
}

export interface StatTilesProps extends Omit<React.ComponentProps<'div'>, 'children'> {
  items: StatTileItem[]
  /** tighter padding, smaller value — for sidebars and panels */
  compact?: boolean
}

/** Responsive grid of neu tiles: display-serif value, small label, optional hint and icon. */
export function StatTiles({ items, compact, className, ...props }: StatTilesProps) {
  return (
    <div
      data-slot="stat-tiles"
      className={cn('grid gap-3', compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4', className)}
      {...props}
    >
      {items.map((it) => {
        const Icon = it.icon
        const display = typeof it.value === 'number' ? formatCount(it.value) : it.value
        return (
          <div key={it.label} className={cn('neu flex min-w-0 flex-col gap-1 rounded-cv-md', compact ? 'p-3' : 'p-4')}>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-cv-fg-subtle">
              {Icon && <Icon className="size-3.5 shrink-0" aria-hidden />}
              <span className="truncate">{it.label}</span>
            </div>
            {display === undefined ? (
              <Skeleton className={cn('mt-1 w-2/3', compact ? 'h-6' : 'h-8')} />
            ) : (
              <div className={cn('truncate font-display font-semibold leading-tight tracking-tight tabular-nums', compact ? 'text-xl' : 'text-2xl sm:text-3xl')} title={typeof it.value === 'number' ? it.value.toLocaleString('zh-CN') : undefined}>
                {display}
              </div>
            )}
            {it.hint && <div className="truncate text-xs text-cv-fg-muted">{it.hint}</div>}
          </div>
        )
      })}
    </div>
  )
}

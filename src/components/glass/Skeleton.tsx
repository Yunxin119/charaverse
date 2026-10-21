import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Shimmering placeholder block on a pressed-in neu surface.
 * The keyframes ship with the component (React 19 hoists + dedupes the <style>).
 */
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <>
      <style href="cv-skeleton" precedence="default">{`
        @keyframes cv-skeleton-shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
        @media (prefers-reduced-motion: reduce) { [data-slot="skeleton"]::after { animation: none !important; } }
      `}</style>
      <div
        data-slot="skeleton"
        aria-hidden
        className={cn(
          'neu-in relative overflow-hidden rounded-cv-md',
          'after:absolute after:inset-0 after:-translate-x-full after:bg-gradient-to-r after:from-transparent after:via-cv-glass-strong after:to-transparent after:animate-[cv-skeleton-shimmer_1.6s_ease-in-out_infinite]',
          className
        )}
        {...props}
      />
    </>
  )
}

/** Card-shaped skeleton for grids. `variant="row"` mimics a compact glass row. */
export function CardSkeleton({ variant = 'poster', className }: { variant?: 'poster' | 'row'; className?: string }) {
  if (variant === 'row') {
    return (
      <div className={cn('glass flex items-center gap-3 rounded-cv-lg p-3', className)}>
        <Skeleton className="size-12 shrink-0 rounded-cv-sm" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </div>
    )
  }
  return (
    <div className={cn('glass flex min-h-64 flex-col justify-between rounded-cv-lg p-5', className)}>
      <div className="flex items-start justify-between">
        <Skeleton className="size-14 rounded-cv-sm" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-3/4" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-6 w-14 rounded-full" />
          <Skeleton className="h-6 w-12 rounded-full" />
        </div>
      </div>
    </div>
  )
}

import * as React from 'react'
import { cn } from '@/lib/utils'

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const colors: Record<StatusTone, string> = {
  success: 'bg-cv-success',
  warning: 'bg-cv-warning',
  danger: 'bg-cv-danger',
  info: 'bg-cv-info',
  neutral: 'bg-cv-fg-subtle',
}

export function StatusDot({ tone = 'neutral', pulse = false, className, ...props }: React.ComponentProps<'span'> & { tone?: StatusTone; pulse?: boolean }) {
  return (
    <span className={cn('relative inline-flex size-2 shrink-0', className)} {...props}>
      {pulse && <span className={cn('absolute inset-0 rounded-full opacity-60 animate-ping', colors[tone])} />}
      <span className={cn('relative inline-flex size-2 rounded-full', colors[tone])} />
    </span>
  )
}

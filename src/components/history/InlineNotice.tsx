'use client'

import { AlertCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Dismissable inline notice for routine feedback (replaces alert()). */
export function InlineNotice({ tone = 'danger', children, onClose, className }: { tone?: 'danger' | 'info'; children: React.ReactNode; onClose?: () => void; className?: string }) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'glass flex items-start gap-2 rounded-cv-md px-4 py-3 text-sm',
        tone === 'danger' ? 'text-cv-danger' : 'text-cv-fg-muted',
        className
      )}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1 break-words">{children}</div>
      {onClose && (
        <button type="button" aria-label="关闭提示" onClick={onClose} className="-mr-1 rounded-full p-1 hover:bg-cv-fg/10">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

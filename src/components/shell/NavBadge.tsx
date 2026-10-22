'use client'

import { useAuth } from '@/providers/AuthProvider'
import { useUnreadNotificationCount } from '@/queries/useNotifications'
import { cn } from '@/lib/utils'

/** Unread-notification dot for the 「我的」 nav item (rail + bottom tabs). */
export function NavBadge({ className }: { className?: string }) {
  const { user } = useAuth()
  const unread = useUnreadNotificationCount(user?.id)
  const n = unread.data ?? 0
  if (n <= 0) return null
  return (
    <span
      aria-label={`${n} 条未读通知`}
      className={cn('absolute flex h-4 min-w-4 items-center justify-center rounded-full bg-cv-accent px-1 text-[10px] font-bold leading-none text-cv-accent-fg shadow-[0_0_0_2px_var(--cv-bg-elevated)]', className)}
    >
      {n > 99 ? '99+' : n}
    </span>
  )
}

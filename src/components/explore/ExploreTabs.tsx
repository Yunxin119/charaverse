'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bookmark, Compass } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/explore', label: '探索', icon: Compass },
  { href: '/explore/favorites', label: '我的收藏', icon: Bookmark },
] as const

/** Segmented switch between the public grid and the viewer's favorites. */
export function ExploreTabs({ className }: { className?: string }) {
  const pathname = usePathname()
  return (
    <nav aria-label="探索分区" className={cn('neu-in inline-flex self-start rounded-full p-1', className)}>
      {TABS.map((t) => {
        const active = pathname === t.href
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={cn('flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors', active ? 'bg-cv-bg-elevated text-cv-fg shadow-neu-sm' : 'text-cv-fg-muted hover:text-cv-fg')}
          >
            <t.icon className="size-3.5" aria-hidden />{t.label}
          </Link>
        )
      })}
    </nav>
  )
}

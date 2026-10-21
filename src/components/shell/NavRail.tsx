'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS, isNavActive } from './nav'
import { ThemeToggle } from './ThemeToggle'

/** Desktop left rail (md+). Glass column with stacked icon+label items. */
export function NavRail() {
  const pathname = usePathname()
  return (
    <aside className="fixed inset-y-3 left-3 z-40 hidden w-[76px] flex-col items-center rounded-cv-xl glass py-4 md:flex">
      <Link href="/chat" aria-label="CharaVerse" className="mb-4 flex size-11 items-center justify-center rounded-cv-md bg-cv-primary text-cv-primary-fg shadow-[0_10px_24px_-10px_var(--cv-primary)]">
        <Sparkles className="size-5" />
      </Link>
      <nav className="flex flex-1 flex-col items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isNavActive(item, pathname)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex w-16 flex-col items-center gap-1 rounded-cv-md px-1 py-2 text-[11px] font-semibold transition-colors duration-(--cv-dur-fast)',
                active ? 'text-cv-primary' : 'text-cv-fg-subtle hover:text-cv-fg'
              )}
            >
              {active && (
                <motion.span
                  layoutId="rail-active"
                  className="absolute inset-0 -z-10 rounded-cv-md bg-cv-bg-elevated shadow-neu-sm"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                />
              )}
              <Icon className="size-5" />
              <span>{item.name}</span>
            </Link>
          )
        })}
      </nav>
      <ThemeToggle />
    </aside>
  )
}

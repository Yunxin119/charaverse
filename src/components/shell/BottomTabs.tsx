'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { NAV_ITEMS, isNavActive } from './nav'
import { NavBadge } from './NavBadge'

/** Mobile floating glass tab bar (< md). */
export function BottomTabs() {
  const pathname = usePathname()
  return (
    <nav
      aria-label="主导航"
      className="fixed inset-x-3 bottom-3 z-40 safe-pb md:hidden"
    >
      <div className="glass-strong mx-auto flex max-w-md items-center justify-around rounded-full px-2 py-1.5">
        {NAV_ITEMS.map((item) => {
          const active = isNavActive(item, pathname)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex min-w-14 flex-col items-center gap-0.5 rounded-full px-3 py-1.5 text-[10px] font-semibold transition-colors duration-(--cv-dur-fast)',
                active ? 'text-cv-primary-fg' : 'text-cv-fg-subtle active:text-cv-fg'
              )}
            >
              {active && (
                <motion.span
                  layoutId="tabs-active"
                  className="absolute inset-0 -z-10 rounded-full bg-cv-primary shadow-[0_10px_24px_-10px_var(--cv-primary)]"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                />
              )}
              <Icon className="size-5" />
              <span>{item.name}</span>
              {item.badge && <NavBadge className="top-0 right-1" />}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

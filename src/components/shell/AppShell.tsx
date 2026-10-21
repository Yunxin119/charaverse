'use client'

import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { NavRail } from './NavRail'
import { BottomTabs } from './BottomTabs'
import { isImmersiveRoute } from './nav'

const NO_SHELL = ['/login', '/auth']

/**
 * App frame: desktop glass rail on the left, floating tab bar on mobile.
 * Immersive routes (chat, public character) get the rail but no tab bar and no padding.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (NO_SHELL.some((p) => pathname === p || pathname.startsWith(p + '/'))) return <>{children}</>

  const immersive = isImmersiveRoute(pathname)
  return (
    <div className="min-h-dvh">
      <NavRail />
      <main
        id="cv-main"
        className={cn(
          'min-h-dvh md:pl-[100px]',
          immersive ? '' : 'pb-28 md:pb-8'
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={immersive ? 'immersive' : pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
            className={immersive ? 'h-dvh' : 'min-h-dvh'}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      {!immersive && <BottomTabs />}
    </div>
  )
}

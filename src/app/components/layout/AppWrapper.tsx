'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppSelector } from '../../store/hooks'
import { BottomNavbar } from './BottomNavbar'

export function AppWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAppSelector((state) => state.auth)
  const pathname = usePathname()
  
  // 不显示导航栏的页面
  const noLayoutPages = ['/login', '/register']
  const shouldShowLayout = user && !noLayoutPages.includes(pathname)
  
  // 检测是否为聊天页面（个人聊天页面）
  const isChatPage = pathname.startsWith('/chat/') && pathname !== '/chat'
  const isPublicCharacterPage = pathname.startsWith('/character/public/') && pathname !== '/character'

  if (!shouldShowLayout) {
    return <>{children}</>
  }

  // 聊天页面使用全屏布局
  if (isChatPage) {
    return (
      <div className="h-screen overflow-hidden bg-slate-50">
        {children}
      </div>
    )
  }

  // 公共角色页面使用全屏布局
  if (isPublicCharacterPage) {
    return (
      <div className="h-screen overflow-hidden bg-slate-50">
        {children}
      </div>
    )
  }

  // 普通页面布局 - 移动优先设计
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-20">
      {/* 主要内容 */}
      <motion.main
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative min-h-screen"
      >
        {/* 内容容器 */}
        <div className="relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="min-h-screen px-4 py-6 sm:px-6 sm:py-8"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.main>

      {/* 底部导航栏 */}
      <BottomNavbar />
    </div>
  )
}
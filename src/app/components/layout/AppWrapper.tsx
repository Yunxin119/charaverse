'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppSelector } from '../../store/hooks'
import { BottomNavbar } from './BottomNavbar'

export function AppWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAppSelector((state) => state.auth)
  const pathname = usePathname()
  
  // 不显示任何布局的页面（登录等）
  const noLayoutPages = ['/login', '/register']
  const shouldShowLayout = user && !noLayoutPages.includes(pathname)
  
  // 全屏页面（不显示底部导航，不添加padding）
  const fullScreenPages = [
    '/chat/',
    '/character/public/',
    '/user/',  // 作者主页
    '/settings' // "我的"页面自己管理padding
  ]
  
  const isFullScreenPage = fullScreenPages.some(page => {
    if (page === '/settings') {
      return pathname === '/settings'
    }
    return pathname.startsWith(page) && pathname !== page.replace('/', '')
  })
  
  // 聊天页面（特殊的全屏处理）
  const isChatPage = pathname.startsWith('/chat/') && pathname !== '/chat'

  if (!shouldShowLayout) {
    return <>{children}</>
  }

  // 全屏页面：聊天、公共角色、作者主页、"我的"页面
  if (isFullScreenPage || isChatPage) {
    return (
      <div className="h-screen overflow-hidden bg-slate-50">
        {children}
      </div>
    )
  }

  // 普通页面布局 - 移动优先设计（有padding和底部导航）
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-24">
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
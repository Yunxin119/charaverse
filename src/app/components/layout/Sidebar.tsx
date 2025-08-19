'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Sparkles, 
  Home, 
  Users, 
  MessageSquare, 
  Settings, 
  Plus,
  ChevronLeft,
  ChevronRight,
  Bot,
  X,
  Menu,
  Globe
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SidebarProps {
  className?: string
  isMobileOpen?: boolean
  onMobileOpenChange?: (open: boolean) => void
}

const navigation = [
  { name: '仪表盘', href: '/', icon: Home },
  { name: '我的角色', href: '/characters', icon: Users },
  { name: '探索', href: '/explore', icon: Globe },
  { name: '聊天记录', href: '/chat', icon: MessageSquare },
  { name: '设置', href: '/settings', icon: Settings },
]

export function Sidebar({ className, isMobileOpen = false, onMobileOpenChange }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const pathname = usePathname()

  // 检测屏幕尺寸
  useEffect(() => {
    const checkScreenSize = () => {
      const isMobile = window.innerWidth < 768
      if (isMobile) {
        setIsCollapsed(false) // 移动端始终显示完整内容
      }
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  // 移动端点击导航后关闭侧边栏
  const handleNavClick = () => {
    if (window.innerWidth < 768) {
      onMobileOpenChange?.(false)
    }
  }

  // 关闭移动端侧边栏
  const handleMobileClose = () => {
    onMobileOpenChange?.(false)
  }

  const sidebarVariants = {
    expanded: { 
      width: 280,
      transition: { duration: 0.3, ease: "easeInOut" }
    },
    collapsed: { 
      width: 80,
      transition: { duration: 0.3, ease: "easeInOut" }
    }
  } as const

  const contentVariants = {
    expanded: { 
      opacity: 1,
      x: 0,
      transition: { duration: 0.2, delay: 0.1 }
    },
    collapsed: { 
      opacity: 0,
      x: -10,
      transition: { duration: 0.2 }
    }
  } as const

  const overlayVariants = {
    open: { opacity: 1 },
    closed: { opacity: 0 }
  } as const

  const mobileVariants = {
    open: { x: 0 },
    closed: { x: '-100%' }
  } as const

  return (
    <>
      {/* 移动端遮罩 */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial="closed"
            animate="open"
            exit="closed"
            variants={overlayVariants}
            transition={{ duration: 0.2 }}
            className="md:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={() => onMobileOpenChange?.(false)}
          />
        )}
      </AnimatePresence>

      {/* 桌面端侧边栏 */}
      <motion.div
        initial="expanded"
        animate={isCollapsed ? "collapsed" : "expanded"}
        variants={sidebarVariants}
        className={cn(
          "hidden md:flex bg-white/95 backdrop-blur-sm border-r border-slate-200/80 flex-col h-full shadow-sm relative z-30",
          className
        )}
      >
        <SidebarContent 
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
          onNavClick={handleNavClick}
          contentVariants={contentVariants}
          pathname={pathname}
        />
      </motion.div>

      {/* 移动端侧边栏 */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial="closed"
            animate="open"
            exit="closed"
            variants={mobileVariants}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="md:hidden fixed left-0 top-0 h-full w-80 max-w-[85vw] bg-white/95 backdrop-blur-lg border-r border-slate-200/80 shadow-2xl z-50"
          >
            <SidebarContent 
              isCollapsed={false}
              isMobile={true}
              onClose={() => onMobileOpenChange?.(false)}
              onNavClick={handleNavClick}
              contentVariants={contentVariants}
              pathname={pathname}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

interface SidebarContentProps {
  isCollapsed: boolean
  isMobile?: boolean
  onToggleCollapse?: () => void
  onClose?: () => void
  onNavClick: () => void
  contentVariants: {
    expanded: { opacity: number; x: number; transition: { duration: number; delay: number } }
    collapsed: { opacity: number; x: number; transition: { duration: number } }
  }
  pathname: string
}

function SidebarContent({ 
  isCollapsed, 
  isMobile = false, 
  onToggleCollapse, 
  onClose, 
  onNavClick, 
  contentVariants, 
  pathname 
}: SidebarContentProps) {
  return (
    <>
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-slate-100/80">
        <div className="flex items-center justify-between">
          <AnimatePresence mode="wait">
            {(!isCollapsed || isMobile) && (
              <motion.div
                key="logo-expanded"
                variants={contentVariants}
                initial="collapsed"
                animate="expanded"
                exit="collapsed"
                className="flex items-center space-x-3"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 flex items-center justify-center shadow-lg">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">CharaVerse</h2>
                  <p className="text-xs text-slate-500 font-medium">AI 角色宇宙</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {isCollapsed && !isMobile && (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 flex items-center justify-center mx-auto shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
          )}

          {/* 桌面端折叠按钮 */}
          {!isMobile && onToggleCollapse && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleCollapse}
              className="h-8 w-8 p-0 hover:bg-slate-100 rounded-lg transition-colors"
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </Button>
          )}

          {/* 移动端关闭按钮 */}
          {isMobile && onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-4 sm:p-6">
        <AnimatePresence mode="wait">
          {(!isCollapsed || isMobile) ? (
            <motion.div
              key="actions-expanded"
              variants={contentVariants}
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
            >
              <Link href="/characters/new" onClick={onNavClick}>
                <Button className="w-full bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl font-medium">
                  <Plus className="w-4 h-4 mr-2" />
                  创建角色
                </Button>
              </Link>
            </motion.div>
          ) : (
            <Link href="/characters/new" onClick={onNavClick}>
              <Button size="sm" className="w-full bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white p-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200">
                <Plus className="w-4 h-4" />
              </Button>
            </Link>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 sm:px-6 pb-4">
        <AnimatePresence mode="wait">
          {(!isCollapsed || isMobile) && (
            <motion.div
              key="nav-label"
              variants={contentVariants}
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              className="mb-6"
            >
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                导航
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon

            return (
              <Link key={item.name} href={item.href} onClick={onNavClick}>
                <motion.div
                  whileHover={{ scale: 1.02, x: isCollapsed && !isMobile ? 0 : 4 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className={cn(
                    "flex items-center py-3 rounded-xl text-sm font-medium transition-all duration-200 relative overflow-hidden group",
                    isCollapsed && !isMobile ? "px-1" : "px-4",
                    isActive
                      ? "bg-gradient-to-r from-slate-100 to-slate-50 text-slate-900 shadow-sm border border-slate-200/50"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50/80"
                  )}
                >
                  {isActive && !isCollapsed && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-slate-900 to-slate-700 rounded-r-full"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  
                  <Icon className={cn(
                    "w-5 h-5 transition-colors flex-shrink-0",
                    isCollapsed && !isMobile ? "mx-auto" : "mr-3",
                    isActive ? "text-slate-900" : "text-slate-500 group-hover:text-slate-700"
                  )} />
                  
                  {/* 桌面端收起时不显示文字，移动端始终显示 */}
                  {(!isCollapsed || isMobile) && (
                    <AnimatePresence mode="wait">
                      <motion.span
                        key="nav-text"
                        variants={contentVariants}
                        initial="collapsed"
                        animate="expanded"
                        exit="collapsed"
                        className="relative z-10"
                      >
                        {item.name}
                      </motion.span>
                    </AnimatePresence>
                  )}
                  
                  {/* 悬浮效果 */}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </motion.div>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* User Section */}
      <div className="p-4 sm:p-6 border-t border-slate-100/80">
        <AnimatePresence mode="wait">
          {(!isCollapsed || isMobile) ? (
            <motion.div
              key="user-expanded"
              variants={contentVariants}
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              className="flex items-center space-x-3 p-3 rounded-xl bg-gradient-to-r from-slate-50 to-slate-25 border border-slate-200/50 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 flex items-center justify-center shadow-lg">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  用户
                </p>
                <p className="text-xs text-slate-500 truncate font-medium">
                  AI 创作者
                </p>
              </div>
            </motion.div>
          ) : (
            <div className="flex justify-center">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200">
                <Bot className="w-5 h-5 text-white" />
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
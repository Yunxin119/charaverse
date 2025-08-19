'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Home, 
  Users, 
  MessageSquare, 
  Settings,
  Plus,
  BookTemplate,
  Globe
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: '首页', href: '/', icon: Home },
  { name: '角色', href: '/characters', icon: Users },
  { name: '探索', href: '/explore', icon: Globe },
  { name: '聊天', href: '/chat', icon: MessageSquare },
  { name: '模板', href: '/templates', icon: BookTemplate },
  { name: '我的', href: '/settings', icon: Users },
]

export function BottomNavbar() {
  const pathname = usePathname()

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200/60 px-4 py-3 z-50 safe-area-pb"
      style={{
        boxShadow: '0 -1px 20px rgba(0, 0, 0, 0.08)',
      }}
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href || (item.href === '/chat' && pathname.startsWith('/chat'))
          const Icon = item.icon

          return (
            <Link key={item.name} href={item.href}>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "flex flex-col items-center py-2 px-3 rounded-lg transition-all duration-200 relative min-w-0",
                  isActive
                    ? "text-blue-600"
                    : "text-slate-500"
                )}
              >
                <div className="relative">
                  <Icon className={cn(
                    "w-6 h-6 mb-1 transition-all duration-200",
                    isActive ? "text-blue-600 scale-110" : "text-slate-500"
                  )} />
                  
                  {/* iOS风格的活跃指示器 */}
                  {isActive && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-blue-600 rounded-full"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </div>
                
                <span className={cn(
                  "text-xs font-medium transition-all duration-200 truncate",
                  isActive ? "text-blue-600" : "text-slate-500"
                )}>
                  {item.name}
                </span>
              </motion.div>
            </Link>
          )
        })}
        
        {/* 创建按钮 - 更小更精致 */}
        {/* <Link href="/characters/new">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-md"
          >
            <Plus className="w-5 h-5 text-white" />
          </motion.div>
        </Link> */}
      </div>
    </motion.div>
  )
}

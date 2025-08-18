'use client'

import { motion } from 'framer-motion'
import { Bell, Search, User, LogOut, Settings, ChevronDown, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { signOut } from '../../store/authSlice'

interface NavbarProps {
  title?: string
  showSearch?: boolean
  onMobileMenuClick?: () => void
}

export function Navbar({ title = "仪表盘", showSearch = true, onMobileMenuClick }: NavbarProps) {
  const dispatch = useAppDispatch()
  const { user } = useAppSelector((state) => state.auth)

  const handleSignOut = () => {
    dispatch(signOut())
  }

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="bg-white/95 backdrop-blur-lg border-b border-slate-200/80 px-4 sm:px-6 py-4 sticky top-0 z-30 shadow-sm"
    >
      <div className="flex items-center justify-between">
        {/* Left Section - Mobile Menu Button */}
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={onMobileMenuClick}
            className="md:hidden h-10 w-10 p-0 mr-2 hover:bg-slate-100/80 rounded-xl transition-all duration-200"
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </Button>
          {/* Desktop spacer */}
          <div className="hidden md:block flex-1"></div>
        </div>

        {/* Center Section - Search */}
        {showSearch && (
          <div className="flex justify-center">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="relative group"
            >
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-slate-600 transition-colors" />
              <Input
                placeholder="搜索角色、对话..."
                className="pl-10 pr-4 bg-slate-50/80 border-slate-200/80 focus:bg-white focus:border-slate-300 transition-all duration-200 rounded-xl shadow-sm focus:shadow-md text-sm w-80"
              />
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </motion.div>
          </div>
        )}

        {/* Right Section */}
        <div className="flex items-center space-x-2 sm:space-x-3 flex-1 justify-end">
          {/* Notifications */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button 
              variant="ghost" 
              size="sm" 
              className="relative h-10 w-10 rounded-xl hover:bg-slate-100/80 transition-all duration-200 group"
            >
              <Bell className="w-5 h-5 text-slate-600 group-hover:text-slate-900 transition-colors" />
              <motion.span 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-lg"
              >
                <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
              </motion.span>
              {/* 悬浮光效 */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-slate-100/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </Button>
          </motion.div>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button 
                  variant="ghost" 
                  className="h-10 px-3 rounded-xl hover:bg-slate-100/80 transition-all duration-200 group flex items-center space-x-2"
                >
                  <Avatar className="h-8 w-8 ring-2 ring-slate-200/50 group-hover:ring-slate-300 transition-all duration-200">
                    <AvatarImage src="/placeholder-avatar.jpg" alt="用户头像" />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 text-white text-sm">
                      <User className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                  
                  {/* 桌面端显示用户名和箭头 */}
                  <div className="hidden sm:flex items-center space-x-1">
                    <div className="text-left">
                      <p className="text-sm font-medium text-slate-900 leading-none">用户</p>
                      <p className="text-xs text-slate-500 leading-none">AI 创作者</p>
                    </div>
                    <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600 transition-colors" />
                  </div>
                  
                  {/* 悬浮光效 */}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-slate-100/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </Button>
              </motion.div>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              className="w-64 sm:w-72 bg-white/95 backdrop-blur-lg border-slate-200/80 shadow-xl rounded-xl" 
              align="end" 
              forceMount
              sideOffset={8}
            >
              <DropdownMenuLabel className="font-normal p-4">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-12 w-12 ring-2 ring-slate-200/50">
                    <AvatarImage src="/placeholder-avatar.jpg" alt="用户头像" />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 text-white">
                      <User className="w-5 h-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-slate-900 leading-none mb-1">用户</p>
                    <p className="text-sm text-slate-500 leading-none truncate">
                      {user?.email || 'ai.creator@example.com'}
                    </p>
                    <p className="text-xs text-slate-400 leading-none mt-1">AI 创作者</p>
                  </div>
                </div>
              </DropdownMenuLabel>
              
              <DropdownMenuSeparator className="bg-slate-200/50" />
              
              <div className="p-2">
                <DropdownMenuItem className="rounded-lg p-3 hover:bg-slate-50/80 transition-colors group cursor-pointer">
                  <User className="mr-3 h-4 w-4 text-slate-500 group-hover:text-slate-700 transition-colors" />
                  <div>
                    <span className="font-medium">个人资料</span>
                    <p className="text-xs text-slate-500">管理你的账户信息</p>
                  </div>
                </DropdownMenuItem>
                
                <DropdownMenuItem className="rounded-lg p-3 hover:bg-slate-50/80 transition-colors group cursor-pointer">
                  <Settings className="mr-3 h-4 w-4 text-slate-500 group-hover:text-slate-700 transition-colors" />
                  <div>
                    <span className="font-medium">设置</span>
                    <p className="text-xs text-slate-500">偏好设置和配置</p>
                  </div>
                </DropdownMenuItem>
              </div>
              
              <DropdownMenuSeparator className="bg-slate-200/50" />
              
              <div className="p-2">
                <DropdownMenuItem 
                  onClick={handleSignOut}
                  className="rounded-lg p-3 hover:bg-red-50/80 text-red-600 hover:text-red-700 transition-colors group cursor-pointer"
                >
                  <LogOut className="mr-3 h-4 w-4 group-hover:scale-110 transition-transform" />
                  <div>
                    <span className="font-medium">退出登录</span>
                    <p className="text-xs text-red-500/70">安全退出当前账户</p>
                  </div>
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.header>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { 
  MessageCircle,
  Search,
  MoreHorizontal,
  Clock,
  ChevronRight,
  Plus,
  Edit3,
  Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useAppSelector } from '../store/hooks'
import { supabase } from '../lib/supabase'

interface ChatSessionWithCharacter {
  id: string
  user_id: string
  character_id: number
  title?: string
  created_at: string
  character: {
    id: number
    name: string
    avatar_url?: string
  }
  message_count: number
  last_message_at?: string
}

export default function ChatPage() {
  const { user } = useAppSelector((state) => state.auth)
  const router = useRouter()
  
  const [sessions, setSessions] = useState<ChatSessionWithCharacter[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchVisible, setIsSearchVisible] = useState(false)

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }
    
    fetchChatSessions()
  }, [user, router])

  const fetchChatSessions = async () => {
    if (!user) return
    
    setIsLoading(true)
    try {
      // 获取聊天会话和相关角色信息
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('chat_sessions')
        .select(`
          *,
          characters!inner (
            id,
            name,
            avatar_url
          )
        `)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })

      if (sessionsError) throw sessionsError

      // 为每个会话获取消息数量和最后消息时间
      const sessionsWithStats = await Promise.all(
        (sessionsData || []).map(async (session) => {
          const { data: messagesData, error: messagesError } = await supabase
            .from('chat_messages')
            .select('created_at')
            .eq('session_id', session.id)
            .order('created_at', { ascending: false })

          if (messagesError) {
            console.error('获取消息统计失败:', messagesError)
            return {
              ...session,
              character: session.characters,
              message_count: 0,
              last_message_at: session.created_at
            }
          }

          return {
            ...session,
            character: session.characters,
            message_count: messagesData.length,
            last_message_at: messagesData.length > 0 ? messagesData[0].created_at : session.created_at
          }
        })
      )

      setSessions(sessionsWithStats)
    } catch (error) {
      console.error('获取聊天记录失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 删除聊天会话
  const deleteSession = async (sessionId: string) => {
    if (!confirm('确定要删除这个对话吗？此操作无法撤销。')) return
    
    try {
      // 先删除消息
      await supabase
        .from('chat_messages')
        .delete()
        .eq('session_id', sessionId)

      // 再删除会话
      const { error } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId)

      if (error) throw error
      
      // 更新本地状态
      setSessions(prev => prev.filter(session => session.id !== sessionId))
    } catch (error) {
      console.error('删除聊天记录失败:', error)
    }
  }

  // 过滤和搜索会话
  const filteredSessions = sessions.filter(session => {
    if (!searchQuery) return true
    
    const matchesSearch = 
      session.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.character.name.toLowerCase().includes(searchQuery.toLowerCase())
    
    return matchesSearch
  })

  // 格式化时间 - 微信风格
  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    const diffInHours = Math.floor(diffInMinutes / 60)
    const diffInDays = Math.floor(diffInHours / 24)
    
    if (diffInMinutes < 1) return '刚刚'
    if (diffInMinutes < 60) return `${diffInMinutes}分钟前`
    if (diffInHours < 24) {
      if (diffInHours < 1) return '刚刚'
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }
    if (diffInDays === 1) return '昨天'
    if (diffInDays < 7) return `${diffInDays}天前`
    
    return date.toLocaleDateString('zh-CN', { 
      month: 'short', 
      day: 'numeric' 
    })
  }

  // 获取最后一条消息预览
  const getLastMessagePreview = (session: ChatSessionWithCharacter) => {
    if (session.message_count === 0) {
      return '开始新对话'
    }
    return `${session.message_count}条消息`
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        duration: 0.3
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4 }
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 mx-auto animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
          <p className="text-slate-600">加载聊天记录中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 -mx-4 -my-6 sm:-mx-6 sm:-my-8">
      {/* 顶部标题栏 - 微信风格 */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="sticky top-0 bg-white/95 backdrop-blur-lg border-b border-slate-200/60 px-4 py-3 z-10"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-semibold text-slate-900">聊天</h1>
            {sessions.length > 0 && (
              <span className="text-sm text-slate-500">({sessions.length})</span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSearchVisible(!isSearchVisible)}
              className="h-9 w-9 p-0 rounded-full"
            >
              <Search className="w-5 h-5" />
            </Button>
            <Link href="/characters">
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 rounded-full"
              >
                <Plus className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
        
        {/* 搜索栏 */}
        <AnimatePresence>
          {isSearchVisible && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-3"
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="搜索对话..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-slate-100 border-none rounded-full h-9"
                  autoFocus
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 聊天列表 */}
      <div className="pb-4">
        {filteredSessions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="flex flex-col items-center justify-center py-20 px-4"
          >
            <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mb-4">
              <MessageCircle className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              {searchQuery ? '没有找到匹配的对话' : '还没有聊天记录'}
            </h3>
            <p className="text-slate-500 text-center mb-6">
              {searchQuery 
                ? '试试其他关键词'
                : '选择一个角色开始你的第一次对话'
              }
            </p>
            {!searchQuery && (
              <Link href="/characters">
                <Button className="bg-blue-500 hover:bg-blue-600 rounded-full px-6">
                  <Plus className="w-4 h-4 mr-2" />
                  开始新对话
                </Button>
              </Link>
            )}
          </motion.div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="divide-y divide-slate-100"
          >
            {filteredSessions.map((session, index) => (
              <motion.div
                key={session.id}
                variants={itemVariants}
                custom={index}
              >
                <motion.div
                  whileHover={{ backgroundColor: 'rgb(248 250 252)' }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.1 }}
                  className="group"
                >
                  <Link href={`/chat/${session.id}`}>
                    <div className="flex items-center px-4 py-4 active:bg-slate-100 transition-colors">
                      {/* 头像 */}
                      <Avatar className="w-12 h-12 mr-3 flex-shrink-0 ring-2 ring-transparent group-hover:ring-slate-200 transition-all">
                        <AvatarImage src={session.character.avatar_url} />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-medium">
                          {session.character.name[0]}
                        </AvatarFallback>
                      </Avatar>
                      
                      {/* 内容区域 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-medium text-slate-900 truncate">
                            {session.title || session.character.name}
                          </h3>
                          <span className="text-xs text-slate-500 ml-2 flex-shrink-0">
                            {formatTime(session.last_message_at || session.created_at)}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-slate-500 truncate">
                            {getLastMessagePreview(session)}
                          </p>
                          
                          {/* 未读消息指示器 */}
                          {session.message_count > 0 && (
                            <motion.div 
                              className="ml-2 flex items-center"
                              whileHover={{ x: 2 }}
                              transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            >
                              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                            </motion.div>
                          )}
                        </div>
                      </div>
                      
                      {/* 更多操作 */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 ml-2 h-8 w-8 p-0 rounded-full hover:bg-slate-200 transition-all"
                            onClick={(e) => e.preventDefault()}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl shadow-lg border-slate-200/60">
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.preventDefault()
                              deleteSession(session.id)
                            }}
                            className="text-red-600 focus:text-red-700 focus:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            删除对话
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </Link>
                </motion.div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  )
} 
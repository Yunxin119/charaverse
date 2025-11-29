'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar, User, Bot, Edit3, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '../../../lib/supabase'
import { useAppSelector } from '../../../store/hooks'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface Message {
  id: number
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

const MESSAGES_PER_PAGE = 50

export default function ChatHistoryPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.sessionId as string

  const { currentCharacter } = useAppSelector((state) => state.chat)
  const { user } = useAppSelector((state) => state.auth)

  const [messages, setMessages] = useState<Message[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalMessages, setTotalMessages] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [sessionTitle, setSessionTitle] = useState('')
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null)
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editContent, setEditContent] = useState('')

  const totalPages = Math.ceil(totalMessages / MESSAGES_PER_PAGE)

  // 加载会话标题
  useEffect(() => {
    const loadSessionTitle = async () => {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('title')
        .eq('id', sessionId)
        .single()

      if (data) {
        setSessionTitle(data.title || '聊天记录')
      }
    }
    loadSessionTitle()
  }, [sessionId])

  // 加载消息总数
  useEffect(() => {
    const loadTotalCount = async () => {
      const { count, error } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId)

      if (count !== null) {
        setTotalMessages(count)
      }
    }
    loadTotalCount()
  }, [sessionId])

  // 加载当前页的消息
  useEffect(() => {
    const loadMessages = async () => {
      setIsLoading(true)

      const start = (currentPage - 1) * MESSAGES_PER_PAGE
      const end = start + MESSAGES_PER_PAGE - 1

      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, role, content, created_at')
        .eq('session_id', sessionId)
        .order('id', { ascending: true })
        .range(start, end)

      if (data) {
        setMessages(data)
      }

      setIsLoading(false)
    }

    loadMessages()
  }, [sessionId, currentPage])

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const formatMessageTime = (timestamp: string) => {
    try {
      return format(new Date(timestamp), 'MM月dd日 HH:mm', { locale: zhCN })
    } catch {
      return ''
    }
  }

  // 处理消息点击
  const handleMessageClick = (message: Message) => {
    setSelectedMessageId(message.id === selectedMessageId ? null : message.id)
  }

  // 开始编辑消息
  const handleEditMessage = (message: Message) => {
    setEditingMessage(message)
    setEditContent(message.content)
    setShowEditDialog(true)
    setSelectedMessageId(null)
  }

  // 保存编辑的消息
  const handleSaveEdit = async () => {
    if (!editingMessage || !editContent.trim()) {
      alert('消息内容不能为空')
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('用户未登录')

      const { error } = await supabase
        .from('chat_messages')
        .update({ content: editContent })
        .eq('id', editingMessage.id)
        .eq('session_id', sessionId)

      if (error) throw error

      // 更新本地消息列表
      setMessages(prev => prev.map(msg =>
        msg.id === editingMessage.id
          ? { ...msg, content: editContent }
          : msg
      ))

      setShowEditDialog(false)
      setEditingMessage(null)
      setEditContent('')
    } catch (error) {
      console.error('保存消息失败:', error)
      alert('保存失败，请重试')
    }
  }

  const pageVariants = {
    initial: { opacity: 0, x: 20 },
    in: { opacity: 1, x: 0 },
    out: { opacity: 0, x: -20 }
  }

  return (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={{ duration: 0.3 }}
      className="absolute top-0 left-0 w-full h-full bg-slate-50 dark:bg-slate-900 z-10 flex flex-col"
    >
      {/* Header */}
      <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="p-2 h-8 w-8"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h2 className="text-lg font-semibold dark:text-white">聊天记录</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {sessionTitle}
              </p>
            </div>
          </div>

          {/* Page Info */}
          <div className="text-sm text-slate-600 dark:text-slate-400">
            共 {totalMessages} 条消息
          </div>
        </div>
      </div>

      {/* Messages Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-slate-500 dark:text-slate-400">加载中...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-slate-500 dark:text-slate-400">
              <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>暂无聊天记录</p>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <AnimatePresence mode="wait">
              {messages.map((message, index) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} group`}
                >
                  <div className={`flex max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'} gap-2 relative`}>
                    {/* Avatar */}
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      {message.role === 'user' ? (
                        <>
                          <AvatarImage src={user?.user_metadata?.avatar_url} />
                          <AvatarFallback>
                            <User className="w-4 h-4" />
                          </AvatarFallback>
                        </>
                      ) : (
                        <>
                          <AvatarImage src={currentCharacter?.avatar_url} />
                          <AvatarFallback>
                            <Bot className="w-4 h-4" />
                          </AvatarFallback>
                        </>
                      )}
                    </Avatar>

                    {/* Message Bubble */}
                    <div className="flex flex-col">
                      <div
                        onClick={() => handleMessageClick(message)}
                        className={`rounded-2xl px-4 py-2 cursor-pointer transition-all ${
                          message.role === 'user'
                            ? 'bg-blue-500 text-white hover:bg-blue-600'
                            : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        } ${selectedMessageId === message.id ? 'ring-2 ring-blue-400' : ''}`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                      </div>

                      {/* 编辑按钮 */}
                      <AnimatePresence>
                        {selectedMessageId === message.id && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className={`flex gap-2 mt-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditMessage(message)}
                              className="h-7 text-xs"
                            >
                              <Edit3 className="w-3 h-3 mr-1" />
                              编辑
                            </Button>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <span className={`text-xs text-slate-400 dark:text-slate-500 mt-1 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                        {formatMessageTime(message.created_at)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-t border-slate-200 dark:border-slate-700 px-4 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              className="flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              上一页
            </Button>

            <div className="text-sm text-slate-600 dark:text-slate-400">
              第 {currentPage} / {totalPages} 页
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1"
            >
              下一页
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* 编辑消息对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Edit3 className="w-5 h-5" />
              <span>编辑消息</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block text-slate-700 dark:text-slate-300">
                {editingMessage?.role === 'user' ? '用户消息' : '角色消息'}
              </label>
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="输入消息内容..."
                rows={6}
                className="resize-none"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowEditDialog(false)
                  setEditingMessage(null)
                  setEditContent('')
                }}
              >
                <X className="w-4 h-4 mr-1" />
                取消
              </Button>
              <Button
                onClick={handleSaveEdit}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Save className="w-4 h-4 mr-1" />
                保存
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

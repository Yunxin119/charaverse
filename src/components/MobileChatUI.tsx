'use client'

import { useEffect, useState, RefObject, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Bot, User, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage, Character } from '@/app/lib/supabase'
import { MessageSplitter, createMessageSplitter, type MessageSegment, needsSplitting, cleanPauseMarkers } from '@/lib/messageSplitter'
import { HeaderTypingIndicator, useTypingIndicator } from '@/components/TypingEffect'
import { 
  generateTypingPattern, 
  defaultHumanBehaviorConfig, 
  personalizeConfig, 
  characterPersonalities, 
  simulateNetworkDelay,
  type CharacterPersonality,
  type HumanBehaviorConfig 
} from '@/lib/humanBehavior'
import StickerInput from './SimpleSticker/StickerInput'

// 消息片段状态
interface MessageSegmentState {
  segment: MessageSegment
  isVisible: boolean
  isTyping: boolean
  isComplete: boolean
}

// 分割消息状态
interface SplitMessageState {
  messageId: number
  segments: MessageSegmentState[]
  currentIndex: number
  isProcessing: boolean
}

interface MobileChatUIProps {
  messages: ChatMessage[]
  currentCharacter: Character | null
  isGenerating: boolean
  isLoadingMoreMessages: boolean
  hasMoreMessages: boolean
  onSendMessage: () => void
  userInput: string
  setUserInput: (value: string) => void
  inputRef: RefObject<HTMLTextAreaElement | null>
  messagesEndRef: RefObject<HTMLDivElement | null>
  messagesContainerRef: RefObject<HTMLDivElement | null>
}

export function MobileChatUI({
  messages,
  currentCharacter,
  isGenerating,
  isLoadingMoreMessages,
  hasMoreMessages,
  onSendMessage,
  userInput,
  setUserInput,
  inputRef,
  messagesEndRef,
  messagesContainerRef
}: MobileChatUIProps) {
  
  // 消息分割器实例
  const messageSplitter = useRef<MessageSplitter | null>(null)
  
  // 分割消息状态 - 使用localStorage持久化
  const [splitMessages, setSplitMessages] = useState<Map<number, SplitMessageState>>(new Map())
  
  // 已处理的消息ID集合 - 使用localStorage持久化
  const [processedMessageIds, setProcessedMessageIds] = useState<Set<number>>(new Set())

  // 组件挂载后从localStorage加载数据，避免hydration不匹配
  useEffect(() => {
    // 加载分割消息状态
    const savedSplitMessages = localStorage.getItem('mobile-chat-split-messages')
    if (savedSplitMessages) {
      try {
        const parsed = JSON.parse(savedSplitMessages)
        const map = new Map()
        Object.entries(parsed).forEach(([key, value]) => {
          map.set(parseInt(key), value)
        })
        setSplitMessages(map)
      } catch (e) {
        console.warn('Failed to parse split messages from localStorage:', e)
      }
    }

    // 加载已处理的消息ID
    const savedProcessedMessages = localStorage.getItem('mobile-chat-processed-messages')
    if (savedProcessedMessages) {
      try {
        setProcessedMessageIds(new Set(JSON.parse(savedProcessedMessages)))
      } catch (e) {
        console.warn('Failed to parse processed messages from localStorage:', e)
      }
    }
  }, [])
  
  // 打字指示器状态
  const { isTyping, startTyping, stopTyping, typeWithDuration } = useTypingIndicator()
  
  // 保存分割消息状态的helper函数
  const updateSplitMessages = useCallback((updateFn: (prev: Map<number, SplitMessageState>) => Map<number, SplitMessageState>) => {
    setSplitMessages(prev => {
      const newMap = updateFn(prev)
      // 保存到localStorage
      const mapObj = Object.fromEntries(newMap.entries())
      localStorage.setItem('mobile-chat-split-messages', JSON.stringify(mapObj))
      return newMap
    })
  }, [])

  // 检测消息是否为表情包消息
  const isEmojiOrSticker = useCallback((content: string): { isEmoji: boolean; isSticker: boolean; data?: any } => {
    try {
      // 检查是否为纯emoji（长度小于10且包含emoji字符）
      const emojiRegex = /^[\p{Emoji}\p{Emoji_Modifier}\p{Emoji_Component}\p{Emoji_Modifier_Base}\p{Emoji_Presentation}]+$/u
      if (content.length <= 10 && emojiRegex.test(content.trim())) {
        return { isEmoji: true, isSticker: false, data: { content: content.trim() } }
      }
      
      // 检查是否为简单表情包格式: [sticker:name:url]
      const stickerMatch = content.match(/^\[sticker:([^:]+):([^\]]+)\]$/)
      if (stickerMatch) {
        return {
          isEmoji: false,
          isSticker: true,
          data: {
            name: stickerMatch[1],
            url: stickerMatch[2]
          }
        }
      }
      
      return { isEmoji: false, isSticker: false }
    } catch {
      return { isEmoji: false, isSticker: false }
    }
  }, [])
  
  // 人性化行为配置
  const [behaviorConfig, setBehaviorConfig] = useState<HumanBehaviorConfig>(defaultHumanBehaviorConfig)
  
  // 初始化角色个性化配置
  useEffect(() => {
    if (currentCharacter) {
      // 根据角色名称选择个性，或使用随机个性
      const personality = characterPersonalities.random // 可以后续根据角色属性来选择
      const personalizedConfig = personalizeConfig(defaultHumanBehaviorConfig, personality)
      setBehaviorConfig(personalizedConfig)
    }
  }, [currentCharacter])
  
  // 清理过期的处理记录
  useEffect(() => {
    const currentMessageIds = new Set(messages.map(msg => msg.id))
    
    // 清理processed messages
    setProcessedMessageIds(prev => {
      const validIds = [...prev].filter(id => currentMessageIds.has(id))
      const newSet = new Set(validIds)
      if (newSet.size !== prev.size) {
        localStorage.setItem('mobile-chat-processed-messages', JSON.stringify([...newSet]))
      }
      return newSet
    })
    
    // 清理split messages
    updateSplitMessages(prev => {
      const newMap = new Map()
      for (const [messageId, splitState] of prev.entries()) {
        if (currentMessageIds.has(messageId)) {
          newMap.set(messageId, splitState)
        }
      }
      return newMap.size !== prev.size ? newMap : prev
    })
  }, [messages, updateSplitMessages])
  
  // 初始化消息分割器
  useEffect(() => {
    messageSplitter.current = createMessageSplitter({
      typingSpeed: 12, // 手机模式稍微快一点
      baseDelay: 600,
      randomDelayRange: 1500,
      maxSegmentLength: 60 // 手机模式片段更短
    })
  }, [])
  
  // 处理AI消息分割
  const processAIMessage = useCallback(async (message: ChatMessage) => {
    if (!messageSplitter.current || !needsSplitting(message.content)) {
      return
    }
    
    console.log('🔪 处理AI消息分割:', message.id, message.content.substring(0, 50) + '...')
    
    // 生成人性化打字模式
    const typingPattern = generateTypingPattern(message.content, behaviorConfig)
    console.log('🎭 生成打字模式:', typingPattern)
    
    // 开始显示打字指示器
    startTyping(`${currentCharacter?.name || '对方'}正在输入`)
    
    // 模拟思考时间
    await new Promise(resolve => setTimeout(resolve, typingPattern.sendDelay))
    
    // 分割消息
    const segments = messageSplitter.current.splitMessage(message.content)
    
    if (segments.length <= 1) {
      stopTyping()
      return
    }
    
    // 准备分段状态
    const segmentStates: MessageSegmentState[] = segments.map(segment => ({
      segment,
      isVisible: false,
      isTyping: false,
      isComplete: false
    }))
    
    const splitState: SplitMessageState = {
      messageId: message.id,
      segments: segmentStates,
      currentIndex: 0,
      isProcessing: true
    }
    
    // 更新状态并保存到localStorage
    updateSplitMessages(prev => new Map(prev.set(message.id, splitState)))
    
    // 依次显示每个片段
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]
      
      // 延迟
      if (segment.delay > 0) {
        await new Promise(resolve => setTimeout(resolve, segment.delay))
      }
      
      // 显示片段（可能带打字效果）
      updateSplitMessages(prev => {
        const newMap = new Map(prev)
        const currentState = newMap.get(message.id)
        if (currentState) {
          const updatedState = {
            ...currentState,
            currentIndex: i,
            segments: currentState.segments.map((seg, idx) => 
              idx === i 
                ? { ...seg, isVisible: true, isTyping: segment.isTyping }
                : seg
            )
          }
          newMap.set(message.id, updatedState)
        }
        return newMap
      })
      
      // 如果有打字效果，等待打字完成
      if (segment.isTyping && segment.typingDuration) {
        await new Promise(resolve => setTimeout(resolve, segment.typingDuration))
      }
      
      // 完成当前片段
      updateSplitMessages(prev => {
        const newMap = new Map(prev)
        const currentState = newMap.get(message.id)
        if (currentState) {
          const updatedState = {
            ...currentState,
            segments: currentState.segments.map((seg, idx) => 
              idx === i 
                ? { ...seg, isTyping: false, isComplete: true }
                : seg
            )
          }
          newMap.set(message.id, updatedState)
        }
        return newMap
      })
    }
    
    // 处理完成
    updateSplitMessages(prev => {
      const newMap = new Map(prev)
      const currentState = newMap.get(message.id)
      if (currentState) {
        newMap.set(message.id, { ...currentState, isProcessing: false })
      }
      return newMap
    })
    
    // 停止打字指示器
    stopTyping()
    
    console.log('✅ AI消息分割处理完成:', message.id)
    
  }, [behaviorConfig, currentCharacter?.name, startTyping, stopTyping, updateSplitMessages])
  
  // 监听新的AI消息
  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    
    console.log('📱 手机聊天 - 检查消息:', {
      hasMessage: !!lastMessage,
      role: lastMessage?.role,
      isGenerating,
      messageId: lastMessage?.id,
      processed: lastMessage ? processedMessageIds.has(lastMessage.id) : false,
      content: lastMessage?.content?.substring(0, 100) + '...',
      needsSplit: lastMessage ? needsSplitting(lastMessage.content) : false
    })
    
    if (lastMessage && 
        lastMessage.role === 'assistant' && 
        !isGenerating && 
        !processedMessageIds.has(lastMessage.id) &&
        needsSplitting(lastMessage.content)) {
      
      console.log('🆕 检测到需要分割的新AI消息:', lastMessage.id, lastMessage.content)
      
      // 标记为已处理
      setProcessedMessageIds(prev => {
        const newSet = new Set([...prev, lastMessage.id])
        // 保存到localStorage
        localStorage.setItem('mobile-chat-processed-messages', JSON.stringify([...newSet]))
        return newSet
      })
      
      // 立即开始处理分割
      processAIMessage(lastMessage)
    }
  }, [messages, isGenerating, processAIMessage, processedMessageIds])
  
  // 格式化时间显示
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffMins < 1) return '刚刚'
    if (diffMins < 60) return `${diffMins}分钟前`
    if (diffHours < 24) return `${diffHours}小时前`
    if (diffDays < 7) return `${diffDays}天前`
    
    // 超过一周显示具体日期
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // 判断是否需要显示时间戳
  const shouldShowTimestamp = (currentMsg: ChatMessage, prevMsg?: ChatMessage) => {
    if (!prevMsg) return true
    
    const currentTime = new Date(currentMsg.created_at)
    const prevTime = new Date(prevMsg.created_at)
    const diffMins = (currentTime.getTime() - prevTime.getTime()) / (1000 * 60)
    
    // 如果消息间隔超过10分钟，则显示时间戳
    return diffMins > 10
  }

  // 判断是否需要显示头像
  const shouldShowAvatar = (currentMsg: ChatMessage, nextMsg?: ChatMessage) => {
    if (currentMsg.role === 'user') return true // 用户消息总是显示头像
    return !nextMsg || nextMsg.role !== currentMsg.role
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 relative overflow-hidden">
      {/* 在线状态栏 */}
      <div className="px-3 sm:px-4 py-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 flex-shrink-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-slate-600 dark:text-slate-400">在线</span>
            
            {/* 打字指示器 */}
            <HeaderTypingIndicator 
              isVisible={isTyping || isGenerating}
              characterName={currentCharacter?.name}
            />
          </div>
          <div className="flex items-center space-x-1 text-xs text-slate-500 dark:text-slate-400">
            <span>手机模式</span>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <MoreHorizontal className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* 消息列表 */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-2 sm:px-3 py-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600"
        style={{
          background: `
            radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.05) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.05) 0%, transparent 50%),
            radial-gradient(circle at 40% 80%, rgba(120, 219, 226, 0.05) 0%, transparent 50%)
          `
        }}
      >
        {/* 加载更多历史消息的指示器 */}
        {isLoadingMoreMessages && (
          <div className="flex justify-center py-3">
            <div className="flex items-center space-x-2 text-slate-400 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-full px-3 py-1">
              <div className="w-3 h-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
              <span className="text-xs">加载中...</span>
            </div>
          </div>
        )}

        {/* 没有更多消息的提示 */}
        {!hasMoreMessages && messages.length > 0 && (
          <div className="flex justify-center py-3">
            <span className="text-xs text-slate-400 bg-white/40 dark:bg-slate-800/40 backdrop-blur-sm rounded-full px-3 py-1">
              已显示全部消息
            </span>
          </div>
        )}

        <AnimatePresence>
          {messages.map((message, index) => {
            const prevMessage = index > 0 ? messages[index - 1] : undefined
            const nextMessage = index < messages.length - 1 ? messages[index + 1] : undefined
            const showTimestamp = shouldShowTimestamp(message, prevMessage)
            const showAvatar = shouldShowAvatar(message, nextMessage)
            const isUser = message.role === 'user'
            
            // 检查是否是被分割的AI消息
            const splitState = splitMessages.get(message.id)
            const shouldShowSplit = !isUser && splitState && splitState.segments.length > 0
            
            // 如果是需要分割的消息但还没开始处理，先不显示原消息
            const shouldHideOriginal = !isUser && 
              needsSplitting(message.content) && 
              processedMessageIds.has(message.id) && 
              (!splitState || splitState.segments.length === 0)
            
            // 如果是分割消息且有片段显示，则显示分割版本
            if (shouldShowSplit) {
              return (
                <div key={`split-${message.id}`}>
                  {/* 时间戳 */}
                  {showTimestamp && (
                    <div className="flex justify-center my-3">
                      <span className="text-xs text-slate-400 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-full px-3 py-1">
                        {formatTime(message.created_at)}
                      </span>
                    </div>
                  )}
                  
                  {/* 分割后的消息片段 */}
                  <AnimatePresence>
                    {splitState!.segments.map((segmentState, segIndex) => {
                      if (!segmentState.isVisible) return null
                      
                      const isLastSegment = segIndex === splitState!.segments.length - 1
                      const showSegmentAvatar = isLastSegment // 只在最后一个片段显示头像
                      
                      return (
                        <motion.div
                          key={`segment-${message.id}-${segIndex}`}
                          initial={{ opacity: 0, y: 20, scale: 0.8 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          className="flex items-end gap-2 mb-1"
                        >
                          {/* 头像 */}
                          <div className={`flex-shrink-0 ${showSegmentAvatar ? 'opacity-100' : 'opacity-0'}`}>
                            <Avatar className="w-7 h-7 sm:w-8 sm:h-8 border-2 border-white dark:border-slate-600 shadow-sm">
                              <AvatarImage src={currentCharacter?.avatar_url} />
                              <AvatarFallback className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium">
                                {currentCharacter?.name?.[0] || <Bot className="w-4 h-4" />}
                              </AvatarFallback>
                            </Avatar>
                          </div>

                          {/* 消息气泡 */}
                          <div className="max-w-[78%] sm:max-w-[75%] items-start flex flex-col">
                            <motion.div
                              whileTap={{ scale: 0.98 }}
                              className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl shadow-sm border backdrop-blur-sm bg-white/80 dark:bg-slate-700/80 text-slate-900 dark:text-white border-slate-200 dark:border-slate-600 rounded-bl-md"
                            >
                              {segmentState.isTyping && splitState!.isProcessing ? (
                                // 打字效果
                                <div className="flex items-center space-x-1">
                                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                                </div>
                              ) : (
                                // 实际内容
                                (() => {
                                  const emojiStickerCheck = isEmojiOrSticker(segmentState.segment.content)
                                  if (emojiStickerCheck.isEmoji) {
                                    return (
                                      <div className="p-2 text-center bg-transparent border-0">
                                        <span className="text-3xl">{emojiStickerCheck.data.content}</span>
                                      </div>
                                    )
                                  }
                                  if (emojiStickerCheck.isSticker) {
                                    return (
                                      <div className="p-2 bg-transparent border-0">
                                        <img 
                                          src={emojiStickerCheck.data.url}
                                          alt={emojiStickerCheck.data.name}
                                          className="w-20 h-20 object-contain rounded-lg"
                                          loading="lazy"
                                        />
                                      </div>
                                    )
                                  }
                                  
                                  return (
                                    <div className="prose prose-sm max-w-none">
                                      <p className="mb-0 whitespace-pre-wrap text-sm leading-relaxed text-slate-900 dark:text-white">
                                        {segmentState.segment.content}
                                      </p>
                                    </div>
                                  )
                                })()
                              )}
                            </motion.div>
                            
                            {/* 消息状态指示器 */}
                            {segmentState.isComplete && isLastSegment && !splitState!.isProcessing && (
                              <div className="text-xs text-slate-400 mt-1 ml-2">
                                已送达
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              )
            }

            // 如果应该隐藏原消息，则不渲染
            if (shouldHideOriginal) {
              return null
            }

            return (
              <div key={message.id}>
                {/* 时间戳 */}
                {showTimestamp && (
                  <div className="flex justify-center my-3">
                    <span className="text-xs text-slate-400 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-full px-3 py-1">
                      {formatTime(message.created_at)}
                    </span>
                  </div>
                )}
                
                {/* 消息 */}
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className={`flex items-end gap-2 mb-1 ${
                    isUser ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  {/* 头像 */}
                  <div className={`flex-shrink-0 ${showAvatar ? 'opacity-100' : 'opacity-0'}`}>
                    <Avatar className="w-7 h-7 sm:w-8 sm:h-8 border-2 border-white dark:border-slate-600 shadow-sm">
                      {isUser ? (
                        <AvatarFallback className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-medium">
                          <User className="w-4 h-4" />
                        </AvatarFallback>
                      ) : (
                        <>
                          <AvatarImage src={currentCharacter?.avatar_url} />
                          <AvatarFallback className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium">
                            {currentCharacter?.name?.[0] || <Bot className="w-4 h-4" />}
                          </AvatarFallback>
                        </>
                      )}
                    </Avatar>
                  </div>

                  {/* 消息气泡 */}
                  <div className={`max-w-[78%] sm:max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
                    <motion.div
                      whileTap={{ scale: 0.98 }}
                      className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl shadow-sm border backdrop-blur-sm ${
                        isUser
                          ? 'bg-blue-500 text-white border-blue-400/20 rounded-br-md'
                          : 'bg-white/80 dark:bg-slate-700/80 text-slate-900 dark:text-white border-slate-200 dark:border-slate-600 rounded-bl-md'
                      }`}
                    >
                      {(() => {
                        const emojiStickerCheck = isEmojiOrSticker(message.content)
                        if (emojiStickerCheck.isEmoji) {
                          return (
                            <div className="p-2 text-center bg-transparent border-0">
                              <span className="text-4xl">{emojiStickerCheck.data.content}</span>
                            </div>
                          )
                        }
                        if (emojiStickerCheck.isSticker) {
                          return (
                            <div className="p-2 bg-transparent border-0">
                              <img 
                                src={emojiStickerCheck.data.url}
                                alt={emojiStickerCheck.data.name}
                                className="w-24 h-24 object-contain rounded-lg"
                                loading="lazy"
                              />
                            </div>
                          )
                        }
                        
                        return (
                          <div className="prose prose-sm max-w-none">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                p: ({children}) => (
                                  <p className={`mb-1 last:mb-0 whitespace-pre-wrap text-sm leading-relaxed ${
                                    isUser ? 'text-white' : 'text-slate-900 dark:text-white'
                                  }`}>
                                    {children}
                                  </p>
                                ),
                                br: () => <br />,
                                code: ({children, className}) => {
                                  const isInline = !className
                                  return isInline ? (
                                    <code className={`px-1.5 py-0.5 rounded text-xs ${
                                      isUser 
                                        ? 'bg-blue-400/30 text-white' 
                                        : 'bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200'
                                    }`}>
                                      {children}
                                    </code>
                                  ) : (
                                    <code className={`block p-2 rounded text-xs overflow-x-auto ${
                                      isUser 
                                        ? 'bg-blue-400/20 text-white' 
                                        : 'bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200'
                                    }`}>
                                      {children}
                                    </code>
                                  )
                                },
                                strong: ({children}) => (
                                  <strong className={`font-semibold ${
                                    isUser ? 'text-white' : 'text-slate-900 dark:text-white'
                                  }`}>
                                    {children}
                                  </strong>
                                ),
                              }}
                            >
                              {cleanPauseMarkers(message.content)}
                            </ReactMarkdown>
                          </div>
                        )
                      })()}
                    </motion.div>
                    
                    {/* 消息状态指示器（仅用户消息显示） */}
                    {isUser && showAvatar && (
                      <div className="text-xs text-slate-400 mt-1 mr-2">
                        已送达
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            )
          })}
        </AnimatePresence>

        {/* 正在输入指示器 */}
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-end gap-2 mb-1"
          >
            <Avatar className="w-8 h-8 border-2 border-white dark:border-slate-600 shadow-sm">
              <AvatarImage src={currentCharacter?.avatar_url} />
              <AvatarFallback className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium">
                {currentCharacter?.name?.[0] || <Bot className="w-4 h-4" />}
              </AvatarFallback>
            </Avatar>
            
            <div className="bg-white/80 dark:bg-slate-700/80 backdrop-blur-sm px-4 py-3 rounded-2xl rounded-bl-md border border-slate-200 dark:border-slate-600 shadow-sm">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </motion.div>
        )}
        
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* 输入区域 */}
      <div className="px-3 py-2 sm:py-3 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
        <div className="flex items-end space-x-2">
          <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-2xl px-3 sm:px-4 py-2 border border-slate-200 dark:border-slate-600 shadow-sm">
            <Textarea
              ref={inputRef}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="输入消息..."
              className="resize-none text-sm bg-transparent border-none focus:ring-0 focus:outline-none min-h-[36px] max-h-[120px] p-0 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              rows={1}
              style={{
                fontSize: '16px',
                lineHeight: '1.4'
              }}
              onKeyDown={(e) => {
                const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768
                
                if (e.key === 'Enter') {
                  if (isMobile) {
                    if (e.ctrlKey || e.metaKey) {
                      e.preventDefault()
                      onSendMessage()
                    }
                  } else {
                    if (!e.shiftKey) {
                      e.preventDefault()
                      onSendMessage()
                    }
                  }
                }
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = Math.min(Math.max(target.scrollHeight, 36), 120) + 'px'
              }}
            />
          </div>
          
          {/* 表情包按钮 */}
          <StickerInput 
            onSend={(content) => {
              setUserInput(content)
              setTimeout(() => {
                onSendMessage()
              }, 10)
            }}
            disabled={isGenerating}
            className="self-end mb-1"
          />
          
          {/* 发送按钮 */}
          <Button
            onClick={onSendMessage}
            disabled={!userInput.trim() || isGenerating}
            className="rounded-full w-10 h-10 p-0 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 shadow-md hover:shadow-lg transition-all duration-200"
            style={{
              background: userInput.trim() && !isGenerating 
                ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
                : undefined
            }}
          >
            <Send className="w-4 h-4 text-white" />
          </Button>
        </div>
        
        {/* 输入提示 */}
        <div className="flex justify-center mt-2">
          <span className="text-xs text-slate-400">
            <span className="sm:hidden">Ctrl+Enter发送</span>
            <span className="hidden sm:inline">Enter发送，Shift+Enter换行</span>
          </span>
        </div>
      </div>
    </div>
  )
}
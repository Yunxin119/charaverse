'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Bot } from 'lucide-react'

interface TypingEffectProps {
  characterName?: string
  characterAvatar?: string
  isVisible: boolean
  className?: string
}

export function TypingEffect({ 
  characterName, 
  characterAvatar, 
  isVisible, 
  className = "" 
}: TypingEffectProps) {
  const [dotsCount, setDotsCount] = useState(1)

  useEffect(() => {
    if (!isVisible) return

    const interval = setInterval(() => {
      setDotsCount(prev => (prev % 3) + 1)
    }, 500)

    return () => clearInterval(interval)
  }, [isVisible])

  if (!isVisible) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className={`flex items-center space-x-2 ${className}`}
      >
        <Avatar className="w-6 h-6 border border-white dark:border-slate-600 shadow-sm">
          <AvatarImage src={characterAvatar} />
          <AvatarFallback className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs">
            {characterName?.[0] || <Bot className="w-3 h-3" />}
          </AvatarFallback>
        </Avatar>
        
        <div className="bg-white/90 dark:bg-slate-700/90 backdrop-blur-sm px-3 py-2 rounded-full border border-slate-200 dark:border-slate-600 shadow-sm">
          <div className="flex items-center space-x-1">
            <span className="text-xs text-slate-600 dark:text-slate-300">
              {characterName || '对方'}正在输入
            </span>
            <span className="text-xs text-slate-400 w-3 text-left">
              {'.'.repeat(dotsCount)}
            </span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// 打字状态管理Hook
export function useTypingIndicator(initialDelay = 0) {
  const [isTyping, setIsTyping] = useState(false)
  const [typingText, setTypingText] = useState('')

  const startTyping = (text?: string, delay = initialDelay) => {
    setTimeout(() => {
      setIsTyping(true)
      if (text) setTypingText(text)
    }, delay)
  }

  const stopTyping = (delay = 0) => {
    setTimeout(() => {
      setIsTyping(false)
      setTypingText('')
    }, delay)
  }

  const typeWithDuration = (text: string, duration: number, initialDelay = 0) => {
    startTyping(text, initialDelay)
    stopTyping(duration + initialDelay)
  }

  return {
    isTyping,
    typingText,
    startTyping,
    stopTyping,
    typeWithDuration
  }
}

// 高级打字效果组件
interface AdvancedTypingEffectProps {
  text: string
  speed?: number // 每个字符的打字间隔（毫秒）
  onComplete?: () => void
  className?: string
  isActive?: boolean
}

export function AdvancedTypingEffect({
  text,
  speed = 50,
  onComplete,
  className = "",
  isActive = true
}: AdvancedTypingEffectProps) {
  const [displayedText, setDisplayedText] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (!isActive) {
      setDisplayedText(text)
      return
    }

    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex])
        setCurrentIndex(prev => prev + 1)
      }, speed)

      return () => clearTimeout(timer)
    } else if (currentIndex === text.length && onComplete) {
      onComplete()
    }
  }, [currentIndex, text, speed, onComplete, isActive])

  // 重置当文本改变时
  useEffect(() => {
    setDisplayedText('')
    setCurrentIndex(0)
  }, [text])

  return (
    <span className={className}>
      {displayedText}
      {isActive && currentIndex < text.length && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          className="inline-block w-0.5 h-4 bg-current ml-0.5"
        />
      )}
    </span>
  )
}

// 头部状态指示器组件
interface HeaderTypingIndicatorProps {
  isVisible: boolean
  characterName?: string
  customText?: string
}

export function HeaderTypingIndicator({ 
  isVisible, 
  characterName, 
  customText 
}: HeaderTypingIndicatorProps) {
  const [dotsCount, setDotsCount] = useState(1)

  useEffect(() => {
    if (!isVisible) return

    const interval = setInterval(() => {
      setDotsCount(prev => (prev % 3) + 1)
    }, 600)

    return () => clearInterval(interval)
  }, [isVisible])

  if (!isVisible) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.2 }}
        className="flex items-center space-x-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-md text-xs"
      >
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
        <span>
          {customText || `${characterName || '对方'}正在输入`}
          {'.'.repeat(dotsCount)}
        </span>
      </motion.div>
    </AnimatePresence>
  )
}
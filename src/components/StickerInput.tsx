'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import StickerPicker from './StickerPicker'
import StickerButton from './StickerButton'
import AIStickerRecommendations from './AIStickerRecommendations'
import useStickerPicker from '@/hooks/useStickerPicker'
import useAIStickers from '@/hooks/useAIStickers'
import type { 
  Sticker, 
  StickerPickerConfig, 
  AIStickerConfig, 
  StickerMatch 
} from '@/types/sticker'

interface StickerInputProps {
  userId?: string
  onStickerSelect: (sticker: Sticker) => void
  currentMessage?: string
  className?: string
  stickerPickerConfig?: StickerPickerConfig
  aiConfig?: Partial<AIStickerConfig>
  showAIRecommendations?: boolean
  showStickerButton?: boolean
  buttonSize?: 'sm' | 'md' | 'lg'
  buttonVariant?: 'primary' | 'secondary' | 'ghost'
}

export default function StickerInput({
  userId,
  onStickerSelect,
  currentMessage = '',
  className = '',
  stickerPickerConfig = {},
  aiConfig = {},
  showAIRecommendations = true,
  showStickerButton = true,
  buttonSize = 'md',
  buttonVariant = 'ghost'
}: StickerInputProps) {
  const [showRecommendations, setShowRecommendations] = useState(true)
  
  // 表情包选择器
  const {
    isOpen: isPickerOpen,
    openPicker,
    closePicker,
    onStickerSelect: handlePickerSelect,
    config: pickerConfig
  } = useStickerPicker(stickerPickerConfig, onStickerSelect)

  // AI 表情包推荐
  const {
    recommendations,
    isLoading: isAILoading,
    getRecommendations,
    clearRecommendations
  } = useAIStickers(userId, aiConfig)

  // 监听消息变化，获取AI推荐
  useEffect(() => {
    if (showAIRecommendations && currentMessage.trim()) {
      getRecommendations(currentMessage)
    } else {
      clearRecommendations()
    }
  }, [currentMessage, showAIRecommendations, getRecommendations, clearRecommendations])

  // 处理AI推荐的表情包选择
  const handleAIRecommendationSelect = (match: StickerMatch) => {
    onStickerSelect(match.sticker)
    setShowRecommendations(false)
    
    // 可选：添加使用反馈，提高推荐准确性
    console.log('AI recommendation selected:', {
      sticker: match.sticker.name,
      score: match.score,
      reasons: match.reasons
    })
  }

  // 处理手动选择器的表情包选择
  const handleManualSelect = (sticker: Sticker) => {
    onStickerSelect(sticker)
    setShowRecommendations(false)
  }

  // 重新显示推荐
  const handleShowRecommendations = () => {
    setShowRecommendations(true)
    if (currentMessage.trim()) {
      getRecommendations(currentMessage)
    }
  }

  return (
    <div className={`relative ${className}`}>
      {/* AI 推荐表情包 */}
      {showAIRecommendations && 
       showRecommendations && 
       (isAILoading || recommendations.length > 0) && (
        <div className="absolute bottom-full mb-2 left-0 right-0">
          <AIStickerRecommendations
            recommendations={recommendations}
            isLoading={isAILoading}
            onStickerSelect={handleAIRecommendationSelect}
            onDismiss={() => setShowRecommendations(false)}
          />
        </div>
      )}

      {/* 表情包选择按钮 */}
      {showStickerButton && (
        <div className="flex items-center gap-2">
          <StickerButton
            onClick={openPicker}
            size={buttonSize}
            variant={buttonVariant}
          />
          
          {/* AI推荐重新显示按钮 */}
          {showAIRecommendations && 
           !showRecommendations && 
           currentMessage.trim() && 
           recommendations.length > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={handleShowRecommendations}
              className="
                px-2 py-1 text-xs rounded-full
                bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800
                text-blue-700 dark:text-blue-300
                transition-colors
                flex items-center gap-1
              "
              title="显示AI推荐"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>AI推荐</span>
            </motion.button>
          )}
        </div>
      )}

      {/* 表情包选择器弹窗 */}
      <StickerPicker
        isOpen={isPickerOpen}
        onClose={closePicker}
        onStickerSelect={handleManualSelect}
        userId={userId}
        config={pickerConfig}
      />
    </div>
  )
}
'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { StickerMatch } from '@/types/sticker'

interface AIStickerRecommendationsProps {
  recommendations: StickerMatch[]
  isLoading: boolean
  onStickerSelect: (match: StickerMatch) => void
  onDismiss?: () => void
  className?: string
  maxDisplay?: number
}

export default function AIStickerRecommendations({
  recommendations,
  isLoading,
  onStickerSelect,
  onDismiss,
  className = '',
  maxDisplay = 3
}: AIStickerRecommendationsProps) {
  const displayRecommendations = recommendations.slice(0, maxDisplay)

  if (!isLoading && recommendations.length === 0) {
    return null
  }

  return (
    <AnimatePresence>
      {(isLoading || recommendations.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ 
            type: "spring", 
            stiffness: 500, 
            damping: 30,
            duration: 0.2
          }}
          className={`
            bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700
            p-3 ${className}
          `}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                AI推荐表情包
              </span>
            </div>
            
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {isLoading ? (
              // 加载状态
              Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
                />
              ))
            ) : (
              // 推荐表情包
              displayRecommendations.map((match, index) => (
                <motion.button
                  key={match.sticker.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => onStickerSelect(match)}
                  className="
                    relative group w-12 h-12 rounded-lg overflow-hidden
                    hover:ring-2 hover:ring-blue-500 hover:ring-opacity-50
                    transition-all duration-200
                  "
                  title={`${match.sticker.name} (${Math.round(match.score * 100)}% 匹配)`}
                >
                  <img
                    src={match.sticker.image_url}
                    alt={match.sticker.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  
                  {/* 匹配分数指示器 */}
                  <div className={`
                    absolute top-0 right-0 w-3 h-3 rounded-full
                    ${match.score > 0.8 ? 'bg-green-500' : 
                      match.score > 0.5 ? 'bg-yellow-500' : 'bg-blue-500'}
                    opacity-0 group-hover:opacity-100 transition-opacity
                  `} />
                  
                  {/* 悬停提示 */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileHover={{ opacity: 1, scale: 1 }}
                    className="
                      absolute -top-12 left-1/2 transform -translate-x-1/2
                      bg-gray-900 text-white text-xs px-2 py-1 rounded-md
                      whitespace-nowrap z-10
                      opacity-0 group-hover:opacity-100 transition-opacity
                      pointer-events-none
                    "
                  >
                    <div className="font-medium">{match.sticker.name}</div>
                    <div className="text-gray-300 text-xs">
                      {Math.round(match.score * 100)}% 匹配
                    </div>
                    {match.reasons.length > 0 && (
                      <div className="text-gray-400 text-xs">
                        {match.reasons[0]}
                      </div>
                    )}
                    
                    {/* 小箭头 */}
                    <div className="
                      absolute top-full left-1/2 transform -translate-x-1/2
                      border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-900
                    " />
                  </motion.div>
                </motion.button>
              ))
            )}
          </div>

          {/* 显示更多推荐的指示器 */}
          {recommendations.length > maxDisplay && (
            <div className="text-center mt-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                还有 {recommendations.length - maxDisplay} 个推荐
              </span>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
'use client'

import React from 'react'
import { motion } from 'framer-motion'
import type { Sticker } from '@/types/sticker'

interface StickerMessageProps {
  sticker: Sticker
  isOwnMessage?: boolean
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showInfo?: boolean
  onLoad?: () => void
  onError?: () => void
}

export default function StickerMessage({
  sticker,
  isOwnMessage = false,
  className = '',
  size = 'md',
  showInfo = false,
  onLoad,
  onError
}: StickerMessageProps) {
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24', 
    lg: 'w-32 h-32',
    xl: 'w-40 h-40'
  }

  const maxWidthClasses = {
    sm: 'max-w-[64px]',
    md: 'max-w-[96px]',
    lg: 'max-w-[128px]', 
    xl: 'max-w-[160px]'
  }

  return (
    <div className={`
      flex ${isOwnMessage ? 'justify-end' : 'justify-start'}
      ${className}
    `}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ 
          type: "spring", 
          stiffness: 500, 
          damping: 30,
          duration: 0.3
        }}
        className={`
          ${maxWidthClasses[size]}
          ${isOwnMessage ? 'ml-12' : 'mr-12'}
        `}
      >
        <div className="relative group">
          <motion.img
            src={sticker.image_url}
            alt={sticker.name}
            className={`
              ${sizeClasses[size]}
              object-contain rounded-lg
              cursor-pointer
              shadow-sm hover:shadow-md transition-shadow
            `}
            onLoad={onLoad}
            onError={onError}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            loading="lazy"
          />
          
          {showInfo && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="
                absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full
                bg-gray-800 dark:bg-gray-900 text-white text-xs
                px-2 py-1 rounded-md mt-1 whitespace-nowrap
                opacity-0 group-hover:opacity-100 transition-opacity
                z-10
              "
            >
              {sticker.name}
              {sticker.pack?.name && (
                <div className="text-gray-400 text-xs">
                  来自: {sticker.pack.name}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
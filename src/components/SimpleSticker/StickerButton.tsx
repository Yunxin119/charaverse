'use client'

import React from 'react'
import { motion } from 'framer-motion'

interface StickerButtonProps {
  onClick: () => void
  isActive?: boolean
  disabled?: boolean
  className?: string
}

export default function StickerButton({ 
  onClick, 
  isActive = false,
  disabled = false, 
  className = '' 
}: StickerButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      onClick={onClick}
      disabled={disabled}
      className={`
        w-10 h-10 rounded-full flex items-center justify-center
        transition-colors duration-200
        ${isActive 
          ? 'bg-blue-500 text-white' 
          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      title="表情包"
    >
      <svg 
        className="w-6 h-6" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
        />
      </svg>
    </motion.button>
  )
}
'use client'

import React from 'react'
import StickerButton from './StickerButton'
import StickerPanel from './StickerPanel'
import StickerGuide from './StickerGuide'
import useSimpleStickers from '@/hooks/useSimpleStickers'

interface StickerInputProps {
  onSend: (content: string) => void
  className?: string
  disabled?: boolean
  showGuide?: boolean
}

export default function StickerInput({ onSend, className = '', disabled = false, showGuide = true }: StickerInputProps) {
  const { 
    isPanelOpen, 
    isGuideOpen, 
    togglePanel, 
    closePanel, 
    closeGuide, 
    onStickerClick 
  } = useSimpleStickers()

  return (
    <>
      <StickerButton
        onClick={togglePanel}
        isActive={isPanelOpen}
        disabled={disabled}
        className={className}
      />
      
      <StickerPanel
        isOpen={isPanelOpen}
        onClose={closePanel}
        onStickerClick={(sticker) => onStickerClick(sticker, onSend)}
      />

      {showGuide && (
        <StickerGuide
          isOpen={isGuideOpen}
          onClose={closeGuide}
        />
      )}
    </>
  )
}
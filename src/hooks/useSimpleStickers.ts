'use client'

import { useState, useCallback, useEffect } from 'react'
import type { SimpleSticker } from '@/components/SimpleSticker/StickerPanel'

export interface UseSimpleStickersReturn {
  isPanelOpen: boolean
  isGuideOpen: boolean
  openPanel: () => void
  closePanel: () => void
  togglePanel: () => void
  openGuide: () => void
  closeGuide: () => void
  onStickerClick: (sticker: SimpleSticker, onSend: (content: string) => void) => void
}

export default function useSimpleStickers(): UseSimpleStickersReturn {
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [isGuideOpen, setIsGuideOpen] = useState(false)

  // 检查是否是第一次使用
  useEffect(() => {
    const hasSeenGuide = localStorage.getItem('sticker-guide-seen')
    if (!hasSeenGuide) {
      setIsGuideOpen(true)
      localStorage.setItem('sticker-guide-seen', 'true')
    }
  }, [])

  const openPanel = useCallback(() => {
    setIsPanelOpen(true)
  }, [])

  const closePanel = useCallback(() => {
    setIsPanelOpen(false)
  }, [])

  const togglePanel = useCallback(() => {
    setIsPanelOpen(prev => !prev)
  }, [])

  const openGuide = useCallback(() => {
    setIsGuideOpen(true)
  }, [])

  const closeGuide = useCallback(() => {
    setIsGuideOpen(false)
  }, [])

  const onStickerClick = useCallback((sticker: SimpleSticker, onSend: (content: string) => void) => {
    // 直接发送表情包
    if (sticker.category === 'emoji') {
      // emoji直接发送文本
      onSend(sticker.url)
    } else {
      // 自定义表情包发送图片格式
      onSend(`[sticker:${sticker.name}:${sticker.url}]`)
    }
    
    // 关闭面板
    closePanel()
  }, [closePanel])

  return {
    isPanelOpen,
    isGuideOpen,
    openPanel,
    closePanel,
    togglePanel,
    openGuide,
    closeGuide,
    onStickerClick
  }
}
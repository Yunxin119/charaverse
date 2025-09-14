'use client'

import { useState, useCallback } from 'react'
import type { Sticker, StickerPickerConfig } from '@/types/sticker'

export interface StickerPickerState {
  isOpen: boolean
  selectedSticker: Sticker | null
  config: StickerPickerConfig
}

export interface UseStickerPickerReturn {
  isOpen: boolean
  selectedSticker: Sticker | null
  config: StickerPickerConfig
  openPicker: () => void
  closePicker: () => void
  onStickerSelect: (sticker: Sticker) => void
  updateConfig: (newConfig: Partial<StickerPickerConfig>) => void
}

export default function useStickerPicker(
  initialConfig: StickerPickerConfig = {},
  onStickerSelected?: (sticker: Sticker) => void
): UseStickerPickerReturn {
  const [state, setState] = useState<StickerPickerState>({
    isOpen: false,
    selectedSticker: null,
    config: {
      maxRecentStickers: 20,
      maxFavoriteStickers: 50,
      enableSearch: true,
      enableCategories: true,
      enableFavorites: true,
      defaultCategory: 'general',
      ...initialConfig
    }
  })

  const openPicker = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: true }))
  }, [])

  const closePicker = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }))
  }, [])

  const onStickerSelect = useCallback((sticker: Sticker) => {
    setState(prev => ({ ...prev, selectedSticker: sticker }))
    onStickerSelected?.(sticker)
  }, [onStickerSelected])

  const updateConfig = useCallback((newConfig: Partial<StickerPickerConfig>) => {
    setState(prev => ({
      ...prev,
      config: { ...prev.config, ...newConfig }
    }))
  }, [])

  return {
    isOpen: state.isOpen,
    selectedSticker: state.selectedSticker,
    config: state.config,
    openPicker,
    closePicker,
    onStickerSelect,
    updateConfig
  }
}
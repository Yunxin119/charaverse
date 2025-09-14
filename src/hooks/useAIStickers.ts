'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { AIStickerService } from '@/lib/aiStickerService'
import type { StickerMatch, AIStickerConfig } from '@/types/sticker'

export interface UseAIStickersReturn {
  recommendations: StickerMatch[]
  isLoading: boolean
  config: AIStickerConfig | null
  getRecommendations: (content: string) => Promise<StickerMatch[]>
  updateConfig: (newConfig: Partial<AIStickerConfig>) => void
  clearRecommendations: () => void
}

export default function useAIStickers(
  userId?: string,
  initialConfig?: Partial<AIStickerConfig>
): UseAIStickersReturn {
  const [recommendations, setRecommendations] = useState<StickerMatch[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [config, setConfig] = useState<AIStickerConfig | null>(null)
  
  // 防抖处理
  const debounceRef = useRef<NodeJS.Timeout>()

  // 获取推荐配置
  const loadConfig = useCallback(async () => {
    if (!userId) return
    
    try {
      const smartConfig = await AIStickerService.getSmartConfig(userId)
      const finalConfig = { ...smartConfig, ...initialConfig }
      setConfig(finalConfig)
    } catch (error) {
      console.error('Error loading AI sticker config:', error)
    }
  }, [userId, initialConfig])

  // 获取表情包推荐
  const getRecommendations = useCallback(async (content: string): Promise<StickerMatch[]> => {
    if (!content.trim()) {
      setRecommendations([])
      return []
    }

    // 清除之前的防抖定时器
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    return new Promise((resolve) => {
      debounceRef.current = setTimeout(async () => {
        try {
          setIsLoading(true)
          
          // 如果没有配置，先加载配置
          let currentConfig = config
          if (!currentConfig && userId) {
            currentConfig = await AIStickerService.getSmartConfig(userId)
            setConfig(currentConfig)
          }

          const finalConfig = currentConfig ? { ...currentConfig, ...initialConfig } : initialConfig

          const matches = await AIStickerService.recommendStickers(
            content,
            userId,
            finalConfig
          )
          
          setRecommendations(matches)
          resolve(matches)
        } catch (error) {
          console.error('Error getting sticker recommendations:', error)
          setRecommendations([])
          resolve([])
        } finally {
          setIsLoading(false)
        }
      }, 500) // 500ms 防抖
    })
  }, [config, userId, initialConfig])

  // 更新配置
  const updateConfig = useCallback((newConfig: Partial<AIStickerConfig>) => {
    setConfig(prev => prev ? { ...prev, ...newConfig } : null)
  }, [])

  // 清除推荐
  const clearRecommendations = useCallback(() => {
    setRecommendations([])
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
  }, [])

  // 初始化时加载配置
  useEffect(() => {
    if (userId) {
      loadConfig()
    }
  }, [userId, loadConfig])

  return {
    recommendations,
    isLoading,
    config,
    getRecommendations,
    updateConfig,
    clearRecommendations
  }
}
'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { StickerService } from '@/lib/stickerService'
import type { 
  StickerPack, 
  Sticker, 
  StickerCategory, 
  UserStickerUsage, 
  UserStickerFavorite,
  StickerPickerConfig 
} from '@/types/sticker'
import { STICKER_CATEGORIES } from '@/types/sticker'

interface StickerPickerProps {
  isOpen: boolean
  onClose: () => void
  onStickerSelect: (sticker: Sticker) => void
  userId?: string
  config?: StickerPickerConfig
  className?: string
}

type TabType = 'categories' | 'recent' | 'favorites' | 'search'

export default function StickerPicker({
  isOpen,
  onClose,
  onStickerSelect,
  userId,
  config = {},
  className = ''
}: StickerPickerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('categories')
  const [selectedCategory, setSelectedCategory] = useState<StickerCategory>('general')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Sticker[]>([])
  const [isSearching, setIsSearching] = useState(false)
  
  // 数据状态
  const [categoryStickers, setCategoryStickers] = useState<Sticker[]>([])
  const [recentStickers, setRecentStickers] = useState<UserStickerUsage[]>([])
  const [favoriteStickers, setFavoriteStickers] = useState<UserStickerFavorite[]>([])
  
  // 加载状态
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingCategory, setIsLoadingCategory] = useState(false)
  
  // 搜索防抖
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // 配置项
  const {
    maxRecentStickers = 20,
    enableSearch = true,
    enableCategories = true,
    enableFavorites = true,
    defaultCategory = 'general'
  } = config

  // 初始化数据
  useEffect(() => {
    if (isOpen) {
      loadInitialData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // 加载初始数据
  const loadInitialData = async () => {
    try {
      setIsLoading(true)
      
      // 并行加载数据
      const promises: Promise<unknown>[] = []
      
      if (enableCategories) {
        promises.push(StickerService.getStickerPacks())
      }
      
      if (userId) {
        if (maxRecentStickers > 0) {
          promises.push(StickerService.getRecentStickers(userId, maxRecentStickers))
        }
        if (enableFavorites) {
          promises.push(StickerService.getFavoriteStickers(userId))
        }
      }

      const results = await Promise.all(promises)
      let resultIndex = 0

      if (enableCategories) {
        // Results are loaded but not stored in state (loaded via loadCategoryStickers)
        resultIndex++
      }
      
      if (userId && maxRecentStickers > 0) {
        setRecentStickers((results[resultIndex++] as UserStickerUsage[]) || [])
      }

      if (userId && enableFavorites) {
        setFavoriteStickers((results[resultIndex++] as UserStickerFavorite[]) || [])
      }

      // 加载默认分类的表情包
      if (enableCategories) {
        loadCategoryStickers(defaultCategory)
      }
      
    } catch (error) {
      console.error('Error loading sticker data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 加载特定分类的表情包
  const loadCategoryStickers = async (category: StickerCategory) => {
    try {
      setIsLoadingCategory(true)
      const packs = await StickerService.getStickerPacksByCategory(category)
      const allStickers: Sticker[] = []
      
      // 加载每个合集中的表情包
      for (const pack of packs) {
        const stickers = await StickerService.getStickersInPack(pack.id)
        allStickers.push(...stickers)
      }
      
      setCategoryStickers(allStickers)
      setSelectedCategory(category)
    } catch (error) {
      console.error('Error loading category stickers:', error)
    } finally {
      setIsLoadingCategory(false)
    }
  }

  // 处理搜索
  const handleSearch = async (query: string) => {
    if (!enableSearch) return
    
    setSearchQuery(query)
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    
    setIsSearching(true)
    
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const result = await StickerService.searchStickers(query, undefined, 50, 0)
        setSearchResults(result.stickers)
      } catch (error) {
        console.error('Error searching stickers:', error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)
  }

  // 处理表情包选择
  const handleStickerClick = async (sticker: Sticker) => {
    // 记录使用
    if (userId) {
      try {
        await StickerService.recordStickerUsage(userId, sticker.id)
      } catch (error) {
        console.error('Error recording sticker usage:', error)
      }
    }
    
    onStickerSelect(sticker)
    onClose()
  }

  // 切换收藏状态
  const toggleFavorite = async (sticker: Sticker, event: React.MouseEvent) => {
    event.stopPropagation()
    
    if (!userId || !enableFavorites) return
    
    try {
      const isFavorited = favoriteStickers.some(fav => fav.sticker_id === sticker.id)
      
      if (isFavorited) {
        await StickerService.removeStickerFromFavorites(userId, sticker.id)
        setFavoriteStickers(prev => prev.filter(fav => fav.sticker_id !== sticker.id))
      } else {
        await StickerService.addStickerToFavorites(userId, sticker.id)
        setFavoriteStickers(prev => [...prev, {
          id: '',
          user_id: userId,
          sticker_id: sticker.id,
          created_at: new Date().toISOString(),
          sticker
        }])
      }
    } catch (error) {
      console.error('Error toggling favorite:', error)
    }
  }

  // 检查是否收藏
  const isStickerFavorited = (stickerId: string) => {
    return favoriteStickers.some(fav => fav.sticker_id === stickerId)
  }

  // 获取当前显示的表情包列表
  const currentStickers = useMemo(() => {
    switch (activeTab) {
      case 'recent':
        return recentStickers.map(usage => usage.sticker).filter(Boolean) as Sticker[]
      case 'favorites':
        return favoriteStickers.map(fav => fav.sticker).filter(Boolean) as Sticker[]
      case 'search':
        return searchResults
      case 'categories':
      default:
        return categoryStickers
    }
  }, [activeTab, categoryStickers, recentStickers, favoriteStickers, searchResults])

  // 分类选项
  const categoryOptions = useMemo(() => {
    return Object.entries(STICKER_CATEGORIES).map(([key, info]) => ({
      key: key as StickerCategory,
      ...info
    }))
  }, [])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 500 }}
          className={`
            bg-white dark:bg-gray-800 
            w-full max-w-md mx-4 mb-4 
            rounded-2xl shadow-2xl 
            max-h-[70vh] flex flex-col
            ${className}
          `}
          onClick={e => e.stopPropagation()}
        >
          {/* 头部 */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              选择表情包
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 搜索框 */}
          {enableSearch && (
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="搜索表情包..."
                  className="
                    w-full px-4 py-2 pl-10
                    bg-gray-100 dark:bg-gray-700 
                    border-0 rounded-full
                    text-gray-900 dark:text-white
                    placeholder-gray-500 dark:placeholder-gray-400
                    focus:ring-2 focus:ring-blue-500 focus:outline-none
                  "
                />
                <svg 
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {isSearching && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 标签栏 */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            {enableCategories && (
              <button
                onClick={() => setActiveTab('categories')}
                className={`
                  flex-1 py-3 px-4 text-sm font-medium transition-colors
                  ${activeTab === 'categories' 
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }
                `}
              >
                分类
              </button>
            )}
            {userId && maxRecentStickers > 0 && (
              <button
                onClick={() => setActiveTab('recent')}
                className={`
                  flex-1 py-3 px-4 text-sm font-medium transition-colors
                  ${activeTab === 'recent' 
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }
                `}
              >
                最近 ({recentStickers.length})
              </button>
            )}
            {userId && enableFavorites && (
              <button
                onClick={() => setActiveTab('favorites')}
                className={`
                  flex-1 py-3 px-4 text-sm font-medium transition-colors
                  ${activeTab === 'favorites' 
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }
                `}
              >
                收藏 ({favoriteStickers.length})
              </button>
            )}
            {enableSearch && searchQuery.trim() && (
              <button
                onClick={() => setActiveTab('search')}
                className={`
                  flex-1 py-3 px-4 text-sm font-medium transition-colors
                  ${activeTab === 'search' 
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }
                `}
              >
                搜索 ({searchResults.length})
              </button>
            )}
          </div>

          {/* 分类选择器 */}
          {activeTab === 'categories' && enableCategories && (
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex flex-wrap gap-2">
                {categoryOptions.map((category) => (
                  <button
                    key={category.key}
                    onClick={() => loadCategoryStickers(category.key)}
                    className={`
                      px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                      flex items-center gap-2
                      ${selectedCategory === category.key
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }
                    `}
                  >
                    <span>{category.emoji}</span>
                    <span>{category.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 内容区域 */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : isLoadingCategory ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : currentStickers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-3-7a9 9 0 100 18 9 9 0 000-18z" />
                </svg>
                <p className="text-sm">暂无表情包</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2 p-4">
                {currentStickers.map((sticker) => (
                  <motion.button
                    key={sticker.id}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleStickerClick(sticker)}
                    className="
                      relative aspect-square rounded-lg overflow-hidden 
                      bg-gray-100 dark:bg-gray-700 
                      hover:bg-gray-200 dark:hover:bg-gray-600 
                      transition-colors group
                    "
                  >
                    <Image
                      src={sticker.image_url}
                      alt={sticker.name}
                      fill
                      className="object-cover"
                      loading="lazy"
                      unoptimized
                    />
                    {userId && enableFavorites && (
                      <button
                        onClick={(e) => toggleFavorite(sticker, e)}
                        className={`
                          absolute top-1 right-1 p-1 rounded-full
                          opacity-0 group-hover:opacity-100 transition-opacity
                          ${isStickerFavorited(sticker.id)
                            ? 'bg-red-500 text-white'
                            : 'bg-gray-800/60 text-white hover:bg-gray-800/80'
                          }
                        `}
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                        </svg>
                      </button>
                    )}
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
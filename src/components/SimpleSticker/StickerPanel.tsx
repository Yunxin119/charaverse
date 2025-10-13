'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'

// 简化的表情包类型
export interface SimpleSticker {
  id: string
  name: string
  url: string
  category: 'emoji' | 'sticker'
}

interface StickerPanelProps {
  isOpen: boolean
  onClose: () => void
  onStickerClick: (sticker: SimpleSticker) => void
  className?: string
}

// 默认emoji表情 - 扩展版
const DEFAULT_EMOJIS: SimpleSticker[] = [
  // 基础笑脸
  { id: 'grinning', name: '😀', url: '😀', category: 'emoji' },
  { id: 'grinning_eyes', name: '😁', url: '😁', category: 'emoji' },
  { id: 'joy', name: '😂', url: '😂', category: 'emoji' },
  { id: 'rofl', name: '🤣', url: '🤣', category: 'emoji' },
  { id: 'smile', name: '😊', url: '😊', category: 'emoji' },
  { id: 'happy', name: '😄', url: '😄', category: 'emoji' },
  { id: 'smiley_eyes', name: '😆', url: '😆', category: 'emoji' },
  { id: 'sweat_smile', name: '😅', url: '😅', category: 'emoji' },
  
  // 爱意表情
  { id: 'heart_eyes', name: '😍', url: '😍', category: 'emoji' },
  { id: 'kiss_heart', name: '😘', url: '😘', category: 'emoji' },
  { id: 'kissing', name: '😗', url: '😗', category: 'emoji' },
  { id: 'star_struck', name: '🤩', url: '🤩', category: 'emoji' },
  { id: 'smiling_hearts', name: '🥰', url: '🥰', category: 'emoji' },
  
  // 调皮表情
  { id: 'wink', name: '😉', url: '😉', category: 'emoji' },
  { id: 'tongue', name: '😋', url: '😋', category: 'emoji' },
  { id: 'tongue_wink', name: '😜', url: '😜', category: 'emoji' },
  { id: 'crazy', name: '🤪', url: '🤪', category: 'emoji' },
  { id: 'tongue_closed', name: '😝', url: '😝', category: 'emoji' },
  
  // 酷炫表情
  { id: 'cool', name: '😎', url: '😎', category: 'emoji' },
  { id: 'nerd', name: '🤓', url: '🤓', category: 'emoji' },
  { id: 'monocle', name: '🧐', url: '🧐', category: 'emoji' },
  
  // 思考和中性
  { id: 'thinking', name: '🤔', url: '🤔', category: 'emoji' },
  { id: 'neutral', name: '😐', url: '😐', category: 'emoji' },
  { id: 'expressionless', name: '😑', url: '😑', category: 'emoji' },
  { id: 'no_mouth', name: '😶', url: '😶', category: 'emoji' },
  { id: 'smirk', name: '😏', url: '😏', category: 'emoji' },
  
  // 不开心表情
  { id: 'unamused', name: '😒', url: '😒', category: 'emoji' },
  { id: 'roll_eyes', name: '🙄', url: '🙄', category: 'emoji' },
  { id: 'confused', name: '😕', url: '😕', category: 'emoji' },
  { id: 'worried', name: '😟', url: '😟', category: 'emoji' },
  { id: 'frown', name: '🙁', url: '🙁', category: 'emoji' },
  
  // 悲伤表情
  { id: 'sad', name: '😢', url: '😢', category: 'emoji' },
  { id: 'sob', name: '😭', url: '😭', category: 'emoji' },
  { id: 'disappointed', name: '😞', url: '😞', category: 'emoji' },
  { id: 'pensive', name: '😔', url: '😔', category: 'emoji' },
  
  // 愤怒表情
  { id: 'angry', name: '😠', url: '😠', category: 'emoji' },
  { id: 'rage', name: '😡', url: '😡', category: 'emoji' },
  { id: 'swearing', name: '🤬', url: '🤬', category: 'emoji' },
  { id: 'triumph', name: '😤', url: '😤', category: 'emoji' },
  
  // 惊讶表情
  { id: 'surprised', name: '😲', url: '😲', category: 'emoji' },
  { id: 'astonished', name: '😧', url: '😧', category: 'emoji' },
  { id: 'shocked', name: '😱', url: '😱', category: 'emoji' },
  { id: 'open_mouth', name: '😮', url: '😮', category: 'emoji' },
  { id: 'hushed', name: '😯', url: '😯', category: 'emoji' },
  
  // 疲惫和生病
  { id: 'tired', name: '😴', url: '😴', category: 'emoji' },
  { id: 'sleepy', name: '😪', url: '😪', category: 'emoji' },
  { id: 'yawn', name: '🥱', url: '🥱', category: 'emoji' },
  { id: 'sick', name: '🤒', url: '🤒', category: 'emoji' },
  { id: 'nausea', name: '🤢', url: '🤢', category: 'emoji' },
  { id: 'vomit', name: '🤮', url: '🤮', category: 'emoji' },
  
  // 特殊表情
  { id: 'mask', name: '😷', url: '😷', category: 'emoji' },
  { id: 'dizzy', name: '😵', url: '😵', category: 'emoji' },
  { id: 'exploding_head', name: '🤯', url: '🤯', category: 'emoji' },
  { id: 'cowboy', name: '🤠', url: '🤠', category: 'emoji' },
  { id: 'partying', name: '🥳', url: '🥳', category: 'emoji' },
  
  // 手势
  { id: 'thumbs_up', name: '👍', url: '👍', category: 'emoji' },
  { id: 'thumbs_down', name: '👎', url: '👎', category: 'emoji' },
  { id: 'ok_hand', name: '👌', url: '👌', category: 'emoji' },
  { id: 'victory', name: '✌️', url: '✌️', category: 'emoji' },
  { id: 'crossed_fingers', name: '🤞', url: '🤞', category: 'emoji' },
  { id: 'love_you', name: '🤟', url: '🤟', category: 'emoji' },
  { id: 'rock_on', name: '🤘', url: '🤘', category: 'emoji' },
  { id: 'call_me', name: '🤙', url: '🤙', category: 'emoji' },
  { id: 'point_up', name: '☝️', url: '☝️', category: 'emoji' },
  { id: 'point_right', name: '👉', url: '👉', category: 'emoji' },
  { id: 'point_down', name: '👇', url: '👇', category: 'emoji' },
  { id: 'point_left', name: '👈', url: '👈', category: 'emoji' },
  { id: 'raised_hand', name: '✋', url: '✋', category: 'emoji' },
  { id: 'wave', name: '👋', url: '👋', category: 'emoji' },
  { id: 'clap', name: '👏', url: '👏', category: 'emoji' },
  { id: 'muscle', name: '💪', url: '💪', category: 'emoji' },
  { id: 'pray', name: '🙏', url: '🙏', category: 'emoji' },
  { id: 'facepalm', name: '🤦', url: '🤦', category: 'emoji' },
  { id: 'shrug', name: '🤷', url: '🤷', category: 'emoji' },
  
  // 心形符号
  { id: 'red_heart', name: '❤️', url: '❤️', category: 'emoji' },
  { id: 'orange_heart', name: '🧡', url: '🧡', category: 'emoji' },
  { id: 'yellow_heart', name: '💛', url: '💛', category: 'emoji' },
  { id: 'green_heart', name: '💚', url: '💚', category: 'emoji' },
  { id: 'blue_heart', name: '💙', url: '💙', category: 'emoji' },
  { id: 'purple_heart', name: '💜', url: '💜', category: 'emoji' },
  { id: 'black_heart', name: '🖤', url: '🖤', category: 'emoji' },
  { id: 'white_heart', name: '🤍', url: '🤍', category: 'emoji' },
  { id: 'broken_heart', name: '💔', url: '💔', category: 'emoji' },
  { id: 'heart_exclamation', name: '❣️', url: '❣️', category: 'emoji' },
  { id: 'two_hearts', name: '💕', url: '💕', category: 'emoji' },
  { id: 'revolving_hearts', name: '💞', url: '💞', category: 'emoji' },
  { id: 'heartbeat', name: '💓', url: '💓', category: 'emoji' },
  { id: 'growing_heart', name: '💗', url: '💗', category: 'emoji' },
  { id: 'sparkling_heart', name: '💖', url: '💖', category: 'emoji' },
  
  // 其他符号
  { id: 'fire', name: '🔥', url: '🔥', category: 'emoji' },
  { id: 'star', name: '⭐', url: '⭐', category: 'emoji' },
  { id: 'sparkles', name: '✨', url: '✨', category: 'emoji' },
  { id: 'boom', name: '💥', url: '💥', category: 'emoji' },
  { id: 'dizzy_symbol', name: '💫', url: '💫', category: 'emoji' },
  { id: 'sweat_drops', name: '💦', url: '💦', category: 'emoji' },
  { id: 'dash', name: '💨', url: '💨', category: 'emoji' },
  { id: 'zzz', name: '💤', url: '💤', category: 'emoji' },
  { id: 'kiss_mark', name: '💋', url: '💋', category: 'emoji' },
  { id: 'love_letter', name: '💌', url: '💌', category: 'emoji' },
]

export default function StickerPanel({ isOpen, onClose, onStickerClick, className = '' }: StickerPanelProps) {
  const [activeTab, setActiveTab] = useState<'recent' | 'emoji' | 'stickers'>('emoji')
  const [recentStickers, setRecentStickers] = useState<SimpleSticker[]>([])
  const [customStickers, setCustomStickers] = useState<SimpleSticker[]>([])
  const [isUploading, setIsUploading] = useState(false)

  // 获取当前标签的表情包
  const getCurrentStickers = () => {
    switch (activeTab) {
      case 'recent':
        return recentStickers
      case 'emoji':
        return DEFAULT_EMOJIS
      case 'stickers':
        return customStickers
      default:
        return DEFAULT_EMOJIS
    }
  }


  // 从localStorage加载数据
  useEffect(() => {
    const savedRecent = localStorage.getItem('recent-stickers')
    const savedCustom = localStorage.getItem('custom-stickers')
    
    if (savedRecent) {
      try {
        setRecentStickers(JSON.parse(savedRecent))
      } catch (e) {
        console.warn('Failed to load recent stickers:', e)
      }
    }
    
    if (savedCustom) {
      try {
        setCustomStickers(JSON.parse(savedCustom))
      } catch (e) {
        console.warn('Failed to load custom stickers:', e)
      }
    }
  }, [isOpen])

  // 保存自定义表情包到localStorage
  const saveCustomStickers = (stickers: SimpleSticker[]) => {
    setCustomStickers(stickers)
    localStorage.setItem('custom-stickers', JSON.stringify(stickers))
  }

  // 处理文件上传
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    const newStickers: SimpleSticker[] = []

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        
        // 验证文件类型
        if (!file.type.startsWith('image/')) {
          console.warn(`Skipping non-image file: ${file.name}`)
          continue
        }

        // 验证文件大小 (5MB限制)
        if (file.size > 5 * 1024 * 1024) {
          console.warn(`File too large: ${file.name}`)
          continue
        }

        // 将文件转换为base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })

        const sticker: SimpleSticker = {
          id: `custom_${Date.now()}_${i}`,
          name: file.name.replace(/\.[^/.]+$/, ""), // 移除扩展名
          url: base64,
          category: 'sticker'
        }

        newStickers.push(sticker)
      }

      if (newStickers.length > 0) {
        const updatedStickers = [...customStickers, ...newStickers]
        saveCustomStickers(updatedStickers)
        
        // 自动切换到贴图标签页
        setActiveTab('stickers')
      }
    } catch (error) {
      console.error('Error uploading stickers:', error)
    } finally {
      setIsUploading(false)
      // 清空input值，允许重复选择同一文件
      event.target.value = ''
    }
  }

  // 删除自定义表情包
  const deleteCustomSticker = (stickerId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    const updatedStickers = customStickers.filter(s => s.id !== stickerId)
    saveCustomStickers(updatedStickers)
  }

  // 处理表情包点击
  const handleStickerClick = (sticker: SimpleSticker) => {
    // 添加到最近使用
    const newRecent = [sticker, ...recentStickers.filter(s => s.id !== sticker.id)].slice(0, 20)
    setRecentStickers(newRecent)
    localStorage.setItem('recent-stickers', JSON.stringify(newRecent))
    
    // 调用回调
    onStickerClick(sticker)
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: '100%' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '100%' }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className={`
          fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 
          border-t border-gray-200 dark:border-gray-700 z-50
          ${className}
        `}
        style={{ height: '400px' }}
      >
        {/* 标签栏 */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('recent')}
            className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'recent'
                ? 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            最近
          </button>
          <button
            onClick={() => setActiveTab('emoji')}
            className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'emoji'
                ? 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            😊 表情 ({DEFAULT_EMOJIS.length})
          </button>
          <button
            onClick={() => setActiveTab('stickers')}
            className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'stickers'
                ? 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            贴图
          </button>
          
          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className="px-4 py-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 表情包网格 */}
        <div className="flex-1 overflow-y-auto p-3" style={{ maxHeight: '280px' }}>
          {getCurrentStickers().length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-3-7a9 9 0 100 18 9 9 0 000-18z" />
              </svg>
              <p className="text-sm mb-3">
                {activeTab === 'recent' ? '暂无最近使用' : activeTab === 'stickers' ? '暂无自定义表情包' : '暂无表情包'}
              </p>
              
              {/* 上传按钮（仅在贴图标签页显示） */}
              {activeTab === 'stickers' && (
                <div className="flex flex-col items-center">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="sticker-upload"
                    disabled={isUploading}
                  />
                  <label
                    htmlFor="sticker-upload"
                    className={`
                      px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white 
                      rounded-lg cursor-pointer transition-colors text-sm font-medium
                      ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    {isUploading ? '上传中...' : '📁 上传表情包'}
                  </label>
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    支持 JPG、PNG、GIF 格式<br/>
                    最大 5MB，可多选
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* 上传按钮（在贴图标签页顶部显示） */}
              {activeTab === 'stickers' && (
                <div className="flex justify-center pb-2 border-b border-gray-200 dark:border-gray-600">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="sticker-upload-top"
                    disabled={isUploading}
                  />
                  <label
                    htmlFor="sticker-upload-top"
                    className={`
                      px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white 
                      rounded-lg cursor-pointer transition-colors text-sm font-medium
                      flex items-center gap-1
                      ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    {isUploading ? (
                      <>
                        <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                        上传中...
                      </>
                    ) : (
                      <>📁 添加表情包</>
                    )}
                  </label>
                </div>
              )}

              <div className="grid grid-cols-8 gap-1.5">
                {getCurrentStickers().map((sticker) => (
                  <motion.button
                    key={sticker.id}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleStickerClick(sticker)}
                    className="
                      relative group aspect-square flex items-center justify-center
                      hover:bg-gray-100 dark:hover:bg-gray-700 
                      rounded-lg transition-colors min-h-[40px]
                    "
                  >
                    {sticker.category === 'emoji' ? (
                      <span className="text-xl">{sticker.url}</span>
                    ) : (
                      <>
                        <Image 
                          src={sticker.url} 
                          alt={sticker.name}
                          width={32}
                          height={32}
                          className="object-contain rounded"
                          loading="lazy"
                          unoptimized
                        />
                        {/* 删除按钮（仅自定义表情包显示） */}
                        {activeTab === 'stickers' && (
                          <button
                            onClick={(e) => deleteCustomSticker(sticker.id, e)}
                            className="
                              absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white 
                              rounded-full text-xs opacity-0 group-hover:opacity-100 
                              transition-opacity hover:bg-red-600 flex items-center justify-center
                            "
                          >
                            ×
                          </button>
                        )}
                      </>
                    )}
                  </motion.button>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
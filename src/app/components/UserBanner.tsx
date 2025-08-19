'use client'

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Camera, User, Settings, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { uploadUserBanner } from '../lib/avatarUpload'

interface UserBannerProps {
  username: string
  avatar?: string
  banner?: string
  bio?: string
  charactersCount?: number
  canEdit?: boolean
  onBannerUpdate?: (newBannerUrl: string) => void
}

export function UserBanner({
  username,
  avatar,
  banner,
  bio,
  charactersCount = 0,
  canEdit = false,
  onBannerUpdate
}: UserBannerProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [bannerUrl, setBannerUrl] = useState(banner)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleBannerUpload = async (file: File) => {
    if (!canEdit) return

    setIsUploading(true)
    try {
      const newBannerUrl = await uploadUserBanner(file)
      setBannerUrl(newBannerUrl)
      onBannerUpdate?.(newBannerUrl)
    } catch (error) {
      console.error('Banner上传失败:', error)
      alert('Banner上传失败，请重试')
    } finally {
      setIsUploading(false)
    }
  }

  const triggerFileSelect = () => {
    if (!canEdit) return
    fileInputRef.current?.click()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="relative -mx-4 -mt-6 mb-8"
    >
      {/* Banner背景 */}
      <div className="w-full aspect-[2.5/1] overflow-hidden relative group">
        {bannerUrl ? (
          <>
            <img
              src={bannerUrl}
              alt="用户Banner"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          </>
        ) : (
          <>
            {/* 默认渐变背景 */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500">
              <div className="absolute inset-0 opacity-60">
                <div className="absolute top-0 left-1/4 w-64 h-64 bg-white rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-white rounded-full blur-3xl"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-white rounded-full blur-2xl"></div>
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </>
        )}

        {/* 上传按钮 - 只有可编辑时显示 */}
        {canEdit && (
          <Button
            onClick={triggerFileSelect}
            disabled={isUploading}
            variant="ghost"
            size="sm"
            className="absolute top-4 right-4 bg-black/20 hover:bg-black/40 text-white border-white/20 group-hover:opacity-100 opacity-0 transition-opacity duration-200"
          >
            {isUploading ? (
              <Upload className="w-4 h-4 animate-pulse" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
          </Button>
        )}

        {/* 用户信息 - 位于Banner底部 */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="flex items-end space-x-4">
            {/* 用户头像 */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="relative"
            >
              <Avatar className="w-20 h-20 border-4 border-white shadow-xl">
                <AvatarImage src={avatar} alt={username} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xl font-bold">
                  {username?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
            </motion.div>

            {/* 用户信息 */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="flex-1 min-w-0 pb-2"
            >
              <h1 className="text-2xl font-bold text-white drop-shadow-lg mb-1">
                {username || '未设置用户名'}
              </h1>
              {bio ? (
                <p className="text-white/90 text-sm drop-shadow mb-2 line-clamp-2">
                  {bio}
                </p>
              ) : (
                <p className="text-white/90 text-sm drop-shadow mb-2 line-clamp-2">
                  暂无简介
                </p>
              )}
              <div className="flex items-center space-x-4 text-white/80 text-sm">
                <div className="flex items-center space-x-1">
                  <User className="w-4 h-4" />
                  <span>{charactersCount} 个角色</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* 渐变遮罩 - 确保文字可读性 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
      </div>

      {/* 隐藏的文件上传input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            handleBannerUpload(file)
          }
          e.target.value = '' // 清空input以允许重复选择同一文件
        }}
        className="hidden"
      />

      {/* 上传提示 - 仅在没有banner且可编辑时显示 */}
      {canEdit && !bannerUrl && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="absolute top-4 left-4 bg-black/20 backdrop-blur-sm rounded-lg px-3 py-1"
        >
          <p className="text-white text-xs">点击右上角添加个人横幅</p>
        </motion.div>
      )}
    </motion.div>
  )
}

export default UserBanner
'use client'

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Camera, Users, Loader2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PosterCard, PosterTitle, Chip, IconButton } from '@/components/glass'
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

/** Profile hero: poster block (or the user's banner image) with avatar, name, bio and counts. */
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
    if (!canEdit || isUploading) return
    fileInputRef.current?.click()
  }

  const initial = username?.charAt(0)?.toUpperCase() || 'U'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
      className="group relative"
    >
      <PosterCard tone="ink" image={bannerUrl || undefined} className="flex min-h-56 flex-col justify-end p-5 sm:min-h-64 sm:p-7">
        {/* 顶部：品牌标签 + 上传按钮 */}
        <div className="absolute inset-x-5 top-5 flex items-center justify-between sm:inset-x-7 sm:top-7">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] opacity-70">Profile</span>
          {canEdit && (
            <div className="flex items-center gap-2">
              {!bannerUrl && (
                <Chip tone="outline" className="hidden border-white/20 bg-white/10 text-[var(--cv-cream-200)] sm:inline-flex">
                  添加个人横幅
                </Chip>
              )}
              <IconButton
                label={bannerUrl ? '更换横幅' : '上传横幅'}
                variant="glass"
                size="sm"
                onClick={triggerFileSelect}
                disabled={isUploading}
                className="text-[var(--cv-cream-200)]"
              >
                {isUploading ? <Loader2 className="animate-spin" /> : <Camera />}
              </IconButton>
            </div>
          )}
        </div>

        {/* 底部：头像 + 用户信息 */}
        <div className="flex items-end gap-4 pt-16">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.12, duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
            className="shrink-0"
          >
            <Avatar className="size-20 ring-4 ring-[var(--cv-cream-200)] shadow-[0_16px_40px_-16px_rgba(0,0,0,0.7)] sm:size-24">
              <AvatarImage src={avatar} alt={username} className="object-cover" />
              <AvatarFallback className="bg-cv-accent font-display text-2xl font-semibold text-cv-accent-fg">{initial}</AvatarFallback>
            </Avatar>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.18, duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
            className="min-w-0 flex-1 pb-1"
          >
            <PosterTitle className="truncate text-2xl sm:text-3xl">{username || '未设置用户名'}</PosterTitle>
            <p className="mt-1 line-clamp-2 text-sm opacity-80">{bio || '暂无简介'}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Chip tone="outline" className="border-white/20 bg-white/10 text-[var(--cv-cream-200)]">
                <Users className="size-3.5" />
                {charactersCount} 个角色
              </Chip>
            </div>
          </motion.div>
        </div>
      </PosterCard>

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
    </motion.div>
  )
}

export default UserBanner

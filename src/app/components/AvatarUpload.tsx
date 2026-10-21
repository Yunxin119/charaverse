'use client'

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Camera, Upload, RefreshCw } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { IconButton } from '@/components/glass'
import { cn } from '@/lib/utils'

interface AvatarUploadProps {
  currentAvatar?: string
  fallbackText?: string
  onUpload: (file: File) => Promise<string>
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  disabled?: boolean
}

const sizeClasses = {
  sm: 'size-16 text-lg',
  md: 'size-24 text-2xl',
  lg: 'size-32 text-3xl',
  xl: 'size-40 text-4xl'
}

/** Click-to-upload avatar: neu ring, hover camera veil, preview while uploading. */
export function AvatarUpload({
  currentAvatar,
  fallbackText = '头像',
  onUpload,
  className = '',
  size = 'lg',
  disabled = false
}: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件')
      return
    }

    // 验证文件大小（10MB）
    if (file.size > 10 * 1024 * 1024) {
      alert('图片文件不能超过10MB')
      return
    }

    // 创建预览URL
    const preview = URL.createObjectURL(file)
    try {
      setIsUploading(true)
      setPreviewUrl(preview)

      // 上传文件
      await onUpload(file)
    } catch (error) {
      console.error('上传失败:', error)
      alert(error instanceof Error ? error.message : '上传失败，请重试')
    } finally {
      // 清理预览URL
      URL.revokeObjectURL(preview)
      setPreviewUrl(null)
      setIsUploading(false)
      // 清空input值，允许重新选择同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleClick = () => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click()
    }
  }

  const displayAvatar = previewUrl || currentAvatar
  const interactive = !disabled && !isUploading

  return (
    <div className={cn('relative inline-block', className)}>
      {/* 头像显示区域 */}
      <motion.div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={currentAvatar ? '更换头像' : '上传头像'}
        aria-disabled={disabled || isUploading || undefined}
        whileHover={interactive ? { scale: 1.04 } : {}}
        whileTap={interactive ? { scale: 0.96 } : {}}
        className={cn(
          'group relative rounded-full p-1 neu outline-none focus-visible:ring-2 focus-visible:ring-cv-ring',
          sizeClasses[size],
          disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
        )}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick()
          }
        }}
      >
        <Avatar className="size-full ring-1 ring-cv-glass-border">
          <AvatarImage src={displayAvatar} className="object-cover" />
          <AvatarFallback className="bg-cv-primary font-display font-semibold text-cv-primary-fg">
            {fallbackText.charAt(0)}
          </AvatarFallback>
        </Avatar>

        {/* 上传遮罩 - 只在非禁用且非上传状态时显示 */}
        {interactive && (
          <div className="absolute inset-1 flex items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--cv-ink-900)_55%,transparent)] text-[var(--cv-cream-200)] opacity-0 transition-opacity duration-(--cv-dur-fast) group-hover:opacity-100 group-focus-visible:opacity-100">
            <Camera className="size-[1.1em]" />
          </div>
        )}

        {/* 加载状态 */}
        {isUploading && (
          <div className="absolute inset-1 flex items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--cv-ink-900)_65%,transparent)] text-[var(--cv-cream-200)]">
            <div className="text-center">
              <RefreshCw className="mx-auto mb-1 size-[1em] animate-spin" />
              <span className="font-mono text-[10px] tracking-wider">上传中…</span>
            </div>
          </div>
        )}
      </motion.div>

      {/* 上传按钮（仅 xl） */}
      {size === 'xl' && (
        <IconButton
          label="上传头像"
          variant="accent"
          size="sm"
          className="absolute -bottom-1 -right-1"
          onClick={handleClick}
          disabled={disabled || isUploading}
        >
          <Upload />
        </IconButton>
      )}

      {/* 隐藏的文件input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />
    </div>
  )
}

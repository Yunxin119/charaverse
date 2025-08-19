'use client'

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Camera, Upload, X, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
  sm: 'w-16 h-16',
  md: 'w-24 h-24',
  lg: 'w-32 h-32',
  xl: 'w-40 h-40'
}

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

    try {
      setIsUploading(true)
      
      // 创建预览URL
      const preview = URL.createObjectURL(file)
      setPreviewUrl(preview)

      // 上传文件
      const newAvatarUrl = await onUpload(file)
      
      // 清理预览URL
      URL.revokeObjectURL(preview)
      setPreviewUrl(null)
      
    } catch (error) {
      console.error('上传失败:', error)
      alert(error instanceof Error ? error.message : '上传失败，请重试')
      
      // 清理预览URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
      }
    } finally {
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

  return (
    <div className={cn('relative inline-block', className)}>
      {/* 头像显示区域 */}
      <motion.div
        whileHover={!disabled && !isUploading ? { scale: 1.05 } : {}}
        whileTap={!disabled && !isUploading ? { scale: 0.95 } : {}}
        className={cn(
          'relative group',
          sizeClasses[size],
          disabled ? 'cursor-not-allowed' : 'cursor-pointer'
        )}
        onClick={handleClick}
      >
        <Avatar className={cn('w-full h-full border-2 border-slate-200', sizeClasses[size])}>
          <AvatarImage src={displayAvatar} className="object-cover" />
          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
            {fallbackText.charAt(0)}
          </AvatarFallback>
        </Avatar>

        {/* 上传遮罩 - 只在非禁用且非上传状态时显示 */}
        {!disabled && (
          <div className={cn(
            'absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 transition-opacity duration-200',
            !isUploading && 'group-hover:opacity-100'
          )}>
            {isUploading ? (
              <RefreshCw className="w-6 h-6 text-white animate-spin" />
            ) : (
              <Camera className="w-6 h-6 text-white" />
            )}
          </div>
        )}

        {/* 加载状态 */}
        {isUploading && (
          <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
            <div className="text-center">
              <RefreshCw className="w-6 h-6 text-white animate-spin mx-auto mb-1" />
              <span className="text-xs text-white">上传中...</span>
            </div>
          </div>
        )}
      </motion.div>

      {/* 上传按钮（可选） */}
      {size === 'xl' && (
        <Button
          variant="outline"
          size="sm"
          className="absolute -bottom-2 -right-2 rounded-full w-8 h-8 p-0"
          onClick={handleClick}
          disabled={disabled || isUploading}
        >
          <Upload className="w-4 h-4" />
        </Button>
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

// 简化版本，用于表单中
export function SimpleAvatarUpload({
  currentAvatar,
  onUpload,
  className = '',
  disabled = false
}: {
  currentAvatar?: string
  onUpload: (file: File) => Promise<string>
  className?: string
  disabled?: boolean
}) {
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('图片文件不能超过10MB')
      return
    }

    try {
      setIsUploading(true)
      await onUpload(file)
    } catch (error) {
      console.error('上传失败:', error)
      alert(error instanceof Error ? error.message : '上传失败，请重试')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className={cn('flex items-center space-x-3', className)}>
      <Avatar className="w-16 h-16">
        <AvatarImage src={currentAvatar} />
        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
          头像
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1">
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
          className="w-full"
        >
          {isUploading ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              上传中...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              {currentAvatar ? '更换头像' : '上传头像'}
            </>
          )}
        </Button>
        <p className="text-xs text-slate-500 mt-1">
          支持 JPG、PNG 格式，最大 10MB
        </p>
      </div>

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

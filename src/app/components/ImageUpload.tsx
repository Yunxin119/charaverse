'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Image as ImageIcon, X, Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { compressImage, validateImageFile, type CompressedImage } from '../lib/imageUtils'

interface ImageUploadProps {
  maxImages?: number
  onImagesChange: (images: CompressedImage[]) => void
  disabled?: boolean
  className?: string
}

export function ImageUpload({ 
  maxImages = 3, 
  onImagesChange, 
  disabled = false,
  className = "" 
}: ImageUploadProps) {
  const [images, setImages] = useState<CompressedImage[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (files: FileList) => {
    if (disabled || isUploading) return

    const remainingSlots = maxImages - images.length
    const filesToProcess = Array.from(files).slice(0, remainingSlots)

    if (filesToProcess.length === 0) return

    setIsUploading(true)

    try {
      const compressedImages: CompressedImage[] = []

      for (const file of filesToProcess) {
        try {
          validateImageFile(file)
          const compressed = await compressImage(file)
          compressedImages.push(compressed)
        } catch (error) {
          console.error('处理图片失败:', error)
          alert(`处理图片 ${file.name} 失败: ${error instanceof Error ? error.message : '未知错误'}`)
        }
      }

      if (compressedImages.length > 0) {
        const newImages = [...images, ...compressedImages]
        setImages(newImages)
        onImagesChange(newImages)
      }
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemoveImage = (index: number) => {
    if (disabled) return
    
    const imageToRemove = images[index]
    URL.revokeObjectURL(imageToRemove.preview)
    
    const newImages = images.filter((_, i) => i !== index)
    setImages(newImages)
    onImagesChange(newImages)
  }

  const triggerFileSelect = () => {
    if (disabled || isUploading || images.length >= maxImages) return
    fileInputRef.current?.click()
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 图片预览网格 */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <AnimatePresence>
            {images.map((image, index) => (
              <motion.div
                key={`${image.preview}-${index}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                className="relative aspect-square group"
              >
                <div className="w-full h-full rounded-lg overflow-hidden border-2 border-slate-200">
                  <img
                    src={image.preview}
                    alt={`预览图 ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                {/* 删除按钮 */}
                {!disabled && (
                  <button
                    onClick={() => handleRemoveImage(index)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* 上传按钮 */}
      {images.length < maxImages && (
        <div className="flex items-center space-x-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={triggerFileSelect}
            disabled={disabled || isUploading || images.length >= maxImages}
            className="flex items-center space-x-2 h-8"
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ImageIcon className="w-4 h-4" />
            )}
            <span className="text-sm">
              {isUploading ? '处理中...' : `添加图片 (${images.length}/${maxImages})`}
            </span>
          </Button>

          {/* 快速添加按钮 */}
          {images.length > 0 && images.length < maxImages && (
            <button
              onClick={triggerFileSelect}
              disabled={disabled || isUploading}
              className="w-8 h-8 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center text-slate-400 hover:border-slate-400 hover:text-slate-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        multiple
        onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
        className="hidden"
      />

      {/* 提示信息 */}
      {images.length === 0 && (
        <p className="text-xs text-slate-500">
          支持JPG、PNG、WebP格式，最多{maxImages}张图片，单张不超过10MB
        </p>
      )}
    </div>
  )
}

export default ImageUpload
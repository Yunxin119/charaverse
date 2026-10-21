'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Image as ImageIcon, X, Plus, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { compressImage, validateImageFile, type CompressedImage } from '../lib/imageUtils'

interface ImageUploadProps {
  maxImages?: number
  onImagesChange: (images: CompressedImage[]) => void
  disabled?: boolean
  className?: string
}

/** Multi-image picker with a neumorphic drop zone and compressed previews. */
export function ImageUpload({
  maxImages = 3,
  onImagesChange,
  disabled = false,
  className = ''
}: ImageUploadProps) {
  const [images, setImages] = useState<CompressedImage[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isOver, setIsOver] = useState(false)
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

  const full = images.length >= maxImages
  const inactive = disabled || isUploading || full

  const triggerFileSelect = () => {
    if (inactive) return
    fileInputRef.current?.click()
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsOver(false)
    if (inactive) return
    if (e.dataTransfer.files?.length) handleFileSelect(e.dataTransfer.files)
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* 图片预览网格 */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <AnimatePresence>
            {images.map((image, index) => (
              <motion.div
                key={`${image.preview}-${index}`}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.2 }}
                className="group relative aspect-square"
              >
                <div className="neu size-full overflow-hidden rounded-cv-md p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.preview} alt={`预览图 ${index + 1}`} className="size-full rounded-[calc(var(--cv-radius-md)-4px)] object-cover" />
                </div>

                {/* 删除按钮 */}
                {!disabled && (
                  <button
                    type="button"
                    aria-label={`移除第 ${index + 1} 张图片`}
                    onClick={() => handleRemoveImage(index)}
                    className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-cv-danger text-white opacity-0 shadow-[0_6px_16px_-6px_var(--cv-danger)] transition-opacity duration-(--cv-dur-fast) group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* 快速添加格 */}
          {!full && (
            <button
              type="button"
              aria-label="添加图片"
              onClick={triggerFileSelect}
              disabled={disabled || isUploading}
              className="neu flex aspect-square items-center justify-center rounded-cv-md text-cv-fg-subtle transition-[box-shadow,color] duration-(--cv-dur-fast) ease-cv hover:text-cv-accent hover:shadow-neu-sm active:shadow-neu-in-sm disabled:opacity-50"
            >
              {isUploading ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
            </button>
          )}
        </div>
      )}

      {/* 拖放区（还没有图片时） */}
      {images.length === 0 && (
        <button
          type="button"
          onClick={triggerFileSelect}
          disabled={inactive}
          onDragOver={(e) => {
            e.preventDefault()
            if (!inactive) setIsOver(true)
          }}
          onDragLeave={() => setIsOver(false)}
          onDrop={onDrop}
          className={cn(
            'flex w-full flex-col items-center justify-center gap-2 rounded-cv-lg px-4 py-6 text-center transition-[box-shadow,color] duration-(--cv-dur) ease-cv outline-none focus-visible:ring-2 focus-visible:ring-cv-ring disabled:cursor-not-allowed disabled:opacity-60',
            isOver ? 'neu-in text-cv-accent' : 'neu text-cv-fg-muted hover:text-cv-fg'
          )}
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-cv-secondary text-cv-secondary-fg">
            {isUploading ? <Loader2 className="size-5 animate-spin" /> : <ImageIcon className="size-5" />}
          </span>
          <span className="text-sm font-semibold">{isUploading ? '处理中…' : `添加图片 (${images.length}/${maxImages})`}</span>
          <span className="text-xs text-cv-fg-subtle">支持 JPG、PNG、WebP，最多 {maxImages} 张，单张不超过 10MB</span>
        </button>
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
    </div>
  )
}

export default ImageUpload

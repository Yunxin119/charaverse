'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { IconButton, Chip } from '@/components/glass'
import { cn } from '@/lib/utils'

interface ImageViewerProps {
  images: string[]
  isOpen: boolean
  onClose: () => void
  initialIndex?: number
}

/** Fullscreen lightbox with glass chrome. Keyboard: Esc / ← / →; swipe on touch. */
export function ImageViewer({ images, isOpen, onClose, initialIndex = 0 }: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [isDragging, setIsDragging] = useState(false)

  // 重置索引当 initialIndex 改变时（render 期间调整 state，避免 effect 级联渲染）
  const [prevInitialIndex, setPrevInitialIndex] = useState(initialIndex)
  if (prevInitialIndex !== initialIndex) {
    setPrevInitialIndex(initialIndex)
    setCurrentIndex(initialIndex)
  }

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length)
  }, [images.length])

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
  }, [images.length])

  // 键盘导航
  const handleKeyPress = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return
      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case 'ArrowLeft':
          goToPrevious()
          break
        case 'ArrowRight':
          goToNext()
          break
      }
    },
    [isOpen, onClose, goToPrevious, goToNext]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [handleKeyPress])

  // 阻止背景滚动
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false)

    const swipeThreshold = 50
    const velocity = info.velocity.x

    if (info.offset.x > swipeThreshold || velocity > 500) {
      goToPrevious()
    } else if (info.offset.x < -swipeThreshold || velocity < -500) {
      goToNext()
    }
  }

  if (!isOpen || images.length === 0) return null

  const multiple = images.length > 1

  return (
    <AnimatePresence>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="图片预览"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 bg-[color-mix(in_oklab,var(--cv-ink-900)_88%,transparent)] backdrop-blur-sm"
        onClick={onClose}
      >
        {/* 顶部 chrome：计数 + 关闭 */}
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4" onClick={(e) => e.stopPropagation()}>
          <div>{multiple && <Chip tone="glass" className="font-mono tabular-nums">{currentIndex + 1} / {images.length}</Chip>}</div>
          <IconButton label="关闭" variant="glass" size="md" onClick={onClose}>
            <X />
          </IconButton>
        </div>

        {/* 导航按钮 */}
        {multiple && (
          <>
            <IconButton
              label="上一张"
              variant="glass"
              size="lg"
              onClick={(e) => {
                e.stopPropagation()
                goToPrevious()
              }}
              className="absolute inset-y-0 left-4 z-10 my-auto"
            >
              <ChevronLeft />
            </IconButton>
            <IconButton
              label="下一张"
              variant="glass"
              size="lg"
              onClick={(e) => {
                e.stopPropagation()
                goToNext()
              }}
              className="absolute inset-y-0 right-4 z-10 my-auto"
            >
              <ChevronRight />
            </IconButton>
          </>
        )}

        {/* 图片容器 */}
        <div className="flex h-full items-center justify-center p-4">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
            drag={multiple ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={handleDragEnd}
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-full max-w-full"
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[currentIndex]}
              alt={`图片 ${currentIndex + 1}`}
              draggable={false}
              className="max-h-full max-w-full rounded-cv-md object-contain shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] ring-1 ring-cv-glass-border"
              style={{ maxHeight: 'calc(100vh - 9rem)' }}
            />
          </motion.div>
        </div>

        {/* 底部缩略图导航 */}
        {multiple && (
          <div className="absolute inset-x-0 bottom-4 z-10 mx-auto w-fit max-w-full overflow-x-auto scrollbar-hide px-4" onClick={(e) => e.stopPropagation()}>
            <div className="glass-strong flex gap-2 rounded-cv-md p-2">
              {images.map((image, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={`查看第 ${index + 1} 张`}
                  aria-current={index === currentIndex || undefined}
                  onClick={() => setCurrentIndex(index)}
                  className={cn(
                    'size-12 overflow-hidden rounded-cv-sm ring-2 transition-[transform,box-shadow] duration-(--cv-dur-fast) ease-cv',
                    index === currentIndex
                      ? 'scale-110 ring-cv-accent'
                      : 'ring-transparent opacity-70 hover:opacity-100 hover:ring-cv-border-strong'
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image} alt={`缩略图 ${index + 1}`} className="size-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 手势提示 */}
        {multiple && !isDragging && (
          <p className="pointer-events-none absolute inset-x-0 bottom-24 z-10 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--cv-cream-200)] opacity-60">
            左右滑动或点击箭头切换
          </p>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

export default ImageViewer

import { supabase } from './supabase'

export interface CompressedImage {
  file: File
  preview: string
  compressed: boolean
}

/**
 * 压缩图片
 * @param file 原始图片文件
 * @param maxWidth 最大宽度，默认800px
 * @param maxHeight 最大高度，默认800px
 * @param quality 压缩质量，默认0.8
 * @returns 压缩后的图片文件和预览URL
 */
export async function compressImage(
  file: File,
  maxWidth: number = 800,
  maxHeight: number = 800,
  quality: number = 0.8
): Promise<CompressedImage> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      // 计算压缩后的尺寸
      let { width, height } = calculateDimensions(img.width, img.height, maxWidth, maxHeight)
      
      canvas.width = width
      canvas.height = height

      // 绘制压缩后的图片
      ctx?.drawImage(img, 0, 0, width, height)

      // 转换为Blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            })

            const preview = URL.createObjectURL(blob)
            
            resolve({
              file: compressedFile,
              preview,
              compressed: true
            })
          } else {
            reject(new Error('图片压缩失败'))
          }
        },
        'image/jpeg',
        quality
      )
    }

    img.onerror = () => {
      reject(new Error('图片加载失败'))
    }

    img.src = URL.createObjectURL(file)
  })
}

/**
 * 计算压缩后的尺寸，保持宽高比
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let width = originalWidth
  let height = originalHeight

  // 如果原图尺寸小于最大尺寸，则不压缩
  if (width <= maxWidth && height <= maxHeight) {
    return { width, height }
  }

  // 计算缩放比例
  const widthRatio = maxWidth / width
  const heightRatio = maxHeight / height
  const ratio = Math.min(widthRatio, heightRatio)

  width = Math.round(width * ratio)
  height = Math.round(height * ratio)

  return { width, height }
}

/**
 * 创建缩略图
 * @param file 图片文件
 * @param size 缩略图尺寸，默认150px
 * @returns 缩略图文件和预览URL
 */
export async function createThumbnail(file: File, size: number = 150): Promise<CompressedImage> {
  return compressImage(file, size, size, 0.7)
}

/**
 * 验证图片文件
 * @param file 文件
 * @returns 是否为有效的图片文件
 */
export function validateImageFile(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  const maxSize = 10 * 1024 * 1024 // 10MB

  if (!validTypes.includes(file.type)) {
    throw new Error('只支持 JPG、PNG、WebP 格式的图片')
  }

  if (file.size > maxSize) {
    throw new Error('图片大小不能超过 10MB')
  }

  return true
}

/**
 * 上传图片到 Supabase Storage
 * @param file 图片文件
 * @param path 存储路径
 * @returns 图片的公开URL
 */
export async function uploadCommentImage(file: File, commentId: string): Promise<string> {
  try {
    validateImageFile(file)

    // 压缩图片
    const compressed = await compressImage(file)
    
    // 生成文件名
    const fileExt = file.name.split('.').pop()
    const fileName = `${commentId}_${Date.now()}.${fileExt}`
    const filePath = `comment-images/${fileName}`

    // 上传到 Supabase Storage
    const { data, error } = await supabase.storage
      .from('character-assets')
      .upload(filePath, compressed.file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      throw error
    }

    // 获取公开URL
    const { data: publicData } = supabase.storage
      .from('character-assets')
      .getPublicUrl(filePath)

    return publicData.publicUrl
  } catch (error) {
    console.error('图片上传失败:', error)
    throw error
  }
}

/**
 * 删除评论图片
 * @param imageUrl 图片URL
 */
export async function deleteCommentImage(imageUrl: string): Promise<void> {
  try {
    // 从URL中提取文件路径
    const url = new URL(imageUrl)
    const filePath = url.pathname.split('/').slice(-2).join('/')

    const { error } = await supabase.storage
      .from('character-assets')
      .remove([filePath])

    if (error) {
      throw error
    }
  } catch (error) {
    console.error('删除图片失败:', error)
    throw error
  }
}

/**
 * 批量上传评论图片
 * @param files 图片文件数组
 * @param commentId 评论ID
 * @returns 图片URL数组
 */
export async function uploadCommentImages(files: File[], commentId: string): Promise<string[]> {
  const uploadPromises = files.map(file => uploadCommentImage(file, commentId))
  return Promise.all(uploadPromises)
}
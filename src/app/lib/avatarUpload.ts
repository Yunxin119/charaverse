import { supabase } from './supabase'

// 压缩图片函数
export const compressImage = (
  file: File, 
  maxWidth: number = 800, 
  maxHeight: number = 800, 
  quality: number = 0.8
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    
    img.onload = () => {
      // 计算新的尺寸（保持宽高比）
      let { width, height } = img
      
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height
          height = maxHeight
        }
      }
      
      canvas.width = width
      canvas.height = height
      
      // 绘制压缩后的图片
      ctx?.drawImage(img, 0, 0, width, height)
      
      // 转换为Blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            // 创建新的File对象
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            })
            resolve(compressedFile)
          } else {
            reject(new Error('图片压缩失败'))
          }
        },
        'image/jpeg',
        quality
      )
    }
    
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = URL.createObjectURL(file)
  })
}

// 上传头像到Supabase Storage
export const uploadAvatar = async (
  file: File, 
  bucket: string = 'avatars',
  folder: string = 'users'
): Promise<string> => {
  try {
    // 获取当前用户
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('用户未登录')
    }

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      throw new Error('请选择图片文件')
    }

    // 验证文件大小（10MB）
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('图片文件不能超过10MB')
    }

    // 压缩图片
    const compressedFile = await compressImage(file)

    // 生成唯一文件名
    const fileExt = 'jpg' // 压缩后统一为jpg
    const fileName = `${user.id}-${Date.now()}.${fileExt}`
    const filePath = `${folder}/${fileName}`

    // 上传文件到Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, compressedFile, {
        cacheControl: '3600',
        upsert: true
      })

    if (uploadError) {
      throw new Error(`上传失败: ${uploadError.message}`)
    }

    // 获取公开URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath)

    if (!urlData?.publicUrl) {
      throw new Error('获取图片URL失败')
    }

    return urlData.publicUrl
  } catch (error) {
    console.error('头像上传失败:', error)
    throw error
  }
}

// 删除旧头像
export const deleteAvatar = async (
  avatarUrl: string, 
  bucket: string = 'avatars'
): Promise<void> => {
  try {
    if (!avatarUrl) return

    // 从URL中提取文件路径
    const url = new URL(avatarUrl)
    const pathParts = url.pathname.split('/')
    const bucketIndex = pathParts.findIndex(part => part === bucket)
    
    if (bucketIndex === -1) return
    
    const filePath = pathParts.slice(bucketIndex + 1).join('/')
    
    if (filePath) {
      const { error } = await supabase.storage
        .from(bucket)
        .remove([filePath])
      
      if (error) {
        console.warn('删除旧头像失败:', error)
        // 不抛出错误，因为这不是关键操作
      }
    }
  } catch (error) {
    console.warn('删除旧头像失败:', error)
    // 不抛出错误，因为这不是关键操作
  }
}

// 更新用户资料头像
export const updateUserAvatar = async (avatarUrl: string): Promise<void> => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('用户未登录')
    }

    // 更新profiles表
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString()
      })

    if (profileError) {
      throw new Error(`更新用户资料失败: ${profileError.message}`)
    }
  } catch (error) {
    console.error('更新用户头像失败:', error)
    throw error
  }
}

// 更新角色头像
export const updateCharacterAvatar = async (
  characterId: number, 
  avatarUrl: string
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('characters')
      .update({
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', characterId)

    if (error) {
      throw new Error(`更新角色头像失败: ${error.message}`)
    }
  } catch (error) {
    console.error('更新角色头像失败:', error)
    throw error
  }
}

// 头像上传的完整流程（用户）
export const uploadUserAvatar = async (file: File): Promise<string> => {
  try {
    // 获取当前用户资料，准备删除旧头像
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single()

      // 上传新头像
      const newAvatarUrl = await uploadAvatar(file, 'avatars', 'users')
      
      // 更新用户资料
      await updateUserAvatar(newAvatarUrl)
      
      // 删除旧头像
      if (profile?.avatar_url) {
        await deleteAvatar(profile.avatar_url)
      }
      
      return newAvatarUrl
    }
    
    throw new Error('用户未登录')
  } catch (error) {
    console.error('用户头像上传失败:', error)
    throw error
  }
}

// 头像上传的完整流程（角色）
export const uploadCharacterAvatar = async (
  file: File, 
  characterId?: number
): Promise<string> => {
  try {
    // 如果有characterId，获取旧头像准备删除
    let oldAvatarUrl = ''
    if (characterId) {
      const { data: character } = await supabase
        .from('characters')
        .select('avatar_url')
        .eq('id', characterId)
        .single()
      
      oldAvatarUrl = character?.avatar_url || ''
    }

    // 上传新头像
    const newAvatarUrl = await uploadAvatar(file, 'avatars', 'characters')
    
    // 更新角色头像
    if (characterId) {
      await updateCharacterAvatar(characterId, newAvatarUrl)
    }
    
    // 删除旧头像
    if (oldAvatarUrl) {
      await deleteAvatar(oldAvatarUrl)
    }
    
    return newAvatarUrl
  } catch (error) {
    console.error('角色头像上传失败:', error)
    throw error
  }
}

// 用户Banner上传功能
export const uploadUserBanner = async (file: File): Promise<string> => {
  try {
    // 获取当前用户资料，准备删除旧banner
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('用户未登录')
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('banner_url')
      .eq('id', user.id)
      .single()

    // 压缩banner图片（横屏比例，更大尺寸）
    const compressedFile = await compressImage(file, 1200, 600, 0.85)

    // 生成唯一文件名
    const fileExt = 'jpg'
    const fileName = `banner-${user.id}-${Date.now()}.${fileExt}`
    const filePath = `banners/${fileName}`

    // 上传banner到Supabase Storage (使用avatars存储桶)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, compressedFile, {
        cacheControl: '3600',
        upsert: true
      })

    if (uploadError) {
      throw new Error(`Banner上传失败: ${uploadError.message}`)
    }

    // 获取公开URL
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)

    if (!urlData?.publicUrl) {
      throw new Error('获取Banner URL失败')
    }

    const newBannerUrl = urlData.publicUrl

    // 更新用户资料中的banner_url
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        banner_url: newBannerUrl,
        updated_at: new Date().toISOString()
      })

    if (profileError) {
      throw new Error(`更新用户Banner失败: ${profileError.message}`)
    }

    // 删除旧banner
    if (profile?.banner_url) {
      await deleteAvatar(profile.banner_url, 'avatars')
    }

    return newBannerUrl
  } catch (error) {
    console.error('用户Banner上传失败:', error)
    throw error
  }
}

// 表情包服务 - 数据访问层

import { supabase } from '@/app/lib/supabase'
import type { 
  StickerPack, 
  Sticker, 
  UserStickerUsage, 
  UserStickerFavorite,
  StickerCategory,
  StickerEmotion,
  StickerUploadData,
  StickerSearchResult,
  StickerStats
} from '@/types/sticker'

export class StickerService {
  
  // 获取所有公开的表情包合集
  static async getStickerPacks(): Promise<StickerPack[]> {
    const { data, error } = await supabase
      .from('sticker_packs')
      .select(`
        *,
        stickers:stickers(count)
      `)
      .eq('is_public', true)
      .eq('is_active', true)
      .order('sort_order', { ascending: false })
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching sticker packs:', error)
      throw error
    }
    
    return data?.map(pack => ({
      ...pack,
      sticker_count: pack.stickers?.[0]?.count || 0
    })) || []
  }
  
  // 根据分类获取表情包合集
  static async getStickerPacksByCategory(category: StickerCategory): Promise<StickerPack[]> {
    const { data, error } = await supabase
      .from('sticker_packs')
      .select(`
        *,
        stickers:stickers(count)
      `)
      .eq('category', category)
      .eq('is_public', true)
      .order('sort_order', { ascending: false })
    
    if (error) {
      console.error('Error fetching sticker packs by category:', error)
      throw error
    }
    
    return data?.map(pack => ({
      ...pack,
      sticker_count: pack.stickers?.[0]?.count || 0
    })) || []
  }
  
  // 获取表情包合集中的所有表情包
  static async getStickersInPack(packId: string): Promise<Sticker[]> {
    const { data, error } = await supabase
      .from('stickers')
      .select('*')
      .eq('pack_id', packId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    
    if (error) {
      console.error('Error fetching stickers in pack:', error)
      throw error
    }
    
    return data || []
  }
  
  // 根据情绪获取表情包
  static async getStickersByEmotion(emotions: StickerEmotion[]): Promise<Sticker[]> {
    const { data, error } = await supabase
      .from('stickers')
      .select(`
        *,
        pack:sticker_packs(*)
      `)
      .overlaps('emotions', emotions)
      .eq('is_active', true)
      .eq('sticker_packs.is_public', true)
      .order('usage_count', { ascending: false })
      .limit(50)
    
    if (error) {
      console.error('Error fetching stickers by emotion:', error)
      throw error
    }
    
    return data || []
  }
  
  // 搜索表情包
  static async searchStickers(
    query: string, 
    category?: StickerCategory,
    limit: number = 30,
    offset: number = 0
  ): Promise<StickerSearchResult> {
    let queryBuilder = supabase
      .from('stickers')
      .select(`
        *,
        pack:sticker_packs(*)
      `, { count: 'exact' })
      .eq('is_active', true)
      .eq('sticker_packs.is_public', true)
    
    // 添加分类过滤
    if (category) {
      queryBuilder = queryBuilder.eq('sticker_packs.category', category)
    }
    
    // 添加搜索条件
    if (query.trim()) {
      queryBuilder = queryBuilder.or(`
        name.ilike.%${query}%,
        keywords.cs.{${query}},
        tags.cs.{${query}}
      `)
    }
    
    const { data, error, count } = await queryBuilder
      .order('usage_count', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (error) {
      console.error('Error searching stickers:', error)
      throw error
    }
    
    return {
      stickers: data || [],
      total: count || 0,
      has_more: (count || 0) > offset + limit
    }
  }
  
  // 获取用户最近使用的表情包
  static async getRecentStickers(userId: string, limit: number = 20): Promise<UserStickerUsage[]> {
    const { data, error } = await supabase
      .from('user_sticker_usage')
      .select(`
        *,
        sticker:stickers(
          *,
          pack:sticker_packs(*)
        )
      `)
      .eq('user_id', userId)
      .order('last_used_at', { ascending: false })
      .limit(limit)
    
    if (error) {
      console.error('Error fetching recent stickers:', error)
      throw error
    }
    
    return data || []
  }
  
  // 获取用户常用的表情包
  static async getFrequentStickers(userId: string, limit: number = 20): Promise<UserStickerUsage[]> {
    const { data, error } = await supabase
      .from('user_sticker_usage')
      .select(`
        *,
        sticker:stickers(
          *,
          pack:sticker_packs(*)
        )
      `)
      .eq('user_id', userId)
      .gte('usage_count', 2) // 至少使用过2次
      .order('usage_count', { ascending: false })
      .order('last_used_at', { ascending: false })
      .limit(limit)
    
    if (error) {
      console.error('Error fetching frequent stickers:', error)
      throw error
    }
    
    return data || []
  }
  
  // 获取用户收藏的表情包
  static async getFavoriteStickers(userId: string): Promise<UserStickerFavorite[]> {
    const { data, error } = await supabase
      .from('user_sticker_favorites')
      .select(`
        *,
        sticker:stickers(
          *,
          pack:sticker_packs(*)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching favorite stickers:', error)
      throw error
    }
    
    return data || []
  }
  
  // 记录用户使用表情包
  static async recordStickerUsage(userId: string, stickerId: string): Promise<void> {
    // 使用upsert来更新或插入使用记录
    const { error: upsertError } = await supabase
      .from('user_sticker_usage')
      .upsert({
        user_id: userId,
        sticker_id: stickerId,
        usage_count: 1,
        last_used_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,sticker_id',
        ignoreDuplicates: false
      })
    
    if (upsertError) {
      // 如果upsert失败，尝试更新现有记录
      const { error: updateError } = await supabase
        .rpc('increment_sticker_usage', {
          p_user_id: userId,
          p_sticker_id: stickerId
        })
      
      if (updateError) {
        console.error('Error recording sticker usage:', updateError)
        throw updateError
      }
    }
    
    // 同时更新表情包的全局使用计数
    const { error: globalUpdateError } = await supabase
      .rpc('increment_global_sticker_usage', {
        p_sticker_id: stickerId
      })
    
    if (globalUpdateError) {
      console.error('Error updating global sticker usage:', globalUpdateError)
    }
  }
  
  // 添加表情包到收藏
  static async addStickerToFavorites(userId: string, stickerId: string): Promise<void> {
    const { error } = await supabase
      .from('user_sticker_favorites')
      .insert({
        user_id: userId,
        sticker_id: stickerId
      })
    
    if (error) {
      console.error('Error adding sticker to favorites:', error)
      throw error
    }
  }
  
  // 从收藏中移除表情包
  static async removeStickerFromFavorites(userId: string, stickerId: string): Promise<void> {
    const { error } = await supabase
      .from('user_sticker_favorites')
      .delete()
      .eq('user_id', userId)
      .eq('sticker_id', stickerId)
    
    if (error) {
      console.error('Error removing sticker from favorites:', error)
      throw error
    }
  }
  
  // 获取表情包统计数据
  static async getStickerStats(): Promise<StickerStats> {
    // 获取总数统计
    const [packsResult, stickersResult] = await Promise.all([
      supabase.from('sticker_packs').select('*', { count: 'exact', head: true }),
      supabase.from('stickers').select('*', { count: 'exact', head: true })
    ])
    
    // 获取最常用的表情包
    const { data: mostUsed } = await supabase
      .from('stickers')
      .select('*, pack:sticker_packs(*)')
      .eq('is_active', true)
      .order('usage_count', { ascending: false })
      .limit(10)
    
    // 获取最近添加的表情包
    const { data: recent } = await supabase
      .from('stickers')
      .select('*, pack:sticker_packs(*)')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(10)
    
    // 获取分类统计
    const { data: categories } = await supabase
      .from('sticker_packs')
      .select('category')
      .eq('is_public', true)
    
    const categoryStats = categories?.reduce((acc, pack) => {
      acc[pack.category] = (acc[pack.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    return {
      total_stickers: stickersResult.count || 0,
      total_packs: packsResult.count || 0,
      most_used_stickers: mostUsed || [],
      recent_stickers: recent || [],
      categories: Object.entries(categoryStats || {}).map(([category, count]) => ({
        category: category as StickerCategory,
        count
      }))
    }
  }
  
  // 管理员功能：创建表情包合集
  static async createStickerPack(pack: Omit<StickerPack, 'id' | 'created_at' | 'updated_at'>): Promise<StickerPack> {
    const { data, error } = await supabase
      .from('sticker_packs')
      .insert(pack)
      .select()
      .single()
    
    if (error) {
      console.error('Error creating sticker pack:', error)
      throw error
    }
    
    return data
  }
  
  // 管理员功能：上传表情包
  static async uploadSticker(uploadData: StickerUploadData): Promise<Sticker> {
    // 1. 上传文件到Supabase Storage
    const fileName = `${Date.now()}-${uploadData.file.name}`
    const filePath = `stickers/${fileName}`
    
    const { data: uploadResult, error: uploadError } = await supabase.storage
      .from('stickers')
      .upload(filePath, uploadData.file)
    
    if (uploadError) {
      console.error('Error uploading sticker file:', uploadError)
      throw uploadError
    }
    
    // 2. 获取公共URL
    const { data: urlData } = supabase.storage
      .from('stickers')
      .getPublicUrl(filePath)
    
    // 3. 创建表情包记录
    const stickerData = {
      pack_id: uploadData.pack_id,
      name: uploadData.name,
      filename: uploadData.file.name,
      image_url: urlData.publicUrl,
      file_size: uploadData.file.size,
      tags: uploadData.tags || [],
      emotions: uploadData.emotions || [],
      keywords: uploadData.keywords || [],
      sort_order: uploadData.sort_order || 0,
      is_active: true
    }
    
    const { data, error } = await supabase
      .from('stickers')
      .insert(stickerData)
      .select()
      .single()
    
    if (error) {
      console.error('Error creating sticker record:', error)
      throw error
    }
    
    return data
  }
  
  // 管理员功能：批量上传表情包
  static async uploadMultipleStickers(uploads: StickerUploadData[]): Promise<Sticker[]> {
    const results: Sticker[] = []
    const errors: Error[] = []
    
    for (const uploadData of uploads) {
      try {
        const sticker = await this.uploadSticker(uploadData)
        results.push(sticker)
      } catch (error) {
        console.error(`Error uploading sticker ${uploadData.name}:`, error)
        errors.push(error as Error)
      }
    }
    
    if (errors.length > 0 && results.length === 0) {
      throw new Error(`Failed to upload any stickers. First error: ${errors[0].message}`)
    }
    
    return results
  }
}

// 用于数据库函数的SQL（需要在Supabase中创建）
/*
-- 递增用户表情包使用计数的函数
CREATE OR REPLACE FUNCTION increment_sticker_usage(p_user_id UUID, p_sticker_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE user_sticker_usage 
  SET usage_count = usage_count + 1,
      last_used_at = NOW()
  WHERE user_id = p_user_id AND sticker_id = p_sticker_id;
  
  IF NOT FOUND THEN
    INSERT INTO user_sticker_usage (user_id, sticker_id, usage_count, last_used_at)
    VALUES (p_user_id, p_sticker_id, 1, NOW());
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 递增全局表情包使用计数的函数
CREATE OR REPLACE FUNCTION increment_global_sticker_usage(p_sticker_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE stickers 
  SET usage_count = usage_count + 1
  WHERE id = p_sticker_id;
END;
$$ LANGUAGE plpgsql;
*/
import { StickerService } from './stickerService'
import type { 
  Sticker, 
  StickerEmotion, 
  StickerMatch, 
  AIStickerConfig,
  StickerCategory 
} from '@/types/sticker'

export class AIStickerService {
  
  // 默认配置
  private static defaultConfig: AIStickerConfig = {
    enabled: true,
    probability: 0.3, // 30% 的概率使用表情包
    max_stickers_per_message: 1,
    emotion_weight: 0.4,
    keyword_weight: 0.3,
    usage_weight: 0.3,
    character_preferences: ['cute', 'happy', 'general']
  }

  // 情绪检测关键词映射
  private static emotionKeywords: Record<StickerEmotion, string[]> = {
    happy: ['开心', '高兴', '快乐', '愉快', '兴奋', '哈哈', '笑', '好棒', '太好了', '耶', '🙂', '😊', '😃', '😄'],
    sad: ['难过', '伤心', '悲伤', '痛苦', '失落', '沮丧', '郁闷', '哭', '呜呜', '😢', '😭', '😞', '😔'],
    angry: ['生气', '愤怒', '恼火', '烦躁', '气愤', '讨厌', '烦人', '可恶', '😠', '😡', '🤬', '💢'],
    surprised: ['惊讶', '震惊', '意外', '没想到', '哇', '天哪', '不会吧', '真的吗', '😲', '😯', '🤯', '😱'],
    excited: ['兴奋', '激动', '太棒了', '厉害', '哇塞', '超级', '棒极了', '完美', '🤩', '🎉', '✨', '🔥'],
    love: ['爱', '喜欢', '心动', '温暖', '甜蜜', '浪漫', '亲亲', '爱你', '❤️', '💕', '💖', '😍'],
    confused: ['困惑', '疑惑', '不懂', '什么', '怎么', '为什么', '奇怪', '莫名其妙', '😕', '🤔', '😵', '❓'],
    tired: ['累', '疲惫', '困', '想睡', '没力气', '疲倦', '好累', '困死了', '😴', '😪', '🥱', '💤'],
    shy: ['害羞', '不好意思', '羞羞', '脸红', '羞涩', '尴尬', '😳', '😊', '🙈', '😌'],
    cool: ['酷', '帅', '厉害', '牛', '牛逼', '棒', '强', '赞', '😎', '🆒', '👍', '💪'],
    funny: ['搞笑', '好笑', '哈哈', '逗', '有趣', '幽默', '好玩', '笑死', '😂', '🤣', '😆', '🤡'],
    cute: ['可爱', '萌', '软萌', '乖', '小可爱', '萌萌', '好萌', '😘', '🥰', '😚', '🐱'],
    neutral: ['好的', '知道了', '嗯', '哦', '是的', '明白', '收到', '👌', '😐', '😑']
  }

  // 分析消息内容，提取情绪和关键词
  static analyzeMessage(content: string): {
    emotions: StickerEmotion[]
    keywords: string[]
    intensity: number
  } {
    const detectedEmotions = new Set<StickerEmotion>()
    const keywords: string[] = []
    let emotionIntensity = 0

    // 检测情绪
    Object.entries(this.emotionKeywords).forEach(([emotion, emotionKeys]) => {
      const matchCount = emotionKeys.filter(keyword => 
        content.toLowerCase().includes(keyword.toLowerCase())
      ).length

      if (matchCount > 0) {
        detectedEmotions.add(emotion as StickerEmotion)
        emotionIntensity += matchCount
        keywords.push(...emotionKeys.filter(k => content.toLowerCase().includes(k.toLowerCase())))
      }
    })

    // 如果没有检测到情绪，默认为中性
    if (detectedEmotions.size === 0) {
      detectedEmotions.add('neutral')
    }

    // 提取其他关键词（简单的中文分词）
    const additionalKeywords = content
      .replace(/[^\u4e00-\u9fa5\u0030-\u0039\u0061-\u007a\u0041-\u005a]/g, ' ')
      .split(' ')
      .filter(word => word.length >= 2 && word.length <= 4)

    return {
      emotions: Array.from(detectedEmotions),
      keywords: [...keywords, ...additionalKeywords],
      intensity: Math.min(emotionIntensity / 3, 1) // 归一化到0-1
    }
  }

  // 为消息推荐表情包
  static async recommendStickers(
    content: string,
    userId?: string,
    config: Partial<AIStickerConfig> = {}
  ): Promise<StickerMatch[]> {
    const finalConfig = { ...this.defaultConfig, ...config }
    
    if (!finalConfig.enabled) {
      return []
    }

    // 随机决定是否使用表情包
    if (Math.random() > finalConfig.probability) {
      return []
    }

    try {
      const analysis = this.analyzeMessage(content)
      const matches: StickerMatch[] = []

      // 基于情绪搜索表情包
      for (const emotion of analysis.emotions) {
        const emotionStickers = await StickerService.getStickersByEmotion([emotion])
        
        for (const sticker of emotionStickers) {
          const score = this.calculateStickerScore(
            sticker, 
            analysis, 
            finalConfig
          )
          
          if (score > 0.1) { // 最低分数阈值
            matches.push({
              sticker,
              score,
              reasons: this.generateMatchReasons(sticker, analysis)
            })
          }
        }
      }

      // 基于关键词搜索
      if (analysis.keywords.length > 0) {
        const keywordQuery = analysis.keywords.slice(0, 3).join(' ')
        const searchResult = await StickerService.searchStickers(keywordQuery, undefined, 20, 0)
        
        for (const sticker of searchResult.stickers) {
          const existingMatch = matches.find(m => m.sticker.id === sticker.id)
          if (existingMatch) {
            existingMatch.score += 0.1 // 关键词匹配加分
            existingMatch.reasons.push('关键词匹配')
          } else {
            const score = this.calculateStickerScore(sticker, analysis, finalConfig)
            if (score > 0.05) {
              matches.push({
                sticker,
                score,
                reasons: this.generateMatchReasons(sticker, analysis)
              })
            }
          }
        }
      }

      // 根据角色偏好调整分数
      if (finalConfig.character_preferences) {
        matches.forEach(match => {
          if (finalConfig.character_preferences!.includes(match.sticker.pack?.category as StickerCategory)) {
            match.score += 0.15
            match.reasons.push('角色偏好匹配')
          }
        })
      }

      // 排序并限制数量
      matches.sort((a, b) => b.score - a.score)
      return matches.slice(0, finalConfig.max_stickers_per_message)
      
    } catch (error) {
      console.error('Error recommending stickers:', error)
      return []
    }
  }

  // 计算表情包匹配分数
  private static calculateStickerScore(
    sticker: Sticker, 
    analysis: { emotions: StickerEmotion[], keywords: string[], intensity: number },
    config: AIStickerConfig
  ): number {
    let score = 0

    // 情绪匹配分数
    const emotionMatch = sticker.emotions.some(emotion => 
      analysis.emotions.includes(emotion)
    )
    if (emotionMatch) {
      score += config.emotion_weight * analysis.intensity
    }

    // 关键词匹配分数
    const keywordMatches = analysis.keywords.filter(keyword =>
      sticker.keywords.some(sk => sk.toLowerCase().includes(keyword.toLowerCase())) ||
      sticker.tags.some(tag => tag.toLowerCase().includes(keyword.toLowerCase())) ||
      sticker.name.toLowerCase().includes(keyword.toLowerCase())
    ).length

    if (keywordMatches > 0) {
      score += config.keyword_weight * (keywordMatches / analysis.keywords.length)
    }

    // 使用频率分数（高使用频率的表情包更容易被推荐）
    const usageScore = Math.log(sticker.usage_count + 1) / 10 // 对数缩放
    score += config.usage_weight * Math.min(usageScore, 1)

    return Math.min(score, 1) // 限制在0-1范围内
  }

  // 生成匹配原因
  private static generateMatchReasons(
    sticker: Sticker,
    analysis: { emotions: StickerEmotion[], keywords: string[], intensity: number }
  ): string[] {
    const reasons: string[] = []

    // 情绪匹配
    const matchedEmotions = sticker.emotions.filter(emotion => 
      analysis.emotions.includes(emotion)
    )
    if (matchedEmotions.length > 0) {
      reasons.push(`情绪匹配: ${matchedEmotions.join(', ')}`)
    }

    // 关键词匹配
    const matchedKeywords = analysis.keywords.filter(keyword =>
      sticker.keywords.some(sk => sk.toLowerCase().includes(keyword.toLowerCase())) ||
      sticker.tags.some(tag => tag.toLowerCase().includes(keyword.toLowerCase()))
    )
    if (matchedKeywords.length > 0) {
      reasons.push(`关键词匹配: ${matchedKeywords.slice(0, 3).join(', ')}`)
    }

    // 高使用频率
    if (sticker.usage_count > 50) {
      reasons.push('热门表情包')
    }

    return reasons.length > 0 ? reasons : ['通用匹配']
  }

  // 获取用户的表情包使用习惯
  static async getUserStickerPreferences(userId: string): Promise<{
    favoriteCategories: StickerCategory[]
    favoriteEmotions: StickerEmotion[]
    recentlyUsedTags: string[]
  }> {
    try {
      // 获取用户最近使用的表情包
      const recentUsage = await StickerService.getRecentStickers(userId, 50)
      const frequentUsage = await StickerService.getFrequentStickers(userId, 30)
      const favorites = await StickerService.getFavoriteStickers(userId)

      const allUserStickers = [
        ...recentUsage.map(u => u.sticker),
        ...frequentUsage.map(u => u.sticker),
        ...favorites.map(f => f.sticker)
      ].filter(Boolean) as Sticker[]

      // 统计偏好的分类
      const categoryCount: Record<string, number> = {}
      const emotionCount: Record<string, number> = {}
      const tagCount: Record<string, number> = {}

      allUserStickers.forEach(sticker => {
        // 分类统计
        const category = sticker.pack?.category
        if (category) {
          categoryCount[category] = (categoryCount[category] || 0) + 1
        }

        // 情绪统计
        sticker.emotions.forEach(emotion => {
          emotionCount[emotion] = (emotionCount[emotion] || 0) + 1
        })

        // 标签统计
        sticker.tags.forEach(tag => {
          tagCount[tag] = (tagCount[tag] || 0) + 1
        })
      })

      // 获取前3个偏好
      const favoriteCategories = Object.entries(categoryCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([category]) => category as StickerCategory)

      const favoriteEmotions = Object.entries(emotionCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([emotion]) => emotion as StickerEmotion)

      const recentlyUsedTags = Object.entries(tagCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([tag]) => tag)

      return {
        favoriteCategories,
        favoriteEmotions,
        recentlyUsedTags
      }
    } catch (error) {
      console.error('Error getting user sticker preferences:', error)
      return {
        favoriteCategories: ['general'],
        favoriteEmotions: ['happy'],
        recentlyUsedTags: []
      }
    }
  }

  // 智能推荐表情包配置（基于用户习惯）
  static async getSmartConfig(userId: string): Promise<AIStickerConfig> {
    try {
      const preferences = await this.getUserStickerPreferences(userId)
      
      return {
        ...this.defaultConfig,
        character_preferences: preferences.favoriteCategories.length > 0 
          ? preferences.favoriteCategories 
          : this.defaultConfig.character_preferences,
        // 根据用户活跃度调整概率
        probability: preferences.recentlyUsedTags.length > 10 ? 0.4 : 0.25
      }
    } catch (error) {
      console.error('Error getting smart config:', error)
      return this.defaultConfig
    }
  }
}
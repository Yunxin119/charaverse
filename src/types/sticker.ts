// 表情包系统类型定义

export interface StickerPack {
  id: string
  name: string
  description?: string
  category: StickerCategory
  is_public: boolean
  is_default: boolean
  sort_order: number
  created_at: string
  updated_at: string
  created_by?: string
  stickers?: Sticker[] // 包含的表情包（可选）
  sticker_count?: number // 表情包数量（可选）
}

export interface Sticker {
  id: string
  pack_id: string
  name: string
  filename: string
  image_url: string
  thumbnail_url?: string
  file_size?: number
  width?: number
  height?: number
  tags: string[]
  emotions: StickerEmotion[]
  keywords: string[]
  usage_count: number
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
  pack?: StickerPack // 所属表情包（可选）
}

export interface UserStickerUsage {
  id: string
  user_id: string
  sticker_id: string
  usage_count: number
  last_used_at: string
  sticker?: Sticker // 表情包信息（可选）
}

export interface UserStickerFavorite {
  id: string
  user_id: string
  sticker_id: string
  created_at: string
  sticker?: Sticker // 表情包信息（可选）
}

// 表情包分类
export type StickerCategory = 
  | 'general'    // 通用
  | 'cute'       // 可爱
  | 'funny'      // 搞笑
  | 'happy'      // 开心
  | 'sad'        // 悲伤
  | 'angry'      // 愤怒
  | 'love'       // 爱心
  | 'surprised'  // 惊讶
  | 'cool'       // 酷炫
  | 'shy'        // 害羞
  | 'tired'      // 疲惫
  | 'confused'   // 困惑
  | 'excited'    // 兴奋
  | 'custom'     // 自定义

// 表情包情绪标签
export type StickerEmotion = 
  | 'happy'      // 开心
  | 'sad'        // 悲伤
  | 'angry'      // 愤怒
  | 'surprised'  // 惊讶
  | 'excited'    // 兴奋
  | 'love'       // 爱
  | 'confused'   // 困惑
  | 'tired'      // 疲惫
  | 'shy'        // 害羞
  | 'cool'       // 酷
  | 'funny'      // 搞笑
  | 'cute'       // 可爱
  | 'neutral'    // 中性

// 表情包选择器的配置
export interface StickerPickerConfig {
  maxRecentStickers?: number // 最多显示多少个最近使用的表情包
  maxFavoriteStickers?: number // 最多显示多少个收藏的表情包
  enableSearch?: boolean // 是否启用搜索
  enableCategories?: boolean // 是否启用分类浏览
  enableFavorites?: boolean // 是否启用收藏功能
  defaultCategory?: StickerCategory // 默认显示的分类
}

// 表情包上传数据
export interface StickerUploadData {
  name: string
  pack_id: string
  file: File
  tags?: string[]
  emotions?: StickerEmotion[]
  keywords?: string[]
  sort_order?: number
}

// 表情包搜索结果
export interface StickerSearchResult {
  stickers: Sticker[]
  total: number
  has_more: boolean
}

// 表情包统计数据
export interface StickerStats {
  total_stickers: number
  total_packs: number
  most_used_stickers: Sticker[]
  recent_stickers: Sticker[]
  categories: Array<{
    category: StickerCategory
    count: number
  }>
}

// AI表情包选择的配置
export interface AIStickerConfig {
  enabled: boolean
  probability: number // 使用表情包的概率 (0-1)
  max_stickers_per_message: number // 每条消息最多使用几个表情包
  emotion_weight: number // 情绪匹配权重
  keyword_weight: number // 关键词匹配权重
  usage_weight: number // 使用频率权重
  character_preferences?: StickerCategory[] // 角色偏好的表情包类别
}

// 表情包匹配结果
export interface StickerMatch {
  sticker: Sticker
  score: number // 匹配分数
  reasons: string[] // 匹配原因
}

// 表情包分类的显示信息
export interface StickerCategoryInfo {
  category: StickerCategory
  name: string
  description: string
  emoji: string
  color: string
}

// 预定义的分类信息
export const STICKER_CATEGORIES: Record<StickerCategory, StickerCategoryInfo> = {
  general: {
    category: 'general',
    name: '通用',
    description: '基础的表情符号',
    emoji: '😊',
    color: '#6B7280'
  },
  cute: {
    category: 'cute',
    name: '可爱',
    description: '萌萌的表情',
    emoji: '🥰',
    color: '#F472B6'
  },
  funny: {
    category: 'funny',
    name: '搞笑',
    description: '幽默搞笑的表情',
    emoji: '😂',
    color: '#FDE047'
  },
  happy: {
    category: 'happy',
    name: '开心',
    description: '表达开心的表情',
    emoji: '😄',
    color: '#4ADE80'
  },
  sad: {
    category: 'sad',
    name: '悲伤',
    description: '表达悲伤的表情',
    emoji: '😢',
    color: '#60A5FA'
  },
  angry: {
    category: 'angry',
    name: '愤怒',
    description: '表达愤怒的表情',
    emoji: '😠',
    color: '#F87171'
  },
  love: {
    category: 'love',
    name: '爱心',
    description: '表达爱意的表情',
    emoji: '💕',
    color: '#FB7185'
  },
  surprised: {
    category: 'surprised',
    name: '惊讶',
    description: '表达惊讶的表情',
    emoji: '😲',
    color: '#A78BFA'
  },
  cool: {
    category: 'cool',
    name: '酷炫',
    description: '酷炫的表情',
    emoji: '😎',
    color: '#1F2937'
  },
  shy: {
    category: 'shy',
    name: '害羞',
    description: '害羞的表情',
    emoji: '😳',
    color: '#FCA5A5'
  },
  tired: {
    category: 'tired',
    name: '疲惫',
    description: '疲惫的表情',
    emoji: '😴',
    color: '#9CA3AF'
  },
  confused: {
    category: 'confused',
    name: '困惑',
    description: '困惑的表情',
    emoji: '😕',
    color: '#D97706'
  },
  excited: {
    category: 'excited',
    name: '兴奋',
    description: '兴奋的表情',
    emoji: '🤩',
    color: '#EAB308'
  },
  custom: {
    category: 'custom',
    name: '自定义',
    description: '用户自定义表情',
    emoji: '✨',
    color: '#8B5CF6'
  }
}
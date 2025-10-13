import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types for our database
export type User = {
  id: string
  email?: string
  user_metadata?: {
    username?: string
    avatar_url?: string
  }
}

export type Profile = {
  id: string
  username?: string
  avatar_url?: string
}

// 剧本中的单个角色定义
export type ScriptCharacter = {
  id: string // 剧本内唯一ID
  name: string
  avatar_url?: string
  description?: string
  personality?: {
    traits: string[]
    speaking_style?: string
    background?: string
  }
  relationships?: {
    character_id: string
    relationship_type: string
    description: string
  }[]
}

// 主要的角色/剧本实体
export type Character = {
  id: number
  user_id: string
  name: string // 剧本名称
  avatar_url?: string // 剧本封面
  prompt_template: any
  is_public: boolean
  created_at: string
  // 新增：剧本类型和角色列表
  script_type?: 'single' | 'multi' // 单角色剧本 vs 多角色剧本
  script_characters?: ScriptCharacter[] // 剧本中包含的角色列表
}

export type ChatSession = {
  id: string
  user_id: string
  character_id: number // 剧本ID
  title?: string
  last_diary_cutoff_message_id?: number
  last_forum_cutoff_message_id?: number
  created_at: string
  // 剧本内多角色支持字段
  current_speaker_id?: string // 当前发言的剧本内角色ID
  rotation_mode?: 'manual' | 'auto'
}

export type ChatMessage = {
  id: number
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  type: 'message' | 'diary' | 'forum_post'
  created_at: string
  // 剧本内多角色支持字段
  speaker_character_id?: string // 剧本内角色ID
  speaker_type?: 'user' | 'character' | 'system'
}

export type Diary = {
  id: number
  session_id: string
  user_id: string
  content: string
  created_at: string
  updated_at: string
  source_message_id_start?: number
  source_message_id_end?: number
}

export type ChatSummary = {
  id: number
  session_id: string
  user_id: string
  content: string
  created_at: string
  updated_at: string
  start_message_id?: number
  end_message_id?: number
  original_message_count: number
  summary_method: string
  summary_level: number          // 摘要层级：1=原始摘要，2=超级摘要
  parent_summaries?: number[]    // 父摘要ID数组（用于超级摘要）
  is_active: boolean            // 摘要是否有效
  invalidated_at?: string       // 失效时间
  compressed_at?: string        // 压缩时间
}

export type PromptTemplate = {
  id: number
  user_id: string | null
  name: string
  template_type: '用户角色设定' | '注意事项' | '初始情景' | '特殊要求' | '自定义模块'
  content: Record<string, any>
  description?: string
  is_public: boolean
  usage_count: number
  created_at: string
  updated_at: string
}

// 剧本内多角色支持的新类型定义
export type ScriptChatSession = ChatSession & {
  character: Character // 关联的剧本信息
}

export type EnhancedChatMessage = ChatMessage & {
  script_character?: ScriptCharacter // 关联的剧本内角色信息
  character_name?: string // 角色名称（避免重复查询）
}

// 剧本内多角色对话上下文
export type ScriptCharacterContext = {
  session: ScriptChatSession
  script: Character
  scriptCharacters: ScriptCharacter[]
  currentSpeaker?: ScriptCharacter
  lastSpeaker?: ScriptCharacter
  speakingHistory: {
    character_id: string
    character_name: string
    last_spoke_at: string
    speak_count: number
  }[]
} 
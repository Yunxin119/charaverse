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

export type Character = {
  id: number
  user_id: string
  name: string
  avatar_url?: string
  prompt_template: any
  is_public: boolean
  created_at: string
}

export type ChatSession = {
  id: string
  user_id: string
  character_id: number
  title?: string
  last_diary_cutoff_message_id?: number
  last_forum_cutoff_message_id?: number
  created_at: string
}

export type ChatMessage = {
  id: number
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  type: 'message' | 'diary' | 'forum_post'
  created_at: string
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
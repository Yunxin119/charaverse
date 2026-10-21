export { supabase } from '@/lib/supabase/client'
export type { User } from '@supabase/supabase-js'

// Types for our database
export type Profile = {
  id: string
  username?: string
  avatar_url?: string
}

// 主要的角色/剧本实体
export type Character = {
  id: number
  user_id: string
  name: string // 剧本名称
  avatar_url?: string // 剧本封面
  prompt_template: any
  /** author skin: css / regexScripts / renderHtml (lib/skins/schema.ts) */
  skin?: Record<string, unknown>
  /** world book embedded in the card (lib/lorebook/schema.ts) */
  lorebook?: Record<string, unknown>
  /** what the public sees (plan A12); the live row is the author's private draft */
  published_snapshot?: Record<string, unknown> | null
  published_at?: string | null
  likes_count?: number
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
  updated_at?: string
  /** per-session settings (see lib/chat/settings.ts) */
  settings?: Record<string, unknown>
  parent_session_id?: string | null
  branched_from_message_id?: number | null
}

export type ChatMessage = {
  id: number
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  type: 'message' | 'diary' | 'forum_post'
  created_at: string
  /** alternative replies; content mirrors swipes[swipe_index] once populated */
  swipes?: string[]
  swipe_index?: number
  meta?: Record<string, unknown>
}

export type UserPreset = {
  id: string
  user_id: string
  name: string
  data: Record<string, unknown>
  is_default: boolean
  created_at: string
  updated_at: string
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


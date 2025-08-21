// 共享的角色类型定义

export interface CharacterBasicInfo {
  description?: string
  personality?: string
  introduction?: string
  initialMessage?: string
  keywords?: string[]
  age?: string
  gender?: string
  [key: string]: unknown
}

export interface CharacterPromptTemplate {
  basic_info?: CharacterBasicInfo
  [key: string]: unknown
}

export interface Character {
  id: number
  name: string
  avatar_url?: string
  user_id?: string
  is_public?: boolean
  likes_count?: number
  created_at?: string
  updated_at?: string
  prompt_template: CharacterPromptTemplate
}

export interface ChatMessage {
  id?: number
  session_id?: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

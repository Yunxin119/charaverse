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
  created_at: string
}

export type ChatMessage = {
  id: number
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
} 
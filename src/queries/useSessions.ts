'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase, type ChatSession, type Character } from '@/app/lib/supabase'
import { qk } from './keys'

export type SessionWithCharacter = ChatSession & { character: Pick<Character, 'id' | 'name' | 'avatar_url' | 'user_id' | 'is_public'> | null }

export function useSessions(userId: string | undefined) {
  return useQuery({
    queryKey: qk.sessions(userId ?? ''),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*, character:characters(id, name, avatar_url, user_id, is_public)')
        .eq('user_id', userId!)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as SessionWithCharacter[]
    },
  })
}

export function useSession(sessionId: string | undefined) {
  return useQuery({
    queryKey: qk.session(sessionId ?? ''),
    enabled: !!sessionId && sessionId !== 'new',
    queryFn: async () => {
      const { data, error } = await supabase.from('chat_sessions').select('*').eq('id', sessionId!).single()
      if (error) throw error
      return data as ChatSession
    },
  })
}

export function useCharacterSessions(userId: string | undefined, characterId: number | undefined) {
  return useQuery({
    queryKey: [...qk.sessions(userId ?? ''), 'character', characterId ?? 0] as const,
    enabled: !!userId && !!characterId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*, character:characters(id, name, avatar_url, user_id, is_public)')
        .eq('user_id', userId!)
        .eq('character_id', characterId!)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as SessionWithCharacter[]
    },
  })
}

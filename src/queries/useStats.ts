'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/app/lib/supabase'

export interface CharacterStats { character_id: number; session_count: number; turn_count: number }
export interface MyStats { sessions: number; turns: number; chars_typed: number; chars_received: number; characters: number; published: number; likes_received: number; memories: number }
export interface AuthorStats { characters_public: number; likes_total: number; sessions_total: number; turns_total: number; joined_at: string | null }

/** Public aggregate stats for many characters at once (explore cards, hub). */
export function useCharacterStats(ids: number[]) {
  const key = [...ids].sort((a, b) => a - b)
  return useQuery({
    queryKey: ['character-stats', key] as const,
    enabled: key.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('character_stats').select('character_id, session_count, turn_count').in('character_id', key)
      if (error) throw error
      const map = new Map<number, CharacterStats>()
      for (const r of (data ?? []) as CharacterStats[]) map.set(r.character_id, r)
      return map
    },
  })
}

export function useMyStats(userId: string | undefined) {
  return useQuery({
    queryKey: ['my-stats', userId ?? ''] as const,
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_stats')
      if (error) throw error
      return (data ?? {}) as MyStats
    },
  })
}

export function useAuthorStats(userId: string | undefined) {
  return useQuery({
    queryKey: ['author-stats', userId ?? ''] as const,
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_author_stats', { p_user_id: userId! })
      if (error) throw error
      return (data ?? {}) as AuthorStats
    },
  })
}

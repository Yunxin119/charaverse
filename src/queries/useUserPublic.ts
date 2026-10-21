'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase, type Character } from '@/app/lib/supabase'

/** Public author profile (what `/user/[id]` shows). */
export type PublicProfile = {
  id: string
  username?: string | null
  avatar_url?: string | null
  banner_url?: string | null
  bio?: string | null
  created_at?: string | null
}

/** Frozen copy of the card taken at publish time (see the `published_snapshot` migration). */
export type PublishedSnapshot = {
  name?: string
  avatar_url?: string | null
  prompt_template?: { basic_info?: { introduction?: string; description?: string; keywords?: string[] } }
}

export type AuthorPublicCharacter = Character & {
  likes_count?: number
  published_snapshot?: PublishedSnapshot | null
  published_at?: string | null
}

export const userPublicKeys = {
  profile: (id: string) => ['user-public', 'profile', id] as const,
  characters: (id: string) => ['user-public', 'characters', id] as const,
}

export function useUserProfile(id: string | undefined) {
  return useQuery({
    queryKey: userPublicKeys.profile(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, banner_url, bio, created_at')
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as PublicProfile | null
    },
  })
}

export function useUserPublicCharacters(id: string | undefined) {
  return useQuery({
    queryKey: userPublicKeys.characters(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .eq('user_id', id!)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as AuthorPublicCharacter[]
    },
  })
}

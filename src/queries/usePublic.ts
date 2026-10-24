'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, type Profile } from '@/app/lib/supabase'
import { describeTemplate, parseSnapshot, type Snapshot } from '@/components/character/snapshot'
import { qk } from './keys'

/**
 * Public-side reads (plan §3 A12): everything shown to non-owners comes from
 * `published_snapshot`; the live row is the author's private draft.
 */

export type PublicSort = 'latest' | 'likes'

export interface PublicCharacter {
  id: number
  user_id: string
  /** display fields, taken from the snapshot (falls back to the row when it is null) */
  name: string
  avatar_url: string | null
  introduction?: string
  keywords: string[]
  likes_count: number
  published_at: string | null
  created_at: string
  snapshot: Snapshot | null
}

interface PublicRow {
  id: number
  user_id: string
  name: string
  avatar_url: string | null
  prompt_template: unknown
  likes_count: number | null
  published_at: string | null
  published_snapshot: unknown
  created_at: string
}

const PUBLIC_COLUMNS = 'id, user_id, name, avatar_url, prompt_template, likes_count, published_at, published_snapshot, created_at'

export function normalizePublic(row: PublicRow): PublicCharacter {
  const snapshot = parseSnapshot(row.published_snapshot)
  const d = describeTemplate(snapshot ? snapshot.prompt_template : row.prompt_template)
  return {
    id: row.id,
    user_id: row.user_id,
    name: snapshot?.name ?? row.name,
    avatar_url: snapshot ? snapshot.avatar_url : row.avatar_url ?? null,
    introduction: d.introduction,
    keywords: d.keywords,
    likes_count: row.likes_count ?? 0,
    published_at: row.published_at,
    created_at: row.created_at,
    snapshot,
  }
}

export function usePublicCharacters(params: { q?: string; sort: PublicSort; tag?: string }) {
  const { q = '', sort, tag } = params
  return useQuery({
    queryKey: qk.publicCharacters({ sort, q: q.trim().toLowerCase(), tag: tag ?? '' }),
    queryFn: async () => {
      let query = supabase.from('characters').select(PUBLIC_COLUMNS).eq('is_public', true)
      query = sort === 'likes'
        ? query.order('likes_count', { ascending: false, nullsFirst: false }).order('published_at', { ascending: false, nullsFirst: false })
        : query.order('published_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })
      const { data, error } = await query.limit(200)
      if (error) throw error
      const list = ((data ?? []) as unknown as PublicRow[]).map(normalizePublic)
      const needle = q.trim().toLowerCase()
      return list.filter((c) => {
        if (tag && !c.keywords.includes(tag)) return false
        if (!needle) return true
        return (
          c.name.toLowerCase().includes(needle) ||
          (c.introduction ?? '').toLowerCase().includes(needle) ||
          c.keywords.some((k) => k.toLowerCase().includes(needle))
        )
      })
    },
  })
}

export interface PublicCharacterDetail extends PublicCharacter {
  author: Profile | null
}

export function usePublicCharacter(id: number | string | undefined) {
  return useQuery({
    queryKey: qk.publicCharacters({ id: String(id ?? '') }),
    enabled: id !== undefined && id !== '' && Number.isFinite(Number(id)),
    queryFn: async (): Promise<PublicCharacterDetail | null> => {
      const { data, error } = await supabase.from('characters').select(PUBLIC_COLUMNS).eq('id', Number(id)).maybeSingle()
      if (error) throw error
      if (!data) return null
      const row = data as unknown as PublicRow
      const { data: author } = await supabase.from('profiles').select('id, username, avatar_url').eq('id', row.user_id).maybeSingle()
      return { ...normalizePublic(row), author: (author as Profile | null) ?? null }
    },
  })
}

/** Like / unlike via RPC (clients cannot update other users' rows). Resolves with the new count. */
export function useToggleLike() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (characterId: number) => {
      const { data, error } = await supabase.rpc('toggle_character_like', { p_character_id: characterId })
      if (error) throw error
      return typeof data === 'number' ? data : null
    },
    onSuccess: (count, characterId) => {
      if (count === null) return
      qc.setQueriesData<PublicCharacter[] | PublicCharacterDetail | null>({ queryKey: ['characters', 'public'] }, (old) => {
        if (!old) return old
        if (Array.isArray(old)) return old.map((c) => (c.id === characterId ? { ...c, likes_count: count } : c))
        return old.id === characterId ? { ...old, likes_count: count } : old
      })
    },
  })
}

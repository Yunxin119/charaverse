'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/app/lib/supabase'
import { normalizePublic, type PublicCharacter } from './usePublic'

/**
 * Private bookmarks of public characters (table `character_favorites`, owner-only RLS).
 * `useMyFavoriteIds` is the cheap per-user set used by cards; `useFavoriteCharacters`
 * loads the full public rows for the favorites page (only characters still public).
 */

export const favoritesKey = (userId: string) => ['favorites', userId] as const

export function useMyFavoriteIds(userId: string | undefined) {
  return useQuery({
    queryKey: favoritesKey(userId ?? ''),
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<Set<number>> => {
      const { data, error } = await supabase.from('character_favorites').select('character_id').eq('user_id', userId!)
      if (error) throw error
      return new Set((data ?? []).map((r) => r.character_id as number))
    },
  })
}

export function useToggleFavorite(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ characterId, next }: { characterId: number; next: boolean }) => {
      if (!userId) throw new Error('请先登录')
      if (next) {
        const { error } = await supabase.from('character_favorites').upsert({ user_id: userId, character_id: characterId }, { onConflict: 'user_id,character_id', ignoreDuplicates: true })
        if (error) throw error
      } else {
        const { error } = await supabase.from('character_favorites').delete().eq('user_id', userId).eq('character_id', characterId)
        if (error) throw error
      }
      return next
    },
    onMutate: async ({ characterId, next }) => {
      if (!userId) return
      const key = favoritesKey(userId)
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<Set<number>>(key)
      qc.setQueryData<Set<number>>(key, (old) => {
        const s = new Set(old ?? [])
        if (next) s.add(characterId); else s.delete(characterId)
        return s
      })
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (userId && ctx?.prev) qc.setQueryData(favoritesKey(userId), ctx.prev)
    },
    onSettled: () => {
      if (userId) {
        void qc.invalidateQueries({ queryKey: favoritesKey(userId) })
        void qc.invalidateQueries({ queryKey: ['favorites', 'characters', userId] })
      }
    },
  })
}

export interface FavoriteCharacter extends PublicCharacter {
  favorited_at: string
}

/** Full public rows of the user's favorites, newest favorite first. Characters taken private are left out. */
export function useFavoriteCharacters(userId: string | undefined) {
  return useQuery({
    queryKey: ['favorites', 'characters', userId ?? ''] as const,
    enabled: !!userId,
    queryFn: async (): Promise<{ items: FavoriteCharacter[]; hidden: number }> => {
      const { data: favs, error } = await supabase
        .from('character_favorites')
        .select('character_id, created_at')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      const rows = (favs ?? []) as { character_id: number; created_at: string }[]
      if (rows.length === 0) return { items: [], hidden: 0 }
      const { data: chars, error: cErr } = await supabase
        .from('characters')
        .select('id, user_id, name, avatar_url, prompt_template, likes_count, published_at, published_snapshot, created_at')
        .in('id', rows.map((r) => r.character_id))
        .eq('is_public', true)
      if (cErr) throw cErr
      const byId = new Map((chars ?? []).map((c) => [c.id as number, normalizePublic(c as Parameters<typeof normalizePublic>[0])]))
      const items: FavoriteCharacter[] = []
      for (const r of rows) {
        const c = byId.get(r.character_id)
        if (c && c.snapshot) items.push({ ...c, favorited_at: r.created_at })
      }
      return { items, hidden: rows.length - items.length }
    },
  })
}

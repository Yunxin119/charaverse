'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, type Character } from '@/app/lib/supabase'
import { parseSnapshot, type Snapshot } from '@/components/character/snapshot'
import { qk } from './keys'

/**
 * Copies made from a public character keep `source_character_id` + `source_published_at`.
 * `useCharacterSource` loads the original (public rows only, via RLS) so the chat can show its
 * comments and offer an upgrade; `useUpgradeCharacter` overwrites the copy with the latest snapshot.
 */

export interface SourceCharacter {
  id: number
  user_id: string
  name: string
  is_public: boolean
  published_at: string | null
  release_note: string | null
  snapshot: Snapshot | null
}

export const sourceKey = (id: number) => ['character', 'source', id] as const

export function useCharacterSource(copy: Pick<Character, 'source_character_id'> | undefined) {
  const sourceId = copy?.source_character_id ?? null
  return useQuery({
    queryKey: sourceKey(sourceId ?? 0),
    enabled: sourceId != null,
    staleTime: 60_000,
    queryFn: async (): Promise<SourceCharacter | null> => {
      const { data, error } = await supabase
        .from('characters')
        .select('id, user_id, name, is_public, published_at, release_note, published_snapshot')
        .eq('id', sourceId!)
        .maybeSingle()
      if (error) throw error
      if (!data) return null // taken private or deleted: RLS hides it
      const snapshot = parseSnapshot(data.published_snapshot)
      return {
        id: data.id as number,
        user_id: data.user_id as string,
        name: snapshot?.name ?? (data.name as string),
        is_public: !!data.is_public,
        published_at: (data.published_at as string | null) ?? null,
        release_note: (data.release_note as string | null) ?? null,
        snapshot,
      }
    },
  })
}

/** True when the author has published a newer version than the copy is based on. */
export function hasCharacterUpdate(copy: Pick<Character, 'source_published_at'> | undefined, source: SourceCharacter | null | undefined): boolean {
  if (!copy || !source || !source.is_public || !source.published_at || !source.snapshot) return false
  if (!copy.source_published_at) return true
  return new Date(source.published_at).getTime() > new Date(copy.source_published_at).getTime()
}

/** Overwrite the copy's card with the source's latest snapshot. Chats, sessions and memories stay. */
export function useUpgradeCharacter(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ copyId, source }: { copyId: number; source: SourceCharacter }) => {
      if (!source.snapshot || !source.published_at) throw new Error('作者还没有发布可用的版本')
      const s = source.snapshot
      const { error } = await supabase
        .from('characters')
        .update({
          name: s.name,
          avatar_url: s.avatar_url,
          prompt_template: s.prompt_template,
          skin: s.skin ?? {},
          lorebook: s.lorebook ?? {},
          source_published_at: source.published_at,
        })
        .eq('id', copyId)
      if (error) throw error
    },
    onSuccess: (_v, { copyId }) => {
      void qc.invalidateQueries({ queryKey: qk.character(copyId) })
      if (userId) void qc.invalidateQueries({ queryKey: qk.characters(userId) })
    },
  })
}

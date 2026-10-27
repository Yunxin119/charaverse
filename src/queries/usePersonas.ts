'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/app/lib/supabase'
import type { PersonaGender } from '@/lib/personas/format'

export interface PersonaRow {
  id: string
  user_id: string
  name: string
  avatar_url: string | null
  age: string
  gender: PersonaGender
  details: string
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface PersonaInput {
  id?: string
  name: string
  avatar_url?: string | null
  age?: string
  gender?: PersonaGender
  details?: string
}

export const personaKeys = {
  all: (userId: string) => ['personas', userId] as const,
  bindings: (userId: string) => ['persona-bindings', userId] as const,
}

export function usePersonas(userId: string | undefined) {
  return useQuery({
    queryKey: personaKeys.all(userId ?? ''),
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_personas')
        .select('*')
        .eq('user_id', userId!)
        .order('is_default', { ascending: false })
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as PersonaRow[]
    },
  })
}

export function useSavePersona(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: PersonaInput) => {
      if (!userId) throw new Error('未登录')
      const name = input.name.trim()
      if (!name) throw new Error('人设需要一个名字')
      const row = { user_id: userId, name, avatar_url: input.avatar_url || null, age: (input.age ?? '').trim(), gender: input.gender ?? '', details: input.details ?? '' }
      const q = input.id
        ? supabase.from('user_personas').update(row).eq('id', input.id).select('*').single()
        : supabase.from('user_personas').insert(row).select('*').single()
      const { data, error } = await q
      if (error) throw error
      return data as PersonaRow
    },
    onSuccess: () => { if (userId) void qc.invalidateQueries({ queryKey: personaKeys.all(userId) }) },
  })
}

export function useDeletePersona(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_personas').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      if (!userId) return
      void qc.invalidateQueries({ queryKey: personaKeys.all(userId) })
      void qc.invalidateQueries({ queryKey: personaKeys.bindings(userId) })
    },
  })
}

export function useSetDefaultPersona(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('set_default_persona', { p_persona_id: id })
      if (error) throw error
    },
    onSuccess: () => { if (userId) void qc.invalidateQueries({ queryKey: personaKeys.all(userId) }) },
  })
}

/** characterId → personaId for every character this user bound a persona to. */
export function usePersonaBindings(userId: string | undefined) {
  return useQuery({
    queryKey: personaKeys.bindings(userId ?? ''),
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('persona_bindings').select('character_id, persona_id').eq('user_id', userId!)
      if (error) throw error
      const map = new Map<number, string>()
      for (const r of data ?? []) map.set(r.character_id as number, r.persona_id as string)
      return map
    },
  })
}

/** Bind (or unbind with `personaId: null`) the persona used with one character by default. */
export function useBindPersona(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ characterId, personaId }: { characterId: number; personaId: string | null }) => {
      if (!userId) throw new Error('未登录')
      const q = personaId
        ? supabase.from('persona_bindings').upsert({ user_id: userId, character_id: characterId, persona_id: personaId })
        : supabase.from('persona_bindings').delete().eq('user_id', userId).eq('character_id', characterId)
      const { error } = await q
      if (error) throw error
    },
    onMutate: async ({ characterId, personaId }) => {
      if (!userId) return
      const key = personaKeys.bindings(userId)
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<Map<number, string>>(key)
      qc.setQueryData<Map<number, string>>(key, (old) => {
        const next = new Map(old ?? [])
        if (personaId) next.set(characterId, personaId); else next.delete(characterId)
        return next
      })
      return { prev }
    },
    onError: (_e, _v, ctx) => { if (userId && ctx?.prev) qc.setQueryData(personaKeys.bindings(userId), ctx.prev) },
    onSettled: () => { if (userId) void qc.invalidateQueries({ queryKey: personaKeys.bindings(userId) }) },
  })
}

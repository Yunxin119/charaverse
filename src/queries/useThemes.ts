'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/app/lib/supabase'

export interface UserThemeRow {
  id: string
  user_id: string
  name: string
  data: Record<string, unknown>
  is_active: boolean
  created_at: string
  updated_at: string
}

const key = (userId: string) => ['themes', userId] as const

export function useUserThemes(userId: string | undefined) {
  return useQuery({
    queryKey: key(userId ?? ''),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('user_themes').select('*').eq('user_id', userId!).order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as UserThemeRow[]
    },
  })
}

export function useSaveTheme(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id?: string; name: string; data: Record<string, unknown>; is_active?: boolean }) => {
      if (!userId) throw new Error('未登录')
      if (input.is_active) await supabase.from('user_themes').update({ is_active: false }).eq('user_id', userId).eq('is_active', true)
      const row = { user_id: userId, name: input.name, data: input.data, is_active: input.is_active ?? false }
      const q = input.id
        ? supabase.from('user_themes').update(row).eq('id', input.id).select('*').single()
        : supabase.from('user_themes').insert(row).select('*').single()
      const { data, error } = await q
      if (error) throw error
      return data as UserThemeRow
    },
    onSuccess: () => { if (userId) qc.invalidateQueries({ queryKey: key(userId) }) },
  })
}

export function useSetActiveTheme(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    /** id = null deactivates all (back to built-in) */
    mutationFn: async (id: string | null) => {
      if (!userId) throw new Error('未登录')
      await supabase.from('user_themes').update({ is_active: false }).eq('user_id', userId).eq('is_active', true)
      if (id) {
        const { error } = await supabase.from('user_themes').update({ is_active: true }).eq('id', id)
        if (error) throw error
      }
    },
    onSuccess: () => { if (userId) qc.invalidateQueries({ queryKey: key(userId) }) },
  })
}

export function useDeleteTheme(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_themes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { if (userId) qc.invalidateQueries({ queryKey: key(userId) }) },
  })
}

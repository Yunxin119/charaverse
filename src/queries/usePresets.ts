'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, type UserPreset } from '@/app/lib/supabase'

const key = (userId: string) => ['presets', userId] as const

export function usePresets(userId: string | undefined) {
  return useQuery({
    queryKey: key(userId ?? ''),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_presets')
        .select('*')
        .eq('user_id', userId!)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as UserPreset[]
    },
  })
}

export function useSavePreset(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id?: string; name: string; data: Record<string, unknown>; is_default?: boolean }) => {
      if (!userId) throw new Error('未登录')
      if (input.is_default) {
        await supabase.from('user_presets').update({ is_default: false }).eq('user_id', userId).eq('is_default', true)
      }
      const row = { user_id: userId, name: input.name, data: input.data, is_default: input.is_default ?? false }
      const q = input.id
        ? supabase.from('user_presets').update(row).eq('id', input.id).select('*').single()
        : supabase.from('user_presets').insert(row).select('*').single()
      const { data, error } = await q
      if (error) throw error
      return data as UserPreset
    },
    onSuccess: () => { if (userId) qc.invalidateQueries({ queryKey: key(userId) }) },
  })
}

export function useDeletePreset(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_presets').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { if (userId) qc.invalidateQueries({ queryKey: key(userId) }) },
  })
}

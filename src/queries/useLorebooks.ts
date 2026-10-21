'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/app/lib/supabase'
import type { Lorebook } from '@/lib/lorebook/schema'

export interface LorebookRow {
  id: string
  user_id: string
  name: string
  data: Lorebook
  enabled: boolean
  created_at: string
  updated_at: string
}

export const lorebookKeys = { all: (userId: string) => ['lorebooks', userId] as const }

export function useLorebooks(userId: string | undefined) {
  return useQuery({
    queryKey: lorebookKeys.all(userId ?? ''),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('lorebooks').select('*').eq('user_id', userId!).order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as LorebookRow[]
    },
  })
}

export function useSaveLorebook(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id?: string; name: string; data: Lorebook; enabled?: boolean }) => {
      if (!userId) throw new Error('未登录')
      const row = { user_id: userId, name: input.name, data: input.data, enabled: input.enabled ?? true }
      const q = input.id
        ? supabase.from('lorebooks').update(row).eq('id', input.id).select('*').single()
        : supabase.from('lorebooks').insert(row).select('*').single()
      const { data, error } = await q
      if (error) throw error
      return data as LorebookRow
    },
    onSuccess: () => { if (userId) qc.invalidateQueries({ queryKey: lorebookKeys.all(userId) }) },
  })
}

export function useToggleLorebook(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from('lorebooks').update({ enabled }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { if (userId) qc.invalidateQueries({ queryKey: lorebookKeys.all(userId) }) },
  })
}

export function useDeleteLorebook(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lorebooks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { if (userId) qc.invalidateQueries({ queryKey: lorebookKeys.all(userId) }) },
  })
}

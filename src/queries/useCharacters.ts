'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, type Character } from '@/app/lib/supabase'
import { qk } from './keys'

export function useCharacters(userId: string | undefined) {
  return useQuery({
    queryKey: qk.characters(userId ?? ''),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .eq('user_id', userId!)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Character[]
    },
  })
}

export function useCharacter(id: number | string | undefined) {
  return useQuery({
    queryKey: qk.character(id ?? ''),
    enabled: id !== undefined && id !== '' && id !== 'new',
    queryFn: async () => {
      const { data, error } = await supabase.from('characters').select('*').eq('id', Number(id)).single()
      if (error) throw error
      return data as Character
    },
  })
}

export function useDeleteCharacter(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('characters').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: qk.characters(userId) })
    },
  })
}

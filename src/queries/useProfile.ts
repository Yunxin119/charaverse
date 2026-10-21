'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase, type Profile } from '@/app/lib/supabase'
import { qk } from './keys'

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: qk.profile(userId ?? ''),
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, username, avatar_url').eq('id', userId!).maybeSingle()
      return (data ?? null) as Profile | null
    },
  })
}

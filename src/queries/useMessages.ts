'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { supabase, type ChatMessage } from '@/app/lib/supabase'
import { qk } from './keys'

const PAGE = 40

/**
 * Newest-first pages of a session's messages (for the chat view); consumers reverse per page.
 * `pageParam` is the smallest message id already loaded (cursor).
 */
export function useMessages(sessionId: string | undefined) {
  return useInfiniteQuery({
    queryKey: qk.messages(sessionId ?? ''),
    enabled: !!sessionId && sessionId !== 'new',
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam }) => {
      let q = supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId!)
        .order('id', { ascending: false })
        .limit(PAGE)
      if (pageParam) q = q.lt('id', pageParam)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as ChatMessage[]
    },
    getNextPageParam: (last) => (last.length === PAGE ? last[last.length - 1].id : undefined),
  })
}

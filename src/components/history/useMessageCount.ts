'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/app/lib/supabase'

/** Total rows in `chat_messages` for a session (head request, no payload). */
export function useMessageCount(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['messages', sessionId ?? '', 'count'] as const,
    enabled: !!sessionId,
    queryFn: async () => {
      const { count, error } = await supabase.from('chat_messages').select('id', { count: 'exact', head: true }).eq('session_id', sessionId!)
      if (error) throw error
      return count ?? 0
    },
  })
}

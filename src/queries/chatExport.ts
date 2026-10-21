'use client'

import { supabase } from '@/app/lib/supabase'

const PAGE = 1000

export interface ExportMessageRow {
  id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
  swipes: string[] | null
  swipe_index: number | null
}

/** Every message of a session, oldest first, paged by 1000 so long chats do not hit the row cap. */
export async function fetchAllMessages(sessionId: string): Promise<ExportMessageRow[]> {
  const out: ExportMessageRow[] = []
  let after: number | null = null
  for (;;) {
    let q = supabase
      .from('chat_messages')
      .select('id, role, content, created_at, swipes, swipe_index')
      .eq('session_id', sessionId)
      .eq('type', 'message')
      .order('id', { ascending: true })
      .limit(PAGE)
    if (after !== null) q = q.gt('id', after)
    const { data, error } = await q
    if (error) throw error
    const rows = (data ?? []) as ExportMessageRow[]
    out.push(...rows)
    if (rows.length < PAGE) break
    after = rows[rows.length - 1].id
  }
  return out
}

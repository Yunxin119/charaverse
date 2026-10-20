import { supabase, type ChatSummary } from '@/app/lib/supabase'

/** Effective (layered) summaries for a session: tries the `get_effective_summaries` rpc, falls back to the table. */
export async function fetchSummaries(sessionId: string, userId: string): Promise<ChatSummary[]> {
  try {
    const { data: effectiveSummaries, error: functionError } = await supabase.rpc('get_effective_summaries', {
      p_session_id: sessionId,
      p_user_id: userId,
    })

    if (!functionError && effectiveSummaries) {
      return effectiveSummaries as ChatSummary[]
    }

    const { data: summaries, error } = await supabase
      .from('chat_summaries')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('summary_level', { ascending: false })
      .order('created_at', { ascending: true })

    if (error) return []
    return (summaries ?? []) as ChatSummary[]
  } catch {
    return []
  }
}

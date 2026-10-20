'use client'

import { useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/app/lib/supabase'
import { authedFetch } from '@/lib/authedFetch'
import type { ChatMessage } from '@/app/lib/supabase'

interface Args {
  sessionId: string
  userId: string | undefined
  characterName: string
  /** 0 disables */
  every: number
  /** connection header for the model that should write the summary */
  headers: Record<string, string> | null
  onDone?: (ok: boolean) => void
}

/**
 * After a reply lands, summarize the unsummarized tail when it is long enough.
 * Runs at most once at a time and never blocks the chat.
 */
export function useAutoSummary({ sessionId, userId, characterName, every, headers, onDone }: Args) {
  const qc = useQueryClient()
  const running = useRef(false)

  const maybeRun = useCallback(async (messages: ChatMessage[]) => {
    if (!every || !userId || !headers || running.current || messages.length === 0) return
    running.current = true
    try {
      const { data: last } = await supabase
        .from('chat_summaries')
        .select('end_message_id')
        .eq('session_id', sessionId)
        .eq('is_active', true)
        .order('end_message_id', { ascending: false })
        .limit(1)
        .maybeSingle()
      const lastEnd = last?.end_message_id ?? 0
      const pending = messages.filter((m) => m.id > lastEnd)
      if (pending.length < every) return

      const res = await authedFetch('/api/chat/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          sessionId,
          userId,
          characterName,
          startMessageId: pending[0].id,
          endMessageId: pending[pending.length - 1].id,
          useMemoryTable: true,
        }),
      })
      onDone?.(res.ok)
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ['summaries', sessionId] })
        qc.invalidateQueries({ queryKey: ['memories', sessionId] })
      }
    } catch {
      onDone?.(false)
    } finally {
      running.current = false
    }
  }, [sessionId, userId, characterName, every, headers, onDone, qc])

  return { maybeRun }
}

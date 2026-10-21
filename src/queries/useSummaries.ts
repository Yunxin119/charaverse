'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, type ChatSummary } from '@/app/lib/supabase'
import { authedFetch } from '@/lib/authedFetch'
import type { MemoryEntry } from '@/lib/memory/types'

/** `chat_summaries` row as the memory page sees it (`memory_table` is jsonb). */
export type SummaryRow = ChatSummary & { memory_table?: unknown }

export const summariesKey = (sessionId: string) => ['summaries', sessionId] as const
const memoriesKey = (sessionId: string) => ['memories', sessionId] as const

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

export function useSummaries(sessionId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: summariesKey(sessionId ?? ''),
    enabled: !!sessionId && !!userId,
    queryFn: async () => (await fetchSummaries(sessionId!, userId!)) as SummaryRow[],
  })
}

export interface GenerateSummaryArgs {
  sessionId: string
  userId: string
  startMessageId: number
  endMessageId: number
  characterName: string
  useMemoryTable?: boolean
  /** set to regenerate an existing summary in place */
  summaryId?: number
  /** connection headers from `useConnection().headersFor(model)` */
  headers: Record<string, string>
}

export interface GenerateSummaryResult {
  summary?: SummaryRow
  memories?: MemoryEntry[]
}

/** POST /api/chat/summary (generate or regenerate), then refresh summaries + memories. */
export function useGenerateSummary() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ headers, useMemoryTable = true, ...body }: GenerateSummaryArgs): Promise<GenerateSummaryResult> => {
      const res = await authedFetch('/api/chat/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers, ...(body.summaryId ? { 'x-regenerate': 'true' } : {}) },
        body: JSON.stringify({ ...body, useMemoryTable }),
      })
      const data = (await res.json().catch(() => null)) as (GenerateSummaryResult & { error?: string }) | null
      if (!res.ok) throw new Error(data?.error || `生成失败 (${res.status})`)
      return data ?? {}
    },
    onSuccess: (_r, vars) => {
      void qc.invalidateQueries({ queryKey: summariesKey(vars.sessionId) })
      void qc.invalidateQueries({ queryKey: memoriesKey(vars.sessionId) })
    },
  })
}

/** Edit a summary's text in place. */
export function useUpdateSummary() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ summaryId, userId, content }: { sessionId: string; summaryId: number; userId: string; content: string }) => {
      const { error } = await supabase
        .from('chat_summaries')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', summaryId)
        .eq('user_id', userId)
      if (error) throw new Error(error.message)
    },
    onSuccess: (_r, vars) => void qc.invalidateQueries({ queryKey: summariesKey(vars.sessionId) }),
  })
}

export interface DeleteSummaryResult {
  reverted: number
  disabled: number
}

/** Soft-delete a summary and roll its memories back one version (single Postgres transaction). */
export function useDeleteSummary() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ summaryId }: { sessionId: string; summaryId: number }): Promise<DeleteSummaryResult> => {
      const { data, error } = await supabase.rpc('delete_summary_with_rollback', { p_summary_id: summaryId })
      if (error) throw new Error(error.message)
      const row = (Array.isArray(data) ? data[0] : data) as Partial<DeleteSummaryResult> | null
      return { reverted: Number(row?.reverted ?? 0), disabled: Number(row?.disabled ?? 0) }
    },
    onSuccess: (_r, vars) => {
      void qc.invalidateQueries({ queryKey: summariesKey(vars.sessionId) })
      void qc.invalidateQueries({ queryKey: memoriesKey(vars.sessionId) })
    },
  })
}

export interface MessageRange {
  /** every message id of the session, ascending */
  ids: number[]
  count: number
  minId: number | null
  maxId: number | null
}

const PAGE = 1000

/** Message ids of a session (for coverage maths); loaded in pages of 1000. */
export function useMessageRange(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['messageRange', sessionId ?? ''],
    enabled: !!sessionId,
    queryFn: async (): Promise<MessageRange> => {
      const { count, error: countError } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sessionId!)
      if (countError) throw new Error(countError.message)
      const total = count ?? 0
      const ids: number[] = []
      for (let from = 0; from < total; from += PAGE) {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('id')
          .eq('session_id', sessionId!)
          .order('id', { ascending: true })
          .range(from, from + PAGE - 1)
        if (error) throw new Error(error.message)
        for (const row of data ?? []) ids.push(Number(row.id))
      }
      return { ids, count: ids.length, minId: ids[0] ?? null, maxId: ids[ids.length - 1] ?? null }
    },
  })
}

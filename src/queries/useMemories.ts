'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/app/lib/supabase'
import { authedFetch } from '@/lib/authedFetch'
import { memorySchema, type MemoryEntry, type MemoryInput } from '@/lib/memory/types'

export const memoriesKey = (sessionId: string) => ['memories', sessionId] as const

/** All memories of a session (enabled and disabled; the UI dims disabled ones). */
export function useMemories(sessionId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: memoriesKey(sessionId ?? ''),
    enabled: !!sessionId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_memories')
        .select('*')
        .eq('session_id', sessionId!)
        .eq('user_id', userId!)
        .order('importance', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as MemoryEntry[]
    },
  })
}

async function patchMemory(memoryId: string, updates: Partial<Pick<MemoryEntry, 'title' | 'content' | 'importance' | 'metadata' | 'is_enabled'>>): Promise<MemoryEntry> {
  const res = await authedFetch('/api/chat/memory', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memoryId, updates }),
  })
  const data = (await res.json().catch(() => null)) as { memory?: MemoryEntry; error?: string } | null
  if (!res.ok || !data?.memory) throw new Error(data?.error || `更新失败 (${res.status})`)
  return data.memory
}

export interface UpsertMemoryArgs extends MemoryInput {
  /** present → edit, absent → create */
  id?: string
}

/** Create (direct insert, `source: manual`) or edit (PATCH /api/chat/memory) a memory. */
export function useUpsertMemory(sessionId: string | undefined, userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...raw }: UpsertMemoryArgs): Promise<MemoryEntry> => {
      const values = memorySchema.parse(raw)
      if (id) return patchMemory(id, values)
      if (!sessionId || !userId) throw new Error('未登录')
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('chat_memories')
        .insert({
          id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          session_id: sessionId,
          user_id: userId,
          ...values,
          source: 'manual',
          is_enabled: true,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single()
      if (error) throw new Error(error.message)
      return data as MemoryEntry
    },
    onSuccess: () => { if (sessionId) void qc.invalidateQueries({ queryKey: memoriesKey(sessionId) }) },
  })
}

export function useDeleteMemory(sessionId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (memoryId: string) => {
      const res = await authedFetch(`/api/chat/memory?memoryId=${encodeURIComponent(memoryId)}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error || `删除失败 (${res.status})`)
      }
    },
    onSuccess: () => { if (sessionId) void qc.invalidateQueries({ queryKey: memoriesKey(sessionId) }) },
  })
}

/** Flip `is_enabled` with an optimistic cache update. */
export function useToggleMemory(sessionId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ memoryId, isEnabled }: { memoryId: string; isEnabled: boolean }) => patchMemory(memoryId, { is_enabled: isEnabled }),
    onMutate: async ({ memoryId, isEnabled }) => {
      if (!sessionId) return
      const key = memoriesKey(sessionId)
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<MemoryEntry[]>(key)
      qc.setQueryData<MemoryEntry[]>(key, (old) => old?.map((m) => (m.id === memoryId ? { ...m, is_enabled: isEnabled } : m)))
      return { prev }
    },
    onError: (_e, _v, ctx) => { if (sessionId && ctx?.prev) qc.setQueryData(memoriesKey(sessionId), ctx.prev) },
    onSettled: () => { if (sessionId) void qc.invalidateQueries({ queryKey: memoriesKey(sessionId) }) },
  })
}

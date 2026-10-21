'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, type Diary } from '@/app/lib/supabase'
import { authedFetch } from '@/lib/authedFetch'

export const diariesKey = (sessionId: string) => ['diaries', sessionId] as const

/** All diaries of a session, newest first. */
export function useDiaries(sessionId: string | undefined) {
  return useQuery({
    queryKey: diariesKey(sessionId ?? ''),
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diaries')
        .select('*')
        .eq('session_id', sessionId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Diary[]
    },
  })
}

async function diaryApi<T>(path: string, init: RequestInit, fallback: string): Promise<T> {
  const res = await authedFetch(path, init)
  const json = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(json.error || fallback)
  return json
}

/** Model connection headers from `useConnection().headersFor(model)`. */
export type ConnectionHeaders = Record<string, string>

export function useGenerateDiary(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (headers: ConnectionHeaders) => {
      const { diary } = await diaryApi<{ diary: Diary }>(
        '/api/diary/generate',
        { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ sessionId }) },
        '生成失败'
      )
      return diary
    },
    onSuccess: (diary) => {
      qc.setQueryData<Diary[]>(diariesKey(sessionId), (old) => [diary, ...(old ?? [])])
    },
  })
}

export function useRegenerateDiary(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, headers }: { id: number; headers: ConnectionHeaders }) => {
      const { diary } = await diaryApi<{ diary: Diary }>(`/api/diary/${id}/regenerate`, { method: 'POST', headers }, '重新生成失败')
      return diary
    },
    onSuccess: (diary) => {
      qc.setQueryData<Diary[]>(diariesKey(sessionId), (old) => old?.map((d) => (d.id === diary.id ? diary : d)))
    },
  })
}

export function useUpdateDiary(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, content }: { id: number; content: string }) => {
      const { diary } = await diaryApi<{ diary: Diary }>(
        `/api/diary/${id}`,
        { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) },
        '保存失败'
      )
      return diary
    },
    onSuccess: (diary) => {
      qc.setQueryData<Diary[]>(diariesKey(sessionId), (old) => old?.map((d) => (d.id === diary.id ? diary : d)))
    },
  })
}

export function useDeleteDiary(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await diaryApi<{ message: string }>(`/api/diary/${id}`, { method: 'DELETE' }, '删除失败')
      return id
    },
    onSuccess: (id) => {
      qc.setQueryData<Diary[]>(diariesKey(sessionId), (old) => old?.filter((d) => d.id !== id))
    },
  })
}

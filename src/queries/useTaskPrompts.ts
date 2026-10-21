'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/app/lib/supabase'
import { resolveSummaryTask, type SummaryTask } from '@/lib/tasks/summary'

const key = (userId: string, task: string) => ['task-prompts', userId, task] as const

export function useSummaryTask(userId: string | undefined) {
  return useQuery({
    queryKey: key(userId ?? '', 'summary'),
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from('user_task_prompts').select('data, updated_at').eq('user_id', userId!).eq('task', 'summary').maybeSingle()
      return { task: resolveSummaryTask(data?.data), isCustom: !!data, updatedAt: data?.updated_at as string | undefined }
    },
  })
}

export function useSaveSummaryTask(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (task: SummaryTask) => {
      if (!userId) throw new Error('未登录')
      const { error } = await supabase.from('user_task_prompts').upsert({ user_id: userId, task: 'summary', data: task }, { onConflict: 'user_id,task' })
      if (error) throw error
    },
    onSuccess: () => { if (userId) qc.invalidateQueries({ queryKey: key(userId, 'summary') }) },
  })
}

export function useResetSummaryTask(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('未登录')
      const { error } = await supabase.from('user_task_prompts').delete().eq('user_id', userId).eq('task', 'summary')
      if (error) throw error
    },
    onSuccess: () => { if (userId) qc.invalidateQueries({ queryKey: key(userId, 'summary') }) },
  })
}

'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, type PromptTemplate } from '@/app/lib/supabase'
import { deletePromptTemplate, savePromptTemplate, updatePromptTemplate } from '@/app/lib/promptTemplates'

export type TemplateScope = 'mine' | 'public' | 'system'

export const TEMPLATE_TYPES: PromptTemplate['template_type'][] = ['用户角色设定', '注意事项', '初始情景', '特殊要求', '自定义模块']

export const templateKeys = {
  all: ['templates'] as const,
  list: (scope: TemplateScope, userId: string) => ['templates', scope, userId] as const,
}

/**
 * - mine:   the signed-in user's own templates
 * - public: templates other users published
 * - system: built-in rows (`user_id IS NULL`)
 */
export function useTemplates(scope: TemplateScope, userId: string | undefined) {
  return useQuery({
    queryKey: templateKeys.list(scope, userId ?? ''),
    enabled: scope === 'system' || !!userId,
    queryFn: async () => {
      let q = supabase.from('prompt_templates').select('*')
      if (scope === 'mine') q = q.eq('user_id', userId!)
      else if (scope === 'public') q = q.eq('is_public', true).not('user_id', 'is', null).neq('user_id', userId!)
      else q = q.is('user_id', null)
      const { data, error } = await q.order(scope === 'mine' ? 'created_at' : 'usage_count', { ascending: false })
      if (error) throw error
      return (data ?? []) as PromptTemplate[]
    },
  })
}

export type TemplateInput = {
  name: string
  template_type: PromptTemplate['template_type']
  description?: string
  content: Record<string, unknown>
  is_public: boolean
}

/** Create (no `id`) or update (`id` set) a template, then refresh every template list. */
export function useSaveTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: TemplateInput & { id?: number }) => {
      if (id !== undefined) {
        // template_type is fixed after creation (same rule as the old page)
        const { name, description, content, is_public } = input
        return updatePromptTemplate(id, { name, description, content, is_public })
      }
      return savePromptTemplate(input)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: templateKeys.all }),
  })
}

export function useDeleteTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deletePromptTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: templateKeys.all }),
  })
}

/** Pull the editable text out of the jsonb `content` (old rows used `{ content }`, some `{ text }`). */
export function templateContentText(content: PromptTemplate['content'] | string | null | undefined): string {
  if (content == null) return ''
  if (typeof content === 'string') return content
  if (typeof content === 'object') {
    const c = content as Record<string, unknown>
    if (typeof c.content === 'string') return c.content
    if (typeof c.text === 'string') return c.text
    try {
      return JSON.stringify(content, null, 2)
    } catch {
      return ''
    }
  }
  return String(content)
}

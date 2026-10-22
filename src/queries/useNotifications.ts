'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/app/lib/supabase'

/**
 * In-app inbox (table `notifications`, owner-only RLS, rows written by DB triggers).
 * `useUnreadNotificationCount` powers the nav badge; `useNotifications` the inbox page.
 */

export type NotificationKind = 'reply' | 'comment'

export interface NotificationRow {
  id: number
  kind: NotificationKind
  actor_id: string | null
  character_id: number | null
  comment_id: number | null
  read_at: string | null
  created_at: string
}

export interface NotificationItem extends NotificationRow {
  actor: { username?: string; avatar_url?: string } | null
  character_name: string | null
  /** the comment that triggered it (null when it was deleted) */
  comment: { content: string; parent_id: number | null } | null
}

export const notificationsKey = (userId: string) => ['notifications', userId] as const
export const unreadKey = (userId: string) => ['notifications', userId, 'unread'] as const

export function useUnreadNotificationCount(userId: string | undefined) {
  return useQuery({
    queryKey: unreadKey(userId ?? ''),
    enabled: !!userId,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId!)
        .is('read_at', null)
      if (error) throw error
      return count ?? 0
    },
  })
}

export function useNotifications(userId: string | undefined, limit = 60) {
  return useQuery({
    queryKey: notificationsKey(userId ?? ''),
    enabled: !!userId,
    queryFn: async (): Promise<NotificationItem[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, kind, actor_id, character_id, comment_id, read_at, created_at')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      const rows = (data ?? []) as NotificationRow[]
      if (rows.length === 0) return []

      const actorIds = Array.from(new Set(rows.map((r) => r.actor_id).filter((x): x is string => !!x)))
      const charIds = Array.from(new Set(rows.map((r) => r.character_id).filter((x): x is number => x != null)))
      const commentIds = Array.from(new Set(rows.map((r) => r.comment_id).filter((x): x is number => x != null)))
      const [actors, chars, comments] = await Promise.all([
        actorIds.length ? supabase.from('profiles').select('id, username, avatar_url').in('id', actorIds) : Promise.resolve({ data: [] }),
        charIds.length ? supabase.from('characters').select('id, name').in('id', charIds) : Promise.resolve({ data: [] }),
        commentIds.length ? supabase.from('character_comments').select('id, content, parent_id').in('id', commentIds) : Promise.resolve({ data: [] }),
      ])
      const actorBy = new Map((actors.data ?? []).map((p) => [p.id as string, p as { username?: string; avatar_url?: string }]))
      const charBy = new Map((chars.data ?? []).map((c) => [c.id as number, c.name as string]))
      const commentBy = new Map((comments.data ?? []).map((c) => [c.id as number, { content: c.content as string, parent_id: (c.parent_id as number | null) ?? null }]))
      return rows.map((r) => ({
        ...r,
        actor: r.actor_id ? actorBy.get(r.actor_id) ?? null : null,
        character_name: r.character_id != null ? charBy.get(r.character_id) ?? null : null,
        comment: r.comment_id != null ? commentBy.get(r.comment_id) ?? null : null,
      }))
    },
  })
}

/** Mark every unread notification as read (called when the inbox is opened). */
export function useMarkAllNotificationsRead(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      if (!userId) return
      const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null)
      if (error) throw error
    },
    onSuccess: () => {
      if (!userId) return
      qc.setQueryData(unreadKey(userId), 0)
      qc.setQueryData<NotificationItem[]>(notificationsKey(userId), (old) => old?.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })))
    },
  })
}

export function useDeleteNotification(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('notifications').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_v, id) => {
      if (!userId) return
      qc.setQueryData<NotificationItem[]>(notificationsKey(userId), (old) => old?.filter((n) => n.id !== id))
      void qc.invalidateQueries({ queryKey: unreadKey(userId) })
    },
  })
}

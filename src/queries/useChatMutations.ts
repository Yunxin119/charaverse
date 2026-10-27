'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, type ChatMessage, type ChatSession } from '@/app/lib/supabase'
import { authedFetch } from '@/lib/authedFetch'
import type { SessionSettings } from '@/lib/chat/settings'
import { parseCharacterCard } from '@/lib/chat/characterCard'
import { qk } from './keys'

function useInvalidateMessages(sessionId: string) {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: qk.messages(sessionId) })
}

export function useEditMessage(sessionId: string) {
  const invalidate = useInvalidateMessages(sessionId)
  return useMutation({
    mutationFn: async ({ message, content }: { message: ChatMessage; content: string }) => {
      const patch: Record<string, unknown> = { content }
      if (message.swipes && message.swipes.length > 0) {
        const swipes = [...message.swipes]
        swipes[message.swipe_index ?? 0] = content
        patch.swipes = swipes
      }
      const { error } = await supabase.from('chat_messages').update(patch).eq('id', message.id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useDeleteMessages(sessionId: string) {
  const invalidate = useInvalidateMessages(sessionId)
  return useMutation({
    mutationFn: async (ids: number[]) => {
      if (!ids.length) return
      const { error } = await supabase.from('chat_messages').delete().in('id', ids)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

/** Delete a message and everything after it (used by "resend from here"). */
export function useDeleteFrom(sessionId: string) {
  const invalidate = useInvalidateMessages(sessionId)
  return useMutation({
    mutationFn: async (fromId: number) => {
      const { error } = await supabase.from('chat_messages').delete().eq('session_id', sessionId).gte('id', fromId)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useSelectSwipe(sessionId: string) {
  const invalidate = useInvalidateMessages(sessionId)
  return useMutation({
    mutationFn: async ({ messageId, index }: { messageId: number; index: number }) => {
      const { error } = await supabase.rpc('select_message_swipe', { p_message_id: messageId, p_index: index })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

/**
 * Drop one alternate reply of a message. The chosen one follows the surviving list;
 * when a single reply remains, `swipes` goes back to `[]` (the "no alternates" shape
 * `append_message_swipe` expects).
 */
export function useDeleteSwipe(sessionId: string) {
  const invalidate = useInvalidateMessages(sessionId)
  return useMutation({
    mutationFn: async ({ message, index }: { message: ChatMessage; index: number }) => {
      const swipes = message.swipes ?? []
      if (swipes.length < 2 || index < 0 || index >= swipes.length) throw new Error('没有可删除的备选回复')
      const rest = swipes.filter((_, i) => i !== index)
      const current = message.swipe_index ?? 0
      const nextIndex = Math.min(rest.length - 1, current > index ? current - 1 : current === index ? Math.min(index, rest.length - 1) : current)
      const patch = rest.length > 1
        ? { swipes: rest, swipe_index: nextIndex, content: rest[nextIndex] }
        : { swipes: [], swipe_index: 0, content: rest[0] }
      const { error } = await supabase.from('chat_messages').update(patch).eq('id', message.id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useUpdateSessionSettings(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Partial<SessionSettings>) => {
      const current = qc.getQueryData<ChatSession>(qk.session(sessionId))
      const merged = { ...(current?.settings ?? {}), ...patch }
      const { error } = await supabase.from('chat_sessions').update({ settings: merged }).eq('id', sessionId)
      if (error) throw error
      return merged
    },
    onSuccess: (merged) => {
      qc.setQueryData<ChatSession>(qk.session(sessionId), (old) => (old ? { ...old, settings: merged } : old))
    },
  })
}

export function useUpdateSessionTitle(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (title: string) => {
      const { error } = await supabase.from('chat_sessions').update({ title }).eq('id', sessionId)
      if (error) throw error
      return title
    },
    onSuccess: (title) => {
      qc.setQueryData<ChatSession>(qk.session(sessionId), (old) => (old ? { ...old, title } : old))
    },
  })
}

export function useBranchSession() {
  return useMutation({
    mutationFn: async ({ sessionId, messageId }: { sessionId: string; messageId: number }) => {
      const res = await authedFetch('/api/chat/branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, messageId }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || '创建分支失败')
      return j.newSessionId as string
    },
  })
}

/**
 * Find the latest session for (user, character) or create one. If a brand-new session
 * is created and the card has an opening line, it is inserted as the first assistant message.
 * Returns { sessionId, created, needsOpening } — needsOpening means the AI must speak first.
 */
export function useStartSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, characterId, forceNew = false }: { userId: string; characterId: number; forceNew?: boolean }) => {
      if (!forceNew) {
        const { data: existing } = await supabase
          .from('chat_sessions')
          .select('id')
          .eq('user_id', userId)
          .eq('character_id', characterId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (existing) return { sessionId: existing.id as string, created: false, needsOpening: false }
      }
      const { data: character, error: cErr } = await supabase
        .from('characters')
        .select('name, prompt_template')
        .eq('id', characterId)
        .single()
      if (cErr || !character) throw new Error('找不到角色')
      const { data: session, error } = await supabase
        .from('chat_sessions')
        .insert({ user_id: userId, character_id: characterId, title: `与${character.name}的对话`, settings: {} })
        .select('id')
        .single()
      if (error || !session) throw error ?? new Error('创建会话失败')
      const greetings = parseCharacterCard(character).greetings
      if (greetings.length) {
        await supabase.from('chat_messages').insert({
          session_id: session.id, role: 'assistant', content: greetings[0], type: 'message',
          ...(greetings.length > 1 ? { swipes: greetings, swipe_index: 0 } : {}),
        })
      }
      return { sessionId: session.id as string, created: true, needsOpening: greetings.length === 0 }
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: qk.sessions(vars.userId) })
    },
  })
}

/** Rename / delete a session; invalidates every sessions list of that user. */
export function useRenameSession(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sessionId, title }: { sessionId: string; title: string }) => {
      const { error } = await supabase.from('chat_sessions').update({ title: title.trim() || null }).eq('id', sessionId)
      if (error) throw error
    },
    onSuccess: (_r, v) => {
      if (userId) qc.invalidateQueries({ queryKey: qk.sessions(userId) })
      qc.invalidateQueries({ queryKey: qk.session(v.sessionId) })
    },
  })
}

export function useDeleteSession(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase.from('chat_sessions').delete().eq('id', sessionId)
      if (error) throw error
    },
    onSuccess: () => { if (userId) qc.invalidateQueries({ queryKey: qk.sessions(userId) }) },
  })
}

'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/app/lib/supabase'
import type { ImportedChat } from '@/lib/chatlog/format'
import { qk } from './keys'

const BATCH = 200

function validTimestamp(s: string | undefined): string | null {
  if (!s) return null
  const t = Date.parse(s)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

/**
 * Create a new session for `characterId` and fill it with an imported chat log.
 * Resolves to the new session id; the character hub navigates there.
 */
export function useChatImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, characterId, chat }: { userId: string; characterId: number; chat: ImportedChat }) => {
      const title = chat.title?.trim() || `导入 · ${new Date().toLocaleDateString('zh-CN')}`
      const userName = typeof chat.settings?.userName === 'string' ? chat.settings.userName : chat.userName
      const settings = userName ? { userName: userName.slice(0, 60) } : {}

      const { data: session, error } = await supabase
        .from('chat_sessions')
        .insert({ user_id: userId, character_id: characterId, title: title.slice(0, 200), settings })
        .select('id')
        .single()
      if (error || !session) throw error ?? new Error('创建会话失败')
      const sessionId = session.id as string

      const now = Date.now()
      const rows = chat.messages.map((m, i) => ({
        session_id: sessionId,
        role: m.role,
        content: m.content,
        type: 'message' as const,
        created_at: validTimestamp(m.created_at) ?? new Date(now + i).toISOString(),
        ...(m.swipes && m.swipes.length > 1
          ? { swipes: m.swipes, swipe_index: Math.max(0, Math.min(m.swipes.length - 1, m.swipe_index ?? 0)) }
          : {}),
      }))
      for (let i = 0; i < rows.length; i += BATCH) {
        const { error: mErr } = await supabase.from('chat_messages').insert(rows.slice(i, i + BATCH))
        if (mErr) {
          // keep the DB tidy: a half-imported session is worse than none
          await supabase.from('chat_sessions').delete().eq('id', sessionId)
          throw mErr
        }
      }
      return { sessionId, count: rows.length }
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: qk.sessions(vars.userId) })
    },
  })
}

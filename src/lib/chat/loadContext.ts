import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { BUILTIN_DEFAULT_PRESET, parsePreset, type PresetFile } from '@/lib/prompt/presets'
import { parseCharacterCard, type CharacterCard } from './characterCard'
import { formatMemoryTable, type MemoryRow } from './memoryTable'
import { parseSessionSettings, type SessionSettings } from './settings'

export interface HistoryMessage {
  id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

export interface ChatContext {
  session: { id: string; user_id: string; character_id: number; title: string | null; settings: SessionSettings }
  character: { id: number; name: string; prompt_template: unknown }
  card: CharacterCard
  preset: PresetFile
  history: HistoryMessage[]
  summaries: string[]
  memoryTable: string
}

export class ContextError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

const HISTORY_FETCH_LIMIT = 300

/** Load everything the prompt needs for one session, as the signed-in user (RLS applies). */
export async function loadChatContext(supabase: SupabaseClient, sessionId: string, userId: string): Promise<ChatContext> {
  const { data: session, error: sErr } = await supabase
    .from('chat_sessions')
    .select('id, user_id, character_id, title, settings')
    .eq('id', sessionId)
    .single()
  if (sErr || !session) throw new ContextError(404, '找不到会话')
  if (session.user_id !== userId) throw new ContextError(403, '无权访问该会话')
  const settings = parseSessionSettings(session.settings)

  const { data: character, error: cErr } = await supabase
    .from('characters')
    .select('id, name, prompt_template')
    .eq('id', session.character_id)
    .single()
  if (cErr || !character) throw new ContextError(404, '找不到角色')

  const [preset, historyRows, summaries, memoryRows] = await Promise.all([
    loadPreset(supabase, userId, settings.presetId ?? null),
    supabase
      .from('chat_messages')
      .select('id, role, content, created_at')
      .eq('session_id', sessionId)
      .eq('type', 'message')
      .order('id', { ascending: false })
      .limit(HISTORY_FETCH_LIMIT)
      .then(({ data }) => ((data ?? []) as HistoryMessage[]).reverse()),
    settings.context.useSummaries ? loadSummaries(supabase, sessionId, userId) : Promise.resolve([] as string[]),
    settings.context.useMemory
      ? supabase
          .from('chat_memories')
          .select('type, title, content, importance, metadata')
          .eq('session_id', sessionId)
          .eq('user_id', userId)
          .eq('is_enabled', true)
          .gte('importance', 5)
          .order('importance', { ascending: false })
          .limit(80)
          .then(({ data }) => (data ?? []) as MemoryRow[])
      : Promise.resolve([] as MemoryRow[]),
  ])

  return {
    session: { ...session, settings },
    character,
    card: parseCharacterCard(character),
    preset,
    history: historyRows,
    summaries,
    memoryTable: formatMemoryTable(memoryRows),
  }
}

async function loadPreset(supabase: SupabaseClient, userId: string, presetId: string | null): Promise<PresetFile> {
  let q = supabase.from('user_presets').select('data').eq('user_id', userId)
  q = presetId ? q.eq('id', presetId) : q.eq('is_default', true)
  const { data } = await q.limit(1).maybeSingle()
  if (data?.data) {
    const r = parsePreset(data.data)
    if (r.ok) return r.preset
  }
  return BUILTIN_DEFAULT_PRESET
}

async function loadSummaries(supabase: SupabaseClient, sessionId: string, userId: string): Promise<string[]> {
  const { data: effective, error } = await supabase.rpc('get_effective_summaries', { p_session_id: sessionId, p_user_id: userId })
  if (!error && Array.isArray(effective)) return effective.map((s: { content: string }) => s.content).filter(Boolean)
  const { data } = await supabase
    .from('chat_summaries')
    .select('content')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('summary_level', { ascending: false })
    .order('created_at', { ascending: true })
  return (data ?? []).map((s) => s.content).filter(Boolean)
}

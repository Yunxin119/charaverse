import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/server/auth'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/server/rateLimit'
import { CONNECTION_HEADER, decodeConnection } from '@/lib/llm/connection'
import { conversationTurns, diaryErrorResponse, writeDiary, type SourceMessage } from '../_lib/diary'

const MIN_NEW_MESSAGES = 3

/**
 * POST /api/diary/generate  { sessionId }
 * Writes a diary entry for everything after the last diary's `source_message_id_end`.
 * Returns { diary, message }.
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  const { user, supabase } = auth
  const limited = await enforceRateLimit(supabase, user.id, RATE_LIMITS.diary)
  if (limited) return limited

  const connection = decodeConnection(request.headers.get(CONNECTION_HEADER))
  if (!connection) return NextResponse.json({ error: '没有可用的模型连接，请先在设置里配置 API' }, { status: 400 })

  let sessionId: string | undefined
  try {
    const body = (await request.json()) as { sessionId?: unknown }
    sessionId = typeof body.sessionId === 'string' ? body.sessionId : undefined
  } catch {
    return NextResponse.json({ error: '请求参数不合法' }, { status: 400 })
  }
  if (!sessionId) return NextResponse.json({ error: '缺少必需参数' }, { status: 400 })

  try {
    const { data: session } = await supabase
      .from('chat_sessions')
      .select('id, character_id')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!session) return NextResponse.json({ error: '会话不存在或无权限访问' }, { status: 404 })

    const { data: character } = await supabase
      .from('characters')
      .select('name, prompt_template')
      .eq('id', session.character_id)
      .maybeSingle()
    if (!character) return NextResponse.json({ error: '角色信息获取失败' }, { status: 404 })

    // incremental range: continue after the most recent diary's last source message
    const { data: lastDiary } = await supabase
      .from('diaries')
      .select('source_message_id_end')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const startAfter = lastDiary?.source_message_id_end ?? 0

    const { data: rows, error: messagesError } = await supabase
      .from('chat_messages')
      .select('id, role, content')
      .eq('session_id', sessionId)
      .gt('id', startAfter)
      .order('id', { ascending: true })
    if (messagesError) return NextResponse.json({ error: '获取聊天消息失败' }, { status: 500 })

    const messages = conversationTurns((rows ?? []) as SourceMessage[])
    if (messages.length < MIN_NEW_MESSAGES) {
      return NextResponse.json({ error: `对话内容不足，至少需要${MIN_NEW_MESSAGES}条新消息才能生成日记` }, { status: 400 })
    }

    const content = await writeDiary(connection, character, messages)

    const { data: diary, error: insertError } = await supabase
      .from('diaries')
      .insert({
        session_id: sessionId,
        user_id: user.id,
        content,
        source_message_id_start: messages[0].id,
        source_message_id_end: messages[messages.length - 1].id,
      })
      .select()
      .single()
    if (insertError || !diary) return NextResponse.json({ error: '保存日记失败' }, { status: 500 })

    return NextResponse.json({ diary, message: '日记生成成功' })
  } catch (error) {
    return diaryErrorResponse(error)
  }
}

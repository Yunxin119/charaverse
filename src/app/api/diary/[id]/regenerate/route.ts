import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/server/auth'
import { connectionFromRequest } from '@/lib/llm/legacyHeaders'
import { conversationTurns, diaryErrorResponse, writeDiary, type SourceMessage } from '../../_lib/diary'

/**
 * POST /api/diary/[id]/regenerate
 * Rewrites one diary from the same source message range. Returns { diary, message }.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request)
  if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  const { user, supabase } = auth

  const connection = connectionFromRequest(request.headers)
  if (!connection) return NextResponse.json({ error: '没有可用的模型连接，请先在设置里配置 API' }, { status: 400 })

  const { id } = await params
  const diaryId = Number(id)
  if (!Number.isInteger(diaryId)) return NextResponse.json({ error: '日记 id 不合法' }, { status: 400 })

  try {
    const { data: diary } = await supabase
      .from('diaries')
      .select('id, session_id, source_message_id_start, source_message_id_end')
      .eq('id', diaryId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!diary) return NextResponse.json({ error: '日记不存在或无权限访问' }, { status: 404 })

    const { data: session } = await supabase
      .from('chat_sessions')
      .select('id, character_id')
      .eq('id', diary.session_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!session) return NextResponse.json({ error: '会话不存在或无权限访问' }, { status: 404 })

    const { data: character } = await supabase
      .from('characters')
      .select('name, prompt_template')
      .eq('id', session.character_id)
      .maybeSingle()
    if (!character) return NextResponse.json({ error: '角色信息获取失败' }, { status: 404 })

    let q = supabase
      .from('chat_messages')
      .select('id, role, content')
      .eq('session_id', diary.session_id)
      .gte('id', diary.source_message_id_start ?? 0)
      .order('id', { ascending: true })
    if (diary.source_message_id_end != null) q = q.lte('id', diary.source_message_id_end)
    const { data: rows, error: messagesError } = await q
    if (messagesError) return NextResponse.json({ error: '获取聊天消息失败' }, { status: 500 })

    const messages = conversationTurns((rows ?? []) as SourceMessage[])
    if (messages.length === 0) return NextResponse.json({ error: '找不到对应的聊天消息' }, { status: 404 })

    const content = await writeDiary(connection, character, messages)

    const { data: updated, error: updateError } = await supabase
      .from('diaries')
      .update({ content })
      .eq('id', diaryId)
      .eq('user_id', user.id)
      .select()
      .single()
    if (updateError || !updated) return NextResponse.json({ error: '更新日记失败' }, { status: 500 })

    return NextResponse.json({ diary: updated, message: '日记重新生成成功' })
  } catch (error) {
    return diaryErrorResponse(error)
  }
}

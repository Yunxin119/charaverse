import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '缺少认证token' }, { status: 401 })
    }
    
    const accessToken = authHeader.replace('Bearer ', '')
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '用户身份验证失败' }, { status: 401 })
    }

    const { sessionId, messageId } = await request.json()

    if (!sessionId || !messageId) {
      return NextResponse.json({ error: '缺少必需参数' }, { status: 400 })
    }

    // 1. 获取源会话信息
    const { data: sourceSession, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !sourceSession) {
      return NextResponse.json({ error: '找不到源会话' }, { status: 404 })
    }

    // 2. 创建新会话
    // 注意：这里假设数据库没有 (user_id, character_id) 的唯一约束，或者我们允许创建多个
    const { data: newSession, error: createError } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: user.id,
        character_id: sourceSession.character_id,
        title: `${sourceSession.title || 'Chat'} (分支)`,
        // 如果表中有 parent_session_id 字段，可以在这里添加
        // parent_session_id: sessionId 
      })
      .select()
      .single()

    if (createError) {
      console.error('创建新会话失败:', createError)
      return NextResponse.json({ error: '创建新会话失败' }, { status: 500 })
    }

    // 3. 获取要复制的消息
    // 获取直到指定messageId的所有消息
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .lte('id', messageId)
      .order('created_at', { ascending: true })

    if (messagesError) {
      console.error('获取消息失败:', messagesError)
      // 回滚：删除新创建的会话
      await supabase.from('chat_sessions').delete().eq('id', newSession.id)
      return NextResponse.json({ error: '获取消息失败' }, { status: 500 })
    }

    if (!messages || messages.length === 0) {
       // 回滚
       await supabase.from('chat_sessions').delete().eq('id', newSession.id)
       return NextResponse.json({ error: '没有找到要复制的消息' }, { status: 404 })
    }

    // 4. 准备批量插入的消息数据
    const messagesToInsert = messages.map(msg => ({
      session_id: newSession.id,
      role: msg.role,
      content: msg.content,
      type: msg.type,
      // 我们可以选择保留原有的created_at，或者让数据库生成新的
      // 保留原有时间戳可以保持对话的时间线感
      created_at: msg.created_at,
      // 如果有其他字段需要复制，请在这里添加
      // 注意：不要复制 id，让数据库自动生成
    }))

    // 5. 批量插入消息
    const { error: insertError } = await supabase
      .from('chat_messages')
      .insert(messagesToInsert)

    if (insertError) {
      console.error('复制消息失败:', insertError)
      // 回滚
      await supabase.from('chat_sessions').delete().eq('id', newSession.id)
      return NextResponse.json({ error: '复制消息失败' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      newSessionId: newSession.id,
      message: '分支创建成功' 
    })

  } catch (error) {
    console.error('创建分支失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器内部错误' },
      { status: 500 }
    )
  }
}

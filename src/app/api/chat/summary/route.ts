import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface SummaryGenerateRequest {
  sessionId: string
  userId: string
  startMessageId: number
  endMessageId: number
  characterName: string
}

export async function POST(request: NextRequest) {
  try {
    // 创建Supabase客户端
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    
    // 获取用户的access token
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

    // 获取API密钥和模型（从header中）
    const apiKey = request.headers.get('x-api-key')
    const model = request.headers.get('x-model') || 'deepseek-chat'
    
    if (!apiKey) {
      return NextResponse.json({ error: '缺少API密钥' }, { status: 400 })
    }

    // 验证用户身份
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '用户身份验证失败' }, { status: 401 })
    }

    // 解析请求体
    const { sessionId, userId, startMessageId, endMessageId, characterName } = 
      await request.json() as SummaryGenerateRequest
    
    if (!sessionId || !userId || !startMessageId || !endMessageId || !characterName) {
      return NextResponse.json({ error: '缺少必需参数' }, { status: 400 })
    }

    // 验证用户权限
    if (user.id !== userId) {
      return NextResponse.json({ error: '无权限操作' }, { status: 403 })
    }

    // 获取要摘要的消息
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .gte('id', startMessageId)
      .lte('id', endMessageId)
      .order('created_at', { ascending: true })

    if (messagesError || !messages || messages.length === 0) {
      return NextResponse.json({ error: '找不到要摘要的消息' }, { status: 404 })
    }

    // 生成摘要
    const conversationText = messages
      .map(msg => `${msg.role === 'user' ? '用户' : characterName}: ${msg.content}`)
      .join('\n')

    const summaryPrompt = `请为以下对话生成一个简洁的摘要，重点记录：
1. 关键事件和情节发展
2. 重要的约定、决定或承诺  
3. 角色关系的变化
4. 重要的背景信息

要求：
- 使用第三人称描述
- 保持客观中性的语调
- 控制在200字以内
- 重点突出对后续对话有影响的信息

对话内容：
${conversationText}

摘要：`

    // 调用AI API生成摘要
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: summaryPrompt }],
        systemPrompt: '你是一个专业的对话摘要助手，能够准确提取对话中的关键信息。',
        apiKey,
        model
      }),
    })

    if (!response.ok) {
      throw new Error('摘要生成失败')
    }

    const aiResult = await response.json()
    const summaryContent = aiResult.content || '摘要生成失败'

    // 保存摘要到数据库
    const { data: summary, error: insertError } = await supabase
      .from('chat_summaries')
      .insert({
        session_id: sessionId,
        user_id: userId,
        content: summaryContent,
        start_message_id: startMessageId,
        end_message_id: endMessageId,
        original_message_count: messages.length,
        summary_method: 'ai_generated'
      })
      .select()
      .single()

    if (insertError) {
      console.error('保存摘要失败:', insertError)
      return NextResponse.json({ error: '保存摘要失败' }, { status: 500 })
    }

    return NextResponse.json({ 
      summary,
      message: '摘要生成成功'
    })

  } catch (error) {
    console.error('生成摘要失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器内部错误' },
      { status: 500 }
    )
  }
}

// 获取会话的所有摘要
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    
    if (!sessionId) {
      return NextResponse.json({ error: '缺少sessionId参数' }, { status: 400 })
    }

    // 创建Supabase客户端
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    
    // 获取用户的access token
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

    // 验证用户身份
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '用户身份验证失败' }, { status: 401 })
    }

    // 获取摘要列表
    const { data: summaries, error } = await supabase
      .from('chat_summaries')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('获取摘要失败:', error)
      return NextResponse.json({ error: '获取摘要失败' }, { status: 500 })
    }

    return NextResponse.json({ summaries })

  } catch (error) {
    console.error('获取摘要失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器内部错误' },
      { status: 500 }
    )
  }
}
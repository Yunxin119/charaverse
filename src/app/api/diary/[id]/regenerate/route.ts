import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface ChatMessage {
  id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

interface Character {
  id: number
  name: string
  prompt_template: any
}

// 调用AI API生成日记内容
async function generateDiaryContent(
  character: Character,
  conversationMessages: ChatMessage[],
  apiKey: string,
  model: string
): Promise<string> {
  // 构建角色信息
  const characterInfo = character.prompt_template?.basic_info
  const characterName = character.name
  const characterDescription = characterInfo?.description || ''
  const characterPersonality = characterInfo?.personality || ''
  
  // 将对话转换为文本
  const conversationText = conversationMessages
    .map(m => `${m.role === 'user' ? '用户' : characterName}: ${m.content}`)
    .join('\n')

  // 构建专属的日记生成prompt
  const diaryPrompt = `[角色设定]
你是${characterName}，${characterDescription}
${characterPersonality ? `性格特征：${characterPersonality}` : ''}

[任务指令]
请以${characterName}的第一人称视角，根据下面的对话内容写一篇日记。
要求：
1. 以第一人称视角（"我"）来写
2. 不要只是复述对话，要展现内心的情感和思考
3. 体现你的性格特征和感受
4. 日记风格要自然，像真正的个人日记
5. 字数控制在200-500字之间
6. 不要在开头写"日记"或日期等标题

[对话内容]
${conversationText}

[请开始写你的日记]`

  // 根据模型调用相应的API
  if (model.startsWith('deepseek')) {
    return await callDeepSeek(diaryPrompt, apiKey, model)
  } else if (model.startsWith('gemini')) {
    return await callGemini(diaryPrompt, apiKey, model)
  } else if (model.startsWith('gpt')) {
    return await callOpenAI(diaryPrompt, apiKey, model)
  } else {
    throw new Error('不支持的模型类型')
  }
}

// DeepSeek API 调用
async function callDeepSeek(prompt: string, apiKey: string, model: string): Promise<string> {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 1500,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`DeepSeek API error: ${response.statusText} - ${errorText}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

// Gemini API 调用
async function callGemini(prompt: string, apiKey: string, model: string): Promise<string> {
  const requestBody = {
    contents: [{
      role: 'user',
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 2000,
    }
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorData = await response.text()
    throw new Error(`Gemini API error: ${response.statusText} - ${errorData}`)
  }

  const data = await response.json()
  
  if (data.error) {
    throw new Error(`Gemini API Error: ${data.error.message}`)
  }
  
  if (!data.candidates || data.candidates.length === 0) {
    throw new Error('Gemini API没有返回有效内容')
  }
  
  const candidate = data.candidates[0]
  
  if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'BLOCKED_REASON_UNSPECIFIED') {
    throw new Error('响应被Gemini安全过滤器阻止')
  }
  
  if (!candidate.content) {
    throw new Error('Gemini API响应中没有content字段')
  }
  
  if (!candidate.content.parts) {
    throw new Error('Gemini API响应中content没有parts字段')
  }
  
  if (candidate.content.parts.length === 0) {
    throw new Error('Gemini API响应中parts数组为空')
  }

  // 提取文本内容
  let responseText = ''
  for (const part of candidate.content.parts) {
    if (part.text) {
      responseText += part.text
    }
  }
  
  if (!responseText.trim()) {
    throw new Error('Gemini API响应中没有文本内容')
  }

  return responseText
}

// OpenAI API 调用
async function callOpenAI(prompt: string, apiKey: string, model: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 1500,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI API error: ${response.statusText} - ${errorText}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const diaryId = params.id

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

    // 获取要重新生成的日记信息
    const { data: diary, error: diaryError } = await supabase
      .from('diaries')
      .select('*')
      .eq('id', diaryId)
      .eq('user_id', user.id)
      .single()

    if (diaryError || !diary) {
      return NextResponse.json({ error: '日记不存在或无权限访问' }, { status: 404 })
    }

    // 获取会话信息
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', diary.session_id)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: '会话不存在或无权限访问' }, { status: 404 })
    }

    // 获取角色信息
    const { data: character, error: characterError } = await supabase
      .from('characters')
      .select('*')
      .eq('id', session.character_id)
      .single()

    if (characterError || !character) {
      return NextResponse.json({ error: '角色信息获取失败' }, { status: 404 })
    }

    // 获取日记对应的消息范围
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', diary.session_id)
      .gte('id', diary.source_message_id_start || 0)
      .lte('id', diary.source_message_id_end || 999999999)
      .order('created_at', { ascending: true })

    if (messagesError || !messages || messages.length === 0) {
      return NextResponse.json({ error: '找不到对应的聊天消息' }, { status: 404 })
    }

    // 调用AI重新生成日记内容
    const newDiaryContent = await generateDiaryContent(
      character,
      messages,
      apiKey,
      model
    )

    // 更新日记内容
    const { data: updatedDiary, error: updateError } = await supabase
      .from('diaries')
      .update({
        content: newDiaryContent,
        updated_at: new Date().toISOString()
      })
      .eq('id', diaryId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('更新日记失败:', updateError)
      return NextResponse.json({ error: '更新日记失败' }, { status: 500 })
    }

    return NextResponse.json({ 
      diary: updatedDiary,
      message: '日记重新生成成功' 
    })

  } catch (error) {
    console.error('重新生成日记失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器内部错误' },
      { status: 500 }
    )
  }
}
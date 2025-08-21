import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Character, ChatMessage } from '@/app/types/character'

interface DiaryGenerateRequest {
  sessionId: string
  userId: string
}

// 调用AI API生成日记内容
async function generateDiaryContent(
  character: Character,
  conversationMessages: ChatMessage[],
  apiKey: string,
  model: string,
  baseUrl?: string,
  actualModel?: string
): Promise<string> {
  console.log('📝 Generating diary content with:', {
    characterName: character.name,
    messageCount: conversationMessages.length,
    model,
    actualModel,
    baseUrl: baseUrl ? baseUrl.substring(0, 30) + '...' : 'none',
    apiKeyPrefix: apiKey.substring(0, 10) + '...'
  })
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
请以${characterName}的第一人称视角，根据下面的对话内容写一篇日记，注意感情细腻，贴合人物。
要求：
1. 以第一人称视角（"我"）来写
2. 不要只是复述对话，要展现内心的情感和思考
3. 体现你的性格特征和感受
4. 日记风格要自然，像真正的个人日记
5. 字数控制在500-1200字之间，根据对话内容多少、剧情多少和人物性格决定。
6. 不要在开头写"日记"或日期等标题

[最近的对话内容]
${conversationText}

[请开始写你的日记]`

  // 根据模型调用相应的API
  if (model.startsWith('named-relay-')) {
    if (!baseUrl || !actualModel) {
      throw new Error('中转API需要baseUrl和actualModel参数')
    }
    return await callRelayAPI(diaryPrompt, apiKey, actualModel, baseUrl)
  } else if (model.startsWith('deepseek')) {
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
      max_tokens: 3000,
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
  
  // 添加详细日志
  console.log('Gemini API Response:', JSON.stringify(data, null, 2))
  
  if (data.error) {
    throw new Error(`Gemini API Error: ${data.error.message}`)
  }
  
  if (!data.candidates || data.candidates.length === 0) {
    console.error('No candidates in response:', data)
    throw new Error('Gemini API没有返回有效内容')
  }
  
  const candidate = data.candidates[0]
  console.log('First candidate:', JSON.stringify(candidate, null, 2))
  
  if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'BLOCKED_REASON_UNSPECIFIED') {
    throw new Error('响应被Gemini安全过滤器阻止')
  }
  
  if (!candidate.content) {
    console.error('No content in candidate:', candidate)
    throw new Error('Gemini API响应中没有content字段')
  }
  
  if (!candidate.content.parts) {
    console.error('No parts in content:', candidate.content)
    throw new Error('Gemini API响应中content没有parts字段')
  }
  
  if (candidate.content.parts.length === 0) {
    console.error('Empty parts array:', candidate.content.parts)
    throw new Error('Gemini API响应中parts数组为空')
  }

  // 提取文本内容
  let responseText = ''
  for (const part of candidate.content.parts) {
    if (part.text) {
      responseText += part.text
    } else {
      console.warn('Part without text:', part)
    }
  }
  
  if (!responseText.trim()) {
    console.error('No text content found in parts:', candidate.content.parts)
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

// 中转API调用（支持OpenAI格式的中转服务）
async function callRelayAPI(prompt: string, apiKey: string, actualModel: string, baseUrl: string): Promise<string> {
  // 确保baseUrl以/v1结尾
  const apiUrl = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`
  
  console.log('📝 Diary Relay API Call:', {
    apiUrl: `${apiUrl}/chat/completions`,
    actualModel,
    promptLength: prompt.length,
    apiKeyPrefix: apiKey.substring(0, 10) + '...'
  })
  
  const requestBody: Record<string, unknown> = {
    model: actualModel,
    messages: [
      { role: 'user', content: prompt }
    ],
    temperature: 0.8,
    max_tokens: 1500,
  }

  // 如果actualModel是Gemini 2.5系列，添加thinking配置
  if (actualModel.includes('gemini-2.5')) {
    console.log('📝 Adding thinking config for Gemini 2.5 model:', actualModel)
    if (actualModel === 'gemini-2.5-pro') {
      // Pro版本使用auto模式
      requestBody.thinkingConfig = {}
      console.log('📝 Using auto thinking mode for Pro')
    } else if (actualModel.includes('gemini-2.5-flash')) {
      // Flash版本也使用auto模式（日记生成不需要手动限制）
      requestBody.thinkingConfig = {}
      console.log('📝 Using auto thinking mode for Flash')
    }
  }

  console.log('📝 Diary Relay Request Body:', JSON.stringify(requestBody, null, 2))
  
  const response = await fetch(`${apiUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'User-Agent': 'Charaverse/1.0.0',
    },
    body: JSON.stringify(requestBody),
  })

  console.log('📝 Diary Relay Response Status:', response.status, response.statusText)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('📝 Diary Relay API Error Response:', errorText)
    throw new Error(`Relay API error: ${response.statusText} - ${errorText}`)
  }

  const data = await response.json()
  console.log('📝 Diary Relay Response Data:', JSON.stringify(data, null, 2))
  
  if (!data.choices || data.choices.length === 0) {
    console.error('📝 Diary Relay API returned no choices:', data)
    throw new Error('Relay API returned no choices')
  }
  
  const content = data.choices[0].message.content
  console.log('📝 Diary Relay Final Content:', content?.substring(0, 200) + '...')
  
  return content
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
    const baseUrl = request.headers.get('x-base-url')
    const actualModel = request.headers.get('x-actual-model')
    
    if (!apiKey) {
      return NextResponse.json({ error: '缺少API密钥' }, { status: 400 })
    }

    // 解析请求体
    const { sessionId, userId } = await request.json() as DiaryGenerateRequest
    
    if (!sessionId || !userId) {
      return NextResponse.json({ error: '缺少必需参数' }, { status: 400 })
    }

    // 验证用户身份
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user || user.id !== userId) {
      return NextResponse.json({ error: '用户身份验证失败' }, { status: 401 })
    }

    // 1. 验证会话存在且属于当前用户
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single()

    if (sessionError) {
      console.error('Session query error:', sessionError)
      return NextResponse.json({ error: '会话不存在或无权限访问' }, { status: 404 })
    }

    if (!session) {
      return NextResponse.json({ error: '会话不存在或无权限访问' }, { status: 404 })
    }

    // 2. 获取角色信息
    const { data: character, error: characterError } = await supabase
      .from('characters')
      .select('*')
      .eq('id', session.character_id)
      .single()

    if (characterError || !character) {
      return NextResponse.json({ error: '角色信息获取失败' }, { status: 404 })
    }

    // 3. 查找最后一篇日记，确定起始消息ID
    const { data: lastDiary } = await supabase
      .from('diaries')
      .select('source_message_id_end')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const startFromMessageId = lastDiary?.source_message_id_end || 0

    // 4. 获取新的聊天消息
    const { data: newMessages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .gt('id', startFromMessageId)
      .order('created_at', { ascending: true })

    if (messagesError) {
      return NextResponse.json({ error: '获取聊天消息失败' }, { status: 500 })
    }

    // 5. 检查是否有足够的新消息来生成日记
    if (!newMessages || newMessages.length < 3) {
      return NextResponse.json({ 
        error: '对话内容不足，至少需要3条新消息才能生成日记' 
      }, { status: 400 })
    }

    // 6. 调用AI生成日记内容
    console.log('📝 About to generate diary with params:', {
      model,
      baseUrl,
      actualModel,
      messageCount: newMessages.length
    })
    
    const diaryContent = await generateDiaryContent(
      character,
      newMessages,
      apiKey,
      model,
      baseUrl || undefined,
      actualModel || undefined
    )

    console.log('📝 Generated diary content:', {
      length: diaryContent?.length || 0,
      preview: diaryContent?.substring(0, 100) + '...'
    })

    // 7. 保存日记到数据库
    const { data: newDiary, error: insertError } = await supabase
      .from('diaries')
      .insert({
        session_id: sessionId,
        user_id: userId,
        content: diaryContent,
        source_message_id_start: newMessages[0].id,
        source_message_id_end: newMessages[newMessages.length - 1].id
      })
      .select()
      .single()

    if (insertError) {
      console.error('保存日记失败:', insertError)
      return NextResponse.json({ error: '保存日记失败' }, { status: 500 })
    }

    return NextResponse.json({ 
      diary: newDiary,
      message: '日记生成成功'
    })

  } catch (error) {
    console.error('生成日记失败:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : '服务器内部错误'
      },
      { status: 500 }
    )
  }
}
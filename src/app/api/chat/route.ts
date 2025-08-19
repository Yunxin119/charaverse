import { NextRequest, NextResponse } from 'next/server'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface ChatRequest {
  messages: ChatMessage[]
  systemPrompt: string
  apiKey: string
  model: string
  thinkingBudget?: number // 新增thinking budget参数
}

// DeepSeek API 调用
async function callDeepSeek(messages: ChatMessage[], systemPrompt: string, apiKey: string, model: string) {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 5000,
    }),
  })

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.statusText}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

// Gemini API 调用 - 使用正确的REST API格式
async function callGemini(messages: ChatMessage[], systemPrompt: string, apiKey: string, model: string, thinkingBudget = 0) {
  // 构建Gemini格式的contents数组
  const contents = []
  
  // 添加系统提示作为第一条用户消息
  if (systemPrompt) {
    contents.push({
      role: 'user',
      parts: [{ text: systemPrompt }]
    })
    contents.push({
      role: 'model',
      parts: [{ text: '我明白了，我会按照这些设定来扮演角色。' }]
    })
  }
  
  // 添加对话历史
  messages.forEach(msg => {
    if (msg.role === 'user') {
      contents.push({
        role: 'user',
        parts: [{ text: msg.content }]
      })
    } else if (msg.role === 'assistant') {
      contents.push({
        role: 'model',
        parts: [{ text: msg.content }]
      })
    }
  })

  // 确保contents数组不为空，且最后一条是用户消息
  if (contents.length === 0) {
    throw new Error('No content to send to Gemini API')
  }
  
  // 检查最后一条消息是否为用户消息，如果不是，添加一个空的用户消息
  const lastContent = contents[contents.length - 1]
  if (lastContent.role !== 'user') {
    contents.push({
      role: 'user',
      parts: [{ text: '【用户未回，请继续。】' }]
    })
  }

  // 构建请求体
  const requestBody: any = {
    contents: contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4000,
    }
  }

  // 只有2.5系列模型才支持thinking配置
  if (model.includes('2.5')) {
    if (model === 'gemini-2.5-pro') {
      // 2.5 Pro 始终启用thinking（不指定budget让API自动决定）
      requestBody.generationConfig.thinkingConfig = {}
    } else if (model === 'gemini-2.5-flash' && thinkingBudget !== undefined && thinkingBudget >= 0) {
      // 2.5 Flash 根据用户设置
      requestBody.generationConfig.thinkingConfig = {
        thinkingBudget: thinkingBudget
      }
    }
  }

  console.log('Gemini API Request:', JSON.stringify(requestBody, null, 2))

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorData = await response.text()
    console.error('Gemini API Error Response:', errorData)
    throw new Error(`Gemini API error: ${response.statusText} - ${errorData}`)
  }

  const data = await response.json()
  console.log('Gemini API Response:', JSON.stringify(data, null, 2))
  
  // 检查是否有错误
  if (data.error) {
    console.error('Gemini API returned error:', data.error)
    throw new Error(`Gemini API Error: ${data.error.message || JSON.stringify(data.error)}`)
  }
  
  // 检查响应结构
  if (!data.candidates || data.candidates.length === 0) {
    console.error('No candidates in Gemini response. Full response:', JSON.stringify(data, null, 2))
    console.error('Request body was:', JSON.stringify(requestBody, null, 2))
    
    // 检查是否有其他可能的错误信息
    if (data.promptFeedback) {
      console.error('Prompt feedback:', data.promptFeedback)
      if (data.promptFeedback.blockReason) {
        throw new Error(`Request blocked by Gemini: ${data.promptFeedback.blockReason}`)
      }
    }
    
    throw new Error('No candidates returned from Gemini API - check console for full response')
  }
  
  const candidate = data.candidates[0]
  
  // 检查候选响应是否被阻止
  if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'BLOCKED_REASON_UNSPECIFIED') {
    throw new Error('Response was blocked by Gemini safety filters')
  }
  
  // 处理其他finish reasons
  if (candidate.finishReason === 'RECITATION') {
    throw new Error('Response was blocked due to recitation concerns')
  }
  
  if (candidate.finishReason === 'OTHER') {
    console.warn('Gemini finished with reason: OTHER')
  }
  
  // 检查是否因为MAX_TOKENS而截断
  if (candidate.finishReason === 'MAX_TOKENS') {
    console.warn('Gemini response was truncated due to MAX_TOKENS. Consider increasing maxOutputTokens.')
  }
  
  if (!candidate.content) {
    console.error('No content in candidate:', candidate)
    console.error('Full response data:', JSON.stringify(data, null, 2))
    throw new Error(`No content in Gemini API response. Finish reason: ${candidate.finishReason || 'unknown'}`)
  }

  // 处理响应 - 改进的内容提取逻辑
  let responseText = ''
  
  if (candidate.content) {
    // 检查是否有 parts 数组
    if (candidate.content.parts && Array.isArray(candidate.content.parts)) {
      for (const part of candidate.content.parts) {
        if (part.text) {
          responseText += part.text
        }
      }
    } else {
      // 如果没有 parts 数组，检查是否有直接的文本内容
      console.warn('Content object missing parts array:', candidate.content)
      
      // 尝试其他可能的文本字段
      if (typeof candidate.content === 'string') {
        responseText = candidate.content
      } else if (candidate.content.text) {
        responseText = candidate.content.text
      } else {
        console.error('Unable to extract text from content:', candidate.content)
        console.error('Full candidate object:', JSON.stringify(candidate, null, 2))
        
        // 如果是MAX_TOKENS但没有内容，可能是API问题
        if (candidate.finishReason === 'MAX_TOKENS') {
          throw new Error('Response was truncated by MAX_TOKENS and no content was returned. This may be an API issue or the response was completely filtered.')
        }
      }
    }
  }

  // 如果仍然没有内容
  if (!responseText || responseText.trim() === '') {
    console.error('No text content extracted from response')
    console.error('Candidate:', JSON.stringify(candidate, null, 2))
    console.error('Full response:', JSON.stringify(data, null, 2))
    
    if (candidate.finishReason === 'MAX_TOKENS') {
      return 'Response was truncated due to length limits. Please try a shorter prompt or increase the token limit.'
    }
    
    return 'No response generated - the API returned empty content'
  }

  return responseText
}

// OpenAI API 调用
async function callOpenAI(messages: ChatMessage[], systemPrompt: string, apiKey: string, model: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json()
    const { messages, systemPrompt, apiKey, model, thinkingBudget = 0 } = body

    // 添加详细的调试信息
    console.log('API Request Body:', {
      messages: messages ? `${messages.length} messages` : 'undefined',
      systemPrompt: systemPrompt ? `${systemPrompt.length} chars` : 'undefined',
      apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'undefined',
      model: model || 'undefined',
      thinkingBudget
    })

    // 检查必需参数
    const missingParams = []
    if (!Array.isArray(messages)) missingParams.push('messages')
    if (!systemPrompt || systemPrompt.trim() === '') missingParams.push('systemPrompt')
    if (!apiKey || apiKey.trim() === '') missingParams.push('apiKey')
    if (!model || model.trim() === '') missingParams.push('model')

    if (missingParams.length > 0) {
      console.error('Missing parameters:', missingParams)
      return NextResponse.json(
        { error: `Missing required parameters: ${missingParams.join(', ')}` },
        { status: 400 }
      )
    }

    let content: string

    // 根据模型选择对应的API
    if (model.startsWith('deepseek')) {
      content = await callDeepSeek(messages, systemPrompt, apiKey, model)
    } else if (model.startsWith('gemini')) {
      content = await callGemini(messages, systemPrompt, apiKey, model, thinkingBudget)
    } else if (model.startsWith('gpt')) {
      content = await callOpenAI(messages, systemPrompt, apiKey, model)
    } else {
      return NextResponse.json(
        { error: 'Unsupported model' },
        { status: 400 }
      )
    }

    return NextResponse.json({ content })

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 
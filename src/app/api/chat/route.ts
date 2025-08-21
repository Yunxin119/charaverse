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
  baseUrl?: string // 中转API的base URL
  actualModel?: string // 中转API的实际模型名称
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

// Gemini API 调用 - 使用正确的REST API格式，带重试机制
async function callGemini(messages: ChatMessage[], systemPrompt: string, apiKey: string, model: string, thinkingBudget = 0, retryCount = 0) {
  const maxRetries = 2
  // 构建Gemini格式的contents数组
  const contents = []
  
  // 添加系统提示作为第一条用户消息
  if (systemPrompt) {
    contents.push({
      role: 'user',
      parts: [{ text: systemPrompt }]
    })
    
    // 检查是否有初始对话（第一条assistant消息）
    const firstAssistantMessage = messages.find(msg => msg.role === 'assistant')
    let modelResponse = '我明白了，我会按照这些设定来扮演角色。'
    
    // 如果有初始对话且它是第一条消息，则使用初始对话内容
    if (firstAssistantMessage && messages.indexOf(firstAssistantMessage) === 0) {
      modelResponse = firstAssistantMessage.content
      console.log('Using initial dialogue as model response:', modelResponse.substring(0, 50) + '...')
    }
    
    contents.push({
      role: 'model',
      parts: [{ text: modelResponse }]
    })
  }
  
  // 添加对话历史，跳过已经处理的初始对话
  const messagesToProcess = systemPrompt && messages.length > 0 && messages[0].role === 'assistant' 
    ? messages.slice(1)  // 跳过第一条assistant消息（已作为初始回复处理）
    : messages
    
  messagesToProcess.forEach(msg => {
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
      parts: [{ text: '【请继续。】' }]
    })
  }

  // 构建请求体
  const requestBody: {
    contents: Array<{
      role: string
      parts: Array<{ text: string }>
    }>
    generationConfig: {
      temperature: number
      maxOutputTokens: number
      thinkingConfig?: { thinkingBudget?: number } | Record<string, never>
    }
  } = {
    contents: contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4000,
    }
  }

  // 只有2.5系列模型才支持thinking配置
  if (model.includes('2.5')) {
    if (model === 'gemini-2.5-pro') {
      // 2.5 Pro 启用thinking（修复了角色交替问题后应该正常工作）
      requestBody.generationConfig.thinkingConfig = {}
      console.log('Gemini 2.5 Pro: thinking enabled')
    } else if (model === 'gemini-2.5-flash' && thinkingBudget !== undefined && thinkingBudget >= 0) {
      // 2.5 Flash 根据用户设置
      requestBody.generationConfig.thinkingConfig = {
        thinkingBudget: thinkingBudget
      }
      console.log(`Gemini 2.5 Flash: thinking enabled with budget ${thinkingBudget}`)
    }
  }

  console.log('Gemini API Request (attempt', retryCount + 1, '):', JSON.stringify(requestBody, null, 2))

  try {
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
      
      // 如果是服务器错误且还有重试次数，则重试
      if (response.status >= 500 && retryCount < maxRetries) {
        console.log(`Server error ${response.status}, retrying in ${(retryCount + 1) * 1000}ms...`)
        await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 1000))
        return callGemini(messages, systemPrompt, apiKey, model, thinkingBudget, retryCount + 1)
      }
      
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

  // 特殊处理：如果content只有role属性，可能是API返回了空响应
  if (candidate.content.role && !candidate.content.parts) {
    console.error('Content object only contains role, missing parts array:', candidate.content)
    console.error('Full candidate:', JSON.stringify(candidate, null, 2))
    console.error('Full response data:', JSON.stringify(data, null, 2))
    
    // 尝试从其他可能的地方获取文本内容
    let fallbackText = ''
    
    // 检查是否有思考过程的输出
    if (data.usageMetadata?.thoughtsTokenCount > 0) {
      console.warn('Model used thinking tokens but produced no output content')
      fallbackText = '抱歉，我正在思考但无法生成合适的回复。这可能是由于内容安全过滤。请尝试重新表述您的问题。'
    } else {
      fallbackText = '抱歉，我无法生成回复。这可能是由于内容安全过滤或其他限制。请尝试不同的问题。'
    }
    
    // 如果完成原因是STOP，返回友好的错误消息而不是抛出异常
    if (candidate.finishReason === 'STOP') {
      return fallbackText
    } else {
      // 对于其他finish reason，记录详细信息但仍返回友好消息
      console.error(`Unexpected finish reason with empty content: ${candidate.finishReason}`)
      return fallbackText + ` (状态: ${candidate.finishReason})`
    }
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
    
    // 根据不同的finish reason提供更具体的错误信息
    switch (candidate.finishReason) {
      case 'MAX_TOKENS':
        return 'Response was truncated due to length limits. Please try a shorter prompt or increase the token limit.'
      case 'SAFETY':
        return 'Response was blocked by safety filters. Please modify your prompt and try again.'
      case 'RECITATION':
        return 'Response was blocked due to recitation concerns. Please rephrase your prompt.'
      case 'STOP':
        return 'API completed successfully but returned empty content. This may be due to content restrictions or model limitations.'
      case 'OTHER':
        return 'Response generation stopped due to unknown reasons. Please try again.'
      default:
        return `No response generated - the API returned empty content. Finish reason: ${candidate.finishReason || 'unknown'}`
    }
  }

  return responseText
  
  } catch (fetchError) {
    // 处理网络错误和其他异常
    console.error('Gemini API fetch error:', fetchError)
    
    // 如果是网络错误且还有重试次数，则重试
    if (retryCount < maxRetries) {
      console.log(`Network error, retrying in ${(retryCount + 1) * 1000}ms...`)
      await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 1000))
      return callGemini(messages, systemPrompt, apiKey, model, thinkingBudget, retryCount + 1)
    }
    
    // 如果重试次数用完，抛出原始错误
    throw fetchError
  }
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

// 中转API调用（支持OpenAI格式的中转服务）
async function callRelayAPI(messages: ChatMessage[], systemPrompt: string, apiKey: string, actualModel: string, baseUrl: string, thinkingBudget?: number) {
  // 确保baseUrl以/v1结尾
  const apiUrl = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`
  
  // 构建请求体
  const requestBody: Record<string, unknown> = {
    model: actualModel,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
    ],
    temperature: 0.7,
    max_tokens: 4000,
  }

  // 如果actualModel是Gemini 2.5系列且有thinking budget，添加相应配置
  if (actualModel.includes('gemini-2.5') && thinkingBudget !== undefined) {
    console.log(`Relay API: Adding thinking budget ${thinkingBudget} for model ${actualModel}`)
    if (actualModel === 'gemini-2.5-pro') {
      // Pro版本使用auto模式
      requestBody.thinkingConfig = {}
    } else if (actualModel.includes('gemini-2.5-flash')) {
      // Flash版本根据budget设置
      if (thinkingBudget > 0) {
        requestBody.thinkingConfig = { thinkingBudget: thinkingBudget }
      } else {
        requestBody.thinkingConfig = {}
      }
    }
  }

  console.log('Relay API Request Body:', JSON.stringify(requestBody, null, 2))

  const response = await fetch(`${apiUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'User-Agent': 'Charaverse/1.0.0',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Relay API Error Response:', errorText)
    throw new Error(`Relay API error: ${response.statusText} - ${errorText}`)
  }

  const data = await response.json()
  
  if (!data.choices || data.choices.length === 0) {
    throw new Error('Relay API returned no choices')
  }
  
  return data.choices[0].message.content
}

export async function POST(request: NextRequest) {
  let model: string | undefined
  let messages: ChatMessage[] | undefined
  
  try {
    const body: ChatRequest = await request.json()
    const parsedBody = body
    messages = parsedBody.messages
    const systemPrompt = parsedBody.systemPrompt
    const apiKey = parsedBody.apiKey
    model = parsedBody.model
    const thinkingBudget = parsedBody.thinkingBudget || 0
    const baseUrl = parsedBody.baseUrl
    const actualModel = parsedBody.actualModel

    // 添加详细的调试信息
    console.log('API Request Body:', {
      messages: messages ? `${messages.length} messages` : 'undefined',
      systemPrompt: systemPrompt ? `${systemPrompt.length} chars` : 'undefined',
      apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'undefined',
      model: model || 'undefined',
      thinkingBudget,
      baseUrl: baseUrl || 'undefined',
      actualModel: actualModel || 'undefined'
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
    if (model.startsWith('named-relay-')) {
      // 命名中转API调用
      if (!baseUrl || !actualModel) {
        return NextResponse.json(
          { error: 'Relay API requires baseUrl and actualModel parameters' },
          { status: 400 }
        )
      }
      content = await callRelayAPI(messages, systemPrompt, apiKey, actualModel, baseUrl, thinkingBudget)
    } else if (model.startsWith('deepseek')) {
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
    
    // 提供更详细的错误信息
    let errorMessage = 'Internal server error'
    let errorDetails = ''
    
    if (error instanceof Error) {
      errorMessage = error.message
      errorDetails = error.stack || ''
      
      // 特殊处理一些常见的API错误
      if (error.message.includes('Gemini API Error')) {
        errorMessage = 'Gemini API request failed: ' + error.message
      } else if (error.message.includes('API returned empty response')) {
        errorMessage = 'AI model returned empty response, possibly due to content filters'
      } else if (error.message.includes('Malformed API response')) {
        errorMessage = 'AI model returned malformed response, please try again'
      }
    }
    
    // 记录详细错误信息到控制台（仅开发环境）
    if (process.env.NODE_ENV === 'development') {
      console.error('Detailed error info:', {
        message: errorMessage,
        details: errorDetails,
        requestBody: { model, messagesCount: messages?.length }
      })
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        ...(process.env.NODE_ENV === 'development' && { details: errorDetails })
      },
      { status: 500 }
    )
  }
} 
import { createAsyncThunk } from '@reduxjs/toolkit'
import { supabase, type ChatMessage, type ChatSummary } from './supabase'
import { ContextManager, ContextConfig } from './contextManager'

// 增强版聊天参数接口
interface EnhancedChatParams {
  sessionId: string
  userMessage: string
  systemPrompt: string
  apiKey: string
  model: string
  messages: ChatMessage[]
  thinkingBudget?: number
  contextConfig?: Partial<ContextConfig>
  characterName?: string
}

// 获取会话的摘要
export const getSummaries = async (sessionId: string, userId: string): Promise<ChatSummary[]> => {
  const { data: summaries, error } = await supabase
    .from('chat_summaries')
    .select('*')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('获取摘要失败:', error)
    return []
  }

  return summaries || []
}

// 生成摘要
export const generateSummary = async (params: {
  sessionId: string
  userId: string
  startMessageId: number
  endMessageId: number
  characterName: string
  apiKey: string
  model?: string
  accessToken: string
}): Promise<ChatSummary | null> => {
  try {
    const response = await fetch('/api/chat/summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${params.accessToken}`,
        'x-api-key': params.apiKey,
        'x-model': params.model || 'deepseek-chat'
      },
      body: JSON.stringify({
        sessionId: params.sessionId,
        userId: params.userId,
        startMessageId: params.startMessageId,
        endMessageId: params.endMessageId,
        characterName: params.characterName
      })
    })

    if (!response.ok) {
      throw new Error('摘要生成失败')
    }

    const result = await response.json()
    return result.summary
  } catch (error) {
    console.error('生成摘要失败:', error)
    return null
  }
}

// 增强版发送消息函数
export const sendMessageWithContext = createAsyncThunk(
  'chat/sendMessageWithContext',
  async (params: EnhancedChatParams) => {
    const { 
      sessionId, 
      userMessage, 
      systemPrompt, 
      apiKey, 
      model, 
      messages, 
      thinkingBudget,
      contextConfig = {},
      characterName = '角色'
    } = params

    let userMsgData = null
    
    // 1. 保存用户消息（如果有）
    if (userMessage.trim()) {
      const { data, error: userMsgError } = await supabase
        .from('chat_messages')
        .insert({
          session_id: sessionId,
          role: 'user',
          content: userMessage
        })
        .select()
        .single()

      if (userMsgError) throw userMsgError
      userMsgData = data
    }

    // 2. 创建上下文管理器
    const contextManager = new ContextManager(contextConfig)
    
    // 3. 构建当前消息列表（包含新用户消息）
    const currentMessages = [...messages]
    if (userMessage.trim() && userMsgData) {
      currentMessages.push(userMsgData)
    }

    // 4. 检查是否需要生成摘要
    let summaries: string[] = []
    if (contextManager.shouldGenerateSummary(currentMessages)) {
      console.log('检测到需要生成摘要，获取现有摘要...')
      
      // 获取现有摘要
      const existingSummaries = await getSummaries(sessionId, currentMessages[0]?.session_id || '')
      summaries = existingSummaries.map(s => s.content)

      // 检查是否需要生成新摘要
      const config = contextManager.getConfig()
      const unSummarizedMessages = currentMessages.slice(
        existingSummaries.length > 0 ? config.summaryThreshold : 0
      )

      if (unSummarizedMessages.length >= config.summaryThreshold) {
        console.log('生成新摘要...')
        
        // 获取用户session
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          const newSummary = await generateSummary({
            sessionId,
            userId: currentMessages[0]?.session_id || '',
            startMessageId: unSummarizedMessages[0]?.id || 0,
            endMessageId: unSummarizedMessages[unSummarizedMessages.length - 1]?.id || 0,
            characterName,
            apiKey,
            model,
            accessToken: session.access_token
          })

          if (newSummary) {
            summaries.push(newSummary.content)
          }
        }
      }
    }

    // 5. 使用上下文管理器构建context
    const context = await contextManager.buildContext({
      systemPrompt,
      messages: currentMessages,
      summaries: summaries.length > 0 ? summaries : undefined
    })

    // 6. 记录上下文统计信息
    console.log('上下文统计:', context.stats)

    // 7. 调用AI API
    const requestBody: any = {
      messages: context.messages,
      systemPrompt: context.systemPrompt,
      apiKey,
      model
    }

    if (model.includes('gemini-2.5') && thinkingBudget !== undefined) {
      requestBody.thinkingBudget = thinkingBudget
    }

    console.log('发送到API的请求体:', {
      messages: context.messages.length,
      systemPrompt: context.systemPrompt ? `${context.systemPrompt.length} chars` : 'undefined',
      apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'undefined',
      model,
      contextStats: context.stats
    })

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('API响应错误:', response.status, errorText)
      throw new Error(`Failed to get AI response: ${response.status} ${errorText}`)
    }

    const aiResponse = await response.json()

    // 8. 保存AI消息
    const { data: aiMsgData, error: aiMsgError } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        role: 'assistant',
        content: aiResponse.content
      })
      .select()
      .single()

    if (aiMsgError) throw aiMsgError

    // 9. 返回结果，包含上下文统计信息
    return {
      userMessage: userMsgData,
      aiMessage: aiMsgData,
      contextStats: context.stats
    }
  }
)

// 工具函数：获取上下文配置建议
export const getContextConfigSuggestions = (model: string): Partial<ContextConfig> => {
  // 根据不同模型提供不同的配置建议
  switch (true) {
    case model.includes('gpt-4'):
      return {
        maxContextTokens: 8000,
        reservedTokens: 1500,
        summaryThreshold: 30
      }
    case model.includes('gpt-3.5'):
      return {
        maxContextTokens: 4000,
        reservedTokens: 1000,
        summaryThreshold: 20
      }
    case model.includes('gemini'):
      return {
        maxContextTokens: 8000,
        reservedTokens: 1500,
        summaryThreshold: 25
      }
    case model.includes('deepseek'):
      return {
        maxContextTokens: 4000,
        reservedTokens: 1000,
        summaryThreshold: 20
      }
    default:
      return {
        maxContextTokens: 4000,
        reservedTokens: 1000,
        summaryThreshold: 20
      }
  }
}
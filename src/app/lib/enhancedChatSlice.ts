import { createAsyncThunk } from '@reduxjs/toolkit'
import { supabase, type ChatMessage, type ChatSummary } from './supabase'
import { ContextManager, ContextConfig } from './contextManager'

// 摘要生成处理函数
async function handleSummaryGeneration(params: {
  contextManager: ContextManager
  currentMessages: ChatMessage[]
  sessionId: string
  characterName: string
  apiKey: string
  model: string
  baseUrl?: string
  actualModel?: string
  thinkingBudget?: number
}): Promise<{ summaries: string[], actualSummarizedCount: number }> {
  const { contextManager, currentMessages, sessionId, characterName, apiKey, model, baseUrl, actualModel, thinkingBudget } = params
  
  let summaries: string[] = []
  
  if (contextManager.shouldGenerateSummary(currentMessages)) {
    console.log('检测到需要生成摘要，获取现有摘要...')
    
    // 获取用户session
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      throw new Error('用户未登录')
    }
    
    // 获取现有摘要
    const existingSummaries = await getSummaries(sessionId, session.user.id)
    summaries = existingSummaries.map(s => s.content)
    console.log(`📖 获取到${existingSummaries.length}个现有摘要:`, existingSummaries.map((s, i) => `[${i+1}] ${s.content.substring(0, 50)}...`))

    // 检查是否需要生成新摘要
    const config = contextManager.getConfig()
    const activeSummariesCount = existingSummaries.filter(s => s.is_active).length
    const summarizedMessageCount = activeSummariesCount * config.summaryThreshold
    const unSummarizedMessages = currentMessages.slice(summarizedMessageCount)

    // 计算需要生成多少个摘要（批量生成避免每次都生成一个）
    const neededSummaries = Math.floor(unSummarizedMessages.length / config.summaryThreshold)

    if (neededSummaries > 0) {
      console.log(`🎯 检测到需要生成 ${neededSummaries} 个摘要，未摘要消息数: ${unSummarizedMessages.length}`)

      // 如果是第一次开启智能模式且需要大量摘要，给出提示
      if (existingSummaries.length === 0 && neededSummaries > 2) {
        console.log(`⚠️  首次开启智能模式，需要生成 ${neededSummaries} 个摘要。为避免大量API调用，每次只生成一个摘要。`)
        console.log(`💡 建议：在聊天设置中调整摘要阈值或手动清理历史消息来减少摘要生成。`)
      }

      // 只生成一个摘要，避免一次性大量API调用
      const messagesForThisSummary = unSummarizedMessages.slice(0, config.summaryThreshold)
      console.log(`生成第 ${existingSummaries.length + 1} 个摘要 (处理 ${config.summaryThreshold} 条消息)...`)
      
      try {
        const newSummary = await generateSummary({
          sessionId,
          userId: session.user.id,
          startMessageId: messagesForThisSummary[0]?.id || 0,
          endMessageId: messagesForThisSummary[messagesForThisSummary.length - 1]?.id || 0,
          characterName,
          apiKey,
          model,
          accessToken: session.access_token,
          baseUrl,
          actualModel,
          thinkingBudget
        })

        if (newSummary) {
          summaries.push(newSummary.content)
          console.log(`✨ 生成新摘要并添加:`, newSummary.content.substring(0, 100) + '...')
          
          // 检查是否需要进行摘要压缩（8-5-3策略：8条触发，压缩前5条，保留最近3条）
          // 重新获取最新的摘要列表（因为可能有其他并发操作）
          const currentSummaries = await getSummaries(sessionId, session.user.id)
          const activeLevelOneSummaries = currentSummaries
            .filter(s => s.is_active && s.summary_level === 1)
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) // 按时间排序
          
          const totalActiveSummaries = activeLevelOneSummaries.length + 1 // 包含即将生成的新摘要
          
          // 8-5-3策略：当摘要达到8条时，压缩最早的5条，保留最近的3条
          if (totalActiveSummaries >= 8) {
            console.log(`🎯 检测到${totalActiveSummaries}个一级摘要，触发8-5-3压缩策略...`)
            console.log('📋 压缩策略：压缩最早的5条摘要，保留最近的3条摘要以应对用户可能的修改')
            
            // 取最早的5个一级摘要进行压缩（保留最近3条不动）
            const summariesToCompress = activeLevelOneSummaries.slice(0, 5)
            const summariesToKeep = activeLevelOneSummaries.slice(5)
            
            console.log(`🔄 准备压缩：${summariesToCompress.length}条稳定摘要`)
            console.log(`🛡️ 保持独立：${summariesToKeep.length}条最近摘要 + 1条新摘要`)
            
            try {
              const superSummary = await generateSuperSummary({
                sessionId,
                userId: session.user.id,
                summariesToCompress,
                characterName,
                apiKey,
                model,
                accessToken: session.access_token,
                baseUrl,
                actualModel,
                thinkingBudget
              })
              
              if (superSummary) {
                // 重新获取摘要列表以反映压缩后的状态
                const updatedSummaries = await getSummaries(sessionId, session.user.id)
                summaries = updatedSummaries.map(s => s.content)
                
                // 统计压缩效果
                const levelOneSummaries = updatedSummaries.filter(s => s.summary_level === 1).length
                const levelTwoSummaries = updatedSummaries.filter(s => s.summary_level === 2).length
                
                console.log(`🏆 8-5-3压缩成功！摘要结构：`)
                console.log(`   - 超级摘要(L2)：${levelTwoSummaries}条`)
                console.log(`   - 一级摘要(L1)：${levelOneSummaries}条`)
                console.log(`   - 总摘要数：${updatedSummaries.length}条`)
              }
            } catch (compressionError) {
              console.error('🔥 摘要压缩失败，但不影响正常功能:', compressionError)
            }
          } else {
            console.log(`📊 当前一级摘要：${totalActiveSummaries}条，距离压缩阈值(8条)还有${8 - totalActiveSummaries}条`)
          }
          
          console.log(`📝 当前总摘要数量: ${summaries.length}`)
        } else {
          console.log('⚠️ 摘要生成返回null，继续使用现有摘要')
        }
      } catch (error) {
        console.error('❌ 摘要生成失败:', error)
        console.log('🔄 摘要生成失败，继续使用现有摘要，不影响消息处理')
        // 摘要失败时不抛出错误，继续使用现有摘要
      }
    }
  }
  
  // 计算实际被摘要覆盖的消息数量
  const config = contextManager.getConfig()
  const actualSummarizedCount = summaries.length * config.summaryThreshold
  
  return { summaries, actualSummarizedCount }
}

// 构建最终上下文函数
async function buildFinalContext(params: {
  contextManager: ContextManager
  systemPrompt: string
  currentMessages: ChatMessage[]
  summaries: string[]
  actualSummarizedCount?: number  // 新增：实际被摘要覆盖的消息数量
}) {
  const { contextManager, systemPrompt, currentMessages, summaries, actualSummarizedCount } = params
  
  // 如果有摘要，只传递未被摘要的消息部分
  let messagesToProcess = currentMessages
  if (summaries.length > 0) {
    const config = contextManager.getConfig()
    
    // 使用实际摘要覆盖的消息数量，而不是期望的数量
    const summarizedMessageCount = actualSummarizedCount !== undefined 
      ? actualSummarizedCount 
      : summaries.length * config.summaryThreshold
    
    messagesToProcess = currentMessages.slice(summarizedMessageCount)
    console.log(`🧠 使用摘要模式: ${summaries.length}个摘要，跳过前${summarizedMessageCount}条消息，处理${messagesToProcess.length}条消息`)
    
    // 确保至少保留最近的几条消息
    if (messagesToProcess.length === 0) {
      const minMessages = Math.min(config.keepRecentMessages, currentMessages.length)
      messagesToProcess = currentMessages.slice(-minMessages)
      console.log(`⚠️ 摘要覆盖了所有消息，强制保留最近${minMessages}条消息`)
    }
  } else {
    console.log(`📝 无摘要模式: 处理全部${messagesToProcess.length}条消息`)
  }
  
  const finalSummaries = summaries.length > 0 ? summaries : undefined
  console.log(`🎯 传递给buildContext的摘要:`, finalSummaries ? finalSummaries.map((s, i) => `[${i+1}] ${s.substring(0, 50)}...`) : '无摘要')
  
  return await contextManager.buildContext({
    systemPrompt,
    messages: messagesToProcess,
    summaries: finalSummaries
  })
}

// 增强版聊天参数接口
export interface EnhancedChatParams {
  sessionId: string
  userMessage: string
  systemPrompt: string
  apiKey: string
  model: string
  messages: ChatMessage[]
  thinkingBudget?: number
  contextConfig?: Partial<ContextConfig>
  characterName?: string
  baseUrl?: string
  actualModel?: string
}

// 获取会话的有效摘要（使用分层优化）
export const getSummaries = async (sessionId: string, userId: string): Promise<ChatSummary[]> => {
  try {
    // 使用数据库函数获取最优摘要组合
    const { data: effectiveSummaries, error: functionError } = await supabase
      .rpc('get_effective_summaries', {
        p_session_id: sessionId,
        p_user_id: userId
      })

    if (!functionError && effectiveSummaries) {
      console.log(`📚 获取到${effectiveSummaries.length}个有效分层摘要`)
      return effectiveSummaries
    }

    // 降级到传统方法
    console.log('⚠️ 分层摘要查询失败，使用传统方法')
    const { data: summaries, error } = await supabase
      .from('chat_summaries')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('summary_level', { ascending: false })  // 高级摘要优先
      .order('created_at', { ascending: true })

    if (error) {
      console.error('获取摘要失败:', error)
      return []
    }

    return summaries || []
  } catch (error) {
    console.error('获取摘要时出错:', error)
    return []
  }
}

// 生成超级摘要（压缩多个摘要）
export const generateSuperSummary = async (params: {
  sessionId: string
  userId: string
  summariesToCompress: ChatSummary[]
  characterName: string
  apiKey: string
  model?: string
  accessToken: string
  baseUrl?: string
  actualModel?: string
  thinkingBudget?: number
}): Promise<ChatSummary | null> => {
  try {
    if (!params.apiKey || !params.accessToken) {
      throw new Error('缺少必要的认证参数')
    }

    const { summariesToCompress } = params
    if (summariesToCompress.length < 2) {
      console.log('⚠️ 摘要数量不足，无需压缩')
      return null
    }

    console.log(`🔄 开始压缩${summariesToCompress.length}个摘要为超级摘要`)

    // 构建超级摘要内容
    const summaryContents = summariesToCompress
      .map((s, i) => `[摘要${i+1}] ${s.content}`)
      .join('\n\n')

    // 调用摘要API
    const response = await fetch('/api/chat/summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${params.accessToken}`,
        'x-api-key': params.apiKey,
        'x-model': params.model || 'deepseek-chat',
        'x-base-url': params.baseUrl || '',
        'x-actual-model': params.actualModel || '',
        'x-thinking-budget': params.thinkingBudget?.toString() || ''
      },
      body: JSON.stringify({
        sessionId: params.sessionId,
        userId: params.userId,
        summaryContent: summaryContents,
        summaryType: 'super',
        characterName: params.characterName,
        parentSummaryIds: summariesToCompress.map(s => s.id)
      })
    })

    if (!response.ok) {
      throw new Error(`超级摘要生成失败: ${response.status}`)
    }

    const result = await response.json()
    const superSummary = result.summary

    if (superSummary) {
      // 标记原摘要为已压缩
      await supabase
        .from('chat_summaries')
        .update({ 
          is_active: false, 
          compressed_at: new Date().toISOString() 
        })
        .in('id', summariesToCompress.map(s => s.id))

      console.log(`✨ 成功生成超级摘要并压缩${summariesToCompress.length}个原摘要`)
    }

    return superSummary
  } catch (error) {
    console.error('❌ 超级摘要生成失败:', error)
    return null
  }
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
  baseUrl?: string
  actualModel?: string
  thinkingBudget?: number
}): Promise<ChatSummary | null> => {
  try {
    // 验证必需参数
    if (!params.apiKey) {
      throw new Error('缺少API密钥')
    }
    if (!params.accessToken) {
      throw new Error('缺少访问令牌')
    }
    
    console.log('生成摘要参数:', {
      sessionId: params.sessionId,
      userId: params.userId,
      model: params.model,
      apiKey: params.apiKey ? '***' : 'undefined',
      accessToken: params.accessToken ? '***' : 'undefined',
      thinkingBudget: params.thinkingBudget
    })
    
    const response = await fetch('/api/chat/summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${params.accessToken}`,
        'x-api-key': params.apiKey,
        'x-model': params.model || 'deepseek-chat',
        'x-base-url': params.baseUrl || '',
        'x-actual-model': params.actualModel || '',
        'x-thinking-budget': params.thinkingBudget?.toString() || ''
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
      characterName = '角色',
      baseUrl,
      actualModel
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

    // 4. 处理摘要逻辑
    const { summaries, actualSummarizedCount } = await handleSummaryGeneration({
      contextManager,
      currentMessages,
      sessionId,
      characterName,
      apiKey,
      model,
      baseUrl,
      actualModel,
      thinkingBudget
    })

    // 5. 构建最终上下文
    const context = await buildFinalContext({
      contextManager,
      systemPrompt,
      currentMessages,
      summaries,
      actualSummarizedCount
    })

    // 6. 记录上下文统计信息
    console.log('上下文统计:', context.stats)

    // 6.5. 最终安全检查：确保有消息可发送
    if (!context.messages || context.messages.length === 0) {
      throw new Error('没有可发送的消息：上下文构建失败或所有消息都被过滤')
    }

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

    // 添加中转API参数
    if (baseUrl) {
      requestBody.baseUrl = baseUrl
    }
    if (actualModel) {
      requestBody.actualModel = actualModel
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

    // 日志记录使用的API信息
    if (aiResponse.apiUsed) {
      console.log(`✅ 消息发送成功，使用API: ${aiResponse.apiUsed}${aiResponse.fallbackUsed ? ' (故障切换)' : ''}`)
    }

    // 8. 保存AI消息
    const { data: aiMsgData, error: aiMsgError } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        role: 'assistant',
        content: aiResponse.content || aiResponse.message || ''
      })
      .select()
      .single()

    if (aiMsgError) throw aiMsgError

    // 9. 返回结果，包含上下文统计信息和API池信息
    return {
      userMessage: userMsgData,
      aiMessage: aiMsgData,
      contextStats: context.stats,
      apiUsed: aiResponse.apiUsed,
      fallbackUsed: aiResponse.fallbackUsed,
      apiId: aiResponse.apiId
    }
  }
)

// 智能重新生成消息函数
export const regenerateMessageWithContext = createAsyncThunk(
  'chat/regenerateMessageWithContext',
  async (params: {
    sessionId: string
    systemPrompt: string
    apiKey: string
    model: string
    messages: ChatMessage[]
    lastMessageId: number
    thinkingBudget?: number
    contextConfig?: Partial<ContextConfig>
    characterName?: string
    baseUrl?: string
    actualModel?: string
  }) => {
    const { 
      sessionId, 
      systemPrompt, 
      apiKey, 
      model, 
      messages, 
      lastMessageId,
      thinkingBudget,
      contextConfig = {},
      characterName = '角色',
      baseUrl,
      actualModel
    } = params

    // 1. 过滤掉要重新生成的消息
    const filteredMessages = messages.filter(msg => msg.id !== lastMessageId)

    // 2. 创建上下文管理器
    const contextManager = new ContextManager(contextConfig)
    
    // 3. 处理摘要逻辑
    const { summaries, actualSummarizedCount } = await handleSummaryGeneration({
      contextManager,
      currentMessages: filteredMessages,
      sessionId,
      characterName,
      apiKey,
      model,
      baseUrl,
      actualModel,
      thinkingBudget
    })

    // 4. 构建最终上下文
    const context = await buildFinalContext({
      contextManager,
      systemPrompt,
      currentMessages: filteredMessages,
      summaries,
      actualSummarizedCount
    })

    // 5. 最终安全检查
    if (!context.messages || context.messages.length === 0) {
      throw new Error('没有可发送的消息：上下文构建失败或所有消息都被过滤')
    }

    // 6. 调用AI API
    const requestBody: any = {
      messages: context.messages,
      systemPrompt: context.systemPrompt,
      apiKey,
      model
    }

    if (model.includes('gemini-2.5') && thinkingBudget !== undefined) {
      requestBody.thinkingBudget = thinkingBudget
    }

    if (baseUrl) {
      requestBody.baseUrl = baseUrl
    }
    if (actualModel) {
      requestBody.actualModel = actualModel
    }

    console.log('重新生成API请求体:', {
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
      console.error('重新生成API响应错误:', response.status, errorText)
      throw new Error(`Failed to regenerate AI response: ${response.status} ${errorText}`)
    }

    const aiResponse = await response.json()

    // 日志记录使用的API信息
    if (aiResponse.apiUsed) {
      console.log(`✅ 消息重新生成成功，使用API: ${aiResponse.apiUsed}${aiResponse.fallbackUsed ? ' (故障切换)' : ''}`)
    }

    // 7. 更新数据库中的消息
    const { data: updatedMessage, error } = await supabase
      .from('chat_messages')
      .update({ content: aiResponse.content || aiResponse.message || '' })
      .eq('id', lastMessageId)
      .select()
      .single()

    if (error) throw error

    // 返回更新的消息和API池信息
    return {
      ...updatedMessage,
      apiUsed: aiResponse.apiUsed,
      fallbackUsed: aiResponse.fallbackUsed,
      apiId: aiResponse.apiId
    }
  }
)

// 检测并处理摘要失效
export const detectAndHandleSummaryInvalidation = async (
  sessionId: string, 
  userId: string,
  deletedMessageIds?: number[]
): Promise<void> => {
  try {
    console.log('🔍 检测摘要失效状态...')
    
    if (deletedMessageIds && deletedMessageIds.length > 0) {
      // 基于删除的消息ID失效相关摘要
      const { error } = await supabase
        .from('chat_summaries')
        .update({ 
          is_active: false, 
          invalidated_at: new Date().toISOString() 
        })
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .or(deletedMessageIds.map(id => 
          `and(start_message_id.lte.${id},end_message_id.gte.${id})`
        ).join(','))
      
      if (error) {
        console.error('❌ 摘要失效更新失败:', error)
      } else {
        console.log('✅ 已失效受影响的摘要')
      }
    }

    // 检查是否有孤立的超级摘要需要失效
    const { data: superSummaries } = await supabase
      .from('chat_summaries')
      .select('*, parent_summaries')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .gt('summary_level', 1)

    if (superSummaries && superSummaries.length > 0) {
      for (const superSummary of superSummaries) {
        if (superSummary.parent_summaries && superSummary.parent_summaries.length > 0) {
          // 检查父摘要是否仍然有效
          const { data: parentSummaries } = await supabase
            .from('chat_summaries')
            .select('id')
            .in('id', superSummary.parent_summaries)
            .eq('is_active', true)

          const activeParentCount = parentSummaries?.length || 0
          const expectedParentCount = superSummary.parent_summaries.length

          // 如果父摘要大部分已失效，则失效超级摘要
          if (activeParentCount < expectedParentCount * 0.5) {
            await supabase
              .from('chat_summaries')
              .update({ 
                is_active: false, 
                invalidated_at: new Date().toISOString() 
              })
              .eq('id', superSummary.id)
            
            console.log(`⚠️ 超级摘要${superSummary.id}的父摘要大部分已失效，已自动失效`)
          }
        }
      }
    }
  } catch (error) {
    console.error('🔥 摘要失效检测失败:', error)
  }
}

// 智能重建摘要系统
export const rebuildSummarySystem = async (params: {
  sessionId: string
  userId: string
  currentMessages: ChatMessage[]
  characterName: string
  apiKey: string
  model: string
  accessToken: string
  baseUrl?: string
  actualModel?: string
  thinkingBudget?: number
}): Promise<{ summaries: string[], actualSummarizedCount: number }> => {
  try {
    console.log('🔄 开始智能重建摘要系统...')
    
    // 1. 失效所有现有摘要
    await supabase
      .from('chat_summaries')
      .update({ 
        is_active: false, 
        invalidated_at: new Date().toISOString() 
      })
      .eq('session_id', params.sessionId)
      .eq('user_id', params.userId)
      .eq('is_active', true)

    // 2. 重新生成摘要
    const config = { summaryThreshold: 20 } // 使用默认配置
    let newSummaries: string[] = []
    let messageIndex = 0
    
    while (messageIndex + config.summaryThreshold < params.currentMessages.length) {
      const messagesToSummarize = params.currentMessages.slice(
        messageIndex, 
        messageIndex + config.summaryThreshold
      )
      
      if (messagesToSummarize.length >= config.summaryThreshold) {
        const newSummary = await generateSummary({
          sessionId: params.sessionId,
          userId: params.userId,
          startMessageId: messagesToSummarize[0]?.id || 0,
          endMessageId: messagesToSummarize[messagesToSummarize.length - 1]?.id || 0,
          characterName: params.characterName,
          apiKey: params.apiKey,
          model: params.model,
          accessToken: params.accessToken,
          baseUrl: params.baseUrl,
          actualModel: params.actualModel
        })
        
        if (newSummary) {
          newSummaries.push(newSummary.content)
          console.log(`✨ 重建摘要${newSummaries.length}: ${newSummary.content.substring(0, 50)}...`)
        }
      }
      
      messageIndex += config.summaryThreshold
    }

    // 3. 使用8-5-3策略自动压缩摘要
    while (newSummaries.length >= 8) {
      console.log(`🎯 重建过程中检测到${newSummaries.length}个摘要，应用8-5-3压缩策略...`)
      
      // 获取要压缩的摘要（最早的5个）
      const { data: summariesToCompress } = await supabase
        .from('chat_summaries')
        .select('*')
        .eq('session_id', params.sessionId)
        .eq('user_id', params.userId)
        .eq('is_active', true)
        .eq('summary_level', 1)
        .order('created_at', { ascending: true })
        .limit(5)
      
      if (summariesToCompress && summariesToCompress.length >= 5) {
        console.log(`🔄 重建中压缩最早的${summariesToCompress.length}条摘要，保留最近的${newSummaries.length - 5}条`)
        
        const superSummary = await generateSuperSummary({
          sessionId: params.sessionId,
          userId: params.userId,
          summariesToCompress,
          characterName: params.characterName,
          apiKey: params.apiKey,
          model: params.model,
          accessToken: params.accessToken,
          baseUrl: params.baseUrl,
          actualModel: params.actualModel,
          thinkingBudget: params.thinkingBudget
        })
        
        if (superSummary) {
          // 重新计算摘要数量
          const { data: updatedSummaries } = await supabase
            .from('chat_summaries')
            .select('*')
            .eq('session_id', params.sessionId)
            .eq('user_id', params.userId)
            .eq('is_active', true)
            .eq('summary_level', 1)
          
          newSummaries = updatedSummaries?.map(s => s.content) || []
          console.log(`🏆 重建压缩成功，当前一级摘要数：${newSummaries.length}`)
        } else {
          break // 压缩失败，退出循环
        }
      } else {
        break // 没有足够的摘要可压缩
      }
    }

    // 4. 获取最终的摘要列表
    const finalSummaries = await getSummaries(params.sessionId, params.userId)
    console.log(`✅ 摘要系统重建完成，共${finalSummaries.length}个有效摘要`)
    
    return {
      summaries: finalSummaries.map(s => s.content),
      actualSummarizedCount: finalSummaries.filter(s => s.summary_level === 1).length * config.summaryThreshold
    }
    
  } catch (error) {
    console.error('❌ 摘要系统重建失败:', error)
    return { summaries: [], actualSummarizedCount: 0 }
  }
}

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
        maxContextTokens: 20000,  // 增加到20k，Gemini 2.5支持更大上下文
        reservedTokens: 2000,     // 相应增加预留空间
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
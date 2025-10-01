import { createAsyncThunk } from '@reduxjs/toolkit'
import { supabase, type ChatMessage, type ChatSummary } from './supabase'
import { ContextManager, ContextConfig } from './contextManager'


// 获取摘要覆盖的消息范围
async function getSummaryCoverageRanges(sessionId: string, userId: string): Promise<{start: number, end: number}[]> {
  try {
    const { data: summaries, error } = await supabase
      .from('chat_summaries')
      .select('start_message_id, end_message_id')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .not('start_message_id', 'is', null)
      .not('end_message_id', 'is', null)
      .order('start_message_id', { ascending: true })

    if (error || !summaries) {
      console.warn('获取摘要覆盖范围失败:', error)
      return []
    }

    // 合并重叠或连续的范围
    const ranges: {start: number, end: number}[] = []
    for (const summary of summaries) {
      const newRange = { start: summary.start_message_id, end: summary.end_message_id }

      // 尝试与现有范围合并
      let merged = false
      for (let i = 0; i < ranges.length; i++) {
        const existingRange = ranges[i]

        // 检查是否重叠或连续
        if (newRange.start <= existingRange.end + 1 && newRange.end >= existingRange.start - 1) {
          // 合并范围
          ranges[i] = {
            start: Math.min(existingRange.start, newRange.start),
            end: Math.max(existingRange.end, newRange.end)
          }
          merged = true
          break
        }
      }

      if (!merged) {
        ranges.push(newRange)
      }
    }

    ranges.sort((a, b) => a.start - b.start)
    console.log('📊 摘要覆盖范围:', ranges)
    return ranges
  } catch (error) {
    console.error('获取摘要覆盖范围时出错:', error)
    return []
  }
}

// 获取记忆表格数据
async function getMemoryTableData(sessionId: string, userId: string): Promise<string> {
  try {
    const { data: memories, error } = await supabase
      .from('chat_memories')
      .select('type, title, content, importance, metadata')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .gte('importance', 5) // 只包含重要度5分以上的记忆
      .order('importance', { ascending: false })
      .limit(20) // 最多20条记忆

    if (error || !memories || memories.length === 0) {
      console.log('📋 没有可用的记忆表格数据')
      return ''
    }

    // 按类型分组记忆
    const groupedMemories = memories.reduce((groups: any, memory) => {
      if (!groups[memory.type]) {
        groups[memory.type] = []
      }
      groups[memory.type].push(memory)
      return groups
    }, {})

    let memoryText = '\n【重要记忆表格】\n'

    // 按类型输出记忆
    if (groupedMemories.character) {
      memoryText += '\n👤 人物记忆:\n'
      groupedMemories.character.forEach((m: any) => {
        memoryText += `• ${m.title} (重要度${m.importance}): ${m.content}\n`
        if (m.metadata) {
          const meta = m.metadata
          if (meta.name) memoryText += `  姓名: ${meta.name}\n`
          if (meta.relationship) memoryText += `  关系: ${meta.relationship}\n`
          if (meta.nickname) memoryText += `  称呼: ${meta.nickname}\n`
        }
      })
    }

    if (groupedMemories.event) {
      memoryText += '\n📅 事件记忆:\n'
      groupedMemories.event.forEach((m: any) => {
        memoryText += `• ${m.title} (重要度${m.importance}): ${m.content}\n`
        if (m.metadata) {
          const meta = m.metadata
          if (meta.time) memoryText += `  时间: ${meta.time}\n`
          if (meta.location) memoryText += `  地点: ${meta.location}\n`
          if (meta.participants) memoryText += `  参与者: ${meta.participants.join(', ')}\n`
        }
      })
    }

    if (groupedMemories.setting) {
      memoryText += '\n🏛️ 设定记忆:\n'
      groupedMemories.setting.forEach((m: any) => {
        memoryText += `• ${m.title} (重要度${m.importance}): ${m.content}\n`
        if (m.metadata?.location) memoryText += `  地点: ${m.metadata.location}\n`
        if (m.metadata?.atmosphere) memoryText += `  氛围: ${m.metadata.atmosphere}\n`
      })
    }

    if (groupedMemories.emotion) {
      memoryText += '\n💭 情感记忆:\n'
      groupedMemories.emotion.forEach((m: any) => {
        memoryText += `• ${m.title} (重要度${m.importance}): ${m.content}\n`
        if (m.metadata) {
          const meta = m.metadata
          if (meta.emotion_type) memoryText += `  情感: ${meta.emotion_type}\n`
          if (meta.intensity) memoryText += `  强度: ${meta.intensity}/10\n`
        }
      })
    }

    if (groupedMemories.spacetime) {
      memoryText += '\n⏰ 时空记忆:\n'
      groupedMemories.spacetime.forEach((m: any) => {
        memoryText += `• ${m.title} (重要度${m.importance}): ${m.content}\n`
        if (m.metadata) {
          const meta = m.metadata
          if (meta.date) memoryText += `  日期: ${meta.date}\n`
          if (meta.time) memoryText += `  时间: ${meta.time}\n`
          if (meta.location) memoryText += `  地点: ${meta.location}\n`
          if (meta.characters) memoryText += `  在场角色: ${meta.characters.join(', ')}\n`
        }
      })
    }

    if (groupedMemories.relationship) {
      memoryText += '\n🤝 关系记忆:\n'
      groupedMemories.relationship.forEach((m: any) => {
        memoryText += `• ${m.title} (重要度${m.importance}): ${m.content}\n`
        if (m.metadata) {
          const meta = m.metadata
          if (meta.character_name) memoryText += `  角色: ${meta.character_name}\n`
          if (meta.relationship) memoryText += `  关系: ${meta.relationship}\n`
          if (meta.attitude) memoryText += `  态度: ${meta.attitude}\n`
          if (meta.affection) memoryText += `  好感度: ${meta.affection}/10\n`
          if (meta.trust) memoryText += `  信任度: ${meta.trust}/10\n`
        }
      })
    }

    if (groupedMemories.task) {
      memoryText += '\n📋 任务约定:\n'
      groupedMemories.task.forEach((m: any) => {
        memoryText += `• ${m.title} (重要度${m.importance}): ${m.content}\n`
        if (m.metadata) {
          const meta = m.metadata
          if (meta.task_type) memoryText += `  类型: ${meta.task_type}\n`
          if (meta.scheduled_time) memoryText += `  约定时间: ${meta.scheduled_time}\n`
          if (meta.status) memoryText += `  状态: ${meta.status}\n`
          if (meta.priority) memoryText += `  优先级: ${meta.priority}\n`
        }
      })
    }

    if (groupedMemories.item) {
      memoryText += '\n📦 重要物品:\n'
      groupedMemories.item.forEach((m: any) => {
        memoryText += `• ${m.title} (重要度${m.importance}): ${m.content}\n`
        if (m.metadata) {
          const meta = m.metadata
          if (meta.item_name) memoryText += `  物品名: ${meta.item_name}\n`
          if (meta.owner) memoryText += `  拥有者: ${meta.owner}\n`
          if (meta.location) memoryText += `  位置: ${meta.location}\n`
          if (meta.emotional_value) memoryText += `  情感价值: ${meta.emotional_value}/10\n`
        }
      })
    }

    console.log(`🧠 获取到${memories.length}条记忆表格数据`)
    return memoryText

  } catch (error) {
    console.error('获取记忆表格数据失败:', error)
    return ''
  }
}

// 构建最终上下文函数
async function buildFinalContext(params: {
  contextManager: ContextManager
  systemPrompt: string
  currentMessages: ChatMessage[]
  summaries: string[]
  sessionId: string
  userId: string
}) {
  const { contextManager, systemPrompt, currentMessages, summaries, sessionId, userId } = params

  // 如果有摘要，根据实际覆盖范围智能跳过消息
  let messagesToProcess = currentMessages
  if (summaries.length > 0) {
    const config = contextManager.getConfig()

    // 获取摘要覆盖的消息范围
    const coverageRanges = await getSummaryCoverageRanges(sessionId, userId)

    if (coverageRanges.length > 0) {
      // 计算被覆盖的消息数量
      const coveredMessageIds = new Set<number>()
      for (const range of coverageRanges) {
        for (let id = range.start; id <= range.end; id++) {
          coveredMessageIds.add(id)
        }
      }

      // 筛选出未被摘要覆盖的消息
      const uncoveredMessages = currentMessages.filter(msg => !coveredMessageIds.has(msg.id))

      // 如果有未覆盖的消息，使用它们；否则保留最近的消息
      if (uncoveredMessages.length > 0) {
        messagesToProcess = uncoveredMessages
        console.log(`🧠 智能摘要模式: ${summaries.length}个摘要，覆盖${coveredMessageIds.size}条消息，使用${messagesToProcess.length}条未覆盖消息`)
      } else {
        // 如果所有消息都被覆盖，保留最近的几条消息
        const minMessages = Math.min(config.keepRecentMessages, currentMessages.length)
        messagesToProcess = currentMessages.slice(-minMessages)
        console.log(`⚠️ 所有消息都被摘要覆盖，强制保留最近${minMessages}条消息`)
      }
    } else {
      // 如果无法获取覆盖范围，降级到保留最近消息
      const minMessages = Math.min(config.keepRecentMessages, currentMessages.length)
      messagesToProcess = currentMessages.slice(-minMessages)
      console.log(`⚠️ 无法获取摘要覆盖范围，保留最近${minMessages}条消息`)
    }
  } else {
    console.log(`📝 无摘要模式: 处理全部${messagesToProcess.length}条消息`)
  }

  // 获取记忆表格数据
  const memoryTableData = await getMemoryTableData(sessionId, userId)
  console.log(`🧠 记忆表格数据长度: ${memoryTableData.length} 字符`)
  if (memoryTableData) {
    console.log(`🧠 记忆表格预览: ${memoryTableData.substring(0, 200)}...`)
  }

  const finalSummaries = summaries.length > 0 ? summaries : undefined
  console.log(`🎯 传递给buildContext的摘要:`, finalSummaries ? finalSummaries.map((s, i) => `[${i+1}] ${s.substring(0, 50)}...`) : '无摘要')

  // 将记忆表格数据附加到系统提示词中
  const enhancedSystemPrompt = memoryTableData
    ? systemPrompt + memoryTableData
    : systemPrompt
  console.log(`🎯 最终系统提示词长度: ${enhancedSystemPrompt.length} 字符 (原始: ${systemPrompt.length}, 记忆表格: ${memoryTableData.length})`)

  return await contextManager.buildContext({
    systemPrompt: enhancedSystemPrompt,
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

    // 4. 获取现有摘要（不自动生成新摘要）
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      throw new Error('用户未登录')
    }

    const existingSummaries = await getSummaries(sessionId, session.user.id)
    const summaries = existingSummaries.map(s => s.content)

    // 5. 构建最终上下文
    const context = await buildFinalContext({
      contextManager,
      systemPrompt,
      currentMessages,
      summaries,
      sessionId,
      userId: session.user.id
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
      throw new Error("AI模型返回空响应，可能是内容被过滤。")
      //throw new Error(`Failed to get AI response: ${response.status} ${errorText}`)
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
    
    // 3. 获取现有摘要（不自动生成新摘要）
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      throw new Error('用户未登录')
    }

    const existingSummaries = await getSummaries(sessionId, session.user.id)
    const summaries = existingSummaries.map(s => s.content)

    // 4. 构建最终上下文
    const context = await buildFinalContext({
      contextManager,
      systemPrompt,
      currentMessages: filteredMessages,
      summaries,
      sessionId,
      userId: session.user.id
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

    // 摘要重建完成，无需压缩

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
  // 根据不同模型提供不同的配置建议（已移除summaryThreshold，摘要由记忆管理器手动控制）
  switch (true) {
    case model.includes('gpt-4'):
      return {
        maxContextTokens: 8000,
        reservedTokens: 1500,
        keepRecentMessages: 15  // GPT-4可以处理更多消息
      }
    case model.includes('gpt-3.5'):
      return {
        maxContextTokens: 4000,
        reservedTokens: 1000,
        keepRecentMessages: 10
      }
    case model.includes('gemini'):
      return {
        maxContextTokens: 20000,  // Gemini 2.5支持更大上下文
        reservedTokens: 2000,
        keepRecentMessages: 20   // 利用更大的上下文
      }
    case model.includes('deepseek'):
      return {
        maxContextTokens: 4000,
        reservedTokens: 1000,
        keepRecentMessages: 10
      }
    default:
      return {
        maxContextTokens: 4000,
        reservedTokens: 1000,
        keepRecentMessages: 10
      }
  }
}
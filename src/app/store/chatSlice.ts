import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { supabase } from '../lib/supabase'
import { sendMessageWithContext, regenerateMessageWithContext } from '../lib/enhancedChatSlice'

export interface ChatMessage {
  id: number
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  type: 'message' | 'diary' | 'forum_post'
  created_at: string
}

export interface ChatSession {
  id: string
  user_id: string
  character_id: number
  title?: string
  created_at: string
}

export interface Character {
  id: number
  user_id: string
  name: string
  avatar_url?: string
  prompt_template: any
  is_public: boolean
  created_at: string
}

interface ChatState {
  currentSession: ChatSession | null
  currentCharacter: Character | null
  messages: ChatMessage[]
  isLoading: boolean
  isGenerating: boolean
  isLoadingMessages: boolean
  isLoadingMoreMessages: boolean
  hasMoreMessages: boolean
  error: string | null
  selectedModel: string | null
  sessionTitle: string
}

const initialState: ChatState = {
  currentSession: null,
  currentCharacter: null,
  messages: [],
  isLoading: false,
  isGenerating: false,
  isLoadingMessages: false,
  isLoadingMoreMessages: false,
  hasMoreMessages: true,
  error: null,
  selectedModel: null,
  sessionTitle: ''
}

// 获取角色信息
export const fetchCharacter = createAsyncThunk(
  'chat/fetchCharacter',
  async (characterId: number) => {
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('id', characterId)
      .single()

    if (error) throw error
    return data
  }
)

// 创建新的聊天会话
export const createChatSession = createAsyncThunk(
  'chat/createSession',
  async ({ characterId, title, userId }: { characterId: number, title: string, userId: string }) => {
    // 首先检查是否已存在该角色的会话
    const { data: existingSession, error: checkError } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('character_id', characterId)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 是"没有找到行"的错误，这是正常的
      throw checkError
    }

    // 如果已存在会话，返回现有会话
    if (existingSession) {
      return existingSession
    }

    // 如果不存在，创建新会话
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: userId,
        character_id: characterId,
        title: title
      })
      .select()
      .single()

    if (error) throw error
    return data
  }
)

// 获取角色现有会话
export const getExistingSession = createAsyncThunk(
  'chat/getExistingSession',
  async ({ characterId, userId }: { characterId: number, userId: string }) => {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('character_id', characterId)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    return data || null
  }
)

// 更新会话标题
export const updateSessionTitle = createAsyncThunk(
  'chat/updateSessionTitle',
  async ({ sessionId, title }: { sessionId: string, title: string }) => {
    const { data, error } = await supabase
      .from('chat_sessions')
      .update({ title })
      .eq('id', sessionId)
      .select()
      .single()

    if (error) throw error
    return data
  }
)

// 获取聊天会话信息
export const fetchChatSession = createAsyncThunk(
  'chat/fetchSession',
  async (sessionId: string) => {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (error) throw error
    return data
  }
)

// 获取聊天消息（用于UI显示，固定10条进行lazy loading）
export const fetchMessages = createAsyncThunk(
  'chat/fetchMessages',
  async (sessionId: string) => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false }) // 倒序获取最新的消息
      .limit(10) // 只获取最新的10条消息用于UI显示

    if (error) throw error
    return data ? data.reverse() : [] // 翻转顺序以保持时间顺序
  }
)

// 获取完整的消息历史（用于API调用，不限制数量）
export const fetchAllMessagesForAPI = createAsyncThunk(
  'chat/fetchAllMessagesForAPI',
  async (sessionId: string) => {
    try {
      console.log('📡 开始获取完整消息历史，sessionId:', sessionId)
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true }) // 正序获取完整历史

      if (error) {
        console.error('💥 Supabase查询失败:', error)
        throw error
      }
      
      console.log('✅ 成功获取消息:', data?.length || 0, '条')
      return data || []
    } catch (error) {
      console.error('💥 fetchAllMessagesForAPI失败:', error)
      throw error
    }
  }
)

// 获取更多历史消息（分页加载）
export const fetchMoreMessages = createAsyncThunk(
  'chat/fetchMoreMessages',
  async ({ 
    sessionId, 
    beforeTimestamp, 
    limit = 10 
  }: { 
    sessionId: string; 
    beforeTimestamp?: string;
    limit?: number;
  }) => {
    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false }) // 倒序获取更早的消息
      .limit(limit)

    // 如果提供了时间戳，则获取该时间戳之前的消息
    if (beforeTimestamp) {
      query = query.lt('created_at', beforeTimestamp)
    }

    const { data, error } = await query

    if (error) throw error
    return data ? data.reverse() : [] // 翻转顺序以保持时间顺序
  }
)

// 发送消息并获取AI回复
export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async ({
    sessionId,
    userMessage,
    systemPrompt,
    apiKey,
    model,
    messages,
    thinkingBudget,
    baseUrl,
    actualModel,
    speakingCharacterId
  }: {
    sessionId: string
    userMessage: string
    systemPrompt: string
    apiKey: string
    model: string
    messages: ChatMessage[]
    thinkingBudget?: number
    baseUrl?: string
    actualModel?: string
    speakingCharacterId?: string
  }) => {
    let userMsgData = null
    
    // 只有当用户消息不为空时才保存用户消息
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

    // 构建消息历史
    const messageHistory = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }))

    // 只有当用户消息不为空时才添加到历史中
    if (userMessage.trim()) {
      messageHistory.push({
        role: 'user',
        content: userMessage
      })
    }

    // 调用后端API获取AI回复
    const requestBody: any = {
      messages: messageHistory,
      systemPrompt,
      apiKey,
      model
    }

    // 只有Gemini 2.5系列模型才添加thinkingBudget
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
      messages: messageHistory.length,
      systemPrompt: systemPrompt ? `${systemPrompt.length} chars` : 'undefined',
      apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'undefined',
      model,
      thinkingBudget: requestBody.thinkingBudget
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

    // 检查是否使用了API池系统
    if (aiResponse.apiUsed) {
      console.log(`✅ 使用了API池: ${aiResponse.apiUsed}${aiResponse.fallbackUsed ? ' (故障切换)' : ''}`)
    }

    // 保存AI消息
    const aiMsgInsert: any = {
      session_id: sessionId,
      role: 'assistant',
      content: aiResponse.content
    }

    // 如果有剧本角色ID，添加到消息中
    if (speakingCharacterId) {
      aiMsgInsert.speaker_script_character_id = speakingCharacterId
    }

    const { data: aiMsgData, error: aiMsgError } = await supabase
      .from('chat_messages')
      .insert(aiMsgInsert)
      .select()
      .single()

    if (aiMsgError) throw aiMsgError

    return {
      userMessage: userMsgData,
      aiMessage: aiMsgData,
      // 传递API池信息给前端
      ...(aiResponse.apiUsed && { apiUsed: aiResponse.apiUsed }),
      ...(aiResponse.fallbackUsed && { fallbackUsed: aiResponse.fallbackUsed }),
      ...(aiResponse.apiId && { apiId: aiResponse.apiId })
    }
  }
)

// 重新生成最后一条AI消息
export const regenerateLastMessage = createAsyncThunk(
  'chat/regenerateLastMessage',
  async ({
    sessionId,
    systemPrompt,
    apiKey,
    model,
    messages,
    lastMessageId,
    thinkingBudget,
    baseUrl,
    actualModel
  }: {
    sessionId: string
    systemPrompt: string
    apiKey: string
    model: string
    messages: ChatMessage[]
    lastMessageId: number
    thinkingBudget?: number
    baseUrl?: string
    actualModel?: string
  }) => {
    // 构建消息历史（不包含要重新生成的消息）
    const messageHistory = messages
      .filter(msg => msg.id !== lastMessageId)
      .map(msg => ({
        role: msg.role,
        content: msg.content
      }))

    // 调用后端API获取新的AI回复
    const requestBody: any = {
      messages: messageHistory,
      systemPrompt,
      apiKey,
      model
    }

    // 只有Gemini 2.5系列模型才添加thinkingBudget
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

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      throw new Error('Failed to regenerate AI response')
    }

    const aiResponse = await response.json()

    // 检查是否使用了API池系统
    if (aiResponse.apiUsed) {
      console.log(`✅ 重新生成消息使用API池: ${aiResponse.apiUsed}${aiResponse.fallbackUsed ? ' (故障切换)' : ''}`)
    }

    // 更新数据库中的消息内容
    const { data: updatedMsg, error: updateError } = await supabase
      .from('chat_messages')
      .update({ content: aiResponse.content })
      .eq('id', lastMessageId)
      .select()
      .single()

    if (updateError) throw updateError

    return {
      ...updatedMsg,
      // 传递API池信息给前端
      ...(aiResponse.apiUsed && { apiUsed: aiResponse.apiUsed }),
      ...(aiResponse.fallbackUsed && { fallbackUsed: aiResponse.fallbackUsed }),
      ...(aiResponse.apiId && { apiId: aiResponse.apiId })
    }
  }
)

// 编辑消息
export const editMessage = createAsyncThunk(
  'chat/editMessage',
  async ({
    messageId,
    newContent
  }: {
    messageId: number
    newContent: string
  }) => {
    const { data: updatedMsg, error } = await supabase
      .from('chat_messages')
      .update({ content: newContent })
      .eq('id', messageId)
      .select()
      .single()

    if (error) throw error

    return updatedMsg
  }
)

// 删除消息
export const deleteMessage = createAsyncThunk(
  'chat/deleteMessage',
  async ({
    messageId
  }: {
    messageId: number
  }) => {
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', messageId)

    if (error) throw error

    return messageId
  }
)

// 重新发送用户消息并替换对应的AI回复
export const resendUserMessage = createAsyncThunk(
  'chat/resendUserMessage',
  async ({
    sessionId,
    userMessageId,
    userContent,
    systemPrompt,
    apiKey,
    model,
    messages,
    thinkingBudget,
    baseUrl,
    actualModel
  }: {
    sessionId: string
    userMessageId: number
    userContent: string
    systemPrompt: string
    apiKey: string
    model: string
    messages: ChatMessage[]
    thinkingBudget?: number
    baseUrl?: string
    actualModel?: string
  }) => {
    // 构建消息历史（排除当前用户消息及其之后的所有消息）
    const userMessageIndex = messages.findIndex(msg => msg.id === userMessageId)
    const messageHistory = messages
      .slice(0, userMessageIndex) // 只包含用户消息之前的消息
      .map(msg => ({
        role: msg.role,
        content: msg.content
      }))

    // 添加当前用户消息
    messageHistory.push({
      role: 'user',
      content: userContent
    })

    // 调用后端API获取AI回复
    const requestBody: any = {
      messages: messageHistory,
      systemPrompt,
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

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      throw new Error('Failed to resend user message')
    }

    const aiResponse = await response.json()

    // 查找该用户消息对应的AI回复
    const nextAiMessage = messages.find((msg, index) => 
      index > userMessageIndex && msg.role === 'assistant'
    )

    if (nextAiMessage) {
      // 更新现有的AI消息
      const { data: updatedMsg, error: updateError } = await supabase
        .from('chat_messages')
        .update({ content: aiResponse.content })
        .eq('id', nextAiMessage.id)
        .select()
        .single()

      if (updateError) throw updateError
      return updatedMsg
    } else {
      // 如果没有对应的AI回复，创建新的AI消息
      const { data: newAiMsg, error: newAiMsgError } = await supabase
        .from('chat_messages')
        .insert({
          session_id: sessionId,
          role: 'assistant',
          content: aiResponse.content
        })
        .select()
        .single()

      if (newAiMsgError) throw newAiMsgError
      return newAiMsg
    }
  }
)

// 从某条消息发送新的消息
export const sendNewMessageFrom = createAsyncThunk(
  'chat/sendNewMessageFrom',
  async ({
    sessionId,
    systemPrompt,
    apiKey,
    model,
    messages,
    fromMessageId,
    thinkingBudget,
    baseUrl,
    actualModel
  }: {
    sessionId: string
    systemPrompt: string
    apiKey: string
    model: string
    messages: ChatMessage[]
    fromMessageId: number
    thinkingBudget?: number
    baseUrl?: string
    actualModel?: string
  }) => {
    // 构建消息历史（包含到指定消息为止的所有消息）
    const fromMessageIndex = messages.findIndex(msg => msg.id === fromMessageId)
    const messageHistory = messages
      .slice(0, fromMessageIndex + 1)
      .map(msg => ({
        role: msg.role,
        content: msg.content
      }))

    // 调用后端API获取AI回复
    const requestBody: any = {
      messages: messageHistory,
      systemPrompt,
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

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      throw new Error('Failed to send new message')
    }

    const aiResponse = await response.json()

    // 保存新的AI消息
    const { data: newAiMsg, error: newAiMsgError } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        role: 'assistant',
        content: aiResponse.content
      })
      .select()
      .single()

    if (newAiMsgError) throw newAiMsgError

    return newAiMsg
  }
)

// 清空聊天记录并重新开始对话
export const clearChatHistory = createAsyncThunk(
  'chat/clearChatHistory',
  async ({ 
    sessionId, 
    systemPrompt, 
    apiKey, 
    model,
    initialMessage 
  }: { 
    sessionId: string
    systemPrompt: string
    apiKey: string
    model: string
    initialMessage?: string
  }, { dispatch }) => {
    // 1. 先删除相关的日记（避免外键约束冲突）
    const { error: diaryError } = await supabase
      .from('diaries')
      .delete()
      .eq('session_id', sessionId)

    if (diaryError) {
      console.error('Failed to delete diaries:', diaryError)
      // 不阻止整个流程，只记录错误
    }

    // 2. 删除相关的摘要
    const { error: summaryError } = await supabase
      .from('chat_summaries')
      .delete()
      .eq('session_id', sessionId)

    if (summaryError) {
      console.error('Failed to delete summaries:', summaryError)
      // 不阻止整个流程，只记录错误
    }

    // 3. 然后删除消息
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('session_id', sessionId)

    if (error) {
      throw new Error('Failed to delete messages from database')
    }

    // 4. 清空本地状态的消息
    dispatch(clearMessages())

    // 5. 检查是否有初始对话
    if (initialMessage && initialMessage.trim()) {
      // 使用初始对话
      const { data: aiMsgData, error: aiMsgError } = await supabase
        .from('chat_messages')
        .insert({
          session_id: sessionId,
          role: 'assistant',
          content: initialMessage.trim()
        })
        .select()
        .single()

      if (aiMsgError) throw aiMsgError
      return aiMsgData
    } else {
      // 使用AI生成开场
      const requestBody: any = {
        messages: [],
        systemPrompt: systemPrompt + '\n\n现在请你作为角色主动开始对话，根据初始情景开始我们的故事。',
        apiKey,
        model
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        throw new Error('Failed to restart conversation')
      }

      const aiResponse = await response.json()

      // 5. 保存AI的开场消息
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
      return aiMsgData
    }
  }
)

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setSelectedModel: (state, action: PayloadAction<string>) => {
      state.selectedModel = action.payload
    },
    setSessionTitle: (state, action: PayloadAction<string>) => {
      state.sessionTitle = action.payload
    },
    clearMessages: (state) => {
      state.messages = []
      state.error = null
    },
    setMessages: (state, action: PayloadAction<ChatMessage[]>) => {
      state.messages = action.payload
    },
    clearError: (state) => {
      state.error = null
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Character
      .addCase(fetchCharacter.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchCharacter.fulfilled, (state, action) => {
        state.isLoading = false
        state.currentCharacter = action.payload
        // 只在没有sessionTitle时才使用角色名称作为默认值
        if (!state.sessionTitle) {
          state.sessionTitle = action.payload.name
        }
      })
      .addCase(fetchCharacter.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.error.message || 'Failed to fetch character'
      })
      
      // Create Session
      .addCase(createChatSession.pending, (state) => {
        state.isLoading = true
      })
      .addCase(createChatSession.fulfilled, (state, action) => {
        state.isLoading = false
        state.currentSession = action.payload
      })
      .addCase(createChatSession.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.error.message || 'Failed to create session'
      })
      
      // Fetch Session
      .addCase(fetchChatSession.fulfilled, (state, action) => {
        state.currentSession = action.payload
        state.sessionTitle = action.payload.title || ''
      })
      
      // Get Existing Session
      .addCase(getExistingSession.fulfilled, (state, action) => {
        // 这个action主要用于检查，不需要更新state
        // 返回值会在组件中处理
      })
      .addCase(getExistingSession.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to check existing session'
      })
      
      // Update Session Title
      .addCase(updateSessionTitle.fulfilled, (state, action) => {
        state.currentSession = action.payload
        state.sessionTitle = action.payload.title || ''
      })
      .addCase(updateSessionTitle.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to update session title'
      })
      
      // Fetch Messages
      .addCase(fetchMessages.pending, (state) => {
        state.isLoadingMessages = true
        state.error = null
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        state.isLoadingMessages = false
        state.messages = action.payload
        state.hasMoreMessages = action.payload.length >= 10 // 如果返回等于10条，可能还有更多消息
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        state.isLoadingMessages = false
        state.error = action.error.message || 'Failed to fetch messages'
      })

      // Fetch All Messages For API (不更新UI状态，只用于获取完整历史)
      .addCase(fetchAllMessagesForAPI.fulfilled, (state, action) => {
        // 这个action不需要更新UI状态，只是为了获取完整的消息历史
        // 实际使用时会在组件中直接使用返回的数据
      })
      .addCase(fetchAllMessagesForAPI.rejected, (state, action) => {
        console.error('Failed to fetch all messages for API:', action.error.message)
      })

      // Fetch More Messages
      .addCase(fetchMoreMessages.pending, (state) => {
        state.isLoadingMoreMessages = true
        state.error = null
      })
      .addCase(fetchMoreMessages.fulfilled, (state, action) => {
        state.isLoadingMoreMessages = false
        // 在消息列表前面添加更早的消息
        state.messages = [...action.payload, ...state.messages]
        state.hasMoreMessages = action.payload.length >= 10 // 如果返回的消息等于10条，可能还有更多
      })
      .addCase(fetchMoreMessages.rejected, (state, action) => {
        state.isLoadingMoreMessages = false
        state.error = action.error.message || 'Failed to fetch more messages'
      })
      
      // Send Message
      .addCase(sendMessage.pending, (state, action) => {
        state.isGenerating = true
        state.error = null
        // 如果有用户消息，立即添加到消息列表中显示
        if (action.meta.arg.userMessage.trim()) {
          const tempUserMessage = {
            id: Date.now(), // 临时ID
            session_id: action.meta.arg.sessionId,
            role: 'user' as const,
            content: action.meta.arg.userMessage,
            type: 'message' as const,
            created_at: new Date().toISOString()
          }
          state.messages.push(tempUserMessage)
        }
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.isGenerating = false
        // 如果有用户消息，需要更新临时消息的ID为真实ID
        if (action.payload.userMessage) {
          // 找到刚才添加的临时用户消息并更新ID
          // 从后往前查找最后一个用户消息的索引
          let lastUserMsgIndex = -1
          for (let i = state.messages.length - 1; i >= 0; i--) {
            if (state.messages[i].role === 'user') {
              lastUserMsgIndex = i
              break
            }
          }
          if (lastUserMsgIndex !== -1) {
            state.messages[lastUserMsgIndex] = action.payload.userMessage
          }
        }
        // 添加AI回复
        state.messages.push(action.payload.aiMessage)
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.isGenerating = false
        state.error = action.error.message || 'Failed to send message'
      })

      // Enhanced Send Message With Context
      .addCase(sendMessageWithContext.pending, (state, action) => {
        state.isGenerating = true
        state.error = null
        // 添加临时用户消息到状态中（如果有用户消息）
        if (action.meta.arg.userMessage.trim()) {
          const tempUserMessage = {
            id: -Date.now(), // 临时ID
            session_id: action.meta.arg.sessionId,
            role: 'user' as const,
            content: action.meta.arg.userMessage,
            type: 'message' as const,
            created_at: new Date().toISOString()
          }
          state.messages.push(tempUserMessage)
        }
      })
      .addCase(sendMessageWithContext.fulfilled, (state, action) => {
        state.isGenerating = false
        // 如果有用户消息，需要更新临时消息的ID为真实ID
        if (action.payload.userMessage) {
          // 从后往前查找最后一个用户消息的索引
          let lastUserMsgIndex = -1
          for (let i = state.messages.length - 1; i >= 0; i--) {
            if (state.messages[i].role === 'user') {
              lastUserMsgIndex = i
              break
            }
          }
          if (lastUserMsgIndex !== -1) {
            state.messages[lastUserMsgIndex] = action.payload.userMessage
          }
        }
        // 添加AI回复
        state.messages.push(action.payload.aiMessage)
      })
      .addCase(sendMessageWithContext.rejected, (state, action) => {
        state.isGenerating = false
        state.error = action.error.message || 'Failed to send message with context'
      })
      
      // Regenerate Message
      .addCase(regenerateLastMessage.pending, (state) => {
        state.isGenerating = true
        state.error = null
      })
      .addCase(regenerateLastMessage.fulfilled, (state, action) => {
        state.isGenerating = false
        // 直接更新对应ID的消息
        const messageIndex = state.messages.findIndex(msg => msg.id === action.payload.id)
        if (messageIndex !== -1) {
          state.messages[messageIndex] = action.payload
        }
      })
      .addCase(regenerateLastMessage.rejected, (state, action) => {
        state.isGenerating = false
        state.error = action.error.message || 'Failed to regenerate message'
      })
      
      // Regenerate Message with Context
      .addCase(regenerateMessageWithContext.pending, (state) => {
        state.isGenerating = true
        state.error = null
      })
      .addCase(regenerateMessageWithContext.fulfilled, (state, action) => {
        state.isGenerating = false
        // 直接更新对应ID的消息
        const messageIndex = state.messages.findIndex(msg => msg.id === action.payload.id)
        if (messageIndex !== -1) {
          state.messages[messageIndex] = action.payload
        }
      })
      .addCase(regenerateMessageWithContext.rejected, (state, action) => {
        state.isGenerating = false
        state.error = action.error.message || 'Failed to regenerate message with context'
      })

      // Edit Message
      .addCase(editMessage.pending, (state) => {
        state.error = null
      })
      .addCase(editMessage.fulfilled, (state, action) => {
        // 更新对应ID的消息
        const messageIndex = state.messages.findIndex(msg => msg.id === action.payload.id)
        if (messageIndex !== -1) {
          state.messages[messageIndex] = action.payload
        }
      })
      .addCase(editMessage.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to edit message'
      })

      // Delete Message
      .addCase(deleteMessage.pending, (state) => {
        state.error = null
      })
      .addCase(deleteMessage.fulfilled, (state, action) => {
        // 从消息列表中移除被删除的消息
        state.messages = state.messages.filter(msg => msg.id !== action.payload)
      })
      .addCase(deleteMessage.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to delete message'
      })

      // Resend User Message
      .addCase(resendUserMessage.pending, (state) => {
        state.isGenerating = true
        state.error = null
      })
      .addCase(resendUserMessage.fulfilled, (state, action) => {
        state.isGenerating = false
        // 更新或添加AI回复消息
        const existingIndex = state.messages.findIndex(msg => msg.id === action.payload.id)
        if (existingIndex !== -1) {
          // 更新现有消息
          state.messages[existingIndex] = action.payload
        } else {
          // 添加新的AI消息
          state.messages.push(action.payload)
        }
      })
      .addCase(resendUserMessage.rejected, (state, action) => {
        state.isGenerating = false
        state.error = action.error.message || 'Failed to resend user message'
      })

      // Send New Message From
      .addCase(sendNewMessageFrom.pending, (state) => {
        state.isGenerating = true
        state.error = null
      })
      .addCase(sendNewMessageFrom.fulfilled, (state, action) => {
        state.isGenerating = false
        // 添加新的AI消息到消息列表
        state.messages.push(action.payload)
      })
      .addCase(sendNewMessageFrom.rejected, (state, action) => {
        state.isGenerating = false
        state.error = action.error.message || 'Failed to send new message'
      })
      
      // Clear Chat History
      .addCase(clearChatHistory.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(clearChatHistory.fulfilled, (state, action) => {
        state.isLoading = false
        // 添加AI的新开场消息
        state.messages.push(action.payload)
      })
      .addCase(clearChatHistory.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.error.message || 'Failed to clear chat history'
      })
  }
})

export const { 
  setSelectedModel, 
  setSessionTitle, 
  clearMessages, 
  setMessages,
  clearError 
} = chatSlice.actions

export default chatSlice.reducer 
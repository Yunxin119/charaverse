import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { supabase } from '../lib/supabase'

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

// 获取聊天消息
export const fetchMessages = createAsyncThunk(
  'chat/fetchMessages',
  async (sessionId: string) => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
  }
)

// 获取更多历史消息（分页加载）
export const fetchMoreMessages = createAsyncThunk(
  'chat/fetchMoreMessages',
  async ({ sessionId, offset, limit = 50 }: { sessionId: string; offset: number; limit?: number }) => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false }) // 倒序获取更早的消息
      .range(offset, offset + limit - 1)

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
    thinkingBudget
  }: { 
    sessionId: string
    userMessage: string
    systemPrompt: string
    apiKey: string
    model: string
    messages: ChatMessage[]
    thinkingBudget?: number
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

    // 保存AI消息
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

    return {
      userMessage: userMsgData,
      aiMessage: aiMsgData
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
    thinkingBudget
  }: {
    sessionId: string
    systemPrompt: string
    apiKey: string
    model: string
    messages: ChatMessage[]
    lastMessageId: number
    thinkingBudget?: number
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

    // 更新数据库中的消息内容
    const { data: updatedMsg, error: updateError } = await supabase
      .from('chat_messages')
      .update({ content: aiResponse.content })
      .eq('id', lastMessageId)
      .select()
      .single()

    if (updateError) throw updateError

    return updatedMsg
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
    thinkingBudget
  }: {
    sessionId: string
    systemPrompt: string
    apiKey: string
    model: string
    messages: ChatMessage[]
    fromMessageId: number
    thinkingBudget?: number
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
    model 
  }: { 
    sessionId: string
    systemPrompt: string
    apiKey: string
    model: string
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

    // 2. 然后删除消息
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('session_id', sessionId)

    if (error) {
      throw new Error('Failed to delete messages from database')
    }

    // 3. 清空本地状态的消息
    dispatch(clearMessages())

    // 4. 让AI重新开始对话
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
        state.sessionTitle = action.payload.name
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
      
      // Fetch Messages
      .addCase(fetchMessages.pending, (state) => {
        state.isLoadingMessages = true
        state.error = null
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        state.isLoadingMessages = false
        state.messages = action.payload
        state.hasMoreMessages = action.payload.length >= 50 // 如果返回50条或更多，可能还有更多消息
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        state.isLoadingMessages = false
        state.error = action.error.message || 'Failed to fetch messages'
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
        state.hasMoreMessages = action.payload.length >= 50 // 如果返回的消息少于50条，说明没有更多了
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
          const lastUserMsgIndex = state.messages.length - 1 - [...state.messages].reverse().findIndex(msg => msg.role === 'user')
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
  clearError 
} = chatSlice.actions

export default chatSlice.reducer 
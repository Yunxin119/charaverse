'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { 
  Send, 
  Settings, 
  RefreshCw, 
  Edit2,
  X,
  Bot,
  User,
  AlertCircle,
  MessageSquarePlus,
  Save,
  ArrowLeft,
  ChevronRight,
  BookOpen,
  Trash2
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAppSelector, useAppDispatch } from '../../store/hooks'
import { 
  fetchCharacter, 
  fetchChatSession, 
  fetchMessages, 
  createChatSession,
  sendMessage,
  regenerateLastMessage,
  editMessage,
  deleteMessage,
  sendNewMessageFrom,
  setSelectedModel,
  setSessionTitle,
  clearError
} from '../../store/chatSlice'
import { supabase } from '../../lib/supabase'
import { sendMessageWithContext, getContextConfigSuggestions, regenerateMessageWithContext } from '../../lib/enhancedChatSlice'

interface APIConfig {
  deepseek?: string
  gemini?: string
  openai?: string
}

interface NamedRelayConfig {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  modelName: string
  description?: string
  supportsThinking?: boolean
  thinkingBudgetMode?: 'auto' | 'manual'
  thinkingBudget?: number
}

export default function ChatSessionPage() {
  const params = useParams()
  const router = useRouter()
  const dispatch = useAppDispatch()
  
  const { user } = useAppSelector((state) => state.auth)
  const { 
    currentSession, 
    currentCharacter, 
    messages, 
    isLoading, 
    isGenerating, 
    error, 
    selectedModel,
    sessionTitle 
  } = useAppSelector((state) => state.chat)

  const [userInput, setUserInput] = useState('')
  const [lastFailedInput, setLastFailedInput] = useState('') // 用于恢复失败的消息
  const [apiConfig, setApiConfig] = useState<APIConfig>({})
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [hasStarted, setHasStarted] = useState(false)
  const [thinkingBudget, setThinkingBudget] = useState(0)
  const [thinkingBudgetMode, setThinkingBudgetMode] = useState<'auto' | 'manual'>('auto')
  const [currentSelectedModel, setCurrentSelectedModel] = useState<string>('')
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [isStartingStory, setIsStartingStory] = useState(false)
  const [chatBackground, setChatBackground] = useState<string | null>(null)
  
  // 从localStorage加载上下文配置
  const [contextConfig, setContextConfig] = useState({
    maxContextTokens: 4000,
    reservedTokens: 1000,
    enableSummary: true,
    summaryThreshold: 20,
    keepRecentMessages: 10
  })
  const [useEnhancedContext, setUseEnhancedContext] = useState(true) // 默认开启智能模式以节省tokens
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sessionId = params.sessionId as string
  
  // 加载保存的上下文配置
  useEffect(() => {
    const savedContextConfig = localStorage.getItem(`context_config_${sessionId}`)
    console.log('🔧 加载上下文配置:', {
      sessionId,
      savedConfig: savedContextConfig,
      currentConfig: contextConfig
    })
    
    if (savedContextConfig) {
      try {
        const config = JSON.parse(savedContextConfig)
        console.log('✅ 应用保存的配置:', config)
        setContextConfig(prev => ({ ...prev, ...config }))
      } catch (e) {
        console.warn('Failed to parse saved context config')
      }
    } else {
      console.log('ℹ️ 没有保存的配置，使用默认配置')
    }
    
    const savedUseEnhanced = localStorage.getItem(`use_enhanced_context_${sessionId}`)
    if (savedUseEnhanced) {
      setUseEnhancedContext(savedUseEnhanced === 'true')
    } else {
      // 如果没有保存的设置，默认开启智能模式
      setUseEnhancedContext(true)
      localStorage.setItem(`use_enhanced_context_${sessionId}`, 'true')
    }
  }, [sessionId])

  // 监听localStorage变化，实时更新配置
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `context_config_${sessionId}` && e.newValue) {
        try {
          const config = JSON.parse(e.newValue)
          console.log('📡 检测到配置变化，更新:', config)
          setContextConfig(prev => ({ ...prev, ...config }))
        } catch (e) {
          console.warn('Failed to parse updated context config')
        }
      }
      
      if (e.key === `use_enhanced_context_${sessionId}` && e.newValue !== null) {
        console.log('📡 检测到智能模式切换:', e.newValue)
        setUseEnhancedContext(e.newValue === 'true')
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [sessionId])

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // 加载API配置
  useEffect(() => {
    const loadApiConfig = () => {
      const config: APIConfig = {}
      const deepseek = localStorage.getItem('api_key_deepseek')
      const gemini = localStorage.getItem('api_key_gemini')
      const openai = localStorage.getItem('api_key_openai')
      
      if (deepseek) config.deepseek = deepseek
      if (gemini) config.gemini = gemini
      if (openai) config.openai = openai
      
      setApiConfig(config)
      
      // 根据可用API设置可选模型
      const models: string[] = []
      if (deepseek) {
        models.push('deepseek-chat', 'deepseek-coder')
      }
      if (gemini) {
        models.push('gemini-2.5-flash', 'gemini-2.5-pro')
      }
      if (openai) {
        models.push('gpt-4o', 'gpt-4o-mini')
      }
      
      // 加载命名的中转配置并添加到可用模型
      const savedNamedConfigs = localStorage.getItem('named_relay_configs')
      if (savedNamedConfigs) {
        try {
          const namedConfigs: NamedRelayConfig[] = JSON.parse(savedNamedConfigs)
          namedConfigs.forEach((namedConfig) => {
            models.push(`named-relay-${namedConfig.id}`)
          })
        } catch (e) {
          console.warn('Failed to parse named relay configs')
        }
      }
      
      setAvailableModels(models)
      
      // 如果没有任何模型可用，确保用户能看到错误提示
      if (models.length === 0) {
        console.warn('No models available - user needs to configure API keys')
      }
    }

    loadApiConfig()
  }, [])

  // 初始化页面数据
  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }

    const initializeChat = async () => {
      if (sessionId === 'new') {
        const urlParams = new URLSearchParams(window.location.search)
        const characterId = urlParams.get('characterId')
        
        if (characterId) {
          dispatch(fetchCharacter(Number(characterId)))
        }
      } else {
        const session = await dispatch(fetchChatSession(sessionId)).unwrap()
        dispatch(fetchMessages(sessionId))
        
        if (session.character_id) {
          dispatch(fetchCharacter(session.character_id))
        }
        
        setHasStarted(true)
      }
    }

    initializeChat()
  }, [sessionId, user, dispatch, router])

  // 同步模型选择状态
  useEffect(() => {
    // 加载保存的模型选择
    const savedModel = localStorage.getItem(`chat_model_${sessionId}`)
    if (savedModel && availableModels.includes(savedModel)) {
      setCurrentSelectedModel(savedModel)
      dispatch(setSelectedModel(savedModel))
    } else if (selectedModel) {
      setCurrentSelectedModel(selectedModel)
    } else if (availableModels.length > 0) {
      // 如果没有保存的模型，使用第一个可用模型
      const defaultModel = availableModels[0]
      setCurrentSelectedModel(defaultModel)
      dispatch(setSelectedModel(defaultModel))
      localStorage.setItem(`chat_model_${sessionId}`, defaultModel)
    }
  }, [selectedModel, availableModels, sessionId, dispatch])

  useEffect(() => {
    const savedBg = localStorage.getItem(`chat_background_${sessionId}`)
    if (savedBg) {
      setChatBackground(savedBg)
    }

    // 监听localStorage变化（跨窗口）
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `chat_background_${sessionId}`) {
        setChatBackground(e.newValue)
      }
    }

    // 监听自定义背景变更事件（同窗口）
    const handleCustomBackgroundChange = (e: CustomEvent) => {
      if (e.detail.sessionId === sessionId) {
        setChatBackground(e.detail.background)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('chatBackgroundChanged', handleCustomBackgroundChange as EventListener)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('chatBackgroundChanged', handleCustomBackgroundChange as EventListener)
    }
  }, [sessionId])

  // 构建系统提示
  const buildSystemPrompt = () => {
    if (!currentCharacter?.prompt_template) {
      console.warn('角色或prompt_template为空')
      return ''
    }
    
    const { basic_info, modules } = currentCharacter.prompt_template
    
    if (!basic_info || !basic_info.name) {
      console.error('basic_info无效:', basic_info)
      return ''
    }
    
    let prompt = `来玩角色扮演，接下来，你将完全成为"${basic_info.name}"与我对话。注意回复简短自然，日常对话即可。你不可以自己预测我的行为。你必须给予回复。\n\n`
    
    prompt += `【你的角色】\n`
    prompt += `${basic_info.name}\n`
    if (basic_info.gender) {
      const genderMap: { [key: string]: string } = {
        'male': '男',
        'female': '女',
        'none': '无性别',
        'other': '其他'
      }
      prompt += `性别：${genderMap[basic_info.gender] || basic_info.gender}\n`
    }
    if (basic_info.age) prompt += `年龄：${basic_info.age}\n`
    if (basic_info.description) prompt += `${basic_info.description}\n`
    prompt += `\n`
    
    modules?.forEach((module: any) => {
      if (module.type === '用户角色设定' && (module.userRoleName || module.userRoleAge || module.userRoleGender || module.userRoleDetails)) {
        prompt += `【用户的角色】\n`
        if (module.userRoleName) prompt += `${module.userRoleName}\n`
        if (module.userRoleGender) {
          const genderMap: { [key: string]: string } = {
            'male': '男',
            'female': '女',
            'none': '无性别',
            'other': '其他'
          }
          prompt += `性别：${genderMap[module.userRoleGender] || module.userRoleGender}\n`
        }
        if (module.userRoleAge) prompt += `年龄：${module.userRoleAge}\n`
        if (module.userRoleDetails) prompt += `${module.userRoleDetails}\n`
        prompt += `\n`
      } else if (module.type === '注意事项' && module.content.trim()) {
        prompt += `【注意事项】\n\n${module.content}\n\n`
      } else if (module.type === '初始情景' && module.content.trim()) {
        prompt += `【初始情景】\n\n${module.content}\n\n`
      } else if (module.type === '特殊要求' && module.content.trim()) {
        prompt += `【特殊要求】\n\n${module.content}\n\n`
      } else if (module.type === '自定义模块' && module.name && module.content.trim()) {
        prompt += `【${module.name}】\n\n${module.content}\n\n`
      }
    })
    
    const finalPrompt = prompt.trim()
    return finalPrompt
  }

  // 预览系统提示词
  const previewSystemPrompt = () => {
    const prompt = buildSystemPrompt()
    console.log('系统提示词:', prompt)
    alert('系统提示词已输出到控制台，请按F12查看')
  }

  // 获取thinking budget值
  const getThinkingBudget = (model: string) => {
    console.log('🧠 Getting thinking budget for model:', model)
    
    // 检查是否是命名中转配置
    if (model.startsWith('named-relay-')) {
      const configId = model.replace('named-relay-', '')
      console.log('🔍 Looking for config ID:', configId)
      
      const savedNamedConfigs = localStorage.getItem('named_relay_configs')
      console.log('💾 Raw localStorage data:', savedNamedConfigs)
      
      if (savedNamedConfigs) {
        try {
          const namedConfigs: NamedRelayConfig[] = JSON.parse(savedNamedConfigs)
          console.log('📋 Parsed configs:', namedConfigs)
          
          const config = namedConfigs.find(c => c.id === configId)
          console.log('🎯 Found matching config:', config)
          
          if (config) {
            console.log('📊 Config details:')
            console.log('  - supportsThinking:', config.supportsThinking)
            console.log('  - thinkingBudgetMode:', config.thinkingBudgetMode)
            console.log('  - thinkingBudget:', config.thinkingBudget)
            
            if (config.supportsThinking) {
              if (config.thinkingBudgetMode === 'manual') {
                const budget = config.thinkingBudget || 0
                console.log('✅ Manual mode, returning budget:', budget)
                return budget
              } else {
                console.log('✅ Auto mode, returning undefined')
                return undefined // auto模式
              }
            } else {
              console.log('❌ Thinking not supported for this config')
            }
          } else {
            console.log('❌ No matching config found for ID:', configId)
          }
        } catch (e) {
          console.warn('❌ Failed to parse named relay configs:', e)
        }
      } else {
        console.log('❌ No named_relay_configs found in localStorage')
      }
      return undefined
    }
    
    // 原有的Gemini模型逻辑
    if (model === 'gemini-2.5-pro') {
      console.log('✅ Gemini 2.5 Pro: using auto mode')
      return undefined // Pro版本始终使用auto模式
    } else if (model === 'gemini-2.5-flash') {
      const result = thinkingBudgetMode === 'auto' ? undefined : thinkingBudget
      console.log('✅ Gemini 2.5 Flash: mode=', thinkingBudgetMode, 'returning=', result)
      return result
    } else {
      console.log('❌ Model does not support thinking:', model)
      return undefined // 其他模型不支持
    }
  }

  // 开始故事
  const handleStartStory = async () => {
    if (!currentSelectedModel || !currentCharacter || !user) return

    setIsStartingStory(true)
    setHasStarted(true)

    try {
      const session = await dispatch(createChatSession({
        characterId: currentCharacter.id,
        title: sessionTitle,
        userId: user.id
      })).unwrap()

      // 检查是否是新创建的会话（通过检查是否有消息来判断）
      const { data: existingMessages } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('session_id', session.id)
        .limit(1)

      // 如果已有消息，说明是现有会话，直接跳转
      if (existingMessages && existingMessages.length > 0) {
        router.replace(`/chat/${session.id}`)
        return
      }

      // 检查角色是否有初始对话
      const initialMessage = currentCharacter?.prompt_template?.basic_info?.initialMessage
      
      if (initialMessage && initialMessage.trim()) {
        // 使用初始对话，直接保存到数据库
        const { data: aiMsgData, error: aiMsgError } = await supabase
          .from('chat_messages')
          .insert({
            session_id: session.id,
            role: 'assistant',
            content: initialMessage.trim()
          })
          .select()
          .single()

        if (aiMsgError) throw aiMsgError

        // 重新获取消息来更新Redux状态
        dispatch(fetchMessages(session.id))
      } else {
        // 没有初始对话，使用AI生成
        const systemPrompt = buildSystemPrompt()
        const modelConfig = getModelConfig(currentSelectedModel)
        
        if (!modelConfig.apiKey) {
          throw new Error('未找到对应的API密钥')
        }

        if (!systemPrompt || systemPrompt.trim() === '') {
          throw new Error('系统提示词为空，请检查角色配置')
        }

        await dispatch(sendMessage({
          sessionId: session.id,
          userMessage: '',
          systemPrompt: systemPrompt + '\n\n现在请你作为角色主动开始对话，根据初始情景开始我们的故事。',
          apiKey: modelConfig.apiKey,
          model: currentSelectedModel,
          messages: [],
          thinkingBudget: getThinkingBudget(currentSelectedModel),
          baseUrl: modelConfig.isRelay ? modelConfig.baseUrl : undefined,
          actualModel: modelConfig.isRelay ? modelConfig.modelName : undefined
        }))
      }

      // 保存使用的模型
      localStorage.setItem(`chat_model_${session.id}`, currentSelectedModel)

      router.replace(`/chat/${session.id}`)
    } catch (error) {
      console.error('开始故事失败:', error)
      alert(`开始故事失败: ${error}`)
      setHasStarted(false) // 发生错误时回到配置界面
      setIsStartingStory(false)
    } finally {
      setIsStartingStory(false)
    }
  }

  // 发送用户消息
  const handleSendMessage = async () => {
    if (!userInput.trim() || !currentSession || !currentSelectedModel || isGenerating) return

    if (!currentCharacter) {
      console.error('角色数据丢失，尝试重新加载')
      if (currentSession?.character_id) {
        await dispatch(fetchCharacter(currentSession.character_id))
      }
      return
    }

    const messageToSend = userInput.trim()
    const systemPrompt = buildSystemPrompt()
    const modelConfig = getModelConfig(currentSelectedModel)
    
    if (!modelConfig.apiKey) {
      console.error('没有找到API密钥')
      return
    }

    if (!systemPrompt || systemPrompt.trim() === '') {
      console.error('系统提示词为空，角色数据可能有问题')
      alert('系统提示词为空，请检查角色配置或刷新页面重试')
      return
    }

    // 立即清空输入框
    setUserInput('')
    setLastFailedInput('')

    try {
      if (useEnhancedContext) {
        await dispatch(sendMessageWithContext({
          sessionId: currentSession.id,
          userMessage: messageToSend,
          systemPrompt,
          apiKey: modelConfig.apiKey,
          model: currentSelectedModel,
          messages,
          thinkingBudget: getThinkingBudget(currentSelectedModel),
          contextConfig,
          characterName: currentCharacter?.name || '角色',
          baseUrl: modelConfig.isRelay ? modelConfig.baseUrl : undefined,
          actualModel: modelConfig.isRelay ? modelConfig.modelName : undefined
        }))
      } else {
        await dispatch(sendMessage({
          sessionId: currentSession.id,
          userMessage: messageToSend,
          systemPrompt,
          apiKey: modelConfig.apiKey,
          model: currentSelectedModel,
          messages,
          thinkingBudget: getThinkingBudget(currentSelectedModel),
          baseUrl: modelConfig.isRelay ? modelConfig.baseUrl : undefined,
          actualModel: modelConfig.isRelay ? modelConfig.modelName : undefined
        }))
      }
    } catch (error) {
      console.error('发送消息失败:', error)
      // 发送失败时恢复输入框内容
      setLastFailedInput(messageToSend)
      setUserInput(messageToSend)
    }
  }

  // 重新生成消息
  const handleRegenerateMessage = async (messageId: number) => {
    if (!currentSession || !currentSelectedModel || isGenerating) return

    const systemPrompt = buildSystemPrompt()
    const modelConfig = getModelConfig(currentSelectedModel)
    
    if (!modelConfig.apiKey) return

    try {
      if (useEnhancedContext) {
        // 使用智能上下文管理重新生成
        await dispatch(regenerateMessageWithContext({
          sessionId: currentSession.id,
          systemPrompt,
          apiKey: modelConfig.apiKey,
          model: currentSelectedModel,
          messages,
          lastMessageId: messageId,
          thinkingBudget: getThinkingBudget(currentSelectedModel),
          contextConfig,
          characterName: currentCharacter?.name || '角色',
          baseUrl: modelConfig.isRelay ? modelConfig.baseUrl : undefined,
          actualModel: modelConfig.isRelay ? modelConfig.modelName : undefined
        }))
      } else {
        // 使用原有的重新生成方式
        await dispatch(regenerateLastMessage({
          sessionId: currentSession.id,
          systemPrompt,
          apiKey: modelConfig.apiKey,
          model: currentSelectedModel,
          messages,
          lastMessageId: messageId,
          thinkingBudget: getThinkingBudget(currentSelectedModel),
          baseUrl: modelConfig.isRelay ? modelConfig.baseUrl : undefined,
          actualModel: modelConfig.isRelay ? modelConfig.modelName : undefined
        }))
      }
    } catch (error) {
      console.error('重新生成消息失败:', error)
    }
  }

  // 获取模型的完整配置
  const getModelConfig = (model: string) => {
    // 处理命名中转配置
    if (model.startsWith('named-relay-')) {
      const configId = model.replace('named-relay-', '')
      try {
        const savedNamedConfigs = localStorage.getItem('named_relay_configs')
        if (savedNamedConfigs) {
          const namedConfigs: NamedRelayConfig[] = JSON.parse(savedNamedConfigs)
          const config = namedConfigs.find(c => c.id === configId)
          if (config) {
            return {
              apiKey: config.apiKey,
              baseUrl: config.baseUrl,
              modelName: config.modelName,
              isRelay: true
            }
          }
        }
      } catch (e) {
        console.warn('Failed to parse named relay configs')
      }
    }
    
    // 处理标准模型
    let apiKey: string | null = null
    if (model.startsWith('deepseek')) apiKey = apiConfig.deepseek || null
    else if (model.startsWith('gemini')) apiKey = apiConfig.gemini || null
    else if (model.startsWith('gpt')) apiKey = apiConfig.openai || null
    
    return {
      apiKey,
      isRelay: false
    }
  }


  // 模型显示名称
  const getModelDisplayName = (model: string) => {
    if (model.startsWith('named-relay-')) {
      const configId = model.replace('named-relay-', '')
      try {
        const savedNamedConfigs = localStorage.getItem('named_relay_configs')
        if (savedNamedConfigs) {
          const namedConfigs: NamedRelayConfig[] = JSON.parse(savedNamedConfigs)
          const config = namedConfigs.find(c => c.id === configId)
          if (config) return config.name
        }
      } catch (e) {
        console.warn('Failed to parse named relay configs')
      }
      return `中转配置 ${configId}`
    }
    
    const modelNames: Record<string, string> = {
      'deepseek-chat': 'DeepSeek Chat',
      'deepseek-coder': 'DeepSeek Coder',
      'gemini-2.5-flash': 'Gemini 2.5 Flash',
      'gemini-2.5-pro': 'Gemini 2.5 Pro',
      'gpt-4o': 'GPT-4o',
      'gpt-4o-mini': 'GPT-4o Mini'
    }
    
    return modelNames[model] || model
  }

  // 处理模型选择变化
  const handleModelChange = (model: string) => {
    setCurrentSelectedModel(model)
    dispatch(setSelectedModel(model))
    if (sessionId && sessionId !== 'new') {
      localStorage.setItem(`chat_model_${sessionId}`, model)
    }
  }

  // 处理消息点击
  const handleMessageClick = (messageId: number) => {
    if (selectedMessageId === messageId) {
      setSelectedMessageId(null)
    } else {
      setSelectedMessageId(messageId)
      setEditingMessageId(null)
    }
  }

  // 编辑相关功能
  const handleEditMessage = (messageId: number, content: string) => {
    setEditingMessageId(messageId)
    setEditingContent(content)
    setSelectedMessageId(null)
  }

  const handleSaveEdit = async () => {
    if (!editingMessageId || !editingContent.trim()) return
    
    try {
      await dispatch(editMessage({
        messageId: editingMessageId,
        newContent: editingContent.trim()
      }))
      
      setEditingMessageId(null)
      setEditingContent('')
    } catch (error) {
      console.error('保存编辑失败:', error)
    }
  }

  const handleCancelEdit = () => {
    setEditingMessageId(null)
    setEditingContent('')
  }

  // 消息操作相关功能
  const handleSendNewMessageFrom = async (messageId: number) => {
    if (!currentSession || !currentSelectedModel || isGenerating) return

    const systemPrompt = buildSystemPrompt()
    const modelConfig = getModelConfig(currentSelectedModel)
    
    if (!modelConfig.apiKey || !systemPrompt) return

    try {
      await dispatch(sendNewMessageFrom({
        sessionId: currentSession.id,
        systemPrompt,
        apiKey: modelConfig.apiKey,
        model: currentSelectedModel,
        messages,
        fromMessageId: messageId,
        thinkingBudget: getThinkingBudget(currentSelectedModel),
        baseUrl: modelConfig.isRelay ? modelConfig.baseUrl : undefined,
        actualModel: modelConfig.isRelay ? modelConfig.modelName : undefined
      }))
      
      setSelectedMessageId(null)
    } catch (error) {
      console.error('发送新消息失败:', error)
    }
  }

  // 重新发送用户消息（生成AI回复）
  const handleResendMessage = async (messageId: number) => {
    if (!currentSession || !currentSelectedModel || isGenerating) return

    // 找到要重新发送的用户消息
    const userMessage = messages.find(msg => msg.id === messageId)
    if (!userMessage || userMessage.role !== 'user') return

    const systemPrompt = buildSystemPrompt()
    const modelConfig = getModelConfig(currentSelectedModel)
    
    if (!modelConfig.apiKey || !systemPrompt) return

    try {
      if (useEnhancedContext) {
        await dispatch(sendMessageWithContext({
          sessionId: currentSession.id,
          userMessage: userMessage.content,
          systemPrompt,
          apiKey: modelConfig.apiKey,
          model: currentSelectedModel,
          messages: messages.filter(msg => msg.id !== messageId), // 排除当前消息
          thinkingBudget: getThinkingBudget(currentSelectedModel),
          contextConfig,
          characterName: currentCharacter?.name || '角色',
          baseUrl: modelConfig.isRelay ? modelConfig.baseUrl : undefined,
          actualModel: modelConfig.isRelay ? modelConfig.modelName : undefined
        }))
      } else {
        await dispatch(sendMessage({
          sessionId: currentSession.id,
          userMessage: userMessage.content,
          systemPrompt,
          apiKey: modelConfig.apiKey,
          model: currentSelectedModel,
          messages: messages.filter(msg => msg.id !== messageId), // 排除当前消息
          thinkingBudget: getThinkingBudget(currentSelectedModel),
          baseUrl: modelConfig.isRelay ? modelConfig.baseUrl : undefined,
          actualModel: modelConfig.isRelay ? modelConfig.modelName : undefined
        }))
      }
      
      setSelectedMessageId(null)
    } catch (error) {
      console.error('重新发送消息失败:', error)
    }
  }

  const handleDeleteMessage = async (messageId: number) => {
    if (!window.confirm('确定要删除这条消息吗？此操作不可撤销。')) return
    
    try {
      await dispatch(deleteMessage({ messageId }))
      setSelectedMessageId(null)
      setEditingMessageId(null)
    } catch (error) {
      console.error('删除消息失败:', error)
    }
  }


  // 检查是否有任何可用的API配置
  const hasAnyApiConfig = () => {
    if (Object.keys(apiConfig).length > 0) return true
    
    try {
      const savedNamedConfigs = localStorage.getItem('named_relay_configs')
      if (savedNamedConfigs) {
        const namedConfigs: NamedRelayConfig[] = JSON.parse(savedNamedConfigs)
        return namedConfigs.length > 0
      }
    } catch (e) {
      console.warn('Failed to parse named relay configs')
    }
    
    return false
  }

  // 如果没有任何API配置
  if (!hasAnyApiConfig()) {
    return (
      <div className="h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="w-12 h-12 mx-auto text-amber-500" />
            <h3 className="text-lg font-semibold">需要配置API密钥</h3>
            <p className="text-slate-600 text-sm">
              你似乎还没有配置API密钥，请前往设置页面配置你的AI服务密钥或中转API服务。
            </p>
            <Button onClick={() => router.push('/settings')} className="w-full">
              <Settings className="w-4 h-4 mr-2" />
              前往设置
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 mx-auto animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
          <p className="text-slate-600">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="h-screen bg-slate-50 flex flex-col transition-all duration-300"
      style={{
        backgroundImage: chatBackground ? `url(${chatBackground})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* 固定头部 */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/characters')}
              className="p-2 h-8 w-8"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            {hasStarted && currentCharacter && (
              <div className="flex items-center space-x-2">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={currentCharacter.avatar_url} />
                  <AvatarFallback>{currentCharacter.name?.[0]}</AvatarFallback>
                </Avatar>
                <h2 className="text-base font-semibold truncate">
                  {sessionTitle || currentCharacter.name}
                </h2>
              </div>
            )}
          </div>
          
          <div className="flex-1 flex justify-center min-w-0">
            {!hasStarted && (
              <h2 className="text-lg font-semibold truncate">
                {sessionTitle || currentCharacter?.name}
              </h2>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {hasStarted && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => router.push(`/chat/${sessionId}/diary`)}
                className="p-2 h-8 w-8"
                title="查看日记"
              >
                <BookOpen className="w-4 h-4" />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => router.push(`/chat/${sessionId}/settings`)}
              className="p-2 h-8 w-8"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>


      {/* 消息区域 - 占据剩余空间 */}
      <div className="flex-1 overflow-hidden">
        {!hasStarted ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center">
            <Avatar className="w-20 h-20 mb-4">
              <AvatarImage src={currentCharacter?.avatar_url} />
              <AvatarFallback className="text-3xl">
                {currentCharacter?.name?.[0]}
              </AvatarFallback>
            </Avatar>
            <h2 className="text-2xl font-bold mb-1">{currentCharacter?.name}</h2>
            <p className="text-slate-500 mb-6">准备好开始对话了吗？</p>
            
            <div className="w-full max-w-xs space-y-3">
              <p className="text-slate-500 text-sm text-center">
                可以在设置中选择AI模型和配置上下文管理
              </p>
              
              <Button
                onClick={handleStartStory}
                disabled={!currentSelectedModel || isStartingStory}
                size="lg"
                className="w-full"
              >
                {isStartingStory ? '正在开始...' : '开始对话'}
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        ) : (
          // 消息列表区域
          <div 
            className="h-full overflow-y-auto px-4 py-4 space-y-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setSelectedMessageId(null)
                setEditingMessageId(null)
              }
            }}
          >
            <AnimatePresence>
              {messages.map((message, index) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex max-w-[85%] sm:max-w-[80%] space-x-2 sm:space-x-3 ${
                    message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                  }`}>
                    <Avatar className="w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0 mt-1">
                      {message.role === 'user' ? (
                        <AvatarFallback className="bg-slate-900 text-white">
                          <User className="w-3 h-3 sm:w-4 sm:h-4" />
                        </AvatarFallback>
                      ) : (
                        <>
                          <AvatarImage src={currentCharacter?.avatar_url} />
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                            {currentCharacter?.name?.[0] || <Bot className="w-3 h-3 sm:w-4 sm:h-4" />}
                          </AvatarFallback>
                        </>
                      )}
                    </Avatar>
                    
                    <div className="space-y-1 min-w-0 flex-1">
                      <div 
                        className={`p-3 sm:p-4 rounded-2xl break-words transition-all duration-200 ${
                          message.role === 'user' 
                            ? 'bg-blue-500 text-white rounded-br-md' 
                            : 'bg-white text-slate-900 border border-slate-200 rounded-bl-md hover:bg-slate-50'
                        } ${
                          selectedMessageId === message.id ? 'ring-2 ring-blue-500' : ''
                        } ${
                          'cursor-pointer'
                        }`}
                        onClick={() => handleMessageClick(message.id)}
                      >
                        {/* 编辑模式 */}
                        {editingMessageId === message.id ? (
                          <div 
                            className="space-y-3"
                            onClick={(e) => e.stopPropagation()} // 阻止事件冒泡
                          >
                            <Textarea
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              className="min-h-[100px] resize-none text-sm"
                              autoFocus
                              onClick={(e) => e.stopPropagation()} // 双重保护：阻止Textarea的点击事件冒泡
                            />
                            <div className="flex justify-end space-x-2">
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={(e) => {
                                  e.stopPropagation() // 阻止按钮点击事件冒泡
                                  handleCancelEdit()
                                }} 
                                className="h-8 px-3"
                              >
                                <X className="w-3 h-3 mr-1" />
                                取消
                              </Button>
                              <Button 
                                size="sm" 
                                onClick={(e) => {
                                  e.stopPropagation() // 阻止按钮点击事件冒泡
                                  handleSaveEdit()
                                }} 
                                className="h-8 px-3"
                              >
                                <Save className="w-3 h-3 mr-1" />
                                保存
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* 正常显示模式 */
                          <div className="prose prose-sm max-w-none">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                p: ({children}) => <p className="mb-2 last:mb-0 whitespace-pre-wrap text-sm sm:text-base leading-relaxed">{children}</p>,
                                br: () => <br />,
                                code: ({children, className}) => {
                                  const isInline = !className
                                  return isInline ? (
                                    <code className="bg-slate-200 px-1 py-0.5 rounded text-xs sm:text-sm">{children}</code>
                                  ) : (
                                    <code className="block bg-slate-200 p-2 rounded text-xs sm:text-sm overflow-x-auto">{children}</code>
                                  )
                                },
                                pre: ({children}) => <pre className="bg-slate-200 p-2 rounded overflow-x-auto">{children}</pre>,
                                blockquote: ({children}) => <blockquote className="border-l-4 border-slate-300 pl-4 italic">{children}</blockquote>,
                                strong: ({children}) => <strong className="font-semibold">{children}</strong>,
                                em: ({children}) => <em className="italic">{children}</em>,
                              }}
                              skipHtml={false}
                            >
                              {message.content.replace(/\n/g, '  \n')}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>

                      {/* 消息操作按钮 - 移动端优化 */}
                      {selectedMessageId === message.id && (
                        <div className="flex flex-wrap justify-center gap-1 mt-2">
                          {(() => {
                            const isLastMessage = index === messages.length - 1
                            
                            if (message.role === 'assistant') {
                              // AI消息的操作按钮
                              return (
                                <>
                                  {/* 只有最后一条AI消息可以重新生成 */}
                                  {isLastMessage && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleRegenerateMessage(message.id)}
                                      disabled={isGenerating}
                                      className="h-7 px-2 text-xs bg-white border border-slate-200"
                                    >
                                      <RefreshCw className={`w-3 h-3 mr-1 ${isGenerating ? 'animate-spin' : ''}`} />
                                      重新生成
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEditMessage(message.id, message.content)}
                                    className="h-7 px-2 text-xs bg-white border border-slate-200"
                                  >
                                    <Edit2 className="w-3 h-3 mr-1" />
                                    编辑
                                  </Button>
                                  {/* 续写功能保留，但不限制于最后一条 */}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleSendNewMessageFrom(message.id)}
                                    disabled={isGenerating}
                                    className="h-7 px-2 text-xs bg-white border border-slate-200"
                                  >
                                    <MessageSquarePlus className="w-3 h-3 mr-1" />
                                    续写
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteMessage(message.id)}
                                    className="h-7 px-2 text-xs bg-white border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                                  >
                                    <Trash2 className="w-3 h-3 mr-1" />
                                    删除
                                  </Button>
                                </>
                              )
                            } else {
                              // 用户消息的操作按钮
                              return (
                                <>
                                  {/* 只有最后一条用户消息可以重新发送 */}
                                  {isLastMessage && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleResendMessage(message.id)}
                                      disabled={isGenerating}
                                      className="h-7 px-2 text-xs bg-white border border-slate-200"
                                    >
                                      <RefreshCw className={`w-3 h-3 mr-1 ${isGenerating ? 'animate-spin' : ''}`} />
                                      重新发送
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEditMessage(message.id, message.content)}
                                    className="h-7 px-2 text-xs bg-white border border-slate-200"
                                  >
                                    <Edit2 className="w-3 h-3 mr-1" />
                                    编辑
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteMessage(message.id)}
                                    className="h-7 px-2 text-xs bg-white border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                                  >
                                    <Trash2 className="w-3 h-3 mr-1" />
                                    删除
                                  </Button>
                                </>
                              )
                            }
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {/* 生成中提示 - 包括开始故事时的loading */}
            {(isGenerating || isStartingStory) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="flex max-w-[85%] sm:max-w-[80%] space-x-2 sm:space-x-3">
                  <Avatar className="w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0 mt-1">
                    <AvatarImage src={currentCharacter?.avatar_url} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                      {currentCharacter?.name?.[0] || <Bot className="w-3 h-3 sm:w-4 sm:h-4" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="p-3 sm:p-4 rounded-2xl rounded-bl-md bg-white border border-slate-200">
                    <div className="flex items-center space-x-1">
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 固定底部输入框 */}
      {hasStarted && (
        <div className="bg-white/80 backdrop-blur-sm border-t border-slate-200 p-3 sm:p-4 flex-shrink-0">
          <div className="flex items-center space-x-2 sm:space-x-3 bg-slate-100/80 rounded-full p-1">
            <Textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder={
                // 检测是否为移动设备
                /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768
                  ? "输入消息... (Ctrl+Enter发送)"
                  : "输入消息... (Enter发送，Shift+Enter换行)"
              }
              className="flex-1 resize-none text-sm sm:text-base bg-transparent border-none focus:ring-0 focus:outline-none min-h-[24px] max-h-[120px] px-3 py-1.5"
              rows={1}
              onKeyDown={(e) => {
                // 检测是否为移动设备
                const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768
                
                if (e.key === 'Enter') {
                  if (isMobile) {
                    // 移动端：需要 Ctrl+Enter 或 Cmd+Enter 才发送消息
                    if (e.ctrlKey || e.metaKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                    // 普通 Enter 键不做任何处理，允许换行
                  } else {
                    // 桌面端：Enter 发送，Shift+Enter 换行
                    if (!e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }
                }
              }}
              style={{
                height: 'auto',
                minHeight: '24px'
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = Math.min(target.scrollHeight, 120) + 'px'
              }}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!userInput.trim() || isGenerating}
              className="self-end rounded-full w-8 h-8 sm:w-9 sm:h-9 p-0 flex-shrink-0 bg-blue-500 hover:bg-blue-600 text-white"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          
          {/* 错误提示 */}
          {error && (
            <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded-lg flex items-center justify-between">
              <span className="flex-1">{error}</span>
              <Button size="sm" variant="ghost" onClick={() => dispatch(clearError())} className="p-1 h-6 w-6">
                <X className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
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
  Play,
  Edit2,
  Check,
  X,
  Bot,
  User,
  AlertCircle,
  MessageSquarePlus,
  Save,
  ChevronDown,
  MoreVertical,
  Edit3,
  ArrowLeft,
  ChevronRight,
  BookOpen
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAppSelector, useAppDispatch } from '../../store/hooks'
import { 
  fetchCharacter, 
  fetchChatSession, 
  fetchMessages, 
  createChatSession,
  sendMessage,
  regenerateLastMessage,
  editMessage,
  sendNewMessageFrom,
  setSelectedModel,
  setSessionTitle,
  clearError
} from '../../store/chatSlice'
import { supabase } from '../../lib/supabase'
import { sendMessageWithContext, getContextConfigSuggestions } from '../../lib/enhancedChatSlice'

interface APIConfig {
  deepseek?: string
  gemini?: string
  openai?: string
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
  const [apiConfig, setApiConfig] = useState<APIConfig>({})
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [tempTitle, setTempTitle] = useState('')
  const [hasStarted, setHasStarted] = useState(false)
  const [thinkingBudget, setThinkingBudget] = useState(0)
  const [thinkingBudgetMode, setThinkingBudgetMode] = useState<'auto' | 'manual'>('auto')
  const [currentSelectedModel, setCurrentSelectedModel] = useState<string>('')
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [isStartingStory, setIsStartingStory] = useState(false)
  const [chatBackground, setChatBackground] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false) // 新状态，控制设置页显示
  const [currentMode, setCurrentMode] = useState<'story' | 'casual'>('story') // Phase 5: 当前聊天模式
  
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
    if (savedContextConfig) {
      try {
        const config = JSON.parse(savedContextConfig)
        setContextConfig(prev => ({ ...prev, ...config }))
      } catch (e) {
        console.warn('Failed to parse saved context config')
      }
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
      
      setAvailableModels(models)
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
    
    let prompt = `来玩角色扮演，接下来，你将完全成为"${basic_info.name}"与我对话。注意回复简短自然，日常对话即可。你不可以自己预测我的行为。\n\n`
    
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
    alert('系统提示词已输出到控制台，请按F12查看')
  }

  // 获取thinking budget值
  const getThinkingBudget = (model: string) => {
    if (model === 'gemini-2.5-pro') {
      return undefined // Pro版本始终使用auto模式
    } else if (model === 'gemini-2.5-flash') {
      return thinkingBudgetMode === 'auto' ? undefined : thinkingBudget
    } else {
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
        const apiKey = getApiKeyForModel(currentSelectedModel)
        
        if (!apiKey) {
          throw new Error('未找到对应的API密钥')
        }

        if (!systemPrompt || systemPrompt.trim() === '') {
          throw new Error('系统提示词为空，请检查角色配置')
        }

        await dispatch(sendMessage({
          sessionId: session.id,
          userMessage: '',
          systemPrompt: systemPrompt + '\n\n现在请你作为角色主动开始对话，根据初始情景开始我们的故事。',
          apiKey,
          model: currentSelectedModel,
          messages: [],
          thinkingBudget: getThinkingBudget(currentSelectedModel)
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

    const systemPrompt = buildSystemPrompt()
    const apiKey = getApiKeyForModel(currentSelectedModel)
    
    if (!apiKey) {
      console.error('没有找到API密钥')
      return
    }

    if (!systemPrompt || systemPrompt.trim() === '') {
      console.error('系统提示词为空，角色数据可能有问题')
      alert('系统提示词为空，请检查角色配置或刷新页面重试')
      return
    }

    try {
      if (useEnhancedContext) {
        // 使用增强的上下文管理
        const result = await dispatch(sendMessageWithContext({
          sessionId: currentSession.id,
          userMessage: userInput.trim(),
          systemPrompt,
          apiKey,
          model: currentSelectedModel,
          messages,
          thinkingBudget: getThinkingBudget(currentSelectedModel),
          contextConfig,
          characterName: currentCharacter?.name || '角色'
        }))
        
        // 上下文统计信息在设置页显示
      } else {
        // 使用原有的发送方式
        await dispatch(sendMessage({
          sessionId: currentSession.id,
          userMessage: userInput.trim(),
          systemPrompt,
          apiKey,
          model: currentSelectedModel,
          messages,
          thinkingBudget: getThinkingBudget(currentSelectedModel)
        }))
      }
      
      setUserInput('')
    } catch (error) {
      console.error('发送消息失败:', error)
    }
  }

  // 重新生成消息
  const handleRegenerateMessage = async (messageId: number) => {
    if (!currentSession || !currentSelectedModel || isGenerating) return

    const systemPrompt = buildSystemPrompt()
    const apiKey = getApiKeyForModel(currentSelectedModel)
    
    if (!apiKey) return

    try {
      await dispatch(regenerateLastMessage({
        sessionId: currentSession.id,
        systemPrompt,
        apiKey,
        model: currentSelectedModel,
        messages,
        lastMessageId: messageId,
        thinkingBudget: getThinkingBudget(currentSelectedModel)
      }))
    } catch (error) {
      console.error('重新生成消息失败:', error)
    }
  }

  // 获取模型对应的API密钥
  const getApiKeyForModel = (model: string): string | null => {
    if (model.startsWith('deepseek')) return apiConfig.deepseek || null
    if (model.startsWith('gemini')) return apiConfig.gemini || null
    if (model.startsWith('gpt')) return apiConfig.openai || null
    return null
  }

  // 保存会话标题
  const handleSaveTitle = () => {
    dispatch(setSessionTitle(tempTitle))
    setIsEditingTitle(false)
  }

  // 模型显示名称
  const getModelDisplayName = (model: string) => {
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
    // 保存模型选择到localStorage
    if (sessionId && sessionId !== 'new') {
      localStorage.setItem(`chat_model_${sessionId}`, model)
    }
  }

  // 处理消息点击
  const handleMessageClick = (messageId: number) => {
    setSelectedMessageId(selectedMessageId === messageId ? null : messageId)
    setEditingMessageId(null)
  }

  // 开始编辑消息
  const handleEditMessage = (messageId: number, content: string) => {
    setEditingMessageId(messageId)
    setEditingContent(content)
    setSelectedMessageId(null)
  }

  // 保存编辑的消息
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

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingMessageId(null)
    setEditingContent('')
  }

  // 发送新消息（从某条消息开始）
  const handleSendNewMessageFrom = async (messageId: number) => {
    if (!currentSession || !currentSelectedModel || isGenerating) return

    const systemPrompt = buildSystemPrompt()
    const apiKey = getApiKeyForModel(currentSelectedModel)
    
    if (!apiKey || !systemPrompt) return

    try {
      await dispatch(sendNewMessageFrom({
        sessionId: currentSession.id,
        systemPrompt,
        apiKey,
        model: currentSelectedModel,
        messages,
        fromMessageId: messageId,
        thinkingBudget: getThinkingBudget(currentSelectedModel)
      }))
      
      setSelectedMessageId(null)
    } catch (error) {
      console.error('发送新消息失败:', error)
    }
  }

  // Phase 5: 处理模式切换
  const handleModeChange = (value: string) => {
    const newMode = value as 'story' | 'casual'
    console.log(`模式切换: ${currentMode} -> ${newMode}`)
    setCurrentMode(newMode)
    // Step 1: 暂时只更新本地状态，不调用API
  }


  // 如果没有API配置
  if (Object.keys(apiConfig).length === 0) {
    return (
      <div className="h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="w-12 h-12 mx-auto text-amber-500" />
            <h3 className="text-lg font-semibold">需要配置API密钥</h3>
            <p className="text-slate-600 text-sm">
              你似乎还没有配置API密钥，请前往设置页面配置你的AI服务密钥。
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
          
          {/* Phase 5: 模式切换UI */}
          <div className="flex-1 flex justify-end mr-1 min-w-0">
            {hasStarted ? (
              <Tabs defaultValue="story" value={currentMode} onValueChange={handleModeChange}>
                <TabsList className="grid w-full grid-cols-2 h-8">
                  <TabsTrigger value="story" className="text-xs">剧情</TabsTrigger>
                  <TabsTrigger value="casual" className="text-xs">闲聊</TabsTrigger>
                </TabsList>
              </Tabs>
            ) : (
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
                          message.role === 'assistant' ? 'cursor-pointer' : ''
                        }`}
                        onClick={() => message.role === 'assistant' && handleMessageClick(message.id)}
                      >
                        {/* 编辑模式 */}
                        {editingMessageId === message.id ? (
                          <div className="space-y-3">
                            <Textarea
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              className="min-h-[100px] resize-none text-sm"
                              autoFocus
                            />
                            <div className="flex justify-end space-x-2">
                              <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="h-8 px-3">
                                <X className="w-3 h-3 mr-1" />
                                取消
                              </Button>
                              <Button size="sm" onClick={handleSaveEdit} className="h-8 px-3">
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
                      {message.role === 'assistant' && selectedMessageId === message.id && (
                        <div className="flex flex-wrap justify-center gap-1 mt-2">
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
                            onClick={() => handleSendNewMessageFrom(message.id)}
                            disabled={isGenerating}
                            className="h-7 px-2 text-xs bg-white border border-slate-200"
                          >
                            <MessageSquarePlus className="w-3 h-3 mr-1" />
                            续写
                          </Button>
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
              placeholder="输入消息..."
              className="flex-1 resize-none text-sm sm:text-base bg-transparent border-none focus:ring-0 focus:outline-none min-h-[24px] max-h-[120px] px-3 py-1.5"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
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
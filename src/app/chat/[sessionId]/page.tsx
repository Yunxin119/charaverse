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
  Trash2,
  Lightbulb
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
  fetchAllMessagesForAPI,
  fetchMoreMessages,
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
import { useApiConfig } from '../../lib/useApiConfig'

// 保留命名中转配置接口以兼容现有功能
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
    isLoadingMessages,
    isLoadingMoreMessages,
    hasMoreMessages,
    error, 
    selectedModel,
    sessionTitle 
  } = useAppSelector((state) => state.chat)

  const [userInput, setUserInput] = useState('')
  const [lastFailedInput, setLastFailedInput] = useState('') // 用于恢复失败的消息
  const inputRef = useRef<HTMLTextAreaElement>(null)
  
  // 使用新的API配置hook
  const {
    availableModels,
    getModelConfig,
    getModelDisplayName,
    markApiResult,
    hasAnyApiConfig,
    getModeDisplayText,
    getHealthStats
  } = useApiConfig()
  const [hasStarted, setHasStarted] = useState(false)
  const [thinkingBudget, setThinkingBudget] = useState(0)
  const [thinkingBudgetMode, setThinkingBudgetMode] = useState<'auto' | 'manual'>('auto')
  const [currentSelectedModel, setCurrentSelectedModel] = useState<string>('')
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [isStartingStory, setIsStartingStory] = useState(false)
  const [chatBackground, setChatBackground] = useState<string | null>(null)
  const [isGettingInspiration, setIsGettingInspiration] = useState(false)
  
  // 批量删除相关状态
  const [isBatchDeleteMode, setIsBatchDeleteMode] = useState(false)
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<number>>(new Set())
  
  
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
  const messagesContainerRef = useRef<HTMLDivElement>(null)
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
  const scrollToBottom = (behavior: 'smooth' | 'instant' = 'smooth') => {
    try {
      console.log('🔄 尝试滚动到底部, behavior:', behavior, 'messages:', messages.length)
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior })
        console.log('✅ 使用 messagesEndRef 滚动')
      } else {
        // 备用方案：直接滚动容器到底部
        if (messagesContainerRef.current) {
          const container = messagesContainerRef.current
          container.scrollTop = container.scrollHeight
          console.log('✅ 使用容器直接滚动')
        } else {
          console.warn('⚠️ 没有找到滚动目标元素')
        }
      }
    } catch (error) {
      console.warn('滚动到底部失败:', error)
    }
  }

  // 预处理文本，添加特殊格式高亮
  const preprocessMessageContent = (content: string): string => {
    let processedContent = content
    
    // 处理各种括号格式 - 深灰色
    // 处理 () 括号
    processedContent = processedContent.replace(/\(([^)]+)\)/g, '<span class="text-slate-600 font-medium">($1)</span>')
    
    // 处理 （） 中文括号
    processedContent = processedContent.replace(/（([^）]+)）/g, '<span class="text-slate-600 font-medium">（$1）</span>')
    
    // 处理 [] 方括号
    processedContent = processedContent.replace(/\[([^\]]+)\]/g, '<span class="text-slate-600 font-medium">[$1]</span>')
    
    // 处理 【】 中文方括号
    processedContent = processedContent.replace(/【([^】]+)】/g, '<span class="text-slate-600 font-medium">【$1】</span>')
    
    // 处理引号格式 - 深蓝色
    // 处理 "" 英文双引号
    processedContent = processedContent.replace(/"([^"]+)"/g, '<span class="text-blue-700 font-semibold">"$1"</span>')
    
    // 处理 "" 中文双引号
    processedContent = processedContent.replace(/"([^"]+)"/g, '<span class="text-blue-700 font-semibold">"$1"</span>')
    
    return processedContent
  }

  // 滚动到底部
  useEffect(() => {
    // 只在新消息添加时滚动到底部，不是在加载更多历史消息时
    console.log('📜 消息变化触发滚动检查:', {
      isLoadingMoreMessages,
      hasStarted, 
      messagesLength: messages.length
    })
    
    if (!isLoadingMoreMessages && hasStarted && messages.length > 0) {
      // 添加一个小延迟确保DOM已经渲染完成
      setTimeout(() => {
        scrollToBottom()
      }, 100)
    }
  }, [messages, isLoadingMoreMessages, hasStarted])

  // 页面初始化完成后自动滚动到底部
  useEffect(() => {
    console.log('🎯 初始化滚动检查:', {
      hasStarted,
      messagesLength: messages.length,
      isLoadingMessages
    })
    
    if (hasStarted && messages.length > 0 && !isLoadingMessages) {
      // 页面初始化完成，立即滚动到底部
      setTimeout(() => {
        scrollToBottom('instant')
      }, 200)
    }
  }, [hasStarted, isLoadingMessages, messages.length])

  // 懒加载：监听滚动事件
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container || !hasStarted) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      
      // 当滚动到顶部附近时加载更多消息
      if (scrollTop < 100 && hasMoreMessages && !isLoadingMoreMessages) {
        const currentScrollHeight = scrollHeight
        
        // 获取最早消息的时间戳
        const earliestMessage = messages[0]
        const beforeTimestamp = earliestMessage?.created_at
        
        dispatch(fetchMoreMessages({
          sessionId,
          beforeTimestamp
        })).then(() => {
          // 加载完成后，保持滚动位置（防止跳到顶部）
          const newScrollHeight = container.scrollHeight
          const scrollDiff = newScrollHeight - currentScrollHeight
          container.scrollTop = scrollTop + scrollDiff
        })
      }
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [sessionId, messages.length, hasMoreMessages, isLoadingMoreMessages, hasStarted, dispatch])

  // API配置在useApiConfig hook中自动处理
  // 不再需要手动加载配置

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
        
        // UI层面始终使用lazy loading（只显示10条），避免性能问题
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

  // 获取完整的消息历史用于API调用（非智能模式下使用）
  const getCompleteMessageHistory = async (sessionId: string) => {
    try {
      const result = await dispatch(fetchAllMessagesForAPI(sessionId)).unwrap()
      console.log('🔧 获取完整消息历史:', result.length, '条消息')
      return result
    } catch (error) {
      console.error('获取完整消息历史失败:', error)
      // 如果获取失败，退回到使用当前UI显示的消息
      return messages
    }
  }

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
        
        // 标记API使用成功
        markApiResult(modelConfig.apiId, true)
      }

      // 保存使用的模型
      localStorage.setItem(`chat_model_${session.id}`, currentSelectedModel)

      router.replace(`/chat/${session.id}`)
    } catch (error) {
      console.error('开始故事失败:', error)
      
      // 标记API使用失败 (只有当是使用AI生成初始消息时)
      const modelConfig = getModelConfig(currentSelectedModel)
      if (modelConfig.apiId && !currentCharacter?.prompt_template?.basic_info?.initialMessage) {
        markApiResult(modelConfig.apiId, false)
      }
      
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

    // 立即清空输入框并重置高度
    setUserInput('')
    setLastFailedInput('')
    
    // 重置输入框高度
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = '24px' // 重置到最小高度
    }

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
        // 非智能模式：获取并使用完整的消息历史
        const completeMessages = await getCompleteMessageHistory(currentSession.id)
        console.log('🔧 非智能模式发送消息，使用完整历史:', completeMessages.length, '条消息')
        await dispatch(sendMessage({
          sessionId: currentSession.id,
          userMessage: messageToSend,
          systemPrompt,
          apiKey: modelConfig.apiKey,
          model: currentSelectedModel,
          messages: completeMessages, // 使用完整的消息历史
          thinkingBudget: getThinkingBudget(currentSelectedModel),
          baseUrl: modelConfig.isRelay ? modelConfig.baseUrl : undefined,
          actualModel: modelConfig.isRelay ? modelConfig.modelName : undefined
        }))
      }
      
      // 标记API使用成功
      markApiResult(modelConfig.apiId, true)
      
    } catch (error) {
      console.error('发送消息失败:', error)
      
      // 标记API使用失败
      markApiResult(modelConfig.apiId, false)
      
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
        // 非智能模式：获取并使用完整的消息历史
        const completeMessages = await getCompleteMessageHistory(currentSession.id)
        console.log('🔧 非智能模式重新生成，使用完整历史:', completeMessages.length, '条消息')
        await dispatch(regenerateLastMessage({
          sessionId: currentSession.id,
          systemPrompt,
          apiKey: modelConfig.apiKey,
          model: currentSelectedModel,
          messages: completeMessages, // 使用完整的消息历史
          lastMessageId: messageId,
          thinkingBudget: getThinkingBudget(currentSelectedModel),
          baseUrl: modelConfig.isRelay ? modelConfig.baseUrl : undefined,
          actualModel: modelConfig.isRelay ? modelConfig.modelName : undefined
        }))
      }
      
      // 标记API使用成功
      markApiResult(modelConfig.apiId, true)
      
    } catch (error) {
      console.error('重新生成消息失败:', error)
      
      // 标记API使用失败
      markApiResult(modelConfig.apiId, false)
    }
  }

  // getModelConfig 现在由 useApiConfig hook 提供，支持轮询选择


  // getModelDisplayName 现在由 useApiConfig hook 提供

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
    // 如果当前消息正在编辑，不处理点击事件
    if (editingMessageId === messageId) {
      return
    }
    
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
      
      // 标记API使用成功
      markApiResult(modelConfig.apiId, true)
      
      setSelectedMessageId(null)
    } catch (error) {
      console.error('发送新消息失败:', error)
      
      // 标记API使用失败
      markApiResult(modelConfig.apiId, false)
    }
  }

  // 重新发送用户消息（更新模式：先删除后续消息，再重新发送）
  const handleResendMessage = async (messageId: number) => {
    if (!currentSession || !currentSelectedModel || isGenerating) return

    // 找到要重新发送的用户消息
    const userMessage = messages.find(msg => msg.id === messageId)
    if (!userMessage || userMessage.role !== 'user') return

    if (!window.confirm('重新发送将删除此消息及之后的所有消息，确定继续吗？')) {
      return
    }

    const systemPrompt = buildSystemPrompt()
    const modelConfig = getModelConfig(currentSelectedModel)
    
    if (!modelConfig.apiKey || !systemPrompt) return

    try {
      // 1. 找到要重新发送的消息在列表中的位置
      const messageIndex = messages.findIndex(msg => msg.id === messageId)
      if (messageIndex === -1) return

      // 2. 获取从该消息开始的所有后续消息ID（包括该消息本身）
      const messagesToDelete = messages.slice(messageIndex)
      const messageIdsToDelete = messagesToDelete.map(msg => msg.id)

      console.log('🗑️ 准备删除消息:', messageIdsToDelete.length, '条')

      // 3. 删除从该消息开始的所有后续消息
      const { error: deleteError } = await supabase
        .from('chat_messages')
        .delete()
        .in('id', messageIdsToDelete)

      if (deleteError) {
        throw new Error(`删除消息失败: ${deleteError.message}`)
      }

      console.log('✅ 消息删除成功')

      // 4. 计算剩余消息
      const remainingMessages = messages.slice(0, messageIndex)
      
      // 给数据库一点时间完成删除操作
      await new Promise(resolve => setTimeout(resolve, 100))

      // 5. 重新发送消息
      if (useEnhancedContext) {
        await dispatch(sendMessageWithContext({
          sessionId: currentSession.id,
          userMessage: userMessage.content,
          systemPrompt,
          apiKey: modelConfig.apiKey,
          model: currentSelectedModel,
          messages: remainingMessages,
          thinkingBudget: getThinkingBudget(currentSelectedModel),
          contextConfig,
          characterName: currentCharacter?.name || '角色',
          baseUrl: modelConfig.isRelay ? modelConfig.baseUrl : undefined,
          actualModel: modelConfig.isRelay ? modelConfig.modelName : undefined
        }))
      } else {
        // 非智能模式：由于我们已经删除了消息，直接使用剩余的消息历史
        console.log('🔧 非智能模式重新发送，使用剩余历史:', remainingMessages.length, '条消息')
        await dispatch(sendMessage({
          sessionId: currentSession.id,
          userMessage: userMessage.content,
          systemPrompt,
          apiKey: modelConfig.apiKey,
          model: currentSelectedModel,
          messages: remainingMessages, // 直接使用已经计算好的剩余消息
          thinkingBudget: getThinkingBudget(currentSelectedModel),
          baseUrl: modelConfig.isRelay ? modelConfig.baseUrl : undefined,
          actualModel: modelConfig.isRelay ? modelConfig.modelName : undefined
        }))
      }
      
      // 标记API使用成功
      markApiResult(modelConfig.apiId, true)
      
      console.log('✅ 重新发送完成')
      setSelectedMessageId(null)
    } catch (error) {
      console.error('重新发送消息失败:', error)
      alert(`重新发送失败: ${error}`)
      
      // 发生错误时重新加载消息列表
      dispatch(fetchMessages(currentSession.id))
    }
  }

  // 进入批量删除模式并选中指定消息
  const handleDeleteMessage = (messageId: number) => {
    // 进入批量删除模式并自动选中点击的消息
    setIsBatchDeleteMode(true)
    setSelectedMessageIds(new Set([messageId]))
    setSelectedMessageId(null)
    setEditingMessageId(null)
    
    console.log('🗑️ 进入批量删除模式，选中消息:', messageId)
  }


  // 批量删除相关函数
  const toggleBatchDeleteMode = () => {
    setIsBatchDeleteMode(!isBatchDeleteMode)
    setSelectedMessageIds(new Set())
    setSelectedMessageId(null)
    setEditingMessageId(null)
  }

  const toggleMessageSelection = (messageId: number) => {
    setSelectedMessageIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      } else {
        newSet.add(messageId)
      }
      return newSet
    })
  }

  const selectAllMessages = () => {
    if (selectedMessageIds.size === messages.length) {
      setSelectedMessageIds(new Set())
    } else {
      setSelectedMessageIds(new Set(messages.map(msg => msg.id)))
    }
  }

  const handleBatchDelete = async () => {
    if (selectedMessageIds.size === 0) {
      alert('请先选择要删除的消息')
      return
    }

    const confirmMessage = `确定要删除选中的 ${selectedMessageIds.size} 条消息吗？此操作不可撤销。`
    if (!window.confirm(confirmMessage)) return

    try {
      // 删除选中的消息
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .in('id', Array.from(selectedMessageIds))

      if (error) {
        throw new Error(`批量删除失败: ${error.message}`)
      }

      console.log('✅ 批量删除成功')
      
      // 退出批量删除模式并刷新消息列表
      setIsBatchDeleteMode(false)
      setSelectedMessageIds(new Set())
      dispatch(fetchMessages(currentSession!.id))
      
    } catch (error) {
      console.error('批量删除失败:', error)
      alert(`批量删除失败: ${error}`)
    }
  }

  // 获取回复灵感
  const handleGetInspiration = async () => {
    if (!currentSession || !currentSelectedModel || isGettingInspiration) return

    const systemPrompt = buildSystemPrompt()
    const modelConfig = getModelConfig(currentSelectedModel)
    
    if (!modelConfig.apiKey || !systemPrompt) return

    setIsGettingInspiration(true)

    try {
      // 获取完整的消息历史
      const completeMessages = useEnhancedContext 
        ? messages 
        : await getCompleteMessageHistory(currentSession.id)

      // 构建灵感提示词
      const inspirationPrompt = systemPrompt + `\n\n现在，请你跳出${currentCharacter?.name}的角色，如果现在你是用户的角色，你会如何回复？请直接回复，避免任何开场白。`

      // 构建消息历史
      const messageHistory = completeMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      console.log('🔧 获取灵感，使用消息历史:', messageHistory.length, '条消息')

      // 调用API获取灵感
      const requestBody: any = {
        messages: messageHistory,
        systemPrompt: inspirationPrompt,
        apiKey: modelConfig.apiKey,
        model: currentSelectedModel,
        customUserMessage: `现在，请你跳出${currentCharacter?.name}的角色，如果现在你是用户的角色，你会如何回复？请直接回复，避免任何开场白。`
      }

      // 只有Gemini 2.5系列模型才添加thinkingBudget
      if (currentSelectedModel.includes('gemini-2.5')) {
        const thinkingBudget = getThinkingBudget(currentSelectedModel)
        if (thinkingBudget !== undefined) {
          requestBody.thinkingBudget = thinkingBudget
        }
      }

      // 添加中转API参数
      if (modelConfig.isRelay) {
        requestBody.baseUrl = modelConfig.baseUrl
        requestBody.actualModel = modelConfig.modelName
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        throw new Error(`获取灵感失败: ${response.statusText}`)
      }

      const result = await response.json()
      
      // 将灵感内容设置到输入框
      if (result.content) {
        setUserInput(result.content.trim())
        console.log('✅ 灵感获取成功:', result.content.substring(0, 50) + '...')
        
        // 标记API使用成功
        markApiResult(modelConfig.apiId, true)
      } else {
        throw new Error('未获得有效的灵感内容')
      }

      setSelectedMessageId(null)
    } catch (error) {
      console.error('获取灵感失败:', error)
      
      // 标记API使用失败
      markApiResult(modelConfig.apiId, false)
      
      alert(`获取灵感失败: ${error}`)
    } finally {
      setIsGettingInspiration(false)
    }
  }


  // hasAnyApiConfig 现在由 useApiConfig hook 提供

  // 如果没有任何API配置
  if (!hasAnyApiConfig()) {
    return (
      <div className="h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
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
      <div className="h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 mx-auto animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
          <p className="text-slate-600">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="h-screen bg-slate-50 dark:bg-slate-900 flex flex-col transition-all duration-300"
      style={{
        backgroundImage: chatBackground ? `url(${chatBackground})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* 固定头部 */}
      <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/chat')}
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
            {/* API状态指示器 */}
            {hasStarted && (() => {
              const healthStats = getHealthStats();
              const modeText = getModeDisplayText();
              
              return (
                <div className="flex items-center space-x-1 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md">
                  <div className={`w-2 h-2 rounded-full ${
                    healthStats.unhealthy > 0 ? 'bg-amber-500' : 
                    healthStats.total > 0 ? 'bg-green-500' : 'bg-gray-400'
                  }`} />
                  <span className="whitespace-nowrap">
                    {healthStats.total > 0 
                      ? `${healthStats.healthy}/${healthStats.total} API` 
                      : '无API'
                    }
                  </span>
                  {healthStats.total > 1 && (
                    <span className="text-xs opacity-75">({modeText.replace('模式', '')})</span>
                  )}
                </div>
              );
            })()}
            
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
            ref={messagesContainerRef}
            className="h-full overflow-y-auto px-4 py-4 space-y-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setSelectedMessageId(null)
                setEditingMessageId(null)
              }
            }}
          >
            {/* 加载更多历史消息的指示器 */}
            {isLoadingMoreMessages && (
              <div className="flex justify-center py-4">
                <div className="flex items-center space-x-2 text-slate-500">
                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                  <span className="text-sm">加载历史消息...</span>
                </div>
              </div>
            )}
            
            {/* 没有更多消息的提示 */}
            {!hasMoreMessages && messages.length > 0 && (
              <div className="flex justify-center py-4">
                <span className="text-xs text-slate-400">已显示全部消息</span>
              </div>
            )}

            {/* 批量删除工具栏 */}
            {isBatchDeleteMode && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="sticky top-0 z-10 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 p-3 mb-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Button
                      onClick={toggleBatchDeleteMode}
                      variant="ghost"
                      size="sm"
                      className="text-slate-600 dark:text-slate-300"
                    >
                      <X className="w-4 h-4 mr-1" />
                      取消
                    </Button>
                    <span className="text-sm text-slate-600 dark:text-slate-300">
                      {selectedMessageIds.size > 0 
                        ? `已选择 ${selectedMessageIds.size} 条消息` 
                        : '点击消息操作菜单中的删除按钮进入批量删除模式'
                      }
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={selectAllMessages}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      {selectedMessageIds.size === messages.length ? '取消全选' : '全选'}
                    </Button>
                    <Button
                      onClick={handleBatchDelete}
                      disabled={selectedMessageIds.size === 0}
                      variant="destructive"
                      size="sm"
                      className="text-xs"
                    >
                      删除 ({selectedMessageIds.size})
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
            
            <AnimatePresence>
              {messages.map((message, index) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-start space-x-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {/* 批量删除模式下的选择框 */}
                  {isBatchDeleteMode && (
                    <div className={`flex-shrink-0 mt-2 ${message.role === 'user' ? 'order-last' : ''}`}>
                      <div 
                        className={`w-5 h-5 rounded-full border-2 cursor-pointer flex items-center justify-center transition-all ${
                          selectedMessageIds.has(message.id) 
                            ? 'bg-blue-500 border-blue-500' 
                            : 'border-slate-300 dark:border-slate-600 hover:border-blue-400'
                        }`}
                        onClick={() => toggleMessageSelection(message.id)}
                      >
                        {selectedMessageIds.has(message.id) && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                  )}
                  
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
                            : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-bl-md hover:bg-slate-50 dark:hover:bg-slate-700'
                        } ${
                          !isBatchDeleteMode && selectedMessageId === message.id ? 'ring-2 ring-blue-500' : ''
                        } ${
                          isBatchDeleteMode ? 'cursor-default' : 'cursor-pointer'
                        }`}
                        onClick={() => {
                          // 在批量删除模式下不处理点击
                          if (isBatchDeleteMode) {
                            return
                          }
                          handleMessageClick(message.id)
                        }}
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
                              className="min-h-[100px] resize-none text-base"
                              style={{
                                fontSize: '16px' // 强制设置16px字体大小防止iOS缩放
                              }}
                              autoFocus
                              onClick={(e) => e.stopPropagation()} // 双重保护：阻止Textarea的点击事件冒泡
                              onFocus={(e) => e.stopPropagation()} // 防止focus事件冒泡
                              onMouseDown={(e) => e.stopPropagation()} // 防止mousedown事件冒泡
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
                                p: ({children}) => <p className="mb-1 last:mb-0 whitespace-pre-wrap text-sm sm:text-base leading-normal">{children}</p>,
                                br: () => <br className="leading-tight" />,
                                code: ({children, className}) => {
                                  const isInline = !className
                                  return isInline ? (
                                    <code className="bg-slate-200 dark:bg-slate-700 dark:text-slate-300 px-1 py-0.5 rounded text-xs sm:text-sm">{children}</code>
                                  ) : (
                                    <code className="block bg-slate-200 dark:bg-slate-700 dark:text-slate-300 p-2 rounded text-xs sm:text-sm overflow-x-auto">{children}</code>
                                  )
                                },
                                pre: ({children}) => <pre className="bg-slate-200 dark:bg-slate-700 dark:text-slate-300 p-2 rounded overflow-x-auto">{children}</pre>,
                                blockquote: ({children}) => <blockquote className="border-l-4 border-slate-300 dark:border-slate-600 pl-4 italic">{children}</blockquote>,
                                strong: ({children}) => <strong className="font-semibold">{children}</strong>,
                                em: ({children}) => <em className="italic">{children}</em>,
                              }}
                              skipHtml={false}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>

                      {/* 消息操作按钮 - 移动端优化 */}
                      {!isBatchDeleteMode && selectedMessageId === message.id && (
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
                                      className="h-7 px-2 text-xs bg-white dark:bg-slate-700 dark:text-white border border-slate-200 dark:border-slate-600"
                                    >
                                      <RefreshCw className={`w-3 h-3 mr-1 ${isGenerating ? 'animate-spin' : ''}`} />
                                      重新生成
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEditMessage(message.id, message.content)}
                                    className="h-7 px-2 text-xs bg-white dark:bg-slate-700 dark:text-white border border-slate-200 dark:border-slate-600"
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
                                    className="h-7 px-2 text-xs bg-white dark:bg-slate-700 dark:text-white border border-slate-200 dark:border-slate-600"
                                  >
                                    <MessageSquarePlus className="w-3 h-3 mr-1" />
                                    续写
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleGetInspiration()}
                                    disabled={isGenerating || isGettingInspiration}
                                    className="h-7 px-2 text-xs bg-white dark:bg-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 hover:border-yellow-200 dark:hover:border-yellow-800 hover:text-yellow-600 dark:hover:text-yellow-400"
                                  >
                                    <Lightbulb className="w-3 h-3 mr-1" />
                                    灵感
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteMessage(message.id)}
                                    className="h-7 px-2 text-xs bg-white dark:bg-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 hover:bg-red-50 dark:hover:bg-red-900/30 hover:border-red-200 dark:hover:border-red-800 hover:text-red-600 dark:hover:text-red-400"
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
                                      className="h-7 px-2 text-xs bg-white dark:bg-slate-700 dark:text-white border border-slate-200 dark:border-slate-600"
                                      title="重新发送此消息（将删除此消息及之后的所有消息）"
                                    >
                                      <RefreshCw className={`w-3 h-3 mr-1 ${isGenerating ? 'animate-spin' : ''}`} />
                                      重新发送
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEditMessage(message.id, message.content)}
                                    className="h-7 px-2 text-xs bg-white dark:bg-slate-700 dark:text-white border border-slate-200 dark:border-slate-600"
                                  >
                                    <Edit2 className="w-3 h-3 mr-1" />
                                    编辑
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteMessage(message.id)}
                                    className="h-7 px-2 text-xs bg-white dark:bg-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 hover:bg-red-50 dark:hover:bg-red-900/30 hover:border-red-200 dark:hover:border-red-800 hover:text-red-600 dark:hover:text-red-400"
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

      {/* 批量删除模式底部提示栏 */}
      {isBatchDeleteMode && (
        <div className="bg-amber-50 dark:bg-amber-900/30 border-t border-amber-200 dark:border-amber-800 p-4 flex-shrink-0">
          <div className="flex items-center justify-center space-x-2 text-amber-700 dark:text-amber-300">
            <Trash2 className="w-4 h-4" />
            <span className="text-sm font-medium">批量删除模式</span>
            <span className="text-xs">点击圆形复选框选择消息</span>
          </div>
        </div>
      )}

      {/* 固定底部输入框 */}
      {hasStarted && !isBatchDeleteMode && (
        <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-700 p-4 flex-shrink-0 shadow-lg">
          <div className="flex items-end space-x-3 bg-slate-50/80 dark:bg-slate-700/80 rounded-2xl p-2 shadow-inner border border-slate-200/50 dark:border-slate-600/50">
            <Textarea
              ref={inputRef}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder={
                isGettingInspiration 
                  ? "正在为你生成灵感..." 
                  : "输入消息..."
              }
              className="flex-1 resize-none text-base bg-transparent border-none focus:ring-0 focus:outline-none min-h-[40px] max-h-[120px] px-3 py-2 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              rows={1}
              style={{
                fontSize: '16px',
                height: 'auto',
                minHeight: '40px',
                lineHeight: '1.5'
              }}
              onKeyDown={(e) => {
                const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768
                
                if (e.key === 'Enter') {
                  if (isMobile) {
                    if (e.ctrlKey || e.metaKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  } else {
                    if (!e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }
                }
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = Math.min(Math.max(target.scrollHeight, 40), 120) + 'px'
              }}
            />
            {/* 发送按钮区域 */}
            <div className="flex items-center space-x-2">
              {/* 灵感加载指示器 */}
              {isGettingInspiration && (
                <div className="flex items-center justify-center w-10 h-10 flex-shrink-0">
                  <div className="w-5 h-5 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />
                </div>
              )}
              <Button
                onClick={handleSendMessage}
                disabled={!userInput.trim() || isGenerating || isGettingInspiration}
                className="rounded-full w-10 h-10 p-0 flex-shrink-0 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* 错误提示 */}
          {error && (
            <div className="mt-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-3 rounded-xl border border-red-200 dark:border-red-800 flex items-center justify-between">
              <span className="flex-1">{error}</span>
              <Button size="sm" variant="ghost" onClick={() => dispatch(clearError())} className="p-1 h-6 w-6 hover:bg-red-100 dark:hover:bg-red-800/30">
                <X className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
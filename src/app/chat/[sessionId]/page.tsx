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
  MoreVertical
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
  clearChat,
  clearError
} from '../../store/chatSlice'

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
  const [showModelSelect, setShowModelSelect] = useState(false)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [isStartingStory, setIsStartingStory] = useState(false) // 新增状态：是否正在开始故事
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sessionId = params.sessionId as string

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
      
      console.log('API Keys found:', {
        deepseek: deepseek ? `${deepseek.substring(0, 10)}...` : 'None',
        gemini: gemini ? `${gemini.substring(0, 10)}...` : 'None',
        openai: openai ? `${openai.substring(0, 10)}...` : 'None'
      })
      
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
      
      console.log('Available models:', models)
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
    if (selectedModel) {
      setCurrentSelectedModel(selectedModel)
    }
  }, [selectedModel])

  // 构建系统提示
  const buildSystemPrompt = () => {
    console.log('buildSystemPrompt 调试:', {
      currentCharacter: currentCharacter,
      hasPromptTemplate: !!currentCharacter?.prompt_template,
      promptTemplate: currentCharacter?.prompt_template
    })
    
    if (!currentCharacter?.prompt_template) {
      console.warn('角色或prompt_template为空')
      return ''
    }
    
    const { basic_info, modules } = currentCharacter.prompt_template
    
    console.log('prompt_template 内容:', {
      basic_info,
      modules,
      modulesLength: modules?.length
    })

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
      console.log('处理模块:', module)
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
    console.log('最终生成的prompt:', finalPrompt)
    return finalPrompt
  }

  // 预览系统提示词
  const previewSystemPrompt = () => {
    const prompt = buildSystemPrompt()
    console.log('=== 系统提示词预览 ===')
    console.log(prompt)
    console.log('=== 预览结束 ===')
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

    setIsStartingStory(true) // 立即设置loading状态
    setHasStarted(true) // 立即切换到聊天界面
    setShowModelSelect(false) // 关闭设置面板

    try {
      const session = await dispatch(createChatSession({
        characterId: currentCharacter.id,
        title: sessionTitle,
        userId: user.id
      })).unwrap()

      const systemPrompt = buildSystemPrompt()
      const apiKey = getApiKeyForModel(currentSelectedModel)
      
      console.log('开始故事调试信息:', {
        currentCharacter: currentCharacter ? {
          id: currentCharacter.id,
          name: currentCharacter.name,
          hasPromptTemplate: !!currentCharacter.prompt_template,
          promptTemplateKeys: currentCharacter.prompt_template ? Object.keys(currentCharacter.prompt_template) : []
        } : null,
        systemPrompt: systemPrompt ? `"${systemPrompt.substring(0, 100)}..."` : 'EMPTY',
        systemPromptLength: systemPrompt ? systemPrompt.length : 0,
        apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'NONE',
        model: currentSelectedModel,
        sessionId: session.id
      })
      
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
    
    console.log('准备发送消息:', {
      sessionId: currentSession.id,
      userMessage: userInput.trim(),
      systemPrompt: systemPrompt ? `${systemPrompt.length} chars` : 'undefined',
      apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'undefined',
      model: currentSelectedModel,
      messagesCount: messages.length,
      thinkingBudget: getThinkingBudget(currentSelectedModel),
      currentCharacter: currentCharacter ? {
        id: currentCharacter.id,
        name: currentCharacter.name,
        hasPromptTemplate: !!currentCharacter.prompt_template
      } : null
    })
    
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
      await dispatch(sendMessage({
        sessionId: currentSession.id,
        userMessage: userInput.trim(),
        systemPrompt,
        apiKey,
        model: currentSelectedModel,
        messages,
        thinkingBudget: getThinkingBudget(currentSelectedModel)
      }))
      
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
    <div className="h-screen bg-slate-50 flex flex-col">
      {/* 固定头部 */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <Avatar className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0">
              <AvatarImage src={currentCharacter?.avatar_url} />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm">
                {currentCharacter?.name?.[0] || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              {isEditingTitle ? (
                <div className="flex items-center space-x-2">
                  <Input
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                  />
                  <Button size="sm" variant="ghost" onClick={handleSaveTitle} className="p-1 h-8 w-8">
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditingTitle(false)} className="p-1 h-8 w-8">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-base sm:text-lg font-semibold truncate">
                      {sessionTitle || currentCharacter?.name}
                    </h2>
                    {!hasStarted && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setTempTitle(sessionTitle || currentCharacter?.name || '')
                          setIsEditingTitle(true)
                        }}
                        className="p-1 h-6 w-6"
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 truncate">
                    {currentCharacter?.name}
                    {currentSelectedModel && (
                      <span className="hidden sm:inline"> • {getModelDisplayName(currentSelectedModel)}</span>
                    )}
                  </p>
                </>
              )}
            </div>
          </div>
          
          {/* 右侧操作按钮 */}
          {!hasStarted && (
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowModelSelect(!showModelSelect)}
                className="text-xs px-2 py-1 h-8"
              >
                {currentSelectedModel ? getModelDisplayName(currentSelectedModel) : '选择模型'}
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </div>
          )}
        </div>

        {/* 移动端模型选择下拉面板 */}
        {!hasStarted && showModelSelect && (
          <div className="mt-3 space-y-3">
            <div>
              <Label className="text-sm font-medium">选择AI模型</Label>
              <Select value={currentSelectedModel || ''} onValueChange={handleModelChange}>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="选择AI模型" />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((model) => (
                    <SelectItem key={model} value={model}>
                      {getModelDisplayName(model)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Gemini高级设置 */}
            {currentSelectedModel === 'gemini-2.5-flash' && (
              <div className="space-y-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                  className="text-xs px-0"
                >
                  高级设置
                  <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${showAdvancedSettings ? 'rotate-180' : ''}`} />
                </Button>
                
                {showAdvancedSettings && (
                  <div className="space-y-3 p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">思维模式</Label>
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs ${thinkingBudgetMode === 'auto' ? 'font-medium' : 'text-slate-500'}`}>
                          Auto
                        </span>
                        <Switch
                          checked={thinkingBudgetMode === 'manual'}
                          onCheckedChange={(checked) => setThinkingBudgetMode(checked ? 'manual' : 'auto')}
                        />
                        <span className={`text-xs ${thinkingBudgetMode === 'manual' ? 'font-medium' : 'text-slate-500'}`}>
                          Manual
                        </span>
                      </div>
                    </div>
                    
                    {thinkingBudgetMode === 'manual' && (
                      <div>
                        <Label className="text-sm">思维预算</Label>
                        <Select value={thinkingBudget.toString()} onValueChange={(value) => setThinkingBudget(Number(value))}>
                          <SelectTrigger className="w-full mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0 (关闭)</SelectItem>
                            <SelectItem value="1000">1000</SelectItem>
                            <SelectItem value="5000">5000</SelectItem>
                            <SelectItem value="10000">10000</SelectItem>
                            <SelectItem value="20000">20000</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    <p className="text-xs text-slate-500">
                      {thinkingBudgetMode === 'auto' 
                        ? 'AI自动决定是否使用思维链，平衡质量与速度' 
                        : thinkingBudget === 0 
                          ? '关闭思维链，响应更快，成本更低' 
                          : '启用思维链，提升回答质量但响应较慢'
                      }
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Gemini 2.5 Pro 说明 */}
            {currentSelectedModel === 'gemini-2.5-pro' && (
              <div className="text-xs text-slate-500 p-3 bg-slate-50 rounded-lg">
                Gemini 2.5 Pro 默认启用思维链模式，提供最佳回答质量
              </div>
            )}

            <div className="flex space-x-2">
              {currentCharacter && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={previewSystemPrompt}
                  className="text-xs flex-1"
                >
                  预览提示词
                </Button>
              )}
              <Button
                onClick={handleStartStory}
                disabled={!currentSelectedModel || isStartingStory}
                size="sm"
                className="flex-1"
              >
                <Play className="w-4 h-4 mr-1" />
                {isStartingStory ? '启动中...' : '开始故事'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 消息区域 - 占据剩余空间 */}
      <div className="flex-1 overflow-hidden">
        {!hasStarted ? (
          // 未开始状态的欢迎界面
          !showModelSelect && (
            <div className="h-full flex items-center justify-center p-6">
              <div className="text-center space-y-6 max-w-sm">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-slate-900 to-slate-700 rounded-full flex items-center justify-center">
                  <Play className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">准备开始你的故事</h3>
                  <p className="text-slate-600 mb-6 text-sm">
                    点击上方选择模型，然后开始与 {currentCharacter?.name} 的对话
                  </p>
                  <Button
                    onClick={() => setShowModelSelect(true)}
                    size="lg"
                    className="w-full"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    开始配置
                  </Button>
                </div>
              </div>
            </div>
          )
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
                            ? 'bg-slate-900 text-white rounded-br-md' 
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
        <div className="bg-white border-t border-slate-200 p-3 sm:p-4 flex-shrink-0">
          <div className="flex space-x-2 sm:space-x-3">
            <Textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="输入你的消息..."
              className="flex-1 resize-none text-sm sm:text-base min-h-[40px] max-h-[120px] border-slate-300 rounded-2xl"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              style={{
                height: 'auto',
                minHeight: '40px'
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
              className="self-end rounded-full w-10 h-10 sm:w-12 sm:h-12 p-0 flex-shrink-0"
            >
              <Send className="w-4 h-4 sm:w-5 sm:h-5" />
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
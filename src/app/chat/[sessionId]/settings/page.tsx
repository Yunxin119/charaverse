'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Palette, Save, Check, X, ChevronRight, Edit3, Trash2, Brain, Info, Zap, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppSelector, useAppDispatch } from '../../../store/hooks'
import { setSessionTitle, setSelectedModel } from '../../../store/chatSlice'
import { 
  fetchCharacter,
  fetchChatSession,
  clearChatHistory,
} from '../../../store/chatSlice'
import { getContextConfigSuggestions } from '../../../lib/enhancedChatSlice'

export default function ChatSettingsPage() {
  const router = useRouter()
  const params = useParams()
  const dispatch = useAppDispatch()

  const { 
    sessionTitle: currentTitle, 
    currentCharacter,
    selectedModel 
  } = useAppSelector((state) => state.chat)
  
  const [sessionTitle, setLocalSessionTitle] = useState('')
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [tempTitle, setTempTitle] = useState('')
  const [chatBackground, setChatBackground] = useState('')
  const [apiConfig, setApiConfig] = useState<{[key: string]: string}>({})
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [currentSelectedModel, setCurrentSelectedModel] = useState<string>('')
  
  // 上下文配置状态
  const [contextConfig, setContextConfig] = useState({
    maxContextTokens: 4000,
    reservedTokens: 1000,
    enableSummary: true,
    summaryThreshold: 20,
    keepRecentMessages: 10
  })
  const [useEnhancedContext, setUseEnhancedContext] = useState(true) // 默认开启智能模式以节省tokens
  const [contextStats, setContextStats] = useState<{
    totalTokens: number
    systemTokens: number
    messageTokens: number
    truncatedMessages: number
    hasSummary: boolean
  } | null>(null)
  const [showContextHelp, setShowContextHelp] = useState(false)

  const sessionId = params.sessionId as string

  useEffect(() => {
    dispatch(fetchChatSession(sessionId))
    if (currentCharacter?.id) {
      dispatch(fetchCharacter(currentCharacter.id))
    }

    setLocalSessionTitle(currentTitle || '')
    setTempTitle(currentTitle || '')

    const savedBg = localStorage.getItem(`chat_background_${sessionId}`)
    if (savedBg) {
      setChatBackground(savedBg)
    }

    // 加载API配置
    const config: {[key: string]: string} = {}
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
    
    // 加载保存的模型选择
    const savedModel = localStorage.getItem(`chat_model_${sessionId}`)
    if (savedModel && models.includes(savedModel)) {
      setCurrentSelectedModel(savedModel)
    } else if (selectedModel) {
      setCurrentSelectedModel(selectedModel)
    } else if (models.length > 0) {
      const defaultModel = models[0]
      setCurrentSelectedModel(defaultModel)
      dispatch(setSelectedModel(defaultModel))
      localStorage.setItem(`chat_model_${sessionId}`, defaultModel)
    }
    
    // 加载上下文配置
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
  }, [currentTitle, sessionId, dispatch, currentCharacter?.id])

  const handleSaveTitle = () => {
    dispatch(setSessionTitle(tempTitle))
    setLocalSessionTitle(tempTitle)
    setIsEditingTitle(false)
  }

  const handleBackgroundChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const result = event.target?.result as string
        setChatBackground(result)
        localStorage.setItem(`chat_background_${sessionId}`, result)
      }
      reader.readAsDataURL(e.target.files[0])
    }
  }

  // 处理模型选择变化
  const handleModelChange = (model: string) => {
    setCurrentSelectedModel(model)
    dispatch(setSelectedModel(model))
    localStorage.setItem(`chat_model_${sessionId}`, model)
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

  // 保存上下文配置
  const saveContextConfig = () => {
    localStorage.setItem(`context_config_${sessionId}`, JSON.stringify(contextConfig))
    localStorage.setItem(`use_enhanced_context_${sessionId}`, String(useEnhancedContext))
  }

  // 当配置改变时自动保存
  useEffect(() => {
    saveContextConfig()
  }, [contextConfig, useEnhancedContext, sessionId])

  // 构建系统提示
  const buildSystemPrompt = () => {
    if (!currentCharacter?.prompt_template) {
      return ''
    }
    
    const { basic_info, modules } = currentCharacter.prompt_template
    
    if (!basic_info || !basic_info.name) {
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
    
    return prompt.trim()
  }

  // 获取模型对应的API密钥
  const getApiKeyForModel = (model: string): string | null => {
    if (model.startsWith('deepseek')) return apiConfig.deepseek || null
    if (model.startsWith('gemini')) return apiConfig.gemini || null
    if (model.startsWith('gpt')) return apiConfig.openai || null
    return null
  }

  const handleClearChat = () => {
    if (window.confirm('你确定要清空所有聊天记录吗？清空后AI会重新开始对话。')) {
      const currentModel = selectedModel || localStorage.getItem(`chat_model_${sessionId}`) || 'deepseek-chat'
      const systemPrompt = buildSystemPrompt()
      const apiKey = getApiKeyForModel(currentModel)
      
      if (!systemPrompt) {
        alert('角色信息不完整，无法重新开始对话')
        return
      }
      
      if (!apiKey) {
        alert('未找到对应的API密钥')
        return
      }

      dispatch(clearChatHistory({
        sessionId,
        systemPrompt,
        apiKey,
        model: currentModel,
        initialMessage: currentCharacter?.prompt_template?.basic_info?.initialMessage
      }))
    }
  }

  const pageVariants = {
    initial: {
      x: '100%',
      opacity: 0,
    },
    in: {
      x: 0,
      opacity: 1,
    },
    out: {
      x: '100%',
      opacity: 0,
    }
  }

  const pageTransition = {
    type: 'tween' as const,
    ease: 'anticipate' as const,
    duration: 0.4
  }

  return (
    <TooltipProvider>
      <motion.div
        initial="initial"
        animate="in"
        exit="out"
        variants={pageVariants}
        transition={pageTransition}
        className="absolute top-0 left-0 w-full h-full bg-slate-50 z-10 flex flex-col"
      >
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200 px-4 py-3 flex-shrink-0">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="p-2 h-8 w-8"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-lg font-semibold mx-auto">
            聊天设置
          </h2>
        </div>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* Character Info */}
        {currentCharacter && (
          <div 
            className="bg-white p-4 rounded-lg border border-slate-200 flex items-center space-x-4 cursor-pointer hover:bg-slate-50"
            onClick={() => router.push(`/characters/${currentCharacter.id}/edit`)}
          >
            <Avatar className="w-12 h-12">
              <AvatarImage src={currentCharacter.avatar_url} />
              <AvatarFallback>{currentCharacter.name?.[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="font-semibold">{currentCharacter.name}</h3>
              <p className="text-sm text-slate-500">编辑角色</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </div>
        )}

        {/* Chat Title */}
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <Label className="text-sm font-medium text-slate-600">聊天标题</Label>
          {isEditingTitle ? (
            <div className="flex items-center space-x-2 mt-2">
              <Input
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                className="h-9"
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
            <div 
              className="flex items-center justify-between mt-2 cursor-pointer p-2 rounded-md hover:bg-slate-50"
              onClick={() => setIsEditingTitle(true)}
            >
              <span className="text-base text-slate-900">{sessionTitle || currentTitle}</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          )}
        </div>

        {/* Chat Background */}
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <Label htmlFor="background-upload" className="flex items-center justify-between cursor-pointer">
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-slate-600">聊天背景</h4>
              <p className="text-xs text-slate-500">选择一张图片作为背景</p>
            </div>
            <div className="flex items-center space-x-2">
              {chatBackground && (
                <div 
                  className="w-8 h-8 rounded-md bg-cover bg-center"
                  style={{ backgroundImage: `url(${chatBackground})` }}
                />
              )}
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </Label>
          <Input 
            id="background-upload" 
            type="file" 
            className="hidden"
            accept="image/*"
            onChange={handleBackgroundChange}
          />
        </div>

        {/* Danger Zone */}
        <div 
          className="bg-white p-4 rounded-lg border border-red-200 cursor-pointer hover:bg-red-50"
          onClick={handleClearChat}
        >
          <div className="flex items-center justify-between text-red-600">
            <div className="space-y-1">
              <h4 className="text-sm font-medium">清空聊天记录</h4>
              <p className="text-xs text-red-500">此操作无法撤销</p>
            </div>
            <Trash2 className="w-4 h-4" />
          </div>
        </div>

        {/* Model Selection */}
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <Label className="text-sm font-medium text-slate-600">AI模型选择</Label>
          <div className="mt-2">
            <Select value={currentSelectedModel || selectedModel || ''} onValueChange={handleModelChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="选择模型" />
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
        </div>

        {/* Context Management */}
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center">
                  <Brain className="w-4 h-4 mr-2" />
                  <h4 className="text-sm font-medium text-slate-600">智能上下文管理</h4>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 ml-2 text-slate-400 hover:text-slate-600"
                      >
                        <Info className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-sm p-4">
                      <div className="space-y-3">
                        <div>
                          <p className="font-medium text-green-600 mb-1">✅ 开启智能模式 (推荐)</p>
                          <ul className="text-sm space-y-1">
                            <li>• 🧠 智能截断：只发送必要的消息，大幅节省tokens</li>
                            <li>• ⚡ 自动摘要：长对话中AI依然记得早期内容</li>
                            <li>• 💰 成本控制：可预测的API调用成本</li>
                            <li>• 📊 实时统计：精确显示token使用情况</li>
                          </ul>
                        </div>
                        <div>
                          <p className="font-medium text-orange-600 mb-1">⚠️ 关闭智能模式</p>
                          <ul className="text-sm space-y-1">
                            <li>• 📤 发送全部消息：可能浪费大量tokens</li>
                            <li>• ⚡  完整记忆：长对话中AI会有所有之前聊天的精确</li>
                            <li>• 💸 成本不可控：tokens消耗难以预测</li>
                          </ul>
                        </div>
                        <div className="pt-2 border-t border-slate-200">
                          <p className="text-xs text-slate-600">
                            💡 建议保持开启状态，特别是进行长对话时
                          </p>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-xs text-slate-500 mt-1">智能截断和摘要记忆 (推荐开启)</p>
              </div>
              <Switch
                checked={useEnhancedContext}
                onCheckedChange={setUseEnhancedContext}
              />
            </div>

            {useEnhancedContext && (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-700">高级配置</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowContextHelp(!showContextHelp)}
                    className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700 touch-manipulation"
                  >
                    <Info className="w-4 h-4" />
                  </Button>
                </div>

                {showContextHelp && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                    <h5 className="text-xs font-semibold text-blue-800 mb-2 flex items-center">
                      <Info className="w-3 h-3 mr-1" />
                      配置说明
                    </h5>
                    <div className="space-y-2 text-xs text-blue-700">
                      <div>
                        <strong>最大上下文:</strong> 发送给AI的最大token数量，数值越大AI记忆越多，但消耗越高
                      </div>
                      <div>
                        <strong>预留生成空间:</strong> 为AI回复预留的token空间，确保AI有足够空间生成完整回复
                      </div>
                      <div>
                        <strong>摘要阈值:</strong> 当消息数超过此值时自动生成摘要压缩历史，数值越小摘要越频繁
                      </div>
                      <div>
                        <strong>保留最近消息:</strong> 无论如何都会保留的最新消息数量，确保对话连贯性
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-blue-200">
                      <p className="text-xs text-blue-600">
                        💡 建议：首次使用可点击"应用模型推荐配置"获得最佳设置
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <Label className="text-xs text-slate-600">最大上下文 (tokens)</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-slate-400 hover:text-slate-600 touch-manipulation"
                          >
                            <Info className="w-3 h-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs p-3">
                          <div className="space-y-2">
                            <p className="font-medium">控制发送给AI的最大token数量</p>
                            <p className="text-sm">数值越大，AI能记住的对话内容越多，但API消耗也越高。</p>
                            <div className="text-sm">
                              <p className="font-medium">推荐值：</p>
                              <p>• 普通对话: 3000-4000</p>
                              <p>• 长篇角色扮演: 6000-8000</p>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      type="number"
                      value={contextConfig.maxContextTokens}
                      onChange={(e) => setContextConfig(prev => ({
                        ...prev,
                        maxContextTokens: parseInt(e.target.value) || 4000
                      }))}
                      className="h-10 text-sm"
                    />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <Label className="text-xs text-slate-600">预留生成空间</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-slate-400 hover:text-slate-600 touch-manipulation"
                          >
                            <Info className="w-3 h-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs p-3">
                          <div className="space-y-2">
                            <p className="font-medium">为AI回复预留的token空间</p>
                            <p className="text-sm">如果设置过小，AI可能无法生成完整的回复就被截断。</p>
                            <div className="text-sm">
                              <p className="font-medium">推荐值：</p>
                              <p>• 简短回复: 500-800</p>
                              <p>• 详细回复: 1000-1500</p>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      type="number"
                      value={contextConfig.reservedTokens}
                      onChange={(e) => setContextConfig(prev => ({
                        ...prev,
                        reservedTokens: parseInt(e.target.value) || 1000
                      }))}
                      className="h-10 text-sm"
                    />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <Label className="text-xs text-slate-600">摘要阈值</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-slate-400 hover:text-slate-600 touch-manipulation"
                          >
                            <Info className="w-3 h-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs p-3">
                          <div className="space-y-2">
                            <p className="font-medium">自动摘要触发条件</p>
                            <p className="text-sm">当对话消息数超过此值时，系统会自动生成摘要来压缩历史对话，释放更多上下文空间。</p>
                            <div className="text-sm">
                              <p className="font-medium">推荐值：</p>
                              <p>• 频繁摘要(记忆好): 15-20</p>
                              <p>• 适中摘要: 20-25</p>
                              <p>• 少量摘要(节省成本): 25-30</p>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      type="number"
                      value={contextConfig.summaryThreshold}
                      onChange={(e) => setContextConfig(prev => ({
                        ...prev,
                        summaryThreshold: parseInt(e.target.value) || 20
                      }))}
                      className="h-10 text-sm"
                    />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <Label className="text-xs text-slate-600">保留最近消息</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-slate-400 hover:text-slate-600 touch-manipulation"
                          >
                            <Info className="w-3 h-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs p-3">
                          <div className="space-y-2">
                            <p className="font-medium">完整保留的最新消息数量</p>
                            <p className="text-sm">无论如何都会完整保留的最新消息数量，确保对话的连贯性和上下文理解。</p>
                            <div className="text-sm">
                              <p className="font-medium">推荐值：</p>
                              <p>• 简单对话: 6-8条</p>
                              <p>• 复杂对话: 10-15条</p>
                              <p>• 深度角色扮演: 12-18条</p>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      type="number"
                      value={contextConfig.keepRecentMessages}
                      onChange={(e) => setContextConfig(prev => ({
                        ...prev,
                        keepRecentMessages: parseInt(e.target.value) || 10
                      }))}
                      className="h-10 text-sm"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const suggestions = getContextConfigSuggestions(currentSelectedModel || selectedModel || 'deepseek-chat')
                      setContextConfig(prev => ({ ...prev, ...suggestions }))
                    }}
                    className="h-10 px-4 text-sm touch-manipulation"
                  >
                    应用模型推荐配置
                  </Button>
                </div>

                {/* 上下文统计信息 */}
                {contextStats && (
                  <div className="bg-slate-50 rounded p-3 text-xs border">
                    <div className="flex items-center mb-2">
                      <Info className="w-3 h-3 mr-1" />
                      <span className="font-medium">当前上下文统计</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <div className="text-blue-600 font-medium">{contextStats.totalTokens}</div>
                        <div className="text-slate-600">总Token</div>
                      </div>
                      <div className="text-center">
                        <div className="text-green-600 font-medium">{contextStats.messageTokens}</div>
                        <div className="text-slate-600">消息Token</div>
                      </div>
                      <div className="text-center">
                        <div className="text-orange-600 font-medium">{contextStats.truncatedMessages}</div>
                        <div className="text-slate-600">截断消息</div>
                      </div>
                    </div>
                    {contextStats.hasSummary && (
                      <div className="mt-2 flex items-center justify-center text-purple-600">
                        <Zap className="w-3 h-3 mr-1" />
                        <span>已启用智能摘要</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* More settings can be added here */}
      </div>
      </motion.div>
    </TooltipProvider>
  )
} 
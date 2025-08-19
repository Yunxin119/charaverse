'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Palette, Save, Check, X, ChevronRight, Edit3, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { useAppSelector, useAppDispatch } from '../../../store/hooks'
import { setSessionTitle } from '../../../store/chatSlice'
import { 
  fetchCharacter,
  fetchChatSession,
  clearChatHistory,
} from '../../../store/chatSlice'

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
        model: currentModel
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

        {/* More settings can be added here */}
      </div>
    </motion.div>
  )
} 
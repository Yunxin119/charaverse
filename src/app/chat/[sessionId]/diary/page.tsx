'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { 
  ArrowLeft,
  BookOpen,
  Edit3,
  Loader2,
  Calendar,
  User,
  RefreshCw,
  AlertCircle,
  MoreVertical,
  Edit2,
  Trash2,
  RotateCcw,
  Save,
  X
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { supabase, type Diary, type ChatSession, type Character } from '@/app/lib/supabase'
import { useAppSelector } from '@/app/store/hooks'

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

interface DiaryPageData {
  session: ChatSession | null
  character: Character | null
  diaries: Diary[]
  loading: boolean
  error: string | null
  generating: boolean
}

export default function DiaryPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string
  
  const { user } = useAppSelector((state) => state.auth)
  
  const [data, setData] = useState<DiaryPageData>({
    session: null,
    character: null,
    diaries: [],
    loading: true,
    error: null,
    generating: false
  })

  // 编辑相关状态
  const [editingDiaryId, setEditingDiaryId] = useState<number | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState<number | null>(null)

  // 获取模型对应的API密钥
  const getApiKeyForModel = (model: string): string | null => {
    if (model.startsWith('deepseek')) return localStorage.getItem('api_key_deepseek')
    if (model.startsWith('gemini')) return localStorage.getItem('api_key_gemini')
    if (model.startsWith('gpt')) return localStorage.getItem('api_key_openai')
    
    // 处理命名中转配置
    if (model.startsWith('named-relay-')) {
      const configId = model.replace('named-relay-', '')
      const savedNamedConfigs = localStorage.getItem('named_relay_configs')
      if (savedNamedConfigs) {
        try {
          const namedConfigs: NamedRelayConfig[] = JSON.parse(savedNamedConfigs)
          const config = namedConfigs.find(c => c.id === configId)
          return config?.apiKey || null
        } catch (e) {
          console.warn('Failed to parse named relay configs')
        }
      }
    }
    
    return null
  }

  // 获取模型的完整配置（包括中转API的baseUrl）
  const getModelConfig = (model: string) => {
    // 命名中转配置
    if (model.startsWith('named-relay-')) {
      const configId = model.replace('named-relay-', '')
      const savedNamedConfigs = localStorage.getItem('named_relay_configs')
      if (savedNamedConfigs) {
        try {
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
        } catch (e) {
          console.warn('Failed to parse named relay configs')
        }
      }
    }
    
    return {
      apiKey: getApiKeyForModel(model),
      isRelay: false
    }
  }

  // 获取页面数据
  const fetchData = async () => {
    if (!user) return

    try {
      setData(prev => ({ ...prev, loading: true, error: null }))

      // 获取会话信息
      const { data: session, error: sessionError } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single()

      if (sessionError) throw new Error('会话不存在')

      // 获取角色信息
      const { data: character, error: characterError } = await supabase
        .from('characters')
        .select('*')
        .eq('id', session.character_id)
        .single()

      if (characterError) throw new Error('角色信息获取失败')

      // 获取日记列表
      const { data: diaries, error: diariesError } = await supabase
        .from('diaries')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (diariesError) throw new Error('日记获取失败')

      setData({
        session,
        character,
        diaries: diaries || [],
        loading: false,
        error: null,
        generating: false
      })

    } catch (error) {
      console.error('获取数据失败:', error)
      setData(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : '数据获取失败'
      }))
    }
  }

  // 生成新日记
  const generateDiary = async () => {
    if (!user || data.generating) return

    try {
      setData(prev => ({ ...prev, generating: true, error: null }))

      // 从 localStorage 获取 API 配置
      const model = localStorage.getItem(`chat_model_${sessionId}`) || 'deepseek-chat'
      const modelConfig = getModelConfig(model)

      if (!modelConfig.apiKey) {
        throw new Error('请先在设置中配置对应的 API Key')
      }

      // 获取用户session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('用户session已过期，请重新登录')
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'x-api-key': modelConfig.apiKey,
        'x-model': model
      }

      // 如果是中转API，添加额外的headers
      if (modelConfig.isRelay) {
        headers['x-base-url'] = modelConfig.baseUrl || ''
        headers['x-actual-model'] = modelConfig.modelName || ''
      }

      const response = await fetch('/api/diary/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionId,
          userId: user.id
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '生成失败')
      }

      // 重新获取日记列表
      await fetchData()

    } catch (error) {
      console.error('生成日记失败:', error)
      setData(prev => ({
        ...prev,
        generating: false,
        error: error instanceof Error ? error.message : '生成失败'
      }))
    }
  }

  // 开始编辑日记
  const handleEditDiary = (diary: Diary) => {
    setEditingDiaryId(diary.id)
    setEditingContent(diary.content)
  }

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingDiaryId(null)
    setEditingContent('')
  }

  // 保存编辑后的日记
  const handleSaveEdit = async () => {
    if (!editingDiaryId || !editingContent.trim() || isUpdating) return

    try {
      setIsUpdating(true)

      // 获取用户session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('用户session已过期，请重新登录')
      }

      const response = await fetch(`/api/diary/${editingDiaryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          content: editingContent.trim()
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '更新失败')
      }

      // 更新本地状态
      setData(prev => ({
        ...prev,
        diaries: prev.diaries.map(diary =>
          diary.id === editingDiaryId 
            ? { ...diary, content: editingContent.trim() }
            : diary
        )
      }))

      setEditingDiaryId(null)
      setEditingContent('')

    } catch (error) {
      console.error('保存日记失败:', error)
      setData(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : '保存失败'
      }))
    } finally {
      setIsUpdating(false)
    }
  }

  // 删除日记
  const handleDeleteDiary = async (diaryId: number) => {
    if (isDeleting) return

    const confirmed = confirm('确定要删除这篇日记吗？此操作不可撤销。')
    if (!confirmed) return

    try {
      setIsDeleting(diaryId)

      // 获取用户session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('用户session已过期，请重新登录')
      }

      const response = await fetch(`/api/diary/${diaryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '删除失败')
      }

      // 从本地状态中移除
      setData(prev => ({
        ...prev,
        diaries: prev.diaries.filter(diary => diary.id !== diaryId)
      }))

    } catch (error) {
      console.error('删除日记失败:', error)
      setData(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : '删除失败'
      }))
    } finally {
      setIsDeleting(null)
    }
  }

  // 重新生成日记
  const handleRegenerateDiary = async (diaryId: number) => {
    if (isRegenerating) return

    try {
      setIsRegenerating(diaryId)

      // 获取API配置
      const model = localStorage.getItem(`chat_model_${sessionId}`) || 'deepseek-chat'
      const modelConfig = getModelConfig(model)

      if (!modelConfig.apiKey) {
        throw new Error('请先在设置中配置对应的 API Key')
      }

      // 获取用户session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('用户session已过期，请重新登录')
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'x-api-key': modelConfig.apiKey,
        'x-model': model
      }

      // 如果是中转API，添加额外的headers
      if (modelConfig.isRelay) {
        headers['x-base-url'] = modelConfig.baseUrl || ''
        headers['x-actual-model'] = modelConfig.modelName || ''
      }

      const response = await fetch(`/api/diary/${diaryId}/regenerate`, {
        method: 'POST',
        headers
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '重新生成失败')
      }

      // 更新本地状态
      setData(prev => ({
        ...prev,
        diaries: prev.diaries.map(diary =>
          diary.id === diaryId 
            ? result.diary
            : diary
        )
      }))

    } catch (error) {
      console.error('重新生成日记失败:', error)
      setData(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : '重新生成失败'
      }))
    } finally {
      setIsRegenerating(null)
    }
  }

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user, sessionId])

  if (!user) {
    return (
      <div className="h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-lg">请先登录</p>
        </div>
      </div>
    )
  }

  if (data.loading) {
    return (
      <div className="h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>加载中...</p>
        </div>
      </div>
    )
  }

  if (data.error) {
    return (
      <div className="h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-lg mb-4">{data.error}</p>
          <Button onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-slate-50 flex flex-col">
      {/* 固定头部 */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="p-2 h-8 w-8"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            {data.character && (
              <div className="flex items-center space-x-2">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={data.character.avatar_url || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                    {data.character.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-base font-semibold truncate">
                  {data.character.name} 的日记本
                </h2>
              </div>
            )}
          </div>
          
          
          <div className="flex items-center space-x-2">
            <Button 
              onClick={generateDiary}
              disabled={data.generating}
              size="sm"
              className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {data.generating ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  生成中
                </>
              ) : (
                <>
                  <Edit3 className="h-3 w-3 mr-1" />
                  生成新日记
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* 内容区域 - 占据剩余空间 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {/* 日记列表 */}
          <div className="space-y-4">
            {data.diaries.length === 0 ? (
              <Card className="shadow-lg border-slate-200">
                <CardContent className="p-12 text-center">
                  <BookOpen className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">
                    还没有日记
                  </h3>
                  <p className="text-slate-600 mb-6">
                    开始与 {data.character?.name} 对话，然后生成第一篇日记吧！
                  </p>
                  <Button 
                    onClick={generateDiary}
                    disabled={data.generating}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {data.generating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <Edit3 className="h-4 w-4 mr-2" />
                        生成第一篇日记
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <AnimatePresence>
                {data.diaries.map((diary, index) => (
                  <motion.div
                    key={diary.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="shadow-lg border-slate-200 hover:shadow-xl transition-shadow duration-300">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <Calendar className="h-5 w-5 text-blue-600" />
                            <CardTitle className="text-lg text-slate-900">
                              {formatDate(diary.created_at)}
                            </CardTitle>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center space-x-2 text-sm text-slate-500 mr-3">
                              <User className="h-4 w-4" />
                              <span>{data.character?.name}</span>
                            </div>
                            
                            {/* 操作按钮 */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => handleEditDiary(diary)}
                                  disabled={editingDiaryId === diary.id}
                                >
                                  <Edit2 className="h-4 w-4 mr-2" />
                                  编辑
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleRegenerateDiary(diary.id)}
                                  disabled={isRegenerating === diary.id}
                                >
                                  <RotateCcw className="h-4 w-4 mr-2" />
                                  {isRegenerating === diary.id ? '重新生成中...' : '重新生成'}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDeleteDiary(diary.id)}
                                  disabled={isDeleting === diary.id}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  {isDeleting === diary.id ? '删除中...' : '删除'}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardHeader>
                      <Separator />
                      <CardContent className="pt-6">
                        {editingDiaryId === diary.id ? (
                          /* 编辑模式 */
                          <div className="space-y-4">
                            <Textarea
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              className="min-h-[200px] resize-none"
                              placeholder="编辑日记内容..."
                            />
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCancelEdit}
                                disabled={isUpdating}
                              >
                                <X className="h-4 w-4 mr-1" />
                                取消
                              </Button>
                              <Button
                                size="sm"
                                onClick={handleSaveEdit}
                                disabled={isUpdating || !editingContent.trim()}
                              >
                                {isUpdating ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                    保存中...
                                  </>
                                ) : (
                                  <>
                                    <Save className="h-4 w-4 mr-1" />
                                    保存
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* 正常显示模式 */
                          <div className="prose prose-sm max-w-none text-slate-700">
                            {isRegenerating === diary.id ? (
                              <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                                <span>重新生成中...</span>
                              </div>
                            ) : (
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {diary.content}
                              </ReactMarkdown>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* 刷新按钮 */}
          <div className="mt-8 text-center">
            <Button 
              variant="outline" 
              onClick={fetchData}
              disabled={data.loading}
              className="bg-white border-slate-200"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
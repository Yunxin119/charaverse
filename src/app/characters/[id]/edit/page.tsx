'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter, useParams } from 'next/navigation'
import { 
  User, 
  Bot, 
  AlertTriangle, 
  Save, 
  Eye,
  Upload,
  Sparkles,
  Plus,
  X,
  BookOpen,
  Settings,
  Target,
  MapPin,
  MessageCircle,
  ArrowLeft,
  Loader2
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '../../../lib/supabase'
import { useAppSelector } from '../../../store/hooks'
import { TemplateManager } from '../../../components/TemplateManager'
import { SimpleAvatarUpload } from '../../../components/AvatarUpload'
import { uploadCharacterAvatar } from '../../../lib/avatarUpload'

interface BasicInfo {
  name: string
  age: string
  gender: string
  keywords: string[]
  description: string
  avatar_url: string
  is_public: boolean
  introduction: string // 角色说明，给其他用户看的介绍
}

interface PromptModule {
  id: string
  type: string
  name?: string // 只有自定义模块才有名称
  content: string
  // 用户角色设定的特殊字段
  userRoleName?: string
  userRoleAge?: string
  userRoleGender?: string
  userRoleDetails?: string
}

export default function EditCharacterPage() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAppSelector((state) => state.auth)
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const characterId = params.id as string
  
  const [basicInfo, setBasicInfo] = useState<BasicInfo>({
    name: '',
    age: '',
    gender: '',
    keywords: [],
    description: '',
    avatar_url: '',
    is_public: false,
    introduction: ''
  })

  // 关键词输入状态
  const [keywordInput, setKeywordInput] = useState('')

  // 默认只有一个用户角色设定模块
  const [modules, setModules] = useState<PromptModule[]>([
    { 
      id: '1', 
      type: '用户角色设定', 
      content: '', 
      userRoleName: '', 
      userRoleAge: '', 
      userRoleGender: '', 
      userRoleDetails: '' 
    }
  ])

  const [activeTab, setActiveTab] = useState('basic')
  const [avatarTimestamp, setAvatarTimestamp] = useState(Date.now())

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4 }
    }
  }

  // 加载角色数据
  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }

    if (!characterId) return

    const loadCharacter = async () => {
      setIsInitialLoading(true)
      try {
        const { data, error } = await supabase
          .from('characters')
          .select('*')
          .eq('id', characterId)
          .eq('user_id', user.id) // 确保只能编辑自己的角色
          .single()

        if (error) throw error

        if (data) {
          // 解析 prompt_template
          const promptTemplate = data.prompt_template || {}
          const basicInfoData = promptTemplate.basic_info || {}
          const modulesData = promptTemplate.modules || []

          // 设置基本信息
          setBasicInfo({
            name: data.name || '',
            age: basicInfoData.age || '',
            gender: basicInfoData.gender || '',
            keywords: basicInfoData.keywords || [],
            description: basicInfoData.description || '',
            avatar_url: data.avatar_url || '',
            is_public: data.is_public || false,
            introduction: basicInfoData.introduction || ''
          })

          // 设置模块数据，如果没有模块则使用默认的用户角色设定
          if (modulesData.length > 0) {
            // 解析模块数据，特别处理用户角色设定模块
            const parsedModules = modulesData.map((module: any, index: number) => {
              if (module.type === '用户角色设定') {
                // 尝试从content中解析用户角色信息
                let userRoleName = module.userRoleName || ''
                let userRoleAge = module.userRoleAge || ''
                let userRoleGender = module.userRoleGender || ''
                let userRoleDetails = module.userRoleDetails || ''
                
                // 如果没有单独的字段，尝试从content解析（兼容老数据）
                if (!userRoleName && !userRoleAge && !userRoleGender && !userRoleDetails && module.content) {
                  const lines = module.content.split('\n')
                  lines.forEach((line: string) => {
                    if (line.includes('用户角色姓名：')) {
                      userRoleName = line.replace('用户角色姓名：', '').trim()
                    } else if (line.includes('用户角色年龄：')) {
                      userRoleAge = line.replace('用户角色年龄：', '').trim()
                    } else if (line.includes('用户角色性别：')) {
                      userRoleGender = line.replace('用户角色性别：', '').trim()
                    } else if (line.includes('用户角色详细设定：')) {
                      userRoleDetails = line.replace('用户角色详细设定：', '').trim()
                    }
                  })
                }
                
                return {
                  ...module,
                  id: module.id || `user_role_${index}`,
                  userRoleName,
                  userRoleAge,
                  userRoleGender,
                  userRoleDetails
                }
              }
              
              return {
                ...module,
                id: module.id || `module_${index}`
              }
            })
            
            setModules(parsedModules)
          }
        }
      } catch (error) {
        console.error('加载角色失败:', error)
        router.push('/characters')
      } finally {
        setIsInitialLoading(false)
      }
    }

    loadCharacter()
  }, [characterId, user, router])

  const handleBasicInfoChange = (field: keyof BasicInfo, value: string | boolean | string[]) => {
    setBasicInfo(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // 处理关键词输入
  const handleKeywordInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    
    // 检查是否输入了逗号（支持中文和英文逗号）
    if (value.includes(',') || value.includes('，')) {
      // 将中文逗号替换为英文逗号，然后分割
      const normalizedValue = value.replace(/，/g, ',')
      const parts = normalizedValue.split(',')
      const keywords = parts.slice(0, -1).map(k => k.trim()).filter(k => k.length > 0)
      const remaining = parts[parts.length - 1] // 逗号后的剩余内容
      
      if (keywords.length > 0) {
        // 添加新关键词到列表中（去重）
        const newKeywords = [...basicInfo.keywords]
        keywords.forEach(keyword => {
          if (!newKeywords.includes(keyword)) {
            newKeywords.push(keyword)
          }
        })
        handleBasicInfoChange('keywords', newKeywords)
      }
      
      // 设置输入框为逗号后的剩余内容
      setKeywordInput(remaining)
    } else {
      setKeywordInput(value)
    }
  }

  // 处理按键事件
  const handleKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const keyword = keywordInput.trim()
      if (keyword && !basicInfo.keywords.includes(keyword)) {
        handleBasicInfoChange('keywords', [...basicInfo.keywords, keyword])
        setKeywordInput('')
      }
    } else if (e.key === 'Backspace' && keywordInput === '' && basicInfo.keywords.length > 0) {
      // 如果输入框为空且按下退格键，删除最后一个关键词
      const newKeywords = [...basicInfo.keywords]
      newKeywords.pop()
      handleBasicInfoChange('keywords', newKeywords)
    }
  }

  // 删除关键词
  const removeKeyword = (indexToRemove: number) => {
    const newKeywords = basicInfo.keywords.filter((_, index) => index !== indexToRemove)
    handleBasicInfoChange('keywords', newKeywords)
  }

  // 添加新模块
  const addModule = (type: string) => {
    const newId = Date.now().toString()
    
    if (type === '用户角色设定') {
      setModules(prev => [...prev, { 
        id: newId, 
        type, 
        content: '', 
        userRoleName: '', 
        userRoleAge: '', 
        userRoleGender: '', 
        userRoleDetails: '' 
      }])
    } else if (type === '自定义模块') {
      setModules(prev => [...prev, { 
        id: newId, 
        type, 
        name: '', 
        content: '' 
      }])
    } else {
      setModules(prev => [...prev, { 
        id: newId, 
        type, 
        content: '' 
      }])
    }
  }

  // 更新模块内容
  const updateModule = (id: string, field: string, value: string) => {
    setModules(prev => prev.map(module => 
      module.id === id ? { ...module, [field]: value } : module
    ))
  }

  // 删除模块（至少保留一个）
  const removeModule = (id: string) => {
    if (modules.length > 1) {
      setModules(prev => prev.filter(module => module.id !== id))
    }
  }

  // 头像上传处理
  const handleAvatarUpload = async (file: File): Promise<string> => {
    try {
      const avatarUrl = await uploadCharacterAvatar(file, parseInt(characterId))
      
      // 更新基本信息中的头像URL
      setBasicInfo(prev => ({
        ...prev,
        avatar_url: avatarUrl
      }))

      // 更新时间戳以强制刷新banner背景
      setAvatarTimestamp(Date.now())

      return avatarUrl
    } catch (error) {
      console.error('头像上传失败:', error)
      throw error
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user || !basicInfo.name.trim()) {
      return
    }

    setIsLoading(true)

    try {
      // 处理模块内容
      const processedModules = modules.map(module => {
        if (module.type === '用户角色设定') {
          // 为用户角色设定构建内容
          const userRoleContent = `用户角色姓名：${module.userRoleName || '未设定'}\n用户角色年龄：${module.userRoleAge || '未设定'}\n用户角色性别：${module.userRoleGender || '未设定'}\n用户角色详细设定：${module.userRoleDetails || '未设定'}`
          return { ...module, content: userRoleContent }
        }
        return module
      })

      // 构建完整的 prompt template
      const promptTemplate = { 
        basic_info: basicInfo,
        modules: processedModules
      }

      const { error } = await supabase
        .from('characters')
        .update({
          name: basicInfo.name,
          avatar_url: basicInfo.avatar_url,
          prompt_template: promptTemplate,
          is_public: basicInfo.is_public,
          updated_at: new Date().toISOString()
        })
        .eq('id', characterId)
        .eq('user_id', user.id)

      if (error) throw error

      router.push('/characters')
    } catch (error) {
      console.error('更新角色失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const genderOptions = [
    { value: 'male', label: '男' },
    { value: 'female', label: '女' },
    { value: 'none', label: '无性别' },
    { value: 'other', label: '其他' }
  ]

  const moduleTypes = [
    { value: '用户角色设定', label: '用户角色设定', icon: User },
    { value: '特殊要求', label: '特殊要求', icon: Target },
    { value: '注意事项', label: '注意事项', icon: AlertTriangle },
    { value: '初始情景', label: '初始情景', icon: MapPin },
    { value: '自定义模块', label: '自定义模块', icon: Settings }
  ]

  const getModuleIcon = (type: string) => {
    const moduleType = moduleTypes.find(t => t.value === type)
    return moduleType ? moduleType.icon : Settings
  }

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-slate-900" />
          <p className="text-slate-600">加载角色数据中...</p>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-4xl mx-auto space-y-6 pb-6"
    >
      {/* Character Banner - 类似微信朋友圈背景 */}
      <motion.div variants={itemVariants} className="relative -mx-4 -mt-6 mb-8 sm:-mx-6">
        {/* Back Button - 绝对定位在左上角 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="absolute top-4 left-4 z-20 bg-black/20 hover:bg-black/40 text-white border-white/20"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        
        <div className="w-full aspect-[1.8/1] overflow-hidden relative" key={basicInfo.avatar_url || 'no-avatar'}>
          {/* Avatar Background or Default Background */}
          {basicInfo.avatar_url ? (
            <>
              {/* Avatar as Background */}
              <div 
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: `url(${basicInfo.avatar_url}?t=${avatarTimestamp})` }}
              ></div>
              {/* Dark overlay for text readability */}
              <div className="absolute inset-0 bg-black/50"></div>
            </>
          ) : (
            <>
              {/* Default gradient background when no avatar */}
              <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200">
                {/* Dynamic Background Pattern */}
                <div className="absolute inset-0 opacity-40">
                  <div className="absolute top-0 left-1/4 w-40 h-40 bg-blue-400 rounded-full blur-3xl"></div>
                  <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-purple-400 rounded-full blur-3xl"></div>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-indigo-300 rounded-full blur-2xl"></div>
                  <div className="absolute top-1/4 right-1/3 w-24 h-24 bg-pink-300 rounded-full blur-2xl"></div>
                </div>
              </div>
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
            </>
          )}
          
          {/* Character Avatar - 右下角位置 */}
          <div className="absolute bottom-6 right-6">
            <motion.div 
              className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-2xl bg-white cursor-pointer group"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              onClick={() => {
                // 触发头像上传
                const fileInput = document.getElementById('avatar-upload') as HTMLInputElement
                fileInput?.click()
              }}
            >
              {basicInfo.avatar_url ? (
                <div className="relative w-full h-full">
                  <img 
                    src={basicInfo.avatar_url} 
                    alt={basicInfo.name || '角色头像'}
                    className="w-full h-full object-cover"
                  />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-white" />
                  </div>
                </div>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center group-hover:from-blue-600 group-hover:to-purple-700 transition-colors duration-200">
                  <div className="flex flex-col items-center">
                    <span className="text-white text-4xl font-bold mb-1">
                      {basicInfo.name ? basicInfo.name[0].toUpperCase() : '?'}
                    </span>
                    <Upload className="w-4 h-4 text-white/80" />
                  </div>
                </div>
              )}
            </motion.div>
          </div>
          
          {/* Character Info - 左下角位置 */}
          <div className="absolute bottom-6 left-6 text-white z-10">
            <h1 className="text-4xl font-bold drop-shadow-lg mb-2">
              {basicInfo.name || '编辑角色'}
            </h1>
            <p className="text-lg opacity-90 drop-shadow mb-1">
              {basicInfo.age ? `${basicInfo.age} · ` : ''}
              {basicInfo.gender ? (basicInfo.gender === 'male' ? '男' : basicInfo.gender === 'female' ? '女' : basicInfo.gender === 'none' ? '无性别' : '其他') : ''}
            </p>
            <p className="text-sm opacity-80 drop-shadow">
              修改角色设定，完善角色形象
            </p>
          </div>
          
          {/* Upload Hint - 右上角 */}
          <div className="absolute top-4 right-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1">
              <p className="text-white text-xs">点击头像更换图片</p>
            </div>
          </div>
        </div>
      </motion.div>

      <form onSubmit={handleSubmit}>
        {/* Hidden file input for avatar upload */}
        <input
          type="file"
          accept="image/*"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (file) {
              try {
                await handleAvatarUpload(file)
              } catch (error) {
                console.error('头像上传失败:', error)
                alert(error instanceof Error ? error.message : '头像上传失败，请重试')
              }
            }
            e.target.value = '' // 清空input值，允许重复选择同一文件
          }}
          className="hidden"
          id="avatar-upload"
        />
        
        <motion.div variants={itemVariants}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">基本信息</TabsTrigger>
              <TabsTrigger value="settings">其他设定</TabsTrigger>
            </TabsList>

            {/* Basic Information Tab */}
            <TabsContent value="basic" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>角色基本信息</CardTitle>
                  <CardDescription>设置角色的基本属性和外观</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">


                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Character Name */}
                    <div className="space-y-2">
                      <Label htmlFor="name">角色名称 *</Label>
                      <Input
                        id="name"
                        placeholder="为你的AI角色起一个名字"
                        value={basicInfo.name}
                        onChange={(e) => handleBasicInfoChange('name', e.target.value)}
                        required
                      />
                    </div>

                    {/* Character Age */}
                    <div className="space-y-2">
                      <Label htmlFor="age">角色年龄</Label>
                      <Input
                        id="age"
                        placeholder="例如：25岁 或 未知"
                        value={basicInfo.age}
                        onChange={(e) => handleBasicInfoChange('age', e.target.value)}
                      />
                    </div>

                    {/* Character Gender */}
                    <div className="space-y-2">
                      <Label htmlFor="gender">角色性别</Label>
                      <Select value={basicInfo.gender} onValueChange={(value) => handleBasicInfoChange('gender', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择性别" />
                        </SelectTrigger>
                        <SelectContent>
                          {genderOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Character Keywords - 标签输入组件 */}
                    <div className="space-y-2">
                      <Label htmlFor="keywords">角色关键词</Label>
                      <div className="space-y-3">
                        {/* 关键词标签显示 */}
                        {basicInfo.keywords.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {basicInfo.keywords.map((keyword, index) => (
                              <motion.div
                                key={index}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded-full border transition-colors"
                              >
                                <span>{keyword}</span>
                                <button
                                  type="button"
                                  onClick={() => removeKeyword(index)}
                                  className="flex items-center justify-center w-4 h-4 rounded-full hover:bg-slate-300 transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </motion.div>
                            ))}
                          </div>
                        )}
                        {/* 输入框 */}
                        <Input
                          id="keywords"
                          placeholder={basicInfo.keywords.length === 0 ? "输入关键词，如古代，权谋，魔法..." : "继续添加关键词..."}
                          value={keywordInput}
                          onChange={handleKeywordInput}
                          onKeyDown={handleKeywordKeyDown}
                          className="w-full"
                        />
                        <p className="text-xs text-slate-500">
                          输入关键词后按逗号、回车键来添加标签。按退格键删除最后一个标签。
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Description */}
                  <div className="space-y-2">
                    <Label htmlFor="description">详细设定</Label>
                    <Textarea
                      id="description"
                      placeholder="详细描述你的角色，包括外观、性格、背景等..."
                      value={basicInfo.description}
                      onChange={(e) => handleBasicInfoChange('description', e.target.value)}
                      className="min-h-[120px] resize-none"
                    />
                    <p className="text-xs text-slate-500">此信息用于AI对话，不会公开显示</p>
                  </div>

                  {/* Character Introduction */}
                  <div className="space-y-2">
                    <Label htmlFor="introduction">角色说明</Label>
                    <Textarea
                      id="introduction"
                      placeholder="为其他用户介绍这个角色，包括角色特点、使用场景、对话风格等..."
                      value={basicInfo.introduction}
                      onChange={(e) => handleBasicInfoChange('introduction', e.target.value)}
                      className="min-h-[100px] resize-none"
                    />
                    <p className="text-xs text-slate-500">此说明会在角色列表中显示，帮助其他用户了解角色</p>
                  </div>

                  {/* Public Setting */}
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="is_public"
                      checked={basicInfo.is_public}
                      onChange={(e) => handleBasicInfoChange('is_public', e.target.checked)}
                      className="w-4 h-4 text-slate-900 bg-gray-100 border-gray-300 rounded focus:ring-slate-500"
                    />
                    <Label htmlFor="is_public" className="flex-1">
                      <div>
                        <p className="font-medium">公开角色</p>
                        <p className="text-sm text-slate-500">允许其他用户发现和使用你的角色</p>
                      </div>
                    </Label>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Other Settings Tab - 完全模块化 */}
            <TabsContent value="settings" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>模块化设定</CardTitle>
                      <CardDescription>通过添加不同模块来构建你的角色设定</CardDescription>
                    </div>
                    <Select onValueChange={(value) => addModule(value)}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="添加设定模块" />
                      </SelectTrigger>
                      <SelectContent>
                        {moduleTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center space-x-2">
                              <type.icon className="w-4 h-4" />
                              <span>{type.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  {modules.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">还没有设定模块</p>
                      <p className="text-sm">点击上方下拉菜单添加你的第一个设定模块</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {modules.map((module, index) => {
                        const Icon = getModuleIcon(module.type)
                        return (
                          <motion.div
                            key={module.id}
                            variants={itemVariants}
                            className="border border-slate-200 rounded-lg p-6 space-y-4"
                          >
                            {/* Module Header */}
                                                        <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                                  <Icon className="w-4 h-4 text-slate-600" />
                                </div>
                                <span className="font-medium text-slate-900">{module.type}</span>
                                <span className="text-sm text-slate-500">#{index + 1}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <TemplateManager
                                  templateType={module.type}
                                  currentContent={module.type === '用户角色设定' ? {
                                    userRoleName: module.userRoleName || '',
                                    userRoleAge: module.userRoleAge || '',
                                    userRoleGender: module.userRoleGender || '',
                                    userRoleDetails: module.userRoleDetails || ''
                                  } : module.type === '自定义模块' ? {
                                    name: module.name || '',
                                    content: module.content || ''
                                  } : {
                                    content: module.content || ''
                                  }}
                                  onLoadTemplate={(content) => {
                                    if (module.type === '用户角色设定') {
                                      setModules(prev => prev.map(m => 
                                        m.id === module.id ? {
                                          ...m,
                                          userRoleName: content.userRoleName || '',
                                          userRoleAge: content.userRoleAge || '',
                                          userRoleGender: content.userRoleGender || '',
                                          userRoleDetails: content.userRoleDetails || ''
                                        } : m
                                      ))
                                    } else if (module.type === '自定义模块') {
                                      setModules(prev => prev.map(m => 
                                        m.id === module.id ? {
                                          ...m,
                                          name: content.name || '',
                                          content: content.content || ''
                                        } : m
                                      ))
                                    } else {
                                      setModules(prev => prev.map(m => 
                                        m.id === module.id ? {
                                          ...m,
                                          content: content.content || ''
                                        } : m
                                      ))
                                    }
                                  }}
                                />
                                {modules.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeModule(module.id)}
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
      
                            {/* 用户角色设定的特殊字段 */}
                            {module.type === '用户角色设定' && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium text-slate-600">用户角色姓名</Label>
                                    <Input
                                      placeholder="用户角色姓名"
                                      value={module.userRoleName || ''}
                                      onChange={(e) => updateModule(module.id, 'userRoleName', e.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium text-slate-600">用户角色年龄</Label>
                                    <Input
                                      placeholder="用户角色年龄"
                                      value={module.userRoleAge || ''}
                                      onChange={(e) => updateModule(module.id, 'userRoleAge', e.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium text-slate-600">用户角色性别</Label>
                                    <Select 
                                      value={module.userRoleGender || ''} 
                                      onValueChange={(value) => updateModule(module.id, 'userRoleGender', value)}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="选择性别" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {genderOptions.map((option) => (
                                          <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-sm font-medium text-slate-600">用户角色详细设定</Label>
                                  <Textarea
                                    placeholder="详细描述用户角色的背景、性格、经历等..."
                                    value={module.userRoleDetails || ''}
                                    onChange={(e) => updateModule(module.id, 'userRoleDetails', e.target.value)}
                                    className="min-h-[100px] resize-none"
                                  />
                                </div>
                              </div>
                            )}

                            {/* 自定义模块的名称字段 */}
                            {module.type === '自定义模块' && (
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-slate-600">模块名称</Label>
                                <Input
                                  placeholder="自定义模块名称"
                                  value={module.name || ''}
                                  onChange={(e) => updateModule(module.id, 'name', e.target.value)}
                                />
                              </div>
                            )}

                            {/* 通用内容字段（非用户角色设定） */}
                            {module.type !== '用户角色设定' && (
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-slate-600">
                                  {module.type === '自定义模块' ? '模块内容' : '内容'}
                                </Label>
                                <Textarea
                                  placeholder={`输入${module.type}内容...`}
                                  value={module.content}
                                  onChange={(e) => updateModule(module.id, 'content', e.target.value)}
                                  className="min-h-[100px] resize-none"
                                />
                              </div>
                            )}
                          </motion.div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Action Buttons */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="pt-6 pb-6">
              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                >
                  取消
                </Button>
                <div className="flex space-x-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!basicInfo.name.trim()}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    预览
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading || !basicInfo.name.trim()}
                    className="bg-slate-900 hover:bg-slate-800"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        保存修改
                      </>
                    )}
                  </Button>
      </div>
    </div>
            </CardContent>
          </Card>
        </motion.div>
      </form>
    </motion.div>
  )
} 
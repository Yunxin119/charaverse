'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
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
  MessageCircle
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '../../lib/supabase'
import { useAppSelector } from '../../store/hooks'
import { TemplateManager } from '../../components/TemplateManager'
import { SimpleAvatarUpload } from '../../components/AvatarUpload'
import { uploadCharacterAvatar } from '../../lib/avatarUpload'
import { ScriptCharacter } from '../../lib/supabase'

interface BasicInfo {
  name: string // 角色名称
  description: string // 角色描述
  avatar_url: string // 角色头像
  is_public: boolean
  introduction: string // 角色说明
  initialMessage?: string // 初始对话
  age?: string // 角色年龄
  gender?: 'male' | 'female' | 'none' | 'other' // 角色性别
  keywords?: string[] // 角色关键词
  script_type?: 'single' | 'multi' // 剧本类型
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

export default function NewCharacterPage() {
  const router = useRouter()
  const { user } = useAppSelector((state) => state.auth)
  const [isLoading, setIsLoading] = useState(false)
  
  const [basicInfo, setBasicInfo] = useState<BasicInfo>({
    name: '',
    description: '',
    avatar_url: '',
    is_public: false,
    introduction: '',
    keywords: []
  })

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

  const handleBasicInfoChange = (field: keyof BasicInfo, value: string | boolean) => {
    setBasicInfo(prev => ({
      ...prev,
      [field]: value
    }))
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
      const avatarUrl = await uploadCharacterAvatar(file)
      
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

      const { data, error } = await supabase
        .from('characters')
        .insert({
          user_id: user.id,
          name: basicInfo.name,
          avatar_url: basicInfo.avatar_url,
          prompt_template: promptTemplate,
          is_public: basicInfo.is_public
        })
        .select()
        .single()

      if (error) throw error

      router.push('/characters')
    } catch (error) {
      console.error('创建角色失败:', error)
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

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-4xl mx-auto space-y-6 pb-6"
    >
      {/* Character Banner - 类似微信朋友圈背景 */}
      <motion.div variants={itemVariants} className="relative -mx-4 -mt-6 mb-8 sm:-mx-6">
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
              className="w-32 h-32 rounded-full overflow-hidden border-4 border-white dark:border-slate-600 shadow-2xl bg-white dark:bg-slate-700 cursor-pointer group"
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
              {basicInfo.name || '创建新角色'}
            </h1>
            <p className="text-lg opacity-90 drop-shadow mb-1">
              {basicInfo.age ? `${basicInfo.age} · ` : ''}
              {basicInfo.gender ? (basicInfo.gender === 'male' ? '男' : basicInfo.gender === 'female' ? '女' : basicInfo.gender === 'none' ? '无性别' : '其他') : ''}
            </p>
            <p className="text-sm opacity-80 drop-shadow">
              设计你的专属AI角色，开始独特的对话体验
            </p>
          </div>
          
          {/* Upload Hint - 右上角 */}
          <div className="absolute top-4 right-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1">
              <p className="text-white text-xs">点击头像上传图片</p>
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

            {/* Script Information Tab */}
            <TabsContent value="basic" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>剧本基本信息</CardTitle>
                  <CardDescription>设置剧本的基本属性和类型</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Script Name */}
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="name">剧本名称 *</Label>
                      <Input
                        id="name"
                        placeholder="为你的剧本起一个名字"
                        value={basicInfo.name}
                        onChange={(e) => handleBasicInfoChange('name', e.target.value)}
                        required
                      />
                    </div>

                    {/* Script Type */}
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="script_type">剧本类型</Label>
                      <Select value={basicInfo.script_type} onValueChange={(value: 'single' | 'multi') => handleBasicInfoChange('script_type', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择剧本类型" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single">单角色剧本</SelectItem>
                          <SelectItem value="multi">多角色剧本</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {basicInfo.script_type === 'single'
                          ? '单角色剧本：只包含一个角色，适合单人对话'
                          : '多角色剧本：包含多个角色，支持角色之间的互动对话'
                        }
                      </p>
                    </div>
                  </div>

                  {/* Script Description */}
                  <div className="space-y-2">
                    <Label htmlFor="description">剧本背景</Label>
                    <Textarea
                      id="description"
                      placeholder="描述剧本的世界观、背景设定、故事环境等..."
                      value={basicInfo.description}
                      onChange={(e) => handleBasicInfoChange('description', e.target.value)}
                      className="min-h-[120px] resize-none"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400">剧本背景将帮助AI理解整体设定和氛围</p>
                  </div>

                  {/* Script Introduction */}
                  <div className="space-y-2">
                    <Label htmlFor="introduction">剧本介绍</Label>
                    <Textarea
                      id="introduction"
                      placeholder="为其他用户介绍这个剧本，包括剧本特色、使用场景、对话风格等..."
                      value={basicInfo.introduction}
                      onChange={(e) => handleBasicInfoChange('introduction', e.target.value)}
                      className="min-h-[100px] resize-none"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400">此介绍会在剧本列表中显示，帮助其他用户了解剧本</p>
                  </div>

                  {/* Initial Message */}
                  <div className="space-y-2">
                    <Label htmlFor="initialMessage" className="flex items-center">
                      <MessageCircle className="w-4 h-4 mr-2" />
                      初始对话（可选）
                    </Label>
                    <Textarea
                      id="initialMessage"
                      placeholder="设置角色的开场白，如：你好，我是...。如果不填写，AI将自动生成第一句话。"
                      value={basicInfo.initialMessage || ''}
                      onChange={(e) => handleBasicInfoChange('initialMessage', e.target.value)}
                      className="min-h-[80px] resize-none"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400">每位用户进入聊天时都会看到这句话，让角色体验更一致</p>
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
                        <p className="font-medium">公开剧本</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">允许其他用户发现和使用你的剧本</p>
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
                  <div className="space-y-4 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-lg sm:text-xl">模块化设定</CardTitle>
                      <CardDescription className="text-sm">通过添加不同模块来构建你的角色设定</CardDescription>
                    </div>
                    <Select onValueChange={(value) => addModule(value)}>
                      <SelectTrigger className="w-full sm:w-48 h-10">
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
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
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
                            className="border border-slate-200 dark:border-slate-600 rounded-lg p-4 sm:p-6 space-y-4 bg-white dark:bg-slate-800"
                          >
                            {/* Module Header - 移动端优化 */}
                            <div className="space-y-3">
                              {/* 标题行 - 移动端单独一行 */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2 min-w-0 flex-1">
                                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600 dark:text-slate-300 dark:text-slate-400" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <h3 className="font-medium text-slate-900 dark:text-white text-sm sm:text-base truncate">{module.type}</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 sm:hidden">模块 #{index + 1}</p>
                                  </div>
                                  <span className="text-sm text-slate-500 dark:text-slate-400 hidden sm:inline">#{index + 1}</span>
                                </div>
                                {modules.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeModule(module.id)}
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30 flex-shrink-0 ml-2 h-8 w-8 p-0"
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                              
                              {/* 操作按钮行 - 移动端独立一行 */}
                              <div className="flex justify-start">
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
                              </div>
                            </div>

                            {/* 用户角色设定的特殊字段 - 移动端优化 */}
                            {module.type === '用户角色设定' && (
                              <div className="space-y-4">
                                {/* 移动端采用单列布局，桌面端保持三列 */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium text-slate-600 dark:text-slate-300">姓名</Label>
                                    <Input
                                      placeholder="用户角色姓名"
                                      value={module.userRoleName || ''}
                                      onChange={(e) => updateModule(module.id, 'userRoleName', e.target.value)}
                                      className="h-10"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium text-slate-600 dark:text-slate-300">年龄</Label>
                                    <Input
                                      placeholder="用户角色年龄"
                                      value={module.userRoleAge || ''}
                                      onChange={(e) => updateModule(module.id, 'userRoleAge', e.target.value)}
                                      className="h-10"
                                    />
                                  </div>
                                  <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                                    <Label className="text-sm font-medium text-slate-600 dark:text-slate-300">性别</Label>
                                    <Select 
                                      value={module.userRoleGender || ''} 
                                      onValueChange={(value) => updateModule(module.id, 'userRoleGender', value)}
                                    >
                                      <SelectTrigger className="h-10">
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
                                  <Label className="text-sm font-medium text-slate-600 dark:text-slate-300">详细设定</Label>
                                  <Textarea
                                    placeholder="详细描述用户角色的背景、性格、经历等..."
                                    value={module.userRoleDetails || ''}
                                    onChange={(e) => updateModule(module.id, 'userRoleDetails', e.target.value)}
                                    className="min-h-[100px] resize-none text-sm"
                                  />
                                </div>
                              </div>
                            )}

                            {/* 自定义模块的名称字段 */}
                            {module.type === '自定义模块' && (
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-slate-600 dark:text-slate-300">模块名称</Label>
                                <Input
                                  placeholder="自定义模块名称"
                                  value={module.name || ''}
                                  onChange={(e) => updateModule(module.id, 'name', e.target.value)}
                                  className="h-10"
                                />
                              </div>
                            )}

                            {/* 通用内容字段（非用户角色设定） */}
                            {module.type !== '用户角色设定' && (
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                  {module.type === '自定义模块' ? '模块内容' : '内容'}
                                </Label>
                                <Textarea
                                  placeholder={`输入${module.type}内容...`}
                                  value={module.content}
                                  onChange={(e) => updateModule(module.id, 'content', e.target.value)}
                                  className="min-h-[100px] resize-none text-sm"
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

        {/* Action Buttons - 移动端优化 */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="pt-4 pb-4 sm:pt-6 sm:pb-6">
              {/* 移动端垂直布局，桌面端水平布局 */}
              <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:justify-between sm:items-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  className="w-full sm:w-auto h-11 sm:h-10"
                >
                  取消
                </Button>
                <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3">
                  {/* <Button
                    type="button"
                    variant="outline"
                    disabled={!basicInfo.name.trim()}
                    className="w-full sm:w-auto h-11 sm:h-10"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    预览
                  </Button> */}
                  <Button
                    type="submit"
                    disabled={isLoading || !basicInfo.name.trim()}
                    className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 text-white w-full sm:w-auto h-11 sm:h-10"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white dark:border-slate-900 border-t-transparent dark:border-t-transparent" />
                        创建中...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        创建角色
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
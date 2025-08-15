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

interface BasicInfo {
  name: string
  age: string
  gender: string
  keywords: string[]
  description: string
  avatar_url: string
  is_public: boolean
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
    age: '',
    gender: '',
    keywords: [],
    description: '',
    avatar_url: '',
    is_public: false
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
      className="max-w-4xl mx-auto space-y-8"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">创建新角色</h1>
            <p className="text-slate-600 mt-1">设计你的专属AI角色，开始独特的对话体验</p>
          </div>
        </div>
      </motion.div>

      <form onSubmit={handleSubmit}>
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
                  {/* Avatar Section */}
                  <div className="flex items-center space-x-6">
                    <Avatar className="w-24 h-24">
                      <AvatarImage src={basicInfo.avatar_url} />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-2xl">
                        {basicInfo.name ? basicInfo.name[0] : '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-2">
                      <Label htmlFor="avatar">角色头像</Label>
                      <div className="flex space-x-2">
                        <Input
                          id="avatar"
                          placeholder="头像URL（可选）"
                          value={basicInfo.avatar_url}
                          onChange={(e) => handleBasicInfoChange('avatar_url', e.target.value)}
                          className="flex-1"
                        />
                        <Button type="button" variant="outline" size="sm">
                          <Upload className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

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
            <CardContent className="pt-6">
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
                        <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
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
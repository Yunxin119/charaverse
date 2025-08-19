'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Key, Eye, EyeOff, Shield, AlertTriangle, User, Save, RefreshCw, Edit } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useAppSelector } from '../store/hooks'
import { supabase } from '../lib/supabase'
import { AvatarUpload } from '../components/AvatarUpload'
import { uploadUserAvatar } from '../lib/avatarUpload'

interface ApiKeys {
  deepseek: string
  gemini: string
  openai: string
}

interface UserProfile {
  username: string
  avatar_url: string
  bio: string
}

export default function SettingsPage() {
  const { user } = useAppSelector((state) => state.auth)
  
  const [apiKeys, setApiKeys] = useState<ApiKeys>({
    deepseek: '',
    gemini: '',
    openai: ''
  })
  
  const [showKeys, setShowKeys] = useState<{[key: string]: boolean}>({
    deepseek: false,
    gemini: false,
    openai: false
  })

  const [profile, setProfile] = useState<UserProfile>({
    username: '',
    avatar_url: '',
    bio: ''
  })

  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [isEditingProfile, setIsEditingProfile] = useState(false)

  // 从 localStorage 加载 API Keys
  useEffect(() => {
    const savedKeys = {
      deepseek: localStorage.getItem('api_key_deepseek') || '',
      gemini: localStorage.getItem('api_key_gemini') || '',
      openai: localStorage.getItem('api_key_openai') || ''
    }
    setApiKeys(savedKeys)
  }, [])

  // 加载用户资料
  const loadProfile = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, avatar_url, bio')
        .eq('id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('加载用户资料失败:', error)
        return
      }

      if (data) {
        setProfile({
          username: data.username || '',
          avatar_url: data.avatar_url || '',
          bio: data.bio || ''
        })
      }
    } catch (error) {
      console.error('加载用户资料失败:', error)
    }
  }

  useEffect(() => {
    loadProfile()
  }, [user])

  const handleSaveKey = (provider: keyof ApiKeys) => {
    const key = apiKeys[provider].trim()
    if (key) {
      localStorage.setItem(`api_key_${provider}`, key)
      console.log(`Saved API key for ${provider}:`, `${key.substring(0, 10)}...`)
      
      // 验证是否保存成功
      const saved = localStorage.getItem(`api_key_${provider}`)
      if (saved === key) {
        console.log(`✅ API key for ${provider} saved successfully`)
        // 这里可以添加成功提示的UI反馈
        alert(`${provider} API密钥保存成功！`)
      } else {
        console.error(`❌ Failed to save API key for ${provider}`)
        alert(`保存失败，请重试`)
      }
    } else {
      alert('请输入有效的API密钥')
    }
  }

  const handleKeyChange = (provider: keyof ApiKeys, value: string) => {
    setApiKeys(prev => ({
      ...prev,
      [provider]: value
    }))
  }

  const toggleShowKey = (provider: string) => {
    setShowKeys(prev => ({
      ...prev,
      [provider]: !prev[provider]
    }))
  }

  // 更新用户资料
  const handleUpdateProfile = async () => {
    if (!user) return

    try {
      setIsUpdatingProfile(true)

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username: profile.username.trim(),
          avatar_url: profile.avatar_url,
          bio: profile.bio.trim(),
          updated_at: new Date().toISOString()
        })

      if (error) {
        throw new Error(error.message)
      }

      alert('资料更新成功！')
    } catch (error) {
      console.error('更新用户资料失败:', error)
      alert(error instanceof Error ? error.message : '更新失败，请重试')
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  // 头像上传处理
  const handleAvatarUpload = async (file: File): Promise<string> => {
    try {
      const newAvatarUrl = await uploadUserAvatar(file)
      
      // 更新本地状态
      setProfile(prev => ({
        ...prev,
        avatar_url: newAvatarUrl
      }))

      return newAvatarUrl
    } catch (error) {
      console.error('头像上传失败:', error)
      throw error
    }
  }

  const apiProviders = [
    {
      id: 'deepseek' as keyof ApiKeys,
      name: 'DeepSeek',
      description: '高性能的中文对话模型',
      placeholder: 'sk-...',
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 'gemini' as keyof ApiKeys,
      name: 'Google Gemini',
      description: 'Google 的多模态AI模型',
      placeholder: 'AIza...',
      color: 'from-green-500 to-green-600'
    },
    {
      id: 'openai' as keyof ApiKeys,
      name: 'OpenAI',
      description: 'GPT系列模型',
      placeholder: 'sk-...',
      color: 'from-purple-500 to-purple-600'
    }
  ]

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

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen bg-gradient-to-br from-slate-50 to-white"
    >
      {/* 移动端优化的容器 */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <motion.div variants={itemVariants} className="mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center shadow-lg">
              <Key className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 truncate">设置</h1>
              <p className="text-slate-600 text-sm sm:text-base mt-1">管理你的API密钥和偏好设置</p>
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Tabs defaultValue="profile" className="space-y-0">
            {/* 移动端优化的标签栏 */}
            <TabsList className="grid w-full grid-cols-2 h-12 sm:h-10 bg-slate-100/80 backdrop-blur-sm rounded-xl p-1">
              <TabsTrigger 
                value="profile" 
                className="flex items-center justify-center space-x-2 rounded-lg font-medium text-sm sm:text-base h-10 sm:h-8"
              >
                <User className="w-4 h-4" />
                <span>个人资料</span>
              </TabsTrigger>
              <TabsTrigger 
                value="api-keys" 
                className="flex items-center justify-center space-x-2 rounded-lg font-medium text-sm sm:text-base h-10 sm:h-8"
              >
                <Key className="w-4 h-4" />
                <span>API 密钥</span>
              </TabsTrigger>
            </TabsList>

            {/* 个人资料标签页 */}
            <TabsContent value="profile" className="space-y-6 mt-8">
              <Card className="border-slate-200/80 shadow-lg">
                <CardHeader className="pb-4 sm:pb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                    <div>
                      <CardTitle className="text-xl sm:text-2xl">个人资料</CardTitle>
                      <CardDescription className="text-sm sm:text-base mt-2">
                        管理你的个人信息和头像
                      </CardDescription>
                    </div>
                    {!isEditingProfile && (
                      <Button
                        variant="outline"
                        onClick={() => setIsEditingProfile(true)}
                        className="flex items-center space-x-2 w-full sm:w-auto"
                      >
                        <Edit className="w-4 h-4" />
                        <span>编辑资料</span>
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-8">
                  {/* 移动端优化的头像和信息布局 */}
                  <div className="flex flex-col sm:flex-row sm:items-start space-y-3 sm:space-y-0 sm:space-x-3">
                    {/* 头像区域 */}
                    <div className="flex flex-col items-center sm:items-start space-y-3">
                      {/* <Label className="text-sm font-medium text-slate-700">头像</Label> */}
                      <AvatarUpload
                        currentAvatar={profile.avatar_url}
                        fallbackText={profile.username || user?.email?.charAt(0) || '头像'}
                        onUpload={handleAvatarUpload}
                        size="lg"
                        disabled={!isEditingProfile}
                      />
                    </div>
                    
                    {/* 信息区域 */}
                    <div className="flex-1 space-y-3">
                      {/* 用户名 */}
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold text-slate-700">用户名</Label>
                        {isEditingProfile ? (
                          <Input
                            placeholder="输入你的用户名..."
                            value={profile.username}
                            onChange={(e) => setProfile(prev => ({ ...prev, username: e.target.value }))}
                            className="text-base"
                          />
                        ) : (
                          <div className="text-lg sm:text-xl font-semibold text-slate-900 py-2">
                            {profile.username || user?.email || '未设置用户名'}
                          </div>
                        )}
                      </div>

                      {/* 个性签名 */}
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold text-slate-700">个性签名</Label>
                        {isEditingProfile ? (
                          <Textarea
                            placeholder="写点什么来介绍自己..."
                            value={profile.bio}
                            onChange={(e) => setProfile(prev => ({ ...prev, bio: e.target.value }))}
                            className="min-h-[100px] resize-none text-base"
                          />
                        ) : (
                          <div className="text-slate-600 bg-slate-50 rounded-lg p-4 min-h-[60px] flex items-center">
                            {profile.bio || '这个人很懒，还没有写个性签名~'}
                          </div>
                        )}
                      </div>

                      {/* 邮箱信息 */}
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold text-slate-700">邮箱</Label>
                        <div className="text-slate-600 bg-slate-50 rounded-lg p-4">
                          {user?.email}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 编辑模式下的操作按钮 */}
                  {isEditingProfile && (
                    <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-3 border-t border-slate-200">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsEditingProfile(false)
                          loadProfile()
                        }}
                        className="w-full sm:w-auto"
                      >
                        取消
                      </Button>
                      <Button 
                        onClick={async () => {
                          await handleUpdateProfile()
                          setIsEditingProfile(false)
                        }}
                        disabled={isUpdatingProfile}
                        className="w-full sm:w-auto"
                      >
                        {isUpdatingProfile ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            保存中...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            保存资料
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* API密钥标签页 */}
            <TabsContent value="api-keys" className="space-y-6 mt-8">
              {/* 安全提示 */}
              <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 shadow-lg">
                <CardContent className="pt-2">
                  <div className="flex items-start space-x-4">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <Shield className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-amber-900 text-base sm:text-lg">隐私保护</h3>
                      <p className="text-sm sm:text-base text-amber-700 mt-2 leading-relaxed">
                        您的API密钥仅存储在您的浏览器本地，我们绝不会上传或访问您的密钥。
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* API Keys */}
              <div className="space-y-6">
                {apiProviders.map((provider, index) => (
                  <motion.div 
                    key={provider.id} 
                    variants={itemVariants}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="border-slate-200/80 shadow-lg hover:shadow-xl transition-all duration-300">
                      <CardHeader className="pb-4">
                        <div className="flex items-center space-x-4">
                          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${provider.color} flex items-center justify-center shadow-lg`}>
                            <Key className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-lg sm:text-xl">{provider.name}</CardTitle>
                            <CardDescription className="text-sm sm:text-base mt-1">
                              {provider.description}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="space-y-3">
                          <Label htmlFor={provider.id} className="text-sm font-semibold text-slate-700">
                            API 密钥
                          </Label>
                          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                            <div className="relative flex-1">
                              <Input
                                id={provider.id}
                                type={showKeys[provider.id] ? "text" : "password"}
                                placeholder={provider.placeholder}
                                value={apiKeys[provider.id]}
                                onChange={(e) => handleKeyChange(provider.id, e.target.value)}
                                className="pr-12 text-base h-12 sm:h-10"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-10 w-10 sm:h-8 sm:w-8"
                                onClick={() => toggleShowKey(provider.id)}
                              >
                                {showKeys[provider.id] ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                            <Button
                              onClick={() => handleSaveKey(provider.id)}
                              disabled={!apiKeys[provider.id].trim()}
                              className="bg-slate-900 hover:bg-slate-800 w-full sm:w-auto h-12 sm:h-10 font-medium"
                            >
                              保存密钥
                            </Button>
                          </div>
                        </div>
                        
                        {apiKeys[provider.id] && (
                          <div className="flex items-center space-x-3 text-sm sm:text-base text-green-600 bg-green-50 rounded-lg p-3">
                            <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0"></div>
                            <span className="font-medium">已配置并保存</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </motion.div>
  )
}
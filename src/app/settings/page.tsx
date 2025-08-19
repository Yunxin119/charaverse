'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  User, 
  Lock, 
  Globe, 
  MessageCircle, 
  Heart, 
  Eye, 
  EyeOff, 
  Key, 
  Shield,
  Edit,
  Calendar,
  Loader2,
  Settings,
  Save,
  RefreshCw
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { useAppSelector } from '../store/hooks'
import { supabase } from '../lib/supabase'
import UserBanner from '../components/UserBanner'
import { BottomNavbar } from '../components/layout/BottomNavbar'
import { AvatarUpload } from '../components/AvatarUpload'
import { uploadUserAvatar } from '../lib/avatarUpload'
import { useRouter } from 'next/navigation'

interface UserProfile {
  username: string
  avatar_url: string
  banner_url: string
  bio: string
}

interface Character {
  id: number
  name: string
  avatar_url?: string
  prompt_template: any
  likes_count: number
  created_at: string
  is_public: boolean
}

interface ApiKeys {
  deepseek: string
  gemini: string
  openai: string
}

export default function MyPage() {
  const { user } = useAppSelector((state) => state.auth)
  const router = useRouter()
  
  const [profile, setProfile] = useState<UserProfile>({
    username: '',
    avatar_url: '',
    banner_url: '',
    bio: ''
  })
  
  const [publicCharacters, setPublicCharacters] = useState<Character[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [charactersLoading, setCharactersLoading] = useState(false)
  
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

  // 编辑状态
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [editProfile, setEditProfile] = useState<UserProfile>({
    username: '',
    avatar_url: '',
    banner_url: '',
    bio: ''
  })

  // 加载用户资料
  const loadProfile = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, avatar_url, banner_url, bio')
        .eq('id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('加载用户资料失败:', error)
        return
      }

      if (data) {
        const profileData = {
          username: data.username || '',
          avatar_url: data.avatar_url || '',
          banner_url: data.banner_url || '',
          bio: data.bio || ''
        }
        setProfile(profileData)
        setEditProfile(profileData)
      }
    } catch (error) {
      console.error('加载用户资料失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 加载公开角色
  const loadPublicCharacters = async () => {
    if (!user) return

    setCharactersLoading(true)
    try {
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_public', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPublicCharacters(data || [])
    } catch (error) {
      console.error('加载公开角色失败:', error)
    } finally {
      setCharactersLoading(false)
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
      
      setEditProfile(prev => ({
        ...prev,
        avatar_url: newAvatarUrl
      }))

      // 如果不在编辑模式，直接保存到数据库
      if (!isEditingProfile && user) {
        await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            avatar_url: newAvatarUrl,
            updated_at: new Date().toISOString()
          })
      }

      return newAvatarUrl
    } catch (error) {
      console.error('头像上传失败:', error)
      throw error
    }
  }

  // 从 localStorage 加载 API Keys
  useEffect(() => {
    const savedKeys = {
      deepseek: localStorage.getItem('api_key_deepseek') || '',
      gemini: localStorage.getItem('api_key_gemini') || '',
      openai: localStorage.getItem('api_key_openai') || ''
    }
    setApiKeys(savedKeys)
  }, [])

  useEffect(() => {
    if (user) {
      loadProfile()
      loadPublicCharacters()
    }
  }, [user])

  const handleBannerUpdate = (newBannerUrl: string) => {
    setProfile(prev => ({ ...prev, banner_url: newBannerUrl }))
    setEditProfile(prev => ({ ...prev, banner_url: newBannerUrl }))
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
          username: editProfile.username.trim(),
          avatar_url: editProfile.avatar_url,
          banner_url: editProfile.banner_url,
          bio: editProfile.bio.trim(),
          updated_at: new Date().toISOString()
        })

      if (error) {
        throw new Error(error.message)
      }

      // 更新本地状态
      setProfile(editProfile)
      setIsEditingProfile(false)
      alert('资料更新成功！')
    } catch (error) {
      console.error('更新用户资料失败:', error)
      alert(error instanceof Error ? error.message : '更新失败，请重试')
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  // 开始编辑
  const handleStartEdit = () => {
    setEditProfile(profile)
    setIsEditingProfile(true)
  }

  // 取消编辑
  const handleCancelEdit = () => {
    setEditProfile(profile)
    setIsEditingProfile(false)
  }

  const handleSaveKey = (provider: keyof ApiKeys) => {
    const key = apiKeys[provider].trim()
    if (key) {
      localStorage.setItem(`api_key_${provider}`, key)
      alert(`${provider} API密钥保存成功！`)
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getCharacterKeywords = (character: Character) => {
    return character.prompt_template?.basic_info?.keywords || []
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

  if (isLoading) {
    return (
      <div className="h-screen bg-slate-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-slate-900" />
            <p className="text-slate-600">加载中...</p>
          </div>
        </div>
        <BottomNavbar />
      </div>
    )
  }

  return (
    <div className="h-screen bg-slate-50 flex flex-col">
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6 pb-28 space-y-6">
          {/* 用户Banner */}
          <UserBanner
            username={profile.username || user?.email?.split('@')[0] || '用户'}
            avatar={profile.avatar_url}
            banner={profile.banner_url}
            bio={profile.bio}
            charactersCount={publicCharacters.length}
            canEdit={true}
            onBannerUpdate={handleBannerUpdate}
          />

          {/* Tab导航 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <Tabs defaultValue="profile" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3 bg-white shadow-sm rounded-xl p-1">
                <TabsTrigger 
                  value="profile" 
                  className="flex items-center space-x-2 rounded-lg font-medium"
                >
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">个人资料</span>
                  <span className="sm:hidden">资料</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="characters" 
                  className="flex items-center space-x-2 rounded-lg font-medium"
                >
                  <Globe className="w-4 h-4" />
                  <span className="hidden sm:inline">公开角色</span>
                  <span className="sm:hidden">角色</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="api" 
                  className="flex items-center space-x-2 rounded-lg font-medium"
                >
                  <Lock className="w-4 h-4" />
                  <span className="hidden sm:inline">API密钥</span>
                  <span className="sm:hidden">API</span>
                </TabsTrigger>
              </TabsList>

              {/* 个人资料Tab */}
              <TabsContent value="profile" className="space-y-4">
                <Card className="shadow-lg border-slate-200">
                  <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                      <div>
                        <CardTitle className="text-lg flex items-center space-x-2">
                          <User className="w-5 h-5" />
                          <span>个人资料</span>
                        </CardTitle>
                        <p className="text-sm text-slate-600 mt-1">管理你的个人信息和头像</p>
                      </div>
                      {!isEditingProfile && (
                        <Button
                          variant="outline"
                          onClick={handleStartEdit}
                          size="sm"
                          className="w-full sm:w-auto"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          编辑资料
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* 头像和基本信息 */}
                    <div className="flex flex-col sm:flex-row sm:items-start space-y-6 sm:space-y-0 sm:space-x-6">
                      {/* 头像区域 */}
                      <div className="flex flex-col items-center sm:items-start space-y-3">
                        <AvatarUpload
                          currentAvatar={isEditingProfile ? editProfile.avatar_url : profile.avatar_url}
                          fallbackText={(isEditingProfile ? editProfile.username : profile.username)?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                          onUpload={handleAvatarUpload}
                          size="lg"
                          disabled={false} // 头像始终可以更换
                        />
                      </div>
                      
                      {/* 信息区域 */}
                      <div className="flex-1 space-y-4">
                        {/* 用户名 */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-slate-700">用户名</Label>
                          {isEditingProfile ? (
                            <Input
                              placeholder="输入你的用户名..."
                              value={editProfile.username}
                              onChange={(e) => setEditProfile(prev => ({ ...prev, username: e.target.value }))}
                              className="text-base"
                            />
                          ) : (
                            <div className="text-base text-slate-900 py-3 px-4 bg-slate-50 rounded-lg">
                              {profile.username || user?.email || '未设置用户名'}
                            </div>
                          )}
                        </div>

                        {/* 邮箱信息 */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-slate-700">邮箱</Label>
                          <div className="text-slate-600 bg-slate-50 rounded-lg py-3 px-4">
                            {user?.email}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 个人简介 */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">个人简介</Label>
                      {isEditingProfile ? (
                        <Textarea
                          placeholder="写点什么来介绍自己..."
                          value={editProfile.bio}
                          onChange={(e) => setEditProfile(prev => ({ ...prev, bio: e.target.value }))}
                          className="min-h-[100px] resize-none text-base"
                        />
                      ) : (
                        <div className="text-slate-700 bg-slate-50 rounded-lg p-4 min-h-[100px] flex items-start">
                          {profile.bio || '这个人很懒，还没有写个性签名~'}
                        </div>
                      )}
                    </div>

                    {/* 编辑模式下的操作按钮 */}
                    {isEditingProfile && (
                      <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-4 border-t border-slate-200">
                        <Button
                          variant="outline"
                          onClick={handleCancelEdit}
                          disabled={isUpdatingProfile}
                          className="w-full sm:w-auto"
                        >
                          取消
                        </Button>
                        <Button 
                          onClick={handleUpdateProfile}
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

              {/* 公开角色Tab */}
              <TabsContent value="characters" className="space-y-4">
                {charactersLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
                    <span className="ml-2 text-slate-600">加载角色中...</span>
                  </div>
                ) : publicCharacters.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Globe className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">
                        还没有公开的角色
                      </h3>
                      <p className="text-slate-500 mb-6">
                        创建角色并设为公开，让更多人发现你的创作
                      </p>
                      <Button onClick={() => router.push('/characters/new')}>
                        创建第一个公开角色
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {publicCharacters.map((character) => (
                      <motion.div
                        key={character.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                        whileHover={{ y: -2 }}
                      >
                        <Card className="hover:shadow-lg transition-all duration-200">
                          <CardContent className="p-4">
                            <div className="flex items-start space-x-3 mb-4">
                              <Avatar className="w-12 h-12">
                                <AvatarImage src={character.avatar_url} />
                                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                                  {character.name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-slate-900 truncate">
                                  {character.name}
                                </h3>
                                <div className="flex items-center space-x-2 text-xs text-slate-500">
                                  <Calendar className="w-3 h-3" />
                                  <span>{formatDate(character.created_at)}</span>
                                </div>
                              </div>
                            </div>

                            {/* 角色介绍 */}
                            <div className="mb-3">
                              <p className="text-sm text-slate-600 line-clamp-2">
                                {character.prompt_template?.basic_info?.introduction || 
                                 character.prompt_template?.basic_info?.description || 
                                 '这个角色还没有添加介绍...'}
                              </p>
                            </div>

                            {/* 关键词 */}
                            {getCharacterKeywords(character).length > 0 && (
                              <div className="mb-3">
                                <div className="flex flex-wrap gap-1">
                                  {getCharacterKeywords(character).slice(0, 3).map((keyword: string, idx: number) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100"
                                    >
                                      {keyword}
                                    </span>
                                  ))}
                                  {getCharacterKeywords(character).length > 3 && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                                      +{getCharacterKeywords(character).length - 3}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* 统计信息 */}
                            <div className="flex items-center justify-between text-sm text-slate-500">
                              <div className="flex items-center space-x-3">
                                <div className="flex items-center space-x-1">
                                  <Heart className="w-3 h-3" />
                                  <span>{character.likes_count}</span>
                                </div>
                                <span className="flex items-center">
                                  <Globe className="w-3 h-3 mr-1" />
                                  公开
                                </span>
                              </div>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => router.push(`/characters/${character.id}/edit`)}
                              >
                                <Edit className="w-3 h-3 mr-1" />
                                编辑
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* API密钥Tab */}
              <TabsContent value="api" className="space-y-6">
                {/* 私人标识 */}
                <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
                  <CardContent className="pt-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                        <Lock className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-amber-900">仅私人可见</h3>
                        <p className="text-sm text-amber-700">
                          您的API密钥仅存储在本地浏览器，我们绝不会访问或上传
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* API Keys */}
                <div className="space-y-4">
                  {apiProviders.map((provider) => (
                    <motion.div 
                      key={provider.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                          <div className="flex items-center space-x-3">
                            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${provider.color} flex items-center justify-center`}>
                              <Key className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <CardTitle className="text-base">{provider.name}</CardTitle>
                              <p className="text-sm text-slate-500">{provider.description}</p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">API 密钥</Label>
                            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                              <div className="relative flex-1">
                                <Input
                                  type={showKeys[provider.id] ? "text" : "password"}
                                  placeholder={provider.placeholder}
                                  value={apiKeys[provider.id]}
                                  onChange={(e) => handleKeyChange(provider.id, e.target.value)}
                                  className="pr-10"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8"
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
                                size="sm"
                                className="w-full sm:w-auto"
                              >
                                保存
                              </Button>
                            </div>
                          </div>
                          
                          {apiKeys[provider.id] && (
                            <div className="flex items-center space-x-2 text-sm text-green-600 bg-green-50 rounded-lg p-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span>已配置</span>
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
      </main>

      <BottomNavbar />
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Info, Plus } from 'lucide-react'
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
  RefreshCw,
  Trash2,
  X,
  LogOut,
  Sun,
  Moon,
  Monitor
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAppSelector, useAppDispatch } from '../store/hooks'
import { signOut } from '../store/authSlice'
import { supabase } from '../lib/supabase'
import UserBanner from '../components/UserBanner'
import { BottomNavbar } from '../components/layout/BottomNavbar'
import { AvatarUpload } from '../components/AvatarUpload'
import { uploadUserAvatar } from '../lib/avatarUpload'
import { useRouter } from 'next/navigation'
import { useTheme } from '../contexts/ThemeContext'
import { ApiPoolManager } from '../components/ApiPoolManager'

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



interface NamedRelayConfig {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  modelName: string
  description?: string
  supportsThinking?: boolean  // 是否支持thinking功能
  thinkingBudgetMode?: 'auto' | 'manual'  // thinking budget模式
  thinkingBudget?: number  // 手动设置的thinking budget值
}

export default function MyPage() {
  const { user } = useAppSelector((state) => state.auth)
  const dispatch = useAppDispatch()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  
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
  


  // 新的命名中转配置系统
  const [namedRelayConfigs, setNamedRelayConfigs] = useState<NamedRelayConfig[]>([])
  const [isAddingRelay, setIsAddingRelay] = useState(false)
  const [editingRelayId, setEditingRelayId] = useState<string | null>(null)
  const [newRelayConfig, setNewRelayConfig] = useState<Partial<NamedRelayConfig>>({
    name: '',
    baseUrl: '',
    apiKey: '',
    modelName: '',
    description: '',
    supportsThinking: false,
    thinkingBudgetMode: 'auto',
    thinkingBudget: 0
  })
  const [editRelayConfig, setEditRelayConfig] = useState<Partial<NamedRelayConfig>>({
    name: '',
    baseUrl: '',
    apiKey: '',
    modelName: '',
    description: '',
    supportsThinking: false,
    thinkingBudgetMode: 'auto',
    thinkingBudget: 0
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
    


    // 加载命名的中转配置
    const savedNamedConfigs = localStorage.getItem('named_relay_configs')
    if (savedNamedConfigs) {
      try {
        const configs = JSON.parse(savedNamedConfigs) as NamedRelayConfig[]
        setNamedRelayConfigs(configs)
      } catch (e) {
        console.warn('Failed to parse named relay configs')
      }
    } else {
      // 数据迁移：将旧的中转配置转换为新的命名配置
      const oldBaseUrl = localStorage.getItem('relay_base_url')
      const oldApiKey = localStorage.getItem('relay_api_key')
      const oldModelName = localStorage.getItem('relay_model_name')
      
      if (oldBaseUrl && oldApiKey && oldModelName) {
        const migratedConfig: NamedRelayConfig = {
          id: 'migrated-' + Date.now(),
          name: `${oldModelName} (迁移)`,
          baseUrl: oldBaseUrl,
          apiKey: oldApiKey,
          modelName: oldModelName,
          description: '从旧版配置自动迁移'
        }
        
        const migratedConfigs = [migratedConfig]
        setNamedRelayConfigs(migratedConfigs)
        localStorage.setItem('named_relay_configs', JSON.stringify(migratedConfigs))
        
        // 清理旧的配置数据
        localStorage.removeItem('relay_base_url')
        localStorage.removeItem('relay_api_key')
        localStorage.removeItem('relay_model_name')
        
        console.log('Successfully migrated old relay config to new named config system')
      }
    }
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

  // 删除API密钥
  const handleDeleteKey = (provider: keyof ApiKeys) => {
    if (confirm(`确定要删除 ${provider} 的API密钥吗？`)) {
      localStorage.removeItem(`api_key_${provider}`)
      setApiKeys(prev => ({
        ...prev,
        [provider]: ''
      }))
      alert(`${provider} API密钥已删除`)
    }
  }



  // 添加新的命名中转配置
  const handleAddNamedRelay = () => {
    if (!newRelayConfig.name?.trim() || !newRelayConfig.baseUrl?.trim() || !newRelayConfig.apiKey?.trim() || !newRelayConfig.modelName?.trim()) {
      alert('请填写完整的配置信息')
      return
    }

    const newConfig: NamedRelayConfig = {
      id: Date.now().toString(),
      name: newRelayConfig.name.trim(),
      baseUrl: newRelayConfig.baseUrl.trim(),
      apiKey: newRelayConfig.apiKey.trim(),
      modelName: newRelayConfig.modelName.trim(),
      description: newRelayConfig.description?.trim() || '',
      supportsThinking: newRelayConfig.supportsThinking || false,
      thinkingBudgetMode: newRelayConfig.thinkingBudgetMode || 'auto',
      thinkingBudget: newRelayConfig.thinkingBudget || 0
    }

    const updatedConfigs = [...namedRelayConfigs, newConfig]
    setNamedRelayConfigs(updatedConfigs)
    localStorage.setItem('named_relay_configs', JSON.stringify(updatedConfigs))

    // 重置表单
    setNewRelayConfig({
      name: '',
      baseUrl: '',
      apiKey: '',
      modelName: '',
      description: '',
      supportsThinking: false,
      thinkingBudgetMode: 'auto',
      thinkingBudget: 0
    })
    setIsAddingRelay(false)
    alert('中转配置添加成功！')
  }

  // 删除命名中转配置
  const handleDeleteNamedRelay = (id: string) => {
    const config = namedRelayConfigs.find(c => c.id === id)
    if (confirm(`确定要删除 "${config?.name}" 配置吗？`)) {
      const updatedConfigs = namedRelayConfigs.filter(c => c.id !== id)
      setNamedRelayConfigs(updatedConfigs)
      localStorage.setItem('named_relay_configs', JSON.stringify(updatedConfigs))
      alert('配置已删除')
    }
  }

  // 开始编辑中转配置
  const handleStartEditRelay = (config: NamedRelayConfig) => {
    setEditingRelayId(config.id)
    setEditRelayConfig(config)
    setIsAddingRelay(false) // 关闭添加表单
  }

  // 取消编辑中转配置
  const handleCancelEditRelay = () => {
    setEditingRelayId(null)
    setEditRelayConfig({
      name: '',
      baseUrl: '',
      apiKey: '',
      modelName: '',
      description: '',
      supportsThinking: false,
      thinkingBudgetMode: 'auto',
      thinkingBudget: 0
    })
  }

  // 保存编辑的中转配置
  const handleSaveEditRelay = () => {
    if (!editRelayConfig.name?.trim() || !editRelayConfig.baseUrl?.trim() || !editRelayConfig.apiKey?.trim() || !editRelayConfig.modelName?.trim()) {
      alert('请填写完整的配置信息')
      return
    }

    const updatedConfig: NamedRelayConfig = {
      id: editingRelayId!,
      name: editRelayConfig.name.trim(),
      baseUrl: editRelayConfig.baseUrl.trim(),
      apiKey: editRelayConfig.apiKey.trim(),
      modelName: editRelayConfig.modelName.trim(),
      description: editRelayConfig.description?.trim() || '',
      supportsThinking: editRelayConfig.supportsThinking || false,
      thinkingBudgetMode: editRelayConfig.thinkingBudgetMode || 'auto',
      thinkingBudget: editRelayConfig.thinkingBudget || 0
    }

    const updatedConfigs = namedRelayConfigs.map(config => 
      config.id === editingRelayId ? updatedConfig : config
    )
    
    setNamedRelayConfigs(updatedConfigs)
    localStorage.setItem('named_relay_configs', JSON.stringify(updatedConfigs))
    
    handleCancelEditRelay()
    alert('配置更新成功！')
  }

  // 更新新中转配置的字段
  const handleNewRelayConfigChange = (field: keyof NamedRelayConfig, value: string | number | boolean) => {
    setNewRelayConfig(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // 更新编辑中转配置的字段
  const handleEditRelayConfigChange = (field: keyof NamedRelayConfig, value: string | number | boolean) => {
    setEditRelayConfig(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleKeyChange = (provider: keyof ApiKeys, value: string) => {
    setApiKeys(prev => ({
      ...prev,
      [provider]: value
    }))
  }

  // 退出登录处理函数
  const handleSignOut = async () => {
    if (confirm('确定要退出登录吗？')) {
      try {
        await dispatch(signOut()).unwrap()
        router.push('/login')
      } catch (error) {
        console.error('退出登录失败:', error)
        alert('退出登录失败，请重试')
      }
    }
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
      <div className="h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-slate-900 dark:text-white" />
            <p className="text-slate-600 dark:text-slate-300">加载中...</p>
          </div>
        </div>
        <BottomNavbar />
      </div>
    )
  }

  return (
    <div className="h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      <main className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-8 pb-32 space-y-8">
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
          <div className="w-full">
            <Tabs defaultValue="profile" className="space-y-6">
              <div className="w-full overflow-x-auto">
                <TabsList className="inline-flex h-12 items-center justify-center rounded-xl bg-white/90 dark:bg-slate-800/90 p-1 text-slate-500 dark:text-slate-400 shadow-lg border border-slate-200 dark:border-slate-700 w-full min-w-max">
                  <TabsTrigger 
                    value="profile" 
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-slate-900 data-[state=active]:text-slate-50 dark:data-[state=active]:bg-slate-50 dark:data-[state=active]:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 flex-1 min-w-0"
                  >
                    <User className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">个人资料</span>
                    <span className="sm:hidden">资料</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="characters"
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-slate-900 data-[state=active]:text-slate-50 dark:data-[state=active]:bg-slate-50 dark:data-[state=active]:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 flex-1 min-w-0"
                  >
                    <Globe className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">公开角色</span>
                    <span className="sm:hidden">角色</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="api"
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-slate-900 data-[state=active]:text-slate-50 dark:data-[state=active]:bg-slate-50 dark:data-[state=active]:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 flex-1 min-w-0"
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">API密钥</span>
                    <span className="sm:hidden">API</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="appearance"
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-slate-900 data-[state=active]:text-slate-50 dark:data-[state=active]:bg-slate-50 dark:data-[state=active]:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 flex-1 min-w-0"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">外观设置</span>
                    <span className="sm:hidden">外观</span>
                  </TabsTrigger>
              </TabsList>
              </div>

              {/* 个人资料Tab */}
              <TabsContent value="profile" className="space-y-6">
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

                {/* 账户管理 */}
                <Card className="shadow-lg border-slate-200 border-red-100 bg-gradient-to-r from-red-50/50 to-orange-50/50">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg flex items-center space-x-2 text-red-700">
                      <Shield className="w-5 h-5" />
                      <span>账户安全</span>
                    </CardTitle>
                    <p className="text-sm text-red-600">管理你的账户安全设置</p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-white rounded-lg border border-red-200">
                      <div className="mb-4 sm:mb-0">
                        <h4 className="font-medium text-slate-900 mb-1">退出登录</h4>
                        <p className="text-sm text-slate-600">安全退出当前账户</p>
                      </div>
                      <Button
                        onClick={handleSignOut}
                        variant="outline"
                        className="w-full sm:w-auto border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        退出登录
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* 公开角色Tab */}
              <TabsContent value="characters" className="space-y-6">
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
                        <Card className="hover:shadow-lg transition-all duration-200 dark:bg-slate-800 dark:border-slate-700">
                          <CardContent className="p-4">
                            <div className="flex items-start space-x-3 mb-4">
                              <Avatar className="w-12 h-12">
                                <AvatarImage src={character.avatar_url} />
                                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                                  {character.name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                                  {character.name}
                                </h3>
                                <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
                                  <Calendar className="w-3 h-3" />
                                  <span>{formatDate(character.created_at)}</span>
                                </div>
                              </div>
                            </div>

                            {/* 角色介绍 */}
                            <div className="mb-3">
                              <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
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
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                                      +{getCharacterKeywords(character).length - 3}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* 统计信息 */}
                            <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
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
              <TabsContent value="api" className="space-y-4">
                {/* 简化的提示 */}
                <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <Lock className="w-4 h-4 inline mr-1" />
                    API密钥仅存储在本地，不会上传
                  </p>
                </div>

                {/* API Pool Managers */}
                <div className="space-y-4">
                  <ApiPoolManager provider="deepseek" />
                  <ApiPoolManager provider="gemini" />
                  <ApiPoolManager provider="openai" />
                  <ApiPoolManager provider="custom" />
                </div>

                {/* 中转API服务 (简化版) */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center space-x-2">
                        <Globe className="w-4 h-4" />
                        <span>中转服务</span>
                      </CardTitle>
                      <Button
                        onClick={() => {
                          setIsAddingRelay(true)
                          setEditingRelayId(null)
                        }}
                        size="sm"
                        variant="outline"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        添加
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* 现有配置 */}
                    {namedRelayConfigs.length > 0 && (
                      <div className="space-y-2">
                        {namedRelayConfigs.map((config) => (
                          <div key={config.id} className="border rounded-lg p-3">
                            {editingRelayId === config.id ? (
                              // 编辑表单
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">编辑配置</h4>
                                  <Button
                                    onClick={handleCancelEditRelay}
                                    variant="ghost"
                                    size="sm"
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">配置名称 *</Label>
                                    <Input
                                      type="text"
                                      placeholder="例如: Gemini 3 Pro 中转"
                                      value={editRelayConfig.name || ''}
                                      onChange={(e) => handleEditRelayConfigChange('name', e.target.value)}
                                      className="text-sm"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">模型名称 *</Label>
                                    <Input
                                      type="text"
                                      placeholder="gemini-2.0-flash-exp"
                                      value={editRelayConfig.modelName || ''}
                                      onChange={(e) => handleEditRelayConfigChange('modelName', e.target.value)}
                                      className="text-sm"
                                    />
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Base URL *</Label>
                                  <Input
                                    type="text"
                                    placeholder="https://www.chataiapi.com/v1"
                                    value={editRelayConfig.baseUrl || ''}
                                    onChange={(e) => handleEditRelayConfigChange('baseUrl', e.target.value)}
                                    className="text-sm"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">API 密钥 *</Label>
                                  <Input
                                    type="password"
                                    placeholder="sk-xxxx这里输入你的令牌"
                                    value={editRelayConfig.apiKey || ''}
                                    onChange={(e) => handleEditRelayConfigChange('apiKey', e.target.value)}
                                    className="text-sm"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">描述 (可选)</Label>
                                  <Input
                                    type="text"
                                    placeholder="简短描述这个配置..."
                                    value={editRelayConfig.description || ''}
                                    onChange={(e) => handleEditRelayConfigChange('description', e.target.value)}
                                    className="text-sm"
                                  />
                                </div>

                                {/* Thinking Budget 配置 */}
                                <div className="space-y-3 border-t border-slate-200 dark:border-slate-600 pt-4">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">支持 Thinking 功能</Label>
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">适用于 Gemini 2.5 系列等支持思考过程的模型</p>
                                    </div>
                                    <Switch
                                      checked={editRelayConfig.supportsThinking || false}
                                      onCheckedChange={(checked) => handleEditRelayConfigChange('supportsThinking', checked)}
                                    />
                                  </div>

                                  {editRelayConfig.supportsThinking && (
                                    <div className="space-y-3 bg-slate-50 dark:bg-slate-600 p-3 rounded-lg">
                                      <div className="space-y-2">
                                        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Thinking Budget 模式</Label>
                                        <Select 
                                          value={editRelayConfig.thinkingBudgetMode || 'auto'}
                                          onValueChange={(value) => handleEditRelayConfigChange('thinkingBudgetMode', value)}
                                        >
                                          <SelectTrigger className="text-sm">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="auto">自动 (推荐)</SelectItem>
                                            <SelectItem value="manual">手动设置</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>

                                      {editRelayConfig.thinkingBudgetMode === 'manual' && (
                                        <div className="space-y-2">
                                          <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Thinking Budget 值</Label>
                                          <Input
                                            type="number"
                                            placeholder="例如: 20000"
                                            value={editRelayConfig.thinkingBudget || 0}
                                            onChange={(e) => handleEditRelayConfigChange('thinkingBudget', parseInt(e.target.value) || 0)}
                                            className="text-sm"
                                            min="0"
                                            max="100000"
                                          />
                                          <p className="text-xs text-slate-500 dark:text-slate-400">
                                            设置思考过程的 token 预算，0 表示无限制
                                          </p>
                                        </div>
                                      )}

                                      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded p-2">
                                        <p className="text-xs text-blue-700 dark:text-blue-300">
                                          💡 <strong>提示:</strong> Thinking 功能让模型在回答前进行思考，提高回答质量。自动模式由模型决定思考深度，手动模式可限制思考的 token 消耗。
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="flex justify-end space-x-2">
                                  <Button
                                    onClick={handleCancelEditRelay}
                                    variant="outline"
                                    size="sm"
                                  >
                                    取消
                                  </Button>
                                  <Button
                                    onClick={handleSaveEditRelay}
                                    size="sm"
                                    className="bg-indigo-500 hover:bg-indigo-600"
                                  >
                                    保存更改
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              // 显示模式
                              <>
                                <div className="flex items-center justify-between mb-2">
                                  <div>
                                    <h5 className="font-medium text-slate-900 dark:text-white">{config.name}</h5>
                                    {config.description && (
                                      <p className="text-sm text-slate-600 dark:text-slate-300">{config.description}</p>
                                    )}
                                  </div>
                                  <div className="flex space-x-2">
                                    <Button
                                      onClick={() => handleStartEditRelay(config)}
                                      variant="outline"
                                      size="sm"
                                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      onClick={() => handleDeleteNamedRelay(config.id)}
                                      variant="outline"
                                      size="sm"
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                                  <div>
                                    <span className="text-slate-500 dark:text-slate-400">URL:</span>
                                    <span className="ml-1 font-mono text-xs dark:text-slate-300">{config.baseUrl}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 dark:text-slate-400">模型:</span>
                                    <span className="ml-1 dark:text-slate-300">{config.modelName}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 dark:text-slate-400">密钥:</span>
                                    <span className="ml-1 font-mono text-xs dark:text-slate-300">{config.apiKey.substring(0, 8)}...</span>
                                  </div>
                                </div>
                                {config.supportsThinking && (
                                  <div className="mt-2 flex items-center space-x-2">
                                    <div className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs flex items-center">
                                      🧠 Thinking
                                    </div>
                                    <div className="text-xs text-slate-600 dark:text-slate-400">
                                      {config.thinkingBudgetMode === 'manual' 
                                        ? `手动: ${config.thinkingBudget || 0} tokens`
                                        : '自动模式'
                                      }
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 添加新配置表单 */}
                    {isAddingRelay && (
                      <div className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">添加新的中转配置</h4>
                          <Button
                            onClick={() => setIsAddingRelay(false)}
                            variant="ghost"
                            size="sm"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">配置名称 *</Label>
                            <Input
                              type="text"
                              placeholder="例如: Gemini 3 Pro 中转"
                              value={newRelayConfig.name || ''}
                              onChange={(e) => handleNewRelayConfigChange('name', e.target.value)}
                              className="text-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">模型名称 *</Label>
                            <Input
                              type="text"
                              placeholder="gemini-2.0-flash-exp"
                              value={newRelayConfig.modelName || ''}
                              onChange={(e) => handleNewRelayConfigChange('modelName', e.target.value)}
                              className="text-sm"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Base URL *</Label>
                          <Input
                            type="text"
                            placeholder="https://www.chataiapi.com/v1"
                            value={newRelayConfig.baseUrl || ''}
                            onChange={(e) => handleNewRelayConfigChange('baseUrl', e.target.value)}
                            className="text-sm"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">API 密钥 *</Label>
                          <Input
                            type="password"
                            placeholder="sk-xxxx这里输入你的令牌"
                            value={newRelayConfig.apiKey || ''}
                            onChange={(e) => handleNewRelayConfigChange('apiKey', e.target.value)}
                            className="text-sm"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">描述 (可选)</Label>
                          <Input
                            type="text"
                            placeholder="简短描述这个配置..."
                            value={newRelayConfig.description || ''}
                            onChange={(e) => handleNewRelayConfigChange('description', e.target.value)}
                            className="text-sm"
                          />
                        </div>

                        {/* Thinking Budget 配置 */}
                        <div className="space-y-3 border-t border-slate-200 dark:border-slate-600 pt-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">支持 Thinking 功能</Label>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">适用于 Gemini 2.5 系列等支持思考过程的模型</p>
                            </div>
                            <Switch
                              checked={newRelayConfig.supportsThinking || false}
                              onCheckedChange={(checked) => handleNewRelayConfigChange('supportsThinking', checked)}
                            />
                          </div>

                          {newRelayConfig.supportsThinking && (
                            <div className="space-y-3 bg-slate-50 dark:bg-slate-600 p-3 rounded-lg">
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Thinking Budget 模式</Label>
                                <Select 
                                  value={newRelayConfig.thinkingBudgetMode || 'auto'}
                                  onValueChange={(value) => handleNewRelayConfigChange('thinkingBudgetMode', value)}
                                >
                                  <SelectTrigger className="text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="auto">自动 (推荐)</SelectItem>
                                    <SelectItem value="manual">手动设置</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {newRelayConfig.thinkingBudgetMode === 'manual' && (
                                <div className="space-y-2">
                                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Thinking Budget 值</Label>
                                  <Input
                                    type="number"
                                    placeholder="例如: 20000"
                                    value={newRelayConfig.thinkingBudget || 0}
                                    onChange={(e) => handleNewRelayConfigChange('thinkingBudget', parseInt(e.target.value) || 0)}
                                    className="text-sm"
                                    min="0"
                                    max="100000"
                                  />
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    设置思考过程的 token 预算，0 表示无限制
                                  </p>
                                </div>
                              )}

                              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded p-2">
                                <p className="text-xs text-blue-700 dark:text-blue-300">
                                  💡 <strong>提示:</strong> Thinking 功能让模型在回答前进行思考，提高回答质量。自动模式由模型决定思考深度，手动模式可限制思考的 token 消耗。
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex justify-end space-x-2">
                          <Button
                            onClick={() => setIsAddingRelay(false)}
                            variant="outline"
                            size="sm"
                          >
                            取消
                          </Button>
                          <Button
                            onClick={handleAddNamedRelay}
                            size="sm"
                            className="bg-indigo-500 hover:bg-indigo-600"
                          >
                            保存配置
                          </Button>
                        </div>
                      </div>
                    )}

                    {namedRelayConfigs.length === 0 && !isAddingRelay && (
                      <div className="text-center py-8 text-slate-500">
                        <Globe className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">还没有配置任何中转服务</p>
                        <p className="text-xs mt-1">点击"添加配置"开始设置</p>
                      </div>
                    )}
                  </CardContent>
                </Card>



                {/* 传统模式 (折叠) */}
                <details className="mt-8">
                  <summary className="text-sm text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300">
                    传统API密钥 (兼容模式)
                  </summary>
                  <div className="space-y-3 mt-4">

                  {apiProviders.map((provider) => (
                    <motion.div 
                      key={provider.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card className="hover:shadow-md transition-shadow opacity-75">
                        <CardHeader className="pb-3">
                          <div className="flex items-center space-x-3">
                            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${provider.color} flex items-center justify-center opacity-80`}>
                              <Key className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <CardTitle className="text-base text-slate-600 dark:text-slate-400">{provider.name} (传统)</CardTitle>
                              <p className="text-sm text-slate-500 dark:text-slate-400">{provider.description}</p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">API 密钥</Label>
                            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                              <div className="relative flex-1">
                                <Input
                                  type={showKeys[provider.id] ? "text" : "password"}
                                  placeholder={provider.placeholder}
                                  value={apiKeys[provider.id]}
                                  onChange={(e) => handleKeyChange(provider.id, e.target.value)}
                                  className="pr-10 bg-slate-50 dark:bg-slate-700"
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
                              <div className="flex space-x-2">
                                <Button
                                  onClick={() => handleSaveKey(provider.id)}
                                  disabled={!apiKeys[provider.id].trim()}
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 sm:flex-none"
                                >
                                  保存
                                </Button>
                                {apiKeys[provider.id] && (
                                  <Button
                                    onClick={() => handleDeleteKey(provider.id)}
                                    variant="outline"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {apiKeys[provider.id] && (
                            <div className="flex items-center space-x-2 text-sm text-green-600 bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span>已配置 (传统模式)</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                  </div>
                </details>
              </TabsContent>

              {/* 外观设置Tab */}
              <TabsContent value="appearance" className="space-y-6">
                <Card className="shadow-lg border-slate-200 dark:border-slate-700">
                  <CardHeader className="pb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                        <Settings className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                      </div>
                      <div>
                        <CardTitle className="text-lg text-slate-900 dark:text-white">
                          外观设置
                        </CardTitle>
                        <p className="text-slate-600 dark:text-slate-400 text-sm">自定义您的应用外观和主题</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="space-y-6">
                      <div className="text-center">
                        <Label className="text-lg font-semibold text-slate-900 dark:text-white">主题模式</Label>
                        <p className="text-slate-600 dark:text-slate-400 text-sm mt-2">选择您偏好的主题外观</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                          { value: 'light', icon: Sun, label: '浅色' },
                          { value: 'dark', icon: Moon, label: '深色' },
                          { value: 'system', icon: Monitor, label: '跟随系统' }
                        ].map((option) => {
                          const Icon = option.icon
                          const isSelected = theme === option.value
                          return (
                            <Button
                              key={option.value}
                              variant={isSelected ? "default" : "outline"}
                              className={`h-16 flex flex-col items-center justify-center space-y-2 transition-all duration-200 rounded-lg ${
                                isSelected 
                                  ? 'bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900' 
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                              }`}
                              onClick={() => setTheme(option.value as any)}
                            >
                              <Icon className="w-5 h-5" />
                              <span className="text-sm font-medium">{option.label}</span>
                            </Button>
                          )
                        })}
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-start space-x-3">
                          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700">
                            <Info className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                          </div>
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-slate-900 dark:text-white">主题设置说明</p>
                            <div className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
                              <p><strong>浅色模式：</strong>适合光线充足的环境，经典的白色界面</p>
                              <p><strong>深色模式：</strong>适合光线较暗的环境，护眼且省电</p>
                              <p><strong>跟随系统：</strong>根据设备系统设置自动切换，智能适配</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>

      <BottomNavbar />
    </div>
  )
}
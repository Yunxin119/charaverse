'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { 
  ArrowLeft,
  User,
  MessageCircle,
  Star,
  Globe,
  Calendar,
  Heart,
  Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { supabase } from '../../lib/supabase'
import UserBanner from '../../components/UserBanner'

interface UserProfile {
  id: string
  username: string
  avatar_url: string
  banner_url: string
  bio: string
  created_at: string
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

export default function UserProfilePage() {
  const { id } = useParams()
  const router = useRouter()
  
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [charactersLoading, setCharactersLoading] = useState(false)

  useEffect(() => {
    if (id) {
      loadUserProfile()
      loadUserCharacters()
    }
  }, [id])

  const loadUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, banner_url, bio, created_at')
        .eq('id', id)
        .single()

      if (error) throw error
      setProfile(data)
    } catch (error) {
      console.error('加载用户资料失败:', error)
      router.push('/explore')
    } finally {
      setIsLoading(false)
    }
  }

  const loadUserCharacters = async () => {
    setCharactersLoading(true)
    try {
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .eq('user_id', id)
        .eq('is_public', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setCharacters(data || [])
    } catch (error) {
      console.error('加载用户角色失败:', error)
    } finally {
      setCharactersLoading(false)
    }
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

  const handleCharacterClick = (characterId: number) => {
    router.push(`/character/public/${characterId}`)
  }

  if (isLoading) {
    return (
      <div className="h-screen bg-slate-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-slate-900" />
            <p className="text-slate-600">加载用户资料中...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="h-screen bg-slate-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <User className="w-16 h-16 mx-auto text-slate-300" />
            <p className="text-slate-600">用户不存在</p>
            <Button onClick={() => router.back()}>返回</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-slate-50 flex flex-col">
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {/* 用户Banner */}
          <UserBanner
            username={profile.username || '未设置用户名'}
            avatar={profile.avatar_url}
            banner={profile.banner_url}
            bio={profile.bio}
            charactersCount={characters.length}
            canEdit={false}
          />

          {/* 返回按钮 - 绝对定位在banner上 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="absolute top-4 left-4 z-20 bg-black/20 hover:bg-black/40 text-white border-white/20"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          {/* 用户信息卡片 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-4 mb-4">
                  <Calendar className="w-5 h-5 text-slate-500" />
                  <span className="text-slate-600">
                    加入于 {formatDate(profile.created_at)}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-slate-900">
                      {characters.length}
                    </div>
                    <div className="text-sm text-slate-500">公开角色</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-900">
                      {characters.reduce((sum, char) => sum + char.likes_count, 0)}
                    </div>
                    <div className="text-sm text-slate-500">总点赞</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* 公开角色列表 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            <div className="mb-4">
              <h2 className="text-xl font-bold text-slate-900 flex items-center">
                <Globe className="w-5 h-5 mr-2" />
                公开角色
              </h2>
            </div>

            {charactersLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
                <span className="ml-2 text-slate-600">加载角色中...</span>
              </div>
            ) : characters.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Globe className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    还没有公开角色
                  </h3>
                  <p className="text-slate-500">
                    该用户还没有分享任何角色
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {characters.map((character) => (
                  <motion.div
                    key={character.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    whileHover={{ y: -2 }}
                  >
                    <Card 
                      className="hover:shadow-lg transition-all duration-200 cursor-pointer"
                      onClick={() => handleCharacterClick(character.id)}
                    >
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
                          <div className="flex items-center text-blue-600">
                            <MessageCircle className="w-3 h-3 mr-1" />
                            <span>查看详情</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  )
}
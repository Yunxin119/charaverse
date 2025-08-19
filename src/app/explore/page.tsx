'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { 
  Search, 
  Filter, 
  Heart, 
  MessageCircle, 
  Clock, 
  TrendingUp,
  Globe,
  Users,
  Star
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '../lib/supabase'
import { useAppSelector } from '../store/hooks'
import { BottomNavbar } from '../components/layout/BottomNavbar'

interface PublicCharacter {
  id: number
  name: string
  avatar_url?: string
  prompt_template: any
  is_public: boolean
  likes_count: number
  created_at: string
  user_id: string
  profiles?: {
    username?: string
  }
}

export default function ExplorePage() {
  const { user } = useAppSelector((state) => state.auth)
  const router = useRouter()
  
  const [characters, setCharacters] = useState<PublicCharacter[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('likes_count') // likes_count, created_at
  const [filterType, setFilterType] = useState('all') // all, trending, recent

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }
    
    fetchPublicCharacters()
  }, [user, router, sortBy, filterType])

  const fetchPublicCharacters = async () => {
    if (!user) return
    
    setIsLoading(true)
    try {
      let query = supabase
        .from('characters')
        .select('*')
        .eq('is_public', true)

      // 应用排序
      if (sortBy === 'likes_count') {
        query = query.order('likes_count', { ascending: false })
      } else if (sortBy === 'created_at') {
        query = query.order('created_at', { ascending: false })
      }

      // 应用过滤
      if (filterType === 'trending') {
        query = query.gte('likes_count', 5) // 至少有5个赞的才算热门
      } else if (filterType === 'recent') {
        // 最近7天创建的角色
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        query = query.gte('created_at', sevenDaysAgo.toISOString())
      }

      const { data: charactersData, error } = await query

      if (error) throw error

      // 获取用户信息
      if (charactersData && charactersData.length > 0) {
        const userIds = [...new Set(charactersData.map(char => char.user_id))]
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', userIds)

        // 合并数据
        const charactersWithProfiles = charactersData.map(character => ({
          ...character,
          profiles: profilesData?.find(profile => profile.id === character.user_id)
        }))

        setCharacters(charactersWithProfiles)
      } else {
        setCharacters([])
      }
    } catch (error) {
      console.error('获取公开角色失败:', error)
      setCharacters([])
    } finally {
      setIsLoading(false)
    }
  }

  // 点赞功能
  const handleLike = async (characterId: number, currentLikes: number) => {
    try {
      const { error } = await supabase
        .from('characters')
        .update({ likes_count: currentLikes + 1 })
        .eq('id', characterId)

      if (error) throw error
      
      // 更新本地状态
      setCharacters(prev => 
        prev.map(char => 
          char.id === characterId 
            ? { ...char, likes_count: currentLikes + 1 }
            : char
        )
      )
    } catch (error) {
      console.error('点赞失败:', error)
    }
  }

  // 复制角色到我的角色库
  const handleCopyCharacter = async (character: PublicCharacter) => {
    try {
      const { error } = await supabase
        .from('characters')
        .insert({
          user_id: user!.id,
          name: `${character.name} (副本)`,
          avatar_url: character.avatar_url,
          prompt_template: character.prompt_template,
          is_public: false, // 复制的角色默认设为私有
          likes_count: 0
        })

      if (error) throw error
      
      // 跳转到角色页面
      router.push('/characters')
    } catch (error) {
      console.error('复制角色失败:', error)
    }
  }

  // 开始聊天
  const handleChatClick = async (characterId: number) => {
    try {
      // 创建新的聊天会话
      const { data: session, error } = await supabase
        .from('chat_sessions')
        .insert({
          user_id: user!.id,
          character_id: characterId,
          title: `与 ${characters.find(c => c.id === characterId)?.name} 的对话`
        })
        .select()
        .single()

      if (error) throw error
      
      // 跳转到聊天页面
      router.push(`/chat/${session.id}`)
    } catch (error) {
      console.error('创建聊天会话失败:', error)
    }
  }

  // 过滤搜索结果
  const filteredCharacters = characters.filter(character =>
    character.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    character.profiles?.username?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.4,
        ease: "easeOut" as const
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="bg-white/95 backdrop-blur-lg border-b border-slate-200/80 px-4 py-4 sticky top-0 z-30 shadow-sm"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-1">
                探索社区
              </h1>
              <p className="text-slate-600 text-sm">
                发现其他创作者分享的精彩角色
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2 text-sm text-slate-500">
                <Globe className="w-4 h-4" />
                <span>{characters.length} 个公开角色</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
      
      <main className="p-4">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="max-w-7xl mx-auto"
        >
          {/* Search and Filters */}
          <motion.div variants={itemVariants} className="mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="搜索角色名称或创作者..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white border-slate-200 focus:border-slate-300"
                />
              </div>

              {/* Sort */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full sm:w-48 bg-white border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="likes_count">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="w-4 h-4" />
                      <span>按热度排序</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="created_at">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4" />
                      <span>按时间排序</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Filter */}
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full sm:w-48 bg-white border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部角色</SelectItem>
                  <SelectItem value="trending">热门角色</SelectItem>
                  <SelectItem value="recent">最新角色</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </motion.div>

          {/* Characters Grid */}
          {isLoading ? (
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="pb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-slate-200 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-20 bg-slate-200 rounded mb-4"></div>
                    <div className="flex justify-between">
                      <div className="h-8 bg-slate-200 rounded w-20"></div>
                      <div className="h-8 bg-slate-200 rounded w-16"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </motion.div>
          ) : filteredCharacters.length === 0 ? (
            <motion.div variants={itemVariants} className="text-center py-12">
              <div className="w-24 h-24 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                <Search className="w-12 h-12 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {searchQuery ? '没有找到匹配的角色' : '暂无公开角色'}
              </h3>
              <p className="text-slate-600">
                {searchQuery ? '尝试调整搜索条件' : '成为第一个分享角色的创作者吧！'}
              </p>
            </motion.div>
          ) : (
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredCharacters.map((character, index) => (
                <motion.div
                  key={character.id}
                  variants={itemVariants}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                >
                                     <Card className="h-full hover:shadow-lg transition-all duration-200 border-slate-200/80 hover:border-slate-300/80">
                     <CardHeader 
                       className="pb-3 cursor-pointer"
                       onClick={() => router.push(`/character/public/${character.id}`)}
                     >
                       <div className="flex items-center space-x-3">
                         <Avatar className="w-12 h-12 ring-2 ring-slate-200/50">
                           <AvatarImage src={character.avatar_url} alt={character.name} />
                           <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                             {character.name.charAt(0)}
                           </AvatarFallback>
                         </Avatar>
                         <div className="flex-1 min-w-0">
                           <h3 className="font-semibold text-slate-900 truncate">
                             {character.name}
                           </h3>
                           <p className="text-sm text-slate-500 truncate">
                             由 {character.profiles?.username || '匿名用户'} 创建
                           </p>
                         </div>
                       </div>
                     </CardHeader>
                    
                    <CardContent className="pt-0">
                      {/* Character Introduction */}
                      <div className="mb-4">
                        <p className="text-sm text-slate-700 line-clamp-3 leading-relaxed">
                          {character.prompt_template?.basic_info?.introduction || 
                           character.prompt_template?.basic_info?.description || 
                           '一个有趣的AI角色，快来开始对话吧！'}
                        </p>
                      </div>

                      {/* Keywords */}
                      {character.prompt_template?.basic_info?.keywords && character.prompt_template.basic_info.keywords.length > 0 && (
                        <div className="mb-4">
                          <div className="flex flex-wrap gap-1.5">
                            {character.prompt_template.basic_info.keywords.slice(0, 3).map((keyword: string, idx: number) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100"
                              >
                                {keyword}
                              </span>
                            ))}
                            {character.prompt_template.basic_info.keywords.length > 3 && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                +{character.prompt_template.basic_info.keywords.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Stats */}
                      <div className="flex items-center justify-between mb-4 text-sm text-slate-500">
                        <div className="flex items-center space-x-1">
                          <Heart className="w-4 h-4" />
                          <span>{character.likes_count}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="w-4 h-4" />
                          <span>{new Date(character.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex space-x-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="flex-1 h-9"
                          onClick={() => handleCopyCharacter(character)}
                        >
                          <Star className="w-3 h-3 mr-1.5" />
                          收藏
                        </Button>
                        <Button 
                          size="sm" 
                          className="flex-1 h-9 bg-blue-600 hover:bg-blue-700"
                          onClick={() => handleChatClick(character.id)}
                        >
                          <MessageCircle className="w-3 h-3 mr-1.5" />
                          聊天
                        </Button>
                      </div>

                      {/* Like Button */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full mt-2 h-8 text-slate-500 hover:text-red-500 hover:bg-red-50"
                        onClick={() => handleLike(character.id, character.likes_count)}
                      >
                        <Heart className="w-4 h-4 mr-1.5" />
                        点赞
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}
        </motion.div>
      </main>

      {/* Bottom Navigation */}
      <BottomNavbar />
    </div>
  )
}

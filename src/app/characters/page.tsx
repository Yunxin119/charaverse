'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { 
  Plus, 
  Search, 
  Filter,
  Edit,
  MessageCircle,
  Eye,
  EyeOff,
  Trash2,
  MoreHorizontal,
  Calendar,
  Users,
  Globe,
  Lock
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useAppSelector } from '../store/hooks'
import { supabase } from '../lib/supabase'
import { Character } from '../store/chatSlice'
import { useAppDispatch } from '../store/hooks'
import { getExistingSession } from '../store/chatSlice'

export default function CharactersPage() {
  const { user } = useAppSelector((state) => state.auth)
  const dispatch = useAppDispatch()
  const router = useRouter()
  
  const [characters, setCharacters] = useState<Character[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('all') // all, public, private
  const [sortBy, setSortBy] = useState('created_at') // created_at, name, updated_at

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }
    
    fetchCharacters()
  }, [user, router])

  const fetchCharacters = async () => {
    if (!user) return
    
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .eq('user_id', user.id)
        .order(sortBy, { ascending: false })

      if (error) throw error
      setCharacters(data || [])
    } catch (error) {
      console.error('获取角色列表失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 切换角色公开状态
  const togglePublic = async (characterId: number, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('characters')
        .update({ is_public: !currentStatus })
        .eq('id', characterId)

      if (error) throw error
      
      // 更新本地状态
      setCharacters(prev => 
        prev.map(char => 
          char.id === characterId 
            ? { ...char, is_public: !currentStatus }
            : char
        )
      )
    } catch (error) {
      console.error('更新角色状态失败:', error)
    }
  }

  // 删除角色
  const deleteCharacter = async (characterId: number) => {
    if (!confirm('确定要删除这个角色吗？此操作无法撤销。')) return
    
    try {
      const { error } = await supabase
        .from('characters')
        .delete()
        .eq('id', characterId)

      if (error) throw error
      
      // 更新本地状态
      setCharacters(prev => prev.filter(char => char.id !== characterId))
    } catch (error) {
      console.error('删除角色失败:', error)
    }
  }

  // 处理聊天按钮点击
  const handleChatClick = async (characterId: number) => {
    if (!user) return
    
    try {
      // 检查是否已有该角色的会话
      const existingSession = await dispatch(getExistingSession({ 
        characterId, 
        userId: user.id 
      })).unwrap()
      
      if (existingSession) {
        // 如果已有会话，跳转到现有会话
        router.push(`/chat/${existingSession.id}`)
      } else {
        // 如果没有会话，创建新会话
        router.push(`/chat/new?characterId=${characterId}`)
      }
    } catch (error) {
      console.error('检查会话失败:', error)
      // 如果检查失败，默认创建新会话
      router.push(`/chat/new?characterId=${characterId}`)
    }
  }

  // 过滤和搜索角色
  const filteredCharacters = characters.filter(character => {
    const matchesSearch = character.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         character.prompt_template?.basic_info?.description?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesFilter = filterType === 'all' || 
                         (filterType === 'public' && character.is_public) ||
                         (filterType === 'private' && !character.is_public)
    
    return matchesSearch && matchesFilter
  })

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return '刚刚'
    if (diffInHours < 24) return `${diffInHours}小时前`
    if (diffInHours < 24 * 7) return `${Math.floor(diffInHours / 24)}天前`
    
    return date.toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  // 获取角色关键词
  const getCharacterKeywords = (character: Character) => {
    return character.prompt_template?.basic_info?.keywords || []
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        duration: 0.3
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 mx-auto animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
          <p className="text-slate-600">加载角色中...</p>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 max-w-7xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">我的角色</h1>
            <p className="text-slate-600 mt-1">管理你创建的所有AI角色 ({characters.length}个角色)</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button asChild className="bg-slate-900 hover:bg-slate-800">
              <Link href="/characters/new">
                <Plus className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">创建新角色</span>
                <span className="sm:hidden">创建</span>
              </Link>
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Search and Filter Bar */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="搜索角色名称或描述..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {/* Filter */}
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full md:w-48">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部角色</SelectItem>
                  <SelectItem value="public">公开角色</SelectItem>
                  <SelectItem value="private">私人角色</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Sort */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">创建时间</SelectItem>
                  <SelectItem value="name">角色名称</SelectItem>
                  <SelectItem value="updated_at">更新时间</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Characters Grid */}
      {filteredCharacters.length === 0 ? (
        <motion.div variants={itemVariants}>
          <Card className="border-slate-200/60">
            <CardContent className="py-12 px-4 text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                <Users className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {searchQuery || filterType !== 'all' ? '没有找到匹配的角色' : '还没有创建角色'}
              </h3>
              <p className="text-slate-500 mb-6 text-sm leading-relaxed max-w-sm mx-auto">
                {searchQuery || filterType !== 'all' 
                  ? '试试调整搜索条件或筛选选项'
                  : '创建你的第一个AI角色，开始精彩的对话体验'
                }
              </p>
              {(!searchQuery && filterType === 'all') && (
                <Button asChild className="bg-blue-600 hover:bg-blue-700 rounded-full px-6">
                  <Link href="/characters/new">
                    <Plus className="w-4 h-4 mr-2" />
                    创建新角色
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredCharacters.map((character, index) => (
            <motion.div
              key={character.id}
              variants={itemVariants}
              custom={index}
            >
              <Card className="hover:shadow-lg transition-all duration-200 group border-slate-200/60">
                <CardContent className="p-4 sm:p-6">
                  {/* Character Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <Avatar className="w-12 h-12 sm:w-14 sm:h-14 ring-2 ring-slate-100">
                        <AvatarImage src={character.avatar_url} />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-medium">
                          {character.name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 truncate text-base sm:text-lg">
                          {character.name}
                        </h3>
                        <div className="flex items-center space-x-2 text-xs text-slate-500 mt-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(character.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Actions Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/characters/${character.id}/edit`}>
                            <Edit className="w-4 h-4 mr-2" />
                            编辑角色
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => togglePublic(character.id, character.is_public)}>
                          {character.is_public ? (
                            <>
                              <EyeOff className="w-4 h-4 mr-2" />
                              设为私人
                            </>
                          ) : (
                            <>
                              <Eye className="w-4 h-4 mr-2" />
                              设为公开
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => deleteCharacter(character.id)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          删除角色
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Character Introduction & Keywords */}
                  <div className="mb-4 space-y-3">
                    {/* 角色说明 */}
                    <div>
                      <p className="text-sm text-slate-700 line-clamp-3 leading-relaxed">
                        {character.prompt_template?.basic_info?.introduction || 
                         character.prompt_template?.basic_info?.description || 
                         '这个角色还没有添加说明...'}
                      </p>
                    </div>
                    
                    {/* Keywords */}
                    {getCharacterKeywords(character).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {getCharacterKeywords(character).slice(0, 4).map((keyword: string, idx: number) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100"
                          >
                            {keyword}
                          </span>
                        ))}
                        {getCharacterKeywords(character).length > 4 && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                            +{getCharacterKeywords(character).length - 4}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Status and Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div className="flex items-center space-x-2">
                      {character.is_public ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                          <Globe className="w-3 h-3 mr-1" />
                          公开
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
                          <Lock className="w-3 h-3 mr-1" />
                          私人
                        </span>
                      )}
                    </div>
                    
                                          <div className="flex space-x-2">
                        <Button asChild size="sm" variant="outline" className="h-8 px-3 text-xs">
                          <Link href={`/characters/${character.id}/edit`}>
                            <Edit className="w-3 h-3 mr-1.5" />
                            编辑
                          </Link>
                        </Button>
                        <Button 
                          size="sm" 
                          className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700"
                          onClick={() => handleChatClick(character.id)}
                        >
                          <MessageCircle className="w-3 h-3 mr-1.5" />
                          聊天
                        </Button>
                      </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
} 
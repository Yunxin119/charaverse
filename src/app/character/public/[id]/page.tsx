'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { 
  ArrowLeft,
  Heart, 
  MessageCircle, 
  Star,
  Share2,
  Clock,
  User,
  Send,
  Trash2,
  Edit3,
  Settings,
  ChevronDown,
  ChevronUp,
  MoreHorizontal
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '../../../lib/supabase'
import { useAppSelector } from '../../../store/hooks'
import { BottomNavbar } from '../../../components/layout/BottomNavbar'
import ImageUpload from '../../../components/ImageUpload'
import ImageViewer from '../../../components/ImageViewer'
import { uploadCommentImages, type CompressedImage } from '../../../lib/imageUtils'

interface Character {
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

interface Comment {
  id: number
  content: string
  created_at: string
  user_id: string
  images?: string[] // 评论图片URL数组
  profiles?: {
    username?: string
  }
}

export default function PublicCharacterPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAppSelector((state) => state.auth)
  
  const [character, setCharacter] = useState<Character | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLiking, setIsLiking] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false)
  const [commentImages, setCommentImages] = useState<CompressedImage[]>([])
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set())
  const [imageViewerOpen, setImageViewerOpen] = useState(false)
  const [viewerImages, setViewerImages] = useState<string[]>([])
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0)

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }
    
    if (id) {
      fetchCharacterDetails()
      fetchComments()
    }
  }, [id, user, router])

  const fetchCharacterDetails = async () => {
    try {
      // 获取角色详情
      const { data: characterData, error: characterError } = await supabase
        .from('characters')
        .select('*')
        .eq('id', id)
        .eq('is_public', true)
        .single()

      if (characterError) throw characterError
      if (!characterData) throw new Error('角色不存在或未公开')

      // 获取创作者信息
      const { data: profileData } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', characterData.user_id)
        .single()

      setCharacter({
        ...characterData,
        profiles: profileData
      })
    } catch (error) {
      console.error('获取角色详情失败:', error)
      router.push('/explore')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchComments = async () => {
    try {
      const { data: commentsData, error } = await supabase
        .from('character_comments')
        .select('*')
        .eq('character_id', id)
        .order('created_at', { ascending: false })

      if (error) throw error

      // 获取评论者信息
      if (commentsData && commentsData.length > 0) {
        const userIds = [...new Set(commentsData.map(comment => comment.user_id))]
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', userIds)

        const commentsWithProfiles = commentsData.map(comment => ({
          ...comment,
          profiles: profilesData?.find(profile => profile.id === comment.user_id)
        }))

        setComments(commentsWithProfiles)
      }
    } catch (error) {
      console.error('获取评论失败:', error)
    }
  }

  // 点赞功能
  const handleLike = async () => {
    if (!character || isLiking) return
    
    setIsLiking(true)
    try {
      const { error } = await supabase
        .from('characters')
        .update({ likes_count: character.likes_count + 1 })
        .eq('id', character.id)

      if (error) throw error
      
      setCharacter(prev => prev ? { ...prev, likes_count: prev.likes_count + 1 } : null)
    } catch (error) {
      console.error('点赞失败:', error)
    } finally {
      setIsLiking(false)
    }
  }

  // 复制角色到我的角色库
  const handleCopyCharacter = async () => {
    if (!character || isCopying) return
    
    setIsCopying(true)
    try {
      const { error } = await supabase
        .from('characters')
        .insert({
          user_id: user!.id,
          name: `${character.name} (副本)`,
          avatar_url: character.avatar_url,
          prompt_template: character.prompt_template,
          is_public: false,
          likes_count: 0
        })

      if (error) throw error
      
      // 成功提示并跳转
      alert('角色已成功复制到你的角色库！')
      router.push('/characters')
    } catch (error) {
      console.error('复制角色失败:', error)
      alert('复制失败，请重试')
    } finally {
      setIsCopying(false)
    }
  }

  // 开始聊天
  const handleStartChat = async () => {
    if (!character) return
    
    try {
      const { data: session, error } = await supabase
        .from('chat_sessions')
        .insert({
          user_id: user!.id,
          character_id: character.id,
          title: `与 ${character.name} 的对话`
        })
        .select()
        .single()

      if (error) throw error
      
      router.push(`/chat/${session.id}`)
    } catch (error) {
      console.error('创建聊天会话失败:', error)
      alert('创建聊天失败，请重试')
    }
  }

  // 提交评论
  const handleSubmitComment = async () => {
    if ((!newComment.trim() && commentImages.length === 0) || isSubmittingComment) return
    
    setIsSubmittingComment(true)
    try {
      // 首先插入评论记录
      const { data: commentData, error: commentError } = await supabase
        .from('character_comments')
        .insert({
          character_id: Number(id),
          user_id: user!.id,
          content: newComment.trim() || ''
        })
        .select()
        .single()

      if (commentError) throw commentError

      // 如果有图片，上传图片并更新评论
      if (commentImages.length > 0) {
        const imageFiles = commentImages.map(img => img.file)
        const imageUrls = await uploadCommentImages(imageFiles, commentData.id.toString())
        
        // 更新评论记录，添加图片URL
        const { error: updateError } = await supabase
          .from('character_comments')
          .update({ images: imageUrls })
          .eq('id', commentData.id)

        if (updateError) throw updateError
      }
      
      // 清空表单
      setNewComment('')
      setCommentImages([])
      
      // 重新获取评论列表
      fetchComments()
    } catch (error) {
      console.error('发布评论失败:', error)
      alert('发布评论失败，请重试')
    } finally {
      setIsSubmittingComment(false)
    }
  }

  // 删除评论
  const handleDeleteComment = async (commentId: number) => {
    if (!confirm('确定要删除这条评论吗？')) return
    
    try {
      const { error } = await supabase
        .from('character_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', user!.id) // 确保只能删除自己的评论

      if (error) throw error
      
      fetchComments() // 重新获取评论列表
    } catch (error) {
      console.error('删除评论失败:', error)
      alert('删除评论失败，请重试')
    }
  }

  // 切换评论展开状态
  const toggleCommentExpanded = (commentId: number) => {
    const newExpanded = new Set(expandedComments)
    if (newExpanded.has(commentId)) {
      newExpanded.delete(commentId)
    } else {
      newExpanded.add(commentId)
    }
    setExpandedComments(newExpanded)
  }

  // 检查评论文本是否需要展开功能
  const needsExpansion = (content: string): boolean => {
    const lines = content.split('\n')
    return lines.length > 3 || content.length > 150
  }

  // 获取截断的评论文本
  const getTruncatedContent = (content: string): string => {
    const lines = content.split('\n')
    if (lines.length > 3) {
      return lines.slice(0, 3).join('\n')
    }
    if (content.length > 150) {
      return content.substring(0, 150)
    }
    return content
  }

  // 打开图片查看器
  const openImageViewer = (images: string[], initialIndex: number = 0) => {
    setViewerImages(images)
    setViewerInitialIndex(initialIndex)
    setImageViewerOpen(true)
  }

  if (isLoading) {
    return (
      <div className="h-screen bg-slate-50 flex flex-col">
        <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200 px-4 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="p-2 h-8 w-8"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-base font-semibold text-slate-900">角色详情</h1>
            <div className="w-8 h-8"></div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600">加载中...</p>
          </div>
        </div>
        <BottomNavbar />
      </div>
    )
  }

  if (!character) {
    return (
      <div className="h-screen bg-slate-50 flex flex-col">
        <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200 px-4 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="p-2 h-8 w-8"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-base font-semibold text-slate-900">角色详情</h1>
            <div className="w-8 h-8"></div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-4">
            <p className="text-slate-600 mb-4">角色不存在或未公开</p>
            <Button onClick={() => router.push('/explore')}>
              返回探索页面
            </Button>
          </div>
        </div>
        <BottomNavbar />
      </div>
    )
  }

  return (
    <div className="h-screen bg-slate-50 flex flex-col">
      {/* 内容区域 - 占据剩余空间 */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {/* Character Banner */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="relative -mx-4 -mt-6 mb-8"
          >
            {/* Back Button - 绝对定位在左上角 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="absolute top-4 left-4 z-20 bg-black/20 hover:bg-black/40 text-white border-white/20"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            
            {/* Share Button - 绝对定位在右上角 */}
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-4 right-4 z-20 bg-black/20 hover:bg-black/40 text-white border-white/20"
            >
              <Share2 className="w-4 h-4" />
            </Button>
            
            <div className="w-full aspect-[1.8/1] overflow-hidden relative">
              {/* Avatar Background or Default Background */}
              {character.avatar_url ? (
                <>
                  <div 
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                    style={{ backgroundImage: `url(${character.avatar_url})` }}
                  ></div>
                  <div className="absolute inset-0 bg-black/50"></div>
                </>
              ) : (
                <>
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200">
                    <div className="absolute inset-0 opacity-40">
                      <div className="absolute top-0 left-1/4 w-40 h-40 bg-blue-400 rounded-full blur-3xl"></div>
                      <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-purple-400 rounded-full blur-3xl"></div>
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-indigo-300 rounded-full blur-2xl"></div>
                      <div className="absolute top-1/4 right-1/3 w-24 h-24 bg-pink-300 rounded-full blur-2xl"></div>
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
                </>
              )}
              
              {/* Character Avatar - 右下角位置 */}
              <div className="absolute bottom-6 right-6">
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-2xl bg-white">
                  {character.avatar_url ? (
                    <img 
                      src={character.avatar_url} 
                      alt={character.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <span className="text-white text-4xl font-bold">
                        {character.name.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Character Info - 左下角位置 */}
              <div className="absolute bottom-6 left-6 text-white z-10">
                <h1 className="text-4xl font-bold drop-shadow-lg mb-2">
                  {character.name}
                </h1>
                <div className="flex items-center space-x-4 text-lg drop-shadow mb-2">
                  {character.prompt_template?.basic_info?.age && (
                    <span>{character.prompt_template.basic_info.age}</span>
                  )}
                  {character.prompt_template?.basic_info?.gender && (
                    <span>
                      {character.prompt_template.basic_info.gender === 'male' ? '男' : 
                       character.prompt_template.basic_info.gender === 'female' ? '女' : 
                       character.prompt_template.basic_info.gender === 'none' ? '无性别' : '其他'}
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-full overflow-hidden border border-white/30">
                    <div className="w-full h-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">
                        {character.profiles?.username?.charAt(0) || 'U'}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm opacity-90 drop-shadow">
                    {character.profiles?.username || '匿名用户'}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Character Details */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Card>
              <CardContent className="p-6">
                {/* Introduction */}
                {character.prompt_template?.basic_info?.introduction && (
                  <div className="mb-6">
                    <h3 className="font-semibold text-slate-900 mb-3 flex items-center">
                      <MessageCircle className="w-5 h-5 mr-2" />
                      角色介绍
                    </h3>
                    <p className="text-slate-700 leading-relaxed text-base">
                      {character.prompt_template.basic_info.introduction}
                    </p>
                  </div>
                )}

                {/* Keywords */}
                {character.prompt_template?.basic_info?.keywords && character.prompt_template.basic_info.keywords.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-semibold text-slate-900 mb-3 flex items-center">
                      <Star className="w-5 h-5 mr-2" />
                      关键词
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {character.prompt_template.basic_info.keywords.map((keyword: string, index: number) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-blue-50 text-blue-700 border border-blue-100"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Character Settings - Collapsible */}
                {(character.prompt_template?.basic_info?.description || 
                  (character.prompt_template?.modules && character.prompt_template.modules.length > 0)) && (
                  <div className="mb-6">
                    <button
                      onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
                      className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <h3 className="font-semibold text-slate-900 flex items-center">
                        <Settings className="w-5 h-5 mr-2" />
                        角色设定
                      </h3>
                      {isSettingsExpanded ? (
                        <ChevronUp className="w-5 h-5 text-slate-600" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-600" />
                      )}
                    </button>

                    {isSettingsExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="mt-4 space-y-4"
                      >
                        {/* Basic Info Description */}
                        {character.prompt_template?.basic_info?.description && (
                          <div className="border border-slate-200 rounded-lg p-4">
                            <h4 className="font-medium text-slate-900 mb-2 flex items-center">
                              <User className="w-4 h-4 mr-2" />
                              基本设定
                            </h4>
                            <p className="text-slate-700 leading-relaxed text-sm">
                              {character.prompt_template.basic_info.description}
                            </p>
                          </div>
                        )}

                        {/* Modules */}
                        {character.prompt_template?.modules && character.prompt_template.modules.length > 0 && (
                          <>
                            {character.prompt_template.modules.map((module: any, index: number) => (
                              <div key={index} className="border border-slate-200 rounded-lg p-4">
                                <h4 className="font-medium text-slate-900 mb-2">{module.type}</h4>
                                {module.type === '用户角色设定' ? (
                                  <div className="space-y-2 text-sm text-slate-600">
                                    {module.userRoleName && <p><strong>姓名:</strong> {module.userRoleName}</p>}
                                    {module.userRoleAge && <p><strong>年龄:</strong> {module.userRoleAge}</p>}
                                    {module.userRoleGender && <p><strong>性别:</strong> {
                                      module.userRoleGender === 'male' ? '男' : 
                                      module.userRoleGender === 'female' ? '女' : 
                                      module.userRoleGender === 'none' ? '无性别' : '其他'
                                    }</p>}
                                    {module.userRoleDetails && <p><strong>详情:</strong> {module.userRoleDetails}</p>}
                                  </div>
                                ) : module.type === '自定义模块' && module.name ? (
                                  <div className="text-sm text-slate-600">
                                    <p className="font-medium mb-1">{module.name}</p>
                                    <p>{module.content}</p>
                                  </div>
                                ) : module.content ? (
                                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{module.content}</p>
                                ) : null}
                              </div>
                            ))}
                          </>
                        )}
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Stats */}
                <div className="flex items-center justify-between mb-6 text-sm text-slate-500">
                  <div className="flex items-center space-x-1">
                    <Heart className="w-4 h-4" />
                    <span>{character.likes_count} 点赞</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Clock className="w-4 h-4" />
                    <span>{new Date(character.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <Button 
                    onClick={handleCopyCharacter}
                    disabled={isCopying}
                    variant="outline"
                    className="h-12"
                  >
                    <Star className="w-4 h-4 mr-2" />
                    {isCopying ? '复制中...' : '复制到角色库'}
                  </Button>
                  <Button 
                    onClick={handleStartChat}
                    className="h-12 bg-blue-600 hover:bg-blue-700"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    开始聊天
                  </Button>
                </div>

                {/* Like Button */}
                <Button
                  onClick={handleLike}
                  disabled={isLiking}
                  variant="ghost"
                  className="w-full h-12 text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                  <Heart className="w-4 h-4 mr-2" />
                  {isLiking ? '点赞中...' : `点赞 (${character.likes_count})`}
                </Button>
              </CardContent>
            </Card>
          </motion.div>

        {/* Comments Section */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-slate-900">评论 ({comments.length})</h3>
            </CardHeader>
            <CardContent>
              {/* Add Comment */}
              <div className="mb-6">
                <Textarea
                  placeholder="分享你对这个角色的看法..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[100px] mb-3 resize-none"
                />
                
                {/* Image Upload */}
                <div className="mb-3">
                  <ImageUpload
                    maxImages={3}
                    onImagesChange={setCommentImages}
                    disabled={isSubmittingComment}
                  />
                </div>
                
                <Button
                  onClick={handleSubmitComment}
                  disabled={(!newComment.trim() && commentImages.length === 0) || isSubmittingComment}
                  className="w-full"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {isSubmittingComment ? '发布中...' : '发布评论'}
                </Button>
              </div>

              {/* Comments List */}
              <div className="space-y-4">
                {comments.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <MessageCircle className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                    <p>还没有评论，来发表第一条评论吧！</p>
                  </div>
                ) : (
                  comments.map((comment) => {
                    const isExpanded = expandedComments.has(comment.id)
                    const shouldShowExpansion = needsExpansion(comment.content)
                    const displayContent = shouldShowExpansion && !isExpanded 
                      ? getTruncatedContent(comment.content) 
                      : comment.content

                    return (
                      <div key={comment.id} className="border-b border-slate-100 pb-4 last:border-b-0">
                        <div className="flex items-start space-x-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="bg-slate-200 text-slate-600 text-sm">
                              {comment.profiles?.username?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-medium text-slate-900 text-sm">
                                  {comment.profiles?.username || '匿名用户'}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {new Date(comment.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              {comment.user_id === user?.id && (
                                <Button
                                  onClick={() => handleDeleteComment(comment.id)}
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:text-red-600 p-1"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                            
                            {/* 评论文本 */}
                            {comment.content && (
                              <div className="mb-2">
                                <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                                  {displayContent}
                                </p>
                                {shouldShowExpansion && (
                                  <button
                                    onClick={() => toggleCommentExpanded(comment.id)}
                                    className="text-xs text-blue-600 hover:text-blue-700 mt-1 font-medium"
                                  >
                                    {isExpanded ? '收起' : '展开'}
                                  </button>
                                )}
                              </div>
                            )}
                            
                            {/* 评论图片 */}
                            {comment.images && comment.images.length > 0 && (
                              <div className="mb-2">
                                <div className="grid grid-cols-3 gap-2 max-w-[200px]">
                                  {comment.images.map((image, index) => (
                                    <button
                                      key={index}
                                      onClick={() => openImageViewer(comment.images!, index)}
                                      className="aspect-square rounded-lg overflow-hidden border border-slate-200 hover:border-slate-300 transition-colors"
                                    >
                                      <img
                                        src={image}
                                        alt={`评论图片 ${index + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
        </div>
      </main>

      {/* 固定底部导航 */}
      <BottomNavbar />
      
      {/* 图片查看器 */}
      <ImageViewer
        images={viewerImages}
        isOpen={imageViewerOpen}
        onClose={() => setImageViewerOpen(false)}
        initialIndex={viewerInitialIndex}
      />
    </div>
  )
}

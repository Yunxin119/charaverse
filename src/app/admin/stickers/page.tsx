'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Upload, 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Eye,
  Heart,
  TrendingUp,
  Package,
  Image as ImageIcon,
  X,
  Check,
  AlertTriangle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { StickerService } from '@/lib/stickerService'
import type { StickerPack, Sticker, StickerCategory, StickerEmotion, StickerUploadData, StickerStats } from '@/types/sticker'
import { STICKER_CATEGORIES } from '@/types/sticker'
import { useAppSelector } from '@/app/store/hooks'

export default function StickerAdminPage() {
  const { user } = useAppSelector((state) => state.auth)
  const [activeTab, setActiveTab] = useState('overview')
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState<StickerStats | null>(null)
  const [packs, setPacks] = useState<StickerPack[]>([])
  const [selectedPack, setSelectedPack] = useState<StickerPack | null>(null)
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<StickerCategory | 'all'>('all')

  // 新建表情包合集的状态
  const [showCreatePack, setShowCreatePack] = useState(false)
  const [newPack, setNewPack] = useState({
    name: '',
    description: '',
    category: 'general' as StickerCategory,
    is_public: true
  })

  // 上传表情包的状态
  const [showUpload, setShowUpload] = useState(false)
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploadPackId, setUploadPackId] = useState('')
  const [uploadTags, setUploadTags] = useState('')
  const [uploadEmotions, setUploadEmotions] = useState<StickerEmotion[]>([])
  const [uploadKeywords, setUploadKeywords] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  // 加载初始数据
  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    try {
      setIsLoading(true)
      const [statsData, packsData] = await Promise.all([
        StickerService.getStickerStats(),
        StickerService.getStickerPacks()
      ])
      setStats(statsData)
      setPacks(packsData)
    } catch (error) {
      console.error('Error loading initial data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 加载表情包合集中的表情包
  const loadPackStickers = async (packId: string) => {
    try {
      const stickersData = await StickerService.getStickersInPack(packId)
      setStickers(stickersData)
    } catch (error) {
      console.error('Error loading pack stickers:', error)
    }
  }

  // 创建新的表情包合集
  const handleCreatePack = async () => {
    if (!newPack.name.trim()) return

    try {
      const createdPack = await StickerService.createStickerPack({
        ...newPack,
        is_default: false,
        sort_order: 0,
        created_by: user?.id
      })
      
      setPacks(prev => [createdPack, ...prev])
      setNewPack({ name: '', description: '', category: 'general', is_public: true })
      setShowCreatePack(false)
    } catch (error) {
      console.error('Error creating sticker pack:', error)
      alert('创建表情包合集失败')
    }
  }

  // 处理文件选择
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    const imageFiles = files.filter(file => file.type.startsWith('image/'))
    setUploadFiles(imageFiles)
  }

  // 上传表情包
  const handleUploadStickers = async () => {
    if (!uploadPackId || uploadFiles.length === 0) return

    try {
      setIsUploading(true)
      const uploads: StickerUploadData[] = uploadFiles.map((file, index) => ({
        name: file.name.replace(/\.[^/.]+$/, ''), // 移除文件扩展名
        pack_id: uploadPackId,
        file,
        tags: uploadTags.split(',').map(tag => tag.trim()).filter(Boolean),
        emotions: uploadEmotions,
        keywords: uploadKeywords.split(',').map(keyword => keyword.trim()).filter(Boolean),
        sort_order: index
      }))

      const uploadedStickers = await StickerService.uploadMultipleStickers(uploads)
      
      // 刷新数据
      if (selectedPack && selectedPack.id === uploadPackId) {
        setStickers(prev => [...prev, ...uploadedStickers])
      }
      
      // 重置上传状态
      setUploadFiles([])
      setUploadTags('')
      setUploadEmotions([])
      setUploadKeywords('')
      setShowUpload(false)
      
      alert(`成功上传 ${uploadedStickers.length} 个表情包`)
    } catch (error) {
      console.error('Error uploading stickers:', error)
      alert('上传表情包失败')
    } finally {
      setIsUploading(false)
    }
  }

  // 过滤表情包合集
  const filteredPacks = packs.filter(pack => {
    const matchesSearch = pack.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         pack.description?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || pack.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-slate-500">请先登录</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">表情包管理</h1>
          <p className="text-slate-600 dark:text-slate-400">管理表情包合集和上传新的表情包</p>
        </div>
        
        <div className="flex space-x-3">
          <Button 
            onClick={() => setShowCreatePack(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            新建合集
          </Button>
          <Button 
            onClick={() => setShowUpload(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            <Upload className="w-4 h-4 mr-2" />
            上传表情包
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="packs">表情包合集</TabsTrigger>
          <TabsTrigger value="stickers">表情包详情</TabsTrigger>
        </TabsList>

        {/* 概览标签页 */}
        <TabsContent value="overview" className="space-y-6">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-4 bg-slate-200 rounded mb-2"></div>
                    <div className="h-8 bg-slate-200 rounded"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : stats && (
            <>
              {/* 统计卡片 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <Package className="h-8 w-8 text-blue-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">表情包合集</p>
                        <p className="text-2xl font-bold">{stats.total_packs}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <ImageIcon className="h-8 w-8 text-green-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">表情包总数</p>
                        <p className="text-2xl font-bold">{stats.total_stickers}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <TrendingUp className="h-8 w-8 text-purple-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">最热门表情</p>
                        <p className="text-2xl font-bold">{stats.most_used_stickers[0]?.usage_count || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <Heart className="h-8 w-8 text-red-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">分类数量</p>
                        <p className="text-2xl font-bold">{stats.categories.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 最热门和最新表情包 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 最热门表情包 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <TrendingUp className="w-5 h-5 mr-2" />
                      最热门表情包
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-5 gap-3">
                      {stats.most_used_stickers.slice(0, 10).map((sticker) => (
                        <div key={sticker.id} className="text-center">
                          <img 
                            src={sticker.image_url} 
                            alt={sticker.name}
                            className="w-12 h-12 object-contain rounded border"
                          />
                          <p className="text-xs mt-1 truncate">{sticker.usage_count}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* 最新表情包 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Plus className="w-5 h-5 mr-2" />
                      最新表情包
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-5 gap-3">
                      {stats.recent_stickers.slice(0, 10).map((sticker) => (
                        <div key={sticker.id} className="text-center">
                          <img 
                            src={sticker.image_url} 
                            alt={sticker.name}
                            className="w-12 h-12 object-contain rounded border"
                          />
                          <p className="text-xs mt-1 truncate">{sticker.name}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* 表情包合集标签页 */}
        <TabsContent value="packs" className="space-y-6">
          {/* 搜索和过滤 */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="搜索表情包合集..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as StickerCategory | 'all')}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有分类</SelectItem>
                {Object.entries(STICKER_CATEGORIES).map(([key, info]) => (
                  <SelectItem key={key} value={key}>
                    {info.emoji} {info.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 表情包合集网格 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredPacks.map((pack) => (
                <motion.div
                  key={pack.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer" 
                        onClick={() => {
                          setSelectedPack(pack)
                          setActiveTab('stickers')
                          loadPackStickers(pack.id)
                        }}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center">
                            {STICKER_CATEGORIES[pack.category].emoji}
                            <span className="ml-2">{pack.name}</span>
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {pack.description}
                          </CardDescription>
                        </div>
                        <Badge variant={pack.is_public ? 'default' : 'secondary'}>
                          {pack.is_public ? '公开' : '私有'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm text-slate-500">
                        <span>{pack.sticker_count || 0} 个表情包</span>
                        <span>{STICKER_CATEGORIES[pack.category].name}</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </TabsContent>

        {/* 表情包详情标签页 */}
        <TabsContent value="stickers" className="space-y-6">
          {selectedPack ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold flex items-center">
                    {STICKER_CATEGORIES[selectedPack.category].emoji}
                    <span className="ml-2">{selectedPack.name}</span>
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400">{selectedPack.description}</p>
                </div>
                <Button 
                  onClick={() => {
                    setUploadPackId(selectedPack.id)
                    setShowUpload(true)
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  添加表情包
                </Button>
              </div>

              {/* 表情包网格 */}
              <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                {stickers.map((sticker) => (
                  <motion.div
                    key={sticker.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="group relative"
                  >
                    <div className="aspect-square border rounded-lg overflow-hidden bg-white">
                      <img 
                        src={sticker.image_url} 
                        alt={sticker.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                      <div className="text-center text-white">
                        <p className="text-xs font-medium">{sticker.name}</p>
                        <p className="text-xs opacity-75">使用 {sticker.usage_count} 次</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">请选择一个表情包合集查看详情</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* 创建表情包合集对话框 */}
      <AnimatePresence>
        {showCreatePack && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md"
            >
              <h3 className="text-lg font-semibold mb-4">创建新的表情包合集</h3>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="pack-name">合集名称</Label>
                  <Input
                    id="pack-name"
                    value={newPack.name}
                    onChange={(e) => setNewPack(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="输入合集名称..."
                  />
                </div>
                
                <div>
                  <Label htmlFor="pack-description">描述</Label>
                  <Textarea
                    id="pack-description"
                    value={newPack.description}
                    onChange={(e) => setNewPack(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="输入合集描述..."
                    rows={3}
                  />
                </div>
                
                <div>
                  <Label htmlFor="pack-category">分类</Label>
                  <Select 
                    value={newPack.category} 
                    onValueChange={(value) => setNewPack(prev => ({ ...prev, category: value as StickerCategory }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STICKER_CATEGORIES).map(([key, info]) => (
                        <SelectItem key={key} value={key}>
                          {info.emoji} {info.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="pack-public"
                    checked={newPack.is_public}
                    onChange={(e) => setNewPack(prev => ({ ...prev, is_public: e.target.checked }))}
                  />
                  <Label htmlFor="pack-public">公开合集</Label>
                </div>
              </div>
              
              <div className="flex space-x-3 mt-6">
                <Button 
                  variant="outline" 
                  onClick={() => setShowCreatePack(false)}
                  className="flex-1"
                >
                  取消
                </Button>
                <Button 
                  onClick={handleCreatePack}
                  disabled={!newPack.name.trim()}
                  className="flex-1"
                >
                  创建
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 上传表情包对话框 */}
      <AnimatePresence>
        {showUpload && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-lg font-semibold mb-4">上传表情包</h3>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="upload-pack">选择表情包合集</Label>
                  <Select value={uploadPackId} onValueChange={setUploadPackId}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择表情包合集..." />
                    </SelectTrigger>
                    <SelectContent>
                      {packs.map((pack) => (
                        <SelectItem key={pack.id} value={pack.id}>
                          {STICKER_CATEGORIES[pack.category].emoji} {pack.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="upload-files">选择文件</Label>
                  <Input
                    id="upload-files"
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="cursor-pointer"
                  />
                  {uploadFiles.length > 0 && (
                    <p className="text-sm text-slate-500 mt-1">
                      已选择 {uploadFiles.length} 个文件
                    </p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="upload-tags">标签（用逗号分隔）</Label>
                  <Input
                    id="upload-tags"
                    value={uploadTags}
                    onChange={(e) => setUploadTags(e.target.value)}
                    placeholder="开心, 笑脸, 表情..."
                  />
                </div>
                
                <div>
                  <Label htmlFor="upload-keywords">关键词（用逗号分隔）</Label>
                  <Input
                    id="upload-keywords"
                    value={uploadKeywords}
                    onChange={(e) => setUploadKeywords(e.target.value)}
                    placeholder="高兴, 快乐, 喜悦..."
                  />
                </div>
                
                {/* 预览选择的文件 */}
                {uploadFiles.length > 0 && (
                  <div>
                    <Label>文件预览</Label>
                    <div className="grid grid-cols-4 gap-2 mt-2 max-h-40 overflow-y-auto">
                      {uploadFiles.map((file, index) => (
                        <div key={index} className="relative">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            className="w-full aspect-square object-contain border rounded"
                          />
                          <Button
                            size="sm"
                            variant="destructive"
                            className="absolute -top-2 -right-2 w-6 h-6 p-0 rounded-full"
                            onClick={() => {
                              setUploadFiles(prev => prev.filter((_, i) => i !== index))
                            }}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex space-x-3 mt-6">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowUpload(false)
                    setUploadFiles([])
                    setUploadTags('')
                    setUploadKeywords('')
                  }}
                  className="flex-1"
                  disabled={isUploading}
                >
                  取消
                </Button>
                <Button 
                  onClick={handleUploadStickers}
                  disabled={!uploadPackId || uploadFiles.length === 0 || isUploading}
                  className="flex-1"
                >
                  {isUploading ? '上传中...' : `上传 ${uploadFiles.length} 个文件`}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
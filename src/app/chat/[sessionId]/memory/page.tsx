'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Edit3,
  RefreshCw,
  Save,
  X,
  Plus,
  Trash2,
  Brain,
  Users,
  MapPin,
  Calendar,
  Heart,
  Settings,
  FileText,
  Table,
  Sparkles,
  MessageSquare,
  ChevronRight,
  Clock,
  Info,
  CheckSquare,
  Package,
  Search,
  Filter,
  SortDesc,
  BarChart3,
  Eye,
  EyeOff
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAppSelector } from '../../../store/hooks'
import { supabase } from '../../../lib/supabase'
import { getSummaries } from '../../../lib/enhancedChatSlice'
import { useApiConfig } from '../../../lib/useApiConfig'

// 基础记忆表格接口定义
interface BaseMemoryEntry {
  id: string
  type: 'character' | 'event' | 'setting' | 'emotion' | 'spacetime' | 'relationship' | 'task' | 'item'
  title: string
  content: string
  importance: number
  created_at: string
  updated_at: string
  summary_id?: number
  metadata?: Record<string, any>
}

// 时空记忆表格
interface SpacetimeMemory extends BaseMemoryEntry {
  type: 'spacetime'
  metadata: {
    date?: string           // 日期
    time?: string           // 时间
    location: string        // 地点
    characters: string[]    // 此地角色
    weather?: string        // 天气
    atmosphere?: string     // 氛围
    is_enabled?: boolean    // 是否启用
  }
}

// 角色关系记忆表格
interface RelationshipMemory extends BaseMemoryEntry {
  type: 'relationship'
  metadata: {
    character_name: string  // 角色名
    relationship: string    // 关系类型
    attitude: string        // 态度
    affection: number       // 好感度 (1-10)
    trust: number          // 信任度 (1-10)
    last_interaction?: string // 最后互动
    is_enabled?: boolean    // 是否启用
  }
}

// 任务/约定记忆表格
interface TaskMemory extends BaseMemoryEntry {
  type: 'task'
  metadata: {
    assigned_by: string     // 分配者
    assigned_to: string     // 执行者
    task_type: 'command' | 'agreement' | 'promise' | 'appointment' // 任务类型
    location?: string       // 地点
    scheduled_time?: string // 约定时间
    duration?: string       // 持续时间
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled' // 状态
    priority: 'low' | 'medium' | 'high' | 'urgent' // 优先级
    is_enabled?: boolean    // 是否启用
  }
}

// 重要物品记忆表格
interface ItemMemory extends BaseMemoryEntry {
  type: 'item'
  metadata: {
    item_name: string       // 物品名
    owner: string          // 拥有者
    description: string    // 物品描述
    importance_reason: string // 重要原因
    location?: string      // 存放地点
    acquisition_method?: string // 获得方式
    emotional_value?: number // 情感价值 (1-10)
    is_enabled?: boolean    // 是否启用
  }
}

// 角色记忆表格 (增强版)
interface CharacterMemory extends BaseMemoryEntry {
  type: 'character'
  metadata: {
  name: string
  relationship: string
    appearance?: string
  personality: string
  status: string
    nickname?: string       // 昵称/称呼
    age?: string           // 年龄
    occupation?: string    // 职业
    is_enabled?: boolean    // 是否启用
    background?: string    // 背景
    special_traits?: string[] // 特殊特征
  }
}

// 事件记忆表格 (增强版)
interface EventMemory extends BaseMemoryEntry {
  type: 'event'
  metadata: {
  time: string
    location?: string
  participants: string[]
  emotion_intensity: number
  impact: string
    event_type?: 'conversation' | 'action' | 'decision' | 'conflict' | 'celebration'
    consequences?: string   // 后果
    is_enabled?: boolean    // 是否启用
  }
}

// 设定记忆表格 (增强版)
interface SettingMemory extends BaseMemoryEntry {
  type: 'setting'
  metadata: {
  location: string
    items?: string[]
    rules?: string[]
  description: string
    atmosphere?: string
    significance?: string   // 重要性说明
    is_enabled?: boolean    // 是否启用
  }
}

// 情感记忆表格 (增强版)
interface EmotionMemory extends BaseMemoryEntry {
  type: 'emotion'
  metadata: {
  emotion_type: string
  intensity: number
  cause: string
  duration: string
    target?: string        // 情感对象
    trigger?: string       // 触发因素
    is_enabled?: boolean    // 是否启用
  }
}

// 统一的记忆条目类型
type MemoryEntry = SpacetimeMemory | RelationshipMemory | TaskMemory | ItemMemory | 
                  CharacterMemory | EventMemory | SettingMemory | EmotionMemory

// 摘要数据接口
interface ChatSummary {
  id: number
  session_id: string
  user_id: string
  content: string
  summary_level: number
  is_active: boolean
  created_at: string
  updated_at: string
  memory_table?: any
  start_message_id?: number
  end_message_id?: number
}

export default function MemoryManagePage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string

  const { user } = useAppSelector((state) => state.auth)
  const { currentCharacter, selectedModel } = useAppSelector((state) => state.chat)
  const { getModelConfig, availableModels } = useApiConfig()

  const [summaries, setSummaries] = useState<ChatSummary[]>([])
  const [memories, setMemories] = useState<MemoryEntry[]>([])
  const [editingSummary, setEditingSummary] = useState<number | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isRegenerating, setIsRegenerating] = useState<number | null>(null)
  const [showAddMemoryDialog, setShowAddMemoryDialog] = useState(false)
  const [newMemory, setNewMemory] = useState<Partial<MemoryEntry>>({
    type: 'character',
    title: '',
    content: '',
    importance: 5
  })
  const [editingMemory, setEditingMemory] = useState<MemoryEntry | null>(null)
  const [showEditMemoryDialog, setShowEditMemoryDialog] = useState(false)

  // 摘要控制相关状态
  const [messageCount, setMessageCount] = useState(0)
  const [summaryThreshold, setSummaryThreshold] = useState(50)
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)
  const [summaryRanges, setSummaryRanges] = useState<{start: number, end: number, count: number}[]>([])
  const [useMemoryTableFormat, setUseMemoryTableFormat] = useState(true)
  const [autoSummaryEnabled, setAutoSummaryEnabled] = useState(false)

  // 手动范围选择相关状态
  const [allMessages, setAllMessages] = useState<{id: number, index: number}[]>([])
  const [manualStartRange, setManualStartRange] = useState('')
  const [manualEndRange, setManualEndRange] = useState('')
  const [rangeValidation, setRangeValidation] = useState<{valid: boolean, message: string}>({valid: true, message: ''})
  const [showManualRange, setShowManualRange] = useState(false)

  // 记忆表格筛选状态
  const [selectedMemoryTypes, setSelectedMemoryTypes] = useState<string[]>(['character', 'event', 'setting', 'emotion', 'spacetime', 'relationship', 'task', 'item'])
  const [memorySearchTerm, setMemorySearchTerm] = useState('')
  const [memorySortBy, setMemorySortBy] = useState<'importance' | 'created_at' | 'type'>('importance')

  // 智能上下文状态
  const [contextStatus, setContextStatus] = useState<{
    totalMessages: number
    coveredMessages: number
    uncoveredMessages: number
    coverageRanges: {start: number, end: number}[]
  } | null>(null)

  // 加载摘要和记忆数据
  useEffect(() => {
    if (!user || !sessionId) return

    const loadData = async () => {
      setIsLoading(true)
      try {
        // 加载摘要
        const summaryData = await getSummaries(sessionId, user.id)
        setSummaries(summaryData as ChatSummary[])

        // 加载记忆表格数据（只加载启用的）
        const { data: memoryData } = await supabase
          .from('chat_memories')
          .select('*')
          .eq('session_id', sessionId)
          .eq('user_id', user.id)
          .eq('is_enabled', true)

        if (memoryData) {
          // 需要根据摘要的聊天范围排序记忆表格
          // 先存储原始数据，等摘要加载完成后再重新排序
          setMemories(memoryData)
        }

        // 加载消息计数和详细信息
        // 使用count获取总数，然后分批获取所有消息ID
        const { count: totalCount } = await supabase
          .from('chat_messages')
          .select('id', { count: 'exact', head: true })
          .eq('session_id', sessionId)

        if (totalCount) {
          setMessageCount(totalCount)

          // 分批获取所有消息ID（每批1000条）
          const allMessages: { id: number; index: number }[] = []
          const batchSize = 1000
          const batches = Math.ceil(totalCount / batchSize)

          for (let i = 0; i < batches; i++) {
            const { data: batchData } = await supabase
              .from('chat_messages')
              .select('id')
              .eq('session_id', sessionId)
              .order('created_at', { ascending: true })
              .range(i * batchSize, (i + 1) * batchSize - 1)

            if (batchData) {
              const batchIndexes = batchData.map((msg, batchIndex) => ({
                id: msg.id,
                index: i * batchSize + batchIndex + 1
              }))
              allMessages.push(...batchIndexes)
            }
          }

          setAllMessages(allMessages)
          console.log(`📊 加载了 ${allMessages.length} / ${totalCount} 条消息ID`)
        }

        // 延迟计算摘要范围和智能上下文状态，确保summaries状态已更新
        setTimeout(() => {
          calculateSummaryRanges()
          calculateContextStatus()
          // 重新排序记忆表格
          sortMemoriesBySummaryRange(summaryData as ChatSummary[], memoryData || [])
        }, 100)
      } catch (error) {
        console.error('加载数据失败:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [sessionId, user])

  // 编辑摘要
  const handleEditSummary = (summaryId: number, content: string) => {
    setEditingSummary(summaryId)
    setEditingContent(content)
  }

  // 保存摘要编辑
  const handleSaveSummary = async () => {
    if (!editingSummary || !editingContent.trim()) return

    try {
      const { error } = await supabase
        .from('chat_summaries')
        .update({
          content: editingContent.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', editingSummary)

      if (error) throw error

      // 更新本地状态
      setSummaries(prev => prev.map(s =>
        s.id === editingSummary
          ? { ...s, content: editingContent.trim(), updated_at: new Date().toISOString() }
          : s
      ))

      setEditingSummary(null)
      setEditingContent('')
    } catch (error) {
      console.error('保存摘要失败:', error)
      alert('保存失败，请重试')
    }
  }

  // 重新生成摘要
  const handleRegenerateSummary = async (summaryId: number) => {
    if (!availableModels.length) {
      alert('没有可用的AI模型，请检查API配置')
      return
    }

    const currentModel = getCurrentModel()

    let modelConfig
    try {
      modelConfig = getModelConfig(currentModel)
    } catch (error) {
      console.error('❌ 获取模型配置失败:', error)
      alert(error instanceof Error ? error.message : '模型配置错误')
      return
    }

    if (!modelConfig.apiKey) {
      alert('没有可用的API密钥，请检查配置')
      return
    }

    console.log('🎯 记忆管理使用模型:', currentModel)

    setIsRegenerating(summaryId)

    try {
      const summary = summaries.find(s => s.id === summaryId)
      if (!summary) return

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('用户未登录')

      // 构建请求头，包含中转API配置
      const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'x-api-key': modelConfig.apiKey,
        'x-model': currentModel,
          'x-regenerate': 'true' // 标记为重新生成
      }

      // 如果是中转API，添加额外的headers
      if (modelConfig.isRelay) {
        headers['x-base-url'] = modelConfig.baseUrl || ''
        headers['x-actual-model'] = modelConfig.modelName || ''
      }

      // 添加thinking budget参数（如果支持）
      if (currentModel.includes('gemini-2.5')) {
        // 对于Gemini 2.5系列，添加thinking budget
        headers['x-thinking-budget'] = '0' // 使用auto模式
      }

      const response = await fetch('/api/chat/summary', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionId,
          userId: user!.id,
          summaryId: summaryId,
          characterName: currentCharacter?.name || '角色',
          useMemoryTable: true // 使用记忆表格格式
        })
      })

      if (!response.ok) throw new Error('重新生成摘要失败')

      const result = await response.json()

      // 更新摘要
      if (result.summary) {
        setSummaries(prev => prev.map(s =>
          s.id === summaryId
            ? {
                ...s,
                content: result.summary.content,
                memory_table: result.summary.memory_table,
                updated_at: new Date().toISOString()
              }
            : s
        ))
      }

      // 更新记忆表格
      if (result.memories) {
        setMemories(prev => {
          const newMemories = [...prev]
          result.memories.forEach((memory: any) => {
            const existingIndex = newMemories.findIndex(m => m.id === memory.id)
            if (existingIndex >= 0) {
              newMemories[existingIndex] = memory
            } else {
              newMemories.push(memory)
            }
          })
          return newMemories
        })
      }

    } catch (error) {
      console.error('重新生成摘要失败:', error)
      alert('重新生成失败，请重试')
    } finally {
      setIsRegenerating(null)
    }
  }

  // 添加记忆条目
  const handleAddMemory = async () => {
    if (!newMemory.title?.trim() || !newMemory.content?.trim()) {
      alert('请填写标题和内容')
      return
    }

    try {
      const memoryToAdd = {
        ...newMemory,
        id: `manual_${Date.now()}`,
        session_id: sessionId,
        user_id: user!.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('chat_memories')
        .insert(memoryToAdd)
        .select()
        .single()

      if (error) throw error

      setMemories(prev => [data, ...prev])
      setShowAddMemoryDialog(false)
      setNewMemory({
        type: 'character',
        title: '',
        content: '',
        importance: 5
      })

    } catch (error) {
      console.error('添加记忆失败:', error)
      alert('添加失败，请重试')
    }
  }

  // 删除记忆条目
  const handleDeleteMemory = async (memoryId: string) => {
    if (!confirm('确定要删除这个记忆条目吗？')) return

    try {
      const { error } = await supabase
        .from('chat_memories')
        .delete()
        .eq('id', memoryId)

      if (error) throw error

      setMemories(prev => prev.filter(m => m.id !== memoryId))
    } catch (error) {
      console.error('删除记忆失败:', error)
      alert('删除失败，请重试')
    }
  }

  // 编辑记忆条目
  const handleEditMemory = (memory: MemoryEntry) => {
    setEditingMemory(memory)
    setShowEditMemoryDialog(true)
  }

  // 保存编辑的记忆
  const handleSaveEditedMemory = async () => {
    if (!editingMemory || !editingMemory.title?.trim() || !editingMemory.content?.trim()) {
      alert('请填写标题和内容')
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('用户未登录')

      const response = await fetch('/api/chat/memory', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          memoryId: editingMemory.id,
          updates: {
            title: editingMemory.title,
            content: editingMemory.content,
            importance: editingMemory.importance,
            metadata: editingMemory.metadata
          }
        })
      })

      if (!response.ok) throw new Error('更新记忆失败')

      const result = await response.json()

      setMemories(prev => prev.map(m => m.id === editingMemory.id ? result.memory : m))
      setShowEditMemoryDialog(false)
      setEditingMemory(null)
    } catch (error) {
      console.error('编辑记忆失败:', error)
      alert('编辑失败，请重试')
    }
  }

  // 切换记忆启用状态
  const handleToggleMemoryEnabled = async (memory: MemoryEntry) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('用户未登录')

      const newEnabledState = !(memory.metadata?.is_enabled ?? true)

      const response = await fetch('/api/chat/memory', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          memoryId: memory.id,
          updates: {
            is_enabled: newEnabledState
          }
        })
      })

      if (!response.ok) throw new Error('更新记忆状态失败')

      const result = await response.json()

      setMemories(prev => prev.map(m => m.id === memory.id ? result.memory : m))
    } catch (error) {
      console.error('切换记忆状态失败:', error)
      alert('操作失败，请重试')
    }
  }

  // 更新任务状态
  const handleUpdateTaskStatus = async (memory: MemoryEntry, newStatus: 'pending' | 'in_progress' | 'completed' | 'cancelled') => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('用户未登录')

      const updatedMetadata = {
        ...memory.metadata,
        status: newStatus
      }

      const response = await fetch('/api/chat/memory', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          memoryId: memory.id,
          updates: {
            metadata: updatedMetadata
          }
        })
      })

      if (!response.ok) throw new Error('更新任务状态失败')

      const result = await response.json()

      setMemories(prev => prev.map(m => m.id === memory.id ? result.memory : m))
    } catch (error) {
      console.error('更新任务状态失败:', error)
      alert('操作失败，请重试')
    }
  }

  // 根据记忆类型获取图标
  const getMemoryIcon = (type: string) => {
    switch (type) {
      case 'character': return <Users className="w-4 h-4" />
      case 'event': return <Calendar className="w-4 h-4" />
      case 'setting': return <MapPin className="w-4 h-4" />
      case 'emotion': return <Heart className="w-4 h-4" />
      case 'spacetime': return <Clock className="w-4 h-4" />
      case 'relationship': return <Users className="w-4 h-4" />
      case 'task': return <CheckSquare className="w-4 h-4" />
      case 'item': return <Package className="w-4 h-4" />
      default: return <FileText className="w-4 h-4" />
    }
  }

  // 根据记忆类型获取颜色
  const getMemoryColor = (type: string) => {
    switch (type) {
      case 'character': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'event': return 'bg-green-100 text-green-800 border-green-200'
      case 'setting': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'emotion': return 'bg-pink-100 text-pink-800 border-pink-200'
      case 'spacetime': return 'bg-indigo-100 text-indigo-800 border-indigo-200'
      case 'relationship': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'task': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'item': return 'bg-teal-100 text-teal-800 border-teal-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // 将消息ID转换为序号
  const getMessageIndexById = (messageId: number): number => {
    const message = allMessages.find(m => m.id === messageId)
    return message ? message.index : messageId
  }

  // 将序号转换为消息ID
  const getMessageIdByIndex = (index: number): number | null => {
    const message = allMessages.find(m => m.index === index)
    return message ? message.id : null
  }

  // 获取记忆类型的中文名称
  const getMemoryTypeName = (type: string) => {
    const typeNames: Record<string, string> = {
      character: '人物记忆',
      event: '事件记忆',
      setting: '设定记忆',
      emotion: '情感记忆',
      spacetime: '时空记忆',
      relationship: '关系记忆',
      task: '任务约定',
      item: '重要物品'
    }
    return typeNames[type] || type
  }

  // 筛选和排序记忆
  const filteredAndSortedMemories = memories
    .filter(memory => {
      // 类型筛选
      if (!selectedMemoryTypes.includes(memory.type)) return false
      
      // 搜索筛选
      if (memorySearchTerm) {
        const searchLower = memorySearchTerm.toLowerCase()
        return memory.title.toLowerCase().includes(searchLower) ||
               memory.content.toLowerCase().includes(searchLower)
      }
      
      return true
    })
    .sort((a, b) => {
      switch (memorySortBy) {
        case 'importance':
          return b.importance - a.importance
        case 'created_at':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'type':
          return a.type.localeCompare(b.type)
        default:
          return 0
      }
    })

  // 按类型分组记忆
  const memoriesByType = filteredAndSortedMemories.reduce((groups, memory) => {
    if (!groups[memory.type]) {
      groups[memory.type] = []
    }
    groups[memory.type].push(memory)
    return groups
  }, {} as Record<string, MemoryEntry[]>)

  // 获取记忆统计信息
  const memoryStats = {
    total: memories.length,
    byType: memories.reduce((stats, memory) => {
      stats[memory.type] = (stats[memory.type] || 0) + 1
      return stats
    }, {} as Record<string, number>),
    averageImportance: memories.length > 0 
      ? Math.round(memories.reduce((sum, m) => sum + m.importance, 0) / memories.length * 10) / 10
      : 0
  }

  // 验证摘要生成顺序 - 基于实际消息序号而非ID
  const validateSummarySequence = (startMessageId: number, endMessageId: number): { valid: boolean; message: string } => {
    if (!summaries.length) {
      // 如果没有任何摘要，可以生成第一个摘要
      return { valid: true, message: '' }
    }

    // 获取要生成的消息范围的序号
    const startIndex = getMessageIndexById(startMessageId)
    const endIndex = getMessageIndexById(endMessageId)

    if (!startIndex || !endIndex) {
      return { valid: false, message: '无法找到对应的消息序号' }
    }

    // 检查是否存在覆盖当前范围之前的连续摘要（基于序号）
    const sortedSummaries = [...summaries]
      .filter(s => s.start_message_id && s.end_message_id)
      .map(s => ({
        ...s,
        startIndex: getMessageIndexById(s.start_message_id!),
        endIndex: getMessageIndexById(s.end_message_id!)
      }))
      .filter(s => s.startIndex && s.endIndex)
      .sort((a, b) => (a.startIndex || 0) - (b.startIndex || 0))

    // 如果要生成的摘要不是从第1条开始，检查是否有前置摘要
    if (startIndex > 1) {
      // 找到结束位置最接近startIndex的摘要
      const precedingSummaries = sortedSummaries.filter(s => (s.endIndex || 0) < startIndex)

      if (precedingSummaries.length > 0) {
        const latestPrecedingEnd = Math.max(...precedingSummaries.map(s => s.endIndex || 0))

        // 检查是否存在未覆盖的消息（空隙）
        // 只有当空隙超过1条消息时才认为是真正的空隙（允许跳过1-2条消息）
        const gap = startIndex - latestPrecedingEnd - 1
        if (gap > 2) {
          return {
            valid: false,
            message: `请先生成前面的摘要。当前最新摘要覆盖到第${latestPrecedingEnd}条消息，您尝试生成第${startIndex}-${endIndex}条消息的摘要，中间有${gap}条消息未覆盖。建议先生成第${latestPrecedingEnd + 1}条开始的摘要。`
          }
        }
      }
    }

    // 检查是否与现有摘要重叠
    const hasOverlap = summaries.some(s =>
      s.start_message_id && s.end_message_id &&
      (startMessageId <= s.end_message_id && endMessageId >= s.start_message_id)
    )

    if (hasOverlap) {
      return {
        valid: false,
        message: '所选范围与现有摘要重叠，请选择不同的范围或先删除重叠的摘要。'
      }
    }

    return { valid: true, message: '' }
  }

  // 根据摘要的聊天范围排序记忆表格
  const sortMemoriesBySummaryRange = (summaries: ChatSummary[], memories: any[]) => {
    if (!summaries.length || !memories.length) return

    // 创建摘要ID到起始消息ID的映射
    const summaryRangeMap = new Map<number, number>()
    summaries.forEach(summary => {
      if (summary.start_message_id) {
        summaryRangeMap.set(summary.id, summary.start_message_id)
      }
    })

    // 排序记忆表格：
    // 1. 有summary_id的记忆按对应摘要的start_message_id升序排列
    // 2. 没有summary_id的记忆按importance降序排列，放在最后
    const sortedMemories = [...memories].sort((a, b) => {
      const aHasSummary = a.summary_id && summaryRangeMap.has(a.summary_id)
      const bHasSummary = b.summary_id && summaryRangeMap.has(b.summary_id)

      if (aHasSummary && bHasSummary) {
        // 都有摘要ID，按摘要的起始消息ID排序
        const aStartId = summaryRangeMap.get(a.summary_id)!
        const bStartId = summaryRangeMap.get(b.summary_id)!
        if (aStartId !== bStartId) {
          return aStartId - bStartId // 早期摘要的记忆排在前面
        }
        // 同一摘要内按重要性排序
        return b.importance - a.importance
      } else if (aHasSummary && !bHasSummary) {
        return -1 // 有摘要的排在前面
      } else if (!aHasSummary && bHasSummary) {
        return 1 // 有摘要的排在前面
      } else {
        // 都没有摘要ID，按重要性排序
        return b.importance - a.importance
      }
    })

    console.log('🔄 记忆表格已按摘要范围重新排序')
    setMemories(sortedMemories)
  }

  // 计算建议的摘要范围
  // 计算智能上下文状态
  const calculateContextStatus = async () => {
    if (!user || !sessionId) return

    try {
      // 获取摘要覆盖范围
      const { data: summaries, error } = await supabase
        .from('chat_summaries')
        .select('start_message_id, end_message_id')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .not('start_message_id', 'is', null)
        .not('end_message_id', 'is', null)
        .order('start_message_id', { ascending: true })

      if (error || !summaries) {
        console.warn('获取摘要覆盖范围失败:', error)
        return
      }

      // 合并重叠或连续的范围
      const ranges: {start: number, end: number}[] = []
      for (const summary of summaries) {
        const newRange = { start: summary.start_message_id, end: summary.end_message_id }

        let merged = false
        for (let i = 0; i < ranges.length; i++) {
          const existingRange = ranges[i]
          if (newRange.start <= existingRange.end + 1 && newRange.end >= existingRange.start - 1) {
            ranges[i] = {
              start: Math.min(existingRange.start, newRange.start),
              end: Math.max(existingRange.end, newRange.end)
            }
            merged = true
            break
          }
        }

        if (!merged) {
          ranges.push(newRange)
        }
      }

      ranges.sort((a, b) => a.start - b.start)

      // 计算覆盖的消息数量
      const coveredMessageIds = new Set<number>()
      for (const range of ranges) {
        for (let id = range.start; id <= range.end; id++) {
          coveredMessageIds.add(id)
        }
      }

      const totalMessages = messageCount
      const coveredMessages = Math.min(coveredMessageIds.size, totalMessages)
      const uncoveredMessages = totalMessages - coveredMessages

      setContextStatus({
        totalMessages,
        coveredMessages,
        uncoveredMessages,
        coverageRanges: ranges
      })

      console.log('🧠 智能上下文状态:', {
        totalMessages,
        coveredMessages,
        uncoveredMessages,
        coverageRanges: ranges
      })

    } catch (error) {
      console.error('计算智能上下文状态失败:', error)
    }
  }

  const calculateSummaryRanges = async () => {
    if (!user) return

    try {
      // 获取消息总数
      const { count: totalCount } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sessionId)

      if (!totalCount || totalCount === 0) {
        setSummaryRanges([])
        return
      }

      // 分批获取所有消息ID（每批1000条）
      const allMessages: { id: number }[] = []
      const batchSize = 1000
      const batches = Math.ceil(totalCount / batchSize)

      for (let i = 0; i < batches; i++) {
        const { data: batchData } = await supabase
          .from('chat_messages')
          .select('id')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true })
          .range(i * batchSize, (i + 1) * batchSize - 1)

        if (batchData) {
          allMessages.push(...batchData)
        }
      }

      console.log(`📊 扫描范围: 加载了 ${allMessages.length} / ${totalCount} 条消息ID`)

      if (allMessages.length === 0) {
        setSummaryRanges([])
        return
      }

      // 获取已有摘要覆盖的消息范围
      const summarizedRanges: {start: number, end: number}[] = []
      summaries.forEach(summary => {
        if (summary.start_message_id && summary.end_message_id) {
          summarizedRanges.push({
            start: summary.start_message_id,
            end: summary.end_message_id
          })
        }
      })

      // 找出未被摘要的消息段
      const unsummarizedRanges: {start: number, end: number, count: number}[] = []
      let currentStart: number | null = allMessages[0].id

      for (let i = 0; i < allMessages.length; i++) {
        const messageId = allMessages[i].id
        const isInSummarizedRange = summarizedRanges.some(range =>
          messageId >= range.start && messageId <= range.end
        )

        if (isInSummarizedRange && currentStart !== null) {
          // 结束当前未摘要段
          if (i > 0) {
            const segmentStart = currentStart
            const segmentEnd = allMessages[i - 1].id
            const count = i - allMessages.findIndex(m => m.id === segmentStart)

            if (count >= summaryThreshold) {
              unsummarizedRanges.push({
                start: segmentStart,
                end: segmentEnd,
                count
              })
            }
          }
          currentStart = null
        } else if (!isInSummarizedRange && currentStart === null) {
          // 开始新的未摘要段
          currentStart = messageId
        }
      }

      // 处理最后一段
      if (currentStart !== null) {
        const lastIndex = allMessages.length - 1
        const startIndex = allMessages.findIndex(m => m.id === currentStart)
        const count = lastIndex - startIndex + 1

        if (count >= summaryThreshold) {
          unsummarizedRanges.push({
            start: currentStart,
            end: allMessages[lastIndex].id,
            count
          })
        }
      }

      setSummaryRanges(unsummarizedRanges)
    } catch (error) {
      console.error('计算摘要范围失败:', error)
      setSummaryRanges([])
    }
  }

  // 手动生成摘要
  // 验证手动输入的范围
  const validateManualRange = (start: string, end: string) => {
    const startNum = parseInt(start)
    const endNum = parseInt(end)

    // 基础验证
    if (!start || !end) {
      return { valid: false, message: '请输入起始和结束消息序号' }
    }

    if (isNaN(startNum) || isNaN(endNum)) {
      return { valid: false, message: '请输入有效的数字' }
    }

    if (startNum >= endNum) {
      return { valid: false, message: '起始序号必须小于结束序号' }
    }

    if (startNum < 1 || endNum > messageCount) {
      return { valid: false, message: `序号范围应在 1-${messageCount} 之间` }
    }

    if (endNum - startNum < 2) {
      return { valid: false, message: '最少需要选择2条消息' }
    }

    // 检查是否与已有摘要范围重叠
    for (const summary of summaries) {
      if (summary.start_message_id && summary.end_message_id) {
        const summaryStartIndex = getMessageIndexById(summary.start_message_id)
        const summaryEndIndex = getMessageIndexById(summary.end_message_id)

        // 检查是否有重叠
        if ((startNum >= summaryStartIndex && startNum <= summaryEndIndex) ||
            (endNum >= summaryStartIndex && endNum <= summaryEndIndex) ||
            (startNum <= summaryStartIndex && endNum >= summaryEndIndex)) {
          return {
            valid: false,
            message: `与现有摘要范围重叠 (第 ${summaryStartIndex}-${summaryEndIndex} 条消息)`
          }
        }
      }
    }

    // 获取对应的消息ID范围（需要转换序号为消息ID）
    const startMessageId = getMessageIdByIndex(startNum)
    const endMessageId = getMessageIdByIndex(endNum)

    if (!startMessageId || !endMessageId) {
      return { valid: false, message: '无法找到对应的消息ID' }
    }

    // 检查摘要生成顺序
    const sequenceValidation = validateSummarySequence(startMessageId, endMessageId)
    if (!sequenceValidation.valid) {
      return sequenceValidation
    }

    return { valid: true, message: '范围有效' }
  }


  // 获取当前选择的模型
  const getCurrentModel = () => {
    // 优先使用保存在localStorage中的模型选择
    const savedModel = localStorage.getItem(`chat_model_${sessionId}`)
    if (savedModel && availableModels.includes(savedModel)) {
      return savedModel
    }
    // 其次使用Redux store中的选择
    if (selectedModel && availableModels.includes(selectedModel)) {
      return selectedModel
    }
    // 最后使用第一个可用模型
    return availableModels[0] || 'gemini-2.5-flash'
  }

  // 手动范围输入变化处理
  const handleManualRangeChange = (start: string, end: string) => {
    setManualStartRange(start)
    setManualEndRange(end)
    setRangeValidation(validateManualRange(start, end))
  }

  // 生成手动范围摘要
  const handleGenerateManualSummary = async () => {
    const validation = validateManualRange(manualStartRange, manualEndRange)
    if (!validation.valid) {
      alert(validation.message)
      return
    }

    const startNum = parseInt(manualStartRange)
    const endNum = parseInt(manualEndRange)

    // 将序号转换为消息ID
    const startMessageId = getMessageIdByIndex(startNum)
    const endMessageId = getMessageIdByIndex(endNum)

    if (!startMessageId || !endMessageId) {
      alert('无法找到对应的消息')
      return
    }

    await handleGenerateSummary(startMessageId, endMessageId)

    // 清空输入
    setManualStartRange('')
    setManualEndRange('')
    setRangeValidation({ valid: true, message: '' })
  }

  const handleGenerateSummary = async (startMessageId: number, endMessageId: number) => {
    if (!availableModels.length) {
      alert('没有可用的AI模型，请检查API配置')
      return
    }

    // 检查摘要生成顺序
    const canGenerate = validateSummarySequence(startMessageId, endMessageId)
    if (!canGenerate.valid) {
      alert(canGenerate.message)
      return
    }

    const currentModel = getCurrentModel()

    let modelConfig
    try {
      modelConfig = getModelConfig(currentModel)
    } catch (error) {
      console.error('❌ 获取模型配置失败:', error)
      alert(error instanceof Error ? error.message : '模型配置错误')
      return
    }

    if (!modelConfig.apiKey) {
      alert('没有可用的API密钥，请检查配置')
      return
    }

    console.log('🎯 记忆管理生成摘要使用模型:', currentModel)

    setIsGeneratingSummary(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('用户未登录')

      // 构建请求头，包含中转API配置
      const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'x-api-key': modelConfig.apiKey,
        'x-model': currentModel,
      }

      // 如果是中转API，添加额外的headers
      if (modelConfig.isRelay) {
        headers['x-base-url'] = modelConfig.baseUrl || ''
        headers['x-actual-model'] = modelConfig.modelName || ''
      }

      // 添加thinking budget参数（如果支持）
      if (currentModel.includes('gemini-2.5')) {
        // 对于Gemini 2.5系列，添加thinking budget
        headers['x-thinking-budget'] = '0' // 使用auto模式
      }

      const response = await fetch('/api/chat/summary', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionId,
          userId: user!.id,
          startMessageId,
          endMessageId,
          characterName: currentCharacter?.name || '角色',
          useMemoryTable: useMemoryTableFormat
        })
      })

      if (!response.ok) throw new Error('生成摘要失败')

      const result = await response.json()

      // 更新摘要列表
      if (result.summary) {
        setSummaries(prev => [result.summary, ...prev])
      }

      // 更新记忆表格
      if (result.memories && result.memories.length > 0) {
        setMemories(prev => [...result.memories, ...prev])
      }

      // 重新计算摘要范围和智能上下文状态
      await calculateSummaryRanges()
      await calculateContextStatus()

      alert('摘要生成成功！')

    } catch (error) {
      console.error('生成摘要失败:', error)
      alert('生成失败，请重试')
    } finally {
      setIsGeneratingSummary(false)
    }
  }

  // 删除摘要（软删除 + 版本回退）
  const handleDeleteSummary = async (summaryId: number) => {
    if (!confirm('确定要删除这个摘要吗？\n\n⚠️ 删除后：\n1. 摘要将被隐藏\n2. 被此摘要更新的记忆将回退到上一版本\n3. 智能上下文将重新计算覆盖范围\n\n💡 提示：所有数据都会保留，可以恢复')) return

    try {
      console.log(`🗑️ 开始删除摘要: ${summaryId}`)

      // 1. 查找所有 summary_id = summaryId 的记忆
      const { data: affectedMemories } = await supabase
        .from('chat_memories')
        .select('id, title, current_version, summary_id')
        .eq('summary_id', summaryId)
        .eq('user_id', user!.id)

      console.log(`📊 找到 ${affectedMemories?.length || 0} 个受影响的记忆`)

      // 2. 对每个记忆进行处理
      if (affectedMemories && affectedMemories.length > 0) {
        for (const memory of affectedMemories) {
          const currentVersion = memory.current_version || 1

          if (currentVersion > 1) {
            // 情况A：有历史版本，回退到上一版本
            console.log(`🔄 回退记忆 ${memory.id} 从 v${currentVersion} 到 v${currentVersion - 1}`)

            // 查找上一个版本
            const { data: previousVersion } = await supabase
              .from('chat_memory_versions')
              .select('*')
              .eq('memory_id', memory.id)
              .eq('version', currentVersion - 1)
              .single()

            if (previousVersion) {
              // 回退到上一版本的内容
              const { error: revertError } = await supabase
                .from('chat_memories')
                .update({
                  title: previousVersion.title,
                  content: previousVersion.content,
                  importance: previousVersion.importance,
                  metadata: previousVersion.metadata,
                  summary_id: previousVersion.summary_id,
                  current_version: currentVersion - 1,
                  start_message_id: previousVersion.start_message_id,
                  end_message_id: previousVersion.end_message_id,
                  updated_at: new Date().toISOString()
                })
                .eq('id', memory.id)
                .eq('user_id', user!.id)

              if (revertError) {
                console.error(`回退记忆 ${memory.id} 失败:`, revertError)
              } else {
                console.log(`✅ 成功回退记忆: ${memory.title} 到 v${currentVersion - 1}`)
              }

              // 删除当前版本的历史记录
              await supabase
                .from('chat_memory_versions')
                .delete()
                .eq('memory_id', memory.id)
                .eq('version', currentVersion)
            } else {
              console.warn(`⚠️ 找不到 ${memory.id} 的 v${currentVersion - 1} 版本，禁用记忆`)
              // 找不到历史版本，禁用记忆
              await supabase
                .from('chat_memories')
                .update({ is_enabled: false })
                .eq('id', memory.id)
                .eq('user_id', user!.id)
            }
          } else {
            // 情况B：这是第一个版本（由此摘要创建），禁用记忆
            console.log(`🗑️ 禁用记忆 ${memory.id} (v1, 由此摘要创建)`)
            await supabase
              .from('chat_memories')
              .update({ is_enabled: false })
              .eq('id', memory.id)
              .eq('user_id', user!.id)
          }
        }
      }

      // 3. 标记摘要为不活跃（软删除）
      const { error: updateError } = await supabase
        .from('chat_summaries')
        .update({ is_active: false })
        .eq('id', summaryId)
        .eq('user_id', user!.id)

      if (updateError) {
        console.error('标记摘要失败:', updateError)
        throw updateError
      }

      console.log(`✅ 摘要已标记为不活跃: ${summaryId}`)

      // 4. 刷新界面
      const summaryData = await getSummaries(sessionId, user!.id)
      setSummaries(summaryData as ChatSummary[])

      const { data: memoryData } = await supabase
        .from('chat_memories')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', user!.id)
        .eq('is_enabled', true)

      if (memoryData) {
        setMemories(memoryData)
      }

      await calculateSummaryRanges()
      await calculateContextStatus()

      alert('摘要删除成功！\n\n✨ 记忆已回退到上一版本')
    } catch (error) {
      console.error('删除摘要失败:', error)
      alert('删除失败，请重试')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 mx-auto animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
          <p className="text-slate-600">加载记忆管理器...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      {/* 固定头部 */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/chat/${sessionId}`)}
              className="p-2 h-8 w-8"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center space-x-2">
              <Brain className="w-5 h-5 text-purple-600" />
              <h1 className="text-lg font-semibold">记忆管理器</h1>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              onClick={() => setShowAddMemoryDialog(true)}
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Plus className="w-4 h-4 mr-1" />
              添加记忆
            </Button>
          </div>
        </div>
      </div>

      {/* 主内容区域 - 可滚动 */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <div className="container mx-auto px-4 py-6 max-w-6xl">
        <Tabs defaultValue="summaries" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="summaries" className="flex items-center space-x-2">
              <FileText className="w-4 h-4" />
              <span>对话摘要</span>
            </TabsTrigger>
            <TabsTrigger value="memories" className="flex items-center space-x-2">
              <Table className="w-4 h-4" />
              <span>记忆表格</span>
            </TabsTrigger>
            <TabsTrigger value="control" className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4" />
              <span>摘要控制</span>
            </TabsTrigger>
          </TabsList>

          {/* 摘要管理标签页 */}
          <TabsContent value="summaries">
            <div className="space-y-4">
              {summaries.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center">
                    <FileText className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                      还没有对话摘要
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400">
                      当对话达到一定长度时，系统会自动生成摘要
                    </p>
                  </CardContent>
                </Card>
              ) : (
                summaries.map((summary, index) => (
                  <Card key={summary.id} className="relative">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            摘要 #{index + 1}
                          </Badge>
                          {summary.start_message_id && summary.end_message_id ? (
                            <Badge variant="secondary" className="text-xs">
                              第 {getMessageIndexById(summary.start_message_id)} - {getMessageIndexById(summary.end_message_id)} 条消息
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              范围未知
                            </Badge>
                          )}
                          <Badge variant={summary.summary_level === 1 ? "default" : "secondary"}>
                            {summary.summary_level === 1 ? '普通摘要' : '压缩摘要'}
                          </Badge>
                          {summary.is_active ? (
                            <Badge className="bg-green-100 text-green-800">活跃</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-100 text-gray-600">已归档</Badge>
                          )}
                        </div>

                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditSummary(summary.id, summary.content)}
                            className="text-blue-600 hover:text-blue-700"
                            title="编辑摘要"
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRegenerateSummary(summary.id)}
                            disabled={isRegenerating === summary.id}
                            className="text-green-600 hover:text-green-700"
                            title="重新生成摘要"
                          >
                            <RefreshCw className={`w-4 h-4 ${isRegenerating === summary.id ? 'animate-spin' : ''}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSummary(summary.id)}
                            className="text-red-600 hover:text-red-700"
                            title="删除摘要"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent>
                      {editingSummary === summary.id ? (
                        <div className="space-y-4">
                          <Textarea
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            className="min-h-[120px]"
                            placeholder="编辑摘要内容..."
                          />
                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingSummary(null)
                                setEditingContent('')
                              }}
                            >
                              <X className="w-4 h-4 mr-1" />
                              取消
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleSaveSummary}
                            >
                              <Save className="w-4 h-4 mr-1" />
                              保存
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                            {summary.content}
                          </p>
                          <div className="text-xs text-slate-500 border-t pt-2">
                            创建时间: {new Date(summary.created_at).toLocaleString()}
                            {summary.updated_at !== summary.created_at && (
                              <span className="ml-4">
                                更新时间: {new Date(summary.updated_at).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* 记忆表格标签页 */}
          <TabsContent value="memories">
            <div className="space-y-6">
              {memories.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center">
                    <Table className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                      记忆表格为空
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 mb-4">
                      记忆表格会自动从对话中提取，或者您可以手动添加重要记忆
                    </p>
                    <Button
                      onClick={() => setShowAddMemoryDialog(true)}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      添加第一个记忆
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* 简化的记忆概览 */}
                  <Card className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200">
                    <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-purple-100 dark:bg-purple-800 rounded-lg">
                            <BarChart3 className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                            <div className="text-sm font-medium text-slate-700 dark:text-slate-300">记忆概览</div>
                            <div className="text-xs text-slate-500">
                              共 {memoryStats.total} 条记忆，显示 {filteredAndSortedMemories.length} 条
                            </div>
                          </div>
                        </div>
                        
                        {/* 类型快速筛选 */}
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(memoryStats.byType).slice(0, 4).map(([type, count]) => (
                            <Button
                              key={type}
                              variant={selectedMemoryTypes.includes(type) ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                if (selectedMemoryTypes.includes(type)) {
                                  setSelectedMemoryTypes(prev => prev.filter(t => t !== type))
                                } else {
                                  setSelectedMemoryTypes([type])
                                }
                              }}
                              className="h-7 px-2 text-xs"
                            >
                              {getMemoryIcon(type)}
                              <span className="ml-1">{count}</span>
                            </Button>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 简化的搜索和筛选 */}
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex flex-col md:flex-row gap-4">
                        {/* 搜索框 */}
                        <div className="flex-1 relative">
                          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                          <Input
                            placeholder="搜索记忆内容..."
                            value={memorySearchTerm}
                            onChange={(e) => setMemorySearchTerm(e.target.value)}
                            className="pl-10"
                          />
                        </div>

                        {/* 排序选择 */}
                        <div className="flex items-center space-x-2">
                          <SortDesc className="w-4 h-4 text-slate-500" />
                          <select
                            value={memorySortBy}
                            onChange={(e) => setMemorySortBy(e.target.value as any)}
                            className="text-sm border border-slate-300 rounded px-3 py-2 bg-white"
                          >
                            <option value="importance">按重要度</option>
                            <option value="created_at">按时间</option>
                            <option value="type">按类型</option>
                          </select>
                        </div>

                        {/* 快速操作 */}
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedMemoryTypes(['character', 'event', 'setting', 'emotion', 'spacetime', 'relationship', 'task', 'item'])}
                            className="text-xs"
                          >
                            全部
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedMemoryTypes([])}
                            className="text-xs"
                          >
                            清空
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 记忆展示区域 */}
                  {filteredAndSortedMemories.length === 0 ? (
                    <Card>
                      <CardContent className="pt-6 text-center">
                        <Search className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                          没有找到匹配的记忆
                        </h3>
                        <p className="text-slate-600 dark:text-slate-400">
                          尝试调整搜索条件或筛选设置
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-6">
                      {Object.entries(memoriesByType).map(([type, typeMemories]) => (
                        <div key={type}>
                          <div className="flex items-center space-x-3 mb-4">
                            <div className={`p-2 rounded-lg ${getMemoryColor(type)}`}>
                              {getMemoryIcon(type)}
                            </div>
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                              {getMemoryTypeName(type)}
                            </h3>
                            <Badge variant="secondary">{typeMemories.length}</Badge>
                          </div>
                          
                          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {typeMemories.map((memory) => (
                              <Card key={memory.id} className="relative group hover:shadow-md transition-shadow">
                                <CardContent className="p-4">
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-medium text-sm text-slate-800 dark:text-slate-200 mb-1 truncate">
                                        {memory.title}
                                      </h4>
                                      <div className="flex items-center space-x-2 mb-2">
                                        <span className="text-xs text-slate-500">重要度 {memory.importance}</span>
                                        <div className="flex">
                                          {Array.from({length: Math.min(memory.importance, 5)}).map((_, i) => (
                                            <div key={i} className="w-1 h-1 bg-yellow-400 rounded-full mr-0.5" />
                                          ))}
                                        </div>
                            </div>
                          </div>

                                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditMemory(memory)}
                                        className="text-blue-600 hover:text-blue-700 h-6 w-6 p-0"
                                        title="编辑记忆"
                                      >
                                        <Edit3 className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleToggleMemoryEnabled(memory)}
                                        className={`h-6 w-6 p-0 ${(memory.metadata?.is_enabled ?? true) ? 'text-green-600 hover:text-green-700' : 'text-gray-400 hover:text-gray-500'}`}
                                        title={(memory.metadata?.is_enabled ?? true) ? '点击禁用' : '点击启用'}
                                      >
                                        {(memory.metadata?.is_enabled ?? true) ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteMemory(memory.id)}
                                        className="text-red-600 hover:text-red-700 h-6 w-6 p-0"
                                        title="删除记忆"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                        </div>
                                  <p className="text-sm text-slate-700 dark:text-slate-300 mb-2 line-clamp-2">
                          {memory.content}
                        </p>
                                  
                                  {/* 显示metadata信息 - 只显示有内容的字段 */}
                                  {memory.metadata && Object.keys(memory.metadata).length > 0 && (
                                    <div className="space-y-1 text-xs text-slate-500">
                                      {/* 人物记忆 */}
                                      {memory.type === 'character' && (
                                        <div className="flex flex-wrap gap-2">
                                          {memory.metadata.name && (
                                            <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                                              👤 {memory.metadata.name}
                                            </span>
                                          )}
                                          {memory.metadata.relationship && (
                                            <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                                              🤝 {memory.metadata.relationship}
                                            </span>
                                          )}
                                          {memory.metadata.age && (
                                            <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                                              🎂 {memory.metadata.age}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      
                                      {/* 时空记忆 */}
                                      {memory.type === 'spacetime' && (
                                        <div className="flex flex-wrap gap-2">
                                          {memory.metadata.date && (
                                            <span className="inline-flex items-center px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs">
                                              📅 {memory.metadata.date}
                                            </span>
                                          )}
                                          {memory.metadata.location && (
                                            <span className="inline-flex items-center px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs">
                                              📍 {memory.metadata.location}
                                            </span>
                                          )}
                                          {memory.metadata.weather && (
                                            <span className="inline-flex items-center px-2 py-1 bg-sky-100 text-sky-700 rounded text-xs">
                                              🌤️ {memory.metadata.weather}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      
                                      {/* 关系记忆 */}
                                      {memory.type === 'relationship' && (
                                        <div className="flex flex-wrap gap-2">
                                          {memory.metadata.character_name && (
                                            <span className="inline-flex items-center px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">
                                              👤 {memory.metadata.character_name}
                                            </span>
                                          )}
                                          {memory.metadata.affection && (
                                            <span className="inline-flex items-center px-2 py-1 bg-pink-100 text-pink-700 rounded text-xs">
                                              💖 {memory.metadata.affection}/10
                                            </span>
                                          )}
                                          {memory.metadata.trust && (
                                            <span className="inline-flex items-center px-2 py-1 bg-cyan-100 text-cyan-700 rounded text-xs">
                                              🤝 信任 {memory.metadata.trust}/10
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      
                                      {/* 任务记忆 - 带状态切换 */}
                                      {memory.type === 'task' && (
                                        <div className="space-y-2">
                                          <div className="flex flex-wrap gap-2">
                                            {'scheduled_time' in memory.metadata && memory.metadata.scheduled_time && (
                                              <span className="inline-flex items-center px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">
                                                ⏰ {memory.metadata.scheduled_time}
                                              </span>
                                            )}
                                            {'priority' in memory.metadata && memory.metadata.priority && (
                                              <span className="inline-flex items-center px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">
                                                🔥 {memory.metadata.priority}
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <span className="text-xs text-slate-500 mr-2">状态:</span>
                                            <button
                                              onClick={() => handleUpdateTaskStatus(memory as TaskMemory, 'pending')}
                                              className={`px-2 py-1 rounded text-xs transition-colors ${
                                                memory.metadata.status === 'pending'
                                                  ? 'bg-gray-200 text-gray-800 font-medium'
                                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-150'
                                              }`}
                                            >
                                              ⏳ 待处理
                                            </button>
                                            <button
                                              onClick={() => handleUpdateTaskStatus(memory as TaskMemory, 'in_progress')}
                                              className={`px-2 py-1 rounded text-xs transition-colors ${
                                                memory.metadata.status === 'in_progress'
                                                  ? 'bg-blue-200 text-blue-800 font-medium'
                                                  : 'bg-blue-100 text-blue-600 hover:bg-blue-150'
                                              }`}
                                            >
                                              🔄 进行中
                                            </button>
                                            <button
                                              onClick={() => handleUpdateTaskStatus(memory as TaskMemory, 'completed')}
                                              className={`px-2 py-1 rounded text-xs transition-colors ${
                                                memory.metadata.status === 'completed'
                                                  ? 'bg-green-200 text-green-800 font-medium'
                                                  : 'bg-green-100 text-green-600 hover:bg-green-150'
                                              }`}
                                            >
                                              ✅ 已完成
                                            </button>
                                          </div>
                                        </div>
                                      )}

                                      {/* 旧的任务状态显示（保留作为fallback） - Disabled */}
                                      {/* {memory.type === 'task' && false && 'status' in memory.metadata && memory.metadata.status && (
                                        <div className="flex flex-wrap gap-2">
                                          {'status' in memory.metadata && memory.metadata.status && (
                                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                                              memory.metadata.status === 'completed' ? 'bg-green-100 text-green-700' :
                                              memory.metadata.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                              memory.metadata.status === 'pending' ? 'bg-gray-100 text-gray-700' :
                                              'bg-red-100 text-red-700'
                                            }`}>
                                              📊 {memory.metadata.status === 'completed' ? '已完成' :
                                                   memory.metadata.status === 'in_progress' ? '进行中' :
                                                   memory.metadata.status === 'pending' ? '待处理' : '已取消'}
                                            </span>
                                          )}
                                          {'priority' in memory.metadata && memory.metadata.priority && (
                                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                                              memory.metadata.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                                              memory.metadata.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                              memory.metadata.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                              'bg-gray-100 text-gray-700'
                                            }`}>
                                              🚨 {memory.metadata.priority === 'urgent' ? '紧急' :
                                                   memory.metadata.priority === 'high' ? '高' :
                                                   memory.metadata.priority === 'medium' ? '中' : '低'}
                                            </span>
                                          )}
                                        </div>
                                      )} */}
                                      
                                      {/* 物品记忆 */}
                                      {memory.type === 'item' && (
                                        <div className="flex flex-wrap gap-2">
                                          {memory.metadata.owner && (
                                            <span className="inline-flex items-center px-2 py-1 bg-teal-100 text-teal-700 rounded text-xs">
                                              👑 {memory.metadata.owner}
                                            </span>
                                          )}
                                          {memory.metadata.emotional_value && (
                                            <span className="inline-flex items-center px-2 py-1 bg-rose-100 text-rose-700 rounded text-xs">
                                              💝 情感价值 {memory.metadata.emotional_value}/10
                                            </span>
                                          )}
                                          {memory.metadata.location && (
                                            <span className="inline-flex items-center px-2 py-1 bg-violet-100 text-violet-700 rounded text-xs">
                                              📍 {memory.metadata.location}
                                            </span>
                                          )}
                                        </div>
                                      )}

                                      {/* 事件记忆 */}
                                      {memory.type === 'event' && (
                                        <div className="flex flex-wrap gap-2">
                                          {memory.metadata.time && (
                                            <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                                              ⏰ {memory.metadata.time}
                                            </span>
                                          )}
                                          {memory.metadata.location && (
                                            <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                                              📍 {memory.metadata.location}
                                            </span>
                                          )}
                                          {memory.metadata.emotion_intensity && (
                                            <span className="inline-flex items-center px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                                              💥 强度 {memory.metadata.emotion_intensity}/10
                                            </span>
                                          )}
                                        </div>
                                      )}

                                      {/* 情感记忆 */}
                                      {memory.type === 'emotion' && (
                                        <div className="flex flex-wrap gap-2">
                                          {memory.metadata.emotion_type && (
                                            <span className="inline-flex items-center px-2 py-1 bg-pink-100 text-pink-700 rounded text-xs">
                                              💭 {memory.metadata.emotion_type}
                                            </span>
                                          )}
                                          {memory.metadata.intensity && (
                                            <span className="inline-flex items-center px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                                              🔥 强度 {memory.metadata.intensity}/10
                                            </span>
                                          )}
                                          {memory.metadata.target && (
                                            <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                                              🎯 {memory.metadata.target}
                                            </span>
                                          )}
                                        </div>
                                      )}

                                      {/* 设定记忆 */}
                                      {memory.type === 'setting' && (
                                        <div className="flex flex-wrap gap-2">
                                          {memory.metadata.location && (
                                            <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                                              🏛️ {memory.metadata.location}
                                            </span>
                                          )}
                                          {memory.metadata.atmosphere && (
                                            <span className="inline-flex items-center px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs">
                                              🌟 {memory.metadata.atmosphere}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  <div className="text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100">
                          {new Date(memory.created_at).toLocaleDateString()}
                        </div>
                      </CardContent>
                    </Card>
                            ))}
                          </div>
                        </div>
                  ))}
                </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>

          {/* 摘要控制标签页 */}
          <TabsContent value="control">
            <div className="space-y-6">
              {/* 系统说明卡片 */}
              <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-blue-700">
                    <Brain className="w-5 h-5" />
                    <span>智能摘要系统</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm text-blue-700 dark:text-blue-300">
                    <p className="font-medium">这是什么？</p>
                    <ul className="space-y-2 ml-4">
                      <li>• <strong>对话摘要</strong>：将长对话压缩为关键信息，节省AI记忆</li>
                      <li>• <strong>记忆表格</strong>：自动提取人物、事件、设定、情感等结构化信息</li>
                      <li>• <strong>智能连续</strong>：新摘要会参考之前的内容，保持记忆连贯性</li>
                    </ul>
                    <p className="font-medium mt-4">为什么使用？</p>
                    <ul className="space-y-2 ml-4">
                      <li>• 长对话时AI不会忘记早期内容</li>
                      <li>• 节省API调用成本和时间</li>
                      <li>• 更好的角色扮演连续性</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* 摘要状态卡片 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <MessageSquare className="w-5 h-5 text-blue-600" />
                    <span>对话统计</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{messageCount}</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">总消息数</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{summaries.length}</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">已有摘要</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">{memories.length}</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">记忆条目</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 智能上下文状态 */}
              {contextStatus && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Brain className="w-5 h-5 text-indigo-600" />
                      <span>智能上下文状态</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* 覆盖统计 */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                          <div className="text-2xl font-bold text-indigo-600">{contextStatus.coveredMessages}</div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">已摘要消息</div>
                        </div>
                        <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                          <div className="text-2xl font-bold text-orange-600">{contextStatus.uncoveredMessages}</div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">未摘要消息</div>
                        </div>
                        <div className="text-center p-4 bg-teal-50 dark:bg-teal-900/20 rounded-lg">
                          <div className="text-2xl font-bold text-teal-600">
                            {contextStatus.totalMessages > 0 ? Math.round((contextStatus.coveredMessages / contextStatus.totalMessages) * 100) : 0}%
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">摘要覆盖率</div>
                        </div>
                      </div>

                      {/* 覆盖范围可视化 */}
                      {contextStatus.coverageRanges.length > 0 && (
                        <div className="border-t pt-4">
                          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">📊 摘要覆盖范围</h4>
                          <div className="space-y-2">
                            {contextStatus.coverageRanges.map((range, index) => (
                              <div key={index} className="flex items-center space-x-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <div className="w-4 h-4 bg-indigo-500 rounded-full flex-shrink-0"></div>
                                <div className="flex-1">
                                  <div className="text-sm font-medium">第 {getMessageIndexById(range.start)} - {getMessageIndexById(range.end)} 条消息</div>
                                  <div className="text-xs text-slate-600 dark:text-slate-400">
                                    包含 {getMessageIndexById(range.end) - getMessageIndexById(range.start) + 1} 条消息
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 智能提示 */}
                      <div className="border-t pt-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                          <div className="flex items-start space-x-2">
                            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-blue-800 dark:text-blue-200">
                              <p className="font-medium mb-1">智能上下文工作原理</p>
                              <p>
                                聊天时，AI只会接收到<strong>未被摘要覆盖的消息</strong>和<strong>摘要内容</strong>，
                                这样既节省了tokens成本，又保持了完整的记忆。
                              </p>
                              {contextStatus.uncoveredMessages > 50 && (
                                <p className="mt-2 text-amber-700 dark:text-amber-300">
                                  💡 建议：当前有 {contextStatus.uncoveredMessages} 条未摘要消息，可以考虑生成新摘要来优化性能。
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 摘要设置卡片 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Settings className="w-5 h-5 text-purple-600" />
                    <span>摘要设置</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="autoSummary"
                        checked={autoSummaryEnabled}
                        onChange={(e) => setAutoSummaryEnabled(e.target.checked)}
                        className="rounded"
                      />
                      <label htmlFor="autoSummary" className="text-sm font-medium">
                        启用自动摘要 (聊天时自动生成摘要)
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        摘要阈值 (每 {summaryThreshold} 条消息生成一个摘要)
                      </label>
                      <input
                        type="range"
                        min="20"
                        max="100"
                        step="5"
                        value={summaryThreshold}
                        onChange={(e) => setSummaryThreshold(parseInt(e.target.value))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>20</span>
                        <span>{summaryThreshold}条</span>
                        <span>100</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="useMemoryTable"
                      checked={useMemoryTableFormat}
                      onChange={(e) => setUseMemoryTableFormat(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="useMemoryTable" className="text-sm">
                      使用记忆表格格式（推荐）
                    </label>
                  </div>
                </CardContent>
              </Card>

              {/* 手动生成摘要卡片 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-yellow-600" />
                    <span>手动生成摘要</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      选择消息范围来生成摘要。系统会自动建议合适的摘要范围。
                    </p>

                    {/* 建议的摘要范围 */}
                    {summaryRanges.length > 0 ? (
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm text-green-700">💡 发现可摘要的对话段落：</h4>
                        {summaryRanges.map((range, index) => (
                          <div key={index} className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg border border-green-200">
                            <div className="flex items-center space-x-3">
                              <Clock className="w-4 h-4 text-green-600" />
                              <div>
                                <div className="text-sm font-medium">
                                  第 {getMessageIndexById(range.start)} - {getMessageIndexById(range.end)} 条消息
                                </div>
                                <div className="text-xs text-slate-600">
                                  包含 {range.count} 条对话 • 建议生成摘要
                                </div>
                              </div>
                            </div>
                            {(() => {
                              const validation = validateSummarySequence(range.start, range.end)
                              return (
                                <Button
                                  size="sm"
                                  onClick={() => handleGenerateSummary(range.start, range.end)}
                                  disabled={isGeneratingSummary || !validation.valid}
                                  className={`${
                                    validation.valid
                                      ? "bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
                                      : "bg-gray-400 cursor-not-allowed"
                                  } text-white border-0`}
                                  title={!validation.valid ? validation.message : "生成摘要"}
                                >
                                  {isGeneratingSummary ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      <Sparkles className="w-4 h-4 mr-1" />
                                      生成摘要
                                    </>
                                  )}
                                </Button>
                              )
                            })()}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <MessageSquare className="w-12 h-12 mx-auto text-slate-400 mb-3" />
                        <p className="text-slate-600 dark:text-slate-400 mb-2">暂无需要摘要的对话</p>
                        <p className="text-xs text-slate-500">
                          当对话超过 {summaryThreshold} 条消息时，会出现摘要建议
                        </p>
                      </div>
                    )}

                    {/* 手动选择范围 */}
                    <div className="border-t pt-4 mt-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium text-sm text-blue-700">✍️ 手动选择摘要范围</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowManualRange(!showManualRange)}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <ChevronRight className={`w-4 h-4 transition-transform ${showManualRange ? 'rotate-90' : ''}`} />
                          {showManualRange ? '收起' : '展开'}
                        </Button>
                      </div>

                      <AnimatePresence>
                        {showManualRange && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-4"
                          >
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200">
                              <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                                💡 手动输入消息序号范围，例如：1-100，101-200。已摘要的范围无法重复选择。
                              </p>

                              {/* 显示已摘要的范围 */}
                              {summaries.length > 0 && (
                                <div className="mb-3">
                                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">已摘要范围：</p>
                                  <div className="flex flex-wrap gap-2">
                                    {summaries
                                      .filter(s => s.start_message_id && s.end_message_id)
                                      .map((s, idx) => (
                                        <Badge key={idx} variant="outline" className="text-xs">
                                          {getMessageIndexById(s.start_message_id!)}-{getMessageIndexById(s.end_message_id!)}条
                                        </Badge>
                                      ))
                                    }
                                  </div>
                                </div>
                              )}

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    起始消息序号 (1-{messageCount})
                                  </label>
                                  <Input
                                    type="number"
                                    min="1"
                                    max={messageCount}
                                    value={manualStartRange}
                                    onChange={(e) => handleManualRangeChange(e.target.value, manualEndRange)}
                                    placeholder="例如：1"
                                    className={`text-sm ${!rangeValidation.valid ? 'border-red-300 focus:border-red-500' : ''}`}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    结束消息序号 (1-{messageCount})
                                  </label>
                                  <Input
                                    type="number"
                                    min="1"
                                    max={messageCount}
                                    value={manualEndRange}
                                    onChange={(e) => handleManualRangeChange(manualStartRange, e.target.value)}
                                    placeholder="例如：100"
                                    className={`text-sm ${!rangeValidation.valid ? 'border-red-300 focus:border-red-500' : ''}`}
                                  />
                                </div>
                              </div>

                              {/* 验证信息 */}
                              {manualStartRange && manualEndRange && (
                                <div className={`mt-3 p-2 rounded text-xs ${
                                  rangeValidation.valid
                                    ? 'bg-green-100 text-green-700 border border-green-200'
                                    : 'bg-red-100 text-red-700 border border-red-200'
                                }`}>
                                  {rangeValidation.valid ? (
                                    <span>✅ {rangeValidation.message} - 将生成 {parseInt(manualEndRange) - parseInt(manualStartRange) + 1} 条消息的摘要</span>
                                  ) : (
                                    <span>❌ {rangeValidation.message}</span>
                                  )}
                                </div>
                              )}

                              <div className="mt-4 flex justify-end">
                                <Button
                                  size="sm"
                                  onClick={handleGenerateManualSummary}
                                  disabled={!rangeValidation.valid || !manualStartRange || !manualEndRange || isGeneratingSummary}
                                  className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
                                >
                                  {isGeneratingSummary ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      <Sparkles className="w-4 h-4 mr-1" />
                                      生成手动摘要
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* 刷新建议按钮 */}
                    <div className="flex justify-center">
                      <Button
                        variant="outline"
                        onClick={calculateSummaryRanges}
                        className="flex items-center space-x-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>重新扫描对话</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
          </div>
        </div>
      </div>

      {/* 添加记忆对话框 */}
      <Dialog open={showAddMemoryDialog} onOpenChange={setShowAddMemoryDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Plus className="w-5 h-5" />
              <span>添加新记忆</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">记忆类型</label>
              <select
                value={newMemory.type}
                onChange={(e) => setNewMemory(prev => ({ ...prev, type: e.target.value as any }))}
                className="w-full p-2 border border-slate-300 rounded-md"
              >
                <option value="character">👤 人物记忆</option>
                <option value="event">📅 事件记忆</option>
                <option value="setting">🏛️ 设定记忆</option>
                <option value="emotion">💭 情感记忆</option>
                <option value="spacetime">⏰ 时空记忆</option>
                <option value="relationship">🤝 关系记忆</option>
                <option value="task">📋 任务约定</option>
                <option value="item">📦 重要物品</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">标题</label>
              <Input
                value={newMemory.title || ''}
                onChange={(e) => setNewMemory(prev => ({ ...prev, title: e.target.value }))}
                placeholder="为这个记忆起个标题..."
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">内容</label>
              <Textarea
                value={newMemory.content || ''}
                onChange={(e) => setNewMemory(prev => ({ ...prev, content: e.target.value }))}
                placeholder="记录详细内容..."
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                重要度 ({newMemory.importance}/10)
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={newMemory.importance || 5}
                onChange={(e) => setNewMemory(prev => ({ ...prev, importance: parseInt(e.target.value) }))}
                className="w-full"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="ghost"
                onClick={() => setShowAddMemoryDialog(false)}
              >
                取消
              </Button>
              <Button
                onClick={handleAddMemory}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Plus className="w-4 h-4 mr-1" />
                添加
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 编辑记忆对话框 */}
      <Dialog open={showEditMemoryDialog} onOpenChange={setShowEditMemoryDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Edit3 className="w-5 h-5" />
              <span>编辑记忆</span>
            </DialogTitle>
          </DialogHeader>

          {editingMemory && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">记忆类型</label>
                <div className="p-2 bg-slate-100 rounded-md text-sm">
                  {getMemoryTypeName(editingMemory.type)}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">标题</label>
                <Input
                  value={editingMemory.title || ''}
                  onChange={(e) => setEditingMemory(prev => prev ? { ...prev, title: e.target.value } : null)}
                  placeholder="为这个记忆起个标题..."
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">内容</label>
                <Textarea
                  value={editingMemory.content || ''}
                  onChange={(e) => setEditingMemory(prev => prev ? { ...prev, content: e.target.value } : null)}
                  placeholder="记录详细内容..."
                  rows={3}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  重要度 ({editingMemory.importance}/10)
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={editingMemory.importance || 5}
                  onChange={(e) => setEditingMemory(prev => prev ? { ...prev, importance: parseInt(e.target.value) } : null)}
                  className="w-full"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowEditMemoryDialog(false)
                    setEditingMemory(null)
                  }}
                >
                  取消
                </Button>
                <Button
                  onClick={handleSaveEditedMemory}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Save className="w-4 h-4 mr-1" />
                  保存
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, 
  Plus, 
  Filter, 
  Edit3, 
  Trash2, 
  Globe, 
  User, 
  Clock,
  Tag,
  ArrowLeft,
  Save,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  getPromptTemplates, 
  getUserTemplates, 
  savePromptTemplate, 
  updatePromptTemplate,
  deletePromptTemplate,
  getTemplateDefaultContent,
  createPresetTemplatesForUser
} from '../lib/promptTemplates'
import { type PromptTemplate } from '../lib/supabase'

const templateTypes = [
  { value: '用户角色设定', label: '用户角色设定', icon: User },
  { value: '注意事项', label: '注意事项', icon: Tag },
  { value: '初始情景', label: '初始情景', icon: Globe },
  { value: '特殊要求', label: '特殊要求', icon: Filter },
  { value: '自定义模块', label: '自定义模块', icon: Plus }
]

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'my' | 'all'>('my')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null)
  
  // 创建/编辑模板的表单状态
  const [templateForm, setTemplateForm] = useState({
    name: '',
    template_type: '用户角色设定',
    description: '',
    content: {} as Record<string, any>,
    is_public: false
  })

  // 加载模板列表
  const loadTemplates = async () => {
    try {
      setIsLoading(true)
      const data = viewMode === 'my' 
        ? await getUserTemplates(selectedType === 'all' ? undefined : selectedType)
        : await getPromptTemplates(selectedType === 'all' ? undefined : selectedType)
      setTemplates(data)
    } catch (error) {
      console.error('加载模板失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadTemplates()
  }, [viewMode, selectedType])

  // 重置表单
  const resetForm = () => {
    setTemplateForm({
      name: '',
      template_type: '用户角色设定',
      description: '',
      content: getTemplateDefaultContent('用户角色设定'),
      is_public: false
    })
  }

  // 打开创建对话框
  const handleCreateTemplate = () => {
    resetForm()
    setEditingTemplate(null)
    setShowCreateDialog(true)
  }

  // 打开编辑对话框
  const handleEditTemplate = (template: PromptTemplate) => {
    setTemplateForm({
      name: template.name,
      template_type: template.template_type,
      description: template.description || '',
      content: template.content,
      is_public: template.is_public
    })
    setEditingTemplate(template)
    setShowCreateDialog(true)
  }

  // 保存模板
  const handleSaveTemplate = async () => {
    if (!templateForm.name.trim()) {
      alert('请输入模板名称')
      return
    }

    try {
      if (editingTemplate) {
        // 更新模板
        await updatePromptTemplate(editingTemplate.id, {
          name: templateForm.name,
          content: templateForm.content,
          description: templateForm.description,
          is_public: templateForm.is_public
        })
      } else {
        // 创建新模板
        await savePromptTemplate(templateForm)
      }
      
      setShowCreateDialog(false)
      resetForm()
      setEditingTemplate(null)
      loadTemplates()
    } catch (error) {
      console.error('保存模板失败:', error)
      alert('保存模板失败，请重试')
    }
  }

  // 删除模板
  const handleDeleteTemplate = async (templateId: number) => {
    if (!confirm('确定要删除这个模板吗？')) return
    
    try {
      await deletePromptTemplate(templateId)
      loadTemplates()
    } catch (error) {
      console.error('删除模板失败:', error)
      alert('删除模板失败，请重试')
    }
  }

  // 初始化预置模板
  const handleCreatePresetTemplates = async () => {
    try {
      await createPresetTemplatesForUser()
      alert('预置模板创建成功！')
      loadTemplates()
    } catch (error) {
      console.error('创建预置模板失败:', error)
      alert('创建预置模板失败，请重试')
    }
  }

  // 更新模板类型时重置内容
  const handleTypeChange = (type: string) => {
    setTemplateForm(prev => ({
      ...prev,
      template_type: type,
      content: getTemplateDefaultContent(type)
    }))
  }

  // 更新模板内容
  const updateTemplateContent = (key: string, value: string) => {
    setTemplateForm(prev => ({
      ...prev,
      content: {
        ...prev.content,
        [key]: value
      }
    }))
  }

  // 过滤模板
  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // 渲染模板内容编辑器
  const renderContentEditor = () => {
    const { template_type, content } = templateForm
    
    if (template_type === '用户角色设定') {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>用户角色姓名</Label>
              <Input
                placeholder="用户角色姓名"
                value={content.userRoleName || ''}
                onChange={(e) => updateTemplateContent('userRoleName', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>用户角色年龄</Label>
              <Input
                placeholder="用户角色年龄"
                value={content.userRoleAge || ''}
                onChange={(e) => updateTemplateContent('userRoleAge', e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>用户角色性别</Label>
            <Select value={content.userRoleGender || ''} onValueChange={(value) => updateTemplateContent('userRoleGender', value)}>
              <SelectTrigger>
                <SelectValue placeholder="选择性别" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">男</SelectItem>
                <SelectItem value="female">女</SelectItem>
                <SelectItem value="none">无性别</SelectItem>
                <SelectItem value="other">其他</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>用户角色详细设定</Label>
            <Textarea
              placeholder="描述用户角色的详细信息..."
              value={content.userRoleDetails || ''}
              onChange={(e) => updateTemplateContent('userRoleDetails', e.target.value)}
              className="min-h-[120px] resize-none"
            />
          </div>
        </div>
      )
    } else if (template_type === '自定义模块') {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>模块名称</Label>
            <Input
              placeholder="自定义模块名称"
              value={content.name || ''}
              onChange={(e) => updateTemplateContent('name', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>模块内容</Label>
            <Textarea
              placeholder="输入模块内容..."
              value={content.content || ''}
              onChange={(e) => updateTemplateContent('content', e.target.value)}
              className="min-h-[120px] resize-none"
            />
          </div>
        </div>
      )
    } else {
      return (
        <div className="space-y-2">
          <Label>内容</Label>
          <Textarea
            placeholder="输入模板内容..."
            value={content.content || ''}
            onChange={(e) => updateTemplateContent('content', e.target.value)}
            className="min-h-[120px] resize-none"
          />
        </div>
      )
    }
  }

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
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="max-w-6xl mx-auto space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Prompt 模板库</CardTitle>
                <p className="text-slate-600 mt-1">管理和复用你的角色设定模板</p>
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" onClick={handleCreatePresetTemplates}>
                  <Plus className="w-4 h-4 mr-2" />
                  初始化预置模板
                </Button>
                <Button onClick={handleCreateTemplate}>
                  <Plus className="w-4 h-4 mr-2" />
                  创建模板
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="搜索模板..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Type Filter */}
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="选择类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有类型</SelectItem>
                  {templateTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* View Mode */}
              <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'my' | 'all')}>
                <TabsList>
                  <TabsTrigger value="my">我的模板</TabsTrigger>
                  <TabsTrigger value="all">所有模板</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Templates Grid */}
      <motion.div variants={itemVariants}>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-slate-500">加载中...</div>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Tag className="w-12 h-12 mx-auto mb-4 text-slate-400" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {searchQuery ? '没有找到匹配的模板' : '还没有模板'}
              </h3>
              <p className="text-slate-500 mb-6">
                {searchQuery ? '试试调整搜索条件' : '创建你的第一个模板，提高角色创建效率'}
              </p>
              {!searchQuery && (
                <Button onClick={handleCreateTemplate}>
                  <Plus className="w-4 h-4 mr-2" />
                  创建模板
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredTemplates.map((template, index) => {
                const TypeIcon = templateTypes.find(t => t.value === template.template_type)?.icon || Tag
                
                return (
                  <motion.div
                    key={template.id}
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="hover:shadow-lg transition-all duration-200 group">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                              <TypeIcon className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-slate-900 truncate">
                                {template.name}
                              </h4>
                              <p className="text-sm text-slate-500">
                                {template.template_type}
                              </p>
                            </div>
                          </div>
                          
                          {/* Actions */}
                          {template.user_id && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Edit3 className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => handleEditTemplate(template)}>
                                  <Edit3 className="w-4 h-4 mr-2" />
                                  编辑
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDeleteTemplate(template.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  删除
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>

                        {template.description && (
                          <p className="text-sm text-slate-600 line-clamp-2 mb-4">
                            {template.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <div className="flex items-center space-x-3">
                            {template.is_public ? (
                              <span className="flex items-center">
                                <Globe className="w-3 h-3 mr-1" />
                                公开
                              </span>
                            ) : (
                              <span className="flex items-center">
                                <User className="w-3 h-3 mr-1" />
                                私人
                              </span>
                            )}
                            {template.usage_count > 0 && (
                              <span className="flex items-center">
                                <Clock className="w-3 h-3 mr-1" />
                                使用 {template.usage_count} 次
                              </span>
                            )}
                          </div>
                          <span>
                            {new Date(template.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? '编辑模板' : '创建新模板'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="template-name">模板名称 *</Label>
                <Input
                  id="template-name"
                  placeholder="输入模板名称..."
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="template-type">模板类型 *</Label>
                <Select 
                  value={templateForm.template_type} 
                  onValueChange={handleTypeChange}
                  disabled={!!editingTemplate} // 编辑时不允许修改类型
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {templateTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-description">描述（可选）</Label>
              <Textarea
                id="template-description"
                placeholder="描述这个模板的用途..."
                value={templateForm.description}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                className="min-h-[80px] resize-none"
              />
            </div>

            {/* Content Editor */}
            <div className="space-y-2">
              <Label>模板内容</Label>
              {renderContentEditor()}
            </div>

            {/* Public Setting */}
            <div className="flex items-center space-x-2">
              <Switch
                id="template-public"
                checked={templateForm.is_public}
                onCheckedChange={(checked) => setTemplateForm(prev => ({ ...prev, is_public: checked }))}
              />
              <Label htmlFor="template-public" className="text-sm">
                公开模板（其他用户也可以使用）
              </Label>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                取消
              </Button>
              <Button onClick={handleSaveTemplate}>
                <Save className="w-4 h-4 mr-2" />
                {editingTemplate ? '更新' : '创建'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

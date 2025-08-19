'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Save, 
  Download, 
  Trash2, 
  Plus, 
  Search, 
  Clock, 
  User, 
  Globe,
  X,
  Check,
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
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
  savePromptTemplate, 
  deletePromptTemplate,
  incrementTemplateUsage,
  getTemplateDefaultContent,
  type PromptTemplate 
} from '../lib/promptTemplates'

interface TemplateManagerProps {
  templateType: string
  currentContent: Record<string, any>
  onLoadTemplate: (content: Record<string, any>) => void
  className?: string
}

export function TemplateManager({ 
  templateType, 
  currentContent, 
  onLoadTemplate,
  className = '' 
}: TemplateManagerProps) {
  const [templates, setTemplates] = useState<PromptTemplate[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showLoadDialog, setShowLoadDialog] = useState(false)
  
  // 保存模板的表单状态
  const [saveForm, setSaveForm] = useState({
    name: '',
    description: '',
    is_public: false
  })

  // 加载模板列表
  const loadTemplates = async () => {
    try {
      setIsLoading(true)
      const data = await getPromptTemplates(templateType)
      setTemplates(data)
    } catch (error) {
      console.error('加载模板失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadTemplates()
  }, [templateType])

  // 保存模板
  const handleSaveTemplate = async () => {
    if (!saveForm.name.trim()) {
      alert('请输入模板名称')
      return
    }

    try {
      await savePromptTemplate({
        name: saveForm.name,
        template_type: templateType,
        content: currentContent,
        description: saveForm.description,
        is_public: saveForm.is_public
      })
      
      setShowSaveDialog(false)
      setSaveForm({ name: '', description: '', is_public: false })
      loadTemplates() // 重新加载列表
    } catch (error) {
      console.error('保存模板失败:', error)
      alert('保存模板失败，请重试')
    }
  }

  // 加载模板
  const handleLoadTemplate = async (template: PromptTemplate) => {
    try {
      await incrementTemplateUsage(template.id)
      onLoadTemplate(template.content)
      setShowLoadDialog(false)
    } catch (error) {
      console.error('加载模板失败:', error)
    }
  }

  // 删除模板
  const handleDeleteTemplate = async (templateId: number) => {
    if (!confirm('确定要删除这个模板吗？')) return
    
    try {
      await deletePromptTemplate(templateId)
      loadTemplates() // 重新加载列表
    } catch (error) {
      console.error('删除模板失败:', error)
      alert('删除模板失败，请重试')
    }
  }

  // 过滤模板
  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // 检查当前内容是否为空
  const hasContent = () => {
    if (templateType === '用户角色设定') {
      return !!(currentContent.userRoleName || currentContent.userRoleAge || 
                currentContent.userRoleGender || currentContent.userRoleDetails)
    } else if (templateType === '自定义模块') {
      return !!(currentContent.name || currentContent.content)
    } else {
      return !!currentContent.content
    }
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* 保存模板按钮 */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasContent()}
            className="h-8 px-3 text-xs"
          >
            <Save className="w-3 h-3 mr-1.5" />
            保存为模板
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>保存为模板</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">模板名称 *</Label>
              <Input
                id="template-name"
                placeholder="输入模板名称..."
                value={saveForm.name}
                onChange={(e) => setSaveForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="template-description">描述（可选）</Label>
              <Textarea
                id="template-description"
                placeholder="描述这个模板的用途..."
                value={saveForm.description}
                onChange={(e) => setSaveForm(prev => ({ ...prev, description: e.target.value }))}
                className="min-h-[80px] resize-none"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="template-public"
                checked={saveForm.is_public}
                onCheckedChange={(checked) => setSaveForm(prev => ({ ...prev, is_public: checked }))}
              />
              <Label htmlFor="template-public" className="text-sm">
                公开模板（其他用户也可以使用）
              </Label>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                取消
              </Button>
              <Button onClick={handleSaveTemplate}>
                <Save className="w-4 h-4 mr-2" />
                保存
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 加载模板按钮 */}
      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 px-3 text-xs">
            <Download className="w-3 h-3 mr-1.5" />
            从模板加载
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>选择模板</DialogTitle>
          </DialogHeader>
          
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="搜索模板..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* 模板列表 */}
          <div className="flex-1 overflow-y-auto space-y-3 py-2">
            <AnimatePresence>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-slate-500">加载中...</div>
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                  <AlertCircle className="w-8 h-8 mb-2" />
                  <p>{searchQuery ? '没有找到匹配的模板' : '暂无模板'}</p>
                </div>
              ) : (
                filteredTemplates.map((template, index) => (
                  <motion.div
                    key={template.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div 
                            className="flex-1 min-w-0"
                            onClick={() => handleLoadTemplate(template)}
                          >
                            <div className="flex items-center space-x-2 mb-2">
                              <h4 className="font-medium text-slate-900 truncate">
                                {template.name}
                              </h4>
                              <div className="flex items-center space-x-1">
                                {template.is_public ? (
                                  <Globe className="w-3 h-3 text-green-600" />
                                ) : (
                                  <User className="w-3 h-3 text-slate-400" />
                                )}
                                {template.usage_count > 0 && (
                                  <span className="text-xs text-slate-500 flex items-center">
                                    <Clock className="w-3 h-3 mr-1" />
                                    {template.usage_count}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {template.description && (
                              <p className="text-sm text-slate-600 line-clamp-2 mb-2">
                                {template.description}
                              </p>
                            )}
                            
                            <div className="text-xs text-slate-500">
                              创建于 {new Date(template.created_at).toLocaleDateString()}
                            </div>
                          </div>

                          {/* 操作按钮 */}
                          {template.user_id && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem
                                  onClick={() => handleDeleteTemplate(template.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  删除模板
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Trash2,
  Edit,
  X,
  Globe,
  Save
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface NamedRelayConfig {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  modelName: string
  description?: string
  supportsThinking?: boolean
  thinkingBudgetMode?: 'auto' | 'manual'
  thinkingBudget?: number
}

export function RelayServiceManager() {
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

  // 加载配置
  useEffect(() => {
    const savedNamedConfigs = localStorage.getItem('named_relay_configs')
    if (savedNamedConfigs) {
      try {
        const configs = JSON.parse(savedNamedConfigs) as NamedRelayConfig[]
        setNamedRelayConfigs(configs)
      } catch (e) {
        console.warn('Failed to parse named relay configs')
      }
    }
  }, [])

  // 添加新的中转配置
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

  // 删除中转配置
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
    setIsAddingRelay(false)
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

  return (
    <Card className="border border-slate-200 dark:border-slate-700">
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
        <AnimatePresence>
          {namedRelayConfigs.length > 0 && (
            <div className="space-y-2">
              {namedRelayConfigs.map((config) => (
                <motion.div
                  key={config.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="border rounded-lg p-3"
                >
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
                            placeholder="例如: Gemini 2.5 Pro 中转"
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
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>

        {/* 添加新配置表单 */}
        {isAddingRelay && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg p-4 space-y-4"
          >
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
                  placeholder="例如: Gemini 2.5 Pro 中转"
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
          </motion.div>
        )}

        {namedRelayConfigs.length === 0 && !isAddingRelay && (
          <div className="text-center py-8 text-slate-500">
            <Globe className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">还没有配置任何中转服务</p>
            <p className="text-xs mt-1">点击"添加"开始设置</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
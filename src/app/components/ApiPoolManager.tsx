'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Trash2,
  Edit2,
  Zap,
  Check,
  X,
  AlertCircle,
  Settings,
  Activity,
  Clock,
  Shield
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useApiConfig } from '../lib/useApiConfig'
import { ApiConfig, ApiConnectionTestResult } from '../types/apiConfig'

interface ApiPoolManagerProps {
  provider: 'deepseek' | 'gemini' | 'openai' | 'custom'
}

const PROVIDER_INFO = {
  deepseek: {
    name: 'DeepSeek',
    color: 'blue',
    models: ['deepseek-chat', 'deepseek-reasoner']
  },
  gemini: {
    name: 'Gemini',
    color: 'green',
    models: ['gemini-2.5-flash', 'gemini-3-pro-preview']
  },
  openai: {
    name: 'OpenAI',
    color: 'purple',
    models: ['gpt-4o', 'gpt-4o-mini']
  },
  custom: {
    name: '自定义',
    color: 'gray',
    models: []
  }
}

export function ApiPoolManager({ provider }: ApiPoolManagerProps) {
  const {
    config,
    addApi,
    updateApi,
    removeApi,
    testApiConnection,
    getProviderMode,
    setProviderMode
  } = useApiConfig()

  const [apis, setApis] = useState<ApiConfig[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set())
  const [testResults, setTestResults] = useState<Map<string, ApiConnectionTestResult>>(new Map())

  const [newApi, setNewApi] = useState<Partial<ApiConfig>>({
    name: '',
    apiKey: '',
    priority: 5,
    baseUrl: '',
    model: ''
  })

  const providerInfo = PROVIDER_INFO[provider]

  // 从配置中获取当前provider的APIs
  useEffect(() => {
    const currentApis = config.pools[provider] || []
    setApis(currentApis)
  }, [config, provider])

  // 重置新建API表单
  const resetNewApiForm = () => {
    setNewApi({
      name: '',
      apiKey: '',
      priority: 5,
      baseUrl: '',
      model: ''
    })
  }

  // 添加新API
  const handleAddApi = async () => {
    if (!newApi.name?.trim() || !newApi.apiKey?.trim()) {
      alert('请填写API名称和密钥')
      return
    }

    try {
      const apiData: Omit<ApiConfig, 'id'> = {
        name: newApi.name.trim(),
        provider,
        apiKey: newApi.apiKey.trim(),
        isActive: true,
        priority: newApi.priority || 5,
        lastUsedAt: 0,
        errorCount: 0,
        isHealthy: true,
        baseUrl: newApi.baseUrl?.trim() || undefined,
        model: newApi.model?.trim() || undefined
      }

      addApi(provider, apiData)
      resetNewApiForm()
      setIsAdding(false)
    } catch (error) {
      console.error('添加API失败:', error)
      alert('添加API失败，请重试')
    }
  }

  // 更新API
  const handleUpdateApi = async (apiId: string, updates: Partial<ApiConfig>) => {
    try {
      updateApi(apiId, updates)
      setEditingId(null)
    } catch (error) {
      console.error('更新API失败:', error)
      alert('更新API失败，请重试')
    }
  }

  // 删除API
  const handleRemoveApi = async (apiId: string, apiName: string) => {
    if (!confirm(`确定要删除 "${apiName}" 吗？此操作不可撤销。`)) {
      return
    }

    try {
      removeApi(apiId)
    } catch (error) {
      console.error('删除API失败:', error)
      alert('删除API失败，请重试')
    }
  }

  // 测试API连接
  const handleTestApi = async (apiId: string) => {
    setTestingIds(prev => new Set([...prev, apiId]))

    try {
      const result = await testApiConnection(apiId)
      setTestResults(prev => new Map([...prev, [apiId, result]]))
      
      // 3秒后清除测试结果
      setTimeout(() => {
        setTestResults(prev => {
          const newMap = new Map(prev)
          newMap.delete(apiId)
          return newMap
        })
      }, 3000)
    } catch (error) {
      console.error('测试API连接失败:', error)
    } finally {
      setTestingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(apiId)
        return newSet
      })
    }
  }

  // 获取状态颜色
  const getStatusColor = (api: ApiConfig) => {
    if (!api.isActive) return 'gray'
    if (!api.isHealthy) return 'red'
    return 'green'
  }

  // 获取状态文本
  const getStatusText = (api: ApiConfig) => {
    if (!api.isActive) return '已禁用'
    if (!api.isHealthy) return '不健康'
    return '正常'
  }

  return (
    <Card className="border border-slate-200 dark:border-slate-700">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${
              providerInfo.color === 'blue' ? 'bg-blue-500' :
              providerInfo.color === 'green' ? 'bg-green-500' :
              providerInfo.color === 'purple' ? 'bg-purple-500' : 'bg-gray-500'
            }`} />
            <span className="text-base font-medium">{providerInfo.name}</span>
            {apis.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {apis.length}
              </Badge>
            )}
          </CardTitle>

          {/* 简化的模式选择器 */}
          <Select value={getProviderMode(provider)} onValueChange={(mode) => setProviderMode(provider, mode as any)}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">单个</SelectItem>
              <SelectItem value="active_only">多选</SelectItem>
              <SelectItem value="round_robin">轮询</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* API列表 */}
        <AnimatePresence>
          {apis.map((api) => {
            const isEditing = editingId === api.id
            const isTesting = testingIds.has(api.id)
            const testResult = testResults.get(api.id)

            return (
              <motion.div
                key={api.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  {/* 状态指示器 */}
                  <div className="flex items-center space-x-3 flex-1">
                    <div className={`w-2 h-2 rounded-full ${
                      getStatusColor(api) === 'green' ? 'bg-green-500' :
                      getStatusColor(api) === 'red' ? 'bg-red-500' : 'bg-gray-400'
                    }`} />
                    
                    {isEditing ? (
                      <Input
                        placeholder="名称"
                        defaultValue={api.name}
                        className="w-32 h-8 text-sm"
                        onBlur={(e) => {
                          if (e.target.value !== api.name) {
                            handleUpdateApi(api.id, { name: e.target.value })
                          }
                        }}
                      />
                    ) : (
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-slate-900 dark:text-white truncate">{api.name}</div>
                        {api.errorCount > 0 && (
                          <div className="text-xs text-red-500">
                            {api.errorCount}次失败
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 控制按钮 */}
                  <div className="flex items-center space-x-1">
                    {/* 活跃状态开关 */}
                    <Switch
                      checked={api.isActive}
                      onCheckedChange={(checked) => 
                        handleUpdateApi(api.id, { isActive: checked })
                      }
                      className="scale-75"
                    />

                    {/* 优先级(仅轮询模式) */}
                    {getProviderMode(provider) === 'round_robin' && (
                      <Input
                        type="number"
                        min="0"
                        max="10"
                        value={api.priority}
                        onChange={(e) => 
                          handleUpdateApi(api.id, { priority: parseInt(e.target.value) || 5 })
                        }
                        className="w-12 h-6 text-xs text-center"
                      />
                    )}

                    {/* 测试按钮 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTestApi(api.id)}
                      disabled={isTesting}
                      className="h-6 w-6 p-0"
                    >
                      {isTesting ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <Zap className="w-3 h-3" />
                        </motion.div>
                      ) : (
                        <Zap className="w-3 h-3" />
                      )}
                    </Button>

                    {/* 编辑按钮 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingId(isEditing ? null : api.id)}
                      className="h-6 w-6 p-0"
                    >
                      {isEditing ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Edit2 className="w-3 h-3" />
                      )}
                    </Button>

                    {/* 删除按钮 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveApi(api.id, api.name)}
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {/* API Key编辑 */}
                {isEditing && (
                  <div className="space-y-3">
                    <Input
                      type="password"
                      defaultValue={api.apiKey}
                      placeholder="API Key"
                      onBlur={(e) => {
                        if (e.target.value !== api.apiKey) {
                          handleUpdateApi(api.id, { apiKey: e.target.value })
                        }
                      }}
                      className="text-sm"
                    />
                    
                    {provider === 'custom' && (
                      <>
                        <Input
                          type="url"
                          defaultValue={api.baseUrl || ''}
                          placeholder="Base URL (可选)"
                          onBlur={(e) => {
                            handleUpdateApi(api.id, { baseUrl: e.target.value || undefined })
                          }}
                          className="text-sm"
                        />
                        
                        <Input
                          defaultValue={api.model || ''}
                          placeholder="模型名称 (可选)"
                          onBlur={(e) => {
                            handleUpdateApi(api.id, { model: e.target.value || undefined })
                          }}
                          className="text-sm"
                        />
                      </>
                    )}
                  </div>
                )}

                {/* 测试结果 */}
                {testResult && (
                  <div className={`text-xs p-2 rounded ${
                    testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {testResult.success ? '✓ 连接成功' : '✗ 连接失败'}
                    {testResult.latency && ` (${testResult.latency}ms)`}
                  </div>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>

        {/* 添加新API */}
        {isAdding && (
          <div className="border border-dashed rounded-lg p-3 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">添加 {providerInfo.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsAdding(false)
                  resetNewApiForm()
                }}
                className="h-6 w-6 p-0"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>

            <div className="space-y-2">
              <Input
                placeholder="名称"
                value={newApi.name || ''}
                onChange={(e) => setNewApi(prev => ({ ...prev, name: e.target.value }))}
                className="h-8 text-sm"
              />

              <Input
                type="password"
                placeholder="API Key"
                value={newApi.apiKey || ''}
                onChange={(e) => setNewApi(prev => ({ ...prev, apiKey: e.target.value }))}
                className="h-8 text-sm"
              />

              {provider === 'custom' && (
                <>
                  <Input
                    type="url"
                    placeholder="Base URL (可选)"
                    value={newApi.baseUrl || ''}
                    onChange={(e) => setNewApi(prev => ({ ...prev, baseUrl: e.target.value }))}
                    className="h-8 text-sm"
                  />
                  <Input
                    placeholder="模型名称 (可选)"
                    value={newApi.model || ''}
                    onChange={(e) => setNewApi(prev => ({ ...prev, model: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </>
              )}
            </div>

            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setIsAdding(false)
                  resetNewApiForm()
                }}
              >
                取消
              </Button>
              <Button size="sm" onClick={handleAddApi}>
                添加
              </Button>
            </div>
          </div>
        )}

        {/* 添加API按钮 */}
        {!isAdding && (
          <Button
            variant="outline"
            onClick={() => setIsAdding(true)}
            className="w-full border-dashed h-8 text-sm"
          >
            <Plus className="w-3 h-3 mr-1" />
            添加 {providerInfo.name}
          </Button>
        )}

        {/* 简化的状态信息 */}
        {apis.length > 0 && (
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t">
            <div className="flex items-center space-x-3">
              <span>正常: {apis.filter(api => api.isHealthy && api.isActive).length}</span>
              <span>异常: {apis.filter(api => !api.isHealthy && api.isActive).length}</span>
              <span>禁用: {apis.filter(api => !api.isActive).length}</span>
            </div>
            <span>共 {apis.length} 个</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
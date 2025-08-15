'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Key, Eye, EyeOff, Shield, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface ApiKeys {
  deepseek: string
  gemini: string
  openai: string
}

export default function SettingsPage() {
  const [apiKeys, setApiKeys] = useState<ApiKeys>({
    deepseek: '',
    gemini: '',
    openai: ''
  })
  
  const [showKeys, setShowKeys] = useState<{[key: string]: boolean}>({
    deepseek: false,
    gemini: false,
    openai: false
  })

  // 从 localStorage 加载 API Keys
  useEffect(() => {
    const savedKeys = {
      deepseek: localStorage.getItem('api_key_deepseek') || '',
      gemini: localStorage.getItem('api_key_gemini') || '',
      openai: localStorage.getItem('api_key_openai') || ''
    }
    setApiKeys(savedKeys)
  }, [])

  const handleSaveKey = (provider: keyof ApiKeys) => {
    const key = apiKeys[provider].trim()
    if (key) {
      localStorage.setItem(`api_key_${provider}`, key)
      console.log(`Saved API key for ${provider}:`, `${key.substring(0, 10)}...`)
      
      // 验证是否保存成功
      const saved = localStorage.getItem(`api_key_${provider}`)
      if (saved === key) {
        console.log(`✅ API key for ${provider} saved successfully`)
        // 这里可以添加成功提示的UI反馈
        alert(`${provider} API密钥保存成功！`)
      } else {
        console.error(`❌ Failed to save API key for ${provider}`)
        alert(`保存失败，请重试`)
      }
    } else {
      alert('请输入有效的API密钥')
    }
  }

  const handleKeyChange = (provider: keyof ApiKeys, value: string) => {
    setApiKeys(prev => ({
      ...prev,
      [provider]: value
    }))
  }

  const toggleShowKey = (provider: string) => {
    setShowKeys(prev => ({
      ...prev,
      [provider]: !prev[provider]
    }))
  }

  const apiProviders = [
    {
      id: 'deepseek' as keyof ApiKeys,
      name: 'DeepSeek',
      description: '高性能的中文对话模型',
      placeholder: 'sk-...',
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 'gemini' as keyof ApiKeys,
      name: 'Google Gemini',
      description: 'Google 的多模态AI模型',
      placeholder: 'AIza...',
      color: 'from-green-500 to-green-600'
    },
    {
      id: 'openai' as keyof ApiKeys,
      name: 'OpenAI',
      description: 'GPT系列模型',
      placeholder: 'sk-...',
      color: 'from-purple-500 to-purple-600'
    }
  ]

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        staggerChildren: 0.1
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

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-4xl mx-auto space-y-8"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center">
            <Key className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">设置</h1>
            <p className="text-slate-600 mt-1">管理你的API密钥和偏好设置</p>
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Tabs defaultValue="api-keys" className="space-y-6">
          <TabsList>
            <TabsTrigger value="api-keys">API 密钥</TabsTrigger>
            <TabsTrigger value="preferences">偏好设置</TabsTrigger>
          </TabsList>

          <TabsContent value="api-keys" className="space-y-6">
            {/* Security Notice */}
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-3">
                  <Shield className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-amber-900">隐私保护</h3>
                    <p className="text-sm text-amber-700 mt-1">
                      您的API密钥仅存储在您的浏览器本地，我们绝不会上传或访问您的密钥。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* API Keys */}
            <div className="space-y-4">
              {apiProviders.map((provider) => (
                <motion.div key={provider.id} variants={itemVariants}>
                  <Card>
                    <CardHeader>
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${provider.color} flex items-center justify-center`}>
                          <Key className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <CardTitle>{provider.name}</CardTitle>
                          <CardDescription>{provider.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor={provider.id}>API 密钥</Label>
                        <div className="flex space-x-2">
                          <div className="relative flex-1">
                            <Input
                              id={provider.id}
                              type={showKeys[provider.id] ? "text" : "password"}
                              placeholder={provider.placeholder}
                              value={apiKeys[provider.id]}
                              onChange={(e) => handleKeyChange(provider.id, e.target.value)}
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3"
                              onClick={() => toggleShowKey(provider.id)}
                            >
                              {showKeys[provider.id] ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                          <Button
                            onClick={() => handleSaveKey(provider.id)}
                            disabled={!apiKeys[provider.id].trim()}
                            className="bg-slate-900 hover:bg-slate-800"
                          >
                            保存
                          </Button>
                        </div>
                      </div>
                      
                      {apiKeys[provider.id] && (
                        <div className="flex items-center space-x-2 text-sm text-green-600">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>已配置</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="preferences" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>偏好设置</CardTitle>
                <CardDescription>自定义你的使用体验</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-slate-500">偏好设置功能开发中...</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  )
} 
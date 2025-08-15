'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, Trash2 } from 'lucide-react'

export default function DebugPage() {
  const [localStorageData, setLocalStorageData] = useState<{[key: string]: string}>({})

  const loadLocalStorageData = () => {
    if (typeof window !== 'undefined') {
      const data: {[key: string]: string} = {}
      
      // 获取所有localStorage数据
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key) {
          data[key] = localStorage.getItem(key) || ''
        }
      }
      
      setLocalStorageData(data)
    }
  }

  useEffect(() => {
    loadLocalStorageData()
  }, [])

  const clearLocalStorage = () => {
    if (confirm('确定要清空所有localStorage数据吗？')) {
      localStorage.clear()
      loadLocalStorageData()
    }
  }

  const deleteItem = (key: string) => {
    if (confirm(`确定要删除 ${key} 吗？`)) {
      localStorage.removeItem(key)
      loadLocalStorageData()
    }
  }

  const apiKeys = Object.keys(localStorageData).filter(key => key.startsWith('api_key_'))

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">调试页面</h1>
        <p className="text-slate-600 mt-1">检查localStorage中的数据</p>
      </div>

      <div className="flex space-x-4">
        <Button onClick={loadLocalStorageData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          刷新数据
        </Button>
        <Button variant="destructive" onClick={clearLocalStorage}>
          <Trash2 className="w-4 h-4 mr-2" />
          清空localStorage
        </Button>
      </div>

      {/* API密钥 */}
      <Card>
        <CardHeader>
          <CardTitle>API密钥 ({apiKeys.length}个)</CardTitle>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <p className="text-slate-500">没有找到API密钥</p>
          ) : (
            <div className="space-y-3">
              {apiKeys.map(key => (
                <div key={key} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium">{key}</p>
                    <p className="text-sm text-slate-600">
                      {localStorageData[key] ? `${localStorageData[key].substring(0, 20)}...` : 'Empty'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteItem(key)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 所有localStorage数据 */}
      <Card>
        <CardHeader>
          <CardTitle>所有localStorage数据</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(localStorageData).length === 0 ? (
            <p className="text-slate-500">localStorage为空</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(localStorageData).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm truncate">{key}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {value.length > 50 ? `${value.substring(0, 50)}...` : value}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteItem(key)}
                    className="text-red-600 hover:text-red-700 ml-2"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 
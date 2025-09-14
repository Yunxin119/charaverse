'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSplitter, createMessageSplitter, needsSplitting, cleanPauseMarkers } from '@/lib/messageSplitter'

export default function TestSplitPage() {
  const [testMessage, setTestMessage] = useState(`你好！{pause}我是你的AI助手。{pause}今天天气不错呢，我们来聊聊天吧！{pause}有什么我可以帮助你的吗？`)
  const [splitter] = useState(() => createMessageSplitter())
  const [splitResult, setSplitResult] = useState<any>(null)

  const handleSplit = () => {
    const preview = splitter.previewSplit(testMessage)
    setSplitResult(preview)
    console.log('🔪 分割预览结果:', preview)
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">消息分割系统测试</h1>
      
      <div className="grid gap-6">
        {/* 输入区域 */}
        <Card>
          <CardHeader>
            <CardTitle>测试消息输入</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="输入包含 {pause} 标记的消息..."
              className="min-h-[120px]"
            />
            <div className="flex items-center gap-4">
              <Button onClick={handleSplit}>分割预览</Button>
              <div className="text-sm text-slate-600">
                <span className="font-medium">需要分割:</span> {needsSplitting(testMessage) ? '是' : '否'}
              </div>
              <div className="text-sm text-slate-600">
                <span className="font-medium">原始长度:</span> {testMessage.length} 字符
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 清理后的消息预览 */}
        <Card>
          <CardHeader>
            <CardTitle>清理后的消息</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="whitespace-pre-wrap">{cleanPauseMarkers(testMessage)}</p>
            </div>
          </CardContent>
        </Card>

        {/* 分割结果 */}
        {splitResult && (
          <Card>
            <CardHeader>
              <CardTitle>分割结果</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium">原始长度:</span> {splitResult.originalLength} 字符
                  </div>
                  <div>
                    <span className="font-medium">分割片段:</span> {splitResult.segmentCount} 个
                  </div>
                  <div>
                    <span className="font-medium">平均长度:</span> {Math.round(splitResult.originalLength / splitResult.segmentCount)} 字符
                  </div>
                </div>

                <div className="space-y-3">
                  {splitResult.segments.map((segment: any, index: number) => (
                    <div key={index} className="border rounded-lg p-3 bg-white">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">片段 {index + 1}</span>
                        <div className="flex gap-3 text-xs text-slate-600">
                          <span>长度: {segment.length}</span>
                          <span>延迟: {segment.delay}ms</span>
                          <span>打字: {segment.isTyping ? '是' : '否'}</span>
                          <span className={`px-2 py-1 rounded ${
                            segment.priority === 'high' ? 'bg-red-100 text-red-700' :
                            segment.priority === 'low' ? 'bg-gray-100 text-gray-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {segment.priority}
                          </span>
                        </div>
                      </div>
                      <div className="bg-slate-50 p-2 rounded text-sm">
                        {segment.content}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 预设测试案例 */}
        <Card>
          <CardHeader>
            <CardTitle>预设测试案例</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              <Button 
                variant="outline" 
                onClick={() => setTestMessage("你好！{pause}我是你的AI助手。{pause}今天天气不错呢，我们来聊聊天吧！{pause}有什么我可以帮助你的吗？")}
              >
                基础对话
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setTestMessage("哈哈哈！{pause}这真的太有趣了！{pause}我从来没想过会是这样的结果。{pause}你觉得呢？{pause}我们继续吧！")}
              >
                情绪化对话
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setTestMessage("让我想想...{pause}这个问题确实很复杂。{pause}首先，我们需要考虑几个方面：技术可行性、成本效益、时间安排等等。{pause}你有什么特别的想法吗？")}
              >
                长消息分割
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setTestMessage("好的，明白了！")}
              >
                无需分割
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

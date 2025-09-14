'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { needsSplitting, cleanPauseMarkers, createMessageSplitter } from '@/lib/messageSplitter'

export default function TestMobilePage() {
  const [testMessage, setTestMessage] = useState("你好！{pause}今天天气真不错{pause}要不要一起出去走走？")
  const [result, setResult] = useState<any>(null)

  const testSplitting = () => {
    console.log('🧪 测试消息分割')
    console.log('原始消息:', testMessage)
    console.log('需要分割?', needsSplitting(testMessage))
    
    if (needsSplitting(testMessage)) {
      const splitter = createMessageSplitter({
        typingSpeed: 12,
        baseDelay: 600,
        randomDelayRange: 1500,
        maxSegmentLength: 60
      })
      
      const segments = splitter.splitMessage(testMessage)
      console.log('分割结果:', segments)
      setResult({
        needsSplit: true,
        segments,
        cleanedContent: cleanPauseMarkers(testMessage)
      })
    } else {
      setResult({
        needsSplit: false,
        cleanedContent: cleanPauseMarkers(testMessage)
      })
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">📱 手机聊天模式测试</h1>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">测试消息（使用{'{pause}'}分割）:</label>
          <Textarea
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            placeholder="输入包含{pause}的消息..."
            className="min-h-[100px]"
          />
        </div>
        
        <Button onClick={testSplitting}>
          🔪 测试消息分割
        </Button>
        
        {result && (
          <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg space-y-4">
            <h3 className="font-semibold">分割结果:</h3>
            
            <div>
              <strong>需要分割:</strong> {result.needsSplit ? '✅ 是' : '❌ 否'}
            </div>
            
            <div>
              <strong>清理后内容:</strong> 
              <div className="mt-2 p-2 bg-white dark:bg-slate-700 rounded border">
                {result.cleanedContent}
              </div>
            </div>
            
            {result.segments && (
              <div>
                <strong>分割片段 ({result.segments.length}个):</strong>
                <div className="mt-2 space-y-2">
                  {result.segments.map((segment: any, index: number) => (
                    <div key={segment.id} className="p-3 bg-white dark:bg-slate-700 rounded border">
                      <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                        片段 {index + 1} (延迟: {segment.delay}ms, 打字: {segment.isTyping ? '是' : '否'})
                      </div>
                      <div className="font-mono">{segment.content}</div>
                      {segment.typingDuration && (
                        <div className="text-xs text-slate-500 mt-1">
                          打字时长: {segment.typingDuration}ms
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">📝 使用说明:</h3>
        <ul className="text-sm space-y-1">
          <li>• 在消息中使用 <code className="bg-white dark:bg-slate-700 px-1 rounded">{'{pause}'}</code> 来标记分割点</li>
          <li>• 示例: "你好！{'{pause}'}今天天气真不错{'{pause}'}要不要一起出去走走？"</li>
          <li>• 分割后会自动添加延迟和打字效果</li>
          <li>• 每个片段会在手机聊天中作为独立消息显示</li>
        </ul>
      </div>
      
      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">🔧 调试信息:</h3>
        <p className="text-sm">
          打开浏览器开发者工具(F12)查看控制台输出，可以看到详细的分割处理过程。
        </p>
      </div>
    </div>
  )
}
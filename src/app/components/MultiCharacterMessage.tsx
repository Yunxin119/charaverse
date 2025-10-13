'use client'

import React from 'react'
import { EnhancedChatMessage, Character, ScriptCharacter } from '../lib/supabase'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { User, Bot, Crown, RefreshCw, Edit2, Trash2, Lightbulb, Send, Brain } from 'lucide-react'

interface MultiCharacterMessageProps {
  message: EnhancedChatMessage
  scriptCharacters?: ScriptCharacter[]
  currentScript?: Character
  isSelected?: boolean
  isEditing?: boolean
  editingContent?: string
  isBatchDeleteMode?: boolean
  isGenerating?: boolean
  isGettingInspiration?: boolean
  isLastMessage?: boolean
  onEditSave?: (messageId: number, newContent: string) => void
  onEditCancel?: () => void
  onStartEdit?: (messageId: number, content: string) => void
  onRegenerateMessage?: (messageId: number) => void
  onContinueMessage?: (messageId: number) => void
  onGetInspiration?: () => void
  onResendMessage?: (messageId: number) => void
  onDeleteMessage?: (messageId: number) => void
  onSelectMessage?: (messageId: number) => void
  onToggleSelect?: (messageId: number) => void
  setEditingContent?: (content: string) => void
  showTimestamp?: boolean
  className?: string
}

export const MultiCharacterMessage: React.FC<MultiCharacterMessageProps> = ({
  message,
  scriptCharacters = [],
  currentScript,
  isSelected = false,
  isEditing = false,
  editingContent = '',
  isBatchDeleteMode = false,
  isGenerating = false,
  isGettingInspiration = false,
  isLastMessage = false,
  onEditSave,
  onEditCancel,
  onStartEdit,
  onRegenerateMessage,
  onContinueMessage,
  onGetInspiration,
  onResendMessage,
  onDeleteMessage,
  onSelectMessage,
  onToggleSelect,
  setEditingContent,
  showTimestamp = true,
  className = ''
}) => {
  // 获取发言角色信息（支持剧本多角色）
  const speakerCharacter = message.speaker_character_id
    ? scriptCharacters.find(c => c.id === message.speaker_character_id)
    : null

  const isUserMessage = message.role === 'user'
  const isCharacterMessage = message.role === 'assistant'

  // 格式化时间戳
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000)

    if (diffInMinutes < 1) return '刚刚'
    if (diffInMinutes < 60) return `${diffInMinutes}分钟前`

    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours}小时前`

    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // 用户消息样式
  if (isUserMessage) {
    return (
      <div className={`flex justify-end mb-4 ${className}`}>
        <div className="flex items-end space-x-2 max-w-[80%]">
          <div className="flex flex-col items-end space-y-1">
            {showTimestamp && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatTimestamp(message.created_at)}
              </span>
            )}

            {/* 批量删除模式下的选择框 */}
            {isBatchDeleteMode && (
              <div className="flex items-center justify-end mb-2">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect?.(message.id)}
                    className="mr-2 w-4 h-4"
                  />
                  <span className="text-xs text-gray-600 dark:text-gray-400">选择删除</span>
                </label>
              </div>
            )}

            {isEditing ? (
              // 编辑模式
              <div className="w-full">
                <Textarea
                  value={editingContent}
                  onChange={(e) => setEditingContent?.(e.target.value)}
                  className="w-full text-sm resize-none"
                  rows={3}
                />
                <div className="flex justify-end space-x-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onEditCancel}
                    className="h-6 px-2 text-xs"
                  >
                    取消
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onEditSave?.(message.id, editingContent)}
                    className="h-6 px-2 text-xs"
                  >
                    <Send className="w-3 h-3 mr-1" />
                    保存
                  </Button>
                </div>
              </div>
            ) : (
              // 正常显示模式
              <>
                <Card className="bg-blue-500 text-white group relative">
                  <CardContent className="p-3">
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                  </CardContent>

                  {/* 悬停显示的操作按钮 */}
                  {!isBatchDeleteMode && (
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onStartEdit?.(message.id, message.content)}
                        className="h-6 px-1 text-xs bg-white/20 hover:bg-white/30 text-white"
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onResendMessage?.(message.id)}
                        disabled={isGenerating}
                        className="h-6 px-1 text-xs bg-white/20 hover:bg-white/30 text-white"
                        title="重新发送此消息"
                      >
                        <RefreshCw className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDeleteMessage?.(message.id)}
                        className="h-6 px-1 text-xs bg-white/20 hover:bg-white/30 text-white"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </Card>
              </>
            )}
          </div>
          <Avatar className="w-8 h-8 flex-shrink-0">
            <AvatarFallback className="bg-blue-100 text-blue-600">
              <User className="w-4 h-4" />
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    )
  }

  // 角色消息样式
  if (isCharacterMessage && speakerCharacter) {
    return (
      <div className={`flex justify-start mb-4 ${className}`}>
        <div className="flex items-start space-x-3 max-w-[85%]">
          <div className="relative flex-shrink-0">
            <Avatar className="w-10 h-10">
              <AvatarImage src={speakerCharacter.avatar_url} />
              <AvatarFallback className="bg-gray-100 text-gray-600">
                {speakerCharacter.name.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="flex flex-col space-y-1 flex-1">
            {/* 角色名称和标识 */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {speakerCharacter.name}
              </span>
              {showTimestamp && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatTimestamp(message.created_at)}
                </span>
              )}
            </div>

            {/* 批量删除模式下的选择框 */}
            {isBatchDeleteMode && (
              <div className="flex items-center mb-2">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect?.(message.id)}
                    className="mr-2 w-4 h-4"
                  />
                  <span className="text-xs text-gray-600 dark:text-gray-400">选择删除</span>
                </label>
              </div>
            )}

            {isEditing ? (
              // 编辑模式
              <div className="w-full">
                <Textarea
                  value={editingContent}
                  onChange={(e) => setEditingContent?.(e.target.value)}
                  className="w-full text-sm resize-none"
                  rows={4}
                />
                <div className="flex justify-start space-x-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onEditCancel}
                    className="h-6 px-2 text-xs"
                  >
                    取消
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onEditSave?.(message.id, editingContent)}
                    className="h-6 px-2 text-xs"
                  >
                    <Send className="w-3 h-3 mr-1" />
                    保存
                  </Button>
                </div>
              </div>
            ) : (
              // 正常显示模式
              <>
                {/* 消息内容 */}
                <Card className={`
                  border-l-4 group relative
                  ${speakerCharacter.id === scriptCharacters.find(c => c.id === message.speaker_character_id)?.id
                    ? 'border-l-blue-500 bg-blue-50 dark:bg-blue-950'
                    : 'border-l-gray-300 bg-white dark:bg-gray-800'
                  }
                `}>
                  <CardContent className="p-3">
                    <p className="text-sm whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200">
                      {message.content}
                    </p>
                  </CardContent>
                </Card>

                {/* 角色特征标签 */}
                {speakerCharacter.personality?.traits && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {speakerCharacter.personality.traits.slice(0, 3).map((trait: string, index: number) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {trait}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* 操作按钮区域 */}
                {!isBatchDeleteMode && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {/* 重新生成按钮 - 仅限最后一条AI消息 */}
                    {isLastMessage && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRegenerateMessage?.(message.id)}
                        disabled={isGenerating}
                        className="h-7 px-2 text-xs bg-white dark:bg-slate-700 dark:text-white border border-slate-200 dark:border-slate-600"
                      >
                        <RefreshCw className={`w-3 h-3 mr-1 ${isGenerating ? 'animate-spin' : ''}`} />
                        重新生成
                      </Button>
                    )}

                    {/* 续写按钮 - 仅限最后一条AI消息 */}
                    {isLastMessage && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onContinueMessage?.(message.id)}
                        disabled={isGenerating}
                        className="h-7 px-2 text-xs bg-white dark:bg-slate-700 dark:text-white border border-slate-200 dark:border-slate-600"
                      >
                        <Brain className="w-3 h-3 mr-1" />
                        续写
                      </Button>
                    )}

                    {/* 灵感按钮 - 仅限最后一条AI消息 */}
                    {isLastMessage && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={onGetInspiration}
                        disabled={isGettingInspiration}
                        className="h-7 px-2 text-xs bg-white dark:bg-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 hover:border-yellow-200 dark:hover:border-yellow-800 hover:text-yellow-600 dark:hover:text-yellow-400"
                      >
                        <Lightbulb className="w-3 h-3 mr-1" />
                        灵感
                      </Button>
                    )}

                    {/* 编辑按钮 */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onStartEdit?.(message.id, message.content)}
                      className="h-7 px-2 text-xs bg-white dark:bg-slate-700 dark:text-white border border-slate-200 dark:border-slate-600"
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      编辑
                    </Button>

                    {/* 删除按钮 */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDeleteMessage?.(message.id)}
                      className="h-7 px-2 text-xs bg-white dark:bg-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 text-red-600 hover:text-red-700 hover:border-red-200 dark:hover:border-red-800"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      删除
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 系统消息样式
  return (
    <div className={`flex justify-center mb-4 ${className}`}>
      <Card className="bg-gray-100 dark:bg-gray-800 max-w-md">
        <CardContent className="p-2 text-center">
          <div className="flex items-center justify-center space-x-2">
            <Bot className="w-4 h-4 text-gray-500" />
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {message.content}
            </p>
          </div>
          {showTimestamp && (
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 block">
              {formatTimestamp(message.created_at)}
            </span>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default MultiCharacterMessage
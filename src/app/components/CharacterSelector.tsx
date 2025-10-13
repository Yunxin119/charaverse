'use client'

import React, { useState } from 'react'
import { Character, MultiCharacterSession } from '../lib/supabase'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  Crown,
  MessageCircle,
  Clock,
  Plus,
  Minus,
  MoreHorizontal,
  Settings
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface CharacterSelectorProps {
  session: MultiCharacterSession
  availableCharacters: Character[]
  currentSpeaker?: Character
  onSpeakerChange: (characterId: number) => void
  onAddCharacter: (characterId: number) => void
  onRemoveCharacter: (characterId: number) => void
  speakingStats?: {
    character_id: number
    character_name: string
    speak_count: number
    last_spoke_at?: string
    is_current_speaker: boolean
  }[]
  disabled?: boolean
}

export const CharacterSelector: React.FC<CharacterSelectorProps> = ({
  session,
  availableCharacters,
  currentSpeaker,
  onSpeakerChange,
  onAddCharacter,
  onRemoveCharacter,
  speakingStats = [],
  disabled = false
}) => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  const activeCharacters = session.characters || []
  const inactiveCharacters = availableCharacters.filter(
    char => !session.active_characters?.includes(char.id)
  )

  const getCharacterStats = (characterId: number) => {
    return speakingStats.find(stat => stat.character_id === characterId)
  }

  const formatLastSpoke = (lastSpoke?: string) => {
    if (!lastSpoke) return '未发言'
    const date = new Date(lastSpoke)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)

    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}小时前`
    const days = Math.floor(hours / 24)
    return `${days}天前`
  }

  const CharacterCard: React.FC<{
    character: Character
    isActive: boolean
    isCurrent: boolean
    stats?: any
  }> = ({ character, isActive, isCurrent, stats }) => (
    <Card className={`
      relative transition-all duration-200 cursor-pointer hover:shadow-md
      ${isCurrent ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950' : ''}
      ${isActive && !isCurrent ? 'ring-1 ring-gray-300 dark:ring-gray-600' : ''}
      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    `}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Avatar className="w-10 h-10">
                <AvatarImage src={character.avatar_url} />
                <AvatarFallback>
                  {character.name.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              {isCurrent && (
                <Badge className="absolute -top-1 -right-1 w-4 h-4 p-0 bg-blue-500">
                  <Crown className="w-2 h-2" />
                </Badge>
              )}
            </div>
            <div className="flex-1">
              <CardTitle className="text-sm font-medium">
                {character.name}
              </CardTitle>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {character.prompt_template?.basic_info?.description?.slice(0, 30) || '无描述'}
                {character.prompt_template?.basic_info?.description?.length > 30 && '...'}
              </p>
            </div>
          </div>

          {isActive && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!isCurrent && (
                  <DropdownMenuItem
                    onClick={() => !disabled && onSpeakerChange(character.id)}
                    disabled={disabled}
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    设为发言者
                  </DropdownMenuItem>
                )}
                {activeCharacters.length > 1 && (
                  <DropdownMenuItem
                    onClick={() => !disabled && onRemoveCharacter(character.id)}
                    disabled={disabled}
                    className="text-red-600 dark:text-red-400"
                  >
                    <Minus className="w-4 h-4 mr-2" />
                    移出会话
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>

      {isActive && stats && (
        <CardContent className="pt-0 pb-3">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center space-x-2">
              <MessageCircle className="w-3 h-3" />
              <span>{stats.speak_count}条消息</span>
            </div>
            <div className="flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>{formatLastSpoke(stats.last_spoke_at)}</span>
            </div>
          </div>

          {character.prompt_template?.personality?.traits && (
            <div className="flex flex-wrap gap-1 mt-2">
              {character.prompt_template.personality.traits.slice(0, 2).map((trait: string, index: number) => (
                <Badge key={index} variant="secondary" className="text-xs px-1 py-0">
                  {trait}
                </Badge>
              ))}
              {character.prompt_template.personality.traits.length > 2 && (
                <Badge variant="secondary" className="text-xs px-1 py-0">
                  +{character.prompt_template.personality.traits.length - 2}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      )}

      {!isActive && (
        <CardContent className="pt-0 pb-3">
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => !disabled && onAddCharacter(character.id)}
            disabled={disabled}
          >
            <Plus className="w-4 h-4 mr-2" />
            加入会话
          </Button>
        </CardContent>
      )}
    </Card>
  )

  return (
    <div className="space-y-4">
      {/* 会话模式标识 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Users className="w-5 h-5 text-blue-500" />
          <span className="font-medium">
            {session.session_type === 'multi' ? '多角色对话' : '单角色对话'}
          </span>
          <Badge variant="secondary">
            {activeCharacters.length}个角色
          </Badge>
        </div>

        {inactiveCharacters.length > 0 && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" disabled={disabled}>
                <Plus className="w-4 h-4 mr-2" />
                添加角色
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>添加角色到会话</DialogTitle>
                <DialogDescription>
                  选择要加入当前会话的角色
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 mt-4">
                {inactiveCharacters.map(character => (
                  <CharacterCard
                    key={character.id}
                    character={character}
                    isActive={false}
                    isCurrent={false}
                  />
                ))}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* 活跃角色列表 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          参与对话的角色
        </h3>
        <div className="grid gap-3">
          {activeCharacters.map(character => {
            const isCurrent = currentSpeaker?.id === character.id
            const stats = getCharacterStats(character.id)

            return (
              <CharacterCard
                key={character.id}
                character={character}
                isActive={true}
                isCurrent={isCurrent}
                stats={stats}
              />
            )
          })}
        </div>
      </div>

      {/* 发言统计 */}
      {speakingStats.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            发言统计
          </h4>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <div>总消息数: {speakingStats.reduce((sum, stat) => sum + stat.speak_count, 0)}</div>
              <div>最活跃: {speakingStats.reduce((prev, current) =>
                prev.speak_count > current.speak_count ? prev : current
              ).character_name}</div>
            </div>
          </div>
        </div>
      )}

      {/* 会话设置 */}
      <div className="border-t pt-3">
        <Button variant="ghost" size="sm" className="w-full justify-start" disabled={disabled}>
          <Settings className="w-4 h-4 mr-2" />
          会话设置
        </Button>
      </div>
    </div>
  )
}

export default CharacterSelector
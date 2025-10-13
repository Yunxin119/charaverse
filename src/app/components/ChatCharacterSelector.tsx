'use client'

import React from 'react'
import { ScriptCharacter } from '../lib/supabase'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Crown,
  MessageCircle,
  Users
} from 'lucide-react'

interface ChatCharacterSelectorProps {
  userId: string
  sessionId: string
  scriptCharacters: ScriptCharacter[]
  currentSpeaker?: ScriptCharacter | null
  onSwitchSpeaker: (scriptCharacterId: string) => void
  onClose: () => void
}

export const ChatCharacterSelector: React.FC<ChatCharacterSelectorProps> = ({
  userId,
  sessionId,
  scriptCharacters,
  currentSpeaker,
  onSwitchSpeaker,
  onClose
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Users className="w-5 h-5" />
          <h3 className="text-lg font-semibold">剧本角色选择</h3>
        </div>
        <Badge variant="outline">
          {scriptCharacters.length} 个角色
        </Badge>
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        选择当前发言的角色
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {scriptCharacters.map((character) => {
          const isCurrentSpeaker = currentSpeaker?.id === character.id

          return (
            <Card
              key={character.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                isCurrentSpeaker
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 dark:border-blue-400'
                  : 'hover:border-gray-300 dark:hover:border-gray-600'
              }`}
              onClick={() => onSwitchSpeaker(character.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <div className="relative">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={character.avatar_url} />
                      <AvatarFallback className="bg-gray-100 text-gray-600">
                        {character.name.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    {isCurrentSpeaker && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                        <Crown className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                      {character.name}
                    </h4>
                    {character.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                        {character.description}
                      </p>
                    )}
                    {character.personality?.traits && character.personality.traits.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {character.personality.traits.slice(0, 3).map((trait, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {trait}
                          </Badge>
                        ))}
                        {character.personality.traits.length > 3 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            +{character.personality.traits.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                    {isCurrentSpeaker && (
                      <div className="flex items-center space-x-1 mt-2">
                        <Crown className="w-3 h-3 text-blue-600" />
                        <span className="text-xs text-blue-600 font-medium">当前发言</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button
          variant="outline"
          onClick={onClose}
        >
          关闭
        </Button>
      </div>
    </div>
  )
}
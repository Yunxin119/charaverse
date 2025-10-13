import { supabase } from './supabase'
import type {
  Character,
  ScriptCharacterContext,
  ScriptCharacter
} from './supabase'

/**
 * 多角色对话管理器
 * 负责处理多角色会话的创建、管理和状态维护
 */
export class MultiCharacterManager {
  private userId: string

  constructor(userId: string) {
    this.userId = userId
  }
  /**
   * 创建多角色会话
   */
  static async createMultiCharacterSession(params: {
    userId: string
    characterIds: number[]
    title?: string
    rotationMode?: 'manual' | 'auto'
  }): Promise<{ id: string; [key: string]: unknown } | null> {
    const { userId, characterIds, title, rotationMode = 'manual' } = params

    if (characterIds.length < 2) {
      throw new Error('多角色会话至少需要2个角色')
    }

    try {
      // 1. 验证所有角色都存在且属于用户
      const { data: characters, error: charError } = await supabase
        .from('characters')
        .select('*')
        .in('id', characterIds)
        .eq('user_id', userId)

      if (charError || !characters || characters.length !== characterIds.length) {
        throw new Error('部分角色不存在或无权限访问')
      }

      // 2. 创建会话
      const { data: session, error: sessionError } = await supabase
        .from('chat_sessions')
        .insert({
          user_id: userId,
          character_id: characterIds[0], // 主角色设为第一个
          title: title || `${characters.map(c => c.name).join(' & ')} 的对话`,
          session_type: 'multi',
          active_characters: characterIds,
          current_speaker_id: characterIds[0],
          rotation_mode: rotationMode
        })
        .select()
        .single()

      if (sessionError || !session) {
        throw new Error('创建会话失败')
      }

      // 3. 创建会话角色关联记录
      const sessionCharacters = characterIds.map((charId, index) => ({
        session_id: session.id,
        character_id: charId,
        is_active: true,
        join_order: index + 1,
        speak_count: 0
      }))

      const { error: scError } = await supabase
        .from('session_characters')
        .insert(sessionCharacters)

      if (scError) {
        // 回滚：删除已创建的会话
        await supabase
          .from('chat_sessions')
          .delete()
          .eq('id', session.id)
        throw new Error('创建角色关联失败')
      }

      // 4. 返回完整的多角色会话信息
      return {
        ...session,
        session_type: 'multi',
        active_characters: characterIds,
        characters
      } as { id: string; [key: string]: unknown }

    } catch (error) {
      console.error('创建多角色会话失败:', error)
      return null
    }
  }

  /**
   * 获取多角色会话的详细信息
   */
  static async getMultiCharacterSession(sessionId: string, userId: string): Promise<{ id: string; [key: string]: unknown } | null> {
    try {
      // 获取会话基本信息
      const { data: session, error: sessionError } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single()

      if (sessionError || !session) {
        return null
      }

      // 获取会话角色信息
      const { data: sessionCharacters, error: scError } = await supabase
        .from('session_characters')
        .select(`
          *,
          characters:character_id (*)
        `)
        .eq('session_id', sessionId)
        .eq('is_active', true)
        .order('join_order')

      if (scError) {
        console.error('获取会话角色失败:', scError)
        return session as { id: string; [key: string]: unknown }
      }

      // 提取角色信息
      const characters = sessionCharacters?.map(sc => sc.characters).filter(Boolean) || []
      const activeCharacters = sessionCharacters?.map(sc => sc.character_id) || []

      return {
        ...session,
        session_type: session.session_type || 'single',
        active_characters: activeCharacters,
        session_characters: sessionCharacters,
        characters
      } as { id: string; [key: string]: unknown }

    } catch (error) {
      console.error('获取多角色会话失败:', error)
      return null
    }
  }

  /**
   * 添加角色到现有会话
   */
  static async addCharacterToSession(params: {
    sessionId: string
    characterId: number
    userId: string
  }): Promise<boolean> {
    const { sessionId, characterId, userId } = params

    try {
      // 1. 验证会话存在且为多角色会话
      const { data: session, error: sessionError } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single()

      if (sessionError || !session) {
        throw new Error('会话不存在')
      }

      // 2. 验证角色存在且属于用户
      const { data: character, error: charError } = await supabase
        .from('characters')
        .select('*')
        .eq('id', characterId)
        .eq('user_id', userId)
        .single()

      if (charError || !character) {
        throw new Error('角色不存在或无权限')
      }

      // 3. 检查角色是否已在会话中
      const { data: existing } = await supabase
        .from('session_characters')
        .select('*')
        .eq('session_id', sessionId)
        .eq('character_id', characterId)
        .single()

      if (existing) {
        if (existing.is_active) {
          throw new Error('角色已在会话中')
        } else {
          // 重新激活角色
          const { error: updateError } = await supabase
            .from('session_characters')
            .update({ is_active: true })
            .eq('session_id', sessionId)
            .eq('character_id', characterId)

          if (updateError) {
            throw new Error('重新激活角色失败')
          }
        }
      } else {
        // 获取当前最大join_order
        const { data: maxOrder } = await supabase
          .from('session_characters')
          .select('join_order')
          .eq('session_id', sessionId)
          .order('join_order', { ascending: false })
          .limit(1)
          .single()

        const nextOrder = (maxOrder?.join_order || 0) + 1

        // 添加新的角色关联
        const { error: insertError } = await supabase
          .from('session_characters')
          .insert({
            session_id: sessionId,
            character_id: characterId,
            is_active: true,
            join_order: nextOrder,
            speak_count: 0
          })

        if (insertError) {
          throw new Error('添加角色失败')
        }
      }

      // 4. 更新会话的active_characters
      const { data: allActive } = await supabase
        .from('session_characters')
        .select('character_id')
        .eq('session_id', sessionId)
        .eq('is_active', true)

      const activeCharacterIds = allActive?.map(sc => sc.character_id) || []

      const { error: updateSessionError } = await supabase
        .from('chat_sessions')
        .update({
          active_characters: activeCharacterIds,
          session_type: activeCharacterIds.length > 1 ? 'multi' : 'single'
        })
        .eq('id', sessionId)

      if (updateSessionError) {
        throw new Error('更新会话信息失败')
      }

      return true

    } catch (error) {
      console.error('添加角色到会话失败:', error)
      return false
    }
  }

  /**
   * 从会话中移除角色
   */
  static async removeCharacterFromSession(params: {
    sessionId: string
    characterId: number
    userId: string
  }): Promise<boolean> {
    const { sessionId, characterId, userId } = params

    try {
      // 验证会话权限
      const { data: session, error: sessionError } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single()

      if (sessionError || !session) {
        throw new Error('会话不存在或无权限')
      }

      // 检查剩余活跃角色数量
      const { data: activeCharacters } = await supabase
        .from('session_characters')
        .select('character_id')
        .eq('session_id', sessionId)
        .eq('is_active', true)

      if (!activeCharacters || activeCharacters.length <= 1) {
        throw new Error('至少需要保留一个角色')
      }

      // 标记角色为非活跃
      const { error: updateError } = await supabase
        .from('session_characters')
        .update({ is_active: false })
        .eq('session_id', sessionId)
        .eq('character_id', characterId)

      if (updateError) {
        throw new Error('移除角色失败')
      }

      // 更新会话信息
      const remainingIds = activeCharacters
        .filter(ac => ac.character_id !== characterId)
        .map(ac => ac.character_id)

      const { error: updateSessionError } = await supabase
        .from('chat_sessions')
        .update({
          active_characters: remainingIds,
          session_type: remainingIds.length > 1 ? 'multi' : 'single',
          // 如果移除的是当前发言角色，切换到第一个剩余角色
          current_speaker_id: session.current_speaker_id === characterId
            ? remainingIds[0]
            : session.current_speaker_id
        })
        .eq('id', sessionId)

      if (updateSessionError) {
        throw new Error('更新会话信息失败')
      }

      return true

    } catch (error) {
      console.error('从会话移除角色失败:', error)
      return false
    }
  }

  /**
   * 切换当前发言角色
   */
  static async switchSpeaker(params: {
    sessionId: string
    characterId: number
    userId: string
  }): Promise<boolean> {
    const { sessionId, characterId, userId } = params

    try {
      // 验证角色是否在会话中且活跃
      const { data: sessionCharacter, error: scError } = await supabase
        .from('session_characters')
        .select(`
          *,
          chat_sessions!inner(user_id)
        `)
        .eq('session_id', sessionId)
        .eq('character_id', characterId)
        .eq('is_active', true)
        .single()

      if (scError || !sessionCharacter) {
        throw new Error('角色不在当前会话中或已非活跃')
      }

      // 验证用户权限
      if (sessionCharacter.chat_sessions.user_id !== userId) {
        throw new Error('无权限操作此会话')
      }

      // 更新当前发言角色
      const { error: updateError } = await supabase
        .from('chat_sessions')
        .update({ current_speaker_id: characterId })
        .eq('id', sessionId)

      if (updateError) {
        throw new Error('切换发言角色失败')
      }

      return true

    } catch (error) {
      console.error('切换发言角色失败:', error)
      return false
    }
  }

  /**
   * 获取会话的角色发言统计
   */
  static async getSpeakingStats(sessionId: string): Promise<{
    character_id: number
    character_name: string
    speak_count: number
    last_spoke_at?: string
    is_current_speaker: boolean
  }[]> {
    try {
      const { data, error } = await supabase
        .rpc('get_session_active_characters', {
          p_session_id: sessionId
        })

      if (error) {
        console.error('获取发言统计失败:', error)
        return []
      }

      return data || []

    } catch (error) {
      console.error('获取发言统计失败:', error)
      return []
    }
  }

  /**
   * 构建多角色对话的系统提示词
   */
  static buildMultiCharacterPrompt(params: {
    activeCharacters: Character[]
    currentSpeaker: Character
    conversationContext?: string
  }): string {
    const { activeCharacters, currentSpeaker, conversationContext } = params

    const otherCharacters = activeCharacters.filter(c => c.id !== currentSpeaker.id)

    let prompt = `# 多角色对话模式

## 当前发言角色
你现在需要扮演：**${currentSpeaker.name}**

${currentSpeaker.prompt_template ? JSON.stringify(currentSpeaker.prompt_template, null, 2) : ''}

## 对话中的其他角色
${otherCharacters.map(char => `
### ${char.name}
${char.prompt_template?.basic_info?.description || ''}
- 性格特点: ${char.prompt_template?.personality?.traits?.join('、') || '未设定'}
- 说话风格: ${char.prompt_template?.speech_style?.description || '未设定'}
`).join('\n')}

## 重要提示
1. 你只需要以 **${currentSpeaker.name}** 的身份回应
2. 保持角色的一致性和独特性
3. 考虑与其他在场角色的关系和互动
4. 回应应该符合当前角色的人设和说话风格
5. 不要代替其他角色发言

${conversationContext ? `\n## 对话背景\n${conversationContext}` : ''}
`

    return prompt
  }

  /**
   * 转换普通会话为多角色会话
   */
  static async convertToMultiCharacter(params: {
    sessionId: string
    additionalCharacterIds: number[]
    userId: string
  }): Promise<boolean> {
    const { sessionId, additionalCharacterIds, userId } = params

    try {
      // 获取现有会话
      const { data: session, error: sessionError } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single()

      if (sessionError || !session) {
        throw new Error('会话不存在')
      }

      const allCharacterIds = [session.character_id, ...additionalCharacterIds]

      // 验证所有角色
      const { data: characters, error: charError } = await supabase
        .from('characters')
        .select('*')
        .in('id', allCharacterIds)
        .eq('user_id', userId)

      if (charError || !characters || characters.length !== allCharacterIds.length) {
        throw new Error('部分角色不存在或无权限')
      }

      // 更新会话为多角色模式
      const { error: updateError } = await supabase
        .from('chat_sessions')
        .update({
          session_type: 'multi',
          active_characters: allCharacterIds,
          current_speaker_id: session.character_id
        })
        .eq('id', sessionId)

      if (updateError) {
        throw new Error('转换会话失败')
      }

      // 创建session_characters记录
      const sessionCharacters = allCharacterIds.map((charId, index) => ({
        session_id: sessionId,
        character_id: charId,
        is_active: true,
        join_order: index + 1,
        speak_count: charId === session.character_id ?
          // 主角色的发言次数（现有assistant消息数）
          0 : 0 // 新角色发言次数为0
      }))

      const { error: insertError } = await supabase
        .from('session_characters')
        .upsert(sessionCharacters, {
          onConflict: 'session_id,character_id'
        })

      if (insertError) {
        throw new Error('创建角色关联失败')
      }

      // 更新现有消息的speaker信息
      await supabase
        .from('chat_messages')
        .update({
          speaker_character_id: session.character_id,
          speaker_type: 'character'
        })
        .eq('session_id', sessionId)
        .eq('role', 'assistant')

      await supabase
        .from('chat_messages')
        .update({
          speaker_character_id: null,
          speaker_type: 'user'
        })
        .eq('session_id', sessionId)
        .eq('role', 'user')

      return true

    } catch (error) {
      console.error('转换为多角色会话失败:', error)
      return false
    }
  }

  // 实例方法包装静态方法

  /**
   * 检查会话是否为多角色模式（基于剧本类型）
   */
  async isMultiCharacterSession(sessionId: string): Promise<boolean> {
    try {
      // 获取会话关联的剧本信息
      const { data: session, error: sessionError } = await supabase
        .from('chat_sessions')
        .select('character_id')
        .eq('id', sessionId)
        .eq('user_id', this.userId)
        .single()

      if (sessionError || !session) {
        return false
      }

      // 获取剧本的类型和角色列表
      const { data: script, error: scriptError } = await supabase
        .from('characters')
        .select('script_type, script_characters')
        .eq('id', session.character_id)
        .single()

      if (scriptError || !script) {
        return false
      }

      // 判断是否为多角色剧本
      return script.script_type === 'multi' &&
             script.script_characters &&
             Array.isArray(script.script_characters) &&
             script.script_characters.length > 1
    } catch (error) {
      console.error('检查会话类型失败:', error)
      return false
    }
  }

  /**
   * 转换会话为多角色模式
   */
  async convertSessionToMultiCharacter(sessionId: string, currentCharacterId: number): Promise<void> {
    const success = await MultiCharacterManager.convertToMultiCharacter({
      sessionId,
      additionalCharacterIds: [], // 初始转换只包含当前角色
      userId: this.userId
    })

    if (!success) {
      throw new Error('转换为多角色模式失败')
    }
  }

  /**
   * 获取剧本多角色会话上下文
   */
  async getMultiCharacterContext(sessionId: string): Promise<ScriptCharacterContext> {
    try {
      // 获取会话信息
      const { data: session, error: sessionError } = await supabase
        .from('chat_sessions')
        .select('*, current_script_character_id')
        .eq('id', sessionId)
        .eq('user_id', this.userId)
        .single()

      if (sessionError || !session) {
        throw new Error('获取会话信息失败')
      }

      // 获取剧本信息和角色列表
      const { data: script, error: scriptError } = await supabase
        .from('characters')
        .select('*')
        .eq('id', session.character_id)
        .single()

      if (scriptError || !script) {
        throw new Error('获取剧本信息失败')
      }

      const scriptCharacters = script.script_characters || []

      // 获取当前发言角色
      const currentSpeaker = session.current_script_character_id
        ? scriptCharacters.find((char: ScriptCharacter) => char.id === session.current_script_character_id)
        : scriptCharacters[0] // 默认第一个角色

      // 获取发言统计
      const speakingHistory = await this.getScriptCharacterSpeakingStats(sessionId, scriptCharacters)

      // 获取最后发言的角色
      const lastSpeaker = speakingHistory
        .filter(s => s.last_spoke_at)
        .sort((a, b) => new Date(b.last_spoke_at!).getTime() - new Date(a.last_spoke_at!).getTime())[0]

      return {
        session: {
          ...session,
          character: script
        },
        script,
        scriptCharacters,
        currentSpeaker,
        lastSpeaker: lastSpeaker ? scriptCharacters.find((char: ScriptCharacter) => char.id === lastSpeaker.character_id) : undefined,
        speakingHistory
      }
    } catch (error) {
      console.error('获取多角色上下文失败:', error)
      throw error
    }
  }

  /**
   * 获取剧本内角色发言统计
   */
  private async getScriptCharacterSpeakingStats(
    sessionId: string,
    scriptCharacters: any[]
  ): Promise<{
    character_id: string
    character_name: string
    last_spoke_at: string
    speak_count: number
  }[]> {
    const stats = await Promise.all(
      scriptCharacters.map(async (char) => {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('created_at')
          .eq('session_id', sessionId)
          .eq('speaker_script_character_id', char.id)
          .eq('role', 'assistant')
          .order('created_at', { ascending: false })

        if (error) {
          console.error(`获取角色${char.id}发言统计失败:`, error)
          return {
            character_id: char.id,
            character_name: char.name,
            last_spoke_at: '',
            speak_count: 0
          }
        }

        return {
          character_id: char.id,
          character_name: char.name,
          last_spoke_at: data.length > 0 ? data[0].created_at : '',
          speak_count: data.length
        }
      })
    )

    return stats
  }

  /**
   * 添加角色到会话
   */
  async addCharacterToSession(sessionId: string, characterId: number): Promise<void> {
    const success = await MultiCharacterManager.addCharacterToSession({
      sessionId,
      characterId,
      userId: this.userId
    })

    if (!success) {
      throw new Error('添加角色失败')
    }
  }

  /**
   * 从会话移除角色
   */
  async removeCharacterFromSession(sessionId: string, characterId: number): Promise<void> {
    const success = await MultiCharacterManager.removeCharacterFromSession({
      sessionId,
      characterId,
      userId: this.userId
    })

    if (!success) {
      throw new Error('移除角色失败')
    }
  }

  /**
   * 切换剧本内当前发言角色
   */
  async switchCurrentSpeaker(sessionId: string, scriptCharacterId: string): Promise<void> {
    try {
      // 更新会话的当前发言角色
      const { error } = await supabase
        .from('chat_sessions')
        .update({
          current_script_character_id: scriptCharacterId
        })
        .eq('id', sessionId)
        .eq('user_id', this.userId)

      if (error) {
        throw error
      }
    } catch (error) {
      console.error('切换剧本内发言角色失败:', error)
      throw new Error('切换发言角色失败')
    }
  }

  /**
   * 获取会话角色发言统计
   */
  async getSpeakingStats(sessionId: string) {
    return MultiCharacterManager.getSpeakingStats(sessionId)
  }

  /**
   * 创建多角色会话（实例方法）
   */
  async createMultiCharacterSession(params: {
    characterIds: number[]
    title?: string
    rotationMode?: 'manual' | 'auto'
  }) {
    return MultiCharacterManager.createMultiCharacterSession({
      ...params,
      userId: this.userId
    })
  }
}
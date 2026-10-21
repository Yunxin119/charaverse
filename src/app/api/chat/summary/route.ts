import { NextRequest, NextResponse } from 'next/server'
import { completeText } from '@/lib/llm/complete'
import { CONNECTION_HEADER, decodeConnection } from '@/lib/llm/connection'
import { z } from 'zod'
import { requireUser } from '@/lib/server/auth'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/server/rateLimit'
import { renderSummaryTask, resolveSummaryTask } from '@/lib/tasks/summary'

interface SummaryGenerateRequest {
  sessionId: string
  userId: string
  startMessageId?: number
  endMessageId?: number
  summaryContent?: string    // 用于超级摘要
  characterName: string
  useMemoryTable?: boolean   // 是否使用记忆表格格式
  summaryId?: number         // 重新生成时的摘要ID
}

const MEMORY_TYPES = ['character', 'event', 'setting', 'emotion', 'spacetime', 'relationship', 'task', 'item'] as const
const memoryEntrySchema = z.object({
  action: z.enum(['create', 'update']).default('create'),
  existing_id: z.string().max(120).optional(),
  type: z.enum(MEMORY_TYPES),
  title: z.string().min(1).max(120),
  content: z.string().min(1).max(4000),
  importance: z.coerce.number().int().min(1).max(10).catch(5),
  metadata: z.record(z.string(), z.unknown()).catch({}),
})
type MemoryEntry = z.infer<typeof memoryEntrySchema>
const MAX_MEMORIES_PER_SUMMARY = 40
const MAX_SUMMARY_CHARS = 20_000
const MAX_METADATA_CHARS = 2_000

/** Keep only well-formed memory entries; the model's output is untrusted. */
function validateMemories(raw: unknown): MemoryEntry[] {
  if (!Array.isArray(raw)) return []
  const out: MemoryEntry[] = []
  for (const item of raw.slice(0, MAX_MEMORIES_PER_SUMMARY)) {
    const r = memoryEntrySchema.safeParse(item)
    if (!r.success) continue
    if (JSON.stringify(r.data.metadata).length > MAX_METADATA_CHARS) r.data.metadata = {}
    out.push(r.data)
  }
  return out
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request)
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 })
    const { user, supabase } = auth
    const limited = await enforceRateLimit(supabase, user.id, RATE_LIMITS.summary)
    if (limited) return limited

    if (!decodeConnection(request.headers.get(CONNECTION_HEADER))) {
      return NextResponse.json({ error: '缺少模型连接信息（API Key）' }, { status: 400 })
    }


    // 解析请求体
    const {
      sessionId,
      userId,
      startMessageId,
      endMessageId,
      characterName,
      useMemoryTable = false,
      summaryId
    } = await request.json() as SummaryGenerateRequest
    
    if (!sessionId || !userId || !characterName) {
      return NextResponse.json({ error: '缺少必需参数' }, { status: 400 })
    }

    // 验证用户权限
    if (user.id !== userId) {
      return NextResponse.json({ error: '无权限操作' }, { status: 403 })
    }

    // 普通摘要模式
    if (!startMessageId || !endMessageId) {
      return NextResponse.json({ error: '缺少消息ID范围' }, { status: 400 })
    }

    // 获取会话和角色信息
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select(`
        *,
        characters!inner(*)
      `)
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: '找不到会话信息' }, { status: 404 })
    }

    const character = session.characters
    if (!character) {
      return NextResponse.json({ error: '找不到角色信息' }, { status: 404 })
    }

    // 获取要摘要的消息
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .gte('id', startMessageId)
      .lte('id', endMessageId)
      .order('created_at', { ascending: true })

    if (messagesError || !messages || messages.length === 0) {
      return NextResponse.json({ error: '找不到要摘要的消息' }, { status: 404 })
    }

    const messageCount = messages.length
    
    // 格式化对话文本，保留更多细节供AI参考
    const conversationText = messages
      .map(msg => {
         // 包含时间戳，帮助AI判断时间流逝
         const timeStr = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''
         return `[${timeStr}] ${msg.role === 'user' ? '用户' : characterName}: ${msg.content}`
      })
      .join('\n')

    // 构建角色设定信息
    let characterContext = ''
    let userPersonaContext = ''

    if (character) {
      const prompt = character.prompt_template
      if (prompt) {
        characterContext += '\n<character_card>\n'

        if (prompt.basic_info) {
          characterContext += `角色名称: ${prompt.basic_info.name || characterName}\n`
          if (prompt.basic_info.age) characterContext += `年龄: ${prompt.basic_info.age}\n`
          if (prompt.basic_info.occupation) characterContext += `职业: ${prompt.basic_info.occupation}\n`
          if (prompt.basic_info.description) characterContext += `基本描述: ${prompt.basic_info.description}\n`
        }

        if (prompt.personality && prompt.personality.traits) {
          characterContext += `性格特点: ${prompt.personality.traits.join('、')}\n`
        }

        if (prompt.appearance && prompt.appearance.description) {
          characterContext += `外貌描述: ${prompt.appearance.description}\n`
        }

        if (prompt.background && prompt.background.description) {
          characterContext += `背景设定: ${prompt.background.description}\n`
        }

        if (prompt.relationships && prompt.relationships.length > 0) {
          characterContext += `关系设定: ${prompt.relationships.map((r: { character: string; relationship: string }) => `${r.character}: ${r.relationship}`).join('、')}\n`
        }

        if (prompt.speech_style && prompt.speech_style.description) {
          characterContext += `说话风格: ${prompt.speech_style.description}\n`
        }

        if (prompt.world_setting && prompt.world_setting.description) {
          characterContext += `世界观设定: ${prompt.world_setting.description}\n`
        }

        // 提取用户角色设定
        if (prompt.modules && Array.isArray(prompt.modules)) {
          const userPersonaModule = prompt.modules.find((m: any) => m.type === '用户角色设定')
          if (userPersonaModule) {
            userPersonaContext += '\n<user_persona>\n'
            if (userPersonaModule.userRoleName) {
              userPersonaContext += `用户角色姓名: ${userPersonaModule.userRoleName}\n`
            }
            if (userPersonaModule.userRoleAge) {
              userPersonaContext += `用户角色年龄: ${userPersonaModule.userRoleAge}\n`
            }
            if (userPersonaModule.userRoleGender) {
              const genderMap: Record<string, string> = {
                'male': '男',
                'female': '女',
                'none': '无性别',
                'other': '其他'
              }
              userPersonaContext += `用户角色性别: ${genderMap[userPersonaModule.userRoleGender] || userPersonaModule.userRoleGender}\n`
            }
            if (userPersonaModule.userRoleDetails) {
              userPersonaContext += `用户角色详细设定: ${userPersonaModule.userRoleDetails}\n`
            }
          }
        }
      }
    }

    // 获取之前的摘要和记忆作为上下文
    let previousContext = ''
    try {
      // 获取之前的摘要 - 只包含完全在新摘要范围之前的摘要
      let summaryQuery = supabase
        .from('chat_summaries')
        .select('id, content, start_message_id, end_message_id')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .lt('end_message_id', startMessageId)  // 确保摘要结束位置在新摘要开始位置之前
        .not('start_message_id', 'is', null)
        .not('end_message_id', 'is', null)

      // 如果是重新生成摘要，排除当前摘要本身
      if (summaryId) {
        summaryQuery = summaryQuery.neq('id', summaryId)
      }

      const { data: previousSummaries } = await summaryQuery.order('end_message_id', { ascending: true })

      // 获取之前的重要记忆 - 只包含来自仍然有效的摘要的记忆
      const previousSummaryIds = previousSummaries?.map(s => s.id) || []
      let previousMemories = null

      if (previousSummaryIds.length > 0) {
        // 获取所有现有记忆（不仅仅是之前摘要的，包括所有会话的记忆）
        // 这样AI可以决定是否需要更新/合并现有记忆
        const { data: memories } = await supabase
          .from('chat_memories')
          .select('id, type, title, content, importance, metadata, summary_id')
          .eq('session_id', sessionId)
          .eq('user_id', userId)
          .eq('is_enabled', true)
          .gte('importance', 6) // 包含重要度6分以上的记忆
          .order('importance', { ascending: false })
          .limit(30) // 增加到30条，让AI有更多上下文来判断是否需要合并

        previousMemories = memories
      }

      if (previousSummaries && previousSummaries.length > 0) {
        previousContext += '\n<previous_summaries>\n'
        previousSummaries.forEach((s, i) => {
          previousContext += `摘要${i+1} (消息#${s.start_message_id}-#${s.end_message_id}): ${s.content}\n`
        })
      }

      if (previousMemories && previousMemories.length > 0) {
        previousContext += '\n<existing_memories>\n'
        previousContext += '以下是已存在的记忆条目。如果当前对话提供了新信息，请UPDATE这些条目而不是创建新条目。\n\n'

        // 按类型分组显示现有记忆
        const memoryByType = previousMemories.reduce((groups: any, m: any) => {
          if (!groups[m.type]) groups[m.type] = []
          groups[m.type].push(m)
          return groups
        }, {})

        for (const [type, mems] of Object.entries(memoryByType)) {
          previousContext += `\n【${type}类记忆】\n`
          ;(mems as any[]).forEach((m: any) => {
            previousContext += `  ID: ${m.id}\n`
            previousContext += `  标题: ${m.title}\n`
            previousContext += `  内容: ${m.content}\n`
            previousContext += `  重要度: ${m.importance}\n`
            if (m.metadata && Object.keys(m.metadata).length > 0) {
              previousContext += `  元数据: ${JSON.stringify(m.metadata)}\n`
            }
            previousContext += `\n`
          })
        }
      }
    } catch (error) {
    }

    if (characterContext) characterContext += '</character_card>\n'
    if (userPersonaContext) userPersonaContext += '</user_persona>\n'
    if (previousContext) previousContext += '\n</previous_context>\n'
    if (previousContext) previousContext = previousContext.replace('\n<previous_summaries>', '\n<previous_context>\n<previous_summaries>')

    // 任务 prompt：用户可在「我的 → 任务提示词」覆盖；未覆盖用默认
    const { data: taskRow } = await supabase.from('user_task_prompts').select('data').eq('user_id', userId).eq('task', 'summary').maybeSingle()
    const task = resolveSummaryTask(taskRow?.data)
    const rendered = renderSummaryTask(task, useMemoryTable ? 'memory' : 'story', {
      characterCard: characterContext,
      userPersona: userPersonaContext,
      previousContext,
      conversation: `<conversation>\n${conversationText}\n</conversation>`,
      charName: characterName,
    })

    const connection = decodeConnection(request.headers.get(CONNECTION_HEADER))
    if (!connection) {
      return NextResponse.json({ error: '缺少模型连接信息' }, { status: 400 })
    }
    const completion = await completeText({
      connection,
      instructions: rendered.instructions,
      messages: [{ role: 'user', content: rendered.prompt }],
      sampling: { temperature: task.sampling.temperature, max_tokens: task.sampling.max_tokens },
    })
    const aiResult = { content: completion.text }
    let generatedSummary = aiResult.content || '摘要生成失败'
    let memoryEntries: MemoryEntry[] = []
    let memoryTableData: any = null

    // 💡 针对故事模式的后处理：如果AI还是输出了markdown代码块，去掉它
    if (!useMemoryTable) {
      generatedSummary = generatedSummary
        .replace(/^```markdown\s*/, '')
        .replace(/^```\s*/, '')
        .replace(/\s*```$/, '')
        .trim()
    }

    // 处理记忆表格格式的响应
    if (useMemoryTable) {
      try {
        // 清理AI响应中的代码块标记
        let cleanedResponse = generatedSummary.trim()

        // 移除可能的代码块包装
        if (cleanedResponse.startsWith('```json')) {
          cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '')
        } else if (cleanedResponse.startsWith('```')) {
          cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '')
        }

        // 移除可能的前导/尾随文本
        const jsonStart = cleanedResponse.indexOf('{')
        const jsonEnd = cleanedResponse.lastIndexOf('}')

        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          cleanedResponse = cleanedResponse.substring(jsonStart, jsonEnd + 1)
        }

        // 尝试解析JSON格式的响应
        const parsedResult = JSON.parse(cleanedResponse)
        if (typeof parsedResult?.summary === 'string' && parsedResult.summary.trim()) {
          generatedSummary = parsedResult.summary
          memoryEntries = validateMemories(parsedResult.memories)
          memoryTableData = { summary: generatedSummary, memories: memoryEntries }
        }
      } catch {
        // not JSON → keep the raw text as a plain summary
      }
    }
    generatedSummary = String(generatedSummary).slice(0, MAX_SUMMARY_CHARS)

    // 保存摘要到数据库
    const insertData: Record<string, unknown> = {
      session_id: sessionId,
      user_id: userId,
      content: generatedSummary,
      original_message_count: messageCount,
      summary_method: 'ai_generated',
      summary_level: 1, // 只有普通摘要
      is_active: true,
      memory_table: memoryTableData, // 保存完整的记忆表格数据
      start_message_id: startMessageId,
      end_message_id: endMessageId
    }

    let summary
    if (summaryId) {
      // 重新生成现有摘要
      const { data: updatedSummary, error: updateError } = await supabase
        .from('chat_summaries')
        .update({
          content: generatedSummary,
          memory_table: memoryTableData,
          updated_at: new Date().toISOString()
        })
        .eq('id', summaryId)
        .eq('user_id', userId) // 确保用户只能更新自己的摘要
        .select()
        .single()

      if (updateError) {
        console.error('更新摘要失败:', updateError)
        return NextResponse.json({ error: '更新摘要失败' }, { status: 500 })
      }

      summary = updatedSummary
    } else {
      // 创建新摘要
      const { data: newSummary, error: insertError } = await supabase
        .from('chat_summaries')
        .insert(insertData)
        .select()
        .single()

      if (insertError) {
        console.error('保存摘要失败:', insertError)
        return NextResponse.json({ error: '保存摘要失败' }, { status: 500 })
      }

      summary = newSummary
    }

    // 保存/更新记忆条目到数据库 (仅当useMemoryTable为true且解析成功时)
    let savedMemories: any[] = []
    if (memoryEntries.length > 0) {
      // 如果是重新生成，先删除与该摘要相关的旧记忆条目
      if (summaryId) {
        await supabase
          .from('chat_memories')
          .delete()
          .eq('summary_id', summaryId)
          .eq('user_id', userId)
      }

      // 分离update和create操作
      const memoriesToUpdate: any[] = []
      const memoriesToCreate: any[] = []

      memoryEntries.forEach((memory: any, index: number) => {
        const action = memory.action || 'create'
        const existingId = memory.existing_id

        if (action === 'update' && existingId) {
          // 更新现有记忆
          memoriesToUpdate.push({
            id: existingId,
            title: memory.title,
            content: memory.content,
            importance: Math.max(1, Math.min(10, memory.importance || 5)),
            metadata: memory.metadata || {},
            updated_at: new Date().toISOString()
          })
        } else {
          // 创建新记忆
          memoriesToCreate.push({
            id: `${summary.id}_${index}_${Date.now()}`,
            session_id: sessionId,
            user_id: userId,
            type: memory.type,
            title: memory.title,
            content: memory.content,
            importance: Math.max(1, Math.min(10, memory.importance || 5)),
            metadata: memory.metadata || {},
            source: 'auto',
            summary_id: summary.id,
            start_message_id: startMessageId,
            end_message_id: endMessageId
          })
        }
      })

      // 执行更新操作
      for (const memory of memoriesToUpdate) {
        // 先获取现有记忆的完整内容
        const { data: existingMemory } = await supabase
          .from('chat_memories')
          .select('*')
          .eq('id', memory.id)
          .eq('user_id', userId)
          .eq('session_id', sessionId)
          .maybeSingle()

        if (!existingMemory) continue

        // 智能合并内容：采用保守策略，优先保留旧内容
        let mergedContent = memory.content
        const hasNewAddition = memory.content.includes('【新增】') || memory.content.includes('[新增]')

        if (hasNewAddition) {
          mergedContent = memory.content
        } else {
          // 简单的合并逻辑：如果没有明确新增标记，且内容差异巨大，则追加
          const oldLength = existingMemory.content.length
          const newLength = memory.content.length
          const lengthRatio = newLength / oldLength

          // 如果新内容比旧内容短很多，或者看起来是完全重写，则追加以防丢失信息
          if (lengthRatio < 0.8) {
             mergedContent = `${existingMemory.content}\n\n【新增信息】${memory.content}`
          }
        }

        // 合并 metadata
        const mergedMetadata = {
          ...existingMemory.metadata,
          ...memory.metadata
        }

        // 版本控制记录 (简化错误处理)
        const currentVersion = existingMemory.current_version || 1
        const newVersion = currentVersion + 1
        
        try {
            await supabase.from('chat_memory_versions').insert({
                id: `${memory.id}_v${currentVersion}_${Date.now()}`,
                memory_id: memory.id,
                version: currentVersion,
                title: existingMemory.title,
                content: existingMemory.content,
                importance: existingMemory.importance,
                metadata: existingMemory.metadata,
                summary_id: existingMemory.summary_id,
                created_by_summary_id: existingMemory.summary_id,
                start_message_id: existingMemory.start_message_id,
                end_message_id: existingMemory.end_message_id,
                created_at: new Date().toISOString()
            })
        } catch { /* version history is best-effort */ }

        // 更新主记忆表
        const { error: updateError } = await supabase
          .from('chat_memories')
          .update({
            title: memory.title,
            content: mergedContent,
            importance: memory.importance,
            metadata: mergedMetadata,
            summary_id: summary.id,
            current_version: newVersion,
            start_message_id: startMessageId,
            end_message_id: endMessageId,
            updated_at: memory.updated_at
          })
          .eq('id', memory.id)
          .eq('user_id', userId)

        if (!updateError) {
          const { data: updated } = await supabase
            .from('chat_memories')
            .select('*')
            .eq('id', memory.id)
            .single()
          if (updated) savedMemories.push(updated)
        }
      }

      // 批量插入新建的记忆条目
      if (memoriesToCreate.length > 0) {
        const { data: insertedMemories, error: memoriesError } = await supabase
          .from('chat_memories')
          .insert(memoriesToCreate)
          .select()

        if (!memoriesError) {
          savedMemories.push(...(insertedMemories || []))
        }
      }
    }

    return NextResponse.json({
      summary,
      memories: savedMemories,
      message: summaryId ? '摘要重新生成成功' : '摘要生成成功'
    })

  } catch (error) {
    console.error('[api/chat/summary] failed:', error instanceof Error ? error.name : 'unknown')
    return NextResponse.json({ error: error instanceof Error && /API|连接|模型|Key/i.test(error.message) ? error.message : '摘要生成失败，请稍后重试' }, { status: 500 })
  }
}

// 获取会话的所有摘要
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    
    if (!sessionId) {
      return NextResponse.json({ error: '缺少sessionId参数' }, { status: 400 })
    }

    const auth = await requireUser(request)
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 })
    const { user, supabase } = auth

    // 获取摘要列表
    const { data: summaries, error } = await supabase
      .from('chat_summaries')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('获取摘要失败:', error)
      return NextResponse.json({ error: '获取摘要失败' }, { status: 500 })
    }

    return NextResponse.json({ summaries })

  } catch (error) {
    console.error('获取摘要失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器内部错误' },
      { status: 500 }
    )
  }
}
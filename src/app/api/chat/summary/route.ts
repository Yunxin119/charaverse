import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

interface MemoryEntry {
  type: 'character' | 'event' | 'setting' | 'emotion'
  title: string
  content: string
  importance: number
  metadata?: any
}

export async function POST(request: NextRequest) {
  try {
    // 创建Supabase客户端
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    
    // 获取用户的access token
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '缺少认证token' }, { status: 401 })
    }
    
    const accessToken = authHeader.replace('Bearer ', '')
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    })

    // 获取API密钥和模型（从header中）
    const apiKey = request.headers.get('x-api-key')
    const model = request.headers.get('x-model') || 'deepseek-chat'
    const baseUrl = request.headers.get('x-base-url') || ''
    const actualModel = request.headers.get('x-actual-model') || ''
    const thinkingBudget = request.headers.get('x-thinking-budget') ? parseInt(request.headers.get('x-thinking-budget')!) : undefined
    
    if (!apiKey) {
      return NextResponse.json({ error: '缺少API密钥' }, { status: 400 })
    }

    // 验证用户身份
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '用户身份验证失败' }, { status: 401 })
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
    const conversationText = messages
      .map(msg => `${msg.role === 'user' ? '用户' : characterName}: ${msg.content}`)
      .join('\n')

    // 构建角色设定信息
    let characterContext = ''
    if (character) {
      const prompt = character.prompt_template
      if (prompt) {
        characterContext += '\n【角色设定信息】\n'

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
        console.log(`🔄 重新生成摘要 ${summaryId}，排除自身`)
      }

      const { data: previousSummaries } = await summaryQuery.order('end_message_id', { ascending: true })

      console.log(`🔍 查找之前的摘要: end_message_id < ${startMessageId}`)
      console.log(`📚 找到${previousSummaries?.length || 0}个之前的摘要`)

      // 获取之前的重要记忆 - 只包含来自仍然有效的摘要的记忆
      const previousSummaryIds = previousSummaries?.map(s => s.id) || []
      let previousMemories = null

      if (previousSummaryIds.length > 0) {
        const { data: memories } = await supabase
          .from('chat_memories')
          .select('type, title, content, importance, summary_id')
          .eq('session_id', sessionId)
          .eq('user_id', userId)
          .gte('importance', 7) // 只包含重要度7分以上的记忆
          .in('summary_id', previousSummaryIds) // 只包含来自有效之前摘要的记忆
          .order('importance', { ascending: false })
          .limit(10) // 最多10条重要记忆

        previousMemories = memories
        console.log(`🧠 找到${previousMemories?.length || 0}个来自有效摘要的记忆`)
      } else {
        console.log(`⚠️ 没有之前的摘要，跳过记忆查询`)
      }

      if (previousSummaries && previousSummaries.length > 0) {
        previousContext += '\n【之前的对话摘要】\n'
        previousSummaries.forEach((s, i) => {
          previousContext += `摘要${i+1} (消息#${s.start_message_id}-#${s.end_message_id}): ${s.content}\n`
        })
        console.log(`✅ 将参考${previousSummaries.length}个之前的摘要:`,
          previousSummaries.map(s => `#${s.start_message_id}-#${s.end_message_id}`))
      } else {
        console.log(`ℹ️ 没有之前的摘要可供参考`)
      }

      if (previousMemories && previousMemories.length > 0) {
        previousContext += '\n【重要记忆回顾】\n'
        previousMemories.forEach(m => {
          previousContext += `• ${m.title} (${m.type}, 重要度${m.importance}): ${m.content}\n`
        })
      }
    } catch (error) {
      console.error('获取历史上下文失败:', error)
    }

    let summaryPrompt = ''
    if (useMemoryTable) {
      summaryPrompt = `请分析以下对话，参考角色设定、之前的摘要和重要记忆，生成结构化的记忆表格和简洁摘要。
${characterContext ? `${characterContext}\n` : ''}${previousContext ? `${previousContext}\n` : ''}
请严格按照以下JSON格式返回，不要添加任何其他内容：

{
  "summary": "这里是200-300字的传统摘要，要体现与之前对话的连续性",
  "memories": [
    {
      "type": "character",
      "title": "人物名称",
      "content": "详细的人物信息、关系变化、称呼习惯等",
      "importance": 8,
      "metadata": {"name": "张三", "relationship": "朋友", "appearance": "高挑", "personality": "温和", "nickname": "小张", "age": "25岁", "occupation": "设计师"}
    },
    {
      "type": "event",
      "title": "事件标题",
      "content": "事件详细描述，包括时间、地点、参与者、结果",
      "importance": 7,
      "metadata": {"time": "今天下午3点", "location": "咖啡厅", "participants": ["用户", "${characterName}"], "impact": "关系更进一步", "event_type": "conversation", "consequences": "约定下次见面"}
    },
    {
      "type": "setting",
      "title": "场所设定",
      "content": "地点、物品、规则、背景设定的详细信息",
      "importance": 6,
      "metadata": {"location": "星巴克咖啡厅", "atmosphere": "温馨安静", "items": ["特制咖啡", "蛋糕"], "significance": "第一次约会地点"}
    },
    {
      "type": "emotion",
      "title": "情感变化",
      "content": "情感状态的变化、原因、强度等",
      "importance": 5,
      "metadata": {"emotion_type": "开心", "intensity": 8, "cause": "收到礼物", "duration": "持续", "target": "${characterName}", "trigger": "意外惊喜"}
    },
    {
      "type": "spacetime",
      "title": "时空场景",
      "content": "具体的时间地点和当时的环境描述",
      "importance": 6,
      "metadata": {"date": "2024年3月15日", "time": "下午3点", "location": "市中心咖啡厅", "characters": ["用户", "${characterName}"], "weather": "晴朗", "atmosphere": "温馨浪漫"}
    },
    {
      "type": "relationship",
      "title": "关系状态",
      "content": "角色间关系的发展和变化",
      "importance": 8,
      "metadata": {"character_name": "${characterName}", "relationship": "恋人", "attitude": "亲密", "affection": 9, "trust": 8, "last_interaction": "今天的约会"}
    },
    {
      "type": "task",
      "title": "约定任务",
      "content": "双方达成的约定、承诺或计划",
      "importance": 7,
      "metadata": {"assigned_by": "用户", "assigned_to": "${characterName}", "task_type": "appointment", "location": "电影院", "scheduled_time": "下周六晚上7点", "duration": "3小时", "status": "pending", "priority": "high"}
    },
    {
      "type": "item",
      "title": "重要物品",
      "content": "对话中提到的重要物品及其意义",
      "importance": 6,
      "metadata": {"item_name": "项链", "owner": "${characterName}", "description": "银质心形项链", "importance_reason": "第一份礼物", "location": "随身佩戴", "acquisition_method": "用户赠送", "emotional_value": 9}
    }
  ]
}

注意事项：
- 摘要要体现与之前对话的连续性和发展
- 只记录新增或有变化的重要信息
- 避免与已有记忆重复，除非有显著更新
- 只基于【当前对话内容】和【已提供的之前摘要】，不要参考任何已删除的摘要内容
- type必须是character/event/setting/emotion/spacetime/relationship/task/item之一
- importance是1-10的数字，10最重要
- content要详细具体，便于后续回忆
- metadata提供额外的结构化信息，根据不同type包含相应字段：
  * character: name, relationship, appearance, personality, nickname, age, occupation等
  * event: time, location, participants, impact, event_type, consequences等
  * setting: location, atmosphere, items, significance等
  * emotion: emotion_type, intensity, cause, duration, target, trigger等
  * spacetime: date, time, location, characters, weather, atmosphere等
  * relationship: character_name, relationship, attitude, affection, trust, last_interaction等
  * task: assigned_by, assigned_to, task_type, location, scheduled_time, duration, status, priority等
  * item: item_name, owner, description, importance_reason, location, acquisition_method, emotional_value等

要求：
- 严格遵循提供的角色设定信息，确保生成的记忆和摘要符合角色的人设
- 记忆表格的content字段要详细，包含具体的对话细节和情境
- 重要度评分要准确反映对故事发展的影响程度
- 摘要要体现角色特色和世界观背景

当前对话内容：
${conversationText}

JSON结果：`
    } else {
      summaryPrompt = `请为以下对话生成一个简洁的摘要，参考角色设定、之前的摘要和重要记忆。
${characterContext ? `${characterContext}\n` : ''}${previousContext ? `${previousContext}\n` : ''}
摘要要求：
1. 关键事件和情节发展
2. 重要的约定、决定或承诺
3. 角色关系的变化
4. 重要的背景信息
5. 角色之间的互动模式和称呼习惯(重要)
6. 体现与之前对话的连续性和发展
7. 结合角色设定信息理解对话深层含义
8. 只基于【当前对话内容】、【角色设定信息】和【已提供的之前摘要】，不要参考任何已删除的摘要内容

格式要求：
- 直接开始生成，不要"好的，这是为这个对话生成的摘要"或类似开场白
- 使用第三人称描述
- 保持客观中性的语调
- 控制在200-300字
- 重点突出对后续对话有影响的信息

当前对话内容：
${conversationText}

摘要：`
    }

    // 调用AI API生成摘要
    const serverBaseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const requestBody: Record<string, unknown> = {
      messages: [{ role: 'user', content: summaryPrompt }],
      systemPrompt: `你是一个专业的对话摘要助手，能够准确提取对话中的关键信息。你需要特别关注角色设定信息，确保摘要能够体现角色的特点和设定背景，而不是仅仅总结对话表面内容。`,
      apiKey: apiKey || '',
      model: model || 'deepseek-chat'
    }
    
    // 添加thinking budget参数（如果有）
    if (thinkingBudget !== undefined) {
      requestBody.thinkingBudget = thinkingBudget
    }
    
    // 如果有中转API参数，添加到请求体中
    if (baseUrl && actualModel) {
      requestBody.baseUrl = baseUrl
      requestBody.actualModel = actualModel
    }

    // 添加调试日志
    // console.log('🎯 Chat API Request:', {
    //   messages: `${requestBody.messages ? (requestBody.messages as any[]).length : 0} messages`,
    //   systemPrompt: `${(requestBody.systemPrompt as string)?.length || 0} chars`,
    //   model: requestBody.model,
    //   thinkingBudget: requestBody.thinkingBudget,
    //   hasLegacyApiKey: !!apiKey,
    //   hasBaseUrl: !!baseUrl,
    //   actualModel: actualModel || 'undefined'
    // })
    
    const response = await fetch(`${serverBaseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('AI API调用失败:', response.status, errorText)
      throw new Error(`摘要生成失败: ${response.status} ${errorText}`)
    }

    const aiResult = await response.json()
    let generatedSummary = aiResult.content || '摘要生成失败'
    let memoryEntries: MemoryEntry[] = []
    let memoryTableData: any = null

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

        console.log('清理后的JSON响应:', cleanedResponse)

        // 尝试解析JSON格式的响应
        const parsedResult = JSON.parse(cleanedResponse)
        if (parsedResult.summary && parsedResult.memories) {
          generatedSummary = parsedResult.summary
          memoryEntries = parsedResult.memories
          memoryTableData = parsedResult
          console.log('成功解析记忆表格数据:', memoryEntries.length, '个记忆条目')
        }
      } catch (error) {
        console.warn('解析记忆表格JSON失败，使用传统摘要:', error)
        console.warn('原始响应:', generatedSummary)
        // 如果解析失败，就使用传统的摘要格式
      }
    }

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

    // 保存记忆条目到数据库
    let savedMemories: any[] = []
    if (memoryEntries.length > 0) {
      console.log('开始保存', memoryEntries.length, '个记忆条目')

      // 如果是重新生成，先删除与该摘要相关的旧记忆条目
      if (summaryId) {
        await supabase
          .from('chat_memories')
          .delete()
          .eq('summary_id', summaryId)
          .eq('user_id', userId)
      }

      // 准备记忆条目数据
      const memoriesToInsert = memoryEntries.map((memory, index) => ({
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
      }))

      // 批量插入记忆条目
      const { data: insertedMemories, error: memoriesError } = await supabase
        .from('chat_memories')
        .insert(memoriesToInsert)
        .select()

      if (memoriesError) {
        console.error('保存记忆条目失败:', memoriesError)
        // 记忆保存失败不影响摘要生成，只记录警告
      } else {
        savedMemories = insertedMemories || []
        console.log('成功保存', savedMemories.length, '个记忆条目')
      }
    }

    return NextResponse.json({
      summary,
      memories: savedMemories,
      message: summaryId ? '摘要重新生成成功' : '摘要生成成功'
    })

  } catch (error) {
    console.error('生成摘要失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器内部错误' },
      { status: 500 }
    )
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

    // 创建Supabase客户端
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    
    // 获取用户的access token
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '缺少认证token' }, { status: 401 })
    }
    
    const accessToken = authHeader.replace('Bearer ', '')
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    })

    // 验证用户身份
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '用户身份验证失败' }, { status: 401 })
    }

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
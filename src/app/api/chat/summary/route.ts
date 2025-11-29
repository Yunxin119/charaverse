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

// 定义风格示例（One-Shot Example），这是让AI学会你想要风格的关键
const STYLE_EXAMPLE = `
【风格参考范例】
输入对话：
程冉：(动作)靠在栏杆上，看你没穿鞋 (台词)“快憋死了...还是你聪明。”
林叙：(动作)看高跟鞋 (台词)“还是脚踏实地好...冠军都溜了，酒会还开吗？”
程冉：(动作)不在乎 (台词)“对着广告牌干杯就行...带你去吃路边摊？”
林叙：(动作)扔掉鞋 (台词)“走吧，开溜。”
(随后两人飙车去吃烧烤，并在车上有一段关于生活态度的对话)

输出故事：
香槟杯清脆的碰撞声，混杂着人群嗡嗡的低语，像一张无形的网，将程冉的耐心一寸寸勒紧...（省略中间描写）...他毫不犹豫地推门而出，带着凉意的晚风瞬间灌入肺里。
然后，他看见了她。她背对着他，光着脚，白皙的脚踝在夜色中像一段冷玉...
“快憋死了。”程冉走过去，靠在冰凉的栏杆上...
（重点描写了两人飙车时那种宣泄的快感，引擎的轰鸣与心跳的共振，以及最后在烧烤摊那种回归人间烟火的松弛感，保留了“冠军”、“刑具”、“开溜”等核心词汇，将简短的几句“去吃烧烤”扩写成了充满张力的逃离名利场的情节。）
`

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

        // 提取用户角色设定
        if (prompt.modules && Array.isArray(prompt.modules)) {
          const userPersonaModule = prompt.modules.find((m: any) => m.type === '用户角色设定')
          if (userPersonaModule) {
            userPersonaContext += '\n【用户角色设定】\n'
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
        previousContext += '\n【之前的对话摘要】\n'
        previousSummaries.forEach((s, i) => {
          previousContext += `摘要${i+1} (消息#${s.start_message_id}-#${s.end_message_id}): ${s.content}\n`
        })
      }

      if (previousMemories && previousMemories.length > 0) {
        previousContext += '\n【现有记忆表格（供更新/合并参考）】\n'
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
      console.error('获取历史上下文失败:', error)
    }

    let summaryPrompt = ''
    if (useMemoryTable) {
      // ✏️✏️✏️ 核心修改：将故事模式指令注入到记忆表格模式中 ✏️✏️✏️
      summaryPrompt = `你正在执行双重任务：1. 将对话改写为沉浸式小说（Story Mode）；2. 更新记忆数据库（Memory Table）。
${characterContext ? `${characterContext}\n` : ''}${userPersonaContext ? `${userPersonaContext}\n` : ''}${previousContext ? `${previousContext}\n` : ''}

【任务一：生成故事化摘要 (summary字段)】
参考以下风格范例，将对话转化为一段极具画面感和文学性的小说片段。
${STYLE_EXAMPLE}

**写作要求（至关重要）**：
1. **密度自适应**：高密度对话（情感爆发、冲突、调情）必须大幅扩写（3-5倍字数），描写微表情、环境氛围、心理活动；低密度对话可概括一些。尽量保留所有有意义的对话。
2. **叙事手法**：第三人称限制视角，"Show, Don't Tell"。保留所有剧情，不要省略。
3. **内容处理**：保留关键台词（用「」标注）、动作细节。
4. **篇幅**：2000-3000字（视对话细腻程度而定，宁可详尽不要简略）。
5. **特殊要求**：如果有性行为，不要过度省略，保留比较详细的描述和剧情。

【任务二：记忆表格更新 (memories字段)】
基于对话内容和上述故事，更新结构化记忆。
**核心原则**：记忆深化而非碎片化。优先UPDATE现有记忆。
**珍贵记忆**（重要度8-10）：核心背景、关键转折、深层情感、未了心愿。

【输出格式】
请严格按照以下JSON格式返回：

{
  "summary": "（在此处填入任务一要求的完整故事文本。请直接开始叙述，不要写前言。确保这是一篇精彩的小说，而不是枯燥的总结。）",
  "memories": [
    {
      "action": "update",
      "existing_id": "memory_123",
      "type": "character",
      "title": "...",
      "content": "...",
      "importance": 9,
      "metadata": {...}
    },
    ... (更多记忆条目)
  ]
}

【记忆操作说明】
1. **action**: "update" (需existing_id) 或 "create"。
2. **update策略**: 整合原有内容+新信息（标注【新增】），累积metadata。
3. **数量控制**: 优先更新，每次生成5-8个条目。

当前对话内容：
${conversationText}

JSON结果：`
    } else {
      // =====================================================
      // 纯故事模式 Prompt (非Memory Table)
      // =====================================================
      summaryPrompt = `你是一位擅长细腻情感描写和电影感叙事的畅销小说家。请将以下【对话记录】改写为一段【沉浸式小说片段】。

【输入信息】
1. 角色设定：
${characterContext || '无详细设定'}
${userPersonaContext || ''}

2. 上文情境（之前的剧情）：
${previousContext || '这是故事的开始。'}

3. 写作风格范例（One-Shot Learning）：
${STYLE_EXAMPLE}

【核心写作指令】
1. **密度自适应（至关重要）**：
   - **高密度对话**（涉及情感爆发、调情、争吵、重要剧情转折、心理博弈）：必须**大幅扩写**。捕捉每一个眼神、微表情、肢体语言的接触、环境氛围的变化。字数应是对话字数的3-5倍。
   - **低密度对话**（日常闲聊、无意义的过渡、简单的确认）：可以**适当快进**，用几句精炼的旁白概括带过，不要流水账。
   - **当前任务**：请分析下面提供的对话记录。如果内容细腻，请生成一篇2000-3000字的详尽故事；如果内容简单，生成500-1000字即可。

2. **叙事视角与手法**：
   - 采用**第三人称限制视角**（通常聚焦于${characterName}或用户角色的视角，或在两者间流畅切换）。
   - **Show, Don't Tell**：不要说“他很生气”，要描写“他捏着酒杯的指关节泛白，青筋暴起”。
   - **感官描写**：调用视觉、听觉、嗅觉、触觉（如风的温度、皮肤的触感、空气中的气味）。
   - **环境渲染**：环境是角色的心境投射。利用天气、光影、背景音来烘托气氛（如范例中的“香槟杯碰撞声”、“幽静的夜色”）。

3. **内容处理**：
   - **必须保留**：所有推动剧情的关键台词（用「」标注）、重要的约定、特定的称呼。
   - **必须转化**：将括号里的动作描写（如 *看着他*）转化为流畅的动作描写段落。
   - **心理描写**：补充对话中未说出口的潜台词和心理活动。

4. **格式要求**：
   - **直接输出正文**，不要有“好的，这是故事”、“基于对话...”等前言后语。
   - 自然分段，长短句结合，营造呼吸感。

【待改写的对话记录】：
${conversationText}

【请开始你的创作】：`
    }

    // 调用AI API生成摘要
    const serverBaseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const requestBody: Record<string, unknown> = {
      messages: [{ role: 'user', content: summaryPrompt }],
      // ✏️✏️✏️ 更新System Prompt：混合身份 ✏️✏️✏️
      systemPrompt: useMemoryTable
        ? `你拥有双重身份：1. 一位获得文学大奖的畅销小说家，擅长将对话转化为细腻、充满画面感的文学作品；2. 一位精准的记忆数据库管理员。你的任务是同时输出高质量的故事摘要（在JSON的summary字段）和结构化的记忆数据（在JSON的memories字段）。`
        : `你是一位获得文学大奖的小说家，擅长将平淡的对话转化为充满张力和画面感的文学作品。你的文字风格细腻、动人，善于捕捉人物之间微妙的化学反应，能够根据对话的密度灵活调整叙述的节奏。`,
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
        if (parsedResult.summary && parsedResult.memories) {
          generatedSummary = parsedResult.summary
          memoryEntries = parsedResult.memories
          memoryTableData = parsedResult
          console.log('成功解析记忆表格数据:', memoryEntries.length, '个记忆条目')
        }
      } catch (error) {
        console.warn('解析记忆表格JSON失败，使用传统摘要:', error)
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
          .single()

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
        } catch (e) { console.warn('版本保存失败', e) }

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
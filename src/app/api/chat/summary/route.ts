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
            console.log('👤 找到用户角色设定:', {
              name: userPersonaModule.userRoleName,
              age: userPersonaModule.userRoleAge,
              gender: userPersonaModule.userRoleGender,
              hasDetails: !!userPersonaModule.userRoleDetails
            })
          } else {
            console.log('ℹ️ 未找到用户角色设定模块')
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
        console.log(`🔄 重新生成摘要 ${summaryId}，排除自身`)
      }

      const { data: previousSummaries } = await summaryQuery.order('end_message_id', { ascending: true })

      console.log(`🔍 查找之前的摘要: end_message_id < ${startMessageId}`)
      console.log(`📚 找到${previousSummaries?.length || 0}个之前的摘要`)

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
        console.log(`🧠 找到${previousMemories?.length || 0}个现有记忆用于合并判断`)
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
      summaryPrompt = `你正在为一个角色扮演对话生成/更新记忆表格。务必基于角色设定和现有记忆来理解对话。
${characterContext ? `${characterContext}\n` : ''}${userPersonaContext ? `${userPersonaContext}\n` : ''}${previousContext ? `${previousContext}\n` : ''}
【核心原则：记忆深化而非碎片化】
1. **优先更新现有记忆**: 如果当前对话涉及已有记忆的人物/事件，请UPDATE而不是创建新条目
2. **识别珍贵记忆**: 重点记录以下内容（重要度8-10）：
   - 角色亲口讲述的过去经历、童年故事、家庭背景
   - 角色珍视的人、物、地点的深层原因
   - 角色的梦想、遗憾、创伤、转折点
   - 角色内心深处的想法、价值观、信念
   - 双方共同经历的重要时刻（第一次、特殊场合）
3. **记忆合并策略**:
   - 同一人物的多次提及 → 合并到一个character记忆，累积细节
   - 持续的情感状态 → 更新emotion记忆的强度和持续时间
   - 关系的逐步发展 → 更新relationship记忆的好感度和信任度
4. **避免记录**:
   - 日常闲聊（"今天天气真好"）
   - 重复性对话（已记录过的相同内容）
   - 临时性信息（"我去倒杯水"）

【输出格式】
请严格按照以下JSON格式返回：

{
  "summary": "这里是400-800字的故事化叙述摘要，采用小说般的叙事手法，保留重要对话原文（用「」标注），描写场景、情绪、细节，体现与之前对话的连续性。宁可详细也不要遗漏重要信息。",
  "memories": [
    {
      "action": "update",
      "existing_id": "memory_123",
      "type": "character",
      "title": "张三的完整人物画像",
      "content": "张三，25岁设计师，高挑温和。【新增】今天她透露自己从小在单亲家庭长大，母亲独自抚养她很不容易，这也是她为什么如此独立坚强的原因。她最怀念小时候和妈妈一起做饭的时光。",
      "importance": 9,
      "metadata": {"name": "张三", "relationship": "朋友", "appearance": "高挑", "personality": "温和、独立、坚强", "nickname": "小张", "age": "25岁", "occupation": "设计师", "background": "单亲家庭长大", "cherished_memory": "和妈妈做饭"}
    },
    {
      "action": "create",
      "type": "character",
      "title": "新角色-李四",
      "content": "第一次提到的新角色，基本信息...",
      "importance": 7,
      "metadata": {"name": "李四", "relationship": "同事"}
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

【记忆操作说明】
1. **action字段** (必填):
   - "update": 更新现有记忆（必须提供existing_id）
   - "create": 创建新记忆（无existing_id）

2. **更新现有记忆时**:
   - 必须提供existing_id（从上面【现有记忆表格】中获取）
   - content字段应该整合原有内容+新信息，标注【新增】部分
   - 重要度可以根据新信息调整（深化理解→提高重要度）
   - metadata累积更新，不要丢失原有字段

3. **珍贵记忆识别**:
   重要度8-10应该用于：
   - 角色的核心背景故事、家庭经历
   - 影响角色性格形成的关键事件
   - 角色真心珍视的人/物/记忆
   - 角色的梦想、遗憾、未了心愿
   - 双方关系的重要转折点

4. **记忆数量控制**:
   - 优先更新而非创建新条目
   - 每次生成不超过5-8个记忆条目
   - 日常对话可能只需要1-2个update

【格式要求】
- type: character/event/setting/emotion/spacetime/relationship/task/item
- importance: 1-10的数字，珍贵记忆8-10，重要内容6-7，一般内容5
- content: 详细具体，包含对话细节和情感色彩
- metadata: 结构化信息，根据type包含相应字段

【核心要求】
- 严格基于角色设定信息理解对话
- 角色的人设、背景、世界观是记忆理解的依据
- 优先UPDATE现有记忆，减少碎片化
- 识别并高亮记录珍贵记忆
- 避免记录临时性、重复性内容

当前对话内容：
${conversationText}

JSON结果：`
    } else {
      summaryPrompt = `你是一位专业的故事作家，请将以下对话转化为一段生动的故事叙述。参考角色设定、之前的摘要和重要记忆。
${characterContext ? `${characterContext}\n` : ''}${userPersonaContext ? `${userPersonaContext}\n` : ''}${previousContext ? `${previousContext}\n` : ''}
【核心要求：故事化叙述，最大程度保留细节】

1. **叙事风格**：
   - 采用小说般的叙事手法，而不是简单的事实罗列
   - 用生动的语言描述场景、氛围、人物情绪
   - 保留对话中的重要台词（用「」标注）
   - 描写人物的动作、表情、心理活动

2. **必须保留的细节**：
   - 关键对话的原文或准确意思
   - 人物的情感变化和细腻心理
   - 场景描述（地点、环境、氛围）
   - 事件的前因后果和发展过程
   - 人物之间的互动细节（称呼、语气、肢体语言）
   - 重要的约定、承诺、决定的具体内容
   - 任何对剧情发展有影响的信息

3. **叙述要点**：
   - 按时间顺序叙述，体现事件的连贯性
   - 重点刻画人物的情感和关系变化
   - 捕捉对话中的转折点和高潮
   - 记录人物透露的背景信息、过往经历
   - 保留对话的语气和情感色彩

4. **篇幅要求**：
   - 不要压缩细节，允许充分展开叙述
   - 建议篇幅：400-800字（根据对话内容复杂度调整）
   - 重要对话可以更长，简单对话可以适当精简
   - 宁可详细也不要遗漏重要信息

5. **格式要求**：
   - 直接开始故事叙述，不要任何前言
   - 使用第三人称视角
   - 自然分段，让阅读更流畅
   - 重要对话用「」引用原文
   - 保持文学性和可读性

【示例风格】：
不要写成："用户和角色讨论了工作问题，达成了共识。"
应该写成："阳光透过窗帘洒进房间，${characterName}放下手中的咖啡杯，认真地看着用户。「其实我一直想和你说...」她顿了顿，眼神中闪过一丝犹豫。用户察觉到她的情绪变化，轻声鼓励道：「没关系，你说吧。」${characterName}深吸一口气，开始讲述自己童年的那段经历..."

当前对话内容：
${conversationText}

故事叙述：`
    }

    // 调用AI API生成摘要
    const serverBaseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const requestBody: Record<string, unknown> = {
      messages: [{ role: 'user', content: summaryPrompt }],
      systemPrompt: `你是一位专业的故事作家和叙事大师。你的任务是将角色扮演对话转化为生动的故事叙述，而不是简单的摘要。你需要：
1. 采用小说般的文学笔法，保留场景、情绪、对话细节
2. 最大程度保留重要对话的原文（用「」标注）
3. 描写人物的心理活动、表情、动作
4. 用生动的语言营造氛围和画面感
5. 基于角色设定信息理解对话的深层含义
6. 宁可详细也不要遗漏重要信息，允许充分展开叙述

你的输出应该像一部连载小说的章节，让读者能够身临其境地感受对话的发展和人物的情感变化。`,
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

    // 保存/更新记忆条目到数据库
    let savedMemories: any[] = []
    if (memoryEntries.length > 0) {
      console.log('开始处理', memoryEntries.length, '个记忆条目')

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

        console.log(`🔍 处理记忆条目 #${index + 1}:`, {
          action,
          existingId,
          title: memory.title,
          type: memory.type
        })

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
          console.log(`📝 准备更新记忆: ${existingId} - ${memory.title}`)
        } else {
          // 创建新记忆
          if (action === 'update' && !existingId) {
            console.warn(`⚠️ 记忆标记为update但缺少existing_id，将作为新记忆创建: ${memory.title}`)
          }
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
          console.log(`➕ 准备创建新记忆: ${memory.title}`)
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

        if (!existingMemory) {
          console.error(`❌ 找不到要更新的记忆: ${memory.id}`)
          continue
        }

        // 智能合并内容：采用保守策略，优先保留旧内容
        let mergedContent = memory.content
        const hasNewAddition = memory.content.includes('【新增】') || memory.content.includes('[新增]')

        if (hasNewAddition) {
          // 情况1：AI 明确标记了新增部分，直接使用AI返回的内容（包含旧+新）
          mergedContent = memory.content
          console.log(`📝 检测到【新增】标记，使用AI整合的内容`)
        } else {
          // AI 没有标记新增，需要判断如何合并

          // 检查新内容长度是否明显增加（说明AI可能整合了旧内容+新信息）
          const oldLength = existingMemory.content.length
          const newLength = memory.content.length
          const lengthRatio = newLength / oldLength

          // 检查关键词覆盖率
          const oldContentWords = existingMemory.content.split(/\s+|。|，|、|；/).filter((w: string) => w.length > 2)
          const significantWords = oldContentWords.filter((w: string) => w.length > 3) // 更有意义的词

          // 计算旧内容有多少比例被新内容包含
          const matchedWords = significantWords.filter((word: string) => memory.content.includes(word))
          const coverageRatio = significantWords.length > 0 ? matchedWords.length / significantWords.length : 0

          console.log(`📊 内容分析: 旧=${oldLength}字, 新=${newLength}字, 长度比=${lengthRatio.toFixed(2)}, 覆盖率=${(coverageRatio * 100).toFixed(1)}%`)

          if (lengthRatio >= 1.2 && coverageRatio >= 0.7) {
            // 情况2：新内容明显更长(+20%)且包含70%以上的关键词 → AI做了完整整合
            mergedContent = memory.content
            console.log(`✅ 新内容更长且覆盖率高，使用新内容`)
          } else if (coverageRatio >= 0.9) {
            // 情况3：新内容包含90%以上的关键词，即使长度相近 → AI重写了内容
            mergedContent = memory.content
            console.log(`✅ 覆盖率很高(${(coverageRatio * 100).toFixed(1)}%)，使用新内容`)
          } else {
            // 情况4：保守策略 - 追加到旧内容，不覆盖
            // 这样可以确保不丢失任何信息，即使格式可能不够完美
            mergedContent = `${existingMemory.content}\n\n【新增信息】${memory.content}`
            console.log(`⚠️ 覆盖率较低(${(coverageRatio * 100).toFixed(1)}%)，追加新内容保护旧信息`)
          }
        }

        // 合并 metadata（累积，不丢失旧字段）
        const mergedMetadata = {
          ...existingMemory.metadata,
          ...memory.metadata
        }

        // 【版本控制】先保存当前版本到历史表
        const currentVersion = existingMemory.current_version || 1
        const newVersion = currentVersion + 1

        try {
          const { error: versionError } = await supabase
            .from('chat_memory_versions')
            .insert({
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

          if (versionError) {
            console.warn(`⚠️ 保存版本历史失败（将继续更新）:`, versionError)
          } else {
            console.log(`📚 已保存版本 v${currentVersion} 到历史表`)
          }
        } catch (versionSaveError) {
          console.warn(`⚠️ 版本保存异常:`, versionSaveError)
        }

        // 更新主记忆表
        const { error: updateError } = await supabase
          .from('chat_memories')
          .update({
            title: memory.title,
            content: mergedContent,
            importance: memory.importance,
            metadata: mergedMetadata,
            summary_id: summary.id, // 更新为当前摘要ID
            current_version: newVersion, // 增加版本号
            start_message_id: startMessageId, // 更新消息范围
            end_message_id: endMessageId,
            updated_at: memory.updated_at
          })
          .eq('id', memory.id)
          .eq('user_id', userId)

        if (updateError) {
          console.error(`更新记忆${memory.id}失败:`, updateError)
        } else {
          // 获取更新后的记忆
          const { data: updated } = await supabase
            .from('chat_memories')
            .select('*')
            .eq('id', memory.id)
            .single()

          if (updated) {
            savedMemories.push(updated)
            console.log(`✅ 成功更新记忆: ${memory.id} - ${memory.title}`)
            console.log(`   旧内容长度: ${existingMemory.content.length}, 新内容长度: ${mergedContent.length}`)
          }
        }
      }

      // 批量插入新建的记忆条目
      if (memoriesToCreate.length > 0) {
        const { data: insertedMemories, error: memoriesError } = await supabase
          .from('chat_memories')
          .insert(memoriesToCreate)
          .select()

        if (memoriesError) {
          console.error('保存新记忆条目失败:', memoriesError)
        } else {
          savedMemories.push(...(insertedMemories || []))
          console.log('成功创建', insertedMemories?.length || 0, '个新记忆条目')
        }
      }

      console.log(`✅ 记忆处理完成: ${memoriesToUpdate.length}个更新, ${memoriesToCreate.length}个新建, 共${savedMemories.length}个记忆`)
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
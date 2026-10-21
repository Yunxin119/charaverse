import { z } from 'zod'

/**
 * The "summary + memory extraction" task prompt. Editable per user (我的 → 任务提示词);
 * these defaults are what the app ships with. Placeholders are filled by the route:
 *   {{character_card}}   角色设定块（可能为空）
 *   {{user_persona}}     用户人设块（可能为空）
 *   {{previous_context}} 之前的摘要 + 现有记忆（可能为空）
 *   {{style_example}}    下面的 styleExample
 *   {{conversation}}     待摘要的对话（已包在 <conversation> 里）
 *   {{char}}             角色名
 */
export const SUMMARY_PLACEHOLDERS: { token: string; desc: string }[] = [
  { token: '{{character_card}}', desc: '角色设定块（<character_card>…</character_card>，可能为空）' },
  { token: '{{user_persona}}', desc: '用户人设块（<user_persona>…</user_persona>，可能为空）' },
  { token: '{{previous_context}}', desc: '之前的摘要与现有记忆（供更新 / 合并，可能为空）' },
  { token: '{{style_example}}', desc: '风格范例（下面单独编辑）' },
  { token: '{{conversation}}', desc: '待摘要的对话记录（<conversation>…</conversation>）' },
  { token: '{{char}}', desc: '角色名' },
]

export const summaryTaskSchema = z.object({
  version: z.literal(1).default(1),
  styleExample: z.string().max(20000).default(''),
  /** 摘要 + 记忆表（useMemoryTable = true） */
  memory: z.object({
    system: z.string().min(1).max(4000),
    template: z.string().min(1).max(30000),
  }),
  /** 纯故事摘要（useMemoryTable = false） */
  story: z.object({
    system: z.string().min(1).max(4000),
    template: z.string().min(1).max(30000),
  }),
  sampling: z.object({
    temperature: z.number().min(0).max(2).default(1),
    max_tokens: z.number().int().min(256).max(65536).default(8192),
  }).prefault({}),
})
export type SummaryTask = z.infer<typeof summaryTaskSchema>

const STYLE_EXAMPLE = `【风格参考范例】
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
（重点描写了两人飙车时那种宣泄的快感，引擎的轰鸣与心跳的共振，以及最后在烧烤摊那种回归人间烟火的松弛感，保留了“冠军”、“刑具”、“开溜”等核心词汇，将简短的几句“去吃烧烤”扩写成了充满张力的逃离名利场的情节。）`

export const DEFAULT_SUMMARY_TASK: SummaryTask = summaryTaskSchema.parse({
  styleExample: STYLE_EXAMPLE,
  memory: {
    system: `你拥有双重身份：1. 一位获得文学大奖的畅销小说家，擅长将对话转化为细腻、充满画面感的文学作品；2. 一位精准的记忆数据库管理员。你的任务是同时输出高质量的故事摘要（在JSON的summary字段）和结构化的记忆数据（在JSON的memories字段）。`,
    template: `你正在执行双重任务：1. 将对话改写为沉浸式小说（Story Mode）；2. 更新记忆数据库（Memory Table）。
{{character_card}}
{{user_persona}}
{{previous_context}}

【任务一：生成故事化摘要 (summary字段)】
参考以下风格范例，将对话转化为一段极具画面感和文学性的小说片段，保留所有细节和叙事时间。
{{style_example}}

**写作要求（至关重要）**：
1. **密度自适应**：高密度对话（情感爆发、冲突、调情）必须大幅扩写（3-5倍字数），描写微表情、环境氛围、心理活动。尽量保留所有有意义的对话。
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
4. **type** 只能是：character / event / setting / emotion / spacetime / relationship / task / item。

当前对话内容：
{{conversation}}

JSON结果：`,
  },
  story: {
    system: `你是一位获得文学大奖的小说家，擅长将平淡的对话转化为充满张力和画面感的文学作品。你的文字风格细腻、动人，善于捕捉人物之间微妙的化学反应，能够根据对话的密度灵活调整叙述的节奏。`,
    template: `你是一位擅长细腻情感描写和电影感叙事的畅销小说家。请将以下对话记录改写为一段沉浸式小说片段。

【输入信息】
1. 角色设定：
{{character_card}}
{{user_persona}}

2. 上文情境（之前的剧情）：
{{previous_context}}

3. 写作风格范例（One-Shot Learning）：
{{style_example}}

【核心写作指令】
1. **密度自适应（至关重要）**：
   - **高密度对话**（涉及情感爆发、调情、争吵、重要剧情转折、心理博弈）：必须**大幅扩写**。捕捉每一个眼神、微表情、肢体语言的接触、环境氛围的变化。字数应是对话字数的3-5倍。
   - **低密度对话**（日常闲聊、无意义的过渡、简单的确认）：可以**适当快进**，用几句精炼的旁白概括带过，不要流水账。
   - **当前任务**：请分析下面提供的对话记录。如果内容细腻，请生成一篇3000字的详尽故事；如果内容简单，生成1000-2000字即可。

2. **叙事视角与手法**：
   - 采用**第三人称限制视角**（通常聚焦于{{char}}或用户角色的视角，或在两者间流畅切换）。
   - **Show, Don't Tell**：不要说“他很生气”，要描写“他捏着酒杯的指关节泛白，青筋暴起”。
   - **感官描写**：调用视觉、听觉、嗅觉、触觉（如风的温度、皮肤的触感、空气中的气味）。
   - **环境渲染**：环境是角色的心境投射。利用天气、光影、背景音来烘托气氛。

3. **内容处理**：
   - **必须保留**：所有推动剧情的关键台词（用「」标注）、重要的约定、特定的称呼。
   - **必须转化**：将括号里的动作描写（如 *看着他*）转化为流畅的动作描写段落。
   - **心理描写**：补充对话中未说出口的潜台词和心理活动。

4. **格式要求**：
   - **直接输出正文**，不要有“好的，这是故事”、“基于对话...”等前言后语。
   - 自然分段，长短句结合，营造呼吸感。

{{conversation}}

【请开始你的创作】：`,
  },
})

export interface SummaryVars {
  characterCard: string
  userPersona: string
  previousContext: string
  conversation: string
  charName: string
}

function fill(template: string, task: SummaryTask, v: SummaryVars): string {
  return template
    .replaceAll('{{character_card}}', v.characterCard)
    .replaceAll('{{user_persona}}', v.userPersona)
    .replaceAll('{{previous_context}}', v.previousContext)
    .replaceAll('{{style_example}}', task.styleExample)
    .replaceAll('{{conversation}}', v.conversation)
    .replaceAll('{{char}}', v.charName)
    .replace(/\n{3,}/g, '\n\n')
}

/** Build instructions + user prompt for one summary call. */
export function renderSummaryTask(task: SummaryTask, mode: 'memory' | 'story', vars: SummaryVars): { instructions: string; prompt: string } {
  const part = mode === 'memory' ? task.memory : task.story
  return { instructions: part.system, prompt: fill(part.template, task, vars) }
}

/** Merge a stored (possibly partial / outdated) override onto the defaults. */
export function resolveSummaryTask(raw: unknown): SummaryTask {
  if (!raw || typeof raw !== 'object') return DEFAULT_SUMMARY_TASK
  const r = summaryTaskSchema.safeParse({ ...DEFAULT_SUMMARY_TASK, ...(raw as object) })
  return r.success ? r.data : DEFAULT_SUMMARY_TASK
}

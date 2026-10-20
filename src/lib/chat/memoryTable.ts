/**
 * Render enabled memories into the text table that goes into the prompt.
 * Ported from the legacy getMemoryTableData; one config table instead of eight copies.
 */
export interface MemoryRow {
  type: string
  title: string
  content: string
  importance: number
  metadata?: Record<string, unknown> | null
}

const TYPE_ORDER = ['relationship', 'character', 'task', 'event', 'spacetime', 'emotion', 'setting', 'item'] as const
const TYPE_LABEL: Record<string, string> = {
  relationship: '🤝 关系状态',
  character: '👤 人物信息',
  task: '📋 任务约定',
  event: '📅 重要事件',
  spacetime: '⏰ 时空场景',
  emotion: '💭 情感状态',
  setting: '🏛️ 场景设定',
  item: '📦 重要物品',
}
/** metadata key → label, per type (order matters) */
const DETAIL_FIELDS: Record<string, [string, string, ((v: unknown) => string)?][]> = {
  character: [['name', '姓名'], ['relationship', '关系'], ['nickname', '称呼'], ['age', '年龄'], ['occupation', '职业']],
  relationship: [['character_name', '角色'], ['relationship', '关系'], ['attitude', '态度'], ['affection', '好感', (v) => `${v}/10`], ['trust', '信任', (v) => `${v}/10`]],
  task: [['task_type', '类型'], ['scheduled_time', '时间'], ['status', '状态'], ['priority', '优先级']],
  event: [['time', '时间'], ['location', '地点'], ['participants', '参与', (v) => (Array.isArray(v) ? v.join(',') : String(v))], ['impact', '影响']],
  spacetime: [['date', '日期'], ['time', '时间'], ['location', '地点'], ['characters', '在场', (v) => (Array.isArray(v) ? v.join(',') : String(v))], ['weather', '天气']],
  emotion: [['emotion_type', '情感'], ['intensity', '强度', (v) => `${v}/10`], ['target', '对象'], ['cause', '原因']],
  setting: [['location', '地点'], ['atmosphere', '氛围'], ['significance', '意义']],
  item: [['item_type', '类型'], ['owner', '归属'], ['location', '位置'], ['significance', '意义']],
}
const TASK_EMOJI: Record<string, string> = { completed: '✅', in_progress: '🔄' }

export function formatMemoryTable(memories: MemoryRow[]): string {
  if (!memories.length) return ''
  const groups = new Map<string, MemoryRow[]>()
  for (const m of memories) {
    const list = groups.get(m.type) ?? []
    list.push(m)
    groups.set(m.type, list)
  }
  const out: string[] = ['记忆按重要度排序，仅展示启用且重要度≥5的记忆。']
  const types = [...TYPE_ORDER, ...[...groups.keys()].filter((t) => !(TYPE_ORDER as readonly string[]).includes(t))]
  for (const type of types) {
    const rows = groups.get(type)
    if (!rows?.length) continue
    out.push('', `${TYPE_LABEL[type] ?? type}:`)
    for (const m of rows) {
      const meta = (m.metadata ?? {}) as Record<string, unknown>
      const prefix = type === 'task' ? `${TASK_EMOJI[String(meta.status)] ?? '⏳'} ` : ''
      out.push(`• ${prefix}${m.title} (重要度${m.importance})`, `  ${m.content}`)
      const details: string[] = []
      for (const [key, label, fmt] of DETAIL_FIELDS[type] ?? []) {
        const v = meta[key]
        if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) continue
        details.push(`${label}:${fmt ? fmt(v) : String(v)}`)
      }
      if (details.length) out.push(`  [${details.join(' | ')}]`)
    }
  }
  return out.join('\n')
}

import { z } from 'zod'
import { Users, Calendar, MapPin, Heart, Clock, HeartHandshake, CheckSquare, Package, type LucideIcon } from 'lucide-react'

/* ---------------------------------------------------------------------------
 * Memory kinds
 * ------------------------------------------------------------------------- */

export const MEMORY_TYPE_IDS = ['character', 'event', 'setting', 'emotion', 'spacetime', 'relationship', 'task', 'item'] as const
export type MemoryType = (typeof MEMORY_TYPE_IDS)[number]

/** Chip tones available in `@/components/glass` `Chip`. */
export type MemoryTone = 'primary' | 'accent' | 'info' | 'danger' | 'flat' | 'warning' | 'success' | 'outline'

export interface MemoryTypeDef {
  id: MemoryType
  label: string
  emoji: string
  icon: LucideIcon
  tone: MemoryTone
}

export const MEMORY_TYPES: readonly MemoryTypeDef[] = [
  { id: 'character', label: '人物', emoji: '👤', icon: Users, tone: 'primary' },
  { id: 'event', label: '事件', emoji: '📅', icon: Calendar, tone: 'accent' },
  { id: 'setting', label: '设定', emoji: '📍', icon: MapPin, tone: 'info' },
  { id: 'emotion', label: '情感', emoji: '💗', icon: Heart, tone: 'danger' },
  { id: 'spacetime', label: '时空', emoji: '🕰️', icon: Clock, tone: 'flat' },
  { id: 'relationship', label: '关系', emoji: '🤝', icon: HeartHandshake, tone: 'warning' },
  { id: 'task', label: '任务约定', emoji: '✅', icon: CheckSquare, tone: 'success' },
  { id: 'item', label: '重要物品', emoji: '📦', icon: Package, tone: 'outline' },
]

export const MEMORY_TYPE_MAP: Record<MemoryType, MemoryTypeDef> = Object.fromEntries(MEMORY_TYPES.map((t) => [t.id, t])) as Record<MemoryType, MemoryTypeDef>

export function isMemoryType(v: unknown): v is MemoryType {
  return typeof v === 'string' && (MEMORY_TYPE_IDS as readonly string[]).includes(v)
}

/* ---------------------------------------------------------------------------
 * Label maps
 * ------------------------------------------------------------------------- */

export const TASK_STATUS = { pending: '待办', in_progress: '进行中', completed: '已完成', cancelled: '已取消' } as const
export type TaskStatus = keyof typeof TASK_STATUS
export const TASK_STATUS_ORDER: readonly TaskStatus[] = ['pending', 'in_progress', 'completed', 'cancelled']

export const TASK_PRIORITY = { low: '低', medium: '中', high: '高', urgent: '紧急' } as const
export type TaskPriority = keyof typeof TASK_PRIORITY

export const TASK_TYPE = { command: '指令', agreement: '约定', promise: '承诺', appointment: '约会' } as const
export const EVENT_TYPE = { conversation: '对话', action: '行动', decision: '决定', conflict: '冲突', celebration: '庆祝' } as const

/** Importance tiers from the memory-deepening notes. */
export function importanceTier(n: number): { label: string; tone: MemoryTone } {
  if (n >= 9) return { label: '核心', tone: 'danger' }
  if (n >= 8) return { label: '珍贵', tone: 'accent' }
  if (n >= 6) return { label: '重要', tone: 'warning' }
  if (n >= 5) return { label: '一般', tone: 'flat' }
  return { label: '临时', tone: 'outline' }
}

/* ---------------------------------------------------------------------------
 * Field schemas (drive MemoryForm + MemoryCard)
 * ------------------------------------------------------------------------- */

export type FieldKind = 'text' | 'textarea' | 'number' | 'select' | 'tags' | 'date'

export interface FieldDef {
  key: string
  label: string
  kind: FieldKind
  options?: { value: string; label: string }[]
  min?: number
  max?: number
  required?: boolean
  placeholder?: string
}

const opts = (map: Record<string, string>) => Object.entries(map).map(([value, label]) => ({ value, label }))
const score = (key: string, label: string): FieldDef => ({ key, label, kind: 'number', min: 1, max: 10, placeholder: '1–10' })

export const MEMORY_FIELD_SCHEMAS: Record<MemoryType, FieldDef[]> = {
  spacetime: [
    { key: 'date', label: '日期', kind: 'date' },
    { key: 'time', label: '时间', kind: 'text', placeholder: '如 黄昏 / 14:30' },
    { key: 'location', label: '地点', kind: 'text', required: true },
    { key: 'characters', label: '在场角色', kind: 'tags', placeholder: '用逗号分隔' },
    { key: 'weather', label: '天气', kind: 'text' },
    { key: 'atmosphere', label: '氛围', kind: 'text' },
  ],
  relationship: [
    { key: 'character_name', label: '角色名', kind: 'text', required: true },
    { key: 'relationship', label: '关系类型', kind: 'text', placeholder: '如 恋人 / 师徒 / 对手' },
    { key: 'attitude', label: '态度', kind: 'text' },
    score('affection', '好感度'),
    score('trust', '信任度'),
    { key: 'last_interaction', label: '最后互动', kind: 'text' },
  ],
  task: [
    { key: 'assigned_by', label: '发起者', kind: 'text' },
    { key: 'assigned_to', label: '执行者', kind: 'text' },
    { key: 'task_type', label: '类型', kind: 'select', options: opts(TASK_TYPE) },
    { key: 'status', label: '状态', kind: 'select', options: opts(TASK_STATUS) },
    { key: 'priority', label: '优先级', kind: 'select', options: opts(TASK_PRIORITY) },
    { key: 'location', label: '地点', kind: 'text' },
    { key: 'scheduled_time', label: '约定时间', kind: 'text' },
    { key: 'duration', label: '持续时间', kind: 'text' },
  ],
  item: [
    { key: 'item_name', label: '物品名', kind: 'text', required: true },
    { key: 'owner', label: '拥有者', kind: 'text' },
    { key: 'description', label: '描述', kind: 'textarea' },
    { key: 'importance_reason', label: '重要原因', kind: 'textarea' },
    { key: 'location', label: '存放地点', kind: 'text' },
    { key: 'acquisition_method', label: '获得方式', kind: 'text' },
    score('emotional_value', '情感价值'),
  ],
  character: [
    { key: 'name', label: '姓名', kind: 'text', required: true },
    { key: 'nickname', label: '昵称 / 称呼', kind: 'text' },
    { key: 'age', label: '年龄', kind: 'text' },
    { key: 'occupation', label: '职业', kind: 'text' },
    { key: 'relationship', label: '与主角关系', kind: 'text' },
    { key: 'status', label: '当前状态', kind: 'text' },
    { key: 'appearance', label: '外貌', kind: 'textarea' },
    { key: 'personality', label: '性格', kind: 'textarea' },
    { key: 'background', label: '背景', kind: 'textarea' },
    { key: 'special_traits', label: '特殊特征', kind: 'tags', placeholder: '用逗号分隔' },
  ],
  event: [
    { key: 'time', label: '时间', kind: 'text' },
    { key: 'location', label: '地点', kind: 'text' },
    { key: 'participants', label: '参与者', kind: 'tags', placeholder: '用逗号分隔' },
    { key: 'event_type', label: '事件类型', kind: 'select', options: opts(EVENT_TYPE) },
    score('emotion_intensity', '情绪强度'),
    { key: 'impact', label: '影响', kind: 'textarea' },
    { key: 'consequences', label: '后果', kind: 'textarea' },
  ],
  setting: [
    { key: 'location', label: '地点', kind: 'text', required: true },
    { key: 'description', label: '描述', kind: 'textarea' },
    { key: 'atmosphere', label: '氛围', kind: 'text' },
    { key: 'items', label: '物品', kind: 'tags', placeholder: '用逗号分隔' },
    { key: 'rules', label: '规则', kind: 'tags', placeholder: '用逗号分隔' },
    { key: 'significance', label: '重要性说明', kind: 'textarea' },
  ],
  emotion: [
    { key: 'emotion_type', label: '情感类型', kind: 'text', required: true, placeholder: '如 喜悦 / 愧疚 / 思念' },
    score('intensity', '强度'),
    { key: 'target', label: '情感对象', kind: 'text' },
    { key: 'cause', label: '起因', kind: 'textarea' },
    { key: 'trigger', label: '触发因素', kind: 'text' },
    { key: 'duration', label: '持续时间', kind: 'text' },
  ],
}

/* ---------------------------------------------------------------------------
 * Row type + validation
 * ------------------------------------------------------------------------- */

export type MemoryMetadata = Record<string, unknown>

/** A `chat_memories` row. */
export interface MemoryEntry {
  id: string
  session_id: string
  user_id: string
  type: MemoryType
  title: string
  content: string
  importance: number
  metadata: MemoryMetadata | null
  source?: 'manual' | 'auto' | string | null
  summary_id?: number | null
  start_message_id?: number | null
  end_message_id?: number | null
  is_enabled?: boolean | null
  current_version?: number | null
  created_at: string
  updated_at?: string | null
}

export const MEMORY_TITLE_MAX = 120
export const MEMORY_CONTENT_MAX = 4000

export const memorySchema = z.object({
  type: z.enum(MEMORY_TYPE_IDS),
  title: z.string().trim().min(1, '请填写标题').max(MEMORY_TITLE_MAX, `标题不能超过 ${MEMORY_TITLE_MAX} 字`),
  content: z.string().trim().min(1, '请填写内容').max(MEMORY_CONTENT_MAX, `内容不能超过 ${MEMORY_CONTENT_MAX} 字`),
  importance: z.number().int().min(1).max(10),
  metadata: z.record(z.string(), z.unknown()),
})
export type MemoryInput = z.infer<typeof memorySchema>

/** Effective enabled flag: column first, legacy `metadata.is_enabled` as fallback. */
export function isMemoryEnabled(m: Pick<MemoryEntry, 'is_enabled' | 'metadata'>): boolean {
  if (typeof m.is_enabled === 'boolean') return m.is_enabled
  const legacy = m.metadata?.is_enabled
  return typeof legacy === 'boolean' ? legacy : true
}

/* ---------------------------------------------------------------------------
 * Display helpers
 * ------------------------------------------------------------------------- */

/** Human string for one metadata value according to its field definition. */
export function formatFieldValue(field: FieldDef, value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  switch (field.kind) {
    case 'tags': {
      const arr = Array.isArray(value) ? value : String(value).split(/[,，、]/)
      const items = arr.map((v) => String(v).trim()).filter(Boolean)
      return items.length ? items.join('、') : null
    }
    case 'select': {
      const hit = field.options?.find((o) => o.value === String(value))
      return hit?.label ?? String(value)
    }
    case 'number': {
      const n = Number(value)
      if (!Number.isFinite(n)) return null
      return field.max ? `${n}/${field.max}` : String(n)
    }
    default:
      return String(value).trim() || null
  }
}

/** `[label, value]` pairs for the non-empty metadata of a memory, in schema order. */
export function describeMetadata(type: MemoryType, metadata: MemoryMetadata | null | undefined): { key: string; label: string; value: string }[] {
  if (!metadata) return []
  const out: { key: string; label: string; value: string }[] = []
  for (const f of MEMORY_FIELD_SCHEMAS[type] ?? []) {
    const v = formatFieldValue(f, metadata[f.key])
    if (v) out.push({ key: f.key, label: f.label, value: v })
  }
  return out
}

/** One-line summary: `👤 人物 · 张三 · ★8 · 职业: 医生 · 状态: 失踪`. */
export function formatMemoryLine(memory: Pick<MemoryEntry, 'type' | 'title' | 'importance' | 'metadata'>, maxFields = 2): string {
  const def = MEMORY_TYPE_MAP[memory.type]
  const head = def ? `${def.emoji} ${def.label}` : memory.type
  const extra = describeMetadata(memory.type, memory.metadata)
    .slice(0, maxFields)
    .map((d) => `${d.label}: ${d.value}`)
  return [head, memory.title, `★${memory.importance}`, ...extra].join(' · ')
}

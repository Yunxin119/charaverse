import type { Character } from '@/app/lib/supabase'
import { EMPTY_LOREBOOK, parseLorebook, type Lorebook } from '@/lib/lorebook/schema'

/**
 * Editable draft behind `CharacterForm`. It is flat on purpose: every field the
 * form shows lives here, and `buildPromptTemplate` turns it back into the
 * stored `characters.prompt_template` shape (see `lib/chat/characterCard.ts`).
 */

export type Gender = 'male' | 'female' | 'none' | 'other'
export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
  { value: 'none', label: '无性别' },
  { value: 'other', label: '其他' },
]

export const MODULE_TYPES = ['用户角色设定', '初始情景', '注意事项', '特殊要求', '自定义模块'] as const
export type ModuleType = (typeof MODULE_TYPES)[number]

export const MODULE_HINT: Record<ModuleType, string> = {
  用户角色设定: '对话里「你」是谁：姓名、年龄、性别和背景，会作为用户人设注入',
  初始情景: '故事开始时的场景、时间和两人的关系',
  注意事项: '希望 AI 始终遵守的规则，例如语气、禁忌、输出格式',
  特殊要求: '额外的写作要求，例如字数、视角、风格',
  自定义模块: '任何其它设定，自己起个名字',
}

export interface DraftModule {
  /** client-only key; not persisted */
  id: string
  type: ModuleType
  /** 自定义模块 only */
  name?: string
  /** every type except 用户角色设定 */
  content?: string
  /** 用户角色设定 only */
  userRoleName?: string
  userRoleAge?: string
  userRoleGender?: Gender | ''
  userRoleDetails?: string
}

export interface CharacterDraft {
  name: string
  avatar_url: string
  description: string
  personality: string
  introduction: string
  initialMessage: string
  /** extra opening lines; the first message becomes swipeable between all of them */
  alternateGreetings: string[]
  keywords: string[]
  age: string
  gender: Gender | ''
  modules: DraftModule[]
  /** world book embedded in the card; stored in `characters.lorebook`, not in prompt_template */
  lorebook: Lorebook
}

export type DraftErrors = Partial<Record<'name' | 'content', string>>

let seq = 0
export const newId = () => `m_${Date.now().toString(36)}_${(seq++).toString(36)}`

export function newModule(type: ModuleType): DraftModule {
  if (type === '用户角色设定') return { id: newId(), type, userRoleName: '', userRoleAge: '', userRoleGender: '', userRoleDetails: '' }
  if (type === '自定义模块') return { id: newId(), type, name: '', content: '' }
  return { id: newId(), type, content: '' }
}

export function emptyDraft(): CharacterDraft {
  return { name: '', avatar_url: '', description: '', personality: '', introduction: '', initialMessage: '', alternateGreetings: [], keywords: [], age: '', gender: '', modules: [], lorebook: EMPTY_LOREBOOK }
}

/** Tolerant: a missing or malformed column becomes an empty book instead of blocking the form. */
export function lorebookFromCharacter(c: Pick<Character, 'lorebook'>): Lorebook {
  const r = parseLorebook(c.lorebook)
  return r.ok ? r.book : EMPTY_LOREBOOK
}

type AnyRecord = Record<string, unknown>
const isRecord = (v: unknown): v is AnyRecord => typeof v === 'object' && v !== null && !Array.isArray(v)
export const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const isGender = (v: unknown): v is Gender => v === 'male' || v === 'female' || v === 'none' || v === 'other'
const isModuleType = (v: unknown): v is ModuleType => (MODULE_TYPES as readonly unknown[]).includes(v)

/** Legacy rows stored the user role only as a composed `content` string. */
function parseLegacyUserRole(content: string) {
  const out = { userRoleName: '', userRoleAge: '', userRoleGender: '' as Gender | '', userRoleDetails: '' }
  for (const line of content.split('\n')) {
    if (line.startsWith('用户角色姓名：')) out.userRoleName = line.slice('用户角色姓名：'.length).trim()
    else if (line.startsWith('用户角色年龄：')) out.userRoleAge = line.slice('用户角色年龄：'.length).trim()
    else if (line.startsWith('用户角色性别：')) { const g = line.slice('用户角色性别：'.length).trim(); out.userRoleGender = isGender(g) ? g : '' }
    else if (line.startsWith('用户角色详细设定：')) out.userRoleDetails = line.slice('用户角色详细设定：'.length).trim()
  }
  for (const k of ['userRoleName', 'userRoleAge', 'userRoleDetails'] as const) if (out[k] === '未设定') out[k] = ''
  return out
}

export function draftFromCharacter(c: Character): CharacterDraft {
  const tpl = isRecord(c.prompt_template) ? c.prompt_template : {}
  const basic = isRecord(tpl.basic_info) ? tpl.basic_info : {}
  const rawModules = Array.isArray(tpl.modules) ? tpl.modules.filter(isRecord) : []

  const modules: DraftModule[] = rawModules.map((m) => {
    const type: ModuleType = isModuleType(m.type) ? m.type : '自定义模块'
    if (type === '用户角色设定') {
      const hasFields = [m.userRoleName, m.userRoleAge, m.userRoleGender, m.userRoleDetails].some((v) => str(v).trim())
      const legacy = !hasFields && str(m.content) ? parseLegacyUserRole(str(m.content)) : null
      return {
        id: newId(),
        type,
        userRoleName: legacy?.userRoleName ?? str(m.userRoleName),
        userRoleAge: legacy?.userRoleAge ?? str(m.userRoleAge),
        userRoleGender: legacy?.userRoleGender ?? (isGender(m.userRoleGender) ? m.userRoleGender : ''),
        userRoleDetails: legacy?.userRoleDetails ?? str(m.userRoleDetails),
      }
    }
    if (type === '自定义模块') {
      // unknown types are kept as custom modules named after the old type so nothing is lost
      const name = isModuleType(m.type) ? str(m.name) : str(m.type) || str(m.name)
      return { id: newId(), type, name, content: str(m.content) }
    }
    return { id: newId(), type, content: str(m.content) }
  })

  return {
    name: str(c.name) || str(basic.name),
    avatar_url: str(c.avatar_url) || str(basic.avatar_url),
    description: str(basic.description),
    personality: str(basic.personality),
    introduction: str(basic.introduction),
    initialMessage: str(basic.initialMessage),
    alternateGreetings: Array.isArray(basic.alternateGreetings) ? basic.alternateGreetings.filter((g): g is string => typeof g === 'string' && !!g.trim()) : [],
    keywords: Array.isArray(basic.keywords) ? basic.keywords.filter((k): k is string => typeof k === 'string' && !!k.trim()) : [],
    age: str(basic.age),
    gender: isGender(basic.gender) ? basic.gender : '',
    modules,
    lorebook: lorebookFromCharacter(c),
  }
}

/**
 * Stored shape. Unknown top-level keys of the existing template (e.g. a not
 * yet migrated `custom_css`) are preserved; `basic_info` and `modules` are
 * rewritten from the draft.
 */
export function buildPromptTemplate(draft: CharacterDraft, existing?: unknown): Record<string, unknown> {
  const base = isRecord(existing) ? { ...existing } : {}
  const modules = draft.modules.map((m) => {
    if (m.type === '用户角色设定') {
      const userRoleName = (m.userRoleName ?? '').trim()
      const userRoleAge = (m.userRoleAge ?? '').trim()
      const userRoleGender = m.userRoleGender ?? ''
      const userRoleDetails = (m.userRoleDetails ?? '').trim()
      return {
        type: m.type,
        userRoleName,
        userRoleAge,
        userRoleGender,
        userRoleDetails,
        // composed text kept for readers that only look at `content`
        content: `用户角色姓名：${userRoleName}\n用户角色年龄：${userRoleAge}\n用户角色性别：${userRoleGender}\n用户角色详细设定：${userRoleDetails}`,
      }
    }
    if (m.type === '自定义模块') return { type: m.type, name: (m.name ?? '').trim(), content: m.content ?? '' }
    return { type: m.type, content: m.content ?? '' }
  })
  return {
    ...base,
    basic_info: {
      name: draft.name.trim(),
      avatar_url: draft.avatar_url || '',
      description: draft.description,
      personality: draft.personality,
      introduction: draft.introduction,
      initialMessage: draft.initialMessage,
      alternateGreetings: draft.alternateGreetings.map((g) => g.trim()).filter(Boolean),
      keywords: draft.keywords,
      age: draft.age.trim(),
      gender: draft.gender,
    },
    modules,
  }
}

export function moduleHasContent(m: DraftModule): boolean {
  if (m.type === '用户角色设定') return [m.userRoleName, m.userRoleAge, m.userRoleGender, m.userRoleDetails].some((v) => (v ?? '').trim())
  if (m.type === '自定义模块') return !!((m.name ?? '').trim() || (m.content ?? '').trim())
  return !!(m.content ?? '').trim()
}

export function validateDraft(d: CharacterDraft): DraftErrors {
  const errors: DraftErrors = {}
  if (!d.name.trim()) errors.name = '角色需要一个名字'
  else if (d.name.trim().length > 100) errors.name = '名字最多 100 个字符'
  if (!d.description.trim() && !d.modules.some(moduleHasContent)) errors.content = '至少写一段角色设定，或添加一个有内容的人设模块'
  return errors
}

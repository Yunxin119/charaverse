import type { Character } from '@/app/lib/supabase'
import { EMPTY_LOREBOOK, parseLorebook, type Lorebook } from '@/lib/lorebook/schema'

/**
 * Editable draft behind `CharacterForm`. Fields follow the common character-card
 * vocabulary (description / personality / scenario / greetings / examples / system
 * prompt / post-history / persona); `buildPromptTemplate` maps them back onto the
 * stored `characters.prompt_template` shape (basic_info + typed modules), which the
 * chat assembler, import / export and the public page all keep reading unchanged.
 */

export type Gender = 'male' | 'female' | 'none' | 'other'
export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
  { value: 'none', label: '无性别' },
  { value: 'other', label: '其他' },
]

/** Stored module types. Fixed ones map onto single draft fields; the rest are 「补充设定」. */
export const MODULE_TYPES = ['用户角色设定', '初始情景', '注意事项', '特殊要求', '自定义模块'] as const
export type ModuleType = (typeof MODULE_TYPES)[number]

/** 补充设定 entry (stored as a 自定义模块). */
export interface DraftExtra {
  /** client-only key; not persisted */
  id: string
  name: string
  content: string
}

export interface DraftPersona {
  name: string
  age: string
  gender: Gender | ''
  details: string
}

export interface CharacterDraft {
  name: string
  avatar_url: string
  /** 公开简介（探索页） */
  introduction: string
  keywords: string[]
  age: string
  gender: Gender | ''
  /** 描述：外貌、背景、经历 */
  description: string
  personality: string
  /** 场景：故事开始时的处境 (stored as 初始情景) */
  scenario: string
  initialMessage: string
  /** extra opening lines; the first message becomes swipeable between all of them */
  alternateGreetings: string[]
  /** example dialogue (optional; used by the dialogueExamples preset marker) */
  exampleDialogue: string
  /** 系统提示：always-on rules (stored as 注意事项) */
  systemPrompt: string
  /** 后置指令：writing requirements placed after the history (stored as 特殊要求) */
  postHistory: string
  /** who the user is in the story (stored as 用户角色设定) */
  persona: DraftPersona
  /** anything else, named (stored as 自定义模块) */
  extras: DraftExtra[]
  /** world book embedded in the card; stored in `characters.lorebook`, not in prompt_template */
  lorebook: Lorebook
}

export type DraftErrors = Partial<Record<'name' | 'content', string>>

let seq = 0
export const newId = () => `m_${Date.now().toString(36)}_${(seq++).toString(36)}`

export const emptyPersona = (): DraftPersona => ({ name: '', age: '', gender: '', details: '' })
export const newExtra = (): DraftExtra => ({ id: newId(), name: '', content: '' })

export function emptyDraft(): CharacterDraft {
  return {
    name: '', avatar_url: '', introduction: '', keywords: [], age: '', gender: '',
    description: '', personality: '', scenario: '',
    initialMessage: '', alternateGreetings: [], exampleDialogue: '',
    systemPrompt: '', postHistory: '',
    persona: emptyPersona(), extras: [], lorebook: EMPTY_LOREBOOK,
  }
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
const joinBlocks = (a: string, b: string) => (a.trim() && b.trim() ? `${a.trim()}\n\n${b.trim()}` : (a.trim() || b.trim()))

/** Legacy rows stored the user role only as a composed `content` string. */
function parseLegacyUserRole(content: string): DraftPersona {
  const out: DraftPersona = emptyPersona()
  for (const line of content.split('\n')) {
    if (line.startsWith('用户角色姓名：')) out.name = line.slice('用户角色姓名：'.length).trim()
    else if (line.startsWith('用户角色年龄：')) out.age = line.slice('用户角色年龄：'.length).trim()
    else if (line.startsWith('用户角色性别：')) { const g = line.slice('用户角色性别：'.length).trim(); out.gender = isGender(g) ? g : '' }
    else if (line.startsWith('用户角色详细设定：')) out.details = line.slice('用户角色详细设定：'.length).trim()
  }
  for (const k of ['name', 'age', 'details'] as const) if (out[k] === '未设定') out[k] = ''
  return out
}

export function personaHasContent(p: DraftPersona): boolean {
  return !!(p.name.trim() || p.age.trim() || p.gender || p.details.trim())
}

export function draftFromCharacter(c: Character): CharacterDraft {
  const tpl = isRecord(c.prompt_template) ? c.prompt_template : {}
  const basic = isRecord(tpl.basic_info) ? tpl.basic_info : {}
  const rawModules = Array.isArray(tpl.modules) ? tpl.modules.filter(isRecord) : []

  const d = emptyDraft()
  for (const m of rawModules) {
    const type: ModuleType = isModuleType(m.type) ? m.type : '自定义模块'
    const content = str(m.content)
    if (type === '用户角色设定') {
      const hasFields = [m.userRoleName, m.userRoleAge, m.userRoleGender, m.userRoleDetails].some((v) => str(v).trim())
      const p: DraftPersona = hasFields
        ? { name: str(m.userRoleName), age: str(m.userRoleAge), gender: isGender(m.userRoleGender) ? m.userRoleGender : '', details: str(m.userRoleDetails) }
        : parseLegacyUserRole(content)
      // several persona modules (old cards): first one wins the fields, details are merged
      if (!personaHasContent(d.persona)) d.persona = p
      else d.persona = { ...d.persona, details: joinBlocks(d.persona.details, p.details) }
    } else if (type === '初始情景') {
      d.scenario = joinBlocks(d.scenario, content)
    } else if (type === '注意事项') {
      d.systemPrompt = joinBlocks(d.systemPrompt, content)
    } else if (type === '特殊要求') {
      d.postHistory = joinBlocks(d.postHistory, content)
    } else {
      // unknown types are kept as extras named after the old type so nothing is lost
      const name = isModuleType(m.type) ? str(m.name) : str(m.type) || str(m.name)
      d.extras.push({ id: newId(), name, content })
    }
  }

  return {
    ...d,
    name: str(c.name) || str(basic.name),
    avatar_url: str(c.avatar_url) || str(basic.avatar_url),
    description: str(basic.description),
    personality: str(basic.personality),
    introduction: str(basic.introduction),
    initialMessage: str(basic.initialMessage),
    alternateGreetings: Array.isArray(basic.alternateGreetings) ? basic.alternateGreetings.filter((g): g is string => typeof g === 'string' && !!g.trim()) : [],
    exampleDialogue: str(basic.exampleDialogue),
    keywords: Array.isArray(basic.keywords) ? basic.keywords.filter((k): k is string => typeof k === 'string' && !!k.trim()) : [],
    age: str(basic.age),
    gender: isGender(basic.gender) ? basic.gender : '',
    lorebook: lorebookFromCharacter(c),
  }
}

/**
 * Stored shape. Unknown top-level keys of the existing template (e.g. a not
 * yet migrated `custom_css`) are preserved; `basic_info` and `modules` are
 * rewritten from the draft. Module order: persona, scenario, rules, post-history, extras.
 */
export function buildPromptTemplate(draft: CharacterDraft, existing?: unknown): Record<string, unknown> {
  const base = isRecord(existing) ? { ...existing } : {}
  const modules: AnyRecord[] = []
  if (personaHasContent(draft.persona)) {
    const p = draft.persona
    const userRoleName = p.name.trim(), userRoleAge = p.age.trim(), userRoleGender = p.gender, userRoleDetails = p.details.trim()
    modules.push({
      type: '用户角色设定', userRoleName, userRoleAge, userRoleGender, userRoleDetails,
      // composed text kept for readers that only look at `content`
      content: `用户角色姓名：${userRoleName}\n用户角色年龄：${userRoleAge}\n用户角色性别：${userRoleGender}\n用户角色详细设定：${userRoleDetails}`,
    })
  }
  if (draft.scenario.trim()) modules.push({ type: '初始情景', content: draft.scenario })
  if (draft.systemPrompt.trim()) modules.push({ type: '注意事项', content: draft.systemPrompt })
  if (draft.postHistory.trim()) modules.push({ type: '特殊要求', content: draft.postHistory })
  for (const e of draft.extras) {
    if (e.name.trim() || e.content.trim()) modules.push({ type: '自定义模块', name: e.name.trim(), content: e.content })
  }
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
      exampleDialogue: draft.exampleDialogue,
      keywords: draft.keywords,
      age: draft.age.trim(),
      gender: draft.gender,
    },
    modules,
  }
}

export function draftHasContent(d: CharacterDraft): boolean {
  return !!(d.description.trim() || d.personality.trim() || d.scenario.trim() || d.systemPrompt.trim() || d.extras.some((e) => e.content.trim()))
}

export function validateDraft(d: CharacterDraft): DraftErrors {
  const errors: DraftErrors = {}
  if (!d.name.trim()) errors.name = '角色需要一个名字'
  else if (d.name.trim().length > 100) errors.name = '名字最多 100 个字符'
  if (!draftHasContent(d)) errors.content = '至少写一段描述、性格或场景'
  return errors
}

/**
 * Read the legacy `characters.prompt_template` JSON into a flat card the prompt
 * assembler understands. Tolerant of missing fields; never throws.
 */
export interface CharacterCard {
  name: string
  description?: string
  personality?: string
  age?: string
  gender?: string
  scenario?: string
  /** 注意事项 / 特殊要求 / 自定义模块 */
  modules: { type: string; content: string }[]
  /** 用户角色设定 module rendered as persona text */
  persona?: string
  /** 用户角色设定.userRoleName, falls back to '用户' */
  userName: string
  initialMessage?: string
  /** all opening lines: initialMessage first, then alternates (non-empty) */
  greetings: string[]
  customCss?: string
  introduction?: string
}

const GENDER_LABEL: Record<string, string> = { male: '男', female: '女', none: '无性别', other: '其他' }
const genderLabel = (g?: string) => (g ? GENDER_LABEL[g] ?? g : undefined)

type AnyRecord = Record<string, unknown>
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

export function parseCharacterCard(character: { name?: string; prompt_template?: unknown }): CharacterCard {
  const tpl = (character.prompt_template ?? {}) as AnyRecord
  const basic = (tpl.basic_info ?? {}) as AnyRecord
  const rawModules = Array.isArray(tpl.modules) ? (tpl.modules as AnyRecord[]) : []

  const modules: CharacterCard['modules'] = []
  let scenario: string | undefined
  let persona: string | undefined
  let userName = '用户'

  for (const m of rawModules) {
    const type = str(m.type) ?? ''
    const content = str(m.content)
    if (type === '用户角色设定') {
      const lines: string[] = []
      const n = str(m.userRoleName)
      if (n) { userName = n; lines.push(n) }
      const g = genderLabel(str(m.userRoleGender))
      if (g) lines.push(`性别：${g}`)
      const a = str(m.userRoleAge)
      if (a) lines.push(`年龄：${a}`)
      const d = str(m.userRoleDetails) ?? content
      if (d) lines.push(d)
      if (lines.length) persona = lines.join('\n')
    } else if (type === '初始情景') {
      if (content) scenario = scenario ? `${scenario}\n\n${content}` : content
    } else if (type === '自定义模块') {
      if (content) modules.push({ type: str(m.name) ?? '自定义', content })
    } else if (content) {
      modules.push({ type: type || '补充设定', content })
    }
  }

  return {
    name: str(basic.name) ?? str(character.name) ?? '角色',
    description: str(basic.description),
    personality: str(basic.personality),
    age: str(basic.age),
    gender: genderLabel(str(basic.gender)),
    scenario,
    modules,
    persona,
    userName,
    initialMessage: str(basic.initialMessage),
    greetings: [str(basic.initialMessage), ...(Array.isArray(basic.alternateGreetings) ? (basic.alternateGreetings as unknown[]).map(str) : [])].filter((g): g is string => !!g),
    customCss: str(tpl.custom_css),
    introduction: str(basic.introduction),
  }
}

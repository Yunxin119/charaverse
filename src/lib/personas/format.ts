/**
 * User personas: who {{user}} is in a story. They belong to the user (not the card),
 * are managed at /settings/personas and reach the prompt through the preset's
 * 「用户人设」 marker, in the same text shape the card's legacy 用户角色设定 module used.
 */

export type PersonaGender = '' | 'male' | 'female' | 'none' | 'other'

export interface PersonaFields {
  name: string
  age?: string | null
  gender?: PersonaGender | string | null
  details?: string | null
}

const GENDER_LABEL: Record<string, string> = { male: '男', female: '女', none: '无性别', other: '其他' }

export function personaGenderLabel(g: string | null | undefined): string | undefined {
  return g ? GENDER_LABEL[g] : undefined
}

/** The persona as prompt text (without the name line, which the assembler adds). Empty when there is nothing beyond the name. */
export function formatPersonaText(p: PersonaFields): string | undefined {
  const lines: string[] = []
  const g = personaGenderLabel(p.gender)
  if (g) lines.push(`性别：${g}`)
  const a = p.age?.trim()
  if (a) lines.push(`年龄：${a}`)
  const d = p.details?.trim()
  if (d) lines.push(d)
  return lines.length ? lines.join('\n') : undefined
}

/**
 * Which persona a session uses.
 *   settings.personaId === null       → none (fall back to the card's own user block)
 *   settings.personaId is a string    → that one (if it still exists)
 *   undefined                         → the persona bound to this character, else the default
 */
export function resolvePersonaId(
  sessionPersonaId: string | null | undefined,
  boundPersonaId: string | null | undefined,
  defaultPersonaId: string | null | undefined,
  exists: (id: string) => boolean = () => true
): string | null {
  if (sessionPersonaId === null) return null
  if (typeof sessionPersonaId === 'string' && exists(sessionPersonaId)) return sessionPersonaId
  if (boundPersonaId && exists(boundPersonaId)) return boundPersonaId
  if (defaultPersonaId && exists(defaultPersonaId)) return defaultPersonaId
  return null
}

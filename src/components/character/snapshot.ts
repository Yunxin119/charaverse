import { z } from 'zod'

/**
 * `characters.published_snapshot` (plan §3 A12). A frozen copy of the parts of
 * a character that become public when the author hits 「发布」. Public readers
 * (explore, public page, other users' chats, forks) read only this; the live
 * row stays the author's private draft until they re-publish.
 */
export const snapshotSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1).max(200),
  avatar_url: z.string().nullable(),
  /** the card JSON (basic_info / modules / …) minus the legacy `custom_css` */
  prompt_template: z.record(z.string(), z.unknown()),
  /** characters.skin as-is (css / regexScripts / renderHtml / allowedUrlHosts) */
  skin: z.record(z.string(), z.unknown()),
})
export type Snapshot = z.infer<typeof snapshotSchema>

export interface SnapshotInput {
  name: string
  avatar_url?: string | null
  prompt_template: unknown
  skin?: unknown
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Pure: build the snapshot that 发布 writes. Strips `custom_css` from the card. */
export function buildSnapshot(input: SnapshotInput): Snapshot {
  const tpl = isRecord(input.prompt_template) ? { ...input.prompt_template } : {}
  delete tpl.custom_css
  return {
    version: 1,
    name: input.name.trim() || '未命名角色',
    avatar_url: input.avatar_url || null,
    prompt_template: tpl,
    skin: isRecord(input.skin) ? input.skin : {},
  }
}

/** Tolerant reader: returns null for missing / malformed snapshots. */
export function parseSnapshot(raw: unknown): Snapshot | null {
  const r = snapshotSchema.safeParse(raw)
  return r.success ? r.data : null
}

/** Deterministic JSON (sorted keys) so two snapshots can be compared as strings. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (isRecord(value)) {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

export function snapshotsEqual(a: Snapshot | null, b: Snapshot | null): boolean {
  if (!a || !b) return a === b
  return stableStringify(a) === stableStringify(b)
}

/* ---------- display helpers shared by explore / public page / publish dialog ---------- */

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

export interface SnapshotModule {
  type: string
  /** 自定义模块 name, or the user-role name for 用户角色设定 */
  title?: string
  content: string
}

/** Flatten the card JSON into what the public page shows. Never throws. */
export function describeTemplate(tpl: unknown) {
  const t = isRecord(tpl) ? tpl : {}
  const basic = isRecord(t.basic_info) ? t.basic_info : {}
  const keywords = Array.isArray(basic.keywords) ? basic.keywords.filter((k): k is string => typeof k === 'string' && !!k.trim()) : []
  const raw = Array.isArray(t.modules) ? t.modules.filter(isRecord) : []
  const modules: SnapshotModule[] = []
  for (const m of raw) {
    const type = str(m.type) ?? '补充设定'
    if (type === '用户角色设定') {
      const lines: string[] = []
      const g = str(m.userRoleGender)
      if (g) lines.push(`性别：${{ male: '男', female: '女', none: '无性别' }[g] ?? g}`)
      const a = str(m.userRoleAge)
      if (a) lines.push(`年龄：${a}`)
      const d = str(m.userRoleDetails) ?? str(m.content)
      if (d) lines.push(d)
      if (lines.length || str(m.userRoleName)) modules.push({ type, title: str(m.userRoleName), content: lines.join('\n') })
    } else {
      const content = str(m.content)
      if (content) modules.push({ type, title: type === '自定义模块' ? str(m.name) : undefined, content })
    }
  }
  return {
    introduction: str(basic.introduction) ?? str(basic.description),
    description: str(basic.description),
    personality: str(basic.personality),
    initialMessage: str(basic.initialMessage),
    keywords,
    modules,
  }
}

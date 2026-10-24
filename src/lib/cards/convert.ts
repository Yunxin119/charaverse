import { z } from 'zod'
import { parseCharacterCard } from '@/lib/chat/characterCard'
import { parseSkin, type Skin } from '@/lib/skins/schema'
import { importExternalRegex } from '@/lib/skins/regexScripts'
import { importExternalLorebook, lorebookSchema, parseLorebook, type Lorebook } from '@/lib/lorebook/schema'

/**
 * Character card import/export.
 *   - CharaVerse JSON: lossless (prompt_template + skin + lorebook)
 *   - common card JSON (v1 flat, v2 `chara_card_v2`, v3 `chara_card_v3`) → mapped into our card;
 *     when a card carries `extensions.charaverse` we restore it losslessly
 *   - export to v2 keeps other front-ends happy and tucks our data into extensions
 */

export const charaverseCardSchema = z.object({
  format: z.literal('charaverse-card'),
  version: z.literal(1).default(1),
  name: z.string().min(1).max(100),
  avatar_url: z.string().max(1024).nullable().optional(),
  prompt_template: z.record(z.string(), z.unknown()),
  skin: z.record(z.string(), z.unknown()).default({}),
  lorebook: z.record(z.string(), z.unknown()).default({}),
  exported_at: z.string().optional(),
})
export type CharaverseCard = z.infer<typeof charaverseCardSchema>

export interface ImportedCard {
  name: string
  prompt_template: Record<string, unknown>
  skin: Skin
  lorebook: Lorebook
  /** data URL or http url of an avatar carried by the file (PNG cards) */
  avatarDataUrl?: string
  source: 'charaverse' | 'v1' | 'v2' | 'v3'
  warnings: string[]
}

type AnyRec = Record<string, unknown>
const isRec = (v: unknown): v is AnyRec => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown) => (typeof v === 'string' ? v : '')
const strArr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()) : [])

export function cardFromCharaverse(raw: unknown): ImportedCard | null {
  const r = charaverseCardSchema.safeParse(raw)
  if (!r.success) return null
  return {
    name: r.data.name,
    prompt_template: r.data.prompt_template,
    skin: parseSkin(r.data.skin),
    lorebook: parseLorebook(r.data.lorebook).ok ? (parseLorebook(r.data.lorebook) as { ok: true; book: Lorebook }).book : lorebookSchema.parse({}),
    source: 'charaverse',
    warnings: [],
  }
}

/** Map a v1/v2/v3 card into our prompt_template shape. */
export function cardFromCommon(raw: unknown): ImportedCard | null {
  if (!isRec(raw)) return null
  let data: AnyRec
  let source: ImportedCard['source']
  if (raw.spec === 'chara_card_v3' && isRec(raw.data)) { data = raw.data; source = 'v3' }
  else if (raw.spec === 'chara_card_v2' && isRec(raw.data)) { data = raw.data; source = 'v2' }
  else if (typeof raw.name === 'string' && ('description' in raw || 'first_mes' in raw)) { data = raw; source = 'v1' }
  else return null

  const warnings: string[] = []
  const ext = isRec(data.extensions) ? data.extensions : {}
  const ours = isRec(ext.charaverse) ? ext.charaverse : null
  const name = str(data.name).trim() || '未命名角色'

  // lossless path: our own extension block
  if (ours && isRec(ours.prompt_template)) {
    const lb = parseLorebook(ours.lorebook)
    return {
      name,
      prompt_template: ours.prompt_template,
      skin: parseSkin(ours.skin),
      lorebook: lb.ok ? lb.book : lorebookSchema.parse({}),
      source,
      warnings,
    }
  }

  const modules: AnyRec[] = []
  const scenario = str(data.scenario).trim()
  if (scenario) modules.push({ type: '初始情景', content: scenario })
  const sys = str(data.system_prompt).trim()
  if (sys) modules.push({ type: '注意事项', content: sys })
  const post = str(data.post_history_instructions).trim()
  if (post) modules.push({ type: '特殊要求', content: post })
  if (str(data.creator).trim() || str(data.character_version).trim()) {
    warnings.push(`作者 / 版本信息（${[str(data.creator), str(data.character_version)].filter(Boolean).join(' · ')}）未导入到卡内字段`)
  }

  let lorebook = lorebookSchema.parse({})
  if (isRec(data.character_book)) {
    const r = importExternalLorebook(data.character_book)
    if (r.ok) lorebook = { ...r.book, name: r.book.name || `${name} 的世界书` }
    else warnings.push(`内嵌世界书未能导入：${r.error}`)
  }

  // regex scripts travel in `extensions.regex_scripts` on common cards → our skin
  let skin = parseSkin({})
  const regexRaw = Array.isArray(ext.regex_scripts) ? ext.regex_scripts : Array.isArray(data.regex_scripts) ? data.regex_scripts : null
  if (regexRaw && regexRaw.length > 0) {
    const r = importExternalRegex(regexRaw)
    if (r.ok) skin = parseSkin({ regexScripts: r.scripts })
    else warnings.push(`内嵌正则脚本未能导入：${r.error}`)
  }

  const prompt_template: AnyRec = {
    basic_info: {
      name,
      description: str(data.description),
      personality: str(data.personality),
      introduction: str(data.creator_notes).trim(),
      initialMessage: str(data.first_mes),
      alternateGreetings: strArr(data.alternate_greetings),
      exampleDialogue: str(data.mes_example),
      keywords: strArr(data.tags).slice(0, 20),
      age: '',
      gender: '',
    },
    modules,
  }
  return { name, prompt_template, skin, lorebook, source, warnings }
}

/** Try every format we know. */
export function importCardJson(raw: unknown): ImportedCard | null {
  return cardFromCharaverse(raw) ?? cardFromCommon(raw)
}

export interface ExportSource {
  name: string
  avatar_url?: string | null
  prompt_template: unknown
  skin?: unknown
  lorebook?: unknown
}

export function toCharaverseCard(c: ExportSource): CharaverseCard {
  return charaverseCardSchema.parse({
    format: 'charaverse-card',
    version: 1,
    name: c.name,
    avatar_url: c.avatar_url ?? null,
    prompt_template: isRec(c.prompt_template) ? c.prompt_template : {},
    skin: isRec(c.skin) ? c.skin : {},
    lorebook: isRec(c.lorebook) ? c.lorebook : {},
    exported_at: new Date().toISOString(),
  })
}

/** A `chara_card_v2` object: readable by other front-ends, lossless for us via extensions.charaverse. */
export function toCommonCardV2(c: ExportSource): AnyRec {
  const card = parseCharacterCard({ name: c.name, prompt_template: c.prompt_template })
  const tpl = isRec(c.prompt_template) ? c.prompt_template : {}
  const basic = isRec(tpl.basic_info) ? tpl.basic_info : {}
  const extraModules = card.modules.map((m) => `【${m.type}】\n${m.content}`).join('\n\n')
  const description = [card.description ?? '', card.age ? `年龄：${card.age}` : '', card.gender ? `性别：${card.gender}` : '', extraModules].filter(Boolean).join('\n\n')
  const sysModule = (Array.isArray(tpl.modules) ? (tpl.modules as AnyRec[]) : []).find((m) => m.type === '注意事项')
  const postModule = (Array.isArray(tpl.modules) ? (tpl.modules as AnyRec[]) : []).find((m) => m.type === '特殊要求')
  const lb = parseLorebook(c.lorebook)
  const book = lb.ok && lb.book.entries.length ? lb.book : null

  return {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: c.name,
      description,
      personality: card.personality ?? '',
      scenario: card.scenario ?? '',
      first_mes: card.initialMessage ?? '',
      mes_example: str(basic.exampleDialogue),
      creator_notes: card.introduction ?? '',
      system_prompt: str(sysModule?.content),
      post_history_instructions: str(postModule?.content),
      alternate_greetings: card.greetings.slice(1),
      tags: strArr(basic.keywords),
      creator: '',
      character_version: '1.0',
      character_book: book
        ? {
            name: book.name,
            scan_depth: book.scanDepth,
            token_budget: book.tokenBudget,
            recursive_scanning: book.recursive,
            entries: book.entries.map((e, i) => ({
              id: i,
              keys: e.keys,
              secondary_keys: e.secondaryKeys,
              comment: e.name,
              content: e.content,
              constant: e.constant,
              selective: e.selective,
              insertion_order: e.order,
              enabled: e.enabled,
              position: e.position === 'before' ? 'before_char' : 'after_char',
              case_sensitive: e.caseSensitive,
              probability: e.probability,
              use_probability: e.probability < 100,
              extensions: { depth: e.depth },
            })),
          }
        : undefined,
      extensions: {
        // regex scripts in the common shape so other front-ends pick them up too
        regex_scripts: parseSkin(c.skin).regexScripts.map((r) => ({
          id: r.id,
          scriptName: r.name,
          findRegex: `/${r.find}/${r.flags}`,
          replaceString: r.replace,
          trimStrings: r.trimStrings,
          placement: r.target === 'both' ? [1, 2] : r.target === 'user' ? [1] : [2],
          disabled: !r.enabled,
          markdownOnly: true,
          promptOnly: false,
          runOnEdit: true,
          substituteRegex: 0,
          minDepth: null,
          maxDepth: null,
        })),
        charaverse: {
          version: 1,
          prompt_template: tpl,
          skin: isRec(c.skin) ? c.skin : {},
          lorebook: isRec(c.lorebook) ? c.lorebook : {},
        },
      },
    },
  }
}

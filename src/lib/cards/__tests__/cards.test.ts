import { describe, expect, it } from 'vitest'
import { readCardFromPng, writeTextChunks, readTextChunks, utf8ToBase64, isPng } from '../png'
import { cardFromCommon, importCardJson, toCharaverseCard, toCommonCardV2 } from '../convert'

/** smallest valid PNG: 1x1 transparent pixel */
const TINY_PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))

describe('png text chunks', () => {
  it('round-trips a card through tEXt chunks and survives re-writing', () => {
    expect(isPng(TINY_PNG)).toBe(true)
    const card = { spec: 'chara_card_v2', data: { name: '冉澄 ✦', description: '中文 & emoji 🚗' } }
    const b64 = utf8ToBase64(JSON.stringify(card))
    const withCard = writeTextChunks(TINY_PNG, { chara: b64 })
    expect(isPng(withCard)).toBe(true)
    expect(readTextChunks(withCard).chara).toBe(b64)
    expect(readCardFromPng(withCard)).toEqual(card)
    // overwrite replaces, does not duplicate
    const again = writeTextChunks(withCard, { chara: utf8ToBase64('{"spec":"chara_card_v2","data":{"name":"B"}}') })
    expect(Object.keys(readTextChunks(again))).toEqual(['chara'])
    expect((readCardFromPng(again) as { data: { name: string } }).data.name).toBe('B')
  })
  it('returns null for pngs without a card and for non-png bytes', () => {
    expect(readCardFromPng(TINY_PNG)).toBeNull()
    expect(readCardFromPng(new Uint8Array([1, 2, 3]))).toBeNull()
  })
})

describe('card conversion', () => {
  const tpl = {
    basic_info: { name: '冉澄', description: '赛车手', personality: '冷淡', introduction: '简介', initialMessage: '你来了。', alternateGreetings: ['雨还没停。'], exampleDialogue: '<START>\n{{user}}: 嗨\n{{char}}: 嗯。', keywords: ['赛车'], age: '27', gender: 'female' },
    modules: [{ type: '初始情景', content: '雨夜车库' }, { type: '注意事项', content: '别啰嗦' }, { type: '自定义模块', name: '口癖', content: '嗯哼' }],
  }
  const lorebook = { version: 1, name: '设定', scanDepth: 6, tokenBudget: 2000, recursive: false, entries: [{ id: 'a', name: '天气', enabled: true, keys: ['雨'], secondaryKeys: [], selective: false, caseSensitive: false, constant: false, content: '常年下雨', position: 'before', order: 1, probability: 100, depth: 0 }] }

  it('exports v2 that imports back losslessly via extensions, and is readable without them', () => {
    const v2 = toCommonCardV2({ name: '冉澄', prompt_template: tpl, skin: { version: 1, css: '.x{}' }, lorebook })
    const d = v2.data as Record<string, unknown>
    expect(d.first_mes).toBe('你来了。')
    expect(d.alternate_greetings).toEqual(['雨还没停。'])
    expect(d.scenario).toBe('雨夜车库')
    expect(d.system_prompt).toBe('别啰嗦')
    expect(String(d.description)).toContain('口癖')
    expect((d.character_book as { entries: unknown[] }).entries).toHaveLength(1)

    const back = cardFromCommon(v2)!
    expect(back.source).toBe('v2')
    expect(back.prompt_template).toEqual(tpl)
    expect(back.skin.css).toBe('.x{}')
    expect(back.lorebook.entries[0].content).toBe('常年下雨')

    // strip our extension → mapped import
    const stripped = { ...v2, data: { ...(v2.data as object), extensions: {} } }
    const mapped = cardFromCommon(stripped)!
    const basic = mapped.prompt_template.basic_info as Record<string, unknown>
    expect(basic.initialMessage).toBe('你来了。')
    expect(basic.alternateGreetings).toEqual(['雨还没停。'])
    expect((mapped.prompt_template.modules as { type: string }[]).map((m) => m.type)).toEqual(['初始情景', '注意事项'])
    expect(mapped.lorebook.entries[0].position).toBe('before')
  })
  it('imports v1 flat cards and our own json', () => {
    const v1 = cardFromCommon({ name: 'A', description: 'd', personality: 'p', scenario: 's', first_mes: 'hi', mes_example: '' })!
    expect(v1.source).toBe('v1')
    expect((v1.prompt_template.basic_info as { description: string }).description).toBe('d')
    const own = importCardJson(toCharaverseCard({ name: '冉澄', prompt_template: tpl, skin: {}, lorebook }))!
    expect(own.source).toBe('charaverse')
    expect(own.lorebook.entries).toHaveLength(1)
    expect(importCardJson({ hello: 'world' })).toBeNull()
  })
})


describe('regex scripts on common cards', () => {
  const card = {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: 'Rx',
      description: 'd',
      first_mes: 'hi',
      extensions: {
        regex_scripts: [
          { scriptName: 'status bar', findRegex: '/<status>([\\s\\S]*?)<\\/status>/g', replaceString: '<div class="bar">$1</div>', placement: [2], disabled: false },
          { scriptName: 'strip', findRegex: '/\\*\\*/g', replaceString: '', placement: [1, 2] },
        ],
      },
    },
  }

  it('imports extensions.regex_scripts into the skin, flagging HTML replacements', () => {
    const imported = cardFromCommon(card)
    expect(imported).not.toBeNull()
    const scripts = imported!.skin.regexScripts
    expect(scripts).toHaveLength(2)
    expect(scripts[0].find).toBe('<status>([\\s\\S]*?)<\\/status>')
    expect(scripts[0].renderAsHtml).toBe(true)
    expect(scripts[0].target).toBe('ai')
    expect(scripts[1].renderAsHtml).toBe(false)
    expect(scripts[1].target).toBe('both')
    expect(imported!.skin.renderHtml).toBe(true)
  })

  it('exports them back as extensions.regex_scripts', () => {
    const imported = cardFromCommon(card)!
    const out = toCommonCardV2({ name: imported.name, prompt_template: imported.prompt_template, skin: imported.skin, lorebook: imported.lorebook })
    const rx = (out.data as { extensions: { regex_scripts: { findRegex: string; replaceString: string; placement: number[] }[] } }).extensions.regex_scripts
    expect(rx).toHaveLength(2)
    expect(rx[0].findRegex.startsWith('/<status>')).toBe(true)
    expect(rx[0].replaceString).toContain('<div')
    expect(rx[1].placement).toEqual([1, 2])
  })
})

import { describe, expect, it } from 'vitest'
import stFixture from './fixtures/st-preset.json'
import {
  BUILTIN_DEFAULT_PRESET,
  MARKER_IDS,
  MARKER_LABELS,
  PRESET_MAX_SERIALIZED_CHARS,
  exportPreset,
  importPresetJson,
  importSillyTavernPreset,
  isSillyTavernPreset,
  parsePreset,
  type PresetFile,
} from '../presets'

describe('parsePreset', () => {
  it('accepts the builtin default preset', () => {
    const r = parsePreset(BUILTIN_DEFAULT_PRESET)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.preset.name).toBe('CharaVerse 默认')
    expect(r.preset.prompts.map((p) => p.id)).toEqual([
      'main',
      'charDescription',
      'charPersonality',
      'scenario',
      'charModules',
      'personaDescription',
      'worldInfoBefore',
      'summaries',
      'memoryTable',
      'worldInfoAfter',
      'dialogueExamples',
      'chatHistory',
    ])
    expect(r.preset.prompts.find((p) => p.id === 'dialogueExamples')?.enabled).toBe(false)
    expect(r.preset.sampling).toEqual({ temperature: 1, top_p: 0.95, max_tokens: 4096 })
    expect(r.preset.prompts[0].content).toContain('来玩角色扮演，接下来，你将完全成为"{{char}}"与我对话')
  })

  it('applies defaults to a minimal preset', () => {
    const r = parsePreset({ name: 'x', prompts: [{ id: 'main', content: 'hi' }] })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.preset.version).toBe(1)
    expect(r.preset.prompts[0]).toMatchObject({ enabled: true, role: 'system', content: 'hi' })
    expect(r.preset.sampling).toEqual({})
    expect(r.preset.formatting).toEqual({})
  })

  it('rejects a marker with an unknown id', () => {
    const r = parsePreset({ name: 'x', prompts: [{ id: 'notAMarker', marker: true }] })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('notAMarker')
  })

  it('allows any id for non-marker prompts', () => {
    const r = parsePreset({ name: 'x', prompts: [{ id: 'whatever-uuid', content: 'a' }] })
    expect(r.ok).toBe(true)
  })

  it('rejects an oversize preset', () => {
    const big = { name: 'x', prompts: [{ id: 'main', content: 'a'.repeat(PRESET_MAX_SERIALIZED_CHARS + 10) }] }
    const r = parsePreset(big)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('过大')
  })

  it('rejects out-of-range sampling', () => {
    const r = parsePreset({ name: 'x', prompts: [], sampling: { temperature: 3 } })
    expect(r.ok).toBe(false)
  })

  it('has a label for every marker', () => {
    for (const id of MARKER_IDS) expect(MARKER_LABELS[id].length).toBeGreaterThan(0)
  })
})

describe('importSillyTavernPreset', () => {
  const result = importSillyTavernPreset(stFixture)

  it('imports the fixture', () => {
    expect(result.ok).toBe(true)
  })

  const preset = (result.ok ? result.preset : undefined) as PresetFile

  it('uses the name and tags the source', () => {
    expect(preset.name).toBe('测试破限 v3')
    expect(preset.source?.format).toBe('sillytavern')
    expect(preset.source?.raw).toBe(stFixture)
  })

  it('orders prompts by the character_id 100001 prompt_order, appends CharaVerse markers before chatHistory, and puts unlisted prompts last (disabled)', () => {
    expect(preset.prompts.map((p) => p.id)).toEqual([
      'main',
      'worldInfoBefore',
      'charDescription',
      'charPersonality',
      'scenario',
      'enhanceDefinitions',
      'nsfw',
      'worldInfoAfter',
      'dialogueExamples',
      'personaDescription',
      '7a1b2c3d-0000-4000-8000-000000000001',
      'charModules',
      'memoryTable',
      'summaries',
      'chatHistory',
      'jailbreak',
      'orphan-prompt',
    ])
  })

  it('maps enabled flags from prompt_order', () => {
    const enabled = Object.fromEntries(preset.prompts.map((p) => [p.id, p.enabled]))
    expect(enabled.main).toBe(true)
    expect(enabled.enhanceDefinitions).toBe(false)
    expect(enabled.nsfw).toBe(true)
    expect(enabled['orphan-prompt']).toBe(false)
    expect(enabled.charModules).toBe(true)
    expect(enabled.memoryTable).toBe(true)
    expect(enabled.summaries).toBe(true)
  })

  it('marks ST markers as markers and content prompts as content', () => {
    const byId = Object.fromEntries(preset.prompts.map((p) => [p.id, p]))
    for (const id of ['chatHistory', 'dialogueExamples', 'worldInfoBefore', 'worldInfoAfter', 'charDescription', 'charPersonality', 'scenario', 'personaDescription']) {
      expect(byId[id].marker, id).toBe(true)
    }
    expect(byId.main.marker).toBeUndefined()
    expect(byId.main.content).toContain("{{char}}'s next reply")
    expect(byId.nsfw.marker).toBeUndefined()
    expect(byId.jailbreak.marker).toBeUndefined()
    expect(byId['7a1b2c3d-0000-4000-8000-000000000001']).toMatchObject({ role: 'user', content: '请用中文回复，文笔细腻。', name: '风格要求' })
    expect(byId['orphan-prompt'].role).toBe('assistant')
  })

  it('maps injection_position 1 to absolute with depth, others to relative', () => {
    const byId = Object.fromEntries(preset.prompts.map((p) => [p.id, p]))
    expect(byId.jailbreak.injection).toEqual({ position: 'absolute', depth: 2, role: 'system' })
    expect(byId['7a1b2c3d-0000-4000-8000-000000000001'].injection).toBeUndefined()
    expect(byId.main.injection).toBeUndefined()
  })

  it('clamps sampling into schema ranges', () => {
    expect(preset.sampling).toEqual({
      temperature: 2,
      top_p: 0.92,
      top_k: 40,
      frequency_penalty: 0.3,
      presence_penalty: -2,
      max_tokens: 3000,
    })
  })

  it('defaults absolute depth to 4 and name to 导入的预设, and appends chatHistory when missing', () => {
    const r = importSillyTavernPreset({
      prompts: [
        { identifier: 'jailbreak', content: 'jb', injection_position: 1 },
        { identifier: 'main', content: 'm' },
      ],
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.preset.name).toBe('导入的预设')
    expect(r.preset.prompts.map((p) => p.id)).toEqual(['jailbreak', 'main', 'charModules', 'memoryTable', 'summaries', 'chatHistory'])
    expect(r.preset.prompts[0].injection?.depth).toBe(4)
    // no prompt_order → prompt's own enabled flag (default true)
    expect(r.preset.prompts.every((p) => p.enabled)).toBe(true)
    expect(r.preset.sampling).toEqual({})
  })

  it('falls back to character_id 100000 then the first group', () => {
    const r = importSillyTavernPreset({
      prompts: [{ identifier: 'a', content: 'a' }, { identifier: 'b', content: 'b' }],
      prompt_order: [
        { character_id: 5, order: [{ identifier: 'b', enabled: true }] },
        { character_id: 100000, order: [{ identifier: 'a', enabled: false }] },
      ],
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.preset.prompts.slice(0, 2).map((p) => [p.id, p.enabled])).toEqual([['a', false], ['b', false]])
  })

  it('rejects non-ST input', () => {
    expect(importSillyTavernPreset({ name: 'x' }).ok).toBe(false)
    expect(importSillyTavernPreset(null).ok).toBe(false)
  })
})

describe('importPresetJson / exportPreset', () => {
  it('detects ST vs CharaVerse format', () => {
    expect(isSillyTavernPreset(stFixture)).toBe(true)
    expect(isSillyTavernPreset(BUILTIN_DEFAULT_PRESET)).toBe(false)
    const st = importPresetJson(JSON.stringify(stFixture))
    expect(st.ok && st.preset.source?.format).toBe('sillytavern')
    const cv = importPresetJson(JSON.stringify(BUILTIN_DEFAULT_PRESET))
    expect(cv.ok && cv.preset.name).toBe('CharaVerse 默认')
    expect(importPresetJson('{not json').ok).toBe(false)
  })

  it('exportPreset round-trips through parsePreset and omits source.raw', () => {
    const imported = importSillyTavernPreset(stFixture)
    expect(imported.ok).toBe(true)
    if (!imported.ok) return
    const json = exportPreset(imported.preset)
    expect(json).not.toContain('prompt_order')
    const parsed = JSON.parse(json)
    expect(parsed.source).toEqual({ format: 'sillytavern' })
    const again = parsePreset(parsed)
    expect(again.ok).toBe(true)
    if (!again.ok) return
    expect(again.preset.prompts).toEqual(imported.preset.prompts)
    expect(again.preset.sampling).toEqual(imported.preset.sampling)

    const builtinJson = exportPreset(BUILTIN_DEFAULT_PRESET)
    const builtinAgain = parsePreset(JSON.parse(builtinJson))
    expect(builtinAgain.ok && builtinAgain.preset).toEqual(BUILTIN_DEFAULT_PRESET)
  })
})

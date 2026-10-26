import { describe, expect, it } from 'vitest'
import type { Character } from '@/app/lib/supabase'
import { buildPromptTemplate, draftFromCharacter, emptyDraft, validateDraft } from '../types'

const base = { id: 1, user_id: 'u', avatar_url: '', is_public: false, created_at: '2026-01-01' } as Character

describe('character draft ↔ prompt_template', () => {
  it('maps common-card fields onto typed modules and back', () => {
    const d = emptyDraft()
    d.name = '澄'
    d.description = '描述'
    d.personality = '性格'
    d.scenario = '雨夜车站'
    d.systemPrompt = '第三人称'
    d.postHistory = '每次 200 字'
    d.persona = { name: '阿一', age: '22', gender: 'female', details: '邻居' }
    d.extras = [{ id: 'x', name: '术语表', content: '阶段 = 实验轮次' }, { id: 'y', name: '', content: '' }]
    const tpl = buildPromptTemplate(d)
    const modules = tpl.modules as { type: string; name?: string; content: string }[]
    expect(modules.map((m) => m.type)).toEqual(['用户角色设定', '初始情景', '注意事项', '特殊要求', '自定义模块'])
    expect(modules[0].content).toContain('用户角色姓名：阿一')
    expect(modules[4].name).toBe('术语表')

    const back = draftFromCharacter({ ...base, name: '澄', prompt_template: tpl })
    expect(back.scenario).toBe('雨夜车站')
    expect(back.systemPrompt).toBe('第三人称')
    expect(back.postHistory).toBe('每次 200 字')
    expect(back.persona).toEqual({ name: '阿一', age: '22', gender: 'female', details: '邻居' })
    expect(back.extras.map((e) => e.name)).toEqual(['术语表'])
    expect(back.description).toBe('描述')
  })

  it('reads legacy rows: composed persona content, repeated fixed modules, unknown types', () => {
    const tpl = {
      basic_info: { name: 'L', description: 'd' },
      modules: [
        { type: '用户角色设定', content: '用户角色姓名：小明\n用户角色年龄：未设定\n用户角色性别：male\n用户角色详细设定：学生' },
        { type: '初始情景', content: '第一段' },
        { type: '初始情景', content: '第二段' },
        { type: '剧情线', content: '第三章' },
      ],
    }
    const d = draftFromCharacter({ ...base, name: 'L', prompt_template: tpl })
    expect(d.persona).toEqual({ name: '小明', age: '', gender: 'male', details: '学生' })
    expect(d.scenario).toBe('第一段\n\n第二段')
    expect(d.extras).toEqual([expect.objectContaining({ name: '剧情线', content: '第三章' })])
  })

  it('validates name and some content', () => {
    const d = emptyDraft()
    expect(validateDraft(d)).toEqual({ name: '角色需要一个名字', content: '至少写一段描述、性格或场景' })
    d.name = 'A'; d.scenario = 's'
    expect(validateDraft(d)).toEqual({})
  })
})

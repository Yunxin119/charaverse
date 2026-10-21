import { describe, expect, it } from 'vitest'
import { parseCharacterCard } from '../characterCard'
import { formatMemoryTable } from '../memoryTable'

describe('parseCharacterCard', () => {
  it('reads the legacy prompt_template shape', () => {
    const card = parseCharacterCard({
      name: 'row-name',
      prompt_template: {
        basic_info: { name: '冉澄', description: '赛车手', age: '27', gender: 'female', initialMessage: '你来了。', introduction: '公开简介' },
        modules: [
          { type: '用户角色设定', userRoleName: '阿黎', userRoleGender: 'male', userRoleAge: '25', userRoleDetails: '记者' },
          { type: '初始情景', content: '雨夜的车库' },
          { type: '注意事项', content: '别太啰嗦' },
          { type: '自定义模块', name: '口癖', content: '喜欢说「嗯哼」' },
          { type: '特殊要求', content: '   ' },
        ],
        custom_css: '.x{}',
      },
    })
    expect(card.name).toBe('冉澄')
    expect(card.gender).toBe('女')
    expect(card.scenario).toBe('雨夜的车库')
    expect(card.userName).toBe('阿黎')
    expect(card.persona).toContain('性别：男')
    expect(card.modules.map((m) => m.type)).toEqual(['注意事项', '口癖'])
    expect(card.initialMessage).toBe('你来了。')
    expect(card.customCss).toBe('.x{}')
  })
  it('never throws on garbage', () => {
    expect(parseCharacterCard({ name: 'x', prompt_template: null }).name).toBe('x')
    expect(parseCharacterCard({ prompt_template: 'nope' }).userName).toBe('用户')
  })
})

describe('formatMemoryTable', () => {
  it('groups by type in priority order with metadata details', () => {
    const t = formatMemoryTable([
      { type: 'event', title: '初遇', content: '车库', importance: 7, metadata: { time: '02:45', participants: ['阿黎'] } },
      { type: 'relationship', title: '信任', content: '升温', importance: 9, metadata: { affection: 6 } },
      { type: 'task', title: '约定', content: '明天见', importance: 8, metadata: { status: 'completed' } },
    ])
    expect(t.indexOf('🤝 关系状态')).toBeLessThan(t.indexOf('📋 任务约定'))
    expect(t.indexOf('📋 任务约定')).toBeLessThan(t.indexOf('📅 重要事件'))
    expect(t).toContain('好感:6/10')
    expect(t).toContain('✅ 约定')
    expect(t).toContain('参与:阿黎')
  })
  it('returns empty string for no memories', () => {
    expect(formatMemoryTable([])).toBe('')
  })
})

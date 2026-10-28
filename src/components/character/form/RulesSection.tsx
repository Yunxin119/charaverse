'use client'

import { WriterField } from './WriterField'
import type { CharacterDraft } from './types'

interface Props {
  draft: CharacterDraft
  onChange: <K extends keyof CharacterDraft>(key: K, value: CharacterDraft[K]) => void
}

/** 规则：system prompt + post-history instructions, same meaning as on common cards. */
export function RulesSection({ draft, onChange }: Props) {
  return (
    <div className="space-y-6">
      <WriterField
        id="cf-system"
        label="系统提示"
        hint="一直在的规则，进入提示词的「注意事项」块。"
        value={draft.systemPrompt}
        onChange={(v) => onChange('systemPrompt', v)}
        placeholder="希望模型始终遵守的：语气、禁忌、输出格式、视角。例如：用第三人称写动作和心理，对白用引号；不要替 {{user}} 做决定。"
        minRows={5}
        macros
      />
      <WriterField
        id="cf-post"
        label="后置指令"
        hint="贴在对话历史之后，模型会更听。进入「特殊要求」块。"
        value={draft.postHistory}
        onChange={(v) => onChange('postHistory', v)}
        placeholder="本轮的要求：字数、节奏、风格。例如：每次回复 200–400 字，结尾留一个让 {{user}} 接话的钩子。"
        minRows={4}
        macros
      />
    </div>
  )
}

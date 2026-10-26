'use client'

import { GlassPanel } from '@/components/glass'
import { WriterField } from './WriterField'
import type { CharacterDraft, DraftErrors } from './types'

interface Props {
  draft: CharacterDraft
  errors: DraftErrors
  onChange: <K extends keyof CharacterDraft>(key: K, value: CharacterDraft[K]) => void
}

/** 设定：the three blocks every card format shares. Each lands in its own tagged block of the prompt. */
export function CoreSection({ draft, errors, onChange }: Props) {
  return (
    <GlassPanel className="space-y-6">
      <WriterField
        id="cf-description"
        label="描述"
        required
        error={errors.content}
        hint="TA 是谁：外貌、身份、经历、和世界的关系。这段是提示词的主体，写得具体，模型才稳。"
        value={draft.description}
        onChange={(v) => onChange('description', v)}
        placeholder="从一句话的定位开始，再往下展开……"
        minRows={8}
        macros
      />
      <WriterField
        id="cf-personality"
        label="性格"
        hint="说话方式、脾气、口癖、底线。单独列出来，模型会更稳定地保持。"
        value={draft.personality}
        onChange={(v) => onChange('personality', v)}
        placeholder="例如：嘴硬心软，习惯用反问句，被戳中时会沉默"
        minRows={4}
        macros
      />
      <WriterField
        id="cf-scenario"
        label="场景"
        hint="故事开始时的处境：时间、地点、两人的关系、正在发生什么。"
        value={draft.scenario}
        onChange={(v) => onChange('scenario', v)}
        placeholder="例如：雨夜的末班车站，{{user}} 是今晚唯一的乘客。"
        minRows={4}
        macros
      />
    </GlassPanel>
  )
}

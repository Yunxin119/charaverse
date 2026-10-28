'use client'

import { ExtrasSection } from './ExtrasSection'
import { WriterField } from './WriterField'
import type { CharacterDraft, DraftErrors } from './types'

interface Props {
  draft: CharacterDraft
  errors: DraftErrors
  onChange: <K extends keyof CharacterDraft>(key: K, value: CharacterDraft[K]) => void
}

/** 设定：the three blocks every card format shares, then the author's own named blocks. */
export function CoreSection({ draft, errors, onChange }: Props) {
  return (
    <div className="space-y-6">
      <WriterField
        id="cf-description"
        label="描述"
        required
        error={errors.content}
        hint="TA 是谁：外貌、身份、经历、和世界的关系。这段是提示词的主体，写得具体，模型才稳。"
        value={draft.description}
        onChange={(v) => onChange('description', v)}
        placeholder="从一句话的定位开始，再往下展开：外貌、身份、经历、和这个世界的关系……"
        minRows={8}
        macros
      />
      <WriterField
        id="cf-personality"
        label="性格"
        hint="单独列出来，模型会更稳定地保持。"
        value={draft.personality}
        onChange={(v) => onChange('personality', v)}
        placeholder="说话方式、脾气、口癖、底线。例如：嘴硬心软，习惯用反问句，被戳中时会沉默"
        minRows={4}
        macros
      />
      <WriterField
        id="cf-scenario"
        label="场景"
        hint="故事开始时的处境，进入提示词的「初始情景」块。"
        value={draft.scenario}
        onChange={(v) => onChange('scenario', v)}
        placeholder="时间、地点、两人的关系、正在发生什么。例如：雨夜的末班车站，{{user}} 是今晚唯一的乘客。"
        minRows={4}
        macros
      />
      <div className="border-t border-dashed border-cv-border pt-5">
        <ExtrasSection value={draft.extras} onChange={(v) => onChange('extras', v)} />
      </div>
    </div>
  )
}

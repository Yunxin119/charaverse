'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/glass'
import { WriterField } from './WriterField'

interface Props {
  value: string
  onChange: (v: string) => void
  alternates: string[]
  onAlternatesChange: (v: string[]) => void
  exampleDialogue: string
  onExampleDialogueChange: (v: string) => void
}

/** 开场：the character's first line(s) and the example dialogue. */
export function OpeningSection({ value, onChange, alternates, onAlternatesChange, exampleDialogue, onExampleDialogueChange }: Props) {
  const setAlt = (i: number, v: string) => onAlternatesChange(alternates.map((a, j) => (j === i ? v : a)))
  return (
    <div className="space-y-6">
      <WriterField
        id="cf-initial"
        label="开场白"
        hint="每个新对话的第一条消息，由角色说出。留空则由模型按设定自己开口。"
        value={value}
        onChange={onChange}
        placeholder="例如：雨还没停。{{user}}，你要是不急着走，我这儿还有半壶热茶。"
        minRows={6}
        macros
      />
      {alternates.map((alt, i) => (
        <div key={i} className="relative">
          <WriterField id={`cf-alt-${i}`} label={`备选开场白 ${i + 1}`} value={alt} onChange={(v) => setAlt(i, v)} placeholder="另一个版本的开场…" minRows={4} macros />
          <IconButton label="删除这条开场白" variant="ghost" size="sm" className="absolute -top-1.5 right-0 text-cv-fg-subtle hover:text-cv-danger" onClick={() => onAlternatesChange(alternates.filter((_, j) => j !== i))}><Trash2 /></IconButton>
        </div>
      ))}
      <div className="flex items-center justify-between gap-3 border-t border-dashed border-cv-border pt-4">
        <p className="text-xs text-cv-fg-subtle">有备选时，开新对话的第一条消息可以左右切换。</p>
        <Button type="button" size="sm" variant="neu" disabled={alternates.length >= 20} onClick={() => onAlternatesChange([...alternates, ''])}><Plus /> 备选开场白</Button>
      </div>
      <WriterField
        id="cf-example"
        label="对话示例"
        hint={<>只有预设启用了「对话示例」占位才会注入，预览里会提示。</>}
        value={exampleDialogue}
        onChange={onExampleDialogueChange}
        placeholder={'几段示范，教模型说话方式：\n<START>\n{{user}}: 今天还跑吗？\n{{char}}: 看雨停不停。'}
        minRows={5}
        mono
      />
    </div>
  )
}

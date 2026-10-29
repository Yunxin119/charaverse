'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, Info } from 'lucide-react'
import { Chip } from '@/components/glass'
import { parseCharacterCard } from '@/lib/chat/characterCard'
import { activateLorebooks } from '@/lib/lorebook/activate'
import { assemble, type ChatMessageLike } from '@/lib/prompt/assemble'
import { MARKER_LABELS, type PresetFile } from '@/lib/prompt/presets'
import { estimateTokens } from '@/lib/prompt/tokens'
import { cn } from '@/lib/utils'
import { buildPromptTemplate, type CharacterDraft } from '../form/types'

export interface PresetOption { id: string | null; name: string; preset: PresetFile }

interface Props {
  draft: CharacterDraft
  /** chosen in the dock header, shared with the live preview */
  preset: PresetOption
}

/**
 * 「模型会看到什么」: the draft run through the real assembler with the chosen preset,
 * an empty history and the world book's constant entries. Shows every block in order with
 * a token estimate, and explains which card parts the preset leaves out.
 */
export function PromptPreview({ draft, preset: chosen }: Props) {
  const result = useMemo(() => {
    const tpl = buildPromptTemplate(draft)
    const card = parseCharacterCard({ name: draft.name || '角色', prompt_template: tpl })
    const books = draft.lorebook.entries.length > 0 ? [draft.lorebook] : []
    const lore = books.length ? activateLorebooks({ books, recent: [] }) : null
    const out = assemble({
      preset: chosen.preset,
      character: { name: card.name, description: card.description, personality: card.personality, age: card.age, gender: card.gender, scenario: card.scenario, modules: card.modules },
      user: { name: card.userName, persona: card.persona },
      worldInfo: lore ? { before: lore.before, after: lore.after } : undefined,
      dialogueExamples: card.exampleDialogue,
      history: [],
    })
    const blocks: ChatMessageLike[] = []
    if (out.instructions) blocks.push({ role: 'system', content: out.instructions })
    blocks.push(...out.messages)
    const total = out.stats.instructionTokens + out.stats.messageTokens
    // what the card has that this preset will never inject
    const silent: string[] = []
    const dropped = new Set(out.stats.droppedMarkers)
    const enabledMarkers = new Set(chosen.preset.prompts.filter((p) => p.enabled && p.marker).map((p) => p.id))
    const check = (marker: keyof typeof MARKER_LABELS, has: boolean, what: string) => {
      if (has && !enabledMarkers.has(marker)) silent.push(`${what}：预设里没有启用「${MARKER_LABELS[marker]}」占位，不会注入`)
    }
    check('charDescription', !!card.description, '描述')
    check('charPersonality', !!card.personality, '性格')
    check('scenario', !!card.scenario, '场景')
    check('charModules', card.modules.length > 0, '规则 / 补充设定')
    check('personaDescription', !!card.persona, '用户人设')
    check('dialogueExamples', !!card.exampleDialogue, '对话示例')
    check('worldInfoBefore', books.length > 0 && !enabledMarkers.has('worldInfoAfter'), '世界书')
    const greetingTokens = estimateTokens(draft.initialMessage)
    return { blocks, total, silent, dropped, greetingTokens, opening: card.greetings.length }
  }, [draft, chosen])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] leading-relaxed text-cv-fg-subtle">
          不含对话历史、记忆和摘要；开场白另算 ≈{result.greetingTokens} tok{result.opening > 1 ? `（${result.opening} 条备选）` : ''}。世界书只显示常驻条目。
        </p>
        <Chip tone="accent" className="shrink-0 tabular-nums">≈ {result.total} tok</Chip>
      </div>
      {result.silent.length > 0 && (
        <div className="rounded-cv-md border border-cv-warning/30 bg-[color-mix(in_oklab,var(--cv-warning)_10%,transparent)] px-3 py-2 text-xs text-cv-fg">
          <div className="mb-1 flex items-center gap-1 font-semibold"><Info className="size-3.5 text-cv-warning" />这个预设会忽略</div>
          <ul className="list-disc space-y-0.5 pl-4 text-cv-fg-muted">{result.silent.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
      )}
      <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {result.blocks.map((b, i) => <Block key={i} index={i} block={b} />)}
        {result.blocks.length === 0 && <li className="py-6 text-center text-sm text-cv-fg-subtle">还是空的，先写点设定。</li>}
      </ol>
    </div>
  )
}

function Block({ block, index }: { block: ChatMessageLike; index: number }) {
  const [open, setOpen] = useState(index === 0)
  const tokens = estimateTokens(block.content)
  const tone = block.role === 'system' ? 'info' : block.role === 'user' ? 'primary' : 'accent'
  const label = block.role === 'system' ? 'system' : block.role === 'user' ? 'user' : 'assistant'
  return (
    <li className="neu rounded-cv-md">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-2 text-left">
        <Chip tone={tone} className="px-2 py-0.5 font-mono text-[10px]">{label}</Chip>
        <span className="min-w-0 flex-1 truncate text-xs text-cv-fg-muted">{open ? '' : block.content.replace(/\s+/g, ' ').slice(0, 80)}</span>
        <span className="shrink-0 text-[11px] tabular-nums text-cv-fg-subtle">≈{tokens}</span>
        <ChevronDown className={cn('size-3.5 shrink-0 text-cv-fg-subtle transition-transform', open && 'rotate-180')} />
      </button>
      {open && <pre className="max-h-96 overflow-auto whitespace-pre-wrap border-t border-cv-border px-3 py-2 font-mono text-[11px] leading-5 text-cv-fg [overflow-wrap:anywhere]">{block.content}</pre>}
    </li>
  )
}

'use client'

import { useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Chip } from '@/components/glass'
import { MARKER_LABELS, isMarkerId, type PresetPrompt } from '@/lib/prompt/presets'
import { estimateTokens } from '@/lib/prompt/tokens'
import { SUPPORTED_MACROS } from './presetUtils'

type Role = PresetPrompt['role']
const ROLES: Role[] = ['system', 'user', 'assistant']
const ROLE_LABEL: Record<Role, string> = { system: 'system · 系统', user: 'user · 用户', assistant: 'assistant · 助手' }

const MARKER_HELP: Partial<Record<string, string>> = {
  charDescription: '组装时替换为当前角色卡的「描述」段落。',
  charPersonality: '组装时替换为角色卡的「性格」段落。',
  scenario: '组装时替换为角色卡的「初始情景」。',
  charModules: '组装时替换为角色卡的其他模块（注意事项 / 特殊要求 / 自定义段落）。',
  personaDescription: '组装时替换为你在本会话中的用户人设。',
  memoryTable: '组装时替换为本会话的记忆表（会话设置里可关闭）。',
  summaries: '组装时替换为剧情摘要（会话设置里可关闭）。',
  chatHistory: '聊天历史插入的位置。绝对注入（深度 N）的条目会以这里为基准插入历史中。',
  worldInfoBefore: '预留：世界书前置条目。目前不会填入内容。',
  worldInfoAfter: '预留：世界书后置条目。目前不会填入内容。',
  dialogueExamples: '预留：对话示例。目前不会填入内容。',
}

interface Props {
  prompt: PresetPrompt
  readOnly?: boolean
  onChange: (patch: Partial<PresetPrompt>) => void
}

export function PromptDetail({ prompt, readOnly, onChange }: Props) {
  const tokens = useMemo(() => estimateTokens(prompt.content), [prompt.content])

  if (prompt.marker) {
    const label = isMarkerId(prompt.id) ? MARKER_LABELS[prompt.id] : prompt.id
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="warning">占位</Chip>
          <h3 className="font-display text-lg font-semibold">{label}</h3>
          <code className="font-mono text-xs text-cv-fg-subtle">{prompt.id}</code>
        </div>
        <p className="text-sm text-cv-fg-muted leading-relaxed">
          {MARKER_HELP[prompt.id] ?? '占位条目在组装 prompt 时由 CharaVerse 用自己的数据填入，没有可编辑的内容。'}
        </p>
        <p className="text-xs text-cv-fg-subtle">
          可以在列表里拖动它改变插入顺序，或用开关暂时停用。
        </p>
      </div>
    )
  }

  const injection = prompt.injection ?? { position: 'relative' as const, depth: 0, role: prompt.role }
  const absolute = injection.position === 'absolute'

  const setInjection = (patch: Partial<NonNullable<PresetPrompt['injection']>>) => {
    const next = { ...injection, ...patch }
    onChange({ injection: next.position === 'relative' ? undefined : next })
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <div className="space-y-1.5">
          <Label htmlFor="cv-prompt-name">名称</Label>
          <Input
            id="cv-prompt-name"
            value={prompt.name ?? ''}
            maxLength={120}
            readOnly={readOnly}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>角色</Label>
          <Select value={prompt.role} disabled={readOnly} onValueChange={(v) => onChange({ role: v as Role })}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="neu rounded-cv-md p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label>注入位置</Label>
            <p className="mt-0.5 text-xs text-cv-fg-muted">
              {absolute ? '绝对：按深度插入聊天历史中（深度 0 = 最后一条消息之后）' : '相对：按列表顺序拼入 system prompt'}
            </p>
          </div>
          <Select
            value={injection.position}
            disabled={readOnly}
            onValueChange={(v) => setInjection({ position: v as 'relative' | 'absolute' })}
          >
            <SelectTrigger className="w-28 shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="relative">相对</SelectItem>
              <SelectItem value="absolute">绝对</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {absolute && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-xs text-cv-fg-muted">深度</span>
              <Input
                type="number"
                min={0}
                max={999}
                step={1}
                value={injection.depth}
                readOnly={readOnly}
                onChange={(e) => setInjection({ depth: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-cv-fg-muted">注入角色</span>
              <Select value={injection.role} disabled={readOnly} onValueChange={(v) => setInjection({ role: v as Role })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="cv-prompt-content">内容</Label>
          <span className="font-mono text-[11px] text-cv-fg-subtle">≈{tokens} tokens · {prompt.content.length} 字符</span>
        </div>
        <Textarea
          id="cv-prompt-content"
          value={prompt.content}
          readOnly={readOnly}
          maxLength={50_000}
          spellCheck={false}
          onChange={(e) => onChange({ content: e.target.value })}
          className="min-h-[280px] font-mono text-xs leading-relaxed field-sizing-fixed"
          placeholder="在这里写 prompt 内容……"
        />
        <p className="text-[11px] text-cv-fg-subtle leading-relaxed">
          支持宏：
          {SUPPORTED_MACROS.map((m) => (
            <code key={m} className="mx-0.5 rounded-cv-sm bg-cv-fg/6 px-1 py-0.5 font-mono">{m}</code>
          ))}
        </p>
      </div>
    </div>
  )
}

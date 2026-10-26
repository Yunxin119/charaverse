'use client'

import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FONT_FAMILIES, type FontFamilyKey, type SkinKnobs } from '@/lib/skins/knobs'
import { cn } from '@/lib/utils'

interface Props {
  value: SkinKnobs
  onChange: (next: SkinKnobs) => void
}

/** No-code skin controls. Every control has a 「默认」 state (undefined) so unset knobs emit no CSS. */
export function KnobsPanel({ value, onChange }: Props) {
  const set = <K extends keyof SkinKnobs>(k: K, v: SkinKnobs[K]) => onChange({ ...value, [k]: v })
  const dirty = Object.values(value).some((v) => v !== undefined)

  return (
    <div className="neu rounded-cv-md p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">旋钮</div>
          <div className="text-xs text-cv-fg-subtle">不用写 CSS 的常用调整；生成的规则排在下面的高级 CSS 前面，手写的优先。</div>
        </div>
        {dirty && <Button size="sm" variant="ghost" onClick={() => onChange({})}><RotateCcw /> 全部重置</Button>}
      </div>

      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <Group title="气泡">
          <ColorRow label="AI 气泡底色" value={value.aiBubbleBg} onChange={(v) => set('aiBubbleBg', v)} />
          <ColorRow label="AI 气泡文字" value={value.aiBubbleFg} onChange={(v) => set('aiBubbleFg', v)} />
          <ColorRow label="用户气泡底色" value={value.userBubbleBg} onChange={(v) => set('userBubbleBg', v)} />
          <ColorRow label="用户气泡文字" value={value.userBubbleFg} onChange={(v) => set('userBubbleFg', v)} />
          <SliderRow label="气泡不透明度" value={value.bubbleOpacity} min={0.1} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set('bubbleOpacity', v)} />
          <SliderRow label="圆角" value={value.bubbleRadius} min={0} max={32} step={1} format={(v) => `${v}px`} onChange={(v) => set('bubbleRadius', v)} />
        </Group>

        <Group title="文字与背景">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-cv-fg-muted">字体</span>
            <Select value={value.fontFamily ?? '__default__'} onValueChange={(v) => set('fontFamily', v === '__default__' ? undefined : (v as FontFamilyKey))}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">跟随主题</SelectItem>
                {(Object.keys(FONT_FAMILIES) as FontFamilyKey[]).map((k) => <SelectItem key={k} value={k}>{FONT_FAMILIES[k].label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <SliderRow label="字号" value={value.fontSize} min={12} max={22} step={1} format={(v) => `${v}px`} onChange={(v) => set('fontSize', v)} />
          <SliderRow label="行高" value={value.lineHeight} min={1.2} max={2.2} step={0.05} format={(v) => v.toFixed(2)} onChange={(v) => set('lineHeight', v)} />
          <ColorRow label="名字 / 时间" value={value.metaColor} onChange={(v) => set('metaColor', v)} />
          <ColorRow label="聊天区底色" value={value.chatBg} onChange={(v) => set('chatBg', v)} />
          <SliderRow label="背景图压暗" value={value.overlay} min={0} max={0.9} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set('overlay', v)} />
        </Group>
      </div>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cv-fg-subtle">{title}</div>
      {children}
    </div>
  )
}

function ColorRow({ label, value, onChange }: { label: string; value?: string; onChange: (v: string | undefined) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-cv-fg-muted">{label}</span>
      <span className="flex items-center gap-1.5">
        {value ? <code className="font-mono text-[11px] text-cv-fg-subtle">{value}</code> : <span className="text-[11px] text-cv-fg-subtle">默认</span>}
        <label className={cn('relative size-7 cursor-pointer overflow-hidden rounded-full ring-1 ring-cv-border', !value && 'bg-[repeating-conic-gradient(var(--cv-border)_0_25%,transparent_0_50%)] bg-[length:8px_8px]')} style={value ? { background: value } : undefined} title={label}>
          <input type="color" value={value ?? '#888888'} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" aria-label={label} />
        </label>
        {value && <button type="button" onClick={() => onChange(undefined)} className="text-[11px] text-cv-fg-subtle hover:text-cv-fg" aria-label={`重置${label}`}>×</button>}
      </span>
    </div>
  )
}

function SliderRow({ label, value, min, max, step, format, onChange }: { label: string; value?: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number | undefined) => void }) {
  const shown = value ?? (min + max) / 2
  return (
    <label className="block text-xs">
      <span className="flex items-center justify-between gap-3">
        <span className="text-cv-fg-muted">{label}</span>
        <span className="flex items-center gap-1.5 tabular-nums text-cv-fg-subtle">
          {value === undefined ? '默认' : format(value)}
          {value !== undefined && <button type="button" onClick={() => onChange(undefined)} className="hover:text-cv-fg" aria-label={`重置${label}`}>×</button>}
        </span>
      </span>
      <input type="range" min={min} max={max} step={step} value={shown} onChange={(e) => onChange(Number(e.target.value))} className={cn('mt-1 w-full accent-[var(--cv-accent)]', value === undefined && 'opacity-50')} />
    </label>
  )
}

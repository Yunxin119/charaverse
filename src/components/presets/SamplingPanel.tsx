'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { PresetFile, PresetSampling } from '@/lib/prompt/presets'

interface Props {
  sampling: PresetSampling
  formatting: PresetFile['formatting']
  readOnly?: boolean
  onSamplingChange: (patch: Partial<PresetSampling>) => void
  onFormattingChange: (patch: Partial<PresetFile['formatting']>) => void
}

interface SliderSpec {
  key: keyof Pick<PresetSampling, 'temperature' | 'top_p' | 'frequency_penalty' | 'presence_penalty'>
  label: string
  min: number
  max: number
  step: number
  fallback: number
  hint: string
}

const SLIDERS: SliderSpec[] = [
  { key: 'temperature', label: '温度 temperature', min: 0, max: 2, step: 0.05, fallback: 1, hint: '越高越随机' },
  { key: 'top_p', label: 'top_p', min: 0, max: 1, step: 0.01, fallback: 1, hint: '核采样阈值' },
  { key: 'frequency_penalty', label: '频率惩罚 frequency_penalty', min: -2, max: 2, step: 0.05, fallback: 0, hint: '抑制重复用词' },
  { key: 'presence_penalty', label: '存在惩罚 presence_penalty', min: -2, max: 2, step: 0.05, fallback: 0, hint: '鼓励引入新话题' },
]

function fmt(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2)
}

export function SamplingPanel({ sampling, formatting, readOnly, onSamplingChange, onFormattingChange }: Props) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {SLIDERS.map((s) => {
          const value = sampling[s.key]
          const unset = value === undefined
          const shown = unset ? s.fallback : value
          return (
            <div key={s.key} className="neu rounded-cv-md px-4 py-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{s.label}</span>
                <span className="font-mono text-xs text-cv-fg-muted">
                  {unset ? <span className="text-cv-fg-subtle">未设置</span> : fmt(shown)}
                </span>
              </div>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={shown}
                disabled={readOnly}
                aria-label={s.label}
                className="w-full accent-[var(--cv-accent)] disabled:opacity-50"
                onChange={(e) => onSamplingChange({ [s.key]: Number(e.target.value) })}
              />
              <div className="flex items-center justify-between text-[11px] text-cv-fg-subtle">
                <span>{s.hint}</span>
                {!unset && !readOnly && (
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline hover:text-cv-fg-muted"
                    onClick={() => onSamplingChange({ [s.key]: undefined })}
                  >
                    清除
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cv-max-tokens">max_tokens</Label>
          <Input
            id="cv-max-tokens"
            type="number"
            min={1}
            max={65_536}
            step={1}
            placeholder="留空 = 由模型决定"
            value={sampling.max_tokens ?? ''}
            readOnly={readOnly}
            onChange={(e) => {
              const raw = e.target.value
              if (raw === '') return onSamplingChange({ max_tokens: undefined })
              const n = Math.round(Number(raw))
              if (!Number.isFinite(n)) return
              onSamplingChange({ max_tokens: Math.min(65_536, Math.max(1, n)) })
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cv-top-k">top_k</Label>
          <Input
            id="cv-top-k"
            type="number"
            min={0}
            step={1}
            placeholder="留空 = 不限制"
            value={sampling.top_k ?? ''}
            readOnly={readOnly}
            onChange={(e) => {
              const raw = e.target.value
              if (raw === '') return onSamplingChange({ top_k: undefined })
              const n = Math.round(Number(raw))
              if (!Number.isFinite(n)) return
              onSamplingChange({ top_k: Math.max(0, n) })
            }}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cv-prefill">助手预填 assistantPrefill</Label>
        <Textarea
          id="cv-prefill"
          value={formatting.assistantPrefill ?? ''}
          maxLength={2000}
          readOnly={readOnly}
          spellCheck={false}
          placeholder="作为 assistant 开头塞进去的文本，留空不启用"
          className="min-h-20 font-mono text-xs"
          onChange={(e) => onFormattingChange({ assistantPrefill: e.target.value || undefined })}
        />
        <p className="text-[11px] text-cv-fg-subtle">只有支持 assistant 预填的模型才会生效。</p>
      </div>
    </div>
  )
}

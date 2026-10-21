import {
  BUILTIN_DEFAULT_PRESET,
  exportPreset,
  parsePreset,
  type PresetFile,
  type PresetPrompt,
} from '@/lib/prompt/presets'
import { estimateTokens } from '@/lib/prompt/tokens'
import type { UserPreset } from '@/app/lib/supabase'

export const BUILTIN_ID = 'builtin'

/** Deep-clone a preset so the editor draft never aliases query cache / constants. */
export function clonePreset(preset: PresetFile): PresetFile {
  return JSON.parse(JSON.stringify(preset)) as PresetFile
}

/**
 * Row `data` is untyped JSON. Run it through the schema so a hand-edited or legacy row
 * still renders; fall back to a builtin-shaped shell carrying the row name when it is broken.
 */
export function presetFromRow(row: UserPreset): { preset: PresetFile; error: string | null } {
  const parsed = parsePreset(row.data)
  if (parsed.ok) {
    return { preset: parsed.preset.name ? parsed.preset : { ...parsed.preset, name: row.name }, error: null }
  }
  const shell = clonePreset(BUILTIN_DEFAULT_PRESET)
  shell.name = row.name
  return { preset: shell, error: parsed.error }
}

export interface PresetSummary {
  total: number
  enabled: number
  markers: number
  tokens: number
  sampling: string
}

export function summarizePreset(preset: PresetFile): PresetSummary {
  let enabled = 0
  let markers = 0
  let tokens = 0
  for (const p of preset.prompts) {
    if (p.marker) markers++
    if (p.enabled) {
      enabled++
      if (!p.marker) tokens += estimateTokens(p.content)
    }
  }
  return { total: preset.prompts.length, enabled, markers, tokens, sampling: formatSampling(preset) }
}

export function formatSampling(preset: PresetFile): string {
  const s = preset.sampling
  const parts: string[] = []
  if (s.temperature !== undefined) parts.push(`T ${trimNum(s.temperature)}`)
  if (s.top_p !== undefined) parts.push(`top_p ${trimNum(s.top_p)}`)
  if (s.max_tokens !== undefined) parts.push(`${s.max_tokens}`)
  return parts.length ? parts.join(' · ') : '默认采样'
}

function trimNum(n: number): string {
  return Number.isInteger(n) ? n.toFixed(1) : String(Math.round(n * 1000) / 1000)
}

export function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const diff = Date.now() - t
  const min = Math.round(diff / 60_000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr} 小时前`
  const day = Math.round(hr / 24)
  if (day < 30) return `${day} 天前`
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Trigger a browser download of the preset JSON. */
export function downloadPresetJson(preset: PresetFile): void {
  if (typeof window === 'undefined') return
  const blob = new Blob([exportPreset(preset)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const safeName = preset.name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'preset'
  a.href = url
  a.download = `${safeName}.preset.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function copyName(name: string): string {
  const m = /^(.*?)(?:\s*副本(?:\s*(\d+))?)?$/.exec(name)
  const base = (m?.[1] ?? name).trim() || name
  const n = m?.[2] ? Number(m[2]) + 1 : 2
  return m && /副本/.test(name) ? `${base} 副本 ${n}` : `${base} 副本`
}

/** Fresh content prompt with an id that doesn't collide with existing ones. */
export function newContentPrompt(existing: readonly PresetPrompt[]): PresetPrompt {
  const used = new Set(existing.map((p) => p.id))
  let n = existing.length + 1
  let id = `prompt_${n}`
  while (used.has(id)) id = `prompt_${++n}`
  return { id, name: '新条目', enabled: true, role: 'system', content: '' }
}

export const SUPPORTED_MACROS = ['{{char}}', '{{user}}', '{{newline}}', '{{trim}}', '{{date}}', '{{time}}', '{{random:a,b}}'] as const

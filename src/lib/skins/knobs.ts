/**
 * Skin knobs: a handful of visual settings that need no CSS knowledge. They are stored
 * next to the author's CSS (`skin.knobs`) and compiled into CSS at render time, in front
 * of the advanced CSS, so hand-written rules still win.
 */
import { z } from 'zod'

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/)

export const FONT_FAMILIES = {
  sans: { label: '无衬线（默认）', stack: '' },
  serif: { label: '衬线', stack: '"Noto Serif SC", "Source Han Serif SC", "Songti SC", Georgia, serif' },
  rounded: { label: '圆体', stack: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif' },
  mono: { label: '等宽', stack: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' },
} as const
export type FontFamilyKey = keyof typeof FONT_FAMILIES

export const skinKnobsSchema = z.object({
  aiBubbleBg: hex.optional(),
  aiBubbleFg: hex.optional(),
  userBubbleBg: hex.optional(),
  userBubbleFg: hex.optional(),
  /** 0–1, applied to both bubble backgrounds */
  bubbleOpacity: z.number().min(0.1).max(1).optional(),
  /** px */
  bubbleRadius: z.number().min(0).max(32).optional(),
  /** px */
  fontSize: z.number().min(12).max(22).optional(),
  lineHeight: z.number().min(1.2).max(2.2).optional(),
  fontFamily: z.enum(['sans', 'serif', 'rounded', 'mono']).optional(),
  /** chat area background colour */
  chatBg: hex.optional(),
  /** 0–0.9 darkening over the background image */
  overlay: z.number().min(0).max(0.9).optional(),
  /** name / timestamp line under bubbles */
  metaColor: hex.optional(),
})
export type SkinKnobs = z.infer<typeof skinKnobsSchema>

export const EMPTY_KNOBS: SkinKnobs = {}

export function knobsIsEmpty(k: SkinKnobs | undefined): boolean {
  return !k || Object.values(k).every((v) => v === undefined)
}

const pct = (n: number) => `${Math.round(n * 100)}%`
const mix = (color: string, opacity: number | undefined) =>
  opacity === undefined || opacity >= 1 ? color : `color-mix(in oklab, ${color} ${pct(opacity)}, transparent)`

/** Compile knobs into scoped CSS (selectors are scoped again by the sanitizer; this is plain CSS). */
export function knobsToCss(k: SkinKnobs | undefined): string {
  if (knobsIsEmpty(k)) return ''
  const rules: string[] = []
  const root: string[] = []
  if (k!.fontSize !== undefined) root.push(`font-size: ${k!.fontSize}px`)
  if (k!.lineHeight !== undefined) root.push(`line-height: ${k!.lineHeight}`)
  if (k!.fontFamily && FONT_FAMILIES[k!.fontFamily].stack) root.push(`font-family: ${FONT_FAMILIES[k!.fontFamily].stack}`)
  if (k!.chatBg) root.push(`background: ${k!.chatBg}`)
  if (root.length) rules.push(`#cv_chat_root { ${root.join('; ')}; }`)
  if (k!.fontSize !== undefined || k!.lineHeight !== undefined) {
    rules.push(`.cv_message_bubble { font-size: inherit; line-height: inherit; }`)
  }

  const ai: string[] = []
  if (k!.aiBubbleBg) ai.push(`background: ${mix(k!.aiBubbleBg, k!.bubbleOpacity)}`)
  else if (k!.bubbleOpacity !== undefined) ai.push(`background: ${mix('var(--cv-bg-elevated)', k!.bubbleOpacity)}`)
  if (k!.aiBubbleFg) ai.push(`color: ${k!.aiBubbleFg}`)
  if (ai.length) rules.push(`.cv_ai_message_bubble { ${ai.join('; ')}; }`)

  const user: string[] = []
  if (k!.userBubbleBg) user.push(`background: ${mix(k!.userBubbleBg, k!.bubbleOpacity)}`)
  else if (k!.bubbleOpacity !== undefined) user.push(`background: ${mix('var(--cv-primary)', k!.bubbleOpacity)}`)
  if (k!.userBubbleFg) user.push(`color: ${k!.userBubbleFg}`)
  if (user.length) rules.push(`.cv_user_message_bubble { ${user.join('; ')}; }`)

  if (k!.bubbleRadius !== undefined) rules.push(`.cv_message_bubble { border-radius: ${k!.bubbleRadius}px; }`)
  if (k!.overlay !== undefined) rules.push(`#cv_background_overlay { background: rgba(0, 0, 0, ${k!.overlay}); }`)
  if (k!.metaColor) rules.push(`.cv_message_meta { color: ${k!.metaColor}; }`)
  return rules.length ? `/* knobs */\n${rules.join('\n')}` : ''
}

/** Knob CSS first, then the author's advanced CSS (so hand-written rules win on ties). */
export function composeSkinCss(knobs: SkinKnobs | undefined, css: string | undefined): string {
  return [knobsToCss(knobs), css?.trim() ?? ''].filter(Boolean).join('\n\n')
}

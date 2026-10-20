import { z } from 'zod'

/**
 * User-importable theme file (plan §5.4). Only the keys present are overridden;
 * everything else falls back to the built-in Warm Glass tokens.
 */
const color = z.string().regex(/^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)|color-mix\([^)]*\))$/, '不是合法的颜色值')

export const themeTokenKeys = [
  'bg', 'bg-elevated', 'bg-sunken',
  'fg', 'fg-muted', 'fg-subtle',
  'primary', 'primary-hover', 'primary-fg',
  'secondary', 'secondary-fg',
  'accent', 'accent-fg', 'accent-2', 'accent-3',
  'border', 'border-strong', 'ring',
  'success', 'warning', 'danger', 'info',
  'glass-bg', 'glass-bg-strong', 'glass-border',
  'neu-light', 'neu-dark',
  'ambient-1', 'ambient-2',
] as const
export type ThemeTokenKey = (typeof themeTokenKeys)[number]

export const themeSchema = z.object({
  name: z.string().min(1).max(60),
  version: z.literal(1).default(1),
  mode: z.enum(['light', 'dark']).default('light'),
  tokens: z.partialRecord(z.enum(themeTokenKeys), color).default({}),
  glass: z.object({
    blur: z.number().min(0).max(60).optional(),
    saturate: z.number().min(0.5).max(3).optional(),
  }).prefault({}),
  radius: z.object({
    sm: z.number().min(0).max(40).optional(),
    md: z.number().min(0).max(48).optional(),
    lg: z.number().min(0).max(64).optional(),
    xl: z.number().min(0).max(80).optional(),
  }).prefault({}),
  fonts: z.object({
    body: z.string().max(200).optional(),
    display: z.string().max(200).optional(),
    mono: z.string().max(200).optional(),
  }).prefault({}),
  chat: z.object({
    bubbleStyle: z.enum(['glass', 'flat', 'neu']).default('glass'),
    density: z.enum(['cozy', 'compact']).default('cozy'),
    customCss: z.string().max(20000).default(''),
  }).prefault({}),
})
export type ThemeFile = z.infer<typeof themeSchema>
export type ThemeInput = z.input<typeof themeSchema>

export function parseTheme(json: unknown): { ok: true; theme: ThemeFile } | { ok: false; error: string } {
  const r = themeSchema.safeParse(json)
  if (r.success) return { ok: true, theme: r.data }
  const first = r.error.issues[0]
  return { ok: false, error: `${first.path.join('.') || 'theme'}: ${first.message}` }
}

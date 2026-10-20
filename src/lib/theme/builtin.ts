import type { ThemeInput } from './schema'

/**
 * Built-in themes. The first one is what tokens.css already renders, so it is
 * expressed as "no overrides" and only exists for the picker.
 */
export const BUILTIN_THEMES: { id: string; description: string; theme: ThemeInput }[] = [
  {
    id: 'warm-glass',
    description: '默认 · 奶油底、氧化红主色、赭石点缀',
    theme: { name: 'Warm Glass', mode: 'light', tokens: {} },
  },
  {
    id: 'warm-glass-dark',
    description: '默认深色 · 墨褐底、奶油字',
    theme: { name: 'Warm Glass Dark', mode: 'dark', tokens: {} },
  },
  {
    id: 'carbon-neon',
    description: '冷调碳黑 · 近黑底、低饱和桃橙霓虹，适合酒馆风美化卡',
    theme: {
      name: 'Carbon Neon',
      mode: 'dark',
      tokens: {
        bg: '#0c0c0e',
        'bg-elevated': '#141416',
        'bg-sunken': '#08080a',
        fg: '#f5f7fa',
        'fg-muted': '#b9bec7',
        'fg-subtle': '#7b818c',
        primary: '#ffcc99',
        'primary-hover': '#ffd9b3',
        'primary-fg': '#1a1208',
        secondary: '#2a2c33',
        'secondary-fg': '#e8e8e8',
        accent: '#ffb070',
        'accent-fg': '#1a1208',
        'accent-2': '#8ab4ff',
        'accent-3': '#7fd1b9',
        border: 'rgba(255,204,153,0.14)',
        'border-strong': 'rgba(255,204,153,0.28)',
        ring: 'rgba(255,204,153,0.45)',
        'glass-bg': 'rgba(12,12,14,0.55)',
        'glass-bg-strong': 'rgba(12,12,14,0.85)',
        'glass-border': 'rgba(255,204,153,0.15)',
        'neu-light': 'rgba(255,255,255,0.04)',
        'neu-dark': 'rgba(0,0,0,0.7)',
        'ambient-1': 'rgba(255,204,153,0.08)',
        'ambient-2': 'rgba(138,180,255,0.08)',
      },
      glass: { blur: 12, saturate: 1.2 },
      radius: { sm: 8, md: 14, lg: 18, xl: 22 },
    },
  },
  {
    id: 'sage-paper',
    description: '鼠尾草与纸 · 浅灰绿底、墨绿主色，安静的阅读感',
    theme: {
      name: 'Sage Paper',
      mode: 'light',
      tokens: {
        bg: '#eef0ea',
        'bg-elevated': '#f8f9f5',
        'bg-sunken': '#e1e5da',
        fg: '#1f2a24',
        'fg-muted': '#4f5f55',
        'fg-subtle': '#7c8a81',
        primary: '#2f5d4a',
        'primary-hover': '#3b7059',
        'primary-fg': '#f8f9f5',
        secondary: '#c9d3c6',
        'secondary-fg': '#1f2a24',
        accent: '#d08a1f',
        'accent-fg': '#ffffff',
        'ambient-1': 'rgba(47,93,74,0.18)',
        'ambient-2': 'rgba(208,138,31,0.14)',
      },
    },
  },
]

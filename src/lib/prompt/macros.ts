/**
 * SillyTavern-compatible text macros.
 *
 * Supported: {{char}}, {{user}}, {{newline}}, {{trim}}, {{date}}, {{time}},
 * {{random:a,b,c}} (also `{{random::a::b}}`). Names are case-insensitive.
 * Unknown macros are left untouched so author text is never silently eaten.
 */

export interface MacroContext {
  char: string
  user: string
  /** When given, {{random}} picks deterministically (useful for tests / regenerate-stable output). */
  seed?: number
}

const MACRO_RE = /\{\{\s*([a-zA-Z_]+)\s*(?:::?\s*([^}]*?))?\s*\}\}/g

/** Small deterministic PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function splitRandomOptions(arg: string): string[] {
  const parts = arg.includes('::') ? arg.split('::') : arg.split(',')
  return parts.map((p) => p.trim()).filter((p) => p.length > 0)
}

export function applyMacros(text: string, ctx: MacroContext): string {
  if (!text || !text.includes('{{')) return text ?? ''
  const rng = ctx.seed !== undefined ? mulberry32(ctx.seed) : Math.random

  return text.replace(MACRO_RE, (whole: string, rawName: string, rawArg: string | undefined) => {
    const name = rawName.toLowerCase()
    const arg = rawArg ?? ''
    switch (name) {
      case 'char':
        return ctx.char
      case 'user':
        return ctx.user
      case 'newline':
        return '\n'
      case 'trim':
        return ''
      case 'date':
        return new Date().toLocaleDateString()
      case 'time':
        return new Date().toLocaleTimeString()
      case 'random': {
        const options = splitRandomOptions(arg)
        if (options.length === 0) return ''
        return options[Math.floor(rng() * options.length)] ?? ''
      }
      default:
        return whole
    }
  })
}

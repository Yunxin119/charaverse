/**
 * Tiny structured logger. Never pass message bodies, prompts, keys or headers in `meta`.
 * In production only warn/error are emitted.
 */
type Level = 'debug' | 'info' | 'warn' | 'error'
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }
const threshold: number = process.env.NODE_ENV === 'production' ? ORDER.warn : ORDER.debug

function emit(level: Level, msg: string, meta?: Record<string, unknown>) {
  if (ORDER[level] < threshold) return
  const line = `[cv:${level}] ${msg}`
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info
  if (meta && Object.keys(meta).length) fn(line, meta)
  else fn(line)
}

export const log = {
  debug: (msg: string, meta?: Record<string, unknown>) => emit('debug', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => emit('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit('error', msg, meta),
}

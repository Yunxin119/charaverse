import type { Lorebook, LorebookEntry } from './schema'

export interface ActivationInput {
  books: Lorebook[]
  /** recent messages, oldest first; only the last `scanDepth` are scanned per entry */
  recent: { role: 'user' | 'assistant'; content: string }[]
  /** extra text to scan (e.g. the message being sent right now) */
  extraText?: string
  /** deterministic probability rolls in tests */
  random?: () => number
}

export interface ActivationResult {
  before: string
  after: string
  activated: { bookName: string; entry: LorebookEntry }[]
  droppedForBudget: number
}

function matches(entry: LorebookEntry, haystack: string): boolean {
  const hay = entry.caseSensitive ? haystack : haystack.toLowerCase()
  const test = (k: string) => {
    const key = entry.caseSensitive ? k : k.toLowerCase()
    // /regex/ keys are allowed; anything else is a plain substring
    if (key.length > 2 && key.startsWith('/') && key.lastIndexOf('/') > 0) {
      const last = key.lastIndexOf('/')
      try {
        return new RegExp(key.slice(1, last), key.slice(last + 1).replace(/[^gimsuy]/g, '') + (entry.caseSensitive ? '' : 'i')).test(haystack)
      } catch {
        return false
      }
    }
    return hay.includes(key)
  }
  if (!entry.keys.some(test)) return false
  if (entry.selective && entry.secondaryKeys.length > 0 && !entry.secondaryKeys.some(test)) return false
  return true
}

/**
 * Pick the entries that fire for the current context and render them into the two injection slots.
 * Deterministic except for `probability` < 100 (uses `random`).
 */
export function activateLorebooks(input: ActivationInput): ActivationResult {
  const random = input.random ?? Math.random
  const activated: { bookName: string; entry: LorebookEntry; book: Lorebook }[] = []
  const seenIds = new Set<string>()

  const scanText = (depth: number) => {
    const slice = input.recent.slice(-Math.max(1, depth))
    return [...slice.map((m) => m.content), input.extraText ?? ''].join('\n')
  }

  for (const book of input.books) {
    const candidates = book.entries.filter((e) => e.enabled && (e.constant || e.keys.length > 0))
    let pool = candidates
    for (let pass = 0; pass < (book.recursive ? 2 : 1); pass++) {
      const recursed = pass === 1 ? activated.filter((a) => a.book === book).map((a) => a.entry.content).join('\n') : ''
      const next: typeof pool = []
      for (const e of pool) {
        const key = `${book.name}#${e.id}`
        if (seenIds.has(key)) continue
        const hay = scanText(e.depth || book.scanDepth) + (recursed ? `\n${recursed}` : '')
        const fires = e.constant || matches(e, hay)
        if (!fires) { next.push(e); continue }
        if (e.probability < 100 && random() * 100 >= e.probability) continue
        seenIds.add(key)
        activated.push({ bookName: book.name, entry: e, book })
      }
      pool = next
      if (!activated.some((a) => a.book === book)) break
    }
  }

  // budget per book (characters), ordered by `order`
  const before: string[] = []
  const after: string[] = []
  let droppedForBudget = 0
  const used = new Map<Lorebook, number>()
  for (const a of [...activated].sort((x, y) => x.entry.order - y.entry.order)) {
    const spent = used.get(a.book) ?? 0
    const cost = a.entry.content.length
    if (spent + cost > a.book.tokenBudget && !a.entry.constant) { droppedForBudget++; continue }
    used.set(a.book, spent + cost)
    const line = a.entry.name ? `【${a.entry.name}】\n${a.entry.content.trim()}` : a.entry.content.trim()
    ;(a.entry.position === 'before' ? before : after).push(line)
  }
  return {
    before: before.join('\n\n'),
    after: after.join('\n\n'),
    activated: activated.map(({ bookName, entry }) => ({ bookName, entry })),
    droppedForBudget,
  }
}

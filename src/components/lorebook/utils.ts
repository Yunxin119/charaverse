import { exportLorebook, lorebookEntrySchema, type Lorebook, type LorebookEntry } from '@/lib/lorebook/schema'

let seq = 0
export const newEntryId = () => `e_${Date.now().toString(36)}_${(seq++).toString(36)}`

export function newEntry(): LorebookEntry {
  return lorebookEntrySchema.parse({ id: newEntryId() })
}

/** Append `incoming` to `existing`, renaming colliding ids so every entry stays addressable. */
export function mergeEntries(existing: LorebookEntry[], incoming: LorebookEntry[]): LorebookEntry[] {
  const seen = new Set(existing.map((e) => e.id))
  const out = [...existing]
  for (const e of incoming) {
    let id = e.id
    let n = 2
    while (seen.has(id)) id = `${e.id}-${n++}`
    seen.add(id)
    out.push(id === e.id ? e : { ...e, id })
  }
  return out
}

export function downloadLorebookJson(name: string, book: Lorebook) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([exportLorebook({ ...book, name: name || book.name })], { type: 'application/json' }))
  a.download = `${(name || book.name || 'lorebook').replace(/[^\w一-龥-]+/g, '_')}.lorebook.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export const countEnabled = (book: Lorebook) => book.entries.filter((e) => e.enabled).length

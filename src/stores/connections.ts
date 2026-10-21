'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { savedConnectionSchema, type SavedConnection, type ModelRef, parseModelRef, formatModelRef } from '@/lib/connections/types'
import { migrateLegacyConnections, LEGACY_KEYS } from '@/lib/connections/migrateLegacy'
import type { Connection } from '@/lib/llm/connection'

interface ConnectionsState {
  connections: SavedConnection[]
  /** legacy model id → model ref, filled by the one-shot migration */
  legacyRefMap: Record<string, string>
  migrated: boolean
  hydrated: boolean
  add: (c: Omit<SavedConnection, 'id' | 'createdAt'> & { id?: string }) => SavedConnection
  update: (id: string, patch: Partial<SavedConnection>) => void
  remove: (id: string) => void
  setLastTest: (id: string, r: SavedConnection['lastTest']) => void
  runMigration: () => void
}

const genId = () => `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

export const useConnectionsStore = create<ConnectionsState>()(
  persist(
    (set, get) => ({
      connections: [],
      legacyRefMap: {},
      migrated: false,
      hydrated: false,
      add: (c) => {
        const conn = savedConnectionSchema.parse({ ...c, id: c.id ?? genId(), createdAt: Date.now() })
        set((s) => ({ connections: [...s.connections.filter((x) => x.id !== conn.id), conn] }))
        return conn
      },
      update: (id, patch) => set((s) => ({ connections: s.connections.map((c) => (c.id === id ? savedConnectionSchema.parse({ ...c, ...patch }) : c)) })),
      remove: (id) => set((s) => ({ connections: s.connections.filter((c) => c.id !== id) })),
      setLastTest: (id, r) => set((s) => ({ connections: s.connections.map((c) => (c.id === id ? { ...c, lastTest: r } : c)) })),
      runMigration: () => {
        if (get().migrated) return
        const { connections, refMap } = migrateLegacyConnections()
        set((s) => ({
          migrated: true,
          legacyRefMap: { ...s.legacyRefMap, ...refMap },
          connections: [...s.connections, ...connections.filter((c) => !s.connections.some((x) => x.id === c.id))],
        }))
        // keep a backup of the old keys for one release, then drop them
        try {
          const backup: Record<string, string | null> = {}
          for (const k of LEGACY_KEYS) backup[k] = localStorage.getItem(k)
          localStorage.setItem('cv.connections.legacyBackup', JSON.stringify(backup))
          for (const k of LEGACY_KEYS) localStorage.removeItem(k)
        } catch {}
      },
    }),
    {
      name: 'cv.connections',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ connections: s.connections, legacyRefMap: s.legacyRefMap, migrated: s.migrated }),
      onRehydrateStorage: () => (state) => {
        state?.runMigration()
        useConnectionsStore.setState({ hydrated: true })
      },
    }
  )
)

// ---- selectors / helpers -------------------------------------------------

/** Every selectable model as a ref + label. */
export function listModelOptions(connections: SavedConnection[]): { ref: string; label: string; connection: SavedConnection; model: string }[] {
  const out: { ref: string; label: string; connection: SavedConnection; model: string }[] = []
  for (const c of connections) {
    if (!c.enabled) continue
    for (const m of c.models) out.push({ ref: formatModelRef({ connectionId: c.id, model: m }), label: `${c.name} · ${m}`, connection: c, model: m })
  }
  return out
}

/** Resolve a stored model string (new ref or legacy id) into a request Connection. */
export function resolveModelRef(
  stored: string | undefined | null,
  connections: SavedConnection[],
  legacyRefMap: Record<string, string>
): { connection: Connection; ref: ModelRef; label: string } | null {
  let ref = parseModelRef(stored)
  if (!ref && stored && legacyRefMap[stored]) ref = parseModelRef(legacyRefMap[stored])
  if (!ref) return null
  const saved = connections.find((c) => c.id === ref!.connectionId)
  if (!saved || !saved.enabled) return null
  return {
    ref,
    label: `${saved.name} · ${ref.model}`,
    connection: { kind: saved.kind, apiKey: saved.apiKey, baseUrl: saved.baseUrl, model: ref.model, label: saved.name },
  }
}

/** First usable model when a session has none configured. */
export function defaultModelRef(connections: SavedConnection[]): string | undefined {
  const c = connections.find((x) => x.enabled && x.models.length)
  if (!c) return undefined
  return formatModelRef({ connectionId: c.id, model: c.defaultModel && c.models.includes(c.defaultModel) ? c.defaultModel : c.models[0] })
}

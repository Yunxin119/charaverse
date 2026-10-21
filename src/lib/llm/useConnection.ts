'use client'

import { useCallback, useEffect, useMemo } from 'react'
import { useConnectionsStore, listModelOptions, resolveModelRef, defaultModelRef } from '@/stores/connections'
import { type Connection, encodeConnection, CONNECTION_HEADER } from './connection'

/**
 * Model selection for the chat: options come from the saved connections store;
 * `resolve(stored)` accepts new `<connId>/<model>` refs and legacy model ids.
 */
export function useConnection() {
  const connections = useConnectionsStore((s) => s.connections)
  const legacyRefMap = useConnectionsStore((s) => s.legacyRefMap)
  const hydrated = useConnectionsStore((s) => s.hydrated)
  const runMigration = useConnectionsStore((s) => s.runMigration)

  useEffect(() => { if (hydrated) runMigration() }, [hydrated, runMigration])

  const options = useMemo(() => listModelOptions(connections), [connections])
  const availableModels = useMemo(() => options.map((o) => o.ref), [options])

  const resolve = useCallback(
    (stored: string | undefined | null): Connection | null => resolveModelRef(stored, connections, legacyRefMap)?.connection ?? null,
    [connections, legacyRefMap]
  )
  const displayName = useCallback(
    (stored: string | undefined | null): string => resolveModelRef(stored, connections, legacyRefMap)?.label ?? (stored ?? '未选择模型'),
    [connections, legacyRefMap]
  )
  const headersFor = useCallback(
    (stored: string | undefined | null): Record<string, string> | null => {
      const c = resolve(stored)
      return c ? { [CONNECTION_HEADER]: encodeConnection(c) } : null
    },
    [resolve]
  )
  const hasAnyApiConfig = useCallback(() => options.length > 0, [options.length])

  return {
    hydrated,
    options,
    availableModels,
    defaultModel: defaultModelRef(connections),
    hasAnyApiConfig,
    displayName,
    resolve,
    headersFor,
  }
}

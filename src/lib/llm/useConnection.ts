'use client'

import { useCallback } from 'react'
import { useApiConfig } from '@/app/lib/useApiConfig'
import { type Connection, encodeConnection, CONNECTION_HEADER } from './connection'

/**
 * Adapter from the legacy model-id based config (useApiConfig / localStorage) to a
 * Connection header. Replaced by the unified connections store in P4.
 */
export function inferKind(modelId: string, baseUrl?: string): Connection['kind'] {
  if (modelId.startsWith('named-relay-') || baseUrl) return 'openai-compatible'
  if (modelId.startsWith('gemini')) return 'google'
  if (modelId.startsWith('deepseek')) return 'deepseek'
  if (modelId.startsWith('claude')) return 'anthropic'
  return 'openai'
}

export function useConnection() {
  const api = useApiConfig()

  const resolve = useCallback(
    (modelId: string | undefined): Connection | null => {
      if (!modelId) return null
      try {
        const cfg = api.getModelConfig(modelId)
        if (!cfg.apiKey) return null
        const kind = inferKind(modelId, cfg.baseUrl)
        return {
          kind,
          apiKey: cfg.apiKey,
          baseUrl: kind === 'openai-compatible' ? cfg.baseUrl : undefined,
          model: kind === 'openai-compatible' ? cfg.modelName || modelId : modelId,
          label: api.getModelDisplayName(modelId),
        }
      } catch {
        return null
      }
    },
    [api]
  )

  const headersFor = useCallback(
    (modelId: string | undefined): Record<string, string> | null => {
      const c = resolve(modelId)
      return c ? { [CONNECTION_HEADER]: encodeConnection(c) } : null
    },
    [resolve]
  )

  return {
    availableModels: api.availableModels,
    hasAnyApiConfig: api.hasAnyApiConfig,
    displayName: api.getModelDisplayName,
    resolve,
    headersFor,
  }
}

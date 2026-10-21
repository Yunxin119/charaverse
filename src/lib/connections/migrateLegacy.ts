import type { SavedConnection } from './types'

/**
 * One-shot migration of the three old localStorage formats into SavedConnection[]:
 *   api_pool_config   { pools: { deepseek|gemini|openai|custom: ApiConfig[] } }
 *   named_relay_configs [ { id, name, baseUrl, apiKey, modelName } ]
 *   api_key_<provider>  plain strings
 * Returns the connections plus a map from legacy model ids to new model refs so
 * existing `chat_sessions.settings.model` values keep resolving.
 */
export interface LegacyMigration {
  connections: SavedConnection[]
  /** legacy model id (e.g. 'gemini-2.5-flash', 'named-relay-abc') → `<connId>/<model>` */
  refMap: Record<string, string>
}

const PROVIDER_KIND: Record<string, SavedConnection['kind']> = { deepseek: 'deepseek', gemini: 'google', openai: 'openai' }
const PROVIDER_MODELS: Record<string, string[]> = {
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3-pro-preview'],
  openai: ['gpt-4o', 'gpt-4o-mini'],
}

function read(key: string): unknown {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : null
  } catch {
    return null
  }
}

export function migrateLegacyConnections(): LegacyMigration {
  const connections: SavedConnection[] = []
  const refMap: Record<string, string> = {}
  if (typeof localStorage === 'undefined') return { connections, refMap }
  const now = Date.now()

  // 1) named relays
  const relays = read('named_relay_configs')
  if (Array.isArray(relays)) {
    for (const r of relays as Array<Record<string, unknown>>) {
      if (typeof r?.id !== 'string' || typeof r.apiKey !== 'string' || typeof r.baseUrl !== 'string' || !r.apiKey) continue
      const model = typeof r.modelName === 'string' && r.modelName ? r.modelName : 'gpt-4o'
      const id = `relay-${r.id}`
      connections.push({
        id, name: typeof r.name === 'string' && r.name ? r.name : '中转', kind: 'openai-compatible',
        apiKey: r.apiKey, baseUrl: r.baseUrl, models: [model], defaultModel: model, enabled: true, createdAt: now,
      })
      refMap[`named-relay-${r.id}`] = `${id}/${model}`
    }
  }

  // 2) api pool (first active key per provider wins; others become extra connections)
  const pool = read('api_pool_config') as { pools?: Record<string, Array<Record<string, unknown>>> } | null
  const seenProvider = new Set<string>()
  for (const [provider, apis] of Object.entries(pool?.pools ?? {})) {
    if (!Array.isArray(apis)) continue
    for (const api of apis) {
      if (typeof api?.apiKey !== 'string' || !api.apiKey) continue
      const isCustom = provider === 'custom' || typeof api.baseUrl === 'string'
      const kind: SavedConnection['kind'] = isCustom ? 'openai-compatible' : (PROVIDER_KIND[provider] ?? 'openai')
      if (isCustom && typeof api.baseUrl !== 'string') continue
      const models = isCustom ? [typeof api.model === 'string' && api.model ? api.model : 'gpt-4o'] : PROVIDER_MODELS[provider] ?? ['gpt-4o']
      const id = `pool-${provider}-${typeof api.id === 'string' ? api.id : connections.length}`
      connections.push({
        id, name: typeof api.name === 'string' && api.name ? api.name : `${provider}`, kind,
        apiKey: api.apiKey, baseUrl: isCustom ? (api.baseUrl as string) : undefined,
        models, defaultModel: models[0], enabled: api.isActive !== false, createdAt: now,
      })
      if (!isCustom && !seenProvider.has(provider) && api.isActive !== false) {
        seenProvider.add(provider)
        for (const m of models) refMap[m] = `${id}/${m}`
      }
    }
  }

  // 3) plain legacy keys (only if that provider has no pool entry)
  for (const provider of ['deepseek', 'gemini', 'openai']) {
    if (seenProvider.has(provider)) continue
    const key = localStorage.getItem(`api_key_${provider}`)
    if (!key) continue
    const models = PROVIDER_MODELS[provider]
    const id = `legacy-${provider}`
    connections.push({ id, name: provider, kind: PROVIDER_KIND[provider], apiKey: key, models, defaultModel: models[0], enabled: true, createdAt: now })
    for (const m of models) refMap[m] = `${id}/${m}`
    seenProvider.add(provider)
  }

  return { connections, refMap }
}

export const LEGACY_KEYS = ['api_pool_config', 'named_relay_configs', 'api_key_deepseek', 'api_key_gemini', 'api_key_openai', 'api_config_backup', 'relay_base_url', 'relay_api_key', 'relay_model_name']

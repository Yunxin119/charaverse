import { z } from 'zod'

/** `chat_sessions.settings` — everything per-session that used to live in localStorage. */
export const sessionSettingsSchema = z.object({
  /** legacy model id resolved client-side by useApiConfig (e.g. 'gemini-2.5-flash', 'named-relay-<id>') */
  model: z.string().max(128).optional(),
  /** user_presets.id, null = user default / builtin */
  presetId: z.string().uuid().nullable().optional(),
  context: z
    .object({
      maxTokens: z.number().int().min(1000).max(200000).default(8000),
      keepRecent: z.number().int().min(2).max(200).default(20),
      useSummaries: z.boolean().default(true),
      useMemory: z.boolean().default(true),
      /** auto-run the summary + memory extraction when this many messages are unsummarized (0 = off) */
      autoSummaryEvery: z.number().int().min(0).max(500).default(40),
    })
    .prefault({}),
  background: z
    .object({
      url: z.string().max(1024).optional(),
      opacity: z.number().min(0).max(1).default(0.85),
      blur: z.number().min(0).max(40).default(0),
    })
    .prefault({}),
  /** override the persona name used for {{user}} */
  userName: z.string().max(60).optional(),
})
export type SessionSettings = z.infer<typeof sessionSettingsSchema>

export function parseSessionSettings(raw: unknown): SessionSettings {
  const r = sessionSettingsSchema.safeParse(raw ?? {})
  return r.success ? r.data : sessionSettingsSchema.parse({})
}

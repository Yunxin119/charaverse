import { z } from 'zod'

/** `chat_sessions.settings` — everything per-session that used to live in localStorage. */
export const sessionSettingsSchema = z.object({
  /** model ref `<connectionId>/<model>` (legacy ids like 'gemini-2.5-flash' / 'named-relay-<id>' still resolve) */
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
      /** no custom image → fall back to the character's avatar as the backdrop */
      useAvatar: z.boolean().default(true),
    })
    .prefault({}),
  /** 'flow' = classic message list; 'novel' = full-bleed character image + bottom dialogue box */
  layout: z.enum(['flow', 'novel']).default('flow'),
  /** override the persona name used for {{user}} */
  userName: z.string().max(60).optional(),
  /** per-session sampling overrides; undefined = follow the preset */
  sampling: z
    .object({
      temperature: z.number().min(0).max(2).optional(),
      top_p: z.number().min(0).max(1).optional(),
      max_tokens: z.number().int().min(64).max(65536).optional(),
    })
    .prefault({}),
  /** show tokens as they arrive (off = wait for the whole reply) */
  streaming: z.boolean().default(true),
})
export type SessionSettings = z.infer<typeof sessionSettingsSchema>

export function parseSessionSettings(raw: unknown): SessionSettings {
  const r = sessionSettingsSchema.safeParse(raw ?? {})
  return r.success ? r.data : sessionSettingsSchema.parse({})
}

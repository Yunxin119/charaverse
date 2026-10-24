import { z } from 'zod'
import { regexScriptSchema } from './regexScripts'

/**
 * `characters.skin` — everything an author can do to the chat's look (plan §5.5).
 *   css           : scoped + sanitized before injection (sanitizeCss)
 *   regexScripts  : regex-script display rewrites (regexScripts.ts)
 *   renderHtml    : raw HTML blocks in AI replies render inside the sandboxed iframe (on by default; authors can opt out)
 *   allowedUrlHosts : extra https hosts the css may load images/fonts from
 */
export const skinSchema = z.object({
  version: z.literal(1).default(1),
  css: z.string().max(100_000).default(''),
  regexScripts: z.array(regexScriptSchema).max(100).default([]),
  renderHtml: z.boolean().default(true),
  allowedUrlHosts: z.array(z.string().max(253)).max(20).default([]),
})
export type Skin = z.infer<typeof skinSchema>

export const EMPTY_SKIN: Skin = skinSchema.parse({})

export function parseSkin(raw: unknown): Skin {
  const r = skinSchema.safeParse(raw ?? {})
  return r.success ? r.data : EMPTY_SKIN
}

export function skinIsEmpty(s: Skin): boolean {
  return !s.css.trim() && s.regexScripts.length === 0 && s.renderHtml && s.allowedUrlHosts.length === 0
}

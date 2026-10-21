# CharaVerse

AI character role-play chat app. Next.js 16 (App Router) + Supabase (auth, Postgres with RLS, storage) + Tailwind v4 + shadcn/Radix. Users bring their own LLM API keys (BYOK); keys live only in the browser and are forwarded per request to our `/api/*` proxy routes.

## Start here
- **`docs/REFACTOR_PLAN.md`** is the source of truth for the v2 refactor: phase tracker, architecture decisions (A1–A16), design system, security checklist. Read it first, work the next unchecked item of the current phase, and tick boxes / update the status table as work lands.
- Design tokens preview: `docs/design/tokens-preview.html`. Palette: ink `#33251b`, mist `#adbcc3`, oxblood `#41140e`, cream `#f2dece`, accent sienna `#c9643b`. Style: liquid glass + neumorphism + flat poster accents. All colors go through `--cv-*` tokens; never hard-code `slate-*`.
- The theming pipeline (CSS sanitizer + HTML block splitter) is exercised end-to-end by `src/lib/skins/__tests__/samples.test.ts`, which embeds an original sample card; author cards from third parties must not be checked in. The pre-v2 code, SQL and design notes live at git tag `v1-archive`.

## Conventions
- Auth: cookie sessions via `@supabase/ssr`. Pages are guarded by `src/proxy.ts` (Next 16 proxy; it must live under `src/`). Client components read the user with `useAuth()` from `src/providers/AuthProvider.tsx`. Every `/api/*` route starts with `requireUser(request)` from `src/lib/server/auth.ts`; client calls use `authedFetch` from `src/lib/authedFetch.ts`.
- UI: tokens in `src/styles/tokens.css`, Tailwind mapping in `src/app/globals.css` (`bg-cv-*`, `glass`, `neu`, `rounded-cv-*`, `shadow-neu`, `font-display`). Surfaces come from `src/components/glass`; shadcn atoms in `src/components/ui` are already restyled onto the tokens. The frame is `src/components/shell/AppShell`.
- Data: server state through TanStack Query hooks in `src/queries/`; UI state in Zustand stores (`src/stores/`, from P2). The remaining Redux `chatSlice` is legacy and goes away with the chat rewrite.
- Any user-supplied LLM `baseUrl` goes through `assertSafeBaseUrl` (`src/lib/server/llmGuards.ts`). Upstream error bodies are summarized, never echoed.
- Never log API keys, auth headers, prompts, or message content, on the server or in the browser. Use `log` from `src/lib/log.ts` (warn/error only in production).
- Every LLM-calling route also calls `enforceRateLimit(supabase, user.id, RATE_LIMITS.<bucket>)` from `src/lib/server/rateLimit.ts` (DB-backed via `consume_rate_limit`, in-memory fallback).
- Security headers / CSP live in `next.config.ts`; author HTML runs in `HtmlBlockFrame` (sandboxed srcdoc iframe) which inherits that CSP plus its own stricter meta CSP.
- User-facing feedback: `toast` from `sonner` (mounted in the layout as `AppToaster`), not `alert()`.
- Author-supplied CSS is sanitized with a real parser and scoped to `#cv_chat_root`; author HTML/JS only ever renders inside a sandboxed iframe.
- Schema changes go in `supabase/migrations/` (P1+). One-off fixes for the live DB live in `supabase/hotfix/` and are applied by hand in the Supabase SQL editor.
- Decisions already made (do not re-open): no mobile app / PWA / IM-style phone chat, no multi-character "script" mode, no sticker system, Redux is being removed in favor of Zustand + TanStack Query, LLM calls move to the Vercel AI SDK with streaming.

## Commands
```bash
npm run dev        # next dev (turbopack)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint .
npm run build
```
Before finishing any phase: typecheck, build, and `npm audit --omit=dev` must have no critical.

**Never run `next build` while `next dev` is running.** Both rewrite `next-env.d.ts` (dev points it at `.next/dev/types`, build at `.next/types`); with both alive the file flips on every request, Turbopack recompiles, and the browser full-reloads in a loop (looks like a flickering page). Stop the dev preview first, then build; if the loop already started, stop everything, `rm -rf .next`, and start dev again.

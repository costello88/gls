# Postcraft Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Postcraft — the Instagram content production & posting machine described in `docs/specs/2026-08-06-postcraft-design.md` — as a deployable Next.js 15 + Supabase + Vercel app.

**Architecture:** App Router monolith. All Instagram/AI calls happen in server routes; the browser only talks to our API. Postgres (Supabase) is the source of truth; a minutely cron sweep advances a resumable publish state machine. Feature UIs are thin clients over typed `lib/` modules.

**Tech Stack:** Next.js 15 · React 19 · TypeScript strict · Tailwind v4 · @supabase/ssr · sharp · zod · date-fns · lucide-react · vitest (lib tests only).

## Global Constraints

- TypeScript `strict: true`; `next build` must pass with zero errors — this is the master gate.
- All secrets server-side only; Meta tokens AES-256-GCM encrypted via `TOKEN_ENCRYPTION_KEY` (32-byte hex).
- Every AI provider optional: missing key ⇒ provider silently absent, template engine always available.
- No unofficial Instagram APIs. No automated follow/like/comment actions.
- Design language per spec §7 (ink canvas `#0A0A0C`, accent `#FF4D1C`, Fraunces display / Inter text, hairline borders `white/8`).
- All tables RLS `auth.uid() = user_id`.
- Node runtime (not edge) for routes using sharp/crypto.

---

### Task 1: Scaffold + design system + app shell
**Files:** `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `app/globals.css`, `app/layout.tsx`, `app/(dashboard)/layout.tsx` (sidebar nav), `components/ui/*` (Button, Card, Input, Textarea, Select, Badge, Tabs, Modal, Stepper, EmptyState, StatCard, Toggle, Spinner), `lib/utils.ts` (`cn`).
**Produces:** design tokens as Tailwind theme vars (`--color-ink`, `--color-paper`, `--color-accent`, `--color-lime`); `cn(...classes)`; UI components with props documented in-file.
- [ ] Write configs; `npm install`; `next build` passes on empty shell.
- [ ] Global CSS with @theme tokens + fonts (next/font: Fraunces, Inter).
- [ ] Sidebar shell with nav: Dashboard, Create, Calendar, Campaigns, Giveaways, Outreach, Library, Analytics, Accounts, Settings.
- [ ] Commit.

### Task 2: Supabase foundation
**Files:** `supabase/migrations/0001_init.sql` (full schema per spec §4 + RLS + storage buckets), `lib/supabase/server.ts` (`createClient()` cookie-based; `createServiceClient()`), `lib/supabase/client.ts`, `lib/supabase/middleware.ts`, root `middleware.ts` (auth gate → `/login`), `app/(auth)/login/page.tsx`, `app/auth/callback/route.ts`, `lib/types.ts` (all domain types).
**Produces:** `Database` domain types: `IgAccount`, `Asset`, `Design`, `Post`, `PostSurface = 'feed'|'reel'|'story'|'carousel'`, `PostStatus = 'draft'|'scheduled'|'publishing'|'published'|'failed'`, `Campaign`, `CampaignDay`, `Giveaway`, `GiveawayRequirements`, `GiveawayEntry`, `OutreachTarget`, `OutreachStatus = 'queued'|'followed'|'skipped'|'followed_back'|'unfollowed'`.
- [ ] SQL migration incl. `handle_new_user` trigger, indexes on `(user_id, status, scheduled_at)`.
- [ ] Auth pages (magic link + password), middleware redirect.
- [ ] Commit.

### Task 3: Crypto + pure logic (TDD with vitest)
**Files:** `lib/crypto.ts`, `lib/outreach/parse.ts`, `lib/giveaways/verify.ts`, `lib/giveaways/draw.ts`, `lib/schedule.ts`, `tests/*.test.ts`.
**Interfaces (Produces):**
- `encryptToken(plain: string): string` / `decryptToken(enc: string): string` — AES-256-GCM, format `iv.tag.cipher` base64url.
- `parseTargets(raw: string): string[]` — extracts IG usernames from any mix of URLs (`instagram.com/{u}`, with query/trailing segments like `/reel/...` ignored), `@handles`, bare words matching `/^[a-zA-Z0-9._]{1,30}$/`; lowercases; dedupes; drops reserved paths (`p`, `reel`, `reels`, `stories`, `explore`, `tv`, `accounts`).
- `checkEntry(text: string, req: GiveawayRequirements): { mentionCount: number; hasKeyword: boolean; hasHashtag: boolean; eligible: boolean }`.
- `drawWinners(entries: {id:string; username:string}[], count: number, seed: string): {id:string; username:string}[]` — dedupe by username, deterministic shuffle via SHA-256(seed+i), returns first `count`.
- `nextBestSlots(heat: number[][] | null, days: number): Date[]` — fallback 11:00/18:00 alternation when no heatmap.
- [ ] Failing tests → implement → green (`npx vitest run`). Commit.

### Task 4: Meta/Instagram API client
**Files:** `lib/meta/client.ts`, `lib/meta/publish.ts`, `lib/meta/insights.ts`, `lib/meta/oauth.ts`.
**Interfaces (Produces):** graph host `https://graph.facebook.com/v23.0`;
- `oauth.getLoginUrl(state)`, `oauth.exchangeCode(code)`, `oauth.toLongLived(token)`, `oauth.refreshLongLived(token)`, `oauth.discoverIgAccounts(token): Promise<DiscoveredAccount[]>` (via `/me/accounts?fields=instagram_business_account{...}`).
- `publish.createContainer(igId, token, params: ContainerParams): Promise<string>`; `publish.containerStatus(igId? no — containerId, token): Promise<'IN_PROGRESS'|'FINISHED'|'ERROR'|'EXPIRED'>`; `publish.publishContainer(igId, token, containerId): Promise<string /* ig_media_id */>`; `publish.publishingLimit(igId, token): Promise<{used:number; quota:number}>`; `publish.postComment(mediaId, token, text)`.
- `insights.accountInsights`, `insights.onlineFollowers`, `insights.mediaComments(mediaId, token, after?)` (paginated), `insights.businessDiscovery(igId, token, username)`.
- `ContainerParams = { surface: PostSurface; imageUrl?; videoUrl?; caption?; children?: string[]; shareToFeed?: boolean; coverUrl? }` mapping: feed→`image_url`+`caption`; reel→`media_type=REELS`+`video_url`; story→`media_type=STORIES`+(`image_url`|`video_url`); carousel child→`is_carousel_item=true`; carousel parent→`media_type=CAROUSEL`+`children`.
- All calls through one `graph(path, token, {method, params})` helper with typed `MetaApiError` (fbtrace_id, code, message).
- [ ] Implement; unit-test param mapping (no network). Commit.

### Task 5: Design engine
**Files:** `lib/design/templates.ts` (8 SVG template builders `(img: {w,h,dataUri}, brief: {headline, sub?, accent}) => string`), `lib/design/render.ts` (`renderTemplate(imgBuf, templateKey, brief, size: 'feed'|'story'): Promise<Buffer>` via sharp composite; `dominantColor(imgBuf)`), `lib/design/providers/openai.ts` (`gpt-image-1` edits), `lib/design/providers/anthropic.ts` (Claude layout JSON→SVG→raster), `lib/design/providers/higgsfield.ts`, `lib/design/index.ts` (`generateDesigns(opts): Promise<DesignVariant[]>` — template engine + available providers, `Promise.allSettled`, per-provider 60s timeout).
**Produces:** `DesignVariant = { buffer: Buffer; provider: DesignProvider; label: string; width: number; height: number }`; `DesignProvider = 'template'|'openai'|'anthropic'|'higgsfield'`.
- [ ] Implement templates with real typographic taste (spec §7). Test render with sharp-generated fixture. Commit.

### Task 6: AI copy + campaign planner
**Files:** `lib/ai/claude.ts` (`askClaudeJSON(system, user, schemaHint)` using `ANTHROPIC_API_KEY`, model `claude-sonnet-5`, fallback deterministic templates when no key), `lib/ai/captions.ts` (`generateCaptions(brief, tone, n): Promise<CaptionSet[]>` where `CaptionSet = {caption, hashtags: string[], firstComment?}`), `lib/ai/campaign.ts` (`generateCampaignPlan(input): Promise<CampaignDay[]>` — 7-day arc per spec §6.3).
- [ ] Implement with zod validation of model output + graceful fallback. Commit.

### Task 7: Core API routes
**Files:** `app/api/assets/route.ts` (POST upload→storage), `app/api/designs/generate/route.ts`, `app/api/captions/route.ts`, `app/api/posts/route.ts` (+`[id]`), `app/api/posts/publish/route.ts` (immediate), `app/api/meta/oauth/start|callback/route.ts`, `app/api/accounts/route.ts`, `lib/publish/engine.ts` (`advancePost(post, supa): Promise<void>` state machine per spec §5).
- [ ] Wire, `next build` green. Commit.

### Task 8: Cron dispatcher
**Files:** `app/api/cron/dispatch/route.ts` (Bearer CRON_SECRET; due posts → `advancePost`; token refresh <10d; active giveaway sync every 30min; insights snapshot daily), `vercel.json` (`*/1 * * * *`), `app/api/giveaways/[id]/sync/route.ts`, `draw/route.ts`.
- [ ] Commit.

### Task 9–14: Feature UIs (fan-out; each = page + components + loading/empty states, server components + client islands)
9. **Create wizard** `/create` — 6-step flow per spec §6.1.
10. **Calendar + Dashboard** `/calendar`, `/(dashboard)/page.tsx` — month/week grid, due queue, plan-my-day.
11. **Campaigns** `/campaigns`, `/campaigns/[id]` — builder + storyboard + materialize.
12. **Giveaways** `/giveaways`, `/giveaways/[id]` — create, entries table w/ checks, draw ceremony UI, export CSV, rules generator.
13. **Outreach** `/outreach` — bulk import textarea, queue table, daily session mode (deep links, F/S keys), pacing settings, compliance note.
14. **Accounts + Library + Analytics + Settings** `/accounts`, `/library`, `/analytics`, `/settings` — connect flow, token health, asset grid w/ send-to-create, heatmap + trends, env status.
- [ ] Each: build → integrate → `next build` green → commit.

### Task 15: Verification gate
- [ ] `npx tsc --noEmit`, `npx vitest run`, `next build` — all green; fix loop until clean.
- [ ] README.md (setup: Supabase, Meta app, Vercel, env vars), `.env.example`.
- [ ] Final commit + push.

## Self-review
- Spec coverage: §4→T2, §5→T7/T8, §6.1→T9, §6.2→T10, §6.3→T11+T6, §6.4→T12+T3, §6.5→T13+T3, §6.6→T7/T14, §6.7/6.8→T14, §6.9→T5, §7→T1, §8→T2/T3/T8, §10→T15. No gaps.
- Types consistent: `PostSurface/PostStatus/DesignVariant/CaptionSet/CampaignDay` defined once in T2/T5/T6, consumed by name elsewhere.

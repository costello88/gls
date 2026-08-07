# Postcraft

**The Instagram content production & posting machine.** One dashboard that takes a picture and a line of text and turns them into finished designs, writes the caption and hashtags, and publishes — feed posts, reels, stories, carousels — across any number of Instagram accounts, now or on a schedule.

Built on **Next.js 15 + Supabase + Vercel**, with the official **Instagram Platform API** only (no bots, no private APIs, nothing that risks your accounts).

## The machine

```
upload photo + text ──► 8+ design variants ──► pick one ──► AI caption + hashtags
      ──► choose accounts × surfaces (feed / reel / story / carousel)
      ──► post now, or drop it on the calendar ──► published + measured
```

## Features

- **Design engine** — one photo becomes many designs:
  - 8 hand-crafted layout templates (scrim, editorial, badge, split panel, polaroid, neon, caption bar, type stack) rendered server-side with real typography — always available, zero AI keys needed.
  - **Claude** art-directs: rewrites your headline into display copy, picks layouts, tunes palettes.
  - **OpenAI (gpt-image-1)** restyles the photo (studio / lifestyle / color-block edits, subject preserved).
  - **Replicate (FLUX Kontext)** cinematic & minimal restyles at native 4:5 / 9:16.
  - **Higgsfield (Soul)** premium looks, when you have Cloud API access.
- **AI copywriter** — hook-first captions (125-char truncation aware), specific CTAs, 3–5 hashtags (Instagram's current cap), optional value-add first comment, five tones.
- **Publishing engine** — official container flow with quota checks, container polling across cron ticks, automatic retries, permalinks, first-comment posting. Multi-account, multi-surface fan-out from one review screen.
- **Calendar** — month/week planner; drag-free rescheduling via post modal; day-by-day pipeline.
- **Campaigns** — describe a goal; Claude plans a 7-day arc (teaser → launch → social proof → BTS → giveaway → urgency → recap) with per-day visuals, captions, and best times; one click materializes it into scheduled drafts.
- **Giveaways** — requirements builder (comment keyword, #hashtag, tag-N-friends — machine-verified from synced comments; follow/like stay honor-system because Instagram's API exposes no follower/liker lists), entry sync, eligibility table, **provably fair winner draw** with a published verification seed, CSV export, auto-generated Instagram-compliant rules text.
- **Outreach** — the marketing-niche pipeline: paste any pile of Instagram links/handles; Postcraft parses, dedupes, enriches (followers/bio via Business Discovery), and serves a daily follow session at a safe pace with one-tap profile deep links and keyboard-driven tracking (F followed / S skip). Follow-back tracking + conversion stats. *Compliant by design: Instagram has no follow API — automation tools get accounts banned. Postcraft queues, paces, and tracks; you tap Follow.*
- **Analytics** — follower trends, top posts by reach/saves/shares, and a 7×24 **best-time heatmap** built from your audience's online hours.
- **Token care** — Instagram tokens AES-256-GCM encrypted at rest, auto-refreshed before their 60-day expiry.

## Setup

### 1. Supabase (database + auth + storage)

1. Create a project at [supabase.com](https://supabase.com).
2. SQL Editor → paste and run `supabase/migrations/0001_init.sql` (tables, RLS, the public `media` bucket).
3. Authentication → Providers → enable **Email** (password + magic link).
4. Copy Project URL, anon key, and service-role key into your env.

### 2. Meta app (Instagram publishing)

1. [developers.facebook.com](https://developers.facebook.com) → **Create app** → type **Business**.
2. Add the **Instagram** product → **API setup with Instagram login** (no Facebook Page needed).
3. Business login settings → add the OAuth redirect URI:
   `https://YOUR-DOMAIN/api/meta/oauth/callback`
4. Copy the **Instagram app ID** and **app secret** into `META_APP_ID` / `META_APP_SECRET`.
5. Your Instagram account must be **professional** (Business or Creator — free switch in the app).
6. While the Meta app is in **Standard Access** you can connect accounts you own/manage (add them as Instagram Testers). To serve other people's accounts later, complete Business Verification + App Review for `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_comments`, `instagram_business_manage_insights`.

### 3. Vercel

1. Import the repo on [vercel.com](https://vercel.com) (framework auto-detects Next.js).
2. Add every environment variable from `.env.example`.
3. `vercel.json` already schedules the dispatcher (`/api/cron/dispatch`, every minute). Per-minute cron needs the **Pro** plan — on Hobby it fires daily, so scheduled posts publish up to a day late. Vercel automatically sends `Authorization: Bearer $CRON_SECRET`.

### 4. Local dev

```bash
cp .env.example .env.local   # fill it in
npm install
npm run dev                  # http://localhost:3000
npm test                     # logic tests
npx tsx scripts/smoke-design.ts   # renders all templates to /tmp/design-smoke
```

## Environment variables

| Variable | Required | What |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service-role key (server-only; cron uses it) |
| `NEXT_PUBLIC_APP_URL` | ✅ | Deployed URL, no trailing slash |
| `META_APP_ID` | ✅ | Meta app → Instagram app ID |
| `META_APP_SECRET` | ✅ | Meta app → Instagram app secret |
| `TOKEN_ENCRYPTION_KEY` | ✅ | `openssl rand -hex 32` — encrypts IG tokens at rest |
| `CRON_SECRET` | ✅ | `openssl rand -hex 24` — guards the cron endpoint |
| `ANTHROPIC_API_KEY` | optional | Claude captions, campaign plans, art direction |
| `OPENAI_API_KEY` | optional | gpt-image-1 photo restyling |
| `REPLICATE_API_TOKEN` | optional | FLUX Kontext restyling |
| `HIGGSFIELD_API_KEY` / `HIGGSFIELD_API_SECRET` | optional | Higgsfield Soul (gated Cloud API) |
| `META_GRAPH_VERSION`, `ANTHROPIC_MODEL`, `OPENAI_IMAGE_MODEL`, `OPENAI_IMAGE_QUALITY`, `REPLICATE_IMAGE_MODEL`, `HIGGSFIELD_API_BASE` | optional | Overrides |

With zero AI keys the machine still runs end-to-end: template designs + fallback captions + full publishing.

## Platform truths the product is built around

- The Instagram API **cannot schedule** — Postcraft's cron sweep publishes due posts every minute.
- Media must live at a **public URL** (the Supabase `media` bucket) and images must be **JPEG**.
- ~100 API posts per account per rolling 24h; Postcraft checks the quota before publishing.
- Stories via API can't carry link/poll stickers; reels accept uploaded video (3s–15min, ≤300MB).
- **No follower or liker lists** exist in the API → giveaway follow/like rules are honor-system, comments are machine-verified.
- **No follow endpoint** exists → outreach is a paced manual-assist CRM, which is the only durable, ban-safe way.

## Architecture

```
app/(dashboard)/…        UI: create wizard, calendar, campaigns, giveaways,
                         outreach, library, analytics, accounts, settings
app/api/…                Route handlers (auth via Supabase, zod-validated)
app/api/cron/dispatch    Minutely sweep: due posts → publish state machine,
                         token refresh, giveaway sync, insights snapshots
lib/meta/…               Instagram Platform API client (login, publish, insights)
lib/design/…             Template engine (satori + resvg + sharp) + AI providers
lib/ai/…                 Claude copywriter + campaign planner (+ fallbacks)
lib/publish/engine.ts    Resumable container → poll → publish state machine
supabase/migrations/     Schema, RLS, storage bucket
```

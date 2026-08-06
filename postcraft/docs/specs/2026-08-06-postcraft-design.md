# Postcraft — Design Spec
_2026-08-06 · Instagram content production & posting machine_

## 1. What it is

Postcraft is a self-hosted (Vercel + Supabase) Instagram operations studio for one team running many Instagram accounts. It covers the full loop:

**data → design → copy → destination → publish/schedule → measure → grow.**

The core workflow (the "machine"):

1. **Upload** a picture + a short text brief.
2. **Generate designs** — the picture becomes multiple Instagram-ready design variants (local template engine + AI image providers).
3. **Pick one** (or several).
4. **Caption autofill** — AI writes the caption, hook, CTA and hashtags; user can regenerate/edit.
5. **Choose destinations** — any connected account × any surface (feed post, reel, story) — multiple at once.
6. **Now or scheduled** — publish immediately or drop it on the calendar.

Around the core: a day-by-day content calendar, an AI week-long campaign planner, a giveaway engine with requirement verification + winner drawing, an outreach pipeline for bulk-imported Instagram accounts, an asset library, and an insights dashboard.

## 2. Constraints that shaped the design (research-backed)

- **Instagram publishing** is only possible via the official Instagram Platform API for **professional (Business/Creator) accounts**. Flow: create a media container (`POST /{ig-id}/media` with `image_url`/`video_url`, `media_type=REELS|STORIES`, `caption`), poll container `status_code` until `FINISHED`, then `POST /{ig-id}/media_publish`. Media must be at a **public URL** → Supabase Storage public bucket.
- **~100 API-published posts per rolling 24h per account**; check `content_publishing_limit`. Carousels ≤ 10 items. Stories via API support media but not interactive stickers/links.
- **The API cannot schedule** — scheduling is ours: a due-post sweep from Vercel Cron every minute.
- **The API cannot follow accounts** and cannot list an account's followers. Any tool that auto-follows uses Instagram's private API or browser automation — a ToS violation that gets accounts action-blocked or banned. → Outreach is designed as a **compliant assisted pipeline** (see §6.6), not a bot.
- Giveaway verification: comments are readable via API (`GET /{media-id}/comments`), so *comment-based* requirements (keyword, @-mention count) are machine-verifiable; *follow* requirements are honor-system/manual because the API can't check them.
- **Tokens**: Meta long-lived tokens last ~60 days → automatic refresh job + AES-GCM encryption at rest.
- **Claude does not generate raster images**; it designs **layouts** (structured JSON → SVG) which we rasterize server-side. OpenAI `gpt-image-1` edits images from a prompt. Higgsfield generates premium imagery. All three are optional providers behind one interface; a deterministic local template engine guarantees variants with zero keys.

## 3. Stack

- **Next.js 15** (App Router, TypeScript strict, React 19) on **Vercel**.
- **Supabase**: Auth (email magic link + password), Postgres (RLS multi-tenant), Storage (public `media` bucket for publishable renders, `uploads` for originals).
- **Tailwind CSS v4** with a bespoke design system (no component library).
- **sharp** for the local design template engine (SVG overlay compositing, format/size normalization).
- **AI providers** (all optional, env-key gated): Anthropic Claude (captions, campaign plans, layout designs, hashtag strategy), OpenAI gpt-image-1 (image restyling/edits), Higgsfield (hero image generation).
- **Vercel Cron** → `/api/cron/dispatch` (minutely sweep), guarded by `CRON_SECRET`.

## 4. Data model (Supabase, all tables RLS-scoped by `user_id`)

- `ig_accounts` — connected Instagram professional accounts: `ig_user_id`, `username`, `access_token_enc`, `token_expires_at`, `status`, cached `followers_count`, `profile_picture_url`.
- `assets` — uploaded originals (storage path, dimensions, kind image/video).
- `designs` — generated variants: `asset_id`, `provider` (template|openai|anthropic|higgsfield), `template_key`, `storage_path`, `width/height`, `brief`, `selected`.
- `posts` — the central unit: `account_id`, `surface` (`feed`|`reel`|`story`|`carousel`), `design_ids[]`/`media_urls`, `caption`, `hashtags[]`, `first_comment`, `status` (`draft`→`scheduled`→`publishing`→`published` | `failed`), `scheduled_at`, `published_at`, `ig_container_id`, `ig_media_id`, `error`, `campaign_id?`, `publish_attempts`.
- `campaigns` — `name`, `goal`, `brief`, `start_date`, `days` (7 default), `status`, `plan` JSONB (per-day: theme, surface, design direction, caption draft, best time).
- `giveaways` — `post_id`, `title`, `prize`, `starts_at`, `ends_at`, `winner_count`, `requirements` JSONB (`must_follow`, `must_like`, `mention_count`, `keyword`, `hashtag`), `status`, `draw_seed`.
- `giveaway_entries` — synced comments: `username`, `ig_comment_id`, `text`, `mention_count`, `checks` JSONB, `eligible`.
- `giveaway_winners` — drawn winners with `drawn_at`, `draw_index`, `notified`.
- `outreach_targets` — `username`, `source_url`, `status` (`queued`|`followed`|`skipped`|`followed_back`|`unfollowed`), `assigned_account_id?`, discovery data (followers/media via Business Discovery), timestamps, `notes`.
- `outreach_settings` — daily pace target, active hours.
- `account_insights` / `post_metrics` — snapshots for the analytics dashboard and best-time model.
- `activity_log` — publish/draw/sync audit trail.

## 5. Publishing engine

State machine per post, resumable across cron ticks (fits Vercel time limits):

```
scheduled --(due)--> publishing.create_container --> publishing.wait_container
     --> publishing.publish --> published
     any step --(error)--> failed (with error text, retry button, ≤3 auto-retries)
```

- Feed photo: JPEG at public URL, aspect within 4:5…1.91:1 (renderer guarantees).
- Reel: MP4 9:16 (`media_type=REELS`, `share_to_feed`), container polling minutes-long → handled across ticks.
- Story: `media_type=STORIES` image or video.
- Carousel: child containers → parent carousel container → publish.
- First-comment (hashtag hiding) posted via `/{media-id}/comments` after publish.
- Before publish: `content_publishing_limit` check; friendly error if at quota.

## 6. Feature areas

### 6.1 Create wizard (`/create`) — the machine
Stepper: **Upload → Designs → Copy → Destinations → Timing → Review**. Exactly the user's workflow: upload picture + text → N design variants (grid, per-provider badges; "more like this" regenerates) → selected design(s) → caption + hashtags autofilled by Claude (tone selector, 3 alternates, hashtag count slider, first-comment toggle) → destination matrix (accounts × surfaces, story auto-crops 9:16, reel requires video or design→video note) → now/schedule (best-time suggestions from insights) → review card mimicking an IG post → launch.

### 6.2 Calendar (`/calendar`)
Month + week views of `posts`; day-by-day planner ("Plan my day" → AI suggests slots + content angles); drag to reschedule; status colors; quick-create per slot.

### 6.3 Campaigns (`/campaigns`)
"New campaign" → goal, product/brief, dates, accounts → Claude generates a **7-day arc** (teaser → launch → social proof → educate → UGC/giveaway → urgency → recap), each day with theme, surface, design direction, caption draft, time. One click **materializes** the plan into scheduled draft posts linked to the campaign; campaign detail shows the week as a storyboard with per-day status.

### 6.4 Giveaways (`/giveaways`)
Create from any published post: prize, window, winner count, requirements (follow ✻honor-system, like ✻honor-system, comment keyword, mention ≥ N friends, hashtag). **Sync** pulls comments → entries with automatic checks (keyword/hashtag/mention-count parsed from text; a comment = an entry). **Draw** uses a cryptographic seed (stored, reproducible) to pick winners from eligible entries; shows winners with profile links, supports re-draw (disqualify) and export (CSV). Auto-generates the compliant rules blurb ("not sponsored, endorsed or administered by Instagram…").

### 6.5 Outreach (`/outreach`) — marketing-niche pipeline
Paste **any number of Instagram links/handles** (profile URLs, @handles, mixed text) → parser extracts + dedupes usernames → queue. For each target, optional **enrichment** via Business Discovery (followers, media count, bio) to prioritize. A **daily session** view serves today's batch at a safe pace (default 30/day, configurable with warnings): each card deep-links to the profile (`instagram.com/{username}`) for a one-tap follow in the app, then marked `followed` (keyboard-driven: F follow, S skip). Tracks follow-backs (manual toggle or reconciliation hints), conversion stats, per-account assignment. **Explicitly no auto-follow bot** — the UI says why (ban risk, ToS) and the pacing guard is the product's value: it's a follow CRM.

### 6.6 Accounts (`/accounts`)
Meta OAuth connect (Facebook Login for Business → select IG professional account), token health (days left, auto-refresh), publishing quota used, per-account insights snapshot.

### 6.7 Library (`/library`)
All uploads and generated designs; filter by provider/campaign; re-use any design in a new post ("Send to Create").

### 6.8 Analytics (`/analytics`)
Follower trend, reach, top posts by saves/shares, **best-time heatmap** from `online_followers`, per-campaign rollups. Feeds the scheduler's suggested times.

### 6.9 Design engine (`lib/design`)
- **Template engine (always on):** 8 hand-designed SVG overlay templates (typographic poster, gradient scrim + headline, badge/price sticker, split panel, polaroid, dark editorial, neon accent, minimal caption bar) composited over the upload with sharp at 1080×1350 and 1080×1920. Brand color extracted from the image (dominant color) to tint accents.
- **OpenAI provider:** `images.edit` with the upload + style prompt → restyled variants.
- **Anthropic provider:** Claude returns a structured layout JSON (safe subset) → rendered to SVG → rasterized. Typography-driven designs.
- **Higgsfield provider:** text+image → stylized hero shots (when key present).
All providers return `DesignVariant { storage_path, provider, label }` and are raced with per-provider timeouts; failures degrade gracefully to whatever succeeded.

## 7. Frontend design language ("taste")

Dark editorial studio: near-black ink canvas (`#0A0A0C`), warm off-white type, one electric accent (signal orange `#FF4D1C`) + support lime for success states; hairline `1px` borders (`white/8%`), generous spacing, uppercase micro-labels with tracked-out type, tabular numerals for stats. Display face: `"Fraunces"` (serif, for numbers/headers via next/font); text face `"Inter"`. Surfaces feel like a print studio, not a SaaS template: asymmetric page headers, big stat typography, subtle grain on empty states. Every list has a real empty state with a next action. Motion: 150ms ease-out only.

## 8. Security & compliance

- RLS everywhere; service-role key server-only. Meta tokens AES-256-GCM encrypted (`TOKEN_ENCRYPTION_KEY`), decrypted only in server routes.
- Cron endpoint requires `Authorization: Bearer ${CRON_SECRET}`.
- No scraping, no private API, no automated follows/likes/comments. Giveaway copy includes the Instagram release. Outreach pacing defaults conservative.

## 9. Non-goals (v1)

TikTok/YouTube (architecture keeps `surface` open), DM automation, link-in-bio pages, team roles/approvals (single-user), video *generation* (reels accept uploaded video; design engine emits stills).

## 10. Environment variables

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `META_APP_ID`, `META_APP_SECRET`, `CRON_SECRET`, `TOKEN_ENCRYPTION_KEY`, `ANTHROPIC_API_KEY` (optional), `OPENAI_API_KEY` (optional), `HIGGSFIELD_API_KEY` + `HIGGSFIELD_API_SECRET` (optional).

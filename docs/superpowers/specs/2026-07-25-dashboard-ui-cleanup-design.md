# Dashboard UI Cleanup — Design

## Context

The dashboard (sub-project 3) is functionally complete and deployed to Vercel: login, order list with status tabs, review/edit flow, store settings, one-click print. Every page was built with raw inline `style={{...}}` objects, no CSS framework, no shared visual language — it was built to be build-verified and functionally correct, not to look good. The user now wants it cleaned up visually before continuing with new backend features.

This is a purely visual/structural pass: no new pages, no new API routes, no behavior changes, with one small addition (a working logout button, since the route already exists but nothing in the UI calls it).

## Approach

Add **Tailwind CSS v4** to the `web/` Next.js project via `@tailwindcss/postcss`. Replace every inline `style` prop across all pages and client components with Tailwind utility classes. No component library, no extra runtime JS dependencies — CSS only.

Light theme only, no dark mode.

**Brand colors:** GLS black/yellow — black (`bg-black`/`text-black`, e.g. Tailwind `zinc-900` for near-black surfaces) as the primary surface color for the top bar, yellow (`yellow-400`/`yellow-500`) as the accent for primary buttons, active tab state, and the wordmark. Neutral grays (Tailwind `slate` or `zinc` scale) for backgrounds, borders, and body text elsewhere.

## Files

**New:**
- `web/postcss.config.mjs` — registers `@tailwindcss/postcss`.
- `web/app/globals.css` — `@import "tailwindcss";` plus any custom theme tokens needed (e.g. the yellow accent if the default palette's `yellow-400` isn't the exact right tone — default Tailwind yellow is fine, no custom hex needed).
- `web/app/components/AppShell.tsx` — Server Component wrapping page content with the persistent top bar (wordmark, nav links to `/` and `/instellingen`, logout button). Used by every authenticated page.
- `web/app/components/LogoutButton.tsx` — small Client Component, `onClick` posts to `/api/auth/logout` then `router.push("/login")`.
- `web/app/components/StatusBadge.tsx` — maps an `OrderRecordStatus` to a colored pill + Dutch label:
  - `PENDING` → gray, "In behandeling"
  - `NEEDS_REVIEW` → amber, "Controleren"
  - `READY` → blue, "Klaar"
  - `PRINTED` → green, "Geprint"
  - `ERROR` → red, "Fout"

**Modified (styling only, no logic changes):**
- `web/app/layout.tsx` — import `globals.css`, set `<html lang="nl">` (the UI is Dutch; this was never set correctly before), add a base `font-sans antialiased bg-slate-50 text-slate-900` to `<body>`.
- `web/app/page.tsx` — use `AppShell`, restyle tabs as pill toggles (active: `bg-yellow-400 text-black`, inactive: `bg-slate-100 text-slate-600 hover:bg-slate-200`), restyle table (zebra rows via `even:bg-slate-50`, `divide-y`, padded cells), use `StatusBadge` instead of raw `{order.status}`, add empty-state message when `orders.length === 0`.
- `web/app/SyncButton.tsx`, `web/app/PrintButton.tsx` — restyle as buttons: primary yellow/black (`bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded px-4 py-2`), disabled/loading state dims + shows a small inline spinner (a simple CSS-animated `div`, no icon library), error text in `text-red-600 text-sm`.
- `web/app/bestellingen/[id]/page.tsx`, `web/app/bestellingen/[id]/ReviewForm.tsx` — wrap in `AppShell`, restyle as a centered card (`max-w-lg mx-auto bg-white rounded-lg shadow-sm p-6`), labeled inputs (`block text-sm font-medium text-slate-700 mb-1` label + `w-full rounded border-slate-300` input), inline red error text per the existing single error line (still a single line under the form — no per-field validation wiring exists server-side, so this stays as-is, just restyled).
- `web/app/instellingen/page.tsx`, `web/app/instellingen/StoreForm.tsx` — wrap in `AppShell`, store list as simple cards/rows showing name, type badge, automation on/off badge; form restyled the same as the review form (labeled inputs, primary button, red error text).
- `web/app/login/page.tsx` — centered card on a `bg-slate-50` full-height page, GLS wordmark above the form, same input/button styling as other forms.

## Out of scope

- No dark mode.
- No new features, routes, or data flow changes.
- No component tests — this remains a build-verified-only surface per the original dashboard spec's testing section; existing Vitest suites (business logic, repositories via fakes, route handlers) are unaffected and must still pass.
- No favicon/custom branding beyond the text wordmark (a real logo image isn't available and isn't being requested here).

## Verification

`npm test` (unaffected, must still show all existing tests passing) and `npm run build` (must succeed) after the restyle. No new automated checks — visual correctness is verified by the user testing the deployed site.

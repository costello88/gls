# Dashboard — Design Spec

## Context

This is sub-project 3 of the larger hosted GLS automation system. Sub-project
1 built `createGlsLabel` (calls GLS's `CreateLabel` API). Sub-project 2 built
`syncStore` (fetches/normalizes/validates orders from Shopify and
WooCommerce into `Order` rows). This sub-project wires both into a real,
multi-user web dashboard: a shared-password-protected Next.js app where
coworkers can trigger syncs, review flagged orders, fix and requeue them,
and print labels with one click.

A local spike in this session confirmed Prisma Client generates
successfully in this environment (pinned to `prisma`/`@prisma/client`
`6.19.3` — Prisma 7 requires a driver-adapter config rework not needed
here), so this sub-project is the first to use a real Prisma-backed data
layer instead of only in-memory fakes.

## Goals

- A shared-password login gate protecting the whole dashboard.
- Real Prisma-backed implementations of `OrderRepository` (from
  sub-project 2) and a new `StoreRepository`, both thin — all actual
  business logic lives in plain, injectable-repository functions that
  tests exercise with fakes, matching the pattern already established in
  `sync.ts`.
- An order list with status filters, a manual "fetch now" sync trigger,
  a review-and-requeue flow for flagged orders, and a one-click print
  action that calls `createGlsLabel` and hands back a PDF.
- A settings page for managing connected stores (credentials, GLS
  `customerNo`, default weight, automation toggle).

## Non-goals (for this sub-project)

- Individual per-person logins/audit trail — one shared password for now
  (explicitly chosen; can be revisited later without much rework since
  the auth check is isolated to `middleware.ts` and the login route).
- The automation engine that runs `syncStore`/`createGlsLabel`
  automatically on a schedule when `automationEnabled` is on — this
  sub-project only adds a **manual** "fetch now" trigger and a **manual**
  print button. The scheduled/automatic version is the next sub-project.
- The local print agent — "print" here means "get a PDF and print it
  yourself" (already a real improvement over CSV export); silent
  automatic printing via a local agent is a later sub-project that will
  intercept before this PDF fallback when available.
- Credential encryption at rest for `Store` rows (same deferral as
  sub-project 2).

## Auth

A single shared password, `DASHBOARD_PASSWORD` (env var). `/login` posts
the entered password to `POST /api/auth/login`; on match, the response
sets an HTTP-only, `Secure`, signed session cookie (HMAC over a fixed
string + expiry, using a `SESSION_SECRET` env var — no session table
needed since there's only one shared identity). `middleware.ts` checks
this cookie on every request except `/login` and its API route,
redirecting to `/login` if missing/invalid. `POST /api/auth/logout`
clears the cookie.

## Data layer

`web/lib/db.ts` exports a single shared `PrismaClient` instance (the
standard Next.js pattern: reuse across hot-reloads in dev via a global,
to avoid exhausting database connections).

`web/lib/repositories/orderRepository.ts` — `PrismaOrderRepository`
implements sub-project 2's `OrderRepository` interface
(`exists`/`create`), plus additional methods this sub-project needs:
`list(filter: { status?: OrderStatus })`, `get(id: string)`,
`update(id: string, fields: Partial<...>)`, `markPrinted(id: string, label: string, trackingLink: string)`.

`web/lib/repositories/storeRepository.ts` — `StoreRepository` interface
(`list()`, `get(id)`, `create(...)`, `update(id, fields)`) and its
Prisma-backed implementation.

Both Prisma-backed classes are thin (a method body is one Prisma call) —
not unit tested directly, matching how a raw ORM mapping layer is
conventionally verified through integration/manual testing rather than
mocked unit tests. Everything built on top of them (the functions below)
**is** unit tested, using fake repositories.

## Core logic (injectable-repository, unit tested)

`web/lib/dashboard/orders.ts`:
- `listOrders(repo, filter)` → list of orders for a status filter.
- `reviewOrder(repo, id, edits)` → applies edits to a `NEEDS_REVIEW`
  order's fields, re-runs `checkOrder()` (from sub-project 2's
  `validate.ts`), and updates status to `PENDING` (reasons now empty) or
  `NEEDS_REVIEW` (reasons still present, `reviewReason` updated) —
  matching the spec's "edit it, and it goes back into the pending queue"
  requirement.
- `printOrder(repo, id, createLabelFn)` → loads the order, calls
  `createGlsLabel` (injected as `createLabelFn` for testability,
  defaulting to the real one from sub-project 1) with `labelType: "pdf"`
  and the order's own `customerNo` (already denormalized onto the `Order`
  row by sub-project 2's `syncStore` — no separate lookup needed), and on
  success calls `repo.markPrinted(...)` and returns the label + tracking
  link; on a `GlsApiError`, marks the order `ERROR` with the error
  message as `reviewReason` and rethrows so the API route can surface it.

`web/lib/dashboard/stores.ts`:
- `listStores(repo)`, `createStore(repo, input)`, `updateStore(repo, id, edits)` — thin pass-throughs with light validation (e.g. `type` must be `SHOPIFY` or `WOOCOMMERCE`, required credential fields present for that type).

## API routes (Next.js route handlers, thin wrappers around the above)

- `POST /api/auth/login`, `POST /api/auth/logout`
- `GET /api/orders?status=PENDING|NEEDS_REVIEW|PRINTED` → `listOrders`
- `PATCH /api/orders/:id` → `reviewOrder`
- `POST /api/orders/:id/print` → `printOrder`, returns `{ label, trackingLink }`
- `POST /api/sync` → runs `syncStore` (sub-project 2) against every
  `Store` row, returns per-store `SyncResult`s
- `GET /api/stores`, `POST /api/stores`, `PATCH /api/stores/:id`

## Pages (Dutch UI)

- `/login` — password field, submit button, error message on failure.
- `/` — order table (Naam, Adres, Land, Status), filter tabs
  ("Klaar om te printen" / "Moet gecontroleerd worden" / "Geprint"), a
  **Bestellingen ophalen** button (`POST /api/sync`), and per-row
  **Bekijken** / **Printen** actions.
- Viewing a `NEEDS_REVIEW` order opens an edit form (all fields, plus the
  current `reviewReason` shown prominently) with a **Opslaan** button.
- `/instellingen` — list of stores with an **Toevoegen** (add) form and
  per-store edit, including the **Automatisch synchroniseren** toggle
  (stored now, acted on by the next sub-project).

## Testing

Vitest, no real database or network calls:

- `orders.test.ts` — `listOrders`/`reviewOrder`/`printOrder` against a
  fake `OrderRepository` (extending sub-project 2's fake with the new
  methods): review-and-requeue moves a fixed order back to `PENDING`;
  review with a still-bad field keeps `NEEDS_REVIEW` with an updated
  reason; `printOrder` with a fake `createLabelFn` marks the order
  `PRINTED` and returns the label; `printOrder` with a `createLabelFn`
  that throws `GlsApiError` marks the order `ERROR` and rethrows.
- `stores.test.ts` — fake `StoreRepository`, verifying validation
  (missing required credential fields for the given `type` is rejected)
  and pass-through behavior otherwise.
- API route tests call the exported route handler functions directly
  with constructed `Request` objects and injected fake repositories
  (Next.js route handlers are plain functions, so no server needs to be
  running), asserting response status/body for each case above plus auth
  (`middleware.ts` logic tested as a plain function taking a cookie
  value, independent of a running server).

## Open questions for later sub-projects (explicitly deferred)

- The automation engine that calls `syncStore`/`printOrder` on a
  schedule when `automationEnabled` is true (cron trigger, likely Vercel
  Cron calling `POST /api/sync` with an internal secret, then
  auto-printing eligible orders for stores with automation on).
- The local print agent replacing "download a PDF" with real silent
  printing when connected.
- Whether `printOrder`'s PDF should also render inline in the browser
  (e.g. an embedded viewer) vs. triggering a direct download — a UI
  polish decision to make once this is actually being used.

# Automation Engine — Design

## Context

Sub-project 4 of the GLS dashboard project. Sub-projects 1-3 are built and deployed: the GLS Label API client (`web/lib/gls/`), multi-source order ingestion for Shopify + WooCommerce (`web/lib/ingest/`), and a dashboard (`web/app/`) with manual sync (`POST /api/sync`) and manual print (`POST /api/orders/:id/print`). Each `Store` already has an `automationEnabled` boolean, editable in the settings UI, but nothing reads it — it's currently a dead toggle.

This sub-project makes `automationEnabled` do something: orders sync on a schedule without anyone clicking a button, and for stores with automation on, valid orders print automatically too. It also folds in three small related additions requested alongside it: a dashboard "Fout" (error) tab with manual retry, a "clear all orders" button, and a WooCommerce order-date cutoff to stop importing a backlog of old orders that were never marked processed.

## Scheduling

Vercel Cron Jobs (native, since the account is on the Pro plan) hits a route every 15 minutes:

`web/vercel.json`:
```json
{
  "crons": [{ "path": "/api/cron/sync", "schedule": "*/15 * * * *" }]
}
```

Vercel automatically attaches `Authorization: Bearer $CRON_SECRET` to its own cron requests when a `CRON_SECRET` environment variable is set on the project. The route checks that header and returns 401 on any mismatch or absence — this is the only auth this endpoint needs, since it's called by Vercel itself, not a logged-in dashboard user.

`web/middleware.ts` needs a new bypass so this route isn't redirected to `/login` like every other route: add `pathname.startsWith("/api/cron")` alongside the existing `/login` and `/api/auth/login` bypasses.

**New environment variable:** `CRON_SECRET` — a random string (same idea as `SESSION_SECRET`), must be added to Vercel after this ships.

## Automation logic

New file `web/lib/automation/run.ts`, exporting:

```typescript
export interface AutomationStoreResult {
  storeId: string;
  sync: SyncResult;   // from web/lib/ingest/types.ts, unchanged
  printed: number;
  failed: number;
}

export async function runAutomatedSync(
  storeRepo: StoreRepository,
  orderRepo: DashboardOrderRepository,
  createLabelFn: CreateLabelFn,
): Promise<AutomationStoreResult[]>
```

Behavior:
1. List all stores. For each, run the existing `syncStore` (sub-project 2, unchanged) to pull in new orders.
2. Collect the IDs of stores with `automationEnabled: true`. If there are any, fetch their `PENDING` and `ERROR` orders via a new repository method `listPrintable(storeIds: string[])`, and call the existing `printOrder` (sub-project 3, unchanged) on each one.
3. `printOrder` already handles both outcomes correctly with no changes needed: success calls `markPrinted`, failure calls `markError` and the order stays retryable. Because failed orders stay in `ERROR` (not some other terminal state), the *next* cron run's `listPrintable` call picks them up again automatically — this is how retry-next-cycle works, with no new retry bookkeeping.
4. Returns per-store `{ sync, printed, failed }` counts as the route's JSON response — visible in Vercel's cron invocation logs if needed. No dedicated activity-log UI is built; the dashboard's existing status tabs (soon including the new Error tab) are the source of truth for what needs attention.

Orders that fail validation during sync (landing in `NEEDS_REVIEW`) are never auto-printed regardless of the store's automation setting — this was already true of `syncStore`'s existing behavior and doesn't change.

## New repository method

`DashboardOrderRepository` (in `web/lib/dashboard/types.ts`) gains:
```typescript
listPrintable(storeIds: string[]): Promise<OrderRecord[]>;
```
Returns orders with status `PENDING` or `ERROR` belonging to any of the given store IDs. Implemented on `PrismaOrderRepository` (thin, build-verified only, matching the existing pattern for that class) and on a hand-written fake for tests.

## API route

`web/app/api/cron/sync/shared.ts` exports `handleCronSync(request, storeRepo, orderRepo, createLabelFn)` — checks the `Authorization` header against `process.env.CRON_SECRET`, returns 401 on mismatch, otherwise calls `runAutomatedSync` and returns its result as JSON. `web/app/api/cron/sync/route.ts` is the thin `GET` wrapper using the real Prisma repositories and `createGlsLabel`, matching every other route in this project.

## Dashboard additions

**Error tab.** The order list's `TABS` array gains a fourth entry for `ERROR` ("Fout"), using the existing red `StatusBadge` styling. The existing `PrintButton` is also rendered for `ERROR`-status rows (currently only shown for `PENDING`) — no change to `PrintButton` or `printOrder` is needed since printing was never gated by status; this is purely a UI condition change in `web/app/page.tsx`, giving a manual retry option instead of waiting up to 15 minutes for the next cron cycle.

**Clear all orders.** A new button next to `SyncButton` on the dashboard, behind a `window.confirm(...)` prompt (irreversible, deletes every order row regardless of status — including already-printed ones). New pieces:
- `deleteAll(): Promise<void>` added to `DashboardOrderRepository`.
- `clearOrders(repo: DashboardOrderRepository): Promise<void>` in `web/lib/dashboard/orders.ts` — trivial wrapper, tested via a fake repository like everything else in that file.
- `DELETE /api/orders` route (`web/app/api/orders/shared.ts` gains `handleClearOrders`, `web/app/api/orders/route.ts` gains the `DELETE` export).
- `web/app/ClearOrdersButton.tsx`, a Client Component: confirm dialog, then `fetch("/api/orders", { method: "DELETE" })`, then `router.refresh()`.

## WooCommerce order-date cutoff

`web/lib/ingest/woocommerce.ts` gets a fixed constant:
```typescript
const WOOCOMMERCE_ORDERS_AFTER = "2026-07-24T00:00:00";
```
appended to the existing fetch URL as WooCommerce's `after` query parameter (filters to orders with `date_created >= after`). Applies to every WooCommerce store — not a per-store setting, since this addresses a one-time historical-data problem (a backlog of orders on the user's WooCommerce site that were never marked "processing" until now) rather than an ongoing need. The existing test in `web/lib/ingest/__tests__/woocommerce.test.ts` asserting the exact fetch URL is updated to include the new parameter.

## Out of scope

- No activity/audit log UI.
- No configurable sync interval or per-store cutoff dates.
- No changes to `syncStore`, `printOrder`, or any GLS API client code — this sub-project only adds a scheduler and a bulk-print loop around existing, unchanged logic.
- No email/push notifications on automation failures — the Error tab is the surfacing mechanism.

## Testing

- `runAutomatedSync` gets full Vitest coverage via fake `StoreRepository`/`DashboardOrderRepository` implementations and a fake `createLabelFn`, following the exact pattern already used for `syncStore` and `printOrder`.
- `handleCronSync` gets route-handler-level tests (auth rejection, successful delegation to `runAutomatedSync`), matching the pattern used for every other route's `shared.ts` module.
- `clearOrders` gets a unit test via a fake repository.
- `handleClearOrders` gets a route-handler-level test.
- The WooCommerce cutoff change updates the one existing test asserting the fetch URL.
- No new component tests for `ClearOrdersButton` or the Error tab, consistent with the rest of the dashboard (pages/components are build-verified only).
- Full `npm test` and `npx next build` must pass before this is pushed, same as every prior sub-project.

# Manual Sync Order Selection — Design

## Context

Today, clicking "Bestellingen ophalen" calls `POST /api/sync`, which runs `syncStore` for every store: it fetches unfulfilled/paid orders from Shopify/WooCommerce and immediately imports every new one it finds into the database (validated, landing in `PENDING` or `NEEDS_REVIEW`). The user wants a review step inserted before import: clicking the button should show a list of the orders found (customer name + order date, across all stores), with checkboxes to choose which ones actually get imported.

This applies **only to the manual button**. The automatic 15-minute cron sync (`runAutomatedSync`/`syncStore`, sub-projects 2 and 4) is unchanged — automation-enabled stores keep importing and auto-printing with zero clicks, exactly as today.

Orders left unchecked are permanently ignored: they will not reappear in a future preview list, even though they're still unfulfilled at the source. This requires a new terminal order state.

## Flow

1. Click "Bestellingen ophalen" → `GET /api/sync/preview` fetches raw orders from every store (reusing the existing `fetchShopifyOrders`/`fetchWooCommerceOrders`/normalize functions from sub-project 2, unchanged) and filters out any `(storeId, sourceOrderId)` pair that already has an `Order` row — whether previously imported *or* previously ignored. It does **not** write anything to the database. Returns the full normalized order data (name, address, contact info, weight, customer number) plus the store's name and the order's creation date, so nothing needs re-fetching later.
2. A modal opens listing every order found — store name, customer name, order date — each with a checkbox, checked by default, plus "Alles selecteren"/"Alles deselecteren" toggle. If there's nothing new, no modal opens; a brief inline message says so instead.
3. Clicking "Importeren" sends the full list back (including which were checked) to `POST /api/sync/confirm`. Checked orders go through the same validation as today (`checkOrder`) and are created as `PENDING` or `NEEDS_REVIEW`. Unchecked orders are created with a new status, `IGNORED`, and no validation — their only purpose is to occupy that `(storeId, sourceOrderId)` slot so `syncStore`'s and the preview's `exists()` check skips them forever after.
4. `IGNORED` orders never appear in the dashboard's order list (no tab targets that status, matching how the existing tabs are an explicit allowlist, not "everything").

## Data model change

`OrderStatus` (Prisma enum) and the two TypeScript status unions that mirror it gain `IGNORED`:
- `web/prisma/schema.prisma`: `OrderStatus` enum.
- `web/lib/ingest/types.ts`: `OrderRecordInput.status` widens from `"PENDING" | "NEEDS_REVIEW"` to `"PENDING" | "NEEDS_REVIEW" | "IGNORED"`.
- `web/lib/dashboard/types.ts`: `OrderRecordStatus` widens to include `"IGNORED"`.
- `web/app/components/StatusBadge.tsx`: gains an `IGNORED` entry in its style map (required for type completeness; in practice never rendered since no tab surfaces it).

This is additive and doesn't change `syncStore`'s existing behavior — it only ever creates `PENDING`/`NEEDS_REVIEW` orders, unchanged.

## New files

- `web/lib/ingest/preview.ts`: `previewStoreOrders(store: StoreConfig, repo: OrderRepository): Promise<PreviewOrder[]>` — fetches + normalizes + filters via `exists()`, no writes. `PreviewOrder` extends `NormalizedOrderInput` with `storeId`, `storeName`, `orderDate`.
- `web/app/api/sync/preview/shared.ts` + `route.ts`: `handlePreviewSync(storeRepo, orderRepo)` loops every store, calls `previewStoreOrders`, aggregates into one list.
- `web/app/api/sync/confirm/shared.ts` + `route.ts`: `handleConfirmSync(orderRepo, orders: (PreviewOrder & { selected: boolean })[])` — for each: validate + create `PENDING`/`NEEDS_REVIEW` if `selected`, else create `IGNORED` directly.
- `web/app/SyncButton.tsx` (modified, not new): manages preview/modal state — click fetches the preview list; if non-empty, renders an inline modal (checkboxes, select-all, Importeren/Annuleren); confirming posts to `/api/sync/confirm` and refreshes the page.

## Testing

- `previewStoreOrders` and `handleConfirmSync`'s core logic get full Vitest coverage via fake repositories, following the existing pattern.
- `handlePreviewSync`/`handleConfirmSync` route-level tests follow the existing `shared.ts` pattern.
- No component test for the modal UI in `SyncButton.tsx`, consistent with the rest of the dashboard (build-verified only).

## Out of scope

- No way to "un-ignore" an order from the UI (would require a new dashboard view; not requested).
- No change to automation's behavior or the cron route.

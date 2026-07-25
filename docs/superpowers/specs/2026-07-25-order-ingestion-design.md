# Multi-Source Order Ingestion — Design Spec

## Context

This is sub-project 2 of the larger hosted GLS automation system (sub-project
1, the GLS Label API client, is already built in `web/lib/gls/`). This piece
fetches orders from two different platforms — Shopify and a WooCommerce
(WordPress) store — normalizes them into one shared shape, validates them,
and stores them in a database. It deliberately does **not** call GLS or
touch any UI; those are separate sub-projects that build on top of this one.

## Goals

- One `Store` record per connected store (Shopify or WooCommerce), holding
  that store's credentials, which GLS account (`customerNo`) it bills to,
  its default parcel weight, and an `automationEnabled` toggle.
- One `Order` record per ingested order, in a shared shape regardless of
  source, already validated (or flagged with a reason if not).
- Re-running ingestion never creates duplicate orders.
- The same validation and address-splitting rules already proven in the
  Windows desktop tool (BE/NL/LU phone/email/country checks, address-line-2
  fallback for the house number), ported to TypeScript.

## Non-goals (for this sub-project)

- Calling `createGlsLabel` or any GLS API — orders just land as `PENDING`
  or `NEEDS_REVIEW` here; a later "automation engine" sub-project decides
  what happens next.
- Any dashboard UI for viewing/editing orders or managing stores.
- Actually reading/acting on `automationEnabled` — this sub-project only
  stores the flag on `Store`.
- Per-order weight (still a fixed default per store, matching the existing
  model).

## Database

Neon Postgres (via Vercel's integration), Prisma as the ORM.

```prisma
enum StoreType {
  SHOPIFY
  WOOCOMMERCE
}

enum OrderStatus {
  PENDING
  NEEDS_REVIEW
  READY
  PRINTED
  ERROR
}

model Store {
  id                 String   @id @default(cuid())
  type               StoreType
  name               String
  automationEnabled  Boolean  @default(false)
  customerNo         String
  defaultWeightKg     Float    @default(1.0)

  // Shopify-specific (null for WooCommerce stores)
  shopDomain          String?
  shopifyAccessToken   String?

  // WooCommerce-specific (null for Shopify stores)
  siteUrl             String?
  wooConsumerKey       String?
  wooConsumerSecret    String?

  orders              Order[]
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}

model Order {
  id             String      @id @default(cuid())
  store          Store       @relation(fields: [storeId], references: [id])
  storeId        String
  sourceOrderId  String
  orderNumber    String
  name           String
  street         String
  houseNo        String
  zipCode        String
  city           String
  countryCode    String
  phone          String
  email          String
  weightKg       Float
  customerNo     String
  status         OrderStatus @default(PENDING)
  reviewReason   String?
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  @@unique([storeId, sourceOrderId])
}
```

`weightKg` and `customerNo` are copied onto `Order` at ingestion time
(denormalized from `Store`) rather than looked up live, so that changing a
store's settings later never retroactively changes already-ingested
orders — matching how the desktop tool bakes in a fixed weight at export
time.

Only `PENDING` and `NEEDS_REVIEW` are ever written by this sub-project.
`READY`, `PRINTED`, `ERROR` are reserved for the automation-engine
sub-project, defined now to avoid a later migration.

## File structure

```
web/
    prisma/
        schema.prisma
    lib/
        db.ts                     # shared PrismaClient instance
        address.ts                 # ported split_address()
        validate.ts                 # ported email/phone/country validation
        ingest/
            types.ts                 # NormalizedOrderInput, SyncResult
            shopify.ts                 # fetchShopifyOrders(store)
            woocommerce.ts              # fetchWooCommerceOrders(store)
            normalize.ts                 # normalizeShopifyOrder(), normalizeWooCommerceOrder()
            sync.ts                       # syncStore(store)
            __tests__/
                address.test.ts
                validate.test.ts
                shopify.test.ts
                woocommerce.test.ts
                normalize.test.ts
                sync.test.ts
```

## Ported logic (Python → TypeScript, same rules)

**`address.ts`** — `splitAddress(address1: string, address2?: string): { street: string; houseNo: string }`. Same behavior as the desktop tool's `split_address`: pulls a trailing house number (with optional letter/`bus N` addition) off `address1`; if none is found and `address2` is present, uses `address2` as the house number (normalizing `"11 a"` → `"11A"`, attaching a bare letter addition to an existing number, keeping `"bus N"` additions space-separated).

**`validate.ts`** — `validateEmail(email)`, `validatePhone(phone, countryCode)` (patterns for BE/NL/LU, same as the desktop tool), `validateCountry(countryCode)` (must be `BE`/`NL`/`LU`), and `checkOrder(order): string[]` returning Dutch reason strings (e.g. `"Email: ongeldig of ontbrekend"`, `"Telefoon: ongeldig formaat"`, `"Land: niet ondersteund (verwacht BE, NL of LU)"`) — directly mirroring the desktop tool's `check_row`.

## Order source fetching

**Shopify** (`shopify.ts`): same approach as the desktop tool —
`GET https://{shopDomain}/admin/api/2024-10/orders.json?financial_status=paid&fulfillment_status=unfulfilled&status=any&limit=250`, with `X-Shopify-Access-Token` header, following the `Link` header for pagination.

**WooCommerce** (`woocommerce.ts`): `GET {siteUrl}/wp-json/wc/v3/orders?status=processing&per_page=100&page=N`, authenticated with `Authorization: Basic base64(consumerKey:consumerSecret)` (not query-string credentials, so they never end up logged in a URL). WooCommerce's `processing` status is the equivalent of Shopify's "paid, not yet fulfilled" — the trigger for a shippable order. Paginate by incrementing `page` until a page returns an empty array.

## Normalization mapping

| `NormalizedOrderInput` field | Shopify source | WooCommerce source |
|---|---|---|
| `sourceOrderId` | `order.id` | `order.id` |
| `orderNumber` | `order.name` (e.g. `"#1042"`) | `order.number` |
| `name` | `shipping_address.name` | `shipping.first_name + " " + shipping.last_name` (fallback to `billing.*` if shipping absent) |
| `street` / `houseNo` | `splitAddress(shipping_address.address1, shipping_address.address2)` | `splitAddress(shipping.address_1, shipping.address_2)` |
| `zipCode` | `shipping_address.zip` | `shipping.postcode` |
| `city` | `shipping_address.city` | `shipping.city` |
| `countryCode` | `shipping_address.country_code` | `shipping.country` |
| `phone` | `shipping_address.phone`, fallback `customer.phone` | `billing.phone` (WooCommerce shipping has no phone field) |
| `email` | `order.contact_email`, fallback `customer.email` | `billing.email` |

## Sync orchestration

`syncStore(store, prisma)`:
1. Fetch raw orders via the adapter matching `store.type`.
2. For each raw order, normalize it, then check whether an `Order` with
   this `(storeId, sourceOrderId)` already exists — skip if so.
3. Run `checkOrder()` on the normalized fields.
4. Create the `Order` row: `status = NEEDS_REVIEW` with `reviewReason` set
   if any check failed, otherwise `status = PENDING`. `weightKg` and
   `customerNo` copied from `store`.
5. Return a `SyncResult { new: number; valid: number; invalid: number; error?: string }`, matching the desktop tool's `SyncResult` shape. On a fetch error from the adapter, return `{ new: 0, valid: 0, invalid: 0, error: message }` without touching the database — same "fail cleanly, retry next time" behavior as before.

## Testing

Vitest throughout, no real network or database calls:

- `address.test.ts` / `validate.test.ts` — direct ports of the existing
  Python test cases (same inputs/outputs), confirming the TypeScript
  rewrite behaves identically.
- `shopify.test.ts` / `woocommerce.test.ts` — mocked `fetch`, verifying
  request URLs/headers/pagination and correct parsing of each platform's
  raw order shape.
- `normalize.test.ts` — sample raw Shopify and WooCommerce order fixtures
  mapped to the expected `NormalizedOrderInput`, including the
  address-line-2 fallback case and the "no shipping phone, fall back to
  billing" case for WooCommerce.
- `sync.test.ts` — using an injectable fake Prisma-like store (in-memory,
  not a real database) and fake adapters: verifies new orders are
  inserted once, already-seen orders are skipped on a second sync,
  invalid orders land as `NEEDS_REVIEW` with the right `reviewReason`,
  and adapter errors produce `{ error: message }` without any inserts.

## Open questions for later sub-projects (explicitly deferred)

- How `Store` rows actually get created/edited (a settings UI) — that's
  part of the dashboard sub-project.
- What triggers `syncStore` to run (a cron job, manual button, or both)
  and how `automationEnabled` changes that — the automation-engine
  sub-project.
- Credential encryption at rest for `Store` — Prisma/Postgres storage is
  used as designed here; whether field-level encryption is added on top
  is a security hardening decision to revisit once the dashboard exists
  and real credentials are actually being stored.

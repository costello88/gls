# Multi-Source Order Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fetch orders from Shopify and WooCommerce, normalize them into one shared shape, validate them (BE/NL/LU rules ported from the Python desktop tool), and produce a `syncStore()` function ready to be wired to a real database by a later sub-project.

**Architecture:** Pure TypeScript modules under `web/lib/` — no dependency on a live database or Prisma-generated client anywhere in this sub-project. `sync.ts` depends only on an abstract `OrderRepository` interface, which tests satisfy with an in-memory fake and a future sub-project satisfies with a real Prisma-backed implementation. `prisma/schema.prisma` is written as the source-of-truth data model but is not connected to a live Neon database in this sandboxed environment — no migration or `prisma generate` step is required for anything in this plan to build or test successfully.

**Tech Stack:** TypeScript, Vitest (existing from sub-project 1), Prisma schema file only (no client generation in this plan).

## Global Constraints

- Nothing in `web/lib/gls/` (from sub-project 1) is modified.
- `checkOrder()` reasons are Dutch strings, verbatim matching the Python tool: `"Email: ongeldig of ontbrekend"`, `"Telefoon: ongeldig formaat"`, `"Land: niet ondersteund (verwacht BE, NL of LU)"`.
- Supported countries: `BE`, `NL`, `LU` only.
- WooCommerce's `processing` order status is the fetch trigger (equivalent to Shopify's `financial_status=paid&fulfillment_status=unfulfilled`).
- WooCommerce auth uses a `Basic` auth header (`base64(consumerKey:consumerSecret)`), never query-string credentials.
- No real network or database calls in any test — `fetch` is mocked, `OrderRepository` is an in-memory fake.

---

## File Structure

```
web/
    prisma/
        schema.prisma            # Store/Order models, StoreType/OrderStatus enums (source of truth only)
    lib/
        address.ts                 # splitAddress() — ported from gls_sync/address.py
        validate.ts                 # validateEmail/Phone/Country, checkOrder() — ported from gls_sync/validate.py
        __tests__/
            address.test.ts
            validate.test.ts
        ingest/
            types.ts                 # NormalizedOrderInput, SyncResult, StoreConfig, OrderRepository
            shopify.ts                 # RawShopifyOrder, fetchShopifyOrders()
            woocommerce.ts              # RawWooCommerceOrder, fetchWooCommerceOrders()
            normalize.ts                 # normalizeShopifyOrder(), normalizeWooCommerceOrder()
            sync.ts                       # syncStore()
            __tests__/
                fixtures.ts
                shopify.test.ts
                woocommerce.test.ts
                normalize.test.ts
                sync.test.ts
```

---

### Task 1: Prisma schema (source of truth, no live database)

**Files:**
- Create: `web/prisma/schema.prisma`
- Modify: `web/package.json` (add `prisma` as a devDependency, for future use — not installed/run in this plan)

**Interfaces:**
- Consumes: nothing.
- Produces: the `Store`/`Order` data model definition that later sub-projects (dashboard, automation engine) will generate a real Prisma client from. Nothing in this plan imports or depends on it.

- [ ] **Step 1: Write the schema file**

`web/prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

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
  id                 String    @id @default(cuid())
  type               StoreType
  name               String
  automationEnabled  Boolean   @default(false)
  customerNo         String
  defaultWeightKg    Float     @default(1.0)

  shopDomain          String?
  shopifyAccessToken  String?

  siteUrl             String?
  wooConsumerKey      String?
  wooConsumerSecret   String?

  orders              Order[]
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
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

- [ ] **Step 2: Add prisma as a devDependency for future use**

In `web/package.json`, add to `devDependencies` (keep all existing entries):
```json
"prisma": "^6.1.0"
```

Do not run `npm install` for this specific dependency's engines/postinstall in this environment — a later sub-project that actually connects to Neon will run `npm install && npx prisma generate` against a real `DATABASE_URL`. This step only records the schema and intent; it does not block any test in this plan.

- [ ] **Step 3: Verify the schema by inspection**

Re-read `web/prisma/schema.prisma` and confirm every field name and type matches the spec's table exactly (`Store.automationEnabled`, `Store.customerNo`, `Store.defaultWeightKg`, `Order.reviewReason`, the `@@unique([storeId, sourceOrderId])` constraint, and the five-value `OrderStatus` enum). This is a static config file with no runtime behavior in this plan, so verification is by direct comparison against the spec rather than an automated test.

- [ ] **Step 4: Commit**

```bash
cd /home/user/gls
mkdir -p web/prisma
git add web/prisma/schema.prisma web/package.json
git commit -m "Add Prisma schema for Store/Order as data model source of truth"
```

---

### Task 2: Address splitting (ported from gls_sync/address.py)

**Files:**
- Create: `web/lib/address.ts`
- Test: `web/lib/__tests__/address.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `splitAddress(address1: string, address2?: string): { street: string; houseNo: string }` — used by Task 6 (`normalize.ts`).

- [ ] **Step 1: Write the failing tests**

`web/lib/__tests__/address.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { splitAddress } from "../address";

describe("splitAddress", () => {
  it("splits a simple number", () => {
    expect(splitAddress("Kerkstraat 12")).toEqual({ street: "Kerkstraat", houseNo: "12" });
  });

  it("splits a number with a letter suffix", () => {
    expect(splitAddress("Kerkstraat 12A")).toEqual({ street: "Kerkstraat", houseNo: "12A" });
  });

  it("splits a number with a bus suffix", () => {
    expect(splitAddress("Kerkstraat 12 bus 3")).toEqual({
      street: "Kerkstraat",
      houseNo: "12 bus 3",
    });
  });

  it("returns the whole string as street when no number is present", () => {
    expect(splitAddress("Onbekende straat")).toEqual({ street: "Onbekende straat", houseNo: "" });
  });

  it("treats a leading number as part of the street when a trailing number exists", () => {
    expect(splitAddress("12 Kerkstraat 34")).toEqual({ street: "12 Kerkstraat", houseNo: "34" });
  });

  it("uses address2 as the house number when address1 has none", () => {
    expect(splitAddress("Boekweitveld", "11")).toEqual({ street: "Boekweitveld", houseNo: "11" });
  });

  it("normalizes a letter addition from address2", () => {
    expect(splitAddress("Kerkstraat", "11 a")).toEqual({ street: "Kerkstraat", houseNo: "11A" });
  });

  it("keeps a bus addition from address2 space-separated", () => {
    expect(splitAddress("Kerkstraat", "11 bus 3")).toEqual({
      street: "Kerkstraat",
      houseNo: "11 bus 3",
    });
  });

  it("attaches a letter addition from address2 to an existing house number", () => {
    expect(splitAddress("Kerkstraat 12", "A")).toEqual({ street: "Kerkstraat", houseNo: "12A" });
  });

  it("attaches a bus addition from address2 to an existing house number", () => {
    expect(splitAddress("Kerkstraat 12", "bus 3")).toEqual({
      street: "Kerkstraat",
      houseNo: "12 bus 3",
    });
  });

  it("is unaffected by an empty address2", () => {
    expect(splitAddress("Kerkstraat 12", "")).toEqual({ street: "Kerkstraat", houseNo: "12" });
    expect(splitAddress("Kerkstraat 12")).toEqual({ street: "Kerkstraat", houseNo: "12" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/user/gls/web && npx vitest run lib/__tests__/address.test.ts`
Expected: FAIL with "Cannot find module '../address'"

- [ ] **Step 3: Write address.ts**

`web/lib/address.ts`:
```typescript
const HOUSE_NUMBER_RE = /^(.+?\S)\s+(\d+[A-Za-z]?(?:\s+bus\s+\d+)?)\s*$/;
const LETTER_ADDITION_RE = /^[A-Za-z]$/;
const BUS_ADDITION_RE = /^bus\s*(\d+)$/i;
const NUMBER_LETTER_RE = /^(\d+)\s*([A-Za-z])$/;

function formatAddition(raw: string): string {
  const trimmed = raw.trim();
  if (LETTER_ADDITION_RE.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  const busMatch = trimmed.match(BUS_ADDITION_RE);
  if (busMatch) {
    return `bus ${busMatch[1]}`;
  }
  const numberLetterMatch = trimmed.match(NUMBER_LETTER_RE);
  if (numberLetterMatch) {
    return `${numberLetterMatch[1]}${numberLetterMatch[2].toUpperCase()}`;
  }
  return trimmed;
}

export function splitAddress(
  address1: string,
  address2: string = "",
): { street: string; houseNo: string } {
  const a1 = (address1 ?? "").trim();
  const a2 = (address2 ?? "").trim();

  const match = a1.match(HOUSE_NUMBER_RE);
  const street = match ? match[1] : a1;
  const houseNo = match ? match[2] : "";

  if (!a2) {
    return { street, houseNo };
  }

  const addition = formatAddition(a2);
  if (!houseNo) {
    return { street, houseNo: addition };
  }
  if (addition.toLowerCase().startsWith("bus")) {
    return { street, houseNo: `${houseNo} ${addition}` };
  }
  return { street, houseNo: `${houseNo}${addition}` };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/user/gls/web && npx vitest run lib/__tests__/address.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
cd /home/user/gls
git add web/lib/address.ts web/lib/__tests__/address.test.ts
git commit -m "Port address splitting from gls_sync/address.py to TypeScript"
```

---

### Task 3: Validation (ported from gls_sync/validate.py)

**Files:**
- Create: `web/lib/validate.ts`
- Test: `web/lib/__tests__/validate.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `validateEmail(email: string): boolean`; `validatePhone(phone: string, countryCode: string): boolean`; `validateCountry(countryCode: string): boolean`; `SUPPORTED_COUNTRIES: Set<string>`; `checkOrder(order: { email: string; phone: string; countryCode: string }): string[]` — used by Task 7 (`sync.ts`).

- [ ] **Step 1: Write the failing tests**

`web/lib/__tests__/validate.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { checkOrder, validateCountry, validateEmail, validatePhone } from "../validate";

describe("validateEmail", () => {
  it("accepts a valid email", () => {
    expect(validateEmail("klant@voorbeeld.be")).toBe(true);
  });

  it("rejects a missing @", () => {
    expect(validateEmail("klantvoorbeeld.be")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(validateEmail("")).toBe(false);
  });
});

describe("validatePhone", () => {
  it("accepts a BE international number", () => {
    expect(validatePhone("+32 470 12 34 56", "BE")).toBe(true);
  });

  it("accepts a BE local number", () => {
    expect(validatePhone("0470123456", "BE")).toBe(true);
  });

  it("accepts an NL international number", () => {
    expect(validatePhone("+31 6 12345678", "NL")).toBe(true);
  });

  it("accepts an LU international number", () => {
    expect(validatePhone("+352 621123456", "LU")).toBe(true);
  });

  it("rejects a too-short number", () => {
    expect(validatePhone("0470", "BE")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(validatePhone("", "BE")).toBe(false);
  });
});

describe("validateCountry", () => {
  it("accepts supported countries", () => {
    expect(validateCountry("BE")).toBe(true);
    expect(validateCountry("NL")).toBe(true);
    expect(validateCountry("LU")).toBe(true);
  });

  it("rejects unsupported countries", () => {
    expect(validateCountry("DE")).toBe(false);
  });
});

describe("checkOrder", () => {
  it("passes a clean order", () => {
    expect(
      checkOrder({ email: "klant@voorbeeld.be", phone: "+32470123456", countryCode: "BE" }),
    ).toEqual([]);
  });

  it("flags a bad email", () => {
    const reasons = checkOrder({ email: "kapot", phone: "+32470123456", countryCode: "BE" });
    expect(reasons.some((r) => r.includes("Email"))).toBe(true);
  });

  it("flags a bad phone", () => {
    const reasons = checkOrder({ email: "klant@voorbeeld.be", phone: "123", countryCode: "BE" });
    expect(reasons.some((r) => r.includes("Telefoon"))).toBe(true);
  });

  it("flags an unsupported country", () => {
    const reasons = checkOrder({
      email: "klant@voorbeeld.be",
      phone: "+32470123456",
      countryCode: "DE",
    });
    expect(reasons.some((r) => r.includes("Land"))).toBe(true);
  });

  it("flags multiple reasons at once", () => {
    const reasons = checkOrder({ email: "kapot", phone: "123", countryCode: "BE" });
    expect(reasons).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/user/gls/web && npx vitest run lib/__tests__/validate.test.ts`
Expected: FAIL with "Cannot find module '../validate'"

- [ ] **Step 3: Write validate.ts**

`web/lib/validate.ts`:
```typescript
export const SUPPORTED_COUNTRIES = new Set(["BE", "NL", "LU"]);

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const PHONE_PATTERNS: Record<string, RegExp> = {
  BE: /^(\+32|0032|0)\d{8,9}$/,
  NL: /^(\+31|0031|0)\d{9}$/,
  LU: /^(\+352|00352)\d{6,9}$/,
};

export function validateEmail(email: string): boolean {
  if (!email) return false;
  return EMAIL_RE.test(email.trim());
}

function normalizePhone(phone: string): string {
  return phone.trim().replace(/[\s\-().]/g, "");
}

export function validatePhone(phone: string, countryCode: string): boolean {
  if (!phone) return false;
  const normalized = normalizePhone(phone);
  const pattern = PHONE_PATTERNS[countryCode];
  if (!pattern) return false;
  return pattern.test(normalized);
}

export function validateCountry(countryCode: string): boolean {
  return SUPPORTED_COUNTRIES.has(countryCode);
}

export interface OrderCheckInput {
  email: string;
  phone: string;
  countryCode: string;
}

export function checkOrder(order: OrderCheckInput): string[] {
  const reasons: string[] = [];
  if (!validateEmail(order.email)) {
    reasons.push("Email: ongeldig of ontbrekend");
  }
  if (!validatePhone(order.phone, order.countryCode)) {
    reasons.push("Telefoon: ongeldig formaat");
  }
  if (!validateCountry(order.countryCode)) {
    reasons.push("Land: niet ondersteund (verwacht BE, NL of LU)");
  }
  return reasons;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/user/gls/web && npx vitest run lib/__tests__/validate.test.ts`
Expected: PASS (16 tests)

- [ ] **Step 5: Commit**

```bash
cd /home/user/gls
git add web/lib/validate.ts web/lib/__tests__/validate.test.ts
git commit -m "Port BE/NL/LU validation from gls_sync/validate.py to TypeScript"
```

---

### Task 4: Shared ingestion types

**Files:**
- Create: `web/lib/ingest/types.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `NormalizedOrderInput`, `SyncResult`, `StoreConfig` (discriminated union on `type: "SHOPIFY" | "WOOCOMMERCE"`), `OrderRepository` — used by Tasks 5-8.

- [ ] **Step 1: Write types.ts**

`web/lib/ingest/types.ts`:
```typescript
export interface NormalizedOrderInput {
  sourceOrderId: string;
  orderNumber: string;
  name: string;
  street: string;
  houseNo: string;
  zipCode: string;
  city: string;
  countryCode: string;
  phone: string;
  email: string;
}

export interface SyncResult {
  new: number;
  valid: number;
  invalid: number;
  error?: string;
}

interface StoreConfigBase {
  id: string;
  defaultWeightKg: number;
  customerNo: string;
}

export type StoreConfig =
  | (StoreConfigBase & {
      type: "SHOPIFY";
      shopDomain: string;
      shopifyAccessToken: string;
    })
  | (StoreConfigBase & {
      type: "WOOCOMMERCE";
      siteUrl: string;
      wooConsumerKey: string;
      wooConsumerSecret: string;
    });

export interface OrderRecordInput {
  storeId: string;
  sourceOrderId: string;
  orderNumber: string;
  name: string;
  street: string;
  houseNo: string;
  zipCode: string;
  city: string;
  countryCode: string;
  phone: string;
  email: string;
  weightKg: number;
  customerNo: string;
  status: "PENDING" | "NEEDS_REVIEW";
  reviewReason: string | null;
}

export interface OrderRepository {
  exists(storeId: string, sourceOrderId: string): Promise<boolean>;
  create(order: OrderRecordInput): Promise<void>;
}
```

This is a types-only file (no runtime behavior), so there is no dedicated test for it — it is exercised through Tasks 5-8's tests, matching how `web/lib/gls/types.ts` was handled in sub-project 1.

- [ ] **Step 2: Commit**

```bash
cd /home/user/gls
git add web/lib/ingest/types.ts
git commit -m "Add shared ingestion types (NormalizedOrderInput, StoreConfig, OrderRepository)"
```

---

### Task 5: Shopify order fetch adapter

**Files:**
- Create: `web/lib/ingest/shopify.ts`
- Test: `web/lib/ingest/__tests__/shopify.test.ts`

**Interfaces:**
- Consumes: the `"SHOPIFY"` branch of `StoreConfig` from Task 4.
- Produces: `RawShopifyOrder` interface; `fetchShopifyOrders(store: Extract<StoreConfig, { type: "SHOPIFY" }>): Promise<RawShopifyOrder[]>` — used by Task 6 (`normalize.ts`) and Task 8 (`sync.ts`).

- [ ] **Step 1: Write the failing tests**

`web/lib/ingest/__tests__/shopify.test.ts`:
```typescript
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchShopifyOrders } from "../shopify";

describe("fetchShopifyOrders", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const store = {
    id: "store-1",
    type: "SHOPIFY" as const,
    defaultWeightKg: 1.0,
    customerNo: "11850079",
    shopDomain: "example.myshopify.com",
    shopifyAccessToken: "shpat_test",
  };

  it("fetches a single page and sends the access token header", async () => {
    const order = { id: 1001, name: "#1001" };
    const mockFetch = vi.fn().mockResolvedValue({
      headers: new Headers(),
      json: async () => ({ orders: [order] }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const orders = await fetchShopifyOrders(store);

    expect(orders).toEqual([order]);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("https://example.myshopify.com/admin/api/2024-10/orders.json");
    expect(url).toContain("financial_status=paid");
    expect(url).toContain("fulfillment_status=unfulfilled");
    expect((options as RequestInit).headers).toEqual({
      "X-Shopify-Access-Token": "shpat_test",
    });
  });

  it("follows the Link header for pagination", async () => {
    const order1 = { id: 1001, name: "#1001" };
    const order2 = { id: 1002, name: "#1002" };
    const nextUrl = "https://example.myshopify.com/admin/api/2024-10/orders.json?page_info=abc";

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        headers: new Headers({ Link: `<${nextUrl}>; rel="next"` }),
        json: async () => ({ orders: [order1] }),
      })
      .mockResolvedValueOnce({
        headers: new Headers(),
        json: async () => ({ orders: [order2] }),
      });
    global.fetch = mockFetch as unknown as typeof fetch;

    const orders = await fetchShopifyOrders(store);

    expect(orders.map((o) => o.id)).toEqual([1001, 1002]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/user/gls/web && npx vitest run lib/ingest/__tests__/shopify.test.ts`
Expected: FAIL with "Cannot find module '../shopify'"

- [ ] **Step 3: Write shopify.ts**

`web/lib/ingest/shopify.ts`:
```typescript
import type { StoreConfig } from "./types";

const API_VERSION = "2024-10";
const NEXT_LINK_RE = /<([^>]+)>;\s*rel="next"/;

export interface RawShopifyOrder {
  id: number;
  name: string;
  contact_email?: string;
  customer?: { email?: string; phone?: string };
  shipping_address?: {
    name?: string;
    address1?: string;
    address2?: string;
    zip?: string;
    city?: string;
    country_code?: string;
    phone?: string;
  };
}

type ShopifyStoreConfig = Extract<StoreConfig, { type: "SHOPIFY" }>;

export async function fetchShopifyOrders(store: ShopifyStoreConfig): Promise<RawShopifyOrder[]> {
  let url: string | null = `https://${store.shopDomain}/admin/api/${API_VERSION}/orders.json`;
  let params: URLSearchParams | null = new URLSearchParams({
    financial_status: "paid",
    fulfillment_status: "unfulfilled",
    status: "any",
    limit: "250",
  });

  const orders: RawShopifyOrder[] = [];
  while (url) {
    const requestUrl = params ? `${url}?${params.toString()}` : url;
    const response = await fetch(requestUrl, {
      headers: { "X-Shopify-Access-Token": store.shopifyAccessToken },
    });
    const json = (await response.json()) as { orders?: RawShopifyOrder[] };
    orders.push(...(json.orders ?? []));

    const link = response.headers.get("Link") ?? "";
    const match = link.match(NEXT_LINK_RE);
    url = match ? match[1] : null;
    params = null;
  }

  return orders;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/user/gls/web && npx vitest run lib/ingest/__tests__/shopify.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
cd /home/user/gls
git add web/lib/ingest/shopify.ts web/lib/ingest/__tests__/shopify.test.ts
git commit -m "Add Shopify order fetch adapter"
```

---

### Task 6: WooCommerce order fetch adapter

**Files:**
- Create: `web/lib/ingest/woocommerce.ts`
- Test: `web/lib/ingest/__tests__/woocommerce.test.ts`

**Interfaces:**
- Consumes: the `"WOOCOMMERCE"` branch of `StoreConfig` from Task 4.
- Produces: `RawWooCommerceOrder` interface; `fetchWooCommerceOrders(store: Extract<StoreConfig, { type: "WOOCOMMERCE" }>): Promise<RawWooCommerceOrder[]>` — used by Task 6's sibling `normalize.ts` (Task 7) and Task 8 (`sync.ts`).

- [ ] **Step 1: Write the failing tests**

`web/lib/ingest/__tests__/woocommerce.test.ts`:
```typescript
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWooCommerceOrders } from "../woocommerce";

describe("fetchWooCommerceOrders", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const store = {
    id: "store-2",
    type: "WOOCOMMERCE" as const,
    defaultWeightKg: 1.0,
    customerNo: "11850080",
    siteUrl: "https://example.com",
    wooConsumerKey: "ck_test",
    wooConsumerSecret: "cs_test",
  };

  it("fetches a single page with status=processing and a Basic auth header", async () => {
    const order = { id: 2001, number: "2001" };
    const mockFetch = vi.fn().mockResolvedValue({
      json: async () => [order],
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const orders = await fetchWooCommerceOrders(store);

    expect(orders).toEqual([order]);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(
      "https://example.com/wp-json/wc/v3/orders?status=processing&per_page=100&page=1",
    );
    const expectedAuth = `Basic ${Buffer.from("ck_test:cs_test").toString("base64")}`;
    expect((options as RequestInit).headers).toEqual({ Authorization: expectedAuth });
  });

  it("pages forward until an empty page is returned", async () => {
    const order1 = { id: 2001, number: "2001" };
    const order2 = { id: 2002, number: "2002" };

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ json: async () => [order1] })
      .mockResolvedValueOnce({ json: async () => [order2] })
      .mockResolvedValueOnce({ json: async () => [] });
    global.fetch = mockFetch as unknown as typeof fetch;

    const orders = await fetchWooCommerceOrders(store);

    expect(orders.map((o) => o.id)).toEqual([2001, 2002]);
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockFetch.mock.calls[1][0]).toContain("page=2");
    expect(mockFetch.mock.calls[2][0]).toContain("page=3");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/user/gls/web && npx vitest run lib/ingest/__tests__/woocommerce.test.ts`
Expected: FAIL with "Cannot find module '../woocommerce'"

- [ ] **Step 3: Write woocommerce.ts**

`web/lib/ingest/woocommerce.ts`:
```typescript
import type { StoreConfig } from "./types";

export interface RawWooCommerceOrder {
  id: number;
  number: string;
  billing?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  };
  shipping?: {
    first_name?: string;
    last_name?: string;
    address_1?: string;
    address_2?: string;
    city?: string;
    postcode?: string;
    country?: string;
  };
}

type WooCommerceStoreConfig = Extract<StoreConfig, { type: "WOOCOMMERCE" }>;

export async function fetchWooCommerceOrders(
  store: WooCommerceStoreConfig,
): Promise<RawWooCommerceOrder[]> {
  const auth = Buffer.from(`${store.wooConsumerKey}:${store.wooConsumerSecret}`).toString(
    "base64",
  );
  const orders: RawWooCommerceOrder[] = [];
  let page = 1;

  while (true) {
    const url = `${store.siteUrl}/wp-json/wc/v3/orders?status=processing&per_page=100&page=${page}`;
    const response = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
    });
    const json = (await response.json()) as RawWooCommerceOrder[];
    if (json.length === 0) {
      break;
    }
    orders.push(...json);
    page += 1;
  }

  return orders;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/user/gls/web && npx vitest run lib/ingest/__tests__/woocommerce.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
cd /home/user/gls
git add web/lib/ingest/woocommerce.ts web/lib/ingest/__tests__/woocommerce.test.ts
git commit -m "Add WooCommerce order fetch adapter"
```

---

### Task 7: Normalization (Shopify + WooCommerce → NormalizedOrderInput)

**Files:**
- Create: `web/lib/ingest/normalize.ts`
- Create: `web/lib/ingest/__tests__/fixtures.ts`
- Test: `web/lib/ingest/__tests__/normalize.test.ts`

**Interfaces:**
- Consumes: `splitAddress` from Task 2; `RawShopifyOrder` from Task 5; `RawWooCommerceOrder` from Task 6; `NormalizedOrderInput` from Task 4.
- Produces: `normalizeShopifyOrder(order: RawShopifyOrder): NormalizedOrderInput`; `normalizeWooCommerceOrder(order: RawWooCommerceOrder): NormalizedOrderInput` — used by Task 8 (`sync.ts`).

- [ ] **Step 1: Write shared fixtures**

`web/lib/ingest/__tests__/fixtures.ts`:
```typescript
import type { RawShopifyOrder } from "../shopify";
import type { RawWooCommerceOrder } from "../woocommerce";

export function makeRawShopifyOrder(overrides: Partial<RawShopifyOrder> = {}): RawShopifyOrder {
  return {
    id: 1001,
    name: "#1001",
    contact_email: "jan@voorbeeld.be",
    customer: { email: "jan@voorbeeld.be", phone: "+32470123456" },
    shipping_address: {
      name: "Jan Peeters",
      address1: "Kerkstraat 12",
      address2: "",
      zip: "2000",
      city: "Antwerpen",
      country_code: "BE",
      phone: "+32470123456",
    },
    ...overrides,
  };
}

export function makeRawWooCommerceOrder(
  overrides: Partial<RawWooCommerceOrder> = {},
): RawWooCommerceOrder {
  return {
    id: 2001,
    number: "2001",
    billing: {
      first_name: "Ingrid",
      last_name: "Op den Buijs",
      email: "ingrid@voorbeeld.nl",
      phone: "+31612345678",
    },
    shipping: {
      first_name: "Ingrid",
      last_name: "Op den Buijs",
      address_1: "Boekweitveld",
      address_2: "11",
      city: "Empel",
      postcode: "5236 WR",
      country: "NL",
    },
    ...overrides,
  };
}
```

- [ ] **Step 2: Write the failing tests**

`web/lib/ingest/__tests__/normalize.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { normalizeShopifyOrder, normalizeWooCommerceOrder } from "../normalize";
import { makeRawShopifyOrder, makeRawWooCommerceOrder } from "./fixtures";

describe("normalizeShopifyOrder", () => {
  it("maps a standard order", () => {
    const order = makeRawShopifyOrder();
    expect(normalizeShopifyOrder(order)).toEqual({
      sourceOrderId: "1001",
      orderNumber: "#1001",
      name: "Jan Peeters",
      street: "Kerkstraat",
      houseNo: "12",
      zipCode: "2000",
      city: "Antwerpen",
      countryCode: "BE",
      phone: "+32470123456",
      email: "jan@voorbeeld.be",
    });
  });

  it("falls back to address2 for the house number", () => {
    const order = makeRawShopifyOrder({
      shipping_address: {
        name: "Ingrid Op den Buijs",
        address1: "Boekweitveld",
        address2: "11",
        zip: "5236 WR",
        city: "Empel",
        country_code: "NL",
        phone: "+31612345678",
      },
    });
    const result = normalizeShopifyOrder(order);
    expect(result.street).toBe("Boekweitveld");
    expect(result.houseNo).toBe("11");
  });

  it("falls back to customer email/phone when order-level fields are absent", () => {
    const order = makeRawShopifyOrder({ contact_email: undefined });
    order.shipping_address!.phone = undefined;
    const result = normalizeShopifyOrder(order);
    expect(result.email).toBe("jan@voorbeeld.be");
    expect(result.phone).toBe("+32470123456");
  });
});

describe("normalizeWooCommerceOrder", () => {
  it("maps a standard order using shipping name and billing contact info", () => {
    const order = makeRawWooCommerceOrder();
    expect(normalizeWooCommerceOrder(order)).toEqual({
      sourceOrderId: "2001",
      orderNumber: "2001",
      name: "Ingrid Op den Buijs",
      street: "Boekweitveld",
      houseNo: "11",
      zipCode: "5236 WR",
      city: "Empel",
      countryCode: "NL",
      phone: "+31612345678",
      email: "ingrid@voorbeeld.nl",
    });
  });

  it("falls back to billing name when shipping has no name", () => {
    const order = makeRawWooCommerceOrder({
      shipping: {
        first_name: "",
        last_name: "",
        address_1: "Boekweitveld",
        address_2: "11",
        city: "Empel",
        postcode: "5236 WR",
        country: "NL",
      },
    });
    const result = normalizeWooCommerceOrder(order);
    expect(result.name).toBe("Ingrid Op den Buijs");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /home/user/gls/web && npx vitest run lib/ingest/__tests__/normalize.test.ts`
Expected: FAIL with "Cannot find module '../normalize'"

- [ ] **Step 4: Write normalize.ts**

`web/lib/ingest/normalize.ts`:
```typescript
import { splitAddress } from "../address";
import type { RawShopifyOrder } from "./shopify";
import type { RawWooCommerceOrder } from "./woocommerce";
import type { NormalizedOrderInput } from "./types";

export function normalizeShopifyOrder(order: RawShopifyOrder): NormalizedOrderInput {
  const shipping = order.shipping_address ?? {};
  const { street, houseNo } = splitAddress(shipping.address1 ?? "", shipping.address2 ?? "");
  const email = order.contact_email ?? order.customer?.email ?? "";
  const phone = shipping.phone ?? order.customer?.phone ?? "";

  return {
    sourceOrderId: String(order.id),
    orderNumber: order.name,
    name: shipping.name ?? "",
    street,
    houseNo,
    zipCode: shipping.zip ?? "",
    city: shipping.city ?? "",
    countryCode: shipping.country_code ?? "",
    phone,
    email,
  };
}

export function normalizeWooCommerceOrder(order: RawWooCommerceOrder): NormalizedOrderInput {
  const shipping = order.shipping ?? {};
  const billing = order.billing ?? {};
  const { street, houseNo } = splitAddress(shipping.address_1 ?? "", shipping.address_2 ?? "");

  const shippingHasName = Boolean(shipping.first_name || shipping.last_name);
  const firstName = shippingHasName ? shipping.first_name : billing.first_name;
  const lastName = shippingHasName ? shipping.last_name : billing.last_name;
  const name = [firstName, lastName].filter(Boolean).join(" ");

  return {
    sourceOrderId: String(order.id),
    orderNumber: order.number,
    name,
    street,
    houseNo,
    zipCode: shipping.postcode ?? "",
    city: shipping.city ?? "",
    countryCode: shipping.country ?? "",
    phone: billing.phone ?? "",
    email: billing.email ?? "",
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /home/user/gls/web && npx vitest run lib/ingest/__tests__/normalize.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
cd /home/user/gls
git add web/lib/ingest/normalize.ts web/lib/ingest/__tests__/fixtures.ts web/lib/ingest/__tests__/normalize.test.ts
git commit -m "Add order normalization for Shopify and WooCommerce"
```

---

### Task 8: Sync orchestration

**Files:**
- Create: `web/lib/ingest/sync.ts`
- Test: `web/lib/ingest/__tests__/sync.test.ts`

**Interfaces:**
- Consumes: `checkOrder` from Task 3; `fetchShopifyOrders` from Task 5; `fetchWooCommerceOrders` from Task 6; `normalizeShopifyOrder`/`normalizeWooCommerceOrder` from Task 7; `StoreConfig`, `OrderRepository`, `SyncResult` from Task 4.
- Produces: `syncStore(store: StoreConfig, repository: OrderRepository): Promise<SyncResult>` — the final deliverable of this plan, ready for a later sub-project to call with a real Prisma-backed `OrderRepository`.

- [ ] **Step 1: Write the failing tests**

`web/lib/ingest/__tests__/sync.test.ts`:
```typescript
import { afterEach, describe, expect, it, vi } from "vitest";
import { syncStore } from "../sync";
import type { OrderRecordInput, OrderRepository, StoreConfig } from "../types";
import { makeRawShopifyOrder } from "./fixtures";

class FakeOrderRepository implements OrderRepository {
  created: OrderRecordInput[] = [];
  private existing = new Set<string>();

  seedExisting(storeId: string, sourceOrderId: string) {
    this.existing.add(`${storeId}:${sourceOrderId}`);
  }

  async exists(storeId: string, sourceOrderId: string): Promise<boolean> {
    return this.existing.has(`${storeId}:${sourceOrderId}`);
  }

  async create(order: OrderRecordInput): Promise<void> {
    this.created.push(order);
  }
}

const shopifyStore: StoreConfig = {
  id: "store-1",
  type: "SHOPIFY",
  defaultWeightKg: 1.5,
  customerNo: "11850079",
  shopDomain: "example.myshopify.com",
  shopifyAccessToken: "shpat_test",
};

describe("syncStore", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("inserts a new valid order as PENDING", async () => {
    const order = makeRawShopifyOrder({ id: 1, name: "#1" });
    global.fetch = vi.fn().mockResolvedValue({
      headers: new Headers(),
      json: async () => ({ orders: [order] }),
    }) as unknown as typeof fetch;

    const repository = new FakeOrderRepository();
    const result = await syncStore(shopifyStore, repository);

    expect(result).toEqual({ new: 1, valid: 1, invalid: 0 });
    expect(repository.created).toHaveLength(1);
    expect(repository.created[0]).toMatchObject({
      storeId: "store-1",
      sourceOrderId: "1",
      status: "PENDING",
      reviewReason: null,
      weightKg: 1.5,
      customerNo: "11850079",
    });
  });

  it("inserts an invalid order as NEEDS_REVIEW with a reason", async () => {
    const order = makeRawShopifyOrder({ id: 2, name: "#2" });
    order.contact_email = "broken-email";
    order.customer = { email: "broken-email", phone: "+32470123456" };
    global.fetch = vi.fn().mockResolvedValue({
      headers: new Headers(),
      json: async () => ({ orders: [order] }),
    }) as unknown as typeof fetch;

    const repository = new FakeOrderRepository();
    const result = await syncStore(shopifyStore, repository);

    expect(result).toEqual({ new: 1, valid: 0, invalid: 1 });
    expect(repository.created[0].status).toBe("NEEDS_REVIEW");
    expect(repository.created[0].reviewReason).toContain("Email");
  });

  it("skips an order that already exists for this store", async () => {
    const order = makeRawShopifyOrder({ id: 3, name: "#3" });
    global.fetch = vi.fn().mockResolvedValue({
      headers: new Headers(),
      json: async () => ({ orders: [order] }),
    }) as unknown as typeof fetch;

    const repository = new FakeOrderRepository();
    repository.seedExisting("store-1", "3");

    const result = await syncStore(shopifyStore, repository);

    expect(result).toEqual({ new: 0, valid: 0, invalid: 0 });
    expect(repository.created).toHaveLength(0);
  });

  it("returns an error result without creating any orders when the fetch fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const repository = new FakeOrderRepository();
    const result = await syncStore(shopifyStore, repository);

    expect(result).toEqual({ new: 0, valid: 0, invalid: 0, error: "network down" });
    expect(repository.created).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/user/gls/web && npx vitest run lib/ingest/__tests__/sync.test.ts`
Expected: FAIL with "Cannot find module '../sync'"

- [ ] **Step 3: Write sync.ts**

`web/lib/ingest/sync.ts`:
```typescript
import { checkOrder } from "../validate";
import { fetchShopifyOrders } from "./shopify";
import { fetchWooCommerceOrders } from "./woocommerce";
import { normalizeShopifyOrder, normalizeWooCommerceOrder } from "./normalize";
import type { NormalizedOrderInput, OrderRepository, StoreConfig, SyncResult } from "./types";

async function processOrder(
  normalized: NormalizedOrderInput,
  store: StoreConfig,
  repository: OrderRepository,
  result: SyncResult,
): Promise<void> {
  const alreadyExists = await repository.exists(store.id, normalized.sourceOrderId);
  if (alreadyExists) {
    return;
  }

  result.new += 1;
  const reasons = checkOrder({
    email: normalized.email,
    phone: normalized.phone,
    countryCode: normalized.countryCode,
  });

  await repository.create({
    storeId: store.id,
    sourceOrderId: normalized.sourceOrderId,
    orderNumber: normalized.orderNumber,
    name: normalized.name,
    street: normalized.street,
    houseNo: normalized.houseNo,
    zipCode: normalized.zipCode,
    city: normalized.city,
    countryCode: normalized.countryCode,
    phone: normalized.phone,
    email: normalized.email,
    weightKg: store.defaultWeightKg,
    customerNo: store.customerNo,
    status: reasons.length > 0 ? "NEEDS_REVIEW" : "PENDING",
    reviewReason: reasons.length > 0 ? reasons.join("; ") : null,
  });

  if (reasons.length > 0) {
    result.invalid += 1;
  } else {
    result.valid += 1;
  }
}

export async function syncStore(
  store: StoreConfig,
  repository: OrderRepository,
): Promise<SyncResult> {
  const result: SyncResult = { new: 0, valid: 0, invalid: 0 };

  try {
    if (store.type === "SHOPIFY") {
      const rawOrders = await fetchShopifyOrders(store);
      for (const raw of rawOrders) {
        await processOrder(normalizeShopifyOrder(raw), store, repository, result);
      }
    } else {
      const rawOrders = await fetchWooCommerceOrders(store);
      for (const raw of rawOrders) {
        await processOrder(normalizeWooCommerceOrder(raw), store, repository, result);
      }
    }
  } catch (err) {
    return { new: 0, valid: 0, invalid: 0, error: (err as Error).message };
  }

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/user/gls/web && npx vitest run lib/ingest/__tests__/sync.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Run the full test suite**

Run: `cd /home/user/gls/web && npm test`
Expected: PASS (all tests across every file in `web/`, including sub-project 1's tests, address.test.ts, validate.test.ts, and everything under `lib/ingest/__tests__/`)

- [ ] **Step 6: Verify the Next.js project still builds**

Run: `cd /home/user/gls/web && npm run build`
Expected: builds successfully

- [ ] **Step 7: Commit**

```bash
cd /home/user/gls
git add web/lib/ingest/sync.ts web/lib/ingest/__tests__/sync.test.ts
git commit -m "Add syncStore orchestration for order ingestion"
```

---

## Self-Review Notes

- **Spec coverage:** Prisma schema exactly as specified including the `@@unique([storeId, sourceOrderId])` constraint and the full five-value `OrderStatus` enum (Task 1); address-splitting port with all 11 cases from the Python test suite, including both address2 fallback behaviors (Task 2); validation port with all 16 cases and the exact Dutch reason strings (Task 3); shared types matching the spec's `NormalizedOrderInput`/`SyncResult` (Task 4); Shopify fetch with the exact query params and Link-header pagination (Task 5); WooCommerce fetch with `status=processing`, Basic auth header (not query-string), and page-until-empty pagination (Task 6); the full field-mapping table from the spec including the shipping-name-falls-back-to-billing and shipping-has-no-phone-falls-back-to-billing-phone cases (Task 7); `syncStore` with new/skip/invalid/error behavior matching the spec's five-step description (Task 8). The spec's explicitly deferred items (Store creation UI, automation triggering, credential encryption) are intentionally not implemented here.
- **Placeholder scan:** none found — every step has complete, runnable code.
- **Type consistency:** `NormalizedOrderInput`, `StoreConfig`, `OrderRepository`, `OrderRecordInput`, `SyncResult` (Task 4) are used with identical field names/types throughout Tasks 5-8. `splitAddress`'s return shape (`{ street, houseNo }`, Task 2) matches exactly how Task 7's `normalize.ts` destructures it. `checkOrder`'s input shape (Task 3) matches exactly what Task 8's `sync.ts` passes to it.

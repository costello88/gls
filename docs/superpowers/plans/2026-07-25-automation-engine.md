# Automation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard's per-store `automationEnabled` toggle actually do something: a Vercel Cron Job syncs every store every 15 minutes and auto-prints valid orders for automation-enabled stores, plus a dashboard Error tab with manual retry, a clear-all-orders button, and a WooCommerce order-date cutoff.

**Architecture:** A new `runAutomatedSync` function orchestrates the existing, unchanged `syncStore` (sub-project 2) and `printOrder` (sub-project 3) functions — no new label/order logic is written, only a scheduler and a loop around what already exists. A Vercel Cron Job hits a `CRON_SECRET`-protected route on a schedule. Two small, independent additions (Error tab + retry, clear-all-orders) round out the dashboard, plus a one-line fetch-URL change for WooCommerce.

**Tech Stack:** Next.js 16 (App Router), Prisma 6.19.3 + Supabase Postgres, Vercel Cron Jobs, Vitest.

## Global Constraints

- Per the spec (`docs/superpowers/specs/2026-07-25-automation-engine-design.md`): 15-minute cron interval; auto-print fires immediately during the same cycle a valid order syncs in; failed auto-prints stay `ERROR` and are retried automatically on the next cycle (no new retry bookkeeping — this falls out of `listPrintable` including `ERROR` orders); no activity-log UI; WooCommerce cutoff is a fixed constant (`2026-07-24T00:00:00`), not per-store.
- Every new/modified repository-consuming function follows the existing injectable-repository pattern: fake repositories in tests, thin Prisma-backed classes verified via build only.
- Every new route has a `shared.ts` exporting a testable handler function, with a thin `route.ts` wrapper — matching every existing route in this project.
- Dutch UI copy for anything user-facing; Tailwind classes for any new UI (already set up project-wide).
- **Local build verification must use `npx next build`, not `npm run build`** — the latter runs `prisma db push` against the production Supabase database, unreachable from this development sandbox (HTTPS-only outbound network). Vercel's build environment runs the full script correctly on deploy.
- `npm test` (85 tests as of the last full run, before this plan's additions) must keep passing after every task.
- Do not change the behavior of `web/lib/ingest/sync.ts` (`syncStore`), `web/lib/dashboard/orders.ts`'s existing exports (`printOrder`, `listOrders`, `reviewOrder`, `CreateLabelFn`), or `web/lib/repositories/orderRepository.ts` / `storeRepository.ts`'s existing methods — only additive changes are allowed to these files.

---

### Task 1: Extend DashboardOrderRepository with listPrintable and deleteAll

**Files:**
- Modify: `web/lib/dashboard/types.ts`
- Modify: `web/lib/repositories/orderRepository.ts`
- Modify: `web/lib/dashboard/__tests__/orders.test.ts` (fake repository stub methods)
- Modify: `web/app/api/orders/__tests__/route.test.ts` (fake repository stub methods)

**Interfaces:**
- Produces: `DashboardOrderRepository.listPrintable(storeIds: string[]): Promise<OrderRecord[]>` and `DashboardOrderRepository.deleteAll(): Promise<void>` — consumed by Task 3 (`runAutomatedSync`) and Task 6 (`clearOrders`) respectively.

This is an interface-widening change: every class implementing `DashboardOrderRepository` must gain these two methods or the TypeScript build fails. There are three implementers today: `PrismaOrderRepository` (needs real behavior) and two test-only fake classes (need stub bodies for now, since neither existing test file exercises these two methods — later tasks either add dedicated fakes with real behavior, or upgrade these same stubs).

- [ ] **Step 1: Add the two methods to the interface**

In `web/lib/dashboard/types.ts`, find the `DashboardOrderRepository` interface and add two lines before its closing brace:

```typescript
export interface DashboardOrderRepository extends OrderRepository {
  list(filter: OrderFilter): Promise<OrderRecord[]>;
  get(id: string): Promise<OrderRecord | null>;
  update(
    id: string,
    fields: OrderEdits & { status: "PENDING" | "NEEDS_REVIEW"; reviewReason: string | null },
  ): Promise<OrderRecord>;
  markPrinted(id: string, label: string, trackingLink: string): Promise<OrderRecord>;
  markError(id: string, message: string): Promise<OrderRecord>;
  listPrintable(storeIds: string[]): Promise<OrderRecord[]>;
  deleteAll(): Promise<void>;
}
```

- [ ] **Step 2: Implement both methods on PrismaOrderRepository**

In `web/lib/repositories/orderRepository.ts`, add these two methods inside the `PrismaOrderRepository` class (after `markError`):

```typescript
  async listPrintable(storeIds: string[]): Promise<OrderRecord[]> {
    const orders = await prisma.order.findMany({
      where: { storeId: { in: storeIds }, status: { in: ["PENDING", "ERROR"] } },
      orderBy: { createdAt: "desc" },
    });
    return orders.map(toOrderRecord);
  }

  async deleteAll(): Promise<void> {
    await prisma.order.deleteMany({});
  }
```

- [ ] **Step 3: Add stub methods to the existing test fakes so the build compiles**

In `web/lib/dashboard/__tests__/orders.test.ts`, add these two methods to `FakeDashboardOrderRepository` (after `markError`):

```typescript
  async listPrintable(): Promise<OrderRecord[]> {
    throw new Error("not used in these tests");
  }

  async deleteAll(): Promise<void> {
    throw new Error("not used in these tests");
  }
```

In `web/app/api/orders/__tests__/route.test.ts`, add the same two methods to its `FakeDashboardOrderRepository` (after `markError`):

```typescript
  async listPrintable(): Promise<OrderRecord[]> {
    throw new Error("not used");
  }

  async deleteAll(): Promise<void> {
    throw new Error("not used");
  }
```

- [ ] **Step 4: Verify the build**

Run: `cd /home/user/gls/web && npx next build`
Expected: builds successfully (TypeScript now sees both fakes and `PrismaOrderRepository` satisfying the widened interface).

- [ ] **Step 5: Run the existing test suite**

Run: `cd /home/user/gls/web && npm test`
Expected: PASS (85 tests — the stub methods are never called by existing tests, so nothing changes behaviorally).

- [ ] **Step 6: Commit**

```bash
cd /home/user/gls
git add web/lib/dashboard/types.ts web/lib/repositories/orderRepository.ts web/lib/dashboard/__tests__/orders.test.ts web/app/api/orders/__tests__/route.test.ts
git commit -m "Add listPrintable and deleteAll to DashboardOrderRepository"
```

---

### Task 2: WooCommerce order-date cutoff

**Files:**
- Modify: `web/lib/ingest/woocommerce.ts`
- Modify: `web/lib/ingest/__tests__/woocommerce.test.ts`

**Interfaces:** none — this task only changes the URL `fetchWooCommerceOrders` calls, not its signature or return type.

- [ ] **Step 1: Update the failing-first check — read current test expectations**

The existing test file asserts the fetch URL does *not* include a date cutoff. Run it first to confirm the current (pre-change) state:

Run: `cd /home/user/gls/web && npx vitest run lib/ingest/__tests__/woocommerce.test.ts`
Expected: PASS (this is the current behavior, before this task's change).

- [ ] **Step 2: Update the test to expect the cutoff parameter**

In `web/lib/ingest/__tests__/woocommerce.test.ts`, change this line inside the first `it(...)` block:

```typescript
    expect(url).toBe(
      "https://example.com/wp-json/wc/v3/orders?status=processing&per_page=100&page=1",
    );
```

to:

```typescript
    expect(url).toBe(
      "https://example.com/wp-json/wc/v3/orders?status=processing&per_page=100&page=1&after=2026-07-24T00:00:00",
    );
```

- [ ] **Step 3: Run the test to verify it now fails**

Run: `cd /home/user/gls/web && npx vitest run lib/ingest/__tests__/woocommerce.test.ts`
Expected: FAIL — the actual URL doesn't include `&after=...` yet.

- [ ] **Step 4: Add the cutoff constant and use it in the fetch URL**

In `web/lib/ingest/woocommerce.ts`, add the constant near the top of the file (after the imports/type declarations, before `fetchWooCommerceOrders`):

```typescript
const WOOCOMMERCE_ORDERS_AFTER = "2026-07-24T00:00:00";
```

Then change the URL construction inside `fetchWooCommerceOrders` from:

```typescript
    const url = `${store.siteUrl}/wp-json/wc/v3/orders?status=processing&per_page=100&page=${page}`;
```

to:

```typescript
    const url = `${store.siteUrl}/wp-json/wc/v3/orders?status=processing&per_page=100&page=${page}&after=${WOOCOMMERCE_ORDERS_AFTER}`;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd /home/user/gls/web && npx vitest run lib/ingest/__tests__/woocommerce.test.ts`
Expected: PASS (both tests in the file — the second test only checks `page=2`/`page=3` via `toContain`, which still matches).

- [ ] **Step 6: Run the full test suite**

Run: `cd /home/user/gls/web && npm test`
Expected: PASS (85 tests).

- [ ] **Step 7: Commit**

```bash
cd /home/user/gls
git add web/lib/ingest/woocommerce.ts web/lib/ingest/__tests__/woocommerce.test.ts
git commit -m "Filter WooCommerce order sync to orders created on or after 2026-07-24"
```

---

### Task 3: Shared store-config mapping + automation core logic

**Files:**
- Create: `web/lib/dashboard/storeConfig.ts`
- Modify: `web/app/api/sync/shared.ts` (use the extracted helper instead of its inline mapping)
- Create: `web/lib/automation/run.ts`
- Create: `web/lib/automation/__tests__/run.test.ts`

**Interfaces:**
- Consumes: `syncStore` from `web/lib/ingest/sync.ts` (unchanged); `printOrder`, `CreateLabelFn` from `web/lib/dashboard/orders.ts` (unchanged); `StoreRepository`, `StoreRecord`, `DashboardOrderRepository` from `web/lib/dashboard/types.ts`; `StoreConfig`, `SyncResult` from `web/lib/ingest/types.ts`.
- Produces: `toStoreConfig(store: StoreRecord): StoreConfig` (used by Task 4 is not needed directly, but keeps `sync/shared.ts` and `automation/run.ts` from duplicating this mapping); `runAutomatedSync(storeRepo: StoreRepository, orderRepo: DashboardOrderRepository, createLabelFn: CreateLabelFn): Promise<AutomationStoreResult[]>` and the `AutomationStoreResult` type — consumed by Task 5 (cron route).

- [ ] **Step 1: Extract the store-config mapping into a shared helper**

`web/lib/dashboard/storeConfig.ts`:
```typescript
import type { StoreConfig } from "../ingest/types";
import type { StoreRecord } from "./types";

export function toStoreConfig(store: StoreRecord): StoreConfig {
  return store.type === "SHOPIFY"
    ? {
        id: store.id,
        type: "SHOPIFY",
        defaultWeightKg: store.defaultWeightKg,
        customerNo: store.customerNo,
        shopDomain: store.shopDomain ?? "",
        shopifyAccessToken: store.shopifyAccessToken ?? "",
      }
    : {
        id: store.id,
        type: "WOOCOMMERCE",
        defaultWeightKg: store.defaultWeightKg,
        customerNo: store.customerNo,
        siteUrl: store.siteUrl ?? "",
        wooConsumerKey: store.wooConsumerKey ?? "",
        wooConsumerSecret: store.wooConsumerSecret ?? "",
      };
}
```

- [ ] **Step 2: Update the sync route to use the shared helper instead of its inline mapping**

Replace the full contents of `web/app/api/sync/shared.ts` with:

```typescript
import { NextResponse } from "next/server";
import { syncStore } from "../../../lib/ingest/sync";
import { toStoreConfig } from "../../../lib/dashboard/storeConfig";
import type { OrderRepository, SyncResult } from "../../../lib/ingest/types";
import type { StoreRepository } from "../../../lib/dashboard/types";

export async function handleSync(
  storeRepo: StoreRepository,
  orderRepo: OrderRepository,
): Promise<Response> {
  const stores = await storeRepo.list();
  const results: Record<string, SyncResult> = {};

  for (const store of stores) {
    results[store.id] = await syncStore(toStoreConfig(store), orderRepo);
  }

  return NextResponse.json({ results });
}
```

- [ ] **Step 3: Verify the existing sync route test still passes unchanged**

Run: `cd /home/user/gls/web && npx vitest run app/api/sync/__tests__/route.test.ts`
Expected: PASS (1 test — this route's test mocks `syncStore` and asserts on its call count/results, which the refactor doesn't change).

- [ ] **Step 4: Write the failing test for runAutomatedSync**

`web/lib/automation/__tests__/run.test.ts`:
```typescript
import { describe, expect, it, vi } from "vitest";

vi.mock("../../ingest/sync", () => ({
  syncStore: vi.fn(),
}));

import { syncStore } from "../../ingest/sync";
import { runAutomatedSync } from "../run";
import type { DashboardOrderRepository, OrderFilter, OrderRecord, StoreRecord, StoreRepository } from "../../dashboard/types";

const mockedSyncStore = vi.mocked(syncStore);

class FakeStoreRepository implements StoreRepository {
  constructor(private stores: StoreRecord[]) {}

  async list(): Promise<StoreRecord[]> {
    return this.stores;
  }

  async get(id: string): Promise<StoreRecord | null> {
    return this.stores.find((s) => s.id === id) ?? null;
  }

  async create(): Promise<StoreRecord> {
    throw new Error("not used");
  }

  async update(): Promise<StoreRecord> {
    throw new Error("not used");
  }
}

function makeOrderRecord(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id: "order-1",
    storeId: "store-1",
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
    weightKg: 1.5,
    customerNo: "11850079",
    status: "PENDING",
    reviewReason: null,
    label: null,
    trackingLink: null,
    ...overrides,
  };
}

class FakeAutomationOrderRepository implements DashboardOrderRepository {
  private orders = new Map<string, OrderRecord>();

  seed(order: OrderRecord) {
    this.orders.set(order.id, order);
  }

  async exists(): Promise<boolean> {
    throw new Error("not used");
  }

  async create(): Promise<void> {
    throw new Error("not used");
  }

  async list(filter: OrderFilter): Promise<OrderRecord[]> {
    return [...this.orders.values()].filter(
      (order) => !filter.status || order.status === filter.status,
    );
  }

  async get(id: string): Promise<OrderRecord | null> {
    return this.orders.get(id) ?? null;
  }

  async update(id: string, fields: Partial<OrderRecord>): Promise<OrderRecord> {
    const existing = this.orders.get(id);
    if (!existing) throw new Error(`Order ${id} not found`);
    const updated = { ...existing, ...fields };
    this.orders.set(id, updated);
    return updated;
  }

  async markPrinted(id: string, label: string, trackingLink: string): Promise<OrderRecord> {
    return this.update(id, { status: "PRINTED", label, trackingLink });
  }

  async markError(id: string, message: string): Promise<OrderRecord> {
    return this.update(id, { status: "ERROR", reviewReason: message });
  }

  async listPrintable(storeIds: string[]): Promise<OrderRecord[]> {
    return [...this.orders.values()].filter(
      (order) =>
        storeIds.includes(order.storeId) && (order.status === "PENDING" || order.status === "ERROR"),
    );
  }

  async deleteAll(): Promise<void> {
    this.orders.clear();
  }
}

const automatedStore: StoreRecord = {
  id: "store-1",
  type: "SHOPIFY",
  name: "Revitalash",
  automationEnabled: true,
  customerNo: "11850079",
  defaultWeightKg: 1.0,
  shopDomain: "revitalash.myshopify.com",
  shopifyAccessToken: "shpat_test",
  siteUrl: null,
  wooConsumerKey: null,
  wooConsumerSecret: null,
};

const manualStore: StoreRecord = {
  ...automatedStore,
  id: "store-2",
  name: "Manual Store",
  automationEnabled: false,
};

describe("runAutomatedSync", () => {
  it("syncs every store and only auto-prints for automation-enabled stores", async () => {
    mockedSyncStore.mockResolvedValue({ new: 1, valid: 1, invalid: 0 });

    const storeRepo = new FakeStoreRepository([automatedStore, manualStore]);
    const orderRepo = new FakeAutomationOrderRepository();
    orderRepo.seed(makeOrderRecord({ id: "auto-order", storeId: "store-1", status: "PENDING" }));
    orderRepo.seed(makeOrderRecord({ id: "manual-order", storeId: "store-2", status: "PENDING" }));

    const createLabelFn = vi.fn().mockResolvedValue({
      label: "base64-label",
      trackingLink: "https://track.gls/1",
      unitTrackingLink: "https://track.gls/unit-1",
      transactionId: "txn-1",
    });

    const results = await runAutomatedSync(storeRepo, orderRepo, createLabelFn);

    expect(mockedSyncStore).toHaveBeenCalledTimes(2);
    expect(createLabelFn).toHaveBeenCalledTimes(1);

    const autoResult = results.find((r) => r.storeId === "store-1");
    expect(autoResult?.printed).toBe(1);
    expect(autoResult?.failed).toBe(0);
    expect((await orderRepo.get("auto-order"))?.status).toBe("PRINTED");
    expect((await orderRepo.get("manual-order"))?.status).toBe("PENDING");
  });

  it("counts failed auto-prints and leaves the order in ERROR for the next cycle to retry", async () => {
    mockedSyncStore.mockResolvedValue({ new: 0, valid: 0, invalid: 0 });

    const storeRepo = new FakeStoreRepository([automatedStore]);
    const orderRepo = new FakeAutomationOrderRepository();
    orderRepo.seed(makeOrderRecord({ id: "failing-order", storeId: "store-1", status: "ERROR" }));

    const createLabelFn = vi.fn().mockRejectedValue(new Error("GLS unavailable"));

    const results = await runAutomatedSync(storeRepo, orderRepo, createLabelFn);

    const result = results.find((r) => r.storeId === "store-1");
    expect(result?.printed).toBe(0);
    expect(result?.failed).toBe(1);
    expect((await orderRepo.get("failing-order"))?.status).toBe("ERROR");
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `cd /home/user/gls/web && npx vitest run lib/automation/__tests__/run.test.ts`
Expected: FAIL with "Cannot find module '../run'"

- [ ] **Step 6: Write runAutomatedSync**

`web/lib/automation/run.ts`:
```typescript
import { syncStore } from "../ingest/sync";
import { printOrder, type CreateLabelFn } from "../dashboard/orders";
import { toStoreConfig } from "../dashboard/storeConfig";
import type { DashboardOrderRepository, StoreRepository } from "../dashboard/types";
import type { SyncResult } from "../ingest/types";

export interface AutomationStoreResult {
  storeId: string;
  sync: SyncResult;
  printed: number;
  failed: number;
}

export async function runAutomatedSync(
  storeRepo: StoreRepository,
  orderRepo: DashboardOrderRepository,
  createLabelFn: CreateLabelFn,
): Promise<AutomationStoreResult[]> {
  const stores = await storeRepo.list();
  const results: AutomationStoreResult[] = [];

  for (const store of stores) {
    const sync = await syncStore(toStoreConfig(store), orderRepo);
    results.push({ storeId: store.id, sync, printed: 0, failed: 0 });
  }

  const automatedStoreIds = stores.filter((store) => store.automationEnabled).map((store) => store.id);

  if (automatedStoreIds.length > 0) {
    const printable = await orderRepo.listPrintable(automatedStoreIds);
    for (const order of printable) {
      const result = results.find((r) => r.storeId === order.storeId);
      if (!result) continue;
      try {
        await printOrder(orderRepo, order.id, createLabelFn);
        result.printed += 1;
      } catch {
        result.failed += 1;
      }
    }
  }

  return results;
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd /home/user/gls/web && npx vitest run lib/automation/__tests__/run.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 8: Run the full test suite and verify the build**

Run: `cd /home/user/gls/web && npm test`
Expected: PASS (all tests, existing suite plus the 2 new ones).

Run: `cd /home/user/gls/web && npx next build`
Expected: builds successfully.

- [ ] **Step 9: Commit**

```bash
cd /home/user/gls
git add web/lib/dashboard/storeConfig.ts web/app/api/sync/shared.ts web/lib/automation
git commit -m "Add runAutomatedSync, reusing syncStore and printOrder"
```

---

### Task 4: Cron route, middleware bypass, and vercel.json

**Files:**
- Create: `web/app/api/cron/sync/shared.ts`
- Create: `web/app/api/cron/sync/route.ts`
- Create: `web/app/api/cron/sync/__tests__/route.test.ts`
- Modify: `web/middleware.ts`
- Create: `web/vercel.json`

**Interfaces:**
- Consumes: `runAutomatedSync`, `AutomationStoreResult` from Task 3; `CreateLabelFn` from `web/lib/dashboard/orders.ts`; `PrismaOrderRepository`, `PrismaStoreRepository` (unchanged, sub-project 3).
- Produces: `handleCronSync(request, storeRepo, orderRepo, createLabelFn)`; `GET` export for `/api/cron/sync`.

- [ ] **Step 1: Write the failing cron route test**

`web/app/api/cron/sync/__tests__/route.test.ts`:
```typescript
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../lib/automation/run", () => ({
  runAutomatedSync: vi.fn(),
}));

import { runAutomatedSync } from "../../../../lib/automation/run";
import { handleCronSync } from "../shared";

const mockedRunAutomatedSync = vi.mocked(runAutomatedSync);

describe("handleCronSync", () => {
  const originalSecret = process.env.CRON_SECRET;

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  it("returns 401 when the Authorization header doesn't match CRON_SECRET", async () => {
    process.env.CRON_SECRET = "test-secret";
    const request = new Request("https://example.com/api/cron/sync", {
      headers: { Authorization: "Bearer wrong" },
    });

    const response = await handleCronSync(request, {} as any, {} as any, vi.fn());

    expect(response.status).toBe(401);
    expect(mockedRunAutomatedSync).not.toHaveBeenCalled();
  });

  it("runs automation and returns results when the secret matches", async () => {
    process.env.CRON_SECRET = "test-secret";
    mockedRunAutomatedSync.mockResolvedValue([
      { storeId: "store-1", sync: { new: 1, valid: 1, invalid: 0 }, printed: 1, failed: 0 },
    ]);
    const request = new Request("https://example.com/api/cron/sync", {
      headers: { Authorization: "Bearer test-secret" },
    });

    const response = await handleCronSync(request, {} as any, {} as any, vi.fn());
    const body = (await response.json()) as { results: unknown[] };

    expect(response.status).toBe(200);
    expect(body.results).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /home/user/gls/web && npx vitest run app/api/cron/sync/__tests__/route.test.ts`
Expected: FAIL with "Cannot find module '../shared'"

- [ ] **Step 3: Write the shared cron handler**

`web/app/api/cron/sync/shared.ts`:
```typescript
import { NextResponse } from "next/server";
import { runAutomatedSync } from "../../../../lib/automation/run";
import type { CreateLabelFn } from "../../../../lib/dashboard/orders";
import type { DashboardOrderRepository, StoreRepository } from "../../../../lib/dashboard/types";

export async function handleCronSync(
  request: Request,
  storeRepo: StoreRepository,
  orderRepo: DashboardOrderRepository,
  createLabelFn: CreateLabelFn,
): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await runAutomatedSync(storeRepo, orderRepo, createLabelFn);
  return NextResponse.json({ results });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /home/user/gls/web && npx vitest run app/api/cron/sync/__tests__/route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the thin route**

`web/app/api/cron/sync/route.ts`:
```typescript
import { createGlsLabel } from "../../../../lib/gls/createLabel";
import { PrismaOrderRepository } from "../../../../lib/repositories/orderRepository";
import { PrismaStoreRepository } from "../../../../lib/repositories/storeRepository";
import { handleCronSync } from "./shared";

const storeRepository = new PrismaStoreRepository();
const orderRepository = new PrismaOrderRepository();

export async function GET(request: Request): Promise<Response> {
  return handleCronSync(request, storeRepository, orderRepository, createGlsLabel);
}
```

- [ ] **Step 6: Bypass the login middleware for this route**

In `web/middleware.ts`, change the bypass condition from:

```typescript
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth/login")) {
    return NextResponse.next();
  }
```

to:

```typescript
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/cron")
  ) {
    return NextResponse.next();
  }
```

- [ ] **Step 7: Add the Vercel Cron configuration**

`web/vercel.json`:
```json
{
  "crons": [{ "path": "/api/cron/sync", "schedule": "*/15 * * * *" }]
}
```

- [ ] **Step 8: Run the full test suite and verify the build**

Run: `cd /home/user/gls/web && npm test`
Expected: PASS (all tests).

Run: `cd /home/user/gls/web && npx next build`
Expected: builds successfully, `/api/cron/sync` listed as a new dynamic route.

- [ ] **Step 9: Commit**

```bash
cd /home/user/gls
git add web/app/api/cron web/middleware.ts web/vercel.json web/__tests__/middleware.test.ts
git commit -m "Add CRON_SECRET-protected cron route for scheduled automation"
```

Note: `git add` includes `web/__tests__/middleware.test.ts` in case Step 6's change requires updating existing middleware test assertions — check that file after Step 6; if its existing tests already pass unmodified (they likely do, since they test the `/login` bypass and cookie-gated redirect behavior, not `/api/cron`), no edit is needed and this file simply won't show as changed in `git status`.

---

### Task 5: Dashboard Error tab with retry

**Files:**
- Modify: `web/app/page.tsx`

**Interfaces:** none new — reuses the existing `PrintButton` and `StatusBadge` components unchanged.

- [ ] **Step 1: Add the Error tab and show PrintButton for ERROR-status orders**

In `web/app/page.tsx`, change the `TABS` array from:

```typescript
const TABS: { label: string; status: OrderRecordStatus }[] = [
  { label: "Klaar om te printen", status: "PENDING" },
  { label: "Moet gecontroleerd worden", status: "NEEDS_REVIEW" },
  { label: "Geprint", status: "PRINTED" },
];
```

to:

```typescript
const TABS: { label: string; status: OrderRecordStatus }[] = [
  { label: "Klaar om te printen", status: "PENDING" },
  { label: "Moet gecontroleerd worden", status: "NEEDS_REVIEW" },
  { label: "Geprint", status: "PRINTED" },
  { label: "Fout", status: "ERROR" },
];
```

Then change the row-actions cell from:

```tsx
                <td className="px-4 py-3 text-right">
                  {order.status === "NEEDS_REVIEW" && (
                    <Link
                      href={`/bestellingen/${order.id}`}
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      Bekijken
                    </Link>
                  )}
                  {order.status === "PENDING" && <PrintButton orderId={order.id} />}
                </td>
```

to:

```tsx
                <td className="px-4 py-3 text-right">
                  {order.status === "NEEDS_REVIEW" && (
                    <Link
                      href={`/bestellingen/${order.id}`}
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      Bekijken
                    </Link>
                  )}
                  {(order.status === "PENDING" || order.status === "ERROR") && (
                    <PrintButton orderId={order.id} />
                  )}
                </td>
```

- [ ] **Step 2: Verify the build**

Run: `cd /home/user/gls/web && npx next build`
Expected: builds successfully.

- [ ] **Step 3: Run the existing test suite**

Run: `cd /home/user/gls/web && npm test`
Expected: PASS (no test file covers this page, per the project's established pattern of build-verified-only pages).

- [ ] **Step 4: Commit**

```bash
cd /home/user/gls
git add web/app/page.tsx
git commit -m "Add Fout (error) tab with manual retry-print to the dashboard"
```

---

### Task 6: Clear all orders

**Files:**
- Modify: `web/lib/dashboard/orders.ts`
- Modify: `web/lib/dashboard/__tests__/orders.test.ts` (add `clearOrders` test, upgrade the fake's `deleteAll` stub to a real implementation)
- Modify: `web/app/api/orders/shared.ts`
- Modify: `web/app/api/orders/__tests__/route.test.ts` (add `handleClearOrders` test, upgrade the fake's `deleteAll` stub to a real implementation)
- Modify: `web/app/api/orders/route.ts`
- Create: `web/app/ClearOrdersButton.tsx`
- Modify: `web/app/page.tsx`

**Interfaces:**
- Produces: `clearOrders(repo: DashboardOrderRepository): Promise<void>`; `handleClearOrders(repo: DashboardOrderRepository): Promise<Response>`; `DELETE` export for `/api/orders`.

- [ ] **Step 1: Write the failing test for clearOrders**

In `web/lib/dashboard/__tests__/orders.test.ts`, add this import to the top (alongside the existing `listOrders, printOrder, reviewOrder` import):

```typescript
import { clearOrders, listOrders, printOrder, reviewOrder } from "../orders";
```

Then upgrade the fake's `deleteAll` stub (added in Task 1) from a throwing stub to a real implementation — find:

```typescript
  async deleteAll(): Promise<void> {
    throw new Error("not used in these tests");
  }
```

and replace it with:

```typescript
  async deleteAll(): Promise<void> {
    this.orders.clear();
  }
```

Then add this new `describe` block at the end of the file:

```typescript
describe("clearOrders", () => {
  it("deletes every order", async () => {
    const repo = new FakeDashboardOrderRepository();
    repo.seed(makeOrderRecord({ id: "1", status: "PENDING" }));
    repo.seed(makeOrderRecord({ id: "2", status: "PRINTED" }));

    await clearOrders(repo);

    expect(await listOrders(repo, {})).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /home/user/gls/web && npx vitest run lib/dashboard/__tests__/orders.test.ts`
Expected: FAIL with "clearOrders is not a function" (or a module-export error, since `clearOrders` doesn't exist yet in `../orders`).

- [ ] **Step 3: Write clearOrders**

In `web/lib/dashboard/orders.ts`, add this function at the end of the file:

```typescript
export async function clearOrders(repo: DashboardOrderRepository): Promise<void> {
  await repo.deleteAll();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /home/user/gls/web && npx vitest run lib/dashboard/__tests__/orders.test.ts`
Expected: PASS (all tests in this file, including the new one).

- [ ] **Step 5: Write the failing test for handleClearOrders**

In `web/app/api/orders/__tests__/route.test.ts`, add this import to the top (alongside the existing `handleListOrders, handlePrintOrder, handleReviewOrder` import):

```typescript
import { handleClearOrders, handleListOrders, handlePrintOrder, handleReviewOrder } from "../shared";
```

Then upgrade this file's fake `deleteAll` stub (added in Task 1) the same way — find:

```typescript
  async deleteAll(): Promise<void> {
    throw new Error("not used");
  }
```

and replace it with:

```typescript
  async deleteAll(): Promise<void> {
    this.orders.clear();
  }
```

Then add this new `describe` block at the end of the file:

```typescript
describe("handleClearOrders", () => {
  it("deletes every order and returns ok", async () => {
    const repo = new FakeDashboardOrderRepository();
    repo.seed(makeOrderRecord({ id: "1" }));

    const response = await handleClearOrders(repo);
    const body = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(await repo.list({})).toHaveLength(0);
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `cd /home/user/gls/web && npx vitest run app/api/orders/__tests__/route.test.ts`
Expected: FAIL — `handleClearOrders` doesn't exist yet in `../shared`.

- [ ] **Step 7: Write handleClearOrders**

In `web/app/api/orders/shared.ts`, change the import line from:

```typescript
import { listOrders, printOrder, reviewOrder, type CreateLabelFn } from "../../../lib/dashboard/orders";
```

to:

```typescript
import { clearOrders, listOrders, printOrder, reviewOrder, type CreateLabelFn } from "../../../lib/dashboard/orders";
```

Then add this function at the end of the file:

```typescript
export async function handleClearOrders(repo: DashboardOrderRepository): Promise<Response> {
  await clearOrders(repo);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `cd /home/user/gls/web && npx vitest run app/api/orders/__tests__/route.test.ts`
Expected: PASS (all tests in this file, including the new one).

- [ ] **Step 9: Add the DELETE route export**

In `web/app/api/orders/route.ts`, change the import from:

```typescript
import { handleListOrders } from "./shared";
```

to:

```typescript
import { handleClearOrders, handleListOrders } from "./shared";
```

Then add this export at the end of the file:

```typescript
export async function DELETE(): Promise<Response> {
  return handleClearOrders(repository);
}
```

- [ ] **Step 10: Write the ClearOrdersButton client component**

`web/app/ClearOrdersButton.tsx`:
```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ClearOrdersButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    const confirmed = window.confirm(
      "Weet je zeker dat je alle bestellingen wilt verwijderen? Dit kan niet ongedaan worden gemaakt.",
    );
    if (!confirmed) {
      return;
    }
    setLoading(true);
    await fetch("/api/orders", { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Bezig..." : "Wis alles"}
    </button>
  );
}
```

- [ ] **Step 11: Wire the button into the dashboard page**

In `web/app/page.tsx`, add the import (alongside the existing `SyncButton`/`PrintButton` imports):

```typescript
import { ClearOrdersButton } from "./ClearOrdersButton";
```

Then change:

```tsx
        <SyncButton />
      </div>
```

to:

```tsx
        <div className="flex items-center gap-2">
          <SyncButton />
          <ClearOrdersButton />
        </div>
      </div>
```

- [ ] **Step 12: Run the full test suite and verify the build**

Run: `cd /home/user/gls/web && npm test`
Expected: PASS (all tests).

Run: `cd /home/user/gls/web && npx next build`
Expected: builds successfully.

- [ ] **Step 13: Commit**

```bash
cd /home/user/gls
git add web/lib/dashboard/orders.ts web/lib/dashboard/__tests__/orders.test.ts web/app/api/orders/shared.ts web/app/api/orders/__tests__/route.test.ts web/app/api/orders/route.ts web/app/ClearOrdersButton.tsx web/app/page.tsx
git commit -m "Add clear-all-orders button with confirmation"
```

---

### Task 7: Final verification and push

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `cd /home/user/gls/web && npm test`
Expected: PASS (85 existing tests + this plan's additions: 2 in `lib/automation/__tests__/run.test.ts`, 2 in `app/api/cron/sync/__tests__/route.test.ts`, 1 in `lib/dashboard/__tests__/orders.test.ts`, 1 in `app/api/orders/__tests__/route.test.ts`).

- [ ] **Step 2: Verify the build one more time**

Run: `cd /home/user/gls/web && npx next build`
Expected: builds successfully. Route list now includes `/api/cron/sync` and shows `/api/orders` still handling multiple methods (GET, PATCH is on `/api/orders/[id]`, DELETE on `/api/orders`).

- [ ] **Step 3: Push to trigger the Vercel deploy**

```bash
cd /home/user/gls
git push origin claude/shopify-gls-automation-9db5j4
```

Expected: push succeeds. Vercel auto-deploys this branch.

- [ ] **Step 4: Add CRON_SECRET to Vercel (manual, outside this repo)**

After the deploy succeeds, a new environment variable must be added in Vercel's project settings before automation actually starts running: `CRON_SECRET`, any random string (same idea as `SESSION_SECRET` and `DATABASE_URL` before it), checked for Production. Vercel automatically sends this same value as `Authorization: Bearer <value>` on its own cron requests to `/api/cron/sync` — no other wiring needed. This step is a deploy-time action for the user, not a code change, so it isn't part of the git history for this plan.

---

## Self-Review Notes

- **Spec coverage:** Vercel Cron config + `CRON_SECRET` auth (Task 4); `runAutomatedSync` reusing `syncStore`/`printOrder` unchanged (Task 3); `listPrintable`/`deleteAll` on `DashboardOrderRepository` (Task 1); Error tab + retry (Task 5); clear-all-orders button (Task 6); WooCommerce cutoff (Task 2). Every section of `docs/superpowers/specs/2026-07-25-automation-engine-design.md` maps to a task.
- **Placeholder scan:** none found — every step has complete, runnable code and exact file paths/commands.
- **Type consistency:** `AutomationStoreResult`, `runAutomatedSync`'s signature (Task 3) match exactly how Task 4's `handleCronSync` calls it. `DashboardOrderRepository.listPrintable`/`deleteAll` (Task 1) are implemented identically in `PrismaOrderRepository` (Task 1), the automation test's dedicated fake (Task 3), and the two existing test files' fakes (Task 1 stubs, upgraded to real bodies where needed in Task 6). `toStoreConfig` (Task 3) is used identically by both `sync/shared.ts` and `automation/run.ts` — no duplicate mapping logic left behind.

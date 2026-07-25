# Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A shared-password-protected Next.js dashboard where coworkers can trigger order syncs, review and fix flagged orders, and print GLS labels with one click.

**Architecture:** Signed-cookie auth gate (`middleware.ts`) in front of everything except `/login`. Business logic lives in plain, injectable-repository functions (`web/lib/dashboard/orders.ts`, `stores.ts`) tested entirely with fakes — no real database in any test. Thin Prisma-backed repository classes wire those functions to a real Neon database at request time. Next.js API routes are thin wrappers around exported, directly-testable handler functions. Pages are Server Components for reads, with small Client Components handling mutations via `fetch` to the API routes.

**Tech Stack:** Next.js 16 (App Router, async route params), TypeScript, Vitest, Prisma 6.19.3 (pinned — Prisma 7 needs a driver-adapter config rework not used here).

## Global Constraints

- Nothing in `web/lib/gls/` (sub-project 1) or `web/lib/{address,validate}.ts` / `web/lib/ingest/*` (sub-project 2) is modified, except the additive schema change described below.
- `DASHBOARD_PASSWORD` and `SESSION_SECRET` are read only from environment variables, server-side only.
- No real database or network calls in any test — Prisma-backed classes are thin and unit-tested only through the plain functions built on top of them, using fakes.
- Next.js 16 route handlers with dynamic segments use async params: `{ params }: { params: Promise<{ id: string }> }`, then `const { id } = await params;`.
- All Dutch-language UI strings match the tone already used elsewhere (`Bestellingen ophalen`, `Bekijken`, `Printen`, `Opslaan`, `Instellingen`).

---

## File Structure

```
web/
    prisma/
        schema.prisma              # MODIFIED: Order gains label/trackingLink columns
    middleware.ts                    # session cookie gate
    lib/
        session.ts                    # sign/verify session cookie
        db.ts                          # shared PrismaClient instance
        __tests__/
            session.test.ts
        dashboard/
            types.ts                    # DashboardOrderRepository, StoreRepository, records/inputs
            orders.ts                    # listOrders/reviewOrder/printOrder
            stores.ts                     # listStores/createStore/updateStore
            __tests__/
                orders.test.ts
                stores.test.ts
        repositories/
            orderRepository.ts             # PrismaOrderRepository
            storeRepository.ts              # PrismaStoreRepository
    __tests__/
        middleware.test.ts
    app/
        login/
            page.tsx                        # login form (Client Component)
        page.tsx                              # MODIFIED: order list dashboard (was sub-project 1 placeholder)
        bestellingen/
            [id]/
                page.tsx                          # review/edit page
                ReviewForm.tsx                      # Client Component form
        instellingen/
            page.tsx                              # store settings page
            StoreForm.tsx                            # Client Component form
        api/
            auth/
                login/route.ts
                logout/route.ts
                __tests__/
                    login.test.ts
            orders/
                route.ts                              # GET (list)
                [id]/
                    route.ts                             # PATCH (review)
                    print/
                        route.ts                            # POST (print)
                __tests__/
                    route.test.ts
            stores/
                route.ts                              # GET/POST (list/create)
                [id]/
                    route.ts                             # PATCH (update)
                __tests__/
                    route.test.ts
            sync/
                route.ts                              # POST (sync every store)
                __tests__/
                    route.test.ts
```

---

### Task 1: Session/auth — signed cookie, middleware, login route + page

**Files:**
- Create: `web/lib/session.ts`
- Create: `web/lib/__tests__/session.test.ts`
- Create: `web/middleware.ts`
- Create: `web/__tests__/middleware.test.ts`
- Create: `web/app/api/auth/login/route.ts`
- Create: `web/app/api/auth/logout/route.ts`
- Create: `web/app/api/auth/login/__tests__/login.test.ts`
- Create: `web/app/login/page.tsx`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `COOKIE_NAME`, `createSessionCookieValue(): string`, `isValidSessionCookie(value: string | undefined): boolean` from `web/lib/session.ts` — used by every later task that needs auth (none of the later tasks in this plan directly do, but this gates all routes via `middleware.ts`).

- [ ] **Step 1: Write the failing session tests**

`web/lib/__tests__/session.test.ts`:
```typescript
import { beforeEach, describe, expect, it } from "vitest";
import { COOKIE_NAME, createSessionCookieValue, isValidSessionCookie } from "../session";

describe("session", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-secret";
  });

  it("exports a cookie name", () => {
    expect(COOKIE_NAME).toBe("gls_session");
  });

  it("validates a freshly created session cookie", () => {
    const value = createSessionCookieValue();
    expect(isValidSessionCookie(value)).toBe(true);
  });

  it("rejects an undefined cookie", () => {
    expect(isValidSessionCookie(undefined)).toBe(false);
  });

  it("rejects a garbage cookie", () => {
    expect(isValidSessionCookie("not-a-real-cookie")).toBe(false);
  });

  it("rejects a tampered cookie", () => {
    const value = createSessionCookieValue();
    const tampered = value.slice(0, -1) + (value.endsWith("a") ? "b" : "a");
    expect(isValidSessionCookie(tampered)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/user/gls/web && npx vitest run lib/__tests__/session.test.ts`
Expected: FAIL with "Cannot find module '../session'"

- [ ] **Step 3: Write session.ts**

`web/lib/session.ts`:
```typescript
import crypto from "crypto";

export const COOKIE_NAME = "gls_session";
const SESSION_VALUE = "authenticated";

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  return secret;
}

function sign(value: string): string {
  const hmac = crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
  return `${value}.${hmac}`;
}

export function createSessionCookieValue(): string {
  return sign(SESSION_VALUE);
}

export function isValidSessionCookie(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const parts = value.split(".");
  if (parts.length !== 2) {
    return false;
  }
  const [payload, signature] = parts;
  if (payload !== SESSION_VALUE) {
    return false;
  }
  const expected = sign(payload).split(".")[1];
  if (signature.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/user/gls/web && npx vitest run lib/__tests__/session.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Write the failing middleware tests**

`web/__tests__/middleware.test.ts`:
```typescript
import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import { COOKIE_NAME, createSessionCookieValue } from "../lib/session";

describe("middleware", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-secret";
  });

  it("redirects to /login when no session cookie is present", () => {
    const request = new NextRequest("https://example.com/");
    const response = middleware(request);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("allows /login through without a cookie", () => {
    const request = new NextRequest("https://example.com/login");
    const response = middleware(request);
    expect(response.headers.get("location")).toBeNull();
  });

  it("allows the request through with a valid session cookie", () => {
    const request = new NextRequest("https://example.com/", {
      headers: { cookie: `${COOKIE_NAME}=${createSessionCookieValue()}` },
    });
    const response = middleware(request);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects when the session cookie is invalid", () => {
    const request = new NextRequest("https://example.com/", {
      headers: { cookie: `${COOKIE_NAME}=garbage` },
    });
    const response = middleware(request);
    expect(response.headers.get("location")).toContain("/login");
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd /home/user/gls/web && npx vitest run __tests__/middleware.test.ts`
Expected: FAIL with "Cannot find module '../middleware'"

- [ ] **Step 7: Write middleware.ts**

`web/middleware.ts`:
```typescript
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, isValidSessionCookie } from "./lib/session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth/login")) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(COOKIE_NAME)?.value;
  if (!isValidSessionCookie(cookie)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd /home/user/gls/web && npx vitest run __tests__/middleware.test.ts`
Expected: PASS (4 tests). If `NextRequest`/`NextResponse` behave differently in this Next.js version than expected (e.g. a different way to read `location`), adjust the assertions to read the actual redirect target from the response (`response.status` of 307 plus the `Location` header is the standard shape) rather than changing `middleware.ts`'s logic.

- [ ] **Step 9: Write the login route and its test**

`web/app/api/auth/login/__tests__/login.test.ts`:
```typescript
import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "../route";

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-secret";
    process.env.DASHBOARD_PASSWORD = "correct-password";
  });

  it("rejects the wrong password", async () => {
    const request = new Request("https://example.com/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password: "wrong" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("accepts the correct password and sets a session cookie", async () => {
    const request = new Request("https://example.com/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password: "correct-password" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("gls_session=");
  });
});
```

`web/app/api/auth/login/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { COOKIE_NAME, createSessionCookieValue } from "../../../../lib/session";

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as { password?: string };

  if (body.password !== process.env.DASHBOARD_PASSWORD) {
    return NextResponse.json({ error: "Ongeldig wachtwoord" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, createSessionCookieValue(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
```

`web/app/api/auth/logout/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { COOKIE_NAME } from "../../../../lib/session";

export async function POST(): Promise<Response> {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return response;
}
```

- [ ] **Step 10: Run the login test**

Run: `cd /home/user/gls/web && npx vitest run app/api/auth/login/__tests__/login.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 11: Write the login page**

`web/app/login/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    if (!response.ok) {
      setError("Ongeldig wachtwoord");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main style={{ maxWidth: 320, margin: "80px auto", fontFamily: "sans-serif" }}>
      <h1>GLS Sync</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Wachtwoord
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ display: "block", width: "100%", marginTop: 4, marginBottom: 12 }}
          />
        </label>
        <button type="submit">Inloggen</button>
        {error && <p style={{ color: "red" }}>{error}</p>}
      </form>
    </main>
  );
}
```

- [ ] **Step 12: Commit**

```bash
cd /home/user/gls
git add web/lib/session.ts web/lib/__tests__/session.test.ts web/middleware.ts web/__tests__/middleware.test.ts web/app/api/auth web/app/login
git commit -m "Add session auth, middleware gate, login route and page"
```

---

### Task 2: Schema additive change + dashboard shared types

**Files:**
- Modify: `web/prisma/schema.prisma`
- Create: `web/lib/dashboard/types.ts`

**Interfaces:**
- Consumes: `OrderRepository`, `OrderRecordInput` from `web/lib/ingest/types.ts` (sub-project 2).
- Produces: `OrderRecord`, `OrderFilter`, `OrderEdits`, `DashboardOrderRepository`, `StoreRecord`, `StoreInput`, `StoreRepository` — used by Tasks 3-7.

- [ ] **Step 1: Add label/trackingLink columns to the Order model**

In `web/prisma/schema.prisma`, modify the `Order` model (add the two new fields after `reviewReason`, keep everything else unchanged):
```prisma
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
  label          String?
  trackingLink   String?
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  @@unique([storeId, sourceOrderId])
}
```

- [ ] **Step 2: Regenerate the Prisma client**

Run: `cd /home/user/gls/web && npx prisma generate`
Expected: `✔ Generated Prisma Client (v6.19.3) to ./node_modules/@prisma/client`

- [ ] **Step 3: Write dashboard/types.ts**

`web/lib/dashboard/types.ts`:
```typescript
import type { OrderRecordInput, OrderRepository } from "../ingest/types";

export type OrderRecordStatus = "PENDING" | "NEEDS_REVIEW" | "READY" | "PRINTED" | "ERROR";

export interface OrderRecord extends OrderRecordInput {
  id: string;
  status: OrderRecordStatus;
  label: string | null;
  trackingLink: string | null;
}

export interface OrderFilter {
  status?: OrderRecordStatus;
}

export interface OrderEdits {
  name?: string;
  street?: string;
  houseNo?: string;
  zipCode?: string;
  city?: string;
  countryCode?: string;
  phone?: string;
  email?: string;
}

export interface DashboardOrderRepository extends OrderRepository {
  list(filter: OrderFilter): Promise<OrderRecord[]>;
  get(id: string): Promise<OrderRecord | null>;
  update(
    id: string,
    fields: OrderEdits & { status: "PENDING" | "NEEDS_REVIEW"; reviewReason: string | null },
  ): Promise<OrderRecord>;
  markPrinted(id: string, label: string, trackingLink: string): Promise<OrderRecord>;
  markError(id: string, message: string): Promise<OrderRecord>;
}

export type StoreType = "SHOPIFY" | "WOOCOMMERCE";

export interface StoreRecord {
  id: string;
  type: StoreType;
  name: string;
  automationEnabled: boolean;
  customerNo: string;
  defaultWeightKg: number;
  shopDomain: string | null;
  shopifyAccessToken: string | null;
  siteUrl: string | null;
  wooConsumerKey: string | null;
  wooConsumerSecret: string | null;
}

export interface StoreInput {
  type: StoreType;
  name: string;
  customerNo: string;
  defaultWeightKg: number;
  automationEnabled?: boolean;
  shopDomain?: string;
  shopifyAccessToken?: string;
  siteUrl?: string;
  wooConsumerKey?: string;
  wooConsumerSecret?: string;
}

export interface StoreRepository {
  list(): Promise<StoreRecord[]>;
  get(id: string): Promise<StoreRecord | null>;
  create(input: StoreInput): Promise<StoreRecord>;
  update(id: string, edits: Partial<StoreInput>): Promise<StoreRecord>;
}
```

This is a types-only file (no runtime behavior) — no dedicated test, exercised through Tasks 3-7, matching how `web/lib/ingest/types.ts` was handled in sub-project 2.

- [ ] **Step 4: Commit**

```bash
cd /home/user/gls
git add web/prisma/schema.prisma web/lib/dashboard/types.ts
git commit -m "Add label/trackingLink columns and dashboard shared types"
```

---

### Task 3: Order review/print core logic

**Files:**
- Create: `web/lib/dashboard/orders.ts`
- Test: `web/lib/dashboard/__tests__/orders.test.ts`

**Interfaces:**
- Consumes: `checkOrder` from `web/lib/validate.ts` (sub-project 2); `CreateLabelResult`, `LabelType`, `NormalizedShipment` from `web/lib/gls/types.ts` (sub-project 1); `DashboardOrderRepository`, `OrderEdits`, `OrderFilter`, `OrderRecord` from Task 2.
- Produces: `CreateLabelFn` type; `listOrders(repo, filter)`; `reviewOrder(repo, id, edits)`; `printOrder(repo, id, createLabelFn)` — used by Task 6 (order API routes).

- [ ] **Step 1: Write the failing tests**

`web/lib/dashboard/__tests__/orders.test.ts`:
```typescript
import { describe, expect, it, vi } from "vitest";
import { GlsApiError } from "../../gls/errors";
import { listOrders, printOrder, reviewOrder } from "../orders";
import type {
  DashboardOrderRepository,
  OrderEdits,
  OrderFilter,
  OrderRecord,
} from "../types";

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

class FakeDashboardOrderRepository implements DashboardOrderRepository {
  private orders = new Map<string, OrderRecord>();

  seed(order: OrderRecord) {
    this.orders.set(order.id, order);
  }

  async exists(): Promise<boolean> {
    throw new Error("not used in these tests");
  }

  async create(): Promise<void> {
    throw new Error("not used in these tests");
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
}

describe("listOrders", () => {
  it("filters by status", async () => {
    const repo = new FakeDashboardOrderRepository();
    repo.seed(makeOrderRecord({ id: "1", status: "PENDING" }));
    repo.seed(makeOrderRecord({ id: "2", status: "NEEDS_REVIEW" }));

    const result = await listOrders(repo, { status: "PENDING" });

    expect(result.map((o) => o.id)).toEqual(["1"]);
  });
});

describe("reviewOrder", () => {
  it("moves a fixed order back to PENDING", async () => {
    const repo = new FakeDashboardOrderRepository();
    repo.seed(
      makeOrderRecord({
        id: "1",
        status: "NEEDS_REVIEW",
        reviewReason: "Email: ongeldig of ontbrekend",
        email: "kapot",
      }),
    );

    const edits: OrderEdits = { email: "jan@voorbeeld.be" };
    const result = await reviewOrder(repo, "1", edits);

    expect(result.status).toBe("PENDING");
    expect(result.reviewReason).toBeNull();
    expect(result.email).toBe("jan@voorbeeld.be");
  });

  it("keeps NEEDS_REVIEW with an updated reason when still invalid", async () => {
    const repo = new FakeDashboardOrderRepository();
    repo.seed(
      makeOrderRecord({
        id: "1",
        status: "NEEDS_REVIEW",
        reviewReason: "Email: ongeldig of ontbrekend",
        email: "kapot",
      }),
    );

    const result = await reviewOrder(repo, "1", { email: "nog steeds kapot" });

    expect(result.status).toBe("NEEDS_REVIEW");
    expect(result.reviewReason).toContain("Email");
  });
});

describe("printOrder", () => {
  it("marks the order PRINTED on success", async () => {
    const repo = new FakeDashboardOrderRepository();
    repo.seed(makeOrderRecord({ id: "1" }));
    const createLabelFn = vi.fn().mockResolvedValue({
      label: "base64-label",
      trackingLink: "https://track.gls/1",
      unitTrackingLink: "https://track.gls/unit-1",
      transactionId: "txn-1",
    });

    const result = await printOrder(repo, "1", createLabelFn);

    expect(result).toEqual({ label: "base64-label", trackingLink: "https://track.gls/1" });
    const updated = await repo.get("1");
    expect(updated?.status).toBe("PRINTED");
    expect(createLabelFn).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Jan Peeters", reference: "#1001" }),
      "pdf",
      "11850079",
    );
  });

  it("marks the order ERROR and rethrows on failure", async () => {
    const repo = new FakeDashboardOrderRepository();
    repo.seed(makeOrderRecord({ id: "1" }));
    const createLabelFn = vi.fn().mockRejectedValue(new GlsApiError("Ongeldige postcode", 422));

    await expect(printOrder(repo, "1", createLabelFn)).rejects.toThrow("Ongeldige postcode");

    const updated = await repo.get("1");
    expect(updated?.status).toBe("ERROR");
    expect(updated?.reviewReason).toBe("Ongeldige postcode");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/user/gls/web && npx vitest run lib/dashboard/__tests__/orders.test.ts`
Expected: FAIL with "Cannot find module '../orders'"

- [ ] **Step 3: Write orders.ts**

`web/lib/dashboard/orders.ts`:
```typescript
import { checkOrder } from "../validate";
import type { CreateLabelResult, LabelType, NormalizedShipment } from "../gls/types";
import type { DashboardOrderRepository, OrderEdits, OrderFilter, OrderRecord } from "./types";

export type CreateLabelFn = (
  shipment: NormalizedShipment,
  labelType: LabelType,
  customerNo: string,
) => Promise<CreateLabelResult>;

export async function listOrders(
  repo: DashboardOrderRepository,
  filter: OrderFilter,
): Promise<OrderRecord[]> {
  return repo.list(filter);
}

export async function reviewOrder(
  repo: DashboardOrderRepository,
  id: string,
  edits: OrderEdits,
): Promise<OrderRecord> {
  const existing = await repo.get(id);
  if (!existing) {
    throw new Error(`Order ${id} not found`);
  }

  const merged = { ...existing, ...edits };
  const reasons = checkOrder({
    email: merged.email,
    phone: merged.phone,
    countryCode: merged.countryCode,
  });

  return repo.update(id, {
    ...edits,
    status: reasons.length > 0 ? "NEEDS_REVIEW" : "PENDING",
    reviewReason: reasons.length > 0 ? reasons.join("; ") : null,
  });
}

export async function printOrder(
  repo: DashboardOrderRepository,
  id: string,
  createLabelFn: CreateLabelFn,
): Promise<{ label: string; trackingLink: string }> {
  const order = await repo.get(id);
  if (!order) {
    throw new Error(`Order ${id} not found`);
  }

  try {
    const result = await createLabelFn(
      {
        name: order.name,
        street: order.street,
        houseNo: order.houseNo,
        zipCode: order.zipCode,
        city: order.city,
        countryCode: order.countryCode as "BE" | "NL" | "LU",
        phone: order.phone,
        email: order.email,
        weightKg: order.weightKg,
        reference: order.orderNumber,
      },
      "pdf",
      order.customerNo,
    );

    await repo.markPrinted(id, result.label, result.trackingLink);
    return { label: result.label, trackingLink: result.trackingLink };
  } catch (err) {
    await repo.markError(id, (err as Error).message);
    throw err;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/user/gls/web && npx vitest run lib/dashboard/__tests__/orders.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
cd /home/user/gls
git add web/lib/dashboard/orders.ts web/lib/dashboard/__tests__/orders.test.ts
git commit -m "Add order review/print core logic"
```

---

### Task 4: Store settings core logic

**Files:**
- Create: `web/lib/dashboard/stores.ts`
- Test: `web/lib/dashboard/__tests__/stores.test.ts`

**Interfaces:**
- Consumes: `StoreInput`, `StoreRecord`, `StoreRepository` from Task 2.
- Produces: `listStores(repo)`; `createStore(repo, input)`; `updateStore(repo, id, edits)` — used by Task 7 (store API routes).

- [ ] **Step 1: Write the failing tests**

`web/lib/dashboard/__tests__/stores.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { createStore, listStores, updateStore } from "../stores";
import type { StoreInput, StoreRecord, StoreRepository } from "../types";

class FakeStoreRepository implements StoreRepository {
  private stores = new Map<string, StoreRecord>();
  private nextId = 1;

  async list(): Promise<StoreRecord[]> {
    return [...this.stores.values()];
  }

  async get(id: string): Promise<StoreRecord | null> {
    return this.stores.get(id) ?? null;
  }

  async create(input: StoreInput): Promise<StoreRecord> {
    const id = `store-${this.nextId++}`;
    const record: StoreRecord = {
      id,
      type: input.type,
      name: input.name,
      automationEnabled: input.automationEnabled ?? false,
      customerNo: input.customerNo,
      defaultWeightKg: input.defaultWeightKg,
      shopDomain: input.shopDomain ?? null,
      shopifyAccessToken: input.shopifyAccessToken ?? null,
      siteUrl: input.siteUrl ?? null,
      wooConsumerKey: input.wooConsumerKey ?? null,
      wooConsumerSecret: input.wooConsumerSecret ?? null,
    };
    this.stores.set(id, record);
    return record;
  }

  async update(id: string, edits: Partial<StoreInput>): Promise<StoreRecord> {
    const existing = this.stores.get(id);
    if (!existing) throw new Error(`Store ${id} not found`);
    const updated = { ...existing, ...edits };
    this.stores.set(id, updated);
    return updated;
  }
}

const shopifyInput: StoreInput = {
  type: "SHOPIFY",
  name: "Revitalash",
  customerNo: "11850079",
  defaultWeightKg: 1.0,
  shopDomain: "revitalash.myshopify.com",
  shopifyAccessToken: "shpat_test",
};

describe("createStore", () => {
  it("creates a valid Shopify store", async () => {
    const repo = new FakeStoreRepository();
    const result = await createStore(repo, shopifyInput);
    expect(result.name).toBe("Revitalash");
    expect(await listStores(repo)).toHaveLength(1);
  });

  it("rejects a Shopify store missing required credentials", async () => {
    const repo = new FakeStoreRepository();
    await expect(createStore(repo, { ...shopifyInput, shopifyAccessToken: "" })).rejects.toThrow(
      "access token",
    );
  });

  it("rejects a WooCommerce store missing required credentials", async () => {
    const repo = new FakeStoreRepository();
    await expect(
      createStore(repo, {
        type: "WOOCOMMERCE",
        name: "WooStore",
        customerNo: "11850080",
        defaultWeightKg: 1.0,
        siteUrl: "https://example.com",
        wooConsumerKey: "",
        wooConsumerSecret: "",
      }),
    ).rejects.toThrow("Consumer key");
  });
});

describe("updateStore", () => {
  it("applies edits to an existing store", async () => {
    const repo = new FakeStoreRepository();
    const created = await createStore(repo, shopifyInput);
    const updated = await updateStore(repo, created.id, { automationEnabled: true });
    expect(updated.automationEnabled).toBe(true);
  });

  it("rejects edits that would leave required fields empty", async () => {
    const repo = new FakeStoreRepository();
    const created = await createStore(repo, shopifyInput);
    await expect(updateStore(repo, created.id, { shopifyAccessToken: "" })).rejects.toThrow(
      "access token",
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/user/gls/web && npx vitest run lib/dashboard/__tests__/stores.test.ts`
Expected: FAIL with "Cannot find module '../stores'"

- [ ] **Step 3: Write stores.ts**

`web/lib/dashboard/stores.ts`:
```typescript
import type { StoreInput, StoreRecord, StoreRepository } from "./types";

function validateStoreInput(input: StoreInput): string[] {
  const errors: string[] = [];
  if (!input.name) errors.push("Naam is verplicht");
  if (!input.customerNo) errors.push("GLS klantnummer is verplicht");

  if (input.type === "SHOPIFY") {
    if (!input.shopDomain) errors.push("Shopify domein is verplicht");
    if (!input.shopifyAccessToken) errors.push("Shopify access token is verplicht");
  } else {
    if (!input.siteUrl) errors.push("Site URL is verplicht");
    if (!input.wooConsumerKey) errors.push("Consumer key is verplicht");
    if (!input.wooConsumerSecret) errors.push("Consumer secret is verplicht");
  }

  return errors;
}

export async function listStores(repo: StoreRepository): Promise<StoreRecord[]> {
  return repo.list();
}

export async function createStore(
  repo: StoreRepository,
  input: StoreInput,
): Promise<StoreRecord> {
  const errors = validateStoreInput(input);
  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }
  return repo.create(input);
}

export async function updateStore(
  repo: StoreRepository,
  id: string,
  edits: Partial<StoreInput>,
): Promise<StoreRecord> {
  const existing = await repo.get(id);
  if (!existing) {
    throw new Error(`Store ${id} not found`);
  }
  const merged: StoreInput = { ...existing, ...edits };
  const errors = validateStoreInput(merged);
  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }
  return repo.update(id, edits);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/user/gls/web && npx vitest run lib/dashboard/__tests__/stores.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
cd /home/user/gls
git add web/lib/dashboard/stores.ts web/lib/dashboard/__tests__/stores.test.ts
git commit -m "Add store settings core logic with credential validation"
```

---

### Task 5: Prisma client singleton + repository implementations

**Files:**
- Create: `web/lib/db.ts`
- Create: `web/lib/repositories/orderRepository.ts`
- Create: `web/lib/repositories/storeRepository.ts`

**Interfaces:**
- Consumes: `DashboardOrderRepository`, `StoreRepository`, `OrderRecord`, `OrderFilter`, `OrderEdits`, `StoreRecord`, `StoreInput` from Task 2; `OrderRecordInput` from `web/lib/ingest/types.ts` (sub-project 2).
- Produces: `prisma` (shared client); `PrismaOrderRepository`; `PrismaStoreRepository` — used by Tasks 6-7's route files (not by any test — these classes are thin and verified via a successful build, per the spec).

- [ ] **Step 1: Write db.ts**

`web/lib/db.ts`:
```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 2: Write the order repository**

`web/lib/repositories/orderRepository.ts`:
```typescript
import { prisma } from "../db";
import type {
  DashboardOrderRepository,
  OrderEdits,
  OrderFilter,
  OrderRecord,
} from "../dashboard/types";
import type { OrderRecordInput } from "../ingest/types";

interface PrismaOrderRow {
  id: string;
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
  status: string;
  reviewReason: string | null;
  label: string | null;
  trackingLink: string | null;
}

function toOrderRecord(order: PrismaOrderRow): OrderRecord {
  return { ...order, status: order.status as OrderRecord["status"] };
}

export class PrismaOrderRepository implements DashboardOrderRepository {
  async exists(storeId: string, sourceOrderId: string): Promise<boolean> {
    const count = await prisma.order.count({ where: { storeId, sourceOrderId } });
    return count > 0;
  }

  async create(order: OrderRecordInput & { storeId: string; weightKg: number; customerNo: string; status: string; reviewReason: string | null }): Promise<void> {
    await prisma.order.create({ data: order });
  }

  async list(filter: OrderFilter): Promise<OrderRecord[]> {
    const orders = await prisma.order.findMany({
      where: filter.status ? { status: filter.status } : undefined,
      orderBy: { createdAt: "desc" },
    });
    return orders.map(toOrderRecord);
  }

  async get(id: string): Promise<OrderRecord | null> {
    const order = await prisma.order.findUnique({ where: { id } });
    return order ? toOrderRecord(order) : null;
  }

  async update(
    id: string,
    fields: OrderEdits & { status: "PENDING" | "NEEDS_REVIEW"; reviewReason: string | null },
  ): Promise<OrderRecord> {
    const order = await prisma.order.update({ where: { id }, data: fields });
    return toOrderRecord(order);
  }

  async markPrinted(id: string, label: string, trackingLink: string): Promise<OrderRecord> {
    const order = await prisma.order.update({
      where: { id },
      data: { status: "PRINTED", label, trackingLink },
    });
    return toOrderRecord(order);
  }

  async markError(id: string, message: string): Promise<OrderRecord> {
    const order = await prisma.order.update({
      where: { id },
      data: { status: "ERROR", reviewReason: message },
    });
    return toOrderRecord(order);
  }
}
```

Note: sub-project 2's `OrderRepository.create()` signature takes an `OrderRecordInput` (the normalized fields only); the actual `Order` rows also need `storeId`, `weightKg`, `customerNo`, `status`, `reviewReason` set by `syncStore`'s caller. This matches how `web/lib/ingest/sync.ts`'s `processOrder` already builds the full object it passes to `repository.create(...)` — the type above reflects exactly those fields.

- [ ] **Step 3: Write the store repository**

`web/lib/repositories/storeRepository.ts`:
```typescript
import { prisma } from "../db";
import type { StoreInput, StoreRecord, StoreRepository } from "../dashboard/types";

function toStoreRecord(store: {
  id: string;
  type: string;
  name: string;
  automationEnabled: boolean;
  customerNo: string;
  defaultWeightKg: number;
  shopDomain: string | null;
  shopifyAccessToken: string | null;
  siteUrl: string | null;
  wooConsumerKey: string | null;
  wooConsumerSecret: string | null;
}): StoreRecord {
  return { ...store, type: store.type as StoreRecord["type"] };
}

export class PrismaStoreRepository implements StoreRepository {
  async list(): Promise<StoreRecord[]> {
    const stores = await prisma.store.findMany({ orderBy: { createdAt: "desc" } });
    return stores.map(toStoreRecord);
  }

  async get(id: string): Promise<StoreRecord | null> {
    const store = await prisma.store.findUnique({ where: { id } });
    return store ? toStoreRecord(store) : null;
  }

  async create(input: StoreInput): Promise<StoreRecord> {
    const store = await prisma.store.create({ data: input });
    return toStoreRecord(store);
  }

  async update(id: string, edits: Partial<StoreInput>): Promise<StoreRecord> {
    const store = await prisma.store.update({ where: { id }, data: edits });
    return toStoreRecord(store);
  }
}
```

- [ ] **Step 4: Verify the project still builds**

Run: `cd /home/user/gls/web && npm run build`
Expected: builds successfully. If Prisma's generated types don't line up exactly with the hand-written interfaces above (e.g. `Order.status` typed as the `OrderStatus` enum rather than `string`), adjust the repository files' type casts to match — the fix belongs in these thin repository files, not in `dashboard/types.ts` or the enum in `schema.prisma`.

- [ ] **Step 5: Commit**

```bash
cd /home/user/gls
git add web/lib/db.ts web/lib/repositories/orderRepository.ts web/lib/repositories/storeRepository.ts
git commit -m "Add Prisma client singleton and repository implementations"
```

---

### Task 6: Order API routes

**Files:**
- Create: `web/app/api/orders/route.ts`
- Create: `web/app/api/orders/[id]/route.ts`
- Create: `web/app/api/orders/[id]/print/route.ts`
- Create: `web/app/api/orders/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `listOrders`, `reviewOrder`, `printOrder` from Task 3; `PrismaOrderRepository` from Task 5; `DashboardOrderRepository`, `OrderFilter`, `OrderEdits` from Task 2.
- Produces: exported `handleListOrders`, `handleReviewOrder`, `handlePrintOrder` core functions (directly testable); `GET`, `PATCH`, `POST` route exports Next.js actually calls.

- [ ] **Step 1: Write the failing tests**

`web/app/api/orders/__tests__/route.test.ts`:
```typescript
import { describe, expect, it, vi } from "vitest";
import { GlsApiError } from "../../../../lib/gls/errors";
import type { DashboardOrderRepository, OrderFilter, OrderRecord } from "../../../../lib/dashboard/types";
import { handleListOrders, handlePrintOrder, handleReviewOrder } from "../shared";

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

class FakeDashboardOrderRepository implements DashboardOrderRepository {
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
}

describe("handleListOrders", () => {
  it("returns orders filtered by status", async () => {
    const repo = new FakeDashboardOrderRepository();
    repo.seed(makeOrderRecord({ id: "1", status: "PENDING" }));
    repo.seed(makeOrderRecord({ id: "2", status: "NEEDS_REVIEW" }));

    const request = new Request("https://example.com/api/orders?status=PENDING");
    const response = await handleListOrders(request, repo);
    const body = (await response.json()) as { orders: OrderRecord[] };

    expect(response.status).toBe(200);
    expect(body.orders.map((o) => o.id)).toEqual(["1"]);
  });
});

describe("handleReviewOrder", () => {
  it("applies edits and returns the updated order", async () => {
    const repo = new FakeDashboardOrderRepository();
    repo.seed(
      makeOrderRecord({ id: "1", status: "NEEDS_REVIEW", email: "kapot", reviewReason: "Email: ongeldig of ontbrekend" }),
    );

    const request = new Request("https://example.com/api/orders/1", {
      method: "PATCH",
      body: JSON.stringify({ email: "jan@voorbeeld.be" }),
    });
    const response = await handleReviewOrder(request, repo, "1");
    const body = (await response.json()) as { order: OrderRecord };

    expect(response.status).toBe(200);
    expect(body.order.status).toBe("PENDING");
  });
});

describe("handlePrintOrder", () => {
  it("returns the label on success", async () => {
    const repo = new FakeDashboardOrderRepository();
    repo.seed(makeOrderRecord({ id: "1" }));
    const createLabelFn = vi.fn().mockResolvedValue({
      label: "base64-label",
      trackingLink: "https://track.gls/1",
      unitTrackingLink: "https://track.gls/unit-1",
      transactionId: "txn-1",
    });

    const response = await handlePrintOrder(repo, "1", createLabelFn);
    const body = (await response.json()) as { label: string; trackingLink: string };

    expect(response.status).toBe(200);
    expect(body.label).toBe("base64-label");
  });

  it("returns a 502 with the GLS error message on failure", async () => {
    const repo = new FakeDashboardOrderRepository();
    repo.seed(makeOrderRecord({ id: "1" }));
    const createLabelFn = vi.fn().mockRejectedValue(new GlsApiError("Ongeldige postcode", 422));

    const response = await handlePrintOrder(repo, "1", createLabelFn);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(502);
    expect(body.error).toBe("Ongeldige postcode");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/user/gls/web && npx vitest run app/api/orders/__tests__/route.test.ts`
Expected: FAIL with "Cannot find module '../shared'"

- [ ] **Step 3: Write the shared handler module**

`web/app/api/orders/shared.ts`:
```typescript
import { NextResponse } from "next/server";
import { GlsApiError } from "../../../lib/gls/errors";
import { listOrders, printOrder, reviewOrder, type CreateLabelFn } from "../../../lib/dashboard/orders";
import type { DashboardOrderRepository, OrderEdits, OrderFilter } from "../../../lib/dashboard/types";

export async function handleListOrders(
  request: Request,
  repo: DashboardOrderRepository,
): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") as OrderFilter["status"] | null;
  const orders = await listOrders(repo, status ? { status } : {});
  return NextResponse.json({ orders });
}

export async function handleReviewOrder(
  request: Request,
  repo: DashboardOrderRepository,
  id: string,
): Promise<Response> {
  const edits = (await request.json()) as OrderEdits;
  const order = await reviewOrder(repo, id, edits);
  return NextResponse.json({ order });
}

export async function handlePrintOrder(
  repo: DashboardOrderRepository,
  id: string,
  createLabelFn: CreateLabelFn,
): Promise<Response> {
  try {
    const result = await printOrder(repo, id, createLabelFn);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof GlsApiError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/user/gls/web && npx vitest run app/api/orders/__tests__/route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Write the thin route files**

`web/app/api/orders/route.ts`:
```typescript
import { PrismaOrderRepository } from "../../../lib/repositories/orderRepository";
import { handleListOrders } from "./shared";

const repository = new PrismaOrderRepository();

export async function GET(request: Request): Promise<Response> {
  return handleListOrders(request, repository);
}
```

`web/app/api/orders/[id]/route.ts`:
```typescript
import { PrismaOrderRepository } from "../../../../lib/repositories/orderRepository";
import { handleReviewOrder } from "../shared";

const repository = new PrismaOrderRepository();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return handleReviewOrder(request, repository, id);
}
```

`web/app/api/orders/[id]/print/route.ts`:
```typescript
import { createGlsLabel } from "../../../../../lib/gls/createLabel";
import { PrismaOrderRepository } from "../../../../../lib/repositories/orderRepository";
import { handlePrintOrder } from "../../shared";

const repository = new PrismaOrderRepository();

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return handlePrintOrder(repository, id, createGlsLabel);
}
```

- [ ] **Step 6: Verify the project still builds**

Run: `cd /home/user/gls/web && npm run build`
Expected: builds successfully. If Next.js 16's actual route handler signature for dynamic segments differs from `{ params: Promise<{ id: string }> }` (check the build error message closely if it fails here), adjust these three thin route files to match — `shared.ts`'s exported functions and their tests are unaffected either way, since they take a plain `id: string`.

- [ ] **Step 7: Commit**

```bash
cd /home/user/gls
git add web/app/api/orders
git commit -m "Add order list/review/print API routes"
```

---

### Task 7: Store and sync API routes

**Files:**
- Create: `web/app/api/stores/route.ts`
- Create: `web/app/api/stores/[id]/route.ts`
- Create: `web/app/api/stores/shared.ts`
- Create: `web/app/api/stores/__tests__/route.test.ts`
- Create: `web/app/api/sync/route.ts`
- Create: `web/app/api/sync/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `listStores`, `createStore`, `updateStore` from Task 4; `PrismaStoreRepository` from Task 5; `syncStore` from `web/lib/ingest/sync.ts` (sub-project 2); `PrismaOrderRepository` from Task 5.
- Produces: `handleListStores`, `handleCreateStore`, `handleUpdateStore` (directly testable); `GET`/`POST`/`PATCH` route exports for `/api/stores`, `/api/stores/[id]`; `POST` route export for `/api/sync`.

- [ ] **Step 1: Write the failing store route tests**

`web/app/api/stores/__tests__/route.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import type { StoreInput, StoreRecord, StoreRepository } from "../../../../lib/dashboard/types";
import { handleCreateStore, handleListStores, handleUpdateStore } from "../shared";

class FakeStoreRepository implements StoreRepository {
  private stores = new Map<string, StoreRecord>();
  private nextId = 1;

  async list(): Promise<StoreRecord[]> {
    return [...this.stores.values()];
  }

  async get(id: string): Promise<StoreRecord | null> {
    return this.stores.get(id) ?? null;
  }

  async create(input: StoreInput): Promise<StoreRecord> {
    const id = `store-${this.nextId++}`;
    const record: StoreRecord = {
      id,
      type: input.type,
      name: input.name,
      automationEnabled: input.automationEnabled ?? false,
      customerNo: input.customerNo,
      defaultWeightKg: input.defaultWeightKg,
      shopDomain: input.shopDomain ?? null,
      shopifyAccessToken: input.shopifyAccessToken ?? null,
      siteUrl: input.siteUrl ?? null,
      wooConsumerKey: input.wooConsumerKey ?? null,
      wooConsumerSecret: input.wooConsumerSecret ?? null,
    };
    this.stores.set(id, record);
    return record;
  }

  async update(id: string, edits: Partial<StoreInput>): Promise<StoreRecord> {
    const existing = this.stores.get(id);
    if (!existing) throw new Error(`Store ${id} not found`);
    const updated = { ...existing, ...edits };
    this.stores.set(id, updated);
    return updated;
  }
}

const shopifyInput: StoreInput = {
  type: "SHOPIFY",
  name: "Revitalash",
  customerNo: "11850079",
  defaultWeightKg: 1.0,
  shopDomain: "revitalash.myshopify.com",
  shopifyAccessToken: "shpat_test",
};

describe("handleListStores", () => {
  it("returns all stores", async () => {
    const repo = new FakeStoreRepository();
    await repo.create(shopifyInput);

    const response = await handleListStores(repo);
    const body = (await response.json()) as { stores: StoreRecord[] };

    expect(response.status).toBe(200);
    expect(body.stores).toHaveLength(1);
  });
});

describe("handleCreateStore", () => {
  it("creates a valid store", async () => {
    const repo = new FakeStoreRepository();
    const request = new Request("https://example.com/api/stores", {
      method: "POST",
      body: JSON.stringify(shopifyInput),
    });

    const response = await handleCreateStore(request, repo);
    const body = (await response.json()) as { store: StoreRecord };

    expect(response.status).toBe(200);
    expect(body.store.name).toBe("Revitalash");
  });

  it("returns a 400 with the validation message for an invalid store", async () => {
    const repo = new FakeStoreRepository();
    const request = new Request("https://example.com/api/stores", {
      method: "POST",
      body: JSON.stringify({ ...shopifyInput, shopifyAccessToken: "" }),
    });

    const response = await handleCreateStore(request, repo);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("access token");
  });
});

describe("handleUpdateStore", () => {
  it("applies edits to an existing store", async () => {
    const repo = new FakeStoreRepository();
    const created = await repo.create(shopifyInput);
    const request = new Request(`https://example.com/api/stores/${created.id}`, {
      method: "PATCH",
      body: JSON.stringify({ automationEnabled: true }),
    });

    const response = await handleUpdateStore(request, repo, created.id);
    const body = (await response.json()) as { store: StoreRecord };

    expect(response.status).toBe(200);
    expect(body.store.automationEnabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/user/gls/web && npx vitest run app/api/stores/__tests__/route.test.ts`
Expected: FAIL with "Cannot find module '../shared'"

- [ ] **Step 3: Write the shared store handler module**

`web/app/api/stores/shared.ts`:
```typescript
import { NextResponse } from "next/server";
import { createStore, listStores, updateStore } from "../../../lib/dashboard/stores";
import type { StoreInput, StoreRepository } from "../../../lib/dashboard/types";

export async function handleListStores(repo: StoreRepository): Promise<Response> {
  const stores = await listStores(repo);
  return NextResponse.json({ stores });
}

export async function handleCreateStore(request: Request, repo: StoreRepository): Promise<Response> {
  try {
    const input = (await request.json()) as StoreInput;
    const store = await createStore(repo, input);
    return NextResponse.json({ store });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function handleUpdateStore(
  request: Request,
  repo: StoreRepository,
  id: string,
): Promise<Response> {
  try {
    const edits = (await request.json()) as Partial<StoreInput>;
    const store = await updateStore(repo, id, edits);
    return NextResponse.json({ store });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/user/gls/web && npx vitest run app/api/stores/__tests__/route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Write the thin store route files**

`web/app/api/stores/route.ts`:
```typescript
import { PrismaStoreRepository } from "../../../lib/repositories/storeRepository";
import { handleCreateStore, handleListStores } from "./shared";

const repository = new PrismaStoreRepository();

export async function GET(): Promise<Response> {
  return handleListStores(repository);
}

export async function POST(request: Request): Promise<Response> {
  return handleCreateStore(request, repository);
}
```

`web/app/api/stores/[id]/route.ts`:
```typescript
import { PrismaStoreRepository } from "../../../../lib/repositories/storeRepository";
import { handleUpdateStore } from "../shared";

const repository = new PrismaStoreRepository();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return handleUpdateStore(request, repository, id);
}
```

- [ ] **Step 6: Write the failing sync route test**

`web/app/api/sync/__tests__/route.test.ts`:
```typescript
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../lib/ingest/sync", () => ({
  syncStore: vi.fn(),
}));

import { syncStore } from "../../../../lib/ingest/sync";
import { handleSync } from "../shared";
import type { StoreRecord, StoreRepository } from "../../../../lib/dashboard/types";

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

const store1: StoreRecord = {
  id: "store-1",
  type: "SHOPIFY",
  name: "Revitalash",
  automationEnabled: false,
  customerNo: "11850079",
  defaultWeightKg: 1.0,
  shopDomain: "revitalash.myshopify.com",
  shopifyAccessToken: "shpat_test",
  siteUrl: null,
  wooConsumerKey: null,
  wooConsumerSecret: null,
};

describe("handleSync", () => {
  it("syncs every store and returns per-store results", async () => {
    mockedSyncStore.mockResolvedValue({ new: 2, valid: 1, invalid: 1 });
    const storeRepo = new FakeStoreRepository([store1]);

    const response = await handleSync(storeRepo, {} as any);
    const body = (await response.json()) as { results: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(body.results["store-1"]).toEqual({ new: 2, valid: 1, invalid: 1 });
    expect(mockedSyncStore).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `cd /home/user/gls/web && npx vitest run app/api/sync/__tests__/route.test.ts`
Expected: FAIL with "Cannot find module '../shared'"

- [ ] **Step 8: Write the sync shared handler and thin route**

`web/app/api/sync/shared.ts`:
```typescript
import { NextResponse } from "next/server";
import { syncStore } from "../../../lib/ingest/sync";
import type { OrderRepository, StoreConfig, SyncResult } from "../../../lib/ingest/types";
import type { StoreRepository } from "../../../lib/dashboard/types";

export async function handleSync(
  storeRepo: StoreRepository,
  orderRepo: OrderRepository,
): Promise<Response> {
  const stores = await storeRepo.list();
  const results: Record<string, SyncResult> = {};

  for (const store of stores) {
    const config: StoreConfig =
      store.type === "SHOPIFY"
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

    results[store.id] = await syncStore(config, orderRepo);
  }

  return NextResponse.json({ results });
}
```

`web/app/api/sync/route.ts`:
```typescript
import { PrismaOrderRepository } from "../../../lib/repositories/orderRepository";
import { PrismaStoreRepository } from "../../../lib/repositories/storeRepository";
import { handleSync } from "./shared";

const storeRepository = new PrismaStoreRepository();
const orderRepository = new PrismaOrderRepository();

export async function POST(): Promise<Response> {
  return handleSync(storeRepository, orderRepository);
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `cd /home/user/gls/web && npx vitest run app/api/sync/__tests__/route.test.ts`
Expected: PASS (1 test)

- [ ] **Step 10: Run the full test suite and verify the build**

Run: `cd /home/user/gls/web && npm test`
Expected: PASS (all tests across the whole project)

Run: `cd /home/user/gls/web && npm run build`
Expected: builds successfully

- [ ] **Step 11: Commit**

```bash
cd /home/user/gls
git add web/app/api/stores web/app/api/sync
git commit -m "Add store settings and sync API routes"
```

---

### Task 8: Dashboard pages

**Files:**
- Modify: `web/app/page.tsx` (replaces sub-project 1's placeholder)
- Create: `web/app/bestellingen/[id]/page.tsx`
- Create: `web/app/bestellingen/[id]/ReviewForm.tsx`
- Create: `web/app/instellingen/page.tsx`
- Create: `web/app/instellingen/StoreForm.tsx`

**Interfaces:**
- Consumes: `listOrders` (Task 3) + `PrismaOrderRepository` (Task 5) for reads; `/api/orders/:id`, `/api/orders/:id/print`, `/api/sync`, `/api/stores`, `/api/stores/:id` (Tasks 6-7) for mutations via `fetch` from Client Components; `listStores` (Task 4) + `PrismaStoreRepository` (Task 5) for reads.
- Produces: the actual dashboard UI. No dedicated tests — verified via `npm run build`, matching the spec's testing section (core logic, repositories, and route handlers are tested; pages are not).

- [ ] **Step 1: Write the order list page**

`web/app/page.tsx`:
```tsx
import Link from "next/link";
import { listOrders } from "../lib/dashboard/orders";
import { PrismaOrderRepository } from "../lib/repositories/orderRepository";
import type { OrderRecordStatus } from "../lib/dashboard/types";
import { SyncButton } from "./SyncButton";
import { PrintButton } from "./PrintButton";

const TABS: { label: string; status: OrderRecordStatus }[] = [
  { label: "Klaar om te printen", status: "PENDING" },
  { label: "Moet gecontroleerd worden", status: "NEEDS_REVIEW" },
  { label: "Geprint", status: "PRINTED" },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const activeStatus = (status as OrderRecordStatus | undefined) ?? "PENDING";
  const repository = new PrismaOrderRepository();
  const orders = await listOrders(repository, { status: activeStatus });

  return (
    <main style={{ maxWidth: 960, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>GLS Sync</h1>
      <nav style={{ marginBottom: 16 }}>
        {TABS.map((tab) => (
          <Link
            key={tab.status}
            href={`/?status=${tab.status}`}
            style={{
              marginRight: 12,
              fontWeight: tab.status === activeStatus ? "bold" : "normal",
            }}
          >
            {tab.label}
          </Link>
        ))}
        <Link href="/instellingen" style={{ float: "right" }}>
          Instellingen
        </Link>
      </nav>
      <SyncButton />
      <table style={{ width: "100%", marginTop: 16, borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Naam</th>
            <th style={{ textAlign: "left" }}>Adres</th>
            <th style={{ textAlign: "left" }}>Land</th>
            <th style={{ textAlign: "left" }}>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>{order.name}</td>
              <td>
                {order.street} {order.houseNo}, {order.zipCode} {order.city}
              </td>
              <td>{order.countryCode}</td>
              <td>{order.status}</td>
              <td>
                {order.status === "NEEDS_REVIEW" && (
                  <Link href={`/bestellingen/${order.id}`}>Bekijken</Link>
                )}
                {order.status === "PENDING" && <PrintButton orderId={order.id} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 2: Write the SyncButton and PrintButton Client Components**

`web/app/SyncButton.tsx`:
```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    await fetch("/api/sync", { method: "POST" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button onClick={handleClick} disabled={loading}>
      {loading ? "Bezig..." : "Bestellingen ophalen"}
    </button>
  );
}
```

`web/app/PrintButton.tsx`:
```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PrintButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    const response = await fetch(`/api/orders/${orderId}/print`, { method: "POST" });
    const body = (await response.json()) as { label?: string; error?: string };

    if (!response.ok || !body.label) {
      setError(body.error ?? "Printen mislukt");
      return;
    }

    const byteCharacters = atob(body.label);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const blob = new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" });
    window.open(URL.createObjectURL(blob), "_blank");
    router.refresh();
  }

  return (
    <>
      <button onClick={handleClick}>Printen</button>
      {error && <span style={{ color: "red", marginLeft: 8 }}>{error}</span>}
    </>
  );
}
```

- [ ] **Step 3: Write the review page and form**

`web/app/bestellingen/[id]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { PrismaOrderRepository } from "../../../lib/repositories/orderRepository";
import { ReviewForm } from "./ReviewForm";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repository = new PrismaOrderRepository();
  const order = await repository.get(id);

  if (!order) {
    notFound();
  }

  return (
    <main style={{ maxWidth: 480, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>Bestelling controleren</h1>
      <p style={{ color: "red" }}>{order.reviewReason}</p>
      <ReviewForm order={order} />
    </main>
  );
}
```

`web/app/bestellingen/[id]/ReviewForm.tsx`:
```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OrderRecord } from "../../../lib/dashboard/types";

export function ReviewForm({ order }: { order: OrderRecord }) {
  const router = useRouter();
  const [fields, setFields] = useState({
    name: order.name,
    street: order.street,
    houseNo: order.houseNo,
    zipCode: order.zipCode,
    city: order.city,
    countryCode: order.countryCode,
    phone: order.phone,
    email: order.email,
  });
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof typeof fields) {
    return (event: React.ChangeEvent<HTMLInputElement>) =>
      setFields((prev) => ({ ...prev, [key]: event.target.value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      body: JSON.stringify(fields),
    });
    const body = (await response.json()) as { order?: { status: string }; error?: string };

    if (!response.ok) {
      setError(body.error ?? "Opslaan mislukt");
      return;
    }

    router.push("/");
  }

  return (
    <form onSubmit={handleSubmit}>
      {(Object.keys(fields) as (keyof typeof fields)[]).map((key) => (
        <label key={key} style={{ display: "block", marginBottom: 8 }}>
          {key}
          <input value={fields[key]} onChange={set(key)} style={{ display: "block", width: "100%" }} />
        </label>
      ))}
      <button type="submit">Opslaan</button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </form>
  );
}
```

- [ ] **Step 4: Write the settings page and form**

`web/app/instellingen/page.tsx`:
```tsx
import { listStores } from "../../lib/dashboard/stores";
import { PrismaStoreRepository } from "../../lib/repositories/storeRepository";
import { StoreForm } from "./StoreForm";

export default async function SettingsPage() {
  const repository = new PrismaStoreRepository();
  const stores = await listStores(repository);

  return (
    <main style={{ maxWidth: 640, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>Instellingen</h1>
      <h2>Winkels</h2>
      <ul>
        {stores.map((store) => (
          <li key={store.id}>
            {store.name} ({store.type}) — automatisch: {store.automationEnabled ? "aan" : "uit"}
          </li>
        ))}
      </ul>
      <h2>Winkel toevoegen</h2>
      <StoreForm />
    </main>
  );
}
```

`web/app/instellingen/StoreForm.tsx`:
```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function StoreForm() {
  const router = useRouter();
  const [type, setType] = useState<"SHOPIFY" | "WOOCOMMERCE">("SHOPIFY");
  const [name, setName] = useState("");
  const [customerNo, setCustomerNo] = useState("");
  const [defaultWeightKg, setDefaultWeightKg] = useState("1.0");
  const [shopDomain, setShopDomain] = useState("");
  const [shopifyAccessToken, setShopifyAccessToken] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [wooConsumerKey, setWooConsumerKey] = useState("");
  const [wooConsumerSecret, setWooConsumerSecret] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const input =
      type === "SHOPIFY"
        ? { type, name, customerNo, defaultWeightKg: Number(defaultWeightKg), shopDomain, shopifyAccessToken }
        : { type, name, customerNo, defaultWeightKg: Number(defaultWeightKg), siteUrl, wooConsumerKey, wooConsumerSecret };

    const response = await fetch("/api/stores", {
      method: "POST",
      body: JSON.stringify(input),
    });
    const body = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(body.error ?? "Opslaan mislukt");
      return;
    }

    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      <label style={{ display: "block", marginBottom: 8 }}>
        Type
        <select value={type} onChange={(e) => setType(e.target.value as "SHOPIFY" | "WOOCOMMERCE")}>
          <option value="SHOPIFY">Shopify</option>
          <option value="WOOCOMMERCE">WooCommerce</option>
        </select>
      </label>
      <label style={{ display: "block", marginBottom: 8 }}>
        Naam
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ display: "block", width: "100%" }} />
      </label>
      <label style={{ display: "block", marginBottom: 8 }}>
        GLS klantnummer
        <input value={customerNo} onChange={(e) => setCustomerNo(e.target.value)} style={{ display: "block", width: "100%" }} />
      </label>
      <label style={{ display: "block", marginBottom: 8 }}>
        Standaard gewicht (kg)
        <input value={defaultWeightKg} onChange={(e) => setDefaultWeightKg(e.target.value)} style={{ display: "block", width: "100%" }} />
      </label>
      {type === "SHOPIFY" ? (
        <>
          <label style={{ display: "block", marginBottom: 8 }}>
            Shopify domein
            <input value={shopDomain} onChange={(e) => setShopDomain(e.target.value)} style={{ display: "block", width: "100%" }} />
          </label>
          <label style={{ display: "block", marginBottom: 8 }}>
            Access token
            <input value={shopifyAccessToken} onChange={(e) => setShopifyAccessToken(e.target.value)} style={{ display: "block", width: "100%" }} />
          </label>
        </>
      ) : (
        <>
          <label style={{ display: "block", marginBottom: 8 }}>
            Site URL
            <input value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} style={{ display: "block", width: "100%" }} />
          </label>
          <label style={{ display: "block", marginBottom: 8 }}>
            Consumer key
            <input value={wooConsumerKey} onChange={(e) => setWooConsumerKey(e.target.value)} style={{ display: "block", width: "100%" }} />
          </label>
          <label style={{ display: "block", marginBottom: 8 }}>
            Consumer secret
            <input value={wooConsumerSecret} onChange={(e) => setWooConsumerSecret(e.target.value)} style={{ display: "block", width: "100%" }} />
          </label>
        </>
      )}
      <button type="submit">Toevoegen</button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </form>
  );
}
```

- [ ] **Step 5: Run the full test suite**

Run: `cd /home/user/gls/web && npm test`
Expected: PASS (every test across the whole project, unaffected by this page-only task)

- [ ] **Step 6: Verify the build**

Run: `cd /home/user/gls/web && npm run build`
Expected: builds successfully, including the new/modified pages. If Next.js reports an error about `searchParams`/`params` shapes on pages (these also became async-`Promise` in Next 15+, matching route handlers), adjust the page files' signatures to match what the build error reports — the Client Components (`SyncButton`, `PrintButton`, `ReviewForm`, `StoreForm`) are unaffected either way.

- [ ] **Step 7: Commit**

```bash
cd /home/user/gls
git add web/app/page.tsx web/app/SyncButton.tsx web/app/PrintButton.tsx web/app/bestellingen web/app/instellingen
git commit -m "Add dashboard order list, review, and settings pages"
git push origin claude/shopify-gls-automation-9db5j4
```

---

## Self-Review Notes

- **Spec coverage:** shared-password auth with signed cookie and middleware gate (Task 1); Prisma-backed `OrderRepository`/`StoreRepository` with all business logic in injectable, fake-tested functions (Tasks 2-5); order list with status filters, manual sync trigger, review-and-requeue, one-click print returning a PDF (Tasks 3, 6, 8); settings page for store CRUD including the automation toggle (Tasks 4, 7, 8). The spec's explicitly deferred items (scheduled automation, local print agent, credential encryption) are intentionally not implemented here.
- **Placeholder scan:** none found — every step has complete, runnable code. Two steps explicitly anticipate a possible Next.js version-specific adjustment (middleware's redirect-detection assertion in Task 1, and route/page async-param shapes in Tasks 6/8) with concrete guidance on what to check and where the fix belongs, rather than leaving the outcome open-ended.
- **Type consistency:** `OrderRecord`, `OrderFilter`, `OrderEdits`, `DashboardOrderRepository` (Task 2) are used identically across Tasks 3, 5, 6, 8. `StoreRecord`, `StoreInput`, `StoreRepository` (Task 2) are used identically across Tasks 4, 5, 7, 8. `CreateLabelFn`'s signature (Task 3) matches exactly how Task 6 passes the real `createGlsLabel` (sub-project 1) to it. `syncStore`'s signature and `StoreConfig`'s discriminated union (sub-project 2) are used correctly in Task 7's `handleSync`.

# GLS Label API Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a typed, tested TypeScript module (`web/lib/gls/`) that calls GLS's `CreateLabel` API given a normalized shipment and returns a usable label + tracking link, or a clear typed error.

**Architecture:** A brand new minimal Next.js + TypeScript project in `web/` (a new subdirectory of the existing `costello88/gls` repo, which otherwise only contains the Python `gls_sync` desktop tool — untouched by this work). Three layered modules: `client.ts` (low-level authenticated POST wrapper, no GLS-specific knowledge), `createLabel.ts` (builds the GLS request shape, maps the response/errors), and shared `types.ts`/`errors.ts`. No database, UI, or hosting concerns — this plan produces one callable server-side function, fully covered by mocked-`fetch` tests.

**Tech Stack:** Next.js 14, TypeScript 5, Vitest 2 (test runner), Node.js (no browser APIs used in the module itself).

## Global Constraints

- Credentials (`GLS_USERNAME`, `GLS_PASSWORD`) are read only from environment variables inside server-side modules — never hardcoded, never sent to or imported by client-side/browser code.
- `GLS_API_BASE_URL` defaults to `https://api.gls.nl/v1/api` (production) and is overridable via env var for testing against `https://api.gls.nl/test/v1/api`.
- Out of scope for this plan: `ConfirmLabel`, `DeleteLabel`, `CreatePickup`, `CreateShopReturn`, the `services` block, `pickupAddress`, `dimensions`, any UI, database, or order-source integration.
- Single parcel per shipment (one `Unit` per `CreateLabel` call), matching the existing fixed-weight, single-parcel model.
- All new files live under `web/`; nothing at the repo root (the Python `gls_sync` tool) is modified.

---

## File Structure

```
web/
    package.json
    tsconfig.json
    next.config.mjs
    vitest.config.ts
    .gitignore
    app/
        layout.tsx        # minimal placeholder so `next build` succeeds
        page.tsx           # minimal placeholder
    lib/
        gls/
            types.ts        # NormalizedShipment, LabelType, CreateLabelResult
            errors.ts        # GlsApiError
            client.ts         # postGlsApi(): low-level authenticated fetch wrapper
            createLabel.ts     # createGlsLabel(): request/response mapping
            __tests__/
                errors.test.ts
                client.test.ts
                createLabel.test.ts
```

---

### Task 1: Scaffold the Next.js + TypeScript + Vitest project

**Files:**
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/next.config.mjs`
- Create: `web/vitest.config.ts`
- Create: `web/.gitignore`
- Create: `web/app/layout.tsx`
- Create: `web/app/page.tsx`
- Test: `web/lib/__tests__/sanity.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a working `npm test` (Vitest) and `npm run build` (Next.js) in `web/`, which every later task's tests run inside.

- [ ] **Step 1: Create the directory and package.json**

```bash
mkdir -p /home/user/gls/web/app /home/user/gls/web/lib/gls/__tests__ /home/user/gls/web/lib/__tests__
```

`web/package.json`:
```json
{
  "name": "gls-web",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "test": "vitest run"
  },
  "dependencies": {
    "next": "^14.2.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/node": "^20.14.15",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.5.4",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

`web/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create next.config.mjs**

`web/next.config.mjs`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
```

- [ ] **Step 4: Create vitest.config.ts**

`web/vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 5: Create .gitignore**

`web/.gitignore`:
```
node_modules/
.next/
next-env.d.ts
.env
.env.local
```

- [ ] **Step 6: Create minimal placeholder pages**

`web/app/layout.tsx`:
```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`web/app/page.tsx`:
```tsx
export default function Home() {
  return <main>GLS Sync</main>;
}
```

- [ ] **Step 7: Write a sanity test**

`web/lib/__tests__/sanity.test.ts`:
```typescript
import { describe, expect, it } from "vitest";

describe("sanity", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 8: Install dependencies**

Run: `cd /home/user/gls/web && npm install`
Expected: completes without error, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 9: Run the sanity test**

Run: `cd /home/user/gls/web && npm test`
Expected: PASS (1 test) — confirms Vitest is wired up correctly.

- [ ] **Step 10: Commit**

```bash
cd /home/user/gls
git add web/package.json web/package-lock.json web/tsconfig.json web/next.config.mjs web/vitest.config.ts web/.gitignore web/app/layout.tsx web/app/page.tsx web/lib/__tests__/sanity.test.ts
git commit -m "Scaffold Next.js + TypeScript + Vitest project in web/"
```

---

### Task 2: Shared types and error class

**Files:**
- Create: `web/lib/gls/types.ts`
- Create: `web/lib/gls/errors.ts`
- Test: `web/lib/gls/__tests__/errors.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `NormalizedShipment`, `LabelType`, `CreateLabelResult` (types.ts, no runtime behavior); `GlsApiError` class with `httpStatus: number`, `glsStatus?: string`, `glsErrors?: unknown` (errors.ts) — used by Task 4.

- [ ] **Step 1: Write the failing test**

`web/lib/gls/__tests__/errors.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { GlsApiError } from "../errors";

describe("GlsApiError", () => {
  it("stores the http status, gls status, and gls errors", () => {
    const err = new GlsApiError("Something went wrong", 422, "422", { zipCode: "invalid" });

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("GlsApiError");
    expect(err.message).toBe("Something went wrong");
    expect(err.httpStatus).toBe(422);
    expect(err.glsStatus).toBe("422");
    expect(err.glsErrors).toEqual({ zipCode: "invalid" });
  });

  it("allows glsStatus and glsErrors to be omitted", () => {
    const err = new GlsApiError("Unexpected failure", 500);

    expect(err.glsStatus).toBeUndefined();
    expect(err.glsErrors).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/user/gls/web && npx vitest run lib/gls/__tests__/errors.test.ts`
Expected: FAIL with "Cannot find module '../errors'"

- [ ] **Step 3: Write types.ts**

`web/lib/gls/types.ts`:
```typescript
export interface NormalizedShipment {
  name: string;
  street: string;
  houseNo?: string;
  zipCode: string;
  city: string;
  countryCode: "BE" | "NL" | "LU";
  phone?: string;
  email?: string;
  weightKg: number;
  reference: string;
}

export type LabelType = "pdf" | "pdfA6U" | "zpl" | "zpl300";

export interface CreateLabelResult {
  label: string;
  trackingLink: string;
  unitTrackingLink: string;
  transactionId: string;
}
```

- [ ] **Step 4: Write errors.ts**

`web/lib/gls/errors.ts`:
```typescript
export class GlsApiError extends Error {
  readonly httpStatus: number;
  readonly glsStatus?: string;
  readonly glsErrors?: unknown;

  constructor(message: string, httpStatus: number, glsStatus?: string, glsErrors?: unknown) {
    super(message);
    this.name = "GlsApiError";
    this.httpStatus = httpStatus;
    this.glsStatus = glsStatus;
    this.glsErrors = glsErrors;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /home/user/gls/web && npx vitest run lib/gls/__tests__/errors.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
cd /home/user/gls
git add web/lib/gls/types.ts web/lib/gls/errors.ts web/lib/gls/__tests__/errors.test.ts
git commit -m "Add GLS API shared types and GlsApiError"
```

---

### Task 3: Low-level authenticated fetch wrapper

**Files:**
- Create: `web/lib/gls/client.ts`
- Test: `web/lib/gls/__tests__/client.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks (standalone HTTP wrapper).
- Produces: `postGlsApi(path: string, body: unknown): Promise<{ httpStatus: number; json: unknown | null; text: string }>` — used by Task 4.

- [ ] **Step 1: Write the failing test**

`web/lib/gls/__tests__/client.test.ts`:
```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { postGlsApi } from "../client";

describe("postGlsApi", () => {
  const originalFetch = global.fetch;
  const originalBaseUrl = process.env.GLS_API_BASE_URL;

  beforeEach(() => {
    delete process.env.GLS_API_BASE_URL;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalBaseUrl === undefined) {
      delete process.env.GLS_API_BASE_URL;
    } else {
      process.env.GLS_API_BASE_URL = originalBaseUrl;
    }
  });

  it("posts to the default production base URL with the expected request shape", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify({ hello: "world" }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await postGlsApi("/Label/Create", { foo: "bar" });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.gls.nl/v1/api/Label/Create?api-version=1.0",
      {
        method: "POST",
        headers: { "Content-Type": "application/json-patch+json" },
        body: JSON.stringify({ foo: "bar" }),
      },
    );
    expect(result).toEqual({
      httpStatus: 200,
      json: { hello: "world" },
      text: JSON.stringify({ hello: "world" }),
    });
  });

  it("uses GLS_API_BASE_URL when set", async () => {
    process.env.GLS_API_BASE_URL = "https://api.gls.nl/test/v1/api";
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      text: async () => "{}",
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    await postGlsApi("/Authentication/ValidateLogin", { username: "u", password: "p" });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.gls.nl/test/v1/api/Authentication/ValidateLogin?api-version=1.0",
      expect.any(Object),
    );
  });

  it("returns json: null and the raw text when the body is not valid JSON", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 500,
      text: async () => "<html>Internal Server Error</html>",
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await postGlsApi("/Label/Create", {});

    expect(result).toEqual({
      httpStatus: 500,
      json: null,
      text: "<html>Internal Server Error</html>",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/user/gls/web && npx vitest run lib/gls/__tests__/client.test.ts`
Expected: FAIL with "Cannot find module '../client'"

- [ ] **Step 3: Write client.ts**

`web/lib/gls/client.ts`:
```typescript
const DEFAULT_BASE_URL = "https://api.gls.nl/v1/api";

export interface GlsApiResponse {
  httpStatus: number;
  json: unknown | null;
  text: string;
}

export async function postGlsApi(path: string, body: unknown): Promise<GlsApiResponse> {
  const baseUrl = process.env.GLS_API_BASE_URL ?? DEFAULT_BASE_URL;
  const response = await fetch(`${baseUrl}${path}?api-version=1.0`, {
    method: "POST",
    headers: { "Content-Type": "application/json-patch+json" },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let json: unknown | null = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { httpStatus: response.status, json, text };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/user/gls/web && npx vitest run lib/gls/__tests__/client.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
cd /home/user/gls
git add web/lib/gls/client.ts web/lib/gls/__tests__/client.test.ts
git commit -m "Add low-level authenticated GLS API fetch wrapper"
```

---

### Task 4: createGlsLabel — request mapping, response mapping, and error handling

**Files:**
- Create: `web/lib/gls/createLabel.ts`
- Test: `web/lib/gls/__tests__/createLabel.test.ts`

**Interfaces:**
- Consumes: `postGlsApi(path, body)` from `web/lib/gls/client.ts` (Task 3); `GlsApiError` from `web/lib/gls/errors.ts` (Task 2); `NormalizedShipment`, `LabelType`, `CreateLabelResult` from `web/lib/gls/types.ts` (Task 2).
- Produces: `createGlsLabel(shipment: NormalizedShipment, labelType: LabelType, customerNo: string): Promise<CreateLabelResult>` — the final deliverable of this plan.

- [ ] **Step 1: Write the failing tests**

`web/lib/gls/__tests__/createLabel.test.ts`:
```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGlsLabel } from "../createLabel";
import { GlsApiError } from "../errors";
import type { NormalizedShipment } from "../types";

vi.mock("../client", () => ({
  postGlsApi: vi.fn(),
}));

import { postGlsApi } from "../client";

const mockedPostGlsApi = vi.mocked(postGlsApi);

const shipment: NormalizedShipment = {
  name: "Jan Peeters",
  street: "Kerkstraat",
  houseNo: "12A",
  zipCode: "2000",
  city: "Antwerpen",
  countryCode: "BE",
  phone: "+32470123456",
  email: "jan@voorbeeld.be",
  weightKg: 1.5,
  reference: "#1042",
};

beforeEach(() => {
  mockedPostGlsApi.mockReset();
  process.env.GLS_USERNAME = "test-user";
  process.env.GLS_PASSWORD = "test-pass";
});

describe("createGlsLabel", () => {
  it("sends the expected request body", async () => {
    mockedPostGlsApi.mockResolvedValue({
      httpStatus: 200,
      json: {
        error: false,
        transactionId: "txn-1",
        shipmentTrackingLink: "https://track.gls/txn-1",
        labels: "base64-label-data",
        units: [{ unitTrackingLink: "https://track.gls/unit-1" }],
      },
      text: "",
    });

    await createGlsLabel(shipment, "pdf", "11850079");

    expect(mockedPostGlsApi).toHaveBeenCalledWith(
      "/Label/Create",
      expect.objectContaining({
        username: "test-user",
        password: "test-pass",
        customerNo: "11850079",
        shiptype: "p",
        reference: "#1042",
        labelType: "pdf",
        units: [
          expect.objectContaining({
            unitId: "#1042",
            unitType: "co",
            weight: 1.5,
          }),
        ],
        addresses: {
          deliveryAddress: expect.objectContaining({
            name1: "Jan Peeters",
            street: "Kerkstraat",
            houseNo: "12A",
            zipCode: "2000",
            city: "Antwerpen",
            countryCode: "BE",
            phone: "+32470123456",
            email: "jan@voorbeeld.be",
            addresseeType: "p",
          }),
        },
      }),
    );
  });

  it("returns a CreateLabelResult on success", async () => {
    mockedPostGlsApi.mockResolvedValue({
      httpStatus: 200,
      json: {
        error: false,
        transactionId: "txn-1",
        shipmentTrackingLink: "https://track.gls/txn-1",
        labels: "base64-label-data",
        units: [{ unitTrackingLink: "https://track.gls/unit-1" }],
      },
      text: "",
    });

    const result = await createGlsLabel(shipment, "pdf", "11850079");

    expect(result).toEqual({
      label: "base64-label-data",
      trackingLink: "https://track.gls/txn-1",
      unitTrackingLink: "https://track.gls/unit-1",
      transactionId: "txn-1",
    });
  });

  it("throws GlsApiError when error is true inside an HTTP 200 response", async () => {
    mockedPostGlsApi.mockResolvedValue({
      httpStatus: 200,
      json: {
        error: true,
        status: "422",
        message: "A123: Invalid postcode",
        errors: { zipCode: "invalid" },
      },
      text: "",
    });

    await expect(createGlsLabel(shipment, "pdf", "11850079")).rejects.toThrow(GlsApiError);
    await expect(createGlsLabel(shipment, "pdf", "11850079")).rejects.toThrow(
      "A123: Invalid postcode",
    );
  });

  it.each([400, 401, 422, 424])(
    "throws GlsApiError with httpStatus %i for non-200 responses",
    async (httpStatus) => {
      mockedPostGlsApi.mockResolvedValue({
        httpStatus,
        json: {
          error: true,
          status: String(httpStatus),
          message: `Request failed with ${httpStatus}`,
          errors: {},
        },
        text: "",
      });

      try {
        await createGlsLabel(shipment, "pdf", "11850079");
        expect.fail("expected createGlsLabel to throw");
      } catch (err) {
        expect(err).toBeInstanceOf(GlsApiError);
        expect((err as GlsApiError).httpStatus).toBe(httpStatus);
        expect((err as GlsApiError).message).toBe(`Request failed with ${httpStatus}`);
      }
    },
  );

  it("throws GlsApiError when the response body is not JSON", async () => {
    mockedPostGlsApi.mockResolvedValue({
      httpStatus: 200,
      json: null,
      text: "<html>Internal Server Error</html>",
    });

    await expect(createGlsLabel(shipment, "pdf", "11850079")).rejects.toThrow(GlsApiError);
  });

  it("throws GlsApiError when a successful response is missing expected fields", async () => {
    mockedPostGlsApi.mockResolvedValue({
      httpStatus: 200,
      json: { error: false },
      text: "",
    });

    await expect(createGlsLabel(shipment, "pdf", "11850079")).rejects.toThrow(GlsApiError);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/user/gls/web && npx vitest run lib/gls/__tests__/createLabel.test.ts`
Expected: FAIL with "Cannot find module '../createLabel'"

- [ ] **Step 3: Write createLabel.ts**

`web/lib/gls/createLabel.ts`:
```typescript
import { postGlsApi } from "./client";
import { GlsApiError } from "./errors";
import type { CreateLabelResult, LabelType, NormalizedShipment } from "./types";

interface ApiCreateLabelResponse {
  error?: boolean;
  status?: string;
  message?: string;
  errors?: unknown;
  transactionId?: string;
  shipmentTrackingLink?: string;
  labels?: string;
  units?: Array<{ unitTrackingLink?: string }>;
}

export async function createGlsLabel(
  shipment: NormalizedShipment,
  labelType: LabelType,
  customerNo: string,
): Promise<CreateLabelResult> {
  const requestBody = {
    username: process.env.GLS_USERNAME,
    password: process.env.GLS_PASSWORD,
    shippingSystemName: "gls-sync-web",
    shippingSystemVersion: "1.0",
    shiptype: "p",
    customerNo,
    reference: shipment.reference,
    units: [
      {
        unitId: shipment.reference,
        unitType: "co",
        weight: shipment.weightKg,
      },
    ],
    labelType,
    addresses: {
      deliveryAddress: {
        name1: shipment.name,
        street: shipment.street,
        houseNo: shipment.houseNo,
        zipCode: shipment.zipCode,
        city: shipment.city,
        countryCode: shipment.countryCode,
        phone: shipment.phone,
        email: shipment.email,
        addresseeType: "p",
      },
    },
  };

  const response = await postGlsApi("/Label/Create", requestBody);
  const json = response.json as ApiCreateLabelResponse | null;

  if (response.httpStatus !== 200) {
    throw new GlsApiError(
      json?.message ?? `GLS API returned HTTP ${response.httpStatus}`,
      response.httpStatus,
      json?.status,
      json?.errors,
    );
  }

  if (!json) {
    throw new GlsApiError(
      `GLS API returned a non-JSON response: ${response.text}`,
      response.httpStatus,
    );
  }

  if (json.error) {
    throw new GlsApiError(
      json.message ?? "GLS API reported an error",
      response.httpStatus,
      json.status,
      json.errors,
    );
  }

  if (!json.labels || !json.shipmentTrackingLink || !json.transactionId) {
    throw new GlsApiError(
      "GLS API response is missing expected label fields",
      response.httpStatus,
    );
  }

  return {
    label: json.labels,
    trackingLink: json.shipmentTrackingLink,
    unitTrackingLink: json.units?.[0]?.unitTrackingLink ?? "",
    transactionId: json.transactionId,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/user/gls/web && npx vitest run lib/gls/__tests__/createLabel.test.ts`
Expected: PASS (9 tests — 1 request-shape + 1 success-mapping + 1 error-in-200 with 2 assertions + 4 parametrized non-200 cases + 1 non-JSON + 1 missing-fields)

- [ ] **Step 5: Run the full test suite**

Run: `cd /home/user/gls/web && npm test`
Expected: PASS (all tests across sanity.test.ts, errors.test.ts, client.test.ts, createLabel.test.ts)

- [ ] **Step 6: Verify the Next.js project still builds**

Run: `cd /home/user/gls/web && npm run build`
Expected: builds successfully (confirms the new lib files don't break the Next.js build, even though nothing references them from the UI yet)

- [ ] **Step 7: Commit**

```bash
cd /home/user/gls
git add web/lib/gls/createLabel.ts web/lib/gls/__tests__/createLabel.test.ts
git commit -m "Add createGlsLabel with request/response mapping and error handling"
```

---

## Self-Review Notes

- **Spec coverage:** project scaffolding (Task 1), all four spec-named modules `types.ts`/`errors.ts`/`client.ts`/`createLabel.ts` (Tasks 2-4), the exact request mapping table from the spec (Task 4, request-shape test), the exact response mapping rules including the `error: true`-inside-200 case (Task 4), all four named HTTP error statuses 400/401/422/424 (Task 4, parametrized test), non-JSON/unexpected-status handling (Task 4, plus Task 3's client-level non-JSON test), and credentials read only from env vars server-side (Task 4's `requestBody` reads `process.env.GLS_USERNAME`/`GLS_PASSWORD` directly, never passed through any client-exposed path). The spec's explicitly deferred items (`ConfirmLabel`, `services`, `pickupAddress`, `dimensions`, customerNo-to-store mapping) are intentionally not implemented here, matching the spec's non-goals.
- **Placeholder scan:** none found — every step has complete, runnable code.
- **Type consistency:** `NormalizedShipment`, `LabelType`, `CreateLabelResult` (Task 2) are used with identical field names and types in Task 4's `createLabel.ts` and its tests. `GlsApiError`'s constructor signature (Task 2) matches every call site in Task 4. `postGlsApi`'s return shape (Task 3) matches exactly what Task 4's `createLabel.ts` destructures (`httpStatus`, `json`, `text`).

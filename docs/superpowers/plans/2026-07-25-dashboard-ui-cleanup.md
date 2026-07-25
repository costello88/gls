# Dashboard UI Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every inline `style={{...}}` in the dashboard's pages/components with Tailwind CSS v4 utility classes, using GLS's black/yellow brand colors, and add a working logout button — no new routes, no behavior changes.

**Architecture:** Add Tailwind CSS v4 (CSS-first config, no `tailwind.config.js` needed) via `@tailwindcss/postcss`. Build three small shared components (`AppShell`, `LogoutButton`, `StatusBadge`) used across the authenticated pages, then restyle each existing page/component file in place, keeping every existing prop, handler, and data flow untouched.

**Tech Stack:** Next.js 16 (App Router), Tailwind CSS v4, TypeScript, Vitest (existing suite, untouched).

## Global Constraints

- Per the spec (`docs/superpowers/specs/2026-07-25-dashboard-ui-cleanup-design.md`): light theme only, no dark mode, no component library, no new routes/pages, no behavior changes besides adding a visible logout button (the `/api/auth/logout` route already exists).
- Brand colors: black (`zinc-900`/`bg-black`) for primary surfaces (top bar), yellow (`yellow-400`/`yellow-500`) as the accent for primary buttons and active states, neutral `slate` grays elsewhere. Default Tailwind palette — no custom hex values.
- **Local build verification must use `npx next build` directly, not `npm run build`.** The `build` script is `prisma db push --skip-generate && next build` (added so Vercel provisions the schema on deploy) — `prisma db push` requires reaching the production Supabase database, which this development sandbox cannot do (outbound network here is HTTPS-only). Vercel's build environment can reach it and already runs the full script correctly on deploy. Do not change the `build` script as part of this plan.
- `npm test` (Vitest, 85 tests as of the last full run) must keep passing unchanged after every task — this is a styling-only change, so no test file should need editing.
- No dedicated component/page tests are added, per the original dashboard spec's testing section (pages are build-verified only).

---

### Task 1: Install and configure Tailwind CSS v4

**Files:**
- Modify: `web/package.json` (add `tailwindcss` and `@tailwindcss/postcss` to devDependencies)
- Create: `web/postcss.config.mjs`
- Create: `web/app/globals.css`
- Modify: `web/app/layout.tsx`

**Interfaces:**
- Produces: `web/app/globals.css` (imported once, in `layout.tsx`) providing Tailwind utility classes to every page in the app. All later tasks depend on this being in place before using Tailwind classes.

- [ ] **Step 1: Install Tailwind CSS v4**

Run: `cd /home/user/gls/web && npm install -D tailwindcss @tailwindcss/postcss`
Expected: adds both packages to `devDependencies` in `package.json` and updates `package-lock.json`.

- [ ] **Step 2: Write the PostCSS config**

`web/postcss.config.mjs`:
```javascript
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

- [ ] **Step 3: Write the global stylesheet**

`web/app/globals.css`:
```css
@import "tailwindcss";
```

- [ ] **Step 4: Wire the stylesheet into the root layout**

`web/app/layout.tsx`:
```tsx
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Verify the build**

Run: `cd /home/user/gls/web && npx next build`
Expected: builds successfully (Tailwind classes compile into CSS output; no page uses them yet beyond the `<body>` classes above, which is fine).

- [ ] **Step 6: Run the existing test suite**

Run: `cd /home/user/gls/web && npm test`
Expected: PASS (85 tests, unaffected by a CSS-only change).

- [ ] **Step 7: Commit**

```bash
cd /home/user/gls
git add web/package.json web/package-lock.json web/postcss.config.mjs web/app/globals.css web/app/layout.tsx
git commit -m "Add Tailwind CSS v4 and wire it into the root layout"
```

---

### Task 2: Shared components — StatusBadge, LogoutButton, AppShell

**Files:**
- Create: `web/app/components/StatusBadge.tsx`
- Create: `web/app/components/LogoutButton.tsx`
- Create: `web/app/components/AppShell.tsx`

**Interfaces:**
- Consumes: `OrderRecordStatus` from `web/lib/dashboard/types.ts` (sub-project 3, already defined as `"PENDING" | "NEEDS_REVIEW" | "READY" | "PRINTED" | "ERROR"`); the existing `POST /api/auth/logout` route.
- Produces: `StatusBadge({ status: OrderRecordStatus })`, `LogoutButton()`, `AppShell({ children: React.ReactNode })` — all three consumed by Tasks 3-6.

- [ ] **Step 1: Write StatusBadge**

`web/app/components/StatusBadge.tsx`:
```tsx
import type { OrderRecordStatus } from "../../lib/dashboard/types";

const STYLES: Record<OrderRecordStatus, { label: string; className: string }> = {
  PENDING: { label: "In behandeling", className: "bg-slate-100 text-slate-700" },
  NEEDS_REVIEW: { label: "Controleren", className: "bg-amber-100 text-amber-800" },
  READY: { label: "Klaar", className: "bg-blue-100 text-blue-800" },
  PRINTED: { label: "Geprint", className: "bg-green-100 text-green-800" },
  ERROR: { label: "Fout", className: "bg-red-100 text-red-800" },
};

export function StatusBadge({ status }: { status: OrderRecordStatus }) {
  const { label, className } = STYLES[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Write LogoutButton**

`web/app/components/LogoutButton.tsx`:
```tsx
"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function handleClick() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button onClick={handleClick} className="text-sm font-medium text-slate-300 hover:text-white">
      Uitloggen
    </button>
  );
}
```

- [ ] **Step 3: Write AppShell**

`web/app/components/AppShell.tsx`:
```tsx
import Link from "next/link";
import { LogoutButton } from "./LogoutButton";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-zinc-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold text-yellow-400">
            GLS Sync
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/" className="text-sm font-medium text-slate-200 hover:text-white">
              Bestellingen
            </Link>
            <Link href="/instellingen" className="text-sm font-medium text-slate-200 hover:text-white">
              Instellingen
            </Link>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Verify the build**

Run: `cd /home/user/gls/web && npx next build`
Expected: builds successfully. These three components aren't imported anywhere yet, but Next.js/TypeScript still type-checks unused files reachable from the `app/` directory — no errors expected since they only depend on existing types and Next.js primitives.

- [ ] **Step 5: Run the existing test suite**

Run: `cd /home/user/gls/web && npm test`
Expected: PASS (85 tests).

- [ ] **Step 6: Commit**

```bash
cd /home/user/gls
git add web/app/components
git commit -m "Add StatusBadge, LogoutButton, and AppShell shared components"
```

---

### Task 3: Restyle the login page

**Files:**
- Modify: `web/app/login/page.tsx`

**Interfaces:**
- Consumes: nothing new — same `POST /api/auth/login` call as before, same component state and handler logic, unchanged.

- [ ] **Step 1: Restyle the page**

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
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-center text-xl font-bold">
          <span className="text-black">GLS </span>
          <span className="text-yellow-500">Sync</span>
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Wachtwoord</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded bg-yellow-400 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-yellow-500"
          >
            Inloggen
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `cd /home/user/gls/web && npx next build`
Expected: builds successfully.

- [ ] **Step 3: Run the existing test suite**

Run: `cd /home/user/gls/web && npm test`
Expected: PASS (85 tests — there is no test file for this page, so nothing to update).

- [ ] **Step 4: Commit**

```bash
cd /home/user/gls
git add web/app/login/page.tsx
git commit -m "Restyle login page with Tailwind"
```

---

### Task 4: Restyle the dashboard order list

**Files:**
- Modify: `web/app/page.tsx`
- Modify: `web/app/SyncButton.tsx`
- Modify: `web/app/PrintButton.tsx`

**Interfaces:**
- Consumes: `AppShell`, `StatusBadge` from Task 2; `listOrders`, `PrismaOrderRepository`, `OrderRecordStatus` (unchanged, sub-project 3).
- Produces: nothing new for later tasks — this task is a leaf restyle.

- [ ] **Step 1: Restyle the order list page**

`web/app/page.tsx`:
```tsx
import Link from "next/link";
import { listOrders } from "../lib/dashboard/orders";
import { PrismaOrderRepository } from "../lib/repositories/orderRepository";
import type { OrderRecordStatus } from "../lib/dashboard/types";
import { AppShell } from "./components/AppShell";
import { StatusBadge } from "./components/StatusBadge";
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
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          {TABS.map((tab) => (
            <Link
              key={tab.status}
              href={`/?status=${tab.status}`}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                tab.status === activeStatus
                  ? "bg-yellow-400 text-black"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <SyncButton />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Naam</th>
              <th className="px-4 py-3">Adres</th>
              <th className="px-4 py-3">Land</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((order) => (
              <tr key={order.id} className="even:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{order.name}</td>
                <td className="px-4 py-3 text-slate-600">
                  {order.street} {order.houseNo}, {order.zipCode} {order.city}
                </td>
                <td className="px-4 py-3 text-slate-600">{order.countryCode}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={order.status} />
                </td>
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
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Geen bestellingen in deze categorie.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 2: Restyle SyncButton**

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
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded bg-yellow-400 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
      )}
      {loading ? "Bezig..." : "Bestellingen ophalen"}
    </button>
  );
}
```

- [ ] **Step 3: Restyle PrintButton**

`web/app/PrintButton.tsx`:
```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PrintButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setLoading(true);
    const response = await fetch(`/api/orders/${orderId}/print`, { method: "POST" });
    const body = (await response.json()) as { label?: string; error?: string };
    setLoading(false);

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
    <span className="inline-flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded bg-yellow-400 px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Bezig..." : "Printen"}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </span>
  );
}
```

- [ ] **Step 4: Verify the build**

Run: `cd /home/user/gls/web && npx next build`
Expected: builds successfully.

- [ ] **Step 5: Run the existing test suite**

Run: `cd /home/user/gls/web && npm test`
Expected: PASS (85 tests).

- [ ] **Step 6: Commit**

```bash
cd /home/user/gls
git add web/app/page.tsx web/app/SyncButton.tsx web/app/PrintButton.tsx
git commit -m "Restyle dashboard order list with Tailwind"
```

---

### Task 5: Restyle the review page

**Files:**
- Modify: `web/app/bestellingen/[id]/page.tsx`
- Modify: `web/app/bestellingen/[id]/ReviewForm.tsx`

**Interfaces:**
- Consumes: `AppShell` from Task 2; `PrismaOrderRepository`, `OrderRecord` (unchanged, sub-project 3).

- [ ] **Step 1: Restyle the review page**

`web/app/bestellingen/[id]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { PrismaOrderRepository } from "../../../lib/repositories/orderRepository";
import { AppShell } from "../../components/AppShell";
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
    <AppShell>
      <div className="mx-auto max-w-lg rounded-lg bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-xl font-semibold text-slate-900">Bestelling controleren</h1>
        <p className="mb-6 text-sm text-red-600">{order.reviewReason}</p>
        <ReviewForm order={order} />
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 2: Restyle ReviewForm**

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
    <form onSubmit={handleSubmit} className="space-y-4">
      {(Object.keys(fields) as (keyof typeof fields)[]).map((key) => (
        <label key={key} className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">{key}</span>
          <input
            value={fields[key]}
            onChange={set(key)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400"
          />
        </label>
      ))}
      <button
        type="submit"
        className="rounded bg-yellow-400 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-yellow-500"
      >
        Opslaan
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 3: Verify the build**

Run: `cd /home/user/gls/web && npx next build`
Expected: builds successfully.

- [ ] **Step 4: Run the existing test suite**

Run: `cd /home/user/gls/web && npm test`
Expected: PASS (85 tests).

- [ ] **Step 5: Commit**

```bash
cd /home/user/gls
git add web/app/bestellingen
git commit -m "Restyle review page with Tailwind"
```

---

### Task 6: Restyle the settings page

**Files:**
- Modify: `web/app/instellingen/page.tsx`
- Modify: `web/app/instellingen/StoreForm.tsx`

**Interfaces:**
- Consumes: `AppShell` from Task 2; `listStores`, `PrismaStoreRepository` (unchanged, sub-project 3).

- [ ] **Step 1: Restyle the settings page**

`web/app/instellingen/page.tsx`:
```tsx
import { listStores } from "../../lib/dashboard/stores";
import { PrismaStoreRepository } from "../../lib/repositories/storeRepository";
import { AppShell } from "../components/AppShell";
import { StoreForm } from "./StoreForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const repository = new PrismaStoreRepository();
  const stores = await listStores(repository);

  return (
    <AppShell>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Instellingen</h1>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Winkels</h2>
      <ul className="mb-8 space-y-2">
        {stores.map((store) => (
          <li
            key={store.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
          >
            <div>
              <span className="font-medium text-slate-900">{store.name}</span>
              <span className="ml-2 text-sm text-slate-500">({store.type})</span>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                store.automationEnabled ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"
              }`}
            >
              automatisch: {store.automationEnabled ? "aan" : "uit"}
            </span>
          </li>
        ))}
        {stores.length === 0 && (
          <li className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-slate-400">
            Nog geen winkels toegevoegd.
          </li>
        )}
      </ul>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Winkel toevoegen</h2>
      <div className="max-w-lg rounded-lg bg-white p-6 shadow-sm">
        <StoreForm />
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 2: Restyle StoreForm**

`web/app/instellingen/StoreForm.tsx`:
```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const inputClass =
  "w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

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
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className={labelClass}>Type</span>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as "SHOPIFY" | "WOOCOMMERCE")}
          className={inputClass}
        >
          <option value="SHOPIFY">Shopify</option>
          <option value="WOOCOMMERCE">WooCommerce</option>
        </select>
      </label>
      <label className="block">
        <span className={labelClass}>Naam</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </label>
      <label className="block">
        <span className={labelClass}>GLS klantnummer</span>
        <input value={customerNo} onChange={(e) => setCustomerNo(e.target.value)} className={inputClass} />
      </label>
      <label className="block">
        <span className={labelClass}>Standaard gewicht (kg)</span>
        <input value={defaultWeightKg} onChange={(e) => setDefaultWeightKg(e.target.value)} className={inputClass} />
      </label>
      {type === "SHOPIFY" ? (
        <>
          <label className="block">
            <span className={labelClass}>Shopify domein</span>
            <input value={shopDomain} onChange={(e) => setShopDomain(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Access token</span>
            <input
              value={shopifyAccessToken}
              onChange={(e) => setShopifyAccessToken(e.target.value)}
              className={inputClass}
            />
          </label>
        </>
      ) : (
        <>
          <label className="block">
            <span className={labelClass}>Site URL</span>
            <input value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Consumer key</span>
            <input
              value={wooConsumerKey}
              onChange={(e) => setWooConsumerKey(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Consumer secret</span>
            <input
              value={wooConsumerSecret}
              onChange={(e) => setWooConsumerSecret(e.target.value)}
              className={inputClass}
            />
          </label>
        </>
      )}
      <button
        type="submit"
        className="rounded bg-yellow-400 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-yellow-500"
      >
        Toevoegen
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 3: Verify the build**

Run: `cd /home/user/gls/web && npx next build`
Expected: builds successfully.

- [ ] **Step 4: Run the existing test suite**

Run: `cd /home/user/gls/web && npm test`
Expected: PASS (85 tests).

- [ ] **Step 5: Commit**

```bash
cd /home/user/gls
git add web/app/instellingen
git commit -m "Restyle settings page with Tailwind"
```

---

### Task 7: Final verification and push

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `cd /home/user/gls/web && npm test`
Expected: PASS (85 tests).

- [ ] **Step 2: Verify the build one more time**

Run: `cd /home/user/gls/web && npx next build`
Expected: builds successfully, all routes listed with no errors (same route list as before this plan — no new routes were added).

- [ ] **Step 3: Push to trigger the Vercel deploy**

```bash
cd /home/user/gls
git push origin claude/shopify-gls-automation-9db5j4
```

Expected: push succeeds. Vercel is already connected to this branch and will auto-deploy; its build environment can reach the production database, so the `prisma db push` step in `npm run build` will succeed there even though it couldn't be run locally in this sandbox.

---

## Self-Review Notes

- **Spec coverage:** Tailwind v4 setup (Task 1); `AppShell`/`LogoutButton`/`StatusBadge` shared components (Task 2); every page/component listed in the spec's "Modified" section is restyled (Tasks 3-6); empty states for the order list and store list (Tasks 4, 6); GLS black/yellow branding on the top bar and every primary button (Tasks 2-6); light theme only, no dark mode, no component library — none introduced anywhere in this plan.
- **Placeholder scan:** none found — every step has complete, runnable code and exact file paths.
- **Type consistency:** `OrderRecordStatus`, `OrderRecord`, `StoreRecord` are used exactly as already defined in `web/lib/dashboard/types.ts` — no new types introduced, no renames. `AppShell`, `LogoutButton`, `StatusBadge` (Task 2) are imported with matching names and prop shapes in Tasks 3-6.

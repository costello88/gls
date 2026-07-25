# GLS Label API Client — Design Spec

## Context

The business has fully migrated off the GLS Label Lite desktop software onto
**MyGLS Print&Ship**, and separately confirmed that GLS exposes a genuine
first-party REST API (`api.gls.nl`) for creating shipping labels
programmatically (`CreateLabel`, `ConfirmLabel`, `ValidateLogin`, etc.),
authenticated with the same username/password used to log into MyGLS
Print&Ship.

This unlocks a fundamentally better architecture than the CSV-export +
manual-import workflow built for GLS Label Lite: an order can go directly
from Shopify/WooCommerce to a printed label with no file download, no
import wizard, and (with a local print agent, built in a later sub-project)
no manual click at all.

This spec covers the **first and foundational piece only**: a backend
module that calls GLS's `CreateLabel` endpoint given a normalized shipment
and returns a usable label. Everything else in the larger plan (order
ingestion from multiple sources, the hosted dashboard, the automation
toggle, the local print agent) depends on this working correctly, so it is
built and proven first, in isolation.

## Goals

- A typed, testable TypeScript function that turns a normalized shipment
  into a GLS label (PDF or ZPL bytes) plus a tracking link, or a clear
  error.
- Zero dependency on any database, UI, or hosting concerns — pure request
  building + response parsing + error mapping, callable from any future
  API route.
- Credentials never leave the server (Vercel environment variables only,
  never sent to or bundled into client-side code).

## Non-goals (for this sub-project)

- `ConfirmLabel`, `DeleteLabel`, `CreatePickup`, `CreateShopReturn` and
  other operations — out of scope until a concrete need for them is
  identified. Confirmed via the API docs that `CreateLabel` alone returns
  a usable label and tracking link; whether/when `ConfirmLabel` needs to
  be called afterward is not yet understood and will be investigated when
  building the sub-project that actually prints/confirms shipments.
- The `services` block (COD, age check, Saturday delivery, express, etc.)
  — not used by the business today.
- `pickupAddress` — omitted so GLS falls back to the account's registered
  sender address.
- `dimensions` — optional per GLS's schema; only `weight` is required,
  matching the existing fixed-weight, single-parcel model already used by
  the Windows desktop tool.
- Any UI, database, order-source integration, or print-agent code — those
  are separate sub-projects with their own specs.

## Where this lives

A new `web/` directory in the existing `costello88/gls` repository: a
fresh Next.js + TypeScript project, intended for deployment to Vercel from
that subdirectory. This keeps the new hosted system in the same repo as
the existing Windows desktop tool without entangling the two — the
desktop tool's Python code is untouched by this work.

## File structure

```
web/
    lib/
        gls/
            types.ts        # TS types for the subset of GLS's schema we use
            client.ts        # low-level authenticated fetch wrapper
            createLabel.ts    # createGlsLabel(shipment, labelType) -> result
            errors.ts         # GlsApiError
    lib/gls/__tests__/
        createLabel.test.ts
```

## Interface

```typescript
// types.ts
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
  reference: string; // e.g. Shopify/WooCommerce order number
}

export type LabelType = "pdf" | "pdfA6U" | "zpl" | "zpl300";

export interface CreateLabelResult {
  label: string; // base64 or raw string, as returned by GLS for the requested labelType
  trackingLink: string;
  unitTrackingLink: string;
  transactionId: string;
}
```

```typescript
// createLabel.ts
export async function createGlsLabel(
  shipment: NormalizedShipment,
  labelType: LabelType,
  customerNo: string,
): Promise<CreateLabelResult>; // throws GlsApiError on failure
```

```typescript
// errors.ts
export class GlsApiError extends Error {
  readonly httpStatus: number;
  readonly glsStatus?: string;
  readonly glsErrors?: unknown;
}
```

## Request mapping

`createGlsLabel` builds a GLS `InboundCreateDeliveryRequest` body:

| GLS field | Source |
|---|---|
| `username` / `password` | server-side env vars (`GLS_USERNAME` / `GLS_PASSWORD`) |
| `customerNo` | function parameter (caller decides which GLS account/sender this shipment bills to) |
| `shiptype` | always `"p"` (package) |
| `reference` | `shipment.reference` |
| `units` | one `Unit`: `unitId` = `shipment.reference`, `unitType` = `"co"` (Collo/parcel), `weight` = `shipment.weightKg` |
| `labelType` | function parameter |
| `addresses.deliveryAddress` | `name1` = `shipment.name`, `street` = `shipment.street`, `houseNo` = `shipment.houseNo`, `zipCode` = `shipment.zipCode`, `city` = `shipment.city`, `countryCode` = `shipment.countryCode`, `phone` = `shipment.phone`, `email` = `shipment.email`, `addresseeType` = `"p"` (private) |

`shippingSystemName`/`shippingSystemVersion` are sent as a fixed
identifying string (e.g. `"gls-sync-web"` / a version constant) so GLS can
see which integration is calling, matching common API etiquette.

## Response mapping

On HTTP 200, `ApiCreateLabelResponseObject.error` is checked first (GLS
uses HTTP 200 with `error: true` for some failure cases per their docs) —
if true, throw `GlsApiError` using `status`/`message`/`errors`. Otherwise,
return a `CreateLabelResult` built from the top-level `labels` field, the
top-level `shipmentTrackingLink`, and the first entry in `units[]` for
`unitTrackingLink` (single-parcel shipments only, matching the existing
one-parcel-per-order model).

On HTTP 400/401/422/424, parse the `ApiResponseObject` body
(`error`/`status`/`message`/`errors`) and throw `GlsApiError` with the
GLS-provided message, the HTTP status, and the raw `errors` object
attached for debugging.

On any other unexpected HTTP status or a response body that fails to
parse as JSON, throw `GlsApiError` with the raw HTTP status and response
text, so failures are never silently swallowed.

## Configuration

- `GLS_API_BASE_URL` — `https://api.gls.nl/v1/api` (production) or
  `https://api.gls.nl/test/v1/api` (test), env-configurable so the test
  environment can be exercised without touching production.
- `GLS_USERNAME` / `GLS_PASSWORD` — the MyGLS Print&Ship login, read only
  server-side.

## Testing

Vitest, with `fetch` mocked (no real network calls in tests):

- A successful `createGlsLabel` call: verify the outgoing request body
  matches the expected shape for a representative `NormalizedShipment`,
  and that a well-formed `ApiCreateLabelResponseObject` response is parsed
  into the expected `CreateLabelResult`.
- `error: true` inside an HTTP 200 response: verify it throws
  `GlsApiError` with the GLS-provided message.
- Each of HTTP 400, 401, 422, 424: verify each maps to a `GlsApiError`
  with the correct `httpStatus` and message.
- A non-JSON or unexpected-status response: verify it still throws a
  `GlsApiError` rather than an unhandled parse exception.
- Credentials are read from environment variables and never appear in the
  constructed request logged anywhere in plaintext (basic smoke check on
  logging, since this project logs requests for debugging — see plan).

## Open questions for later sub-projects (explicitly deferred)

- Which `customerNo` (of the three seen: `11850079`, `11850080`,
  `11851423`) maps to which store/sender — decided when building the
  multi-source order ingestion and dashboard settings sub-project, not
  here.
- Whether `ConfirmLabel` needs to be called after `CreateLabel` for a
  shipment to actually be picked up/billed correctly — investigated when
  building the sub-project that wires this up to real order flow.
- PDF vs. ZPL choice for the print agent — decided in the print-agent
  sub-project; this client supports both by parameter today.

# Shopify → GLS Label Lite Sync — Design Spec

## Problem

Orders come in through Shopify and must currently be copied by hand into GLS
Label Lite (a Windows desktop app) to create shipping labels. This is slow
and error-prone, especially for recipient email/phone fields.

GLS Label Lite supports importing shipments from a CSV file (menu: `Extra` →
`Import & export` → `Import addressees/shipments`), with a column-mapping
wizard that lets the operator map arbitrary CSV columns to Label Lite fields
once and reuse that mapping on every import. This means the sync tool does
not need to match an undocumented fixed schema — it only needs to produce a
clean, consistent CSV.

## Goals

- Eliminate manual retyping of order/address data into GLS Label Lite.
- Catch copy errors in email and phone number fields before they reach a
  label, rather than silently shipping bad data.
- Run unattended in the background on the user's Windows PC, with a system
  tray icon for status and manual control.
- Ship as a single `.exe` — no Python install required on the target PC.

## Non-goals

- Driving GLS Label Lite's UI directly (clicking its Import menu for the
  user). Rejected as too fragile — breaks on GLS UI updates or unexpected
  dialogs. The user still performs the one Import click themselves.
- Per-order weight calculation from product data. Weight is fixed per
  parcel (a single configurable setting).
- Writing back to Shopify (e.g. marking orders fulfilled). Out of scope for
  this iteration.

## Architecture

One Python program, `gls_sync`, packaged with PyInstaller into `gls-sync.exe`,
with two cooperating parts in a single process:

1. **Sync engine** — runs on a timer (default every 5 minutes, configurable).
   Each tick:
   - Calls the Shopify Admin REST API for orders where
     `financial_status=paid` and `fulfillment_status=unfulfilled`
     (`GET /admin/api/2024-*/orders.json?financial_status=paid&fulfillment_status=unfulfilled`),
     paginated via `since_id`/page_info as needed.
   - Skips any order whose ID is already present in local `state.json`
     (i.e. already exported previously, regardless of its current Shopify
     status).
   - For each new order, runs the **validation step** (see below).
     - Orders that pass: appended as a row to `pending_import.csv`.
     - Orders that fail: appended as a row to `needs_review.csv`, with an
       extra `reden` (reason) column explaining what looked wrong.
   - Records every processed order ID (valid or not) in `state.json` so it
     is never re-added on a later tick, even after manual correction (a
     corrected row is edited directly in `needs_review.csv`/moved to
     `pending_import.csv` by the user, not re-fetched).
   - On any Shopify API error (network failure, invalid/expired token,
     rate limit), the tick aborts without modifying state or files, and the
     tray enters a warning state. The next timer tick retries normally.

2. **Tray icon** — a persistent Windows system tray icon (via `pystray`)
   with a right-click menu:
   - **Sync now** — triggers an immediate sync tick outside the timer.
   - **Open import folder** — opens the `GLS Import` folder in Explorer.
   - **Mark as imported** — archives the current `pending_import.csv` into
     an `Imported/` subfolder with a timestamped filename
     (`pending_import_2026-07-22_1435.csv`) and starts a new empty
     `pending_import.csv`. Does not touch `state.json` (IDs stay recorded
     permanently, so archived orders never reappear).
   - **Settings** — opens a small window to set the Shopify store domain,
     Admin API access token, fixed parcel weight, sync interval, and a
     "run at Windows startup" checkbox.
   - **Quit**.

   Tray icon states: normal (idle, count of pending orders in tooltip),
   syncing (brief spinner state during a tick), warning (last sync failed,
   or `needs_review.csv` has unresolved rows — tooltip explains why).

## Data flow

```
Shopify Admin API
      │  (paid + unfulfilled orders, polled every N minutes)
      ▼
 validate email/phone ──fail──► needs_review.csv  (+ tray warning)
      │ pass
      ▼
 pending_import.csv  ◄── user imports into GLS Label Lite (manual, 1 click)
      │
   "Mark as imported" (tray menu)
      ▼
 Imported/pending_import_<timestamp>.csv   (archived, never reused)

state.json: permanent record of every order ID ever processed (pass or fail)
```

Files live under `%USERPROFILE%\Documents\GLS Import\`:
`pending_import.csv`, `needs_review.csv`, `Imported\`, `state.json`,
`settings.json` (token stored here, local file only, never transmitted
anywhere but to `*.myshopify.com`).

## CSV column mapping

Both `pending_import.csv` and `needs_review.csv` share these columns (Dutch
labels, matching GLS Label Lite's own UI language):

| Column        | Source                                                        |
|---------------|-----------------------------------------------------------------|
| Naam          | `shipping_address.name`                                        |
| Bedrijf       | `shipping_address.company` (blank if none)                      |
| Straat        | Street part of `shipping_address.address1`                     |
| Huisnummer    | House-number part of `shipping_address.address1`                |
| Postcode      | `shipping_address.zip`                                          |
| Plaats        | `shipping_address.city`                                         |
| Land          | `shipping_address.country_code` (must be BE, NL, or LU)        |
| Telefoon      | `shipping_address.phone` (falls back to `customer.phone`)      |
| Email         | `customer.email` / `contact_email`                              |
| Referentie    | Shopify order number (e.g. `#1042`)                              |
| Gewicht       | Fixed weight setting (kg), same for every row                   |
| Aantal colli  | `1` (fixed)                                                      |

`needs_review.csv` has one additional trailing column, **Reden**, e.g.
`"Telefoon: te kort"` or `"Email: ontbreekt '@'"`.

Street/house-number splitting: `address1` is split on the last run of
digits (optionally followed by a letter/suffix like `12A` or `12 bus 3`),
e.g. `"Kerkstraat 12A"` → Straat=`Kerkstraat`, Huisnummer=`12A`. If no
digit sequence is found, the whole string goes into Straat and Huisnummer
is left blank — that row still passes validation (address format isn't
part of the double-check), so it lands in `pending_import.csv`; the
operator can still eyeball it in the import wizard's preview per GLS's
own UI.

## Validation ("double check") rules

Applied per order before it's classified as pass/fail:

- **Email**: must match a standard `local@domain.tld` pattern. Missing or
  malformed → fail, reason `"Email: ongeldig of ontbrekend"`.
- **Phone**: normalize (strip spaces/dashes), then must match one of:
  - `+32`/`0032` followed by 8-9 digits (Belgium)
  - `+31`/`0031` followed by 9 digits (Netherlands)
  - `+352`/`00352` followed by 6-9 digits (Luxembourg)
  - a local `0`-prefixed 9-10 digit number (assumed same country as the
    shipping address)
  Anything else → fail, reason `"Telefoon: ongeldig formaat"`.
- Both checks run independently; an order can fail on one or both fields
  (reason lists both, semicolon-separated).
- Country code (Land) must be one of BE/NL/LU; anything else also fails
  with `"Land: niet ondersteund (verwacht BE, NL of LU)"`, since these are
  the only lanes this tool supports.

Failing orders are never dropped — they always land in `needs_review.csv`
so nothing is silently lost, only silently *wrong* data is kept out of the
GLS import.

## Shopify setup (one-time, done by the user with guidance)

1. Shopify admin → Settings → Apps and sales channels → Develop apps →
   Create an app.
2. Configure Admin API scopes: `read_orders` (and `read_customers` if
   phone/email come back better via the customer object than the order's
   own contact fields — confirmed during implementation).
3. Install the app on the store, copy the Admin API access token.
4. Paste the store domain (`xxx.myshopify.com`) and token into the tray
   app's Settings on first run.

## Packaging & startup

- Built with PyInstaller (`--onefile --windowed`) into `gls-sync.exe`.
- Settings checkbox toggles a Windows Registry `Run` key entry (or a
  Startup-folder shortcut) so the app launches automatically at login.
- No installer required — the user places the `.exe` wherever they like
  and runs it.

## Error handling summary

| Situation                          | Behavior                                                        |
|-------------------------------------|-------------------------------------------------------------------|
| Shopify unreachable / API error    | Tray → warning; tick aborts cleanly; retried next tick             |
| Invalid/expired API token          | Tray → warning with explicit "check Settings" tooltip              |
| Order fails validation             | Row goes to `needs_review.csv`; tray → warning with count          |
| `pending_import.csv` in use (Label Lite has it open) | Write retried with backoff; if still locked, skipped this tick, retried next tick |

## Testing

- Unit tests for: address splitting, email validation, phone validation
  (per BE/NL/LU pattern), CSV row construction, state dedup logic — all
  pure functions, testable without any live Shopify/GLS access.
- A small fixture set of sample Shopify order JSON payloads (valid,
  bad email, bad phone, missing address parts, non-BE/NL/LU country) used
  to test the classify/split/validate pipeline end-to-end.
- Manual test: point Settings at a Shopify dev store, place a handful of
  test orders covering the fixture cases, confirm they land in the right
  file with the right reason text.

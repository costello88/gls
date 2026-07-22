# GLS Sync

Polls Shopify for paid, unfulfilled orders and writes them to CSV files
ready for GLS Label Lite's import wizard, so you no longer retype orders
by hand. Runs as a Windows system tray app.

See `docs/superpowers/specs/2026-07-22-shopify-gls-sync-design.md` for the
full design.

## One-time Shopify setup

1. In Shopify admin: Settings → Apps and sales channels → Develop apps →
   Create an app.
2. Configure Admin API scopes: `read_orders`.
3. Install the app, copy the Admin API access token.
4. Create `Documents/GLS Import/settings.json` (or let the app create a
   default one on first run and edit it) with your store domain and
   token, e.g.:

   ```json
   {
     "shop_domain": "yourstore.myshopify.com",
     "access_token": "shpat_xxxxxxxxxxxx",
     "weight_kg": 1.0,
     "interval_minutes": 5,
     "run_at_startup": false
   }
   ```

## Day-to-day use

1. `gls-sync.exe` runs in the background and checks Shopify every few
   minutes (configurable via `interval_minutes` in `settings.json`).
2. New paid & unfulfilled orders are validated (email/phone/country) and
   written to `Documents/GLS Import/pending_import.csv`. Anything that
   fails validation goes to `needs_review.csv` instead, with a `Reden`
   column explaining why (e.g. bad email, bad phone, unsupported country).
3. When you're ready to print labels: in GLS Label Lite, `Extra` → `Import
   & export` → `Import addressees/shipments` → select `pending_import.csv`.
4. Right-click the tray icon → `Mark as imported` to archive that file
   into `Documents/GLS Import/Imported/` and start a fresh one. Orders
   already archived are never re-added, even if Shopify still shows them
   as unfulfilled.
5. Fix anything in `needs_review.csv` by hand, or correct it in Shopify —
   it will not be re-fetched automatically once it's been seen once.

## Development

```bash
pip install -r requirements.txt
python -m pytest
```

## Packaging

```bash
pip install pyinstaller
pyinstaller build.spec
```

Produces `dist/gls-sync.exe`.

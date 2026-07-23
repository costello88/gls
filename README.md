# GLS Sync

Polls Shopify for paid, unfulfilled orders and writes them to CSV files
ready for GLS Label Lite's import wizard, so you no longer retype orders
by hand. Runs as a Windows system tray app with a Dutch-language
dashboard.

See `docs/superpowers/specs/2026-07-22-shopify-gls-sync-design.md` for the
full design.

## One-time Shopify setup

Shopify credentials are never shown or editable in the dashboard UI.
There are two ways they reach the app:

### Baked into every build (used for distributing to coworkers)

Add two repository secrets (Settings → Secrets and variables → Actions →
New repository secret): `SHOPIFY_SHOP_DOMAIN` and `SHOPIFY_ACCESS_TOKEN`.
Every time `build-exe.yml` runs, it injects these into
`gls_sync/default_settings.json` before packaging, so the resulting
`gls-sync.exe` works immediately for anyone who downloads it from that
build's Artifacts — no setup step at all. On first run, each machine
copies those baked-in values into its own local
`Documents/GLS Import/settings.json`, which you can still edit per-machine
afterward (e.g. a different `weight_kg`) without needing to rebuild.

**Security note:** anyone who has the `.exe` can extract the token from
it (it's not real protection against a determined person), and anyone who
can trigger a build in this repo can see/use it. Only distribute the
`.exe` to people you'd trust with direct API access to this store's
orders, and rotate the token in Shopify if that ever changes.

### Manual, per-machine (if you'd rather not bake in real credentials)

1. In Shopify admin: Settings → Apps and sales channels → Develop apps →
   Create an app.
2. Configure Admin API scopes: `read_orders`.
3. Install the app, copy the Admin API access token.
4. Create `Documents/GLS Import/settings.json` (or run `gls-sync.exe`
   once to let it create a default one, then edit it) with your store
   domain and token:

   ```json
   {
     "shop_domain": "yourstore.myshopify.com",
     "access_token": "shpat_xxxxxxxxxxxx",
     "weight_kg": 1.0,
     "interval_minutes": 5,
     "run_at_startup": false,
     "labellite_path": ""
   }
   ```

## Starting GLS Sync together with GLS Label Lite

GLS Sync's dashboard has a "Pad naar GLS Label Lite" (Path to GLS Label
Lite) field where you point it at your `LabelLite.exe`. Once set:

1. Create a new shortcut anywhere (Desktop is easiest): right-click →
   New → Shortcut.
2. As the target, enter: `"C:\path\to\gls-sync.exe" --start-labellite`
   (use the actual path where you keep `gls-sync.exe`).
3. Use that new shortcut instead of your old GLS Label Lite shortcut from
   now on. Each time you launch it, GLS Sync starts in the background
   (if it isn't already running) and then GLS Label Lite opens as usual.

You can also just enable "Automatisch starten bij het opstarten van
Windows" in the dashboard if you'd rather have GLS Sync always running
from login, regardless of when you open Label Lite.

## Day-to-day use

1. `gls-sync.exe` runs in the background and checks Shopify every few
   minutes (configurable in the dashboard, or via `interval_minutes` in
   `settings.json`).
2. New paid & unfulfilled orders are validated (email/phone/country) and
   written to `Documents/GLS Import/pending_import.csv`. Anything that
   fails validation goes to `needs_review.csv` instead, with a `Reden`
   column explaining why (e.g. bad email, bad phone, unsupported country).
3. When you're ready to print labels: in GLS Label Lite, `Extra` → `Import
   & export` → `Import addressees/shipments` → select `pending_import.csv`.
   The file uses `;` (semicolon) as the column separator, matching what
   Label Lite expects — its column-mapping wizard should show each column
   (Naam, Bedrijf, Straat, Huisnummer, Postcode, Plaats, Land, Telefoon,
   Email, Referentie, Gewicht, Aantal colli, Verpakking) split out
   separately rather than as one blob. Map each one once — `Aantal colli`
   goes to Label Lite's "Aantal eenheden" field, and `Verpakking` (always
   `PCO`, standard parcel) goes to Label Lite's "Verpakking" field. Label
   Lite remembers the mapping for future imports.
4. In the dashboard (or tray menu), use:
   - **Bestellingen ophalen** — fetch new orders from Shopify right now.
   - **Map openen** — opens `Documents/GLS Import` in Explorer.
   - **Als geïmporteerd markeren** — archives the current
     `pending_import.csv` into `Documents/GLS Import/Imported/` and
     starts a fresh one. Orders already archived are never re-added, even
     if Shopify still shows them as unfulfilled.
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

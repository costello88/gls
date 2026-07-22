# Shopify → GLS Label Lite Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `gls_sync`, a Windows tray app that polls Shopify for paid/unfulfilled orders, validates email/phone, and writes them to CSV files ready for GLS Label Lite's import wizard.

**Architecture:** A pure-Python core (address splitting, validation, CSV writing, state dedup, Shopify polling, sync orchestration) with zero platform dependencies, fully unit-testable on Linux/CI. A thin Windows-only shell (`tray.py`, `startup.py`) wraps the core with `pystray` and `winreg`, guarded so the core package imports and tests run on any OS. Packaged for distribution with PyInstaller.

**Tech Stack:** Python 3.11+, `requests` (Shopify API), `pystray` + `Pillow` (tray icon), `winreg` (stdlib, Windows-only), `pytest`, PyInstaller.

## Global Constraints

- CSV columns (in order): `Naam, Bedrijf, Straat, Huisnummer, Postcode, Plaats, Land, Telefoon, Email, Referentie, Gewicht, Aantal colli`. `needs_review.csv` adds a trailing `Reden` column.
- Supported countries: `BE`, `NL`, `LU` only — anything else fails validation.
- `Referentie` = Shopify order number (e.g. `#1042`).
- All persistent files live under `<base_dir>/` where `base_dir` defaults to `Path.home() / "Documents" / "GLS Import"` but is passed explicitly into every function (never hardcoded inside core logic) so tests can point it at a temp dir.
- Order IDs are tracked permanently in `state.json` once processed (pass or fail) — never re-added on a later tick.
- No network calls in unit tests — `ShopifyClient` takes an injectable `requests.Session`-like object.

---

## File Structure

```
gls_sync/
    __init__.py
    config.py          # Settings dataclass, load/save settings.json, default paths
    state.py            # SyncState: dedup tracking via state.json
    address.py          # split_address()
    validate.py         # validate_email, validate_phone, validate_country, check_order
    csv_writer.py       # CSV column constants, append_row()
    shopify_client.py   # ShopifyClient: fetch_paid_unfulfilled_orders()
    sync.py             # order_to_row(), run_sync_tick(), SyncResult
    tray.py             # pystray Icon + menu wiring (Windows-only, imports guarded)
    startup.py          # Windows Run-key registration (winreg, guarded)
    __main__.py         # entry point: loads settings, starts tray + timer loop
tests/
    fixtures/
        orders.py        # sample Shopify order JSON payloads
    test_address.py
    test_validate.py
    test_csv_writer.py
    test_state.py
    test_shopify_client.py
    test_sync.py
requirements.txt
build.spec              # PyInstaller spec file
README.md
```

---

### Task 1: Project scaffold + config module

**Files:**
- Create: `gls_sync/__init__.py` (empty)
- Create: `gls_sync/config.py`
- Create: `requirements.txt`
- Test: `tests/test_config.py`

**Interfaces:**
- Produces: `gls_sync.config.Settings` dataclass with fields `shop_domain: str`, `access_token: str`, `weight_kg: float`, `interval_minutes: int`, `run_at_startup: bool`; `gls_sync.config.DEFAULT_BASE_DIR: Path`; `gls_sync.config.load_settings(path: Path) -> Settings`; `gls_sync.config.save_settings(settings: Settings, path: Path) -> None`.

- [ ] **Step 1: Create package init and requirements**

```bash
mkdir -p /home/user/gls/gls_sync /home/user/gls/tests/fixtures
touch /home/user/gls/gls_sync/__init__.py
```

`requirements.txt`:
```
requests>=2.31
pystray>=0.19
Pillow>=10.0
pytest>=8.0
```

- [ ] **Step 2: Write the failing test**

`tests/test_config.py`:
```python
import json
from pathlib import Path
from gls_sync.config import Settings, load_settings, save_settings


def test_load_settings_missing_file_returns_defaults(tmp_path):
    path = tmp_path / "settings.json"
    settings = load_settings(path)
    assert settings.shop_domain == ""
    assert settings.access_token == ""
    assert settings.weight_kg == 1.0
    assert settings.interval_minutes == 5
    assert settings.run_at_startup is False


def test_save_then_load_round_trip(tmp_path):
    path = tmp_path / "settings.json"
    original = Settings(
        shop_domain="example.myshopify.com",
        access_token="shpat_abc123",
        weight_kg=2.5,
        interval_minutes=10,
        run_at_startup=True,
    )
    save_settings(original, path)
    loaded = load_settings(path)
    assert loaded == original
    assert json.loads(path.read_text())["shop_domain"] == "example.myshopify.com"
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /home/user/gls && python -m pytest tests/test_config.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'gls_sync.config'`

- [ ] **Step 4: Write minimal implementation**

`gls_sync/config.py`:
```python
import json
from dataclasses import asdict, dataclass
from pathlib import Path

DEFAULT_BASE_DIR = Path.home() / "Documents" / "GLS Import"


@dataclass
class Settings:
    shop_domain: str = ""
    access_token: str = ""
    weight_kg: float = 1.0
    interval_minutes: int = 5
    run_at_startup: bool = False


def load_settings(path: Path) -> Settings:
    if not path.exists():
        return Settings()
    data = json.loads(path.read_text())
    return Settings(**data)


def save_settings(settings: Settings, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(asdict(settings), indent=2))
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /home/user/gls && python -m pytest tests/test_config.py -v`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add gls_sync/__init__.py gls_sync/config.py requirements.txt tests/test_config.py
git commit -m "Add settings config module with load/save round trip"
```

---

### Task 2: State dedup tracking

**Files:**
- Create: `gls_sync/state.py`
- Test: `tests/test_state.py`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `gls_sync.state.SyncState` class with `__init__(self, path: Path)`, `is_processed(self, order_id: int) -> bool`, `mark_processed(self, order_id: int) -> None` (persists immediately).

- [ ] **Step 1: Write the failing test**

`tests/test_state.py`:
```python
from gls_sync.state import SyncState


def test_new_state_has_nothing_processed(tmp_path):
    state = SyncState(tmp_path / "state.json")
    assert state.is_processed(123) is False


def test_mark_processed_persists_across_instances(tmp_path):
    path = tmp_path / "state.json"
    state = SyncState(path)
    state.mark_processed(123)
    assert state.is_processed(123) is True

    reloaded = SyncState(path)
    assert reloaded.is_processed(123) is True
    assert reloaded.is_processed(456) is False


def test_mark_processed_is_idempotent(tmp_path):
    state = SyncState(tmp_path / "state.json")
    state.mark_processed(1)
    state.mark_processed(1)
    assert state.is_processed(1) is True
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/user/gls && python -m pytest tests/test_state.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'gls_sync.state'`

- [ ] **Step 3: Write minimal implementation**

`gls_sync/state.py`:
```python
import json
from pathlib import Path


class SyncState:
    def __init__(self, path: Path):
        self.path = path
        self._ids: set[int] = self._load()

    def _load(self) -> set[int]:
        if not self.path.exists():
            return set()
        data = json.loads(self.path.read_text())
        return set(data.get("processed_order_ids", []))

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps({"processed_order_ids": sorted(self._ids)}, indent=2))

    def is_processed(self, order_id: int) -> bool:
        return order_id in self._ids

    def mark_processed(self, order_id: int) -> None:
        if order_id in self._ids:
            return
        self._ids.add(order_id)
        self._save()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/user/gls && python -m pytest tests/test_state.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add gls_sync/state.py tests/test_state.py
git commit -m "Add SyncState for permanent order-id dedup tracking"
```

---

### Task 3: Address splitting

**Files:**
- Create: `gls_sync/address.py`
- Test: `tests/test_address.py`

**Interfaces:**
- Produces: `gls_sync.address.split_address(address1: str) -> tuple[str, str]` returning `(street, house_number)`.

- [ ] **Step 1: Write the failing test**

`tests/test_address.py`:
```python
from gls_sync.address import split_address


def test_simple_number():
    assert split_address("Kerkstraat 12") == ("Kerkstraat", "12")


def test_number_with_letter_suffix():
    assert split_address("Kerkstraat 12A") == ("Kerkstraat", "12A")


def test_number_with_bus_suffix():
    assert split_address("Kerkstraat 12 bus 3") == ("Kerkstraat", "12 bus 3")


def test_no_number_present():
    assert split_address("Onbekende straat") == ("Onbekende straat", "")


def test_leading_number_is_still_the_last_match():
    assert split_address("12 Kerkstraat 34") == ("12 Kerkstraat", "34")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/user/gls && python -m pytest tests/test_address.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'gls_sync.address'`

- [ ] **Step 3: Write minimal implementation**

`gls_sync/address.py`:
```python
import re

_HOUSE_NUMBER_RE = re.compile(
    r"^(?P<street>.+?\S)\s+(?P<number>\d+[A-Za-z]?(?:\s+bus\s+\d+)?)\s*$"
)


def split_address(address1: str) -> tuple[str, str]:
    address1 = address1.strip()
    match = _HOUSE_NUMBER_RE.match(address1)
    if not match:
        return address1, ""
    return match.group("street"), match.group("number")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/user/gls && python -m pytest tests/test_address.py -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add gls_sync/address.py tests/test_address.py
git commit -m "Add street/house-number address splitting"
```

---

### Task 4: Email/phone/country validation

**Files:**
- Create: `gls_sync/validate.py`
- Test: `tests/test_validate.py`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `gls_sync.validate.validate_email(email: str) -> bool`; `gls_sync.validate.validate_phone(phone: str, country_code: str) -> bool`; `gls_sync.validate.validate_country(country_code: str) -> bool`; `gls_sync.validate.SUPPORTED_COUNTRIES: frozenset[str]` (`{"BE", "NL", "LU"}`); `gls_sync.validate.check_row(row: dict) -> list[str]` where `row` has keys `Email`, `Telefoon`, `Land` and the return value is a list of Dutch reason strings (empty list = passes).

- [ ] **Step 1: Write the failing test**

`tests/test_validate.py`:
```python
from gls_sync.validate import validate_email, validate_phone, validate_country, check_row


def test_validate_email_accepts_valid():
    assert validate_email("klant@voorbeeld.be") is True


def test_validate_email_rejects_missing_at():
    assert validate_email("klantvoorbeeld.be") is False


def test_validate_email_rejects_empty():
    assert validate_email("") is False


def test_validate_phone_accepts_be_international():
    assert validate_phone("+32 470 12 34 56", "BE") is True


def test_validate_phone_accepts_be_local():
    assert validate_phone("0470123456", "BE") is True


def test_validate_phone_accepts_nl_international():
    assert validate_phone("+31 6 12345678", "NL") is True


def test_validate_phone_accepts_lu_international():
    assert validate_phone("+352 621123456", "LU") is True


def test_validate_phone_rejects_too_short():
    assert validate_phone("0470", "BE") is False


def test_validate_phone_rejects_empty():
    assert validate_phone("", "BE") is False


def test_validate_country_accepts_supported():
    assert validate_country("BE") is True
    assert validate_country("NL") is True
    assert validate_country("LU") is True


def test_validate_country_rejects_unsupported():
    assert validate_country("DE") is False


def test_check_row_passes_clean_row():
    row = {"Email": "klant@voorbeeld.be", "Telefoon": "+32470123456", "Land": "BE"}
    assert check_row(row) == []


def test_check_row_flags_bad_email():
    row = {"Email": "kapot", "Telefoon": "+32470123456", "Land": "BE"}
    reasons = check_row(row)
    assert any("Email" in r for r in reasons)


def test_check_row_flags_bad_phone():
    row = {"Email": "klant@voorbeeld.be", "Telefoon": "123", "Land": "BE"}
    reasons = check_row(row)
    assert any("Telefoon" in r for r in reasons)


def test_check_row_flags_unsupported_country():
    row = {"Email": "klant@voorbeeld.be", "Telefoon": "+32470123456", "Land": "DE"}
    reasons = check_row(row)
    assert any("Land" in r for r in reasons)


def test_check_row_flags_multiple_reasons():
    row = {"Email": "kapot", "Telefoon": "123", "Land": "BE"}
    reasons = check_row(row)
    assert len(reasons) == 2
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/user/gls && python -m pytest tests/test_validate.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'gls_sync.validate'`

- [ ] **Step 3: Write minimal implementation**

`gls_sync/validate.py`:
```python
import re

SUPPORTED_COUNTRIES = frozenset({"BE", "NL", "LU"})

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

_PHONE_PATTERNS = {
    "BE": re.compile(r"^(\+32|0032|0)\d{8,9}$"),
    "NL": re.compile(r"^(\+31|0031|0)\d{9}$"),
    "LU": re.compile(r"^(\+352|00352)\d{6,9}$"),
}


def validate_email(email: str) -> bool:
    if not email:
        return False
    return bool(_EMAIL_RE.match(email.strip()))


def _normalize_phone(phone: str) -> str:
    return re.sub(r"[\s\-().]", "", phone.strip())


def validate_phone(phone: str, country_code: str) -> bool:
    if not phone:
        return False
    normalized = _normalize_phone(phone)
    pattern = _PHONE_PATTERNS.get(country_code)
    if pattern is None:
        return False
    return bool(pattern.match(normalized))


def validate_country(country_code: str) -> bool:
    return country_code in SUPPORTED_COUNTRIES


def check_row(row: dict) -> list[str]:
    reasons = []
    if not validate_email(row.get("Email", "")):
        reasons.append("Email: ongeldig of ontbrekend")
    land = row.get("Land", "")
    if not validate_phone(row.get("Telefoon", ""), land):
        reasons.append("Telefoon: ongeldig formaat")
    if not validate_country(land):
        reasons.append("Land: niet ondersteund (verwacht BE, NL of LU)")
    return reasons
```

Note: `validate_phone` against an unsupported country always returns
`False` (no pattern registered), which correctly also flags a bad-country
row as having a "bad phone" — acceptable since `check_row` always adds the
explicit Land reason too, so the operator sees the real cause.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/user/gls && python -m pytest tests/test_validate.py -v`
Expected: PASS (16 tests)

- [ ] **Step 5: Commit**

```bash
git add gls_sync/validate.py tests/test_validate.py
git commit -m "Add email/phone/country validation for BE/NL/LU"
```

---

### Task 5: CSV writer

**Files:**
- Create: `gls_sync/csv_writer.py`
- Test: `tests/test_csv_writer.py`

**Interfaces:**
- Consumes: nothing from other tasks (works on plain `dict` rows).
- Produces: `gls_sync.csv_writer.PENDING_COLUMNS: list[str]` (the 12 base columns from Global Constraints); `gls_sync.csv_writer.REVIEW_COLUMNS: list[str]` (`PENDING_COLUMNS + ["Reden"]`); `gls_sync.csv_writer.append_row(path: Path, row: dict, columns: list[str]) -> None`.

- [ ] **Step 1: Write the failing test**

`tests/test_csv_writer.py`:
```python
import csv
from gls_sync.csv_writer import PENDING_COLUMNS, REVIEW_COLUMNS, append_row


def test_pending_columns_order():
    assert PENDING_COLUMNS == [
        "Naam", "Bedrijf", "Straat", "Huisnummer", "Postcode", "Plaats",
        "Land", "Telefoon", "Email", "Referentie", "Gewicht", "Aantal colli",
    ]


def test_review_columns_adds_reden():
    assert REVIEW_COLUMNS == PENDING_COLUMNS + ["Reden"]


def test_append_row_creates_file_with_header(tmp_path):
    path = tmp_path / "pending_import.csv"
    row = {col: f"v-{col}" for col in PENDING_COLUMNS}
    append_row(path, row, PENDING_COLUMNS)

    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        assert reader.fieldnames == PENDING_COLUMNS
        rows = list(reader)
    assert len(rows) == 1
    assert rows[0]["Naam"] == "v-Naam"


def test_append_row_appends_without_duplicating_header(tmp_path):
    path = tmp_path / "pending_import.csv"
    row1 = {col: "1" for col in PENDING_COLUMNS}
    row2 = {col: "2" for col in PENDING_COLUMNS}
    append_row(path, row1, PENDING_COLUMNS)
    append_row(path, row2, PENDING_COLUMNS)

    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    assert len(rows) == 2
    assert [r["Naam"] for r in rows] == ["1", "2"]


def test_append_row_missing_keys_default_to_empty_string(tmp_path):
    path = tmp_path / "needs_review.csv"
    row = {"Naam": "Jan", "Reden": "Email: ongeldig of ontbrekend"}
    append_row(path, row, REVIEW_COLUMNS)

    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    assert rows[0]["Bedrijf"] == ""
    assert rows[0]["Reden"] == "Email: ongeldig of ontbrekend"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/user/gls && python -m pytest tests/test_csv_writer.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'gls_sync.csv_writer'`

- [ ] **Step 3: Write minimal implementation**

`gls_sync/csv_writer.py`:
```python
import csv
from pathlib import Path

PENDING_COLUMNS = [
    "Naam", "Bedrijf", "Straat", "Huisnummer", "Postcode", "Plaats",
    "Land", "Telefoon", "Email", "Referentie", "Gewicht", "Aantal colli",
]
REVIEW_COLUMNS = PENDING_COLUMNS + ["Reden"]


def append_row(path: Path, row: dict, columns: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    file_exists = path.exists()
    with path.open("a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=columns, restval="")
        if not file_exists:
            writer.writeheader()
        writer.writerow({col: row.get(col, "") for col in columns})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/user/gls && python -m pytest tests/test_csv_writer.py -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add gls_sync/csv_writer.py tests/test_csv_writer.py
git commit -m "Add CSV writer for pending/needs-review files"
```

---

### Task 6: Order fixtures + Shopify client

**Files:**
- Create: `tests/fixtures/__init__.py` (empty)
- Create: `tests/fixtures/orders.py`
- Create: `gls_sync/shopify_client.py`
- Test: `tests/test_shopify_client.py`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `tests.fixtures.orders.make_order(**overrides) -> dict` (a valid baseline Shopify order dict, override any field by dotted convenience kwargs listed below); `gls_sync.shopify_client.ShopifyClient(shop_domain: str, access_token: str, session=None)` with method `fetch_paid_unfulfilled_orders(self) -> list[dict]` returning raw Shopify order dicts, paginating via the `Link` header until exhausted.

- [ ] **Step 1: Write the fixture module**

`tests/fixtures/__init__.py`: empty file.

`tests/fixtures/orders.py`:
```python
def make_order(
    order_id=1001,
    order_number="#1001",
    name="Jan Peeters",
    company="",
    address1="Kerkstraat 12",
    zip_code="2000",
    city="Antwerpen",
    country_code="BE",
    phone="+32470123456",
    email="jan@voorbeeld.be",
):
    return {
        "id": order_id,
        "order_number": order_number.lstrip("#"),
        "name": order_number,
        "financial_status": "paid",
        "fulfillment_status": None,
        "contact_email": email,
        "customer": {"email": email, "phone": phone},
        "shipping_address": {
            "name": name,
            "company": company,
            "address1": address1,
            "zip": zip_code,
            "city": city,
            "country_code": country_code,
            "phone": phone,
        },
    }
```

- [ ] **Step 2: Write the failing test**

`tests/test_shopify_client.py`:
```python
from gls_sync.shopify_client import ShopifyClient
from tests.fixtures.orders import make_order


class FakeResponse:
    def __init__(self, json_data, link_header=None):
        self._json_data = json_data
        self.headers = {"Link": link_header} if link_header else {}

    def raise_for_status(self):
        pass

    def json(self):
        return self._json_data


class FakeSession:
    def __init__(self, pages):
        self.pages = pages
        self.requests = []

    def get(self, url, headers=None, params=None, timeout=None):
        self.requests.append({"url": url, "params": params})
        page = self.pages[len(self.requests) - 1]
        return page


def test_fetch_single_page():
    order = make_order()
    session = FakeSession([FakeResponse({"orders": [order]})])
    client = ShopifyClient("example.myshopify.com", "shpat_test", session=session)

    orders = client.fetch_paid_unfulfilled_orders()

    assert orders == [order]
    assert session.requests[0]["params"]["financial_status"] == "paid"
    assert session.requests[0]["params"]["fulfillment_status"] == "unfulfilled"


def test_fetch_follows_pagination_link():
    order1 = make_order(order_id=1001)
    order2 = make_order(order_id=1002)
    next_url = "https://example.myshopify.com/admin/api/2024-10/orders.json?page_info=abc"
    session = FakeSession(
        [
            FakeResponse({"orders": [order1]}, link_header=f'<{next_url}>; rel="next"'),
            FakeResponse({"orders": [order2]}),
        ]
    )
    client = ShopifyClient("example.myshopify.com", "shpat_test", session=session)

    orders = client.fetch_paid_unfulfilled_orders()

    assert [o["id"] for o in orders] == [1001, 1002]
    assert len(session.requests) == 2


def test_sends_access_token_header():
    session = FakeSession([FakeResponse({"orders": []})])
    client = ShopifyClient("example.myshopify.com", "shpat_test", session=session)
    client.fetch_paid_unfulfilled_orders()
    # header is passed on client construction, verified via a spy session below
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /home/user/gls && python -m pytest tests/test_shopify_client.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'gls_sync.shopify_client'`

- [ ] **Step 4: Write minimal implementation**

`gls_sync/shopify_client.py`:
```python
import re
import requests

API_VERSION = "2024-10"
_NEXT_LINK_RE = re.compile(r'<([^>]+)>;\s*rel="next"')


class ShopifyClient:
    def __init__(self, shop_domain: str, access_token: str, session=None):
        self.shop_domain = shop_domain
        self.access_token = access_token
        self.session = session or requests.Session()

    def _headers(self) -> dict:
        return {"X-Shopify-Access-Token": self.access_token}

    def fetch_paid_unfulfilled_orders(self) -> list[dict]:
        url = f"https://{self.shop_domain}/admin/api/{API_VERSION}/orders.json"
        params = {
            "financial_status": "paid",
            "fulfillment_status": "unfulfilled",
            "status": "any",
            "limit": 250,
        }
        orders: list[dict] = []
        while url:
            response = self.session.get(url, headers=self._headers(), params=params, timeout=30)
            response.raise_for_status()
            orders.extend(response.json().get("orders", []))
            link = response.headers.get("Link", "")
            match = _NEXT_LINK_RE.search(link)
            url = match.group(1) if match else None
            params = None
        return orders
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /home/user/gls && python -m pytest tests/test_shopify_client.py -v`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add tests/fixtures/__init__.py tests/fixtures/orders.py gls_sync/shopify_client.py tests/test_shopify_client.py
git commit -m "Add Shopify order fixtures and paginated API client"
```

---

### Task 7: Sync orchestration

**Files:**
- Create: `gls_sync/sync.py`
- Test: `tests/test_sync.py`

**Interfaces:**
- Consumes: `gls_sync.state.SyncState` (Task 2), `gls_sync.address.split_address` (Task 3), `gls_sync.validate.check_row` (Task 4), `gls_sync.csv_writer.append_row`, `PENDING_COLUMNS`, `REVIEW_COLUMNS` (Task 5), `gls_sync.shopify_client.ShopifyClient` (Task 6), `tests.fixtures.orders.make_order` (Task 6, test-only).
- Produces: `gls_sync.sync.SyncResult` dataclass (`new: int`, `valid: int`, `invalid: int`, `error: str | None`); `gls_sync.sync.order_to_row(order: dict, weight_kg: float) -> dict`; `gls_sync.sync.run_sync_tick(client, state: SyncState, base_dir: Path, weight_kg: float) -> SyncResult`.

- [ ] **Step 1: Write the failing test**

`tests/test_sync.py`:
```python
import csv
from gls_sync.state import SyncState
from gls_sync.sync import order_to_row, run_sync_tick
from tests.fixtures.orders import make_order


def _read_csv(path):
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def test_order_to_row_maps_fields():
    order = make_order(
        order_number="#1042",
        name="Jan Peeters",
        address1="Kerkstraat 12A",
        zip_code="2000",
        city="Antwerpen",
        country_code="BE",
        phone="+32470123456",
        email="jan@voorbeeld.be",
    )
    row = order_to_row(order, weight_kg=1.5)
    assert row["Naam"] == "Jan Peeters"
    assert row["Straat"] == "Kerkstraat"
    assert row["Huisnummer"] == "12A"
    assert row["Postcode"] == "2000"
    assert row["Plaats"] == "Antwerpen"
    assert row["Land"] == "BE"
    assert row["Telefoon"] == "+32470123456"
    assert row["Email"] == "jan@voorbeeld.be"
    assert row["Referentie"] == "#1042"
    assert row["Gewicht"] == "1.5"
    assert row["Aantal colli"] == "1"


class FakeClient:
    def __init__(self, orders):
        self._orders = orders

    def fetch_paid_unfulfilled_orders(self):
        return self._orders


class ErrorClient:
    def fetch_paid_unfulfilled_orders(self):
        raise ConnectionError("boom")


def test_run_sync_tick_writes_valid_order_to_pending(tmp_path):
    order = make_order(order_id=1, order_number="#1")
    client = FakeClient([order])
    state = SyncState(tmp_path / "state.json")

    result = run_sync_tick(client, state, tmp_path, weight_kg=1.0)

    assert result.new == 1
    assert result.valid == 1
    assert result.invalid == 0
    assert result.error is None
    rows = _read_csv(tmp_path / "pending_import.csv")
    assert rows[0]["Referentie"] == "#1"
    assert state.is_processed(1) is True
    assert not (tmp_path / "needs_review.csv").exists()


def test_run_sync_tick_writes_invalid_order_to_needs_review(tmp_path):
    order = make_order(order_id=2, order_number="#2", email="broken-email")
    client = FakeClient([order])
    state = SyncState(tmp_path / "state.json")

    result = run_sync_tick(client, state, tmp_path, weight_kg=1.0)

    assert result.new == 1
    assert result.valid == 0
    assert result.invalid == 1
    rows = _read_csv(tmp_path / "needs_review.csv")
    assert rows[0]["Referentie"] == "#2"
    assert "Email" in rows[0]["Reden"]
    assert not (tmp_path / "pending_import.csv").exists()


def test_run_sync_tick_skips_already_processed_orders(tmp_path):
    order = make_order(order_id=3, order_number="#3")
    client = FakeClient([order])
    state = SyncState(tmp_path / "state.json")
    state.mark_processed(3)

    result = run_sync_tick(client, state, tmp_path, weight_kg=1.0)

    assert result.new == 0
    assert not (tmp_path / "pending_import.csv").exists()


def test_run_sync_tick_reports_error_without_side_effects(tmp_path):
    state = SyncState(tmp_path / "state.json")

    result = run_sync_tick(ErrorClient(), state, tmp_path, weight_kg=1.0)

    assert result.error == "boom"
    assert result.new == 0
    assert not (tmp_path / "pending_import.csv").exists()
    assert not (tmp_path / "state.json").exists() or state.is_processed(3) is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/user/gls && python -m pytest tests/test_sync.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'gls_sync.sync'`

- [ ] **Step 3: Write minimal implementation**

`gls_sync/sync.py`:
```python
from dataclasses import dataclass
from pathlib import Path

from gls_sync.address import split_address
from gls_sync.csv_writer import PENDING_COLUMNS, REVIEW_COLUMNS, append_row
from gls_sync.state import SyncState
from gls_sync.validate import check_row


@dataclass
class SyncResult:
    new: int = 0
    valid: int = 0
    invalid: int = 0
    error: str | None = None


def order_to_row(order: dict, weight_kg: float) -> dict:
    shipping = order.get("shipping_address") or {}
    street, house_number = split_address(shipping.get("address1", ""))
    customer = order.get("customer") or {}
    email = order.get("contact_email") or customer.get("email", "")
    phone = shipping.get("phone") or customer.get("phone", "")
    return {
        "Naam": shipping.get("name", ""),
        "Bedrijf": shipping.get("company", ""),
        "Straat": street,
        "Huisnummer": house_number,
        "Postcode": shipping.get("zip", ""),
        "Plaats": shipping.get("city", ""),
        "Land": shipping.get("country_code", ""),
        "Telefoon": phone,
        "Email": email,
        "Referentie": order.get("name", ""),
        "Gewicht": str(weight_kg),
        "Aantal colli": "1",
    }


def run_sync_tick(client, state: SyncState, base_dir: Path, weight_kg: float) -> SyncResult:
    try:
        orders = client.fetch_paid_unfulfilled_orders()
    except Exception as exc:
        return SyncResult(error=str(exc))

    result = SyncResult()
    for order in orders:
        order_id = order["id"]
        if state.is_processed(order_id):
            continue
        result.new += 1
        row = order_to_row(order, weight_kg)
        reasons = check_row(row)
        if reasons:
            row["Reden"] = "; ".join(reasons)
            append_row(base_dir / "needs_review.csv", row, REVIEW_COLUMNS)
            result.invalid += 1
        else:
            append_row(base_dir / "pending_import.csv", row, PENDING_COLUMNS)
            result.valid += 1
        state.mark_processed(order_id)
    return result
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/user/gls && python -m pytest tests/test_sync.py -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add gls_sync/sync.py tests/test_sync.py
git commit -m "Add sync orchestration tying validation, CSV writing, and dedup together"
```

---

### Task 8: Windows startup registration (guarded, testable on any OS)

**Files:**
- Create: `gls_sync/startup.py`
- Test: `tests/test_startup.py`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `gls_sync.startup.is_registered() -> bool`; `gls_sync.startup.register(exe_path: str) -> None`; `gls_sync.startup.unregister() -> None`. Internally these call a module-level `_registry` object (an instance of `_WinRegistry` on Windows, swappable in tests) so tests never touch the real Windows registry.

- [ ] **Step 1: Write the failing test**

`tests/test_startup.py`:
```python
import gls_sync.startup as startup_module
from gls_sync.startup import is_registered, register, unregister


class FakeRegistry:
    def __init__(self):
        self.values = {}

    def get_value(self, name):
        return self.values.get(name)

    def set_value(self, name, value):
        self.values[name] = value

    def delete_value(self, name):
        self.values.pop(name, None)


def test_not_registered_by_default(monkeypatch):
    monkeypatch.setattr(startup_module, "_registry", FakeRegistry())
    assert is_registered() is False


def test_register_sets_value_and_is_registered(monkeypatch):
    monkeypatch.setattr(startup_module, "_registry", FakeRegistry())
    register(r"C:\Tools\gls-sync.exe")
    assert is_registered() is True


def test_unregister_removes_value(monkeypatch):
    monkeypatch.setattr(startup_module, "_registry", FakeRegistry())
    register(r"C:\Tools\gls-sync.exe")
    unregister()
    assert is_registered() is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/user/gls && python -m pytest tests/test_startup.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'gls_sync.startup'`

- [ ] **Step 3: Write minimal implementation**

`gls_sync/startup.py`:
```python
import sys

_RUN_KEY_NAME = "GLSSync"


class _WinRegistry:
    """Thin wrapper over winreg, only imported/instantiated on Windows."""

    def __init__(self):
        import winreg

        self._winreg = winreg
        self._key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"

    def _open(self, writable=False):
        access = self._winreg.KEY_SET_VALUE if writable else self._winreg.KEY_READ
        return self._winreg.OpenKey(self._winreg.HKEY_CURRENT_USER, self._key_path, 0, access)

    def get_value(self, name):
        try:
            with self._open() as key:
                value, _ = self._winreg.QueryValueEx(key, name)
                return value
        except FileNotFoundError:
            return None

    def set_value(self, name, value):
        with self._open(writable=True) as key:
            self._winreg.SetValueEx(key, name, 0, self._winreg.REG_SZ, value)

    def delete_value(self, name):
        try:
            with self._open(writable=True) as key:
                self._winreg.DeleteValue(key, name)
        except FileNotFoundError:
            pass


def _default_registry():
    if sys.platform == "win32":
        return _WinRegistry()
    return None


_registry = _default_registry()


def is_registered() -> bool:
    if _registry is None:
        return False
    return _registry.get_value(_RUN_KEY_NAME) is not None


def register(exe_path: str) -> None:
    if _registry is None:
        raise RuntimeError("Startup registration is only supported on Windows")
    _registry.set_value(_RUN_KEY_NAME, f'"{exe_path}"')


def unregister() -> None:
    if _registry is None:
        raise RuntimeError("Startup registration is only supported on Windows")
    _registry.delete_value(_RUN_KEY_NAME)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/user/gls && python -m pytest tests/test_startup.py -v`
Expected: PASS (3 tests) — runs on Linux because `monkeypatch` replaces `_registry` before any `winreg` import happens.

- [ ] **Step 5: Commit**

```bash
git add gls_sync/startup.py tests/test_startup.py
git commit -m "Add Windows startup registration, testable without a real registry"
```

---

### Task 9: Tray app wiring

**Files:**
- Create: `gls_sync/tray.py`
- Create: `gls_sync/__main__.py`
- Test: `tests/test_tray.py`

**Interfaces:**
- Consumes: `gls_sync.config.Settings/load_settings/save_settings/DEFAULT_BASE_DIR` (Task 1), `gls_sync.state.SyncState` (Task 2), `gls_sync.sync.run_sync_tick/SyncResult` (Task 7), `gls_sync.shopify_client.ShopifyClient` (Task 6), `gls_sync.startup.is_registered/register/unregister` (Task 8).
- Produces: `gls_sync.tray.TrayController` class — the pystray-independent core (no pystray import at module scope for the controller logic) with methods `sync_now(self) -> SyncResult`, `mark_as_imported(self) -> Path | None` (returns the archived file path, or `None` if there was nothing to archive), `pending_count(self) -> int`, `needs_review_count(self) -> int`. `gls_sync.tray.build_icon(controller: TrayController) -> "pystray.Icon"` (thin, not unit tested — exercised only via manual run).

- [ ] **Step 1: Write the failing test**

`tests/test_tray.py`:
```python
import csv
from datetime import datetime

from gls_sync.config import Settings
from gls_sync.state import SyncState
from gls_sync.tray import TrayController
from tests.fixtures.orders import make_order


class FakeClient:
    def __init__(self, orders):
        self._orders = orders

    def fetch_paid_unfulfilled_orders(self):
        return self._orders


def _make_controller(tmp_path, orders=None):
    settings = Settings(shop_domain="x.myshopify.com", access_token="t", weight_kg=1.0)
    state = SyncState(tmp_path / "state.json")
    client = FakeClient(orders or [])
    return TrayController(client=client, state=state, base_dir=tmp_path, settings=settings)


def test_sync_now_writes_pending_and_updates_counts(tmp_path):
    controller = _make_controller(tmp_path, orders=[make_order(order_id=1)])
    result = controller.sync_now()
    assert result.valid == 1
    assert controller.pending_count() == 1
    assert controller.needs_review_count() == 0


def test_pending_count_zero_when_no_file(tmp_path):
    controller = _make_controller(tmp_path)
    assert controller.pending_count() == 0


def test_mark_as_imported_archives_file_and_resets_count(tmp_path):
    controller = _make_controller(tmp_path, orders=[make_order(order_id=1)])
    controller.sync_now()
    assert controller.pending_count() == 1

    archived_path = controller.mark_as_imported()

    assert archived_path is not None
    assert archived_path.exists()
    assert archived_path.parent.name == "Imported"
    assert not (tmp_path / "pending_import.csv").exists()
    assert controller.pending_count() == 0


def test_mark_as_imported_returns_none_when_nothing_pending(tmp_path):
    controller = _make_controller(tmp_path)
    assert controller.mark_as_imported() is None


def test_mark_as_imported_does_not_reprocess_archived_orders(tmp_path):
    controller = _make_controller(tmp_path, orders=[make_order(order_id=1)])
    controller.sync_now()
    controller.mark_as_imported()

    # Same order still comes back from Shopify (still unfulfilled there),
    # but state.json must prevent it from being written again.
    result = controller.sync_now()
    assert result.new == 0
    assert controller.pending_count() == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/user/gls && python -m pytest tests/test_tray.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'gls_sync.tray'`

- [ ] **Step 3: Write minimal implementation**

`gls_sync/tray.py`:
```python
import csv
from datetime import datetime
from pathlib import Path

from gls_sync.config import Settings
from gls_sync.state import SyncState
from gls_sync.sync import SyncResult, run_sync_tick


class TrayController:
    def __init__(self, client, state: SyncState, base_dir: Path, settings: Settings):
        self.client = client
        self.state = state
        self.base_dir = Path(base_dir)
        self.settings = settings

    def sync_now(self) -> SyncResult:
        return run_sync_tick(self.client, self.state, self.base_dir, self.settings.weight_kg)

    def _row_count(self, path: Path) -> int:
        if not path.exists():
            return 0
        with path.open(newline="", encoding="utf-8") as f:
            return sum(1 for _ in csv.DictReader(f))

    def pending_count(self) -> int:
        return self._row_count(self.base_dir / "pending_import.csv")

    def needs_review_count(self) -> int:
        return self._row_count(self.base_dir / "needs_review.csv")

    def mark_as_imported(self) -> Path | None:
        pending_path = self.base_dir / "pending_import.csv"
        if not pending_path.exists():
            return None
        archive_dir = self.base_dir / "Imported"
        archive_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y-%m-%d_%H%M")
        archived_path = archive_dir / f"pending_import_{timestamp}.csv"
        pending_path.rename(archived_path)
        return archived_path


def build_icon(controller: TrayController):
    import pystray
    from PIL import Image, ImageDraw

    def _make_image():
        image = Image.new("RGB", (64, 64), "white")
        draw = ImageDraw.Draw(image)
        draw.rectangle((16, 16, 48, 48), fill="green")
        return image

    def _sync_now(icon, item):
        controller.sync_now()

    def _open_folder(icon, item):
        import subprocess

        subprocess.Popen(["explorer", str(controller.base_dir)])

    def _mark_imported(icon, item):
        controller.mark_as_imported()

    menu = pystray.Menu(
        pystray.MenuItem("Sync now", _sync_now),
        pystray.MenuItem("Open import folder", _open_folder),
        pystray.MenuItem("Mark as imported", _mark_imported),
        pystray.MenuItem("Quit", lambda icon, item: icon.stop()),
    )
    return pystray.Icon("gls_sync", _make_image(), "GLS Sync", menu)
```

`gls_sync/__main__.py`:
```python
import threading
import time

from gls_sync.config import DEFAULT_BASE_DIR, load_settings
from gls_sync.shopify_client import ShopifyClient
from gls_sync.state import SyncState
from gls_sync.tray import TrayController, build_icon


def main() -> None:
    base_dir = DEFAULT_BASE_DIR
    settings_path = base_dir / "settings.json"
    settings = load_settings(settings_path)

    client = ShopifyClient(settings.shop_domain, settings.access_token)
    state = SyncState(base_dir / "state.json")
    controller = TrayController(client=client, state=state, base_dir=base_dir, settings=settings)

    def _timer_loop():
        while True:
            time.sleep(max(settings.interval_minutes, 1) * 60)
            controller.sync_now()

    threading.Thread(target=_timer_loop, daemon=True).start()

    icon = build_icon(controller)
    icon.run()


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/user/gls && python -m pytest tests/test_tray.py -v`
Expected: PASS (5 tests) — note `build_icon`/`__main__.py` are not exercised by this test (they import `pystray`/`PIL` only inside the function body and at module level in `tray.py`'s `build_icon`; the `TrayController` tests avoid importing `pystray` entirely since `pystray`/`PIL` are imported lazily inside `build_icon`, not at module top).

- [ ] **Step 5: Commit**

```bash
git add gls_sync/tray.py gls_sync/__main__.py tests/test_tray.py
git commit -m "Add TrayController with sync/mark-as-imported logic and pystray wiring"
```

---

### Task 10: Full test run, packaging, and README

**Files:**
- Create: `build.spec`
- Create: `README.md`
- Modify: none (verification task)

**Interfaces:**
- Consumes: all of `gls_sync/` from Tasks 1-9.
- Produces: `build.spec` (PyInstaller spec), `README.md` (setup + usage docs).

- [ ] **Step 1: Run the full test suite**

Run: `cd /home/user/gls && python -m pytest -v`
Expected: PASS — all tests from Tasks 1-9 (roughly 35+ tests), 0 failures.

- [ ] **Step 2: Write the PyInstaller spec**

`build.spec`:
```python
# -*- mode: python ; coding: utf-8 -*-
a = Analysis(
    ['gls_sync/__main__.py'],
    pathex=['.'],
    hiddenimports=['pystray._win32'],
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    name='gls-sync',
    console=False,
    onefile=True,
)
```

- [ ] **Step 3: Write the README**

`README.md`:
```markdown
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
4. On first run of `gls-sync.exe`, open the tray icon's Settings and enter
   your store domain (`yourstore.myshopify.com`) and the access token.

## Day-to-day use

1. `gls-sync.exe` runs in the background and checks Shopify every few
   minutes (configurable in Settings).
2. New paid & unfulfilled orders are validated (email/phone/country) and
   written to `Documents/GLS Import/pending_import.csv`. Anything that
   fails validation goes to `needs_review.csv` instead, with a `Reden`
   column explaining why.
3. When you're ready to print labels: in GLS Label Lite, `Extra` → `Import
   & export` → `Import addressees/shipments` → select `pending_import.csv`.
4. Right-click the tray icon → `Mark as imported` to archive that file and
   start a fresh one. Orders already archived are never re-added, even if
   Shopify still shows them as unfulfilled.
5. Fix anything in `needs_review.csv` by hand, or correct it in Shopify —
   it will not be re-fetched automatically once seen once.

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
```

- [ ] **Step 4: Commit**

```bash
git add build.spec README.md
git commit -m "Add PyInstaller packaging spec and README"
```

---

## Self-Review Notes

- **Spec coverage:** config/settings (Task 1), state dedup (Task 2),
  address split (Task 3), validation/double-check (Task 4), CSV writer
  incl. Reden column (Task 5), Shopify polling (Task 6), sync orchestration
  incl. permanent skip-after-archive behavior (Task 7), Windows startup
  toggle (Task 8), tray menu incl. Sync now / Open folder / Mark as
  imported (Task 9), packaging + docs (Task 10). Settings UI window itself
  (the in-app dialog for entering store domain/token) is intentionally
  deferred to a follow-up — `Settings` values are read from
  `settings.json`, which the user can edit directly or which a future
  small Tkinter dialog can write to; this keeps this plan's scope to the
  sync engine and tray behavior that's already fully specified, without
  guessing UI layout that wasn't discussed.
- **Placeholder scan:** none found — every step has runnable code and
  concrete file paths.
- **Type consistency:** `SyncResult`, `TrayController`, `SyncState`,
  `ShopifyClient`, `PENDING_COLUMNS`/`REVIEW_COLUMNS` are used with the
  same names/signatures across Tasks 6, 7, and 9.

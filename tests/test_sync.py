import csv
from gls_sync.csv_writer import DELIMITER
from gls_sync.state import SyncState
from gls_sync.sync import order_to_row, run_sync_tick
from tests.fixtures.orders import make_order


def _read_csv(path):
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter=DELIMITER))


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
    assert row["Verpakking"] == "PCO"


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
    assert state.is_processed(3) is False

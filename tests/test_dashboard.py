import pytest

from gls_sync.config import Settings
from gls_sync.dashboard import settings_from_form, status_text
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


def test_status_text_before_any_sync(tmp_path):
    controller = _make_controller(tmp_path)
    text = status_text(controller)
    assert "Klaar om te importeren: 0" in text
    assert "Moet gecontroleerd worden: 0" in text
    assert "nog niet uitgevoerd" in text


def test_status_text_after_successful_sync(tmp_path):
    controller = _make_controller(tmp_path, orders=[make_order(order_id=1)])
    controller.sync_now()
    text = status_text(controller)
    assert "Klaar om te importeren: 1" in text
    assert "nog niet uitgevoerd" not in text
    assert "MISLUKT" not in text


def test_status_text_after_failed_sync(tmp_path):
    class ErrorClient:
        def fetch_paid_unfulfilled_orders(self):
            raise ConnectionError("no network")

    settings = Settings(shop_domain="x.myshopify.com", access_token="t")
    state = SyncState(tmp_path / "state.json")
    controller = TrayController(client=ErrorClient(), state=state, base_dir=tmp_path, settings=settings)
    controller.sync_now()

    text = status_text(controller)
    assert "MISLUKT: no network" in text


def test_settings_from_form_parses_and_replaces_fields():
    current = Settings(shop_domain="old.myshopify.com", access_token="old-token", weight_kg=1.0, interval_minutes=5)
    updated = settings_from_form(
        current,
        weight_kg="2.5",
        interval_minutes="10",
        run_at_startup=True,
        labellite_path=r" C:\GLS\LabelLite.exe ",
    )
    assert updated.shop_domain == "old.myshopify.com"
    assert updated.access_token == "old-token"
    assert updated.weight_kg == 2.5
    assert updated.interval_minutes == 10
    assert updated.run_at_startup is True
    assert updated.labellite_path == r"C:\GLS\LabelLite.exe"


def test_settings_from_form_rejects_non_numeric_weight():
    current = Settings()
    with pytest.raises(ValueError):
        settings_from_form(current, "not-a-number", "5", False, "")


def test_update_settings_persists_and_swaps_client(tmp_path):
    controller = _make_controller(tmp_path)
    created_with = {}

    def factory(settings):
        created_with["domain"] = settings.shop_domain
        return FakeClient([])

    controller.client_factory = factory
    new_settings = Settings(shop_domain="new.myshopify.com", access_token="new-token", weight_kg=2.0)

    controller.update_settings(new_settings)

    assert controller.settings.shop_domain == "new.myshopify.com"
    assert created_with["domain"] == "new.myshopify.com"
    assert (tmp_path / "settings.json").exists()

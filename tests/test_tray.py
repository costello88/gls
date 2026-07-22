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

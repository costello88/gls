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

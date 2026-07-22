import threading
import time
import traceback
from datetime import datetime

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
    controller = TrayController(
        client=client, state=state, base_dir=base_dir, settings=settings, settings_path=settings_path
    )

    def _timer_loop():
        while True:
            time.sleep(max(controller.settings.interval_minutes, 1) * 60)
            controller.sync_now()

    threading.Thread(target=_timer_loop, daemon=True).start()

    icon = build_icon(controller)
    icon.run()


def _log_crash(base_dir, exc: BaseException) -> None:
    base_dir.mkdir(parents=True, exist_ok=True)
    log_path = base_dir / "error.log"
    with log_path.open("a", encoding="utf-8") as f:
        f.write(f"\n--- {datetime.now().isoformat()} ---\n")
        f.write("".join(traceback.format_exception(type(exc), exc, exc.__traceback__)))

    try:
        import tkinter as tk
        from tkinter import messagebox

        root = tk.Tk()
        root.withdraw()
        messagebox.showerror(
            "GLS Sync failed to start",
            f"GLS Sync ran into a problem and could not start.\n\n"
            f"Details were saved to:\n{log_path}\n\n"
            f"Error: {exc}",
        )
        root.destroy()
    except Exception:
        pass


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        _log_crash(DEFAULT_BASE_DIR, exc)

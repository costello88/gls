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
        timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
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

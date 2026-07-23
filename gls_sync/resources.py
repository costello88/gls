import sys
from pathlib import Path


def bundled_default_settings_path() -> Path:
    if getattr(sys, "frozen", False):
        base = Path(sys._MEIPASS) / "gls_sync"
    else:
        base = Path(__file__).resolve().parent
    return base / "default_settings.json"

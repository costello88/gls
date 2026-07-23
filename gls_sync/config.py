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
    labellite_path: str = ""


def load_settings(path: Path) -> Settings:
    if not path.exists():
        return Settings()
    data = json.loads(path.read_text())
    return Settings(**data)


def save_settings(settings: Settings, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(asdict(settings), indent=2))


def load_or_bootstrap_settings(path: Path, bundled_default_path: Path) -> Settings:
    if path.exists():
        return load_settings(path)
    settings = load_settings(bundled_default_path)
    save_settings(settings, path)
    return settings

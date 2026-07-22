import json
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

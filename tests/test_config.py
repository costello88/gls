import json
from gls_sync.config import Settings, load_or_bootstrap_settings, load_settings, save_settings


def test_load_settings_missing_file_returns_defaults(tmp_path):
    path = tmp_path / "settings.json"
    settings = load_settings(path)
    assert settings.shop_domain == ""
    assert settings.access_token == ""
    assert settings.weight_kg == 1.0
    assert settings.interval_minutes == 5
    assert settings.run_at_startup is False
    assert settings.labellite_path == ""


def test_load_settings_missing_labellite_path_key_defaults_empty(tmp_path):
    path = tmp_path / "settings.json"
    path.write_text(json.dumps({"shop_domain": "example.myshopify.com"}))
    settings = load_settings(path)
    assert settings.labellite_path == ""


def test_save_then_load_round_trip(tmp_path):
    path = tmp_path / "settings.json"
    original = Settings(
        shop_domain="example.myshopify.com",
        access_token="shpat_abc123",
        weight_kg=2.5,
        interval_minutes=10,
        run_at_startup=True,
        labellite_path=r"C:\GLS\LabelLite.exe",
    )
    save_settings(original, path)
    loaded = load_settings(path)
    assert loaded == original
    assert json.loads(path.read_text())["shop_domain"] == "example.myshopify.com"


def test_bootstrap_uses_bundled_default_when_local_settings_missing(tmp_path):
    local_path = tmp_path / "settings.json"
    bundled_path = tmp_path / "default_settings.json"
    save_settings(
        Settings(shop_domain="baked-in.myshopify.com", access_token="shpat_baked", weight_kg=1.5),
        bundled_path,
    )

    settings = load_or_bootstrap_settings(local_path, bundled_path)

    assert settings.shop_domain == "baked-in.myshopify.com"
    assert settings.access_token == "shpat_baked"
    # bootstrapping should also persist it locally so future edits are per-machine
    assert local_path.exists()
    assert load_settings(local_path).shop_domain == "baked-in.myshopify.com"


def test_bootstrap_prefers_existing_local_settings_over_bundled_default(tmp_path):
    local_path = tmp_path / "settings.json"
    bundled_path = tmp_path / "default_settings.json"
    save_settings(Settings(shop_domain="local.myshopify.com"), local_path)
    save_settings(Settings(shop_domain="baked-in.myshopify.com"), bundled_path)

    settings = load_or_bootstrap_settings(local_path, bundled_path)

    assert settings.shop_domain == "local.myshopify.com"


def test_bootstrap_falls_back_to_defaults_when_bundled_default_also_missing(tmp_path):
    local_path = tmp_path / "settings.json"
    bundled_path = tmp_path / "default_settings.json"

    settings = load_or_bootstrap_settings(local_path, bundled_path)

    assert settings == Settings()

from pathlib import Path

from gls_sync.resources import bundled_default_settings_path


def test_bundled_default_settings_path_points_at_package_file_in_dev_mode():
    path = bundled_default_settings_path()
    assert path.name == "default_settings.json"
    assert path.parent == Path(__file__).resolve().parent.parent / "gls_sync"
    assert path.exists()


def test_bundled_default_settings_path_uses_meipass_when_frozen(monkeypatch, tmp_path):
    monkeypatch.setattr("sys.frozen", True, raising=False)
    monkeypatch.setattr("sys._MEIPASS", str(tmp_path), raising=False)

    path = bundled_default_settings_path()

    assert path == tmp_path / "gls_sync" / "default_settings.json"

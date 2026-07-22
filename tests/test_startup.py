import gls_sync.startup as startup_module
from gls_sync.startup import is_registered, register, unregister


class FakeRegistry:
    def __init__(self):
        self.values = {}

    def get_value(self, name):
        return self.values.get(name)

    def set_value(self, name, value):
        self.values[name] = value

    def delete_value(self, name):
        self.values.pop(name, None)


def test_not_registered_by_default(monkeypatch):
    monkeypatch.setattr(startup_module, "_registry", FakeRegistry())
    assert is_registered() is False


def test_register_sets_value_and_is_registered(monkeypatch):
    monkeypatch.setattr(startup_module, "_registry", FakeRegistry())
    register(r"C:\Tools\gls-sync.exe")
    assert is_registered() is True


def test_unregister_removes_value(monkeypatch):
    monkeypatch.setattr(startup_module, "_registry", FakeRegistry())
    register(r"C:\Tools\gls-sync.exe")
    unregister()
    assert is_registered() is False

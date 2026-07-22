import sys

_RUN_KEY_NAME = "GLSSync"


class _WinRegistry:
    """Thin wrapper over winreg, only imported/instantiated on Windows."""

    def __init__(self):
        import winreg

        self._winreg = winreg
        self._key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"

    def _open(self, writable=False):
        access = self._winreg.KEY_SET_VALUE if writable else self._winreg.KEY_READ
        return self._winreg.OpenKey(self._winreg.HKEY_CURRENT_USER, self._key_path, 0, access)

    def get_value(self, name):
        try:
            with self._open() as key:
                value, _ = self._winreg.QueryValueEx(key, name)
                return value
        except FileNotFoundError:
            return None

    def set_value(self, name, value):
        with self._open(writable=True) as key:
            self._winreg.SetValueEx(key, name, 0, self._winreg.REG_SZ, value)

    def delete_value(self, name):
        try:
            with self._open(writable=True) as key:
                self._winreg.DeleteValue(key, name)
        except FileNotFoundError:
            pass


def _default_registry():
    if sys.platform == "win32":
        return _WinRegistry()
    return None


_registry = _default_registry()


def is_registered() -> bool:
    if _registry is None:
        return False
    return _registry.get_value(_RUN_KEY_NAME) is not None


def register(exe_path: str) -> None:
    if _registry is None:
        raise RuntimeError("Startup registration is only supported on Windows")
    _registry.set_value(_RUN_KEY_NAME, f'"{exe_path}"')


def unregister() -> None:
    if _registry is None:
        raise RuntimeError("Startup registration is only supported on Windows")
    _registry.delete_value(_RUN_KEY_NAME)

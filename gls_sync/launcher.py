import sys
from pathlib import Path

LOCK_FILENAME = "gls-sync.lock"


def lock_path_for(base_dir: Path) -> Path:
    return Path(base_dir) / LOCK_FILENAME


def write_lock(lock_path: Path, pid: int) -> None:
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    lock_path.write_text(str(pid))


def remove_lock(lock_path: Path) -> None:
    if lock_path.exists():
        lock_path.unlink()


def is_locked_by_running_process(lock_path: Path, is_pid_alive) -> bool:
    if not lock_path.exists():
        return False
    try:
        pid = int(lock_path.read_text().strip())
    except ValueError:
        return False
    return is_pid_alive(pid)


def _default_is_pid_alive(pid: int) -> bool:
    if sys.platform == "win32":
        import ctypes

        PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
        handle = ctypes.windll.kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
        if handle:
            ctypes.windll.kernel32.CloseHandle(handle)
            return True
        return False
    import os

    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def start_with_labellite(
    gls_sync_exe: str,
    labellite_exe: str,
    lock_path: Path,
    popen,
    is_pid_alive=_default_is_pid_alive,
) -> None:
    if not is_locked_by_running_process(lock_path, is_pid_alive):
        popen([gls_sync_exe])
    if labellite_exe:
        popen([labellite_exe])

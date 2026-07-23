from gls_sync.launcher import (
    is_locked_by_running_process,
    lock_path_for,
    remove_lock,
    start_with_labellite,
    write_lock,
)


def test_lock_path_for_joins_base_dir(tmp_path):
    assert lock_path_for(tmp_path) == tmp_path / "gls-sync.lock"


def test_not_locked_when_no_lock_file(tmp_path):
    lock_path = tmp_path / "gls-sync.lock"
    assert is_locked_by_running_process(lock_path, is_pid_alive=lambda pid: True) is False


def test_locked_when_lock_file_pid_is_alive(tmp_path):
    lock_path = tmp_path / "gls-sync.lock"
    write_lock(lock_path, 12345)
    assert is_locked_by_running_process(lock_path, is_pid_alive=lambda pid: pid == 12345) is True


def test_not_locked_when_lock_file_pid_is_dead(tmp_path):
    lock_path = tmp_path / "gls-sync.lock"
    write_lock(lock_path, 12345)
    assert is_locked_by_running_process(lock_path, is_pid_alive=lambda pid: False) is False


def test_remove_lock_deletes_existing_file(tmp_path):
    lock_path = tmp_path / "gls-sync.lock"
    write_lock(lock_path, 1)
    remove_lock(lock_path)
    assert not lock_path.exists()


def test_remove_lock_is_a_no_op_when_missing(tmp_path):
    lock_path = tmp_path / "gls-sync.lock"
    remove_lock(lock_path)  # should not raise
    assert not lock_path.exists()


def test_start_with_labellite_launches_gls_sync_when_not_running(tmp_path):
    lock_path = tmp_path / "gls-sync.lock"
    calls = []

    start_with_labellite(
        gls_sync_exe="gls-sync.exe",
        labellite_exe="LabelLite.exe",
        lock_path=lock_path,
        popen=lambda args: calls.append(args),
        is_pid_alive=lambda pid: False,
    )

    assert calls == [["gls-sync.exe"], ["LabelLite.exe"]]


def test_start_with_labellite_skips_gls_sync_when_already_running(tmp_path):
    lock_path = tmp_path / "gls-sync.lock"
    write_lock(lock_path, 999)
    calls = []

    start_with_labellite(
        gls_sync_exe="gls-sync.exe",
        labellite_exe="LabelLite.exe",
        lock_path=lock_path,
        popen=lambda args: calls.append(args),
        is_pid_alive=lambda pid: pid == 999,
    )

    assert calls == [["LabelLite.exe"]]


def test_start_with_labellite_skips_labellite_when_path_blank(tmp_path):
    lock_path = tmp_path / "gls-sync.lock"
    calls = []

    start_with_labellite(
        gls_sync_exe="gls-sync.exe",
        labellite_exe="",
        lock_path=lock_path,
        popen=lambda args: calls.append(args),
        is_pid_alive=lambda pid: False,
    )

    assert calls == [["gls-sync.exe"]]

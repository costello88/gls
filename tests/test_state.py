from gls_sync.state import SyncState


def test_new_state_has_nothing_processed(tmp_path):
    state = SyncState(tmp_path / "state.json")
    assert state.is_processed(123) is False


def test_mark_processed_persists_across_instances(tmp_path):
    path = tmp_path / "state.json"
    state = SyncState(path)
    state.mark_processed(123)
    assert state.is_processed(123) is True

    reloaded = SyncState(path)
    assert reloaded.is_processed(123) is True
    assert reloaded.is_processed(456) is False


def test_mark_processed_is_idempotent(tmp_path):
    state = SyncState(tmp_path / "state.json")
    state.mark_processed(1)
    state.mark_processed(1)
    assert state.is_processed(1) is True

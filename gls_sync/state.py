import json
from pathlib import Path


class SyncState:
    def __init__(self, path: Path):
        self.path = path
        self._ids: set[int] = self._load()

    def _load(self) -> set[int]:
        if not self.path.exists():
            return set()
        data = json.loads(self.path.read_text())
        return set(data.get("processed_order_ids", []))

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps({"processed_order_ids": sorted(self._ids)}, indent=2))

    def is_processed(self, order_id: int) -> bool:
        return order_id in self._ids

    def mark_processed(self, order_id: int) -> None:
        if order_id in self._ids:
            return
        self._ids.add(order_id)
        self._save()

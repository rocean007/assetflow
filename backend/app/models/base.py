"""Shared JSON file store — simple, no-database persistence."""
import json
from pathlib import Path
from typing import TypeVar, Generic, List, Optional, Type
from ..utils.logger import get_logger

log = get_logger('assetflow.store')
T = TypeVar('T')

class JsonStore(Generic[T]):
    def __init__(self, filepath: Path, cls: Type[T]):
        self.path = filepath
        self.cls  = cls
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self.path.write_text('[]')

    def _read(self) -> List[T]:
        try:
            return [self.cls.from_dict(d) for d in json.loads(self.path.read_text())]
        except Exception as e:
            log.error(f'Read {self.path.name}: {e}')
            return []

    def _write(self, items: List[T]):
        self.path.write_text(
            json.dumps([i.to_dict() for i in items], indent=2, default=str), encoding='utf-8')

    def list(self, limit=200) -> List[T]:
        return self._read()[:limit]

    def get(self, key: str, field: str = 'id') -> Optional[T]:
        return next((i for i in self._read() if str(getattr(i, field, None)) == str(key)), None)

    def save(self, item: T) -> T:
        items = self._read()
        field = 'id'
        for attr in ('project_id','simulation_id','task_id','agent_id','analysis_id'):
            if hasattr(item, attr):
                field = attr; break
        idx = next((i for i,x in enumerate(items)
                    if str(getattr(x, field, None)) == str(getattr(item, field, None))), None)
        if idx is not None: items[idx] = item
        else:               items.insert(0, item)
        self._write(items)
        return item

    def delete(self, key: str, field: str = 'id') -> bool:
        items = self._read()
        filtered = [i for i in items if str(getattr(i, field, None)) != str(key)]
        if len(filtered) == len(items): return False
        self._write(filtered)
        return True

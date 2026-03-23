"""Simple append-only JSON analysis store."""
import json
from pathlib import Path
from ..utils.logger import get_logger
log = get_logger('assetflow.analysis_store')

class AnalysisStore:
    def __init__(self, filepath: Path):
        self.path = filepath
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self.path.write_text('[]')

    def _read(self):
        try: return json.loads(self.path.read_text())
        except: return []

    def _write(self, data):
        self.path.write_text(json.dumps(data, indent=2, default=str))

    def append(self, record: dict):
        data = self._read()
        data.append(record)
        data = data[-500:]  # keep last 500
        self._write(data)
        log.info(f"Saved analysis {record.get('id')} for {record.get('asset',{}).get('symbol')}")

    def list(self, limit=50):
        data = self._read()
        return list(reversed(data))[:limit]

    def get(self, analysis_id: str):
        return next((d for d in self._read() if d.get('id') == analysis_id), None)

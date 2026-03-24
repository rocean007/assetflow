import uuid, json
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional, List
from enum import Enum
from pathlib import Path

class SessionStatus(str, Enum):
    CREATED    = 'created'
    RUNNING    = 'running'
    ENRICHING  = 'enriching'   # background deep research
    COMPLETED  = 'completed'
    FAILED     = 'failed'

@dataclass
class Session:
    session_id:    str = field(default_factory=lambda: f"s_{uuid.uuid4().hex[:10]}")
    name:          str = ''
    symbol:        str = ''
    asset_type:    str = 'equity'
    description:   str = ''
    av_key:        str = ''
    files:         List[dict] = field(default_factory=list)
    status:        SessionStatus = SessionStatus.CREATED
    error:         Optional[str] = None
    # Results
    fast_result:   Optional[dict] = None   # Phase 1 fast prediction
    deep_result:   Optional[dict] = None   # Phase 2 enriched prediction
    final_result:  Optional[dict] = None   # Phase 3 final refined verdict
    graph:         Optional[dict] = None
    agent_outputs: List[dict] = field(default_factory=list)
    interviews:    List[dict] = field(default_factory=list)
    progress:      int = 0
    message:       str = ''
    created_at:    str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at:    str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    @property
    def id(self): return self.session_id

    def touch(self):
        self.updated_at = datetime.now(timezone.utc).isoformat()

    def to_dict(self):
        d = asdict(self)
        d['status'] = self.status.value
        return d

    def to_summary(self):
        fr = self.final_result or self.deep_result or self.fast_result or {}
        return {
            'session_id': self.session_id, 'name': self.name,
            'symbol': self.symbol, 'asset_type': self.asset_type,
            'status': self.status.value, 'progress': self.progress,
            'message': self.message,
            'direction': fr.get('direction'), 'up': fr.get('up'), 'down': fr.get('down'),
            'confidence': fr.get('confidence'), 'summary': (fr.get('summary') or '')[:200],
            'files_count': len(self.files), 'interviews_count': len(self.interviews),
            'created_at': self.created_at,
        }

    @classmethod
    def from_dict(cls, d):
        d = dict(d)
        if 'status' in d:
            try: d['status'] = SessionStatus(d['status'])
            except: d['status'] = SessionStatus.CREATED
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


class SessionStore:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists(): self.path.write_text('[]')

    def _r(self):
        try: return [Session.from_dict(d) for d in json.loads(self.path.read_text())]
        except: return []

    def _w(self, items):
        self.path.write_text(json.dumps([i.to_dict() for i in items], indent=2, default=str))

    def list(self, limit=100): return self._r()[:limit]

    def get(self, sid):
        return next((s for s in self._r() if s.session_id == sid), None)

    def save(self, s: Session):
        s.touch()
        items = self._r()
        idx = next((i for i,x in enumerate(items) if x.session_id == s.session_id), None)
        if idx is not None: items[idx] = s
        else: items.insert(0, s)
        self._w(items[-500:])
        return s

    def delete(self, sid):
        items = self._r()
        f = [x for x in items if x.session_id != sid]
        if len(f) == len(items): return False
        self._w(f); return True

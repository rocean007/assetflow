import uuid, threading
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional
from enum import Enum

class TaskStatus(str, Enum):
    PENDING   = 'pending'
    RUNNING   = 'running'
    COMPLETED = 'completed'
    FAILED    = 'failed'

@dataclass
class Task:
    task_id:    str = field(default_factory=lambda: f"task_{uuid.uuid4().hex[:10]}")
    name:       str = ''
    status:     TaskStatus = TaskStatus.PENDING
    progress:   int = 0
    message:    str = ''
    error:      Optional[str] = None
    result:     Optional[dict] = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    @property
    def id(self): return self.task_id

    def to_dict(self):
        d = asdict(self)
        d['status'] = self.status.value
        return d

    @classmethod
    def from_dict(cls, d):
        d = dict(d)
        if 'status' in d:
            try: d['status'] = TaskStatus(d['status'])
            except: pass
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})

class TaskManager:
    _tasks: dict = {}
    _lock = threading.Lock()

    @classmethod
    def create(cls, name: str) -> Task:
        t = Task(name=name)
        with cls._lock: cls._tasks[t.task_id] = t
        return t

    @classmethod
    def get(cls, tid: str) -> Optional[Task]:
        return cls._tasks.get(tid)

    @classmethod
    def update(cls, tid: str, **kw) -> Optional[Task]:
        t = cls._tasks.get(tid)
        if not t: return None
        with cls._lock:
            for k, v in kw.items():
                if hasattr(t, k): setattr(t, k, v)
            t.updated_at = datetime.now(timezone.utc).isoformat()
        try:
            from .. import socketio
            socketio.emit('task_update', t.to_dict())
        except: pass
        return t

    @classmethod
    def list_all(cls): return list(cls._tasks.values())

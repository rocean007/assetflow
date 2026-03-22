"""
Task and Analysis models — matches MiroFish TaskManager pattern
"""
import json
import uuid
import threading
from dataclasses import dataclass, field, asdict
from typing import Optional, Any, List
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from ..utils.logger import get_logger

logger = get_logger('assetflow.models.task')


class TaskStatus(str, Enum):
    PENDING    = 'pending'
    RUNNING    = 'running'
    COMPLETED  = 'completed'
    FAILED     = 'failed'


@dataclass
class Task:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ''
    status: TaskStatus = TaskStatus.PENDING
    progress: int = 0
    message: str = ''
    error: Optional[str] = None
    result: Optional[dict] = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        d = asdict(self)
        d['status'] = self.status.value
        return d

    def update(self, status: TaskStatus = None, progress: int = None,
               message: str = None, error: str = None, result: dict = None):
        if status is not None:
            self.status = status
        if progress is not None:
            self.progress = progress
        if message is not None:
            self.message = message
        if error is not None:
            self.error = error
        if result is not None:
            self.result = result
        self.updated_at = datetime.now(timezone.utc).isoformat()


class TaskManager:
    """
    In-memory task registry with thread-safe updates.
    Tasks are broadcast over SocketIO for real-time frontend updates.
    """
    _tasks: dict[str, Task] = {}
    _lock = threading.Lock()

    @classmethod
    def create(cls, name: str) -> Task:
        task = Task(name=name)
        with cls._lock:
            cls._tasks[task.id] = task
        logger.debug(f'Created task {task.id}: {name}')
        return task

    @classmethod
    def get(cls, task_id: str) -> Optional[Task]:
        return cls._tasks.get(task_id)

    @classmethod
    def update(cls, task_id: str, **kwargs) -> Optional[Task]:
        task = cls._tasks.get(task_id)
        if not task:
            return None
        with cls._lock:
            task.update(**kwargs)
        # Emit via SocketIO
        try:
            from .. import socketio
            socketio.emit('task_update', task.to_dict())
        except Exception:
            pass
        return task

    @classmethod
    def list_tasks(cls) -> List[Task]:
        return list(cls._tasks.values())


@dataclass
class Analysis:
    """Full analysis result stored to disk."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    asset: dict = field(default_factory=dict)
    price: Optional[dict] = None
    agent_outputs: list = field(default_factory=list)
    synthesizer_outputs: list = field(default_factory=list)
    synthesis: Optional[dict] = None
    graph: Optional[dict] = None
    data_snapshot: Optional[dict] = None
    stats: Optional[dict] = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    duration_ms: int = 0

    def to_dict(self) -> dict:
        return asdict(self)

    def to_summary(self) -> dict:
        """Lightweight version for history listing."""
        return {
            'id': self.id,
            'asset': self.asset,
            'price': self.price,
            'synthesis': self.synthesis,
            'stats': self.stats,
            'created_at': self.created_at,
            'duration_ms': self.duration_ms,
        }


class AnalysisStore:
    """Persists analyses to local JSON file — last 500 kept."""

    def __init__(self, filepath: Path):
        self.filepath = filepath
        self.filepath.parent.mkdir(parents=True, exist_ok=True)
        if not self.filepath.exists():
            self.filepath.write_text('[]', encoding='utf-8')

    def save(self, analysis: Analysis) -> Analysis:
        try:
            data = json.loads(self.filepath.read_text(encoding='utf-8'))
        except Exception:
            data = []
        data.append(analysis.to_dict())
        data = data[-500:]  # Keep last 500
        self.filepath.write_text(
            json.dumps(data, indent=2, ensure_ascii=False, default=str),
            encoding='utf-8'
        )
        logger.info(f'Saved analysis {analysis.id} for {analysis.asset.get("symbol")}')
        return analysis

    def list(self, limit: int = 50) -> List[dict]:
        try:
            data = json.loads(self.filepath.read_text(encoding='utf-8'))
            return [Analysis(**d).to_summary() for d in reversed(data[-limit:])]
        except Exception as e:
            logger.error(f'Failed to read analyses: {e}')
            return []

    def get(self, analysis_id: str) -> Optional[dict]:
        try:
            data = json.loads(self.filepath.read_text(encoding='utf-8'))
            return next((d for d in data if d.get('id') == analysis_id), None)
        except Exception:
            return None

import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional, List
from enum import Enum

class SimStatus(str, Enum):
    CREATED   = 'created'
    PREPARING = 'preparing'
    READY     = 'ready'
    RUNNING   = 'running'
    COMPLETED = 'completed'
    FAILED    = 'failed'

@dataclass
class Simulation:
    simulation_id:       str = field(default_factory=lambda: f"sim_{uuid.uuid4().hex[:10]}")
    project_id:          str = ''
    analysis_id:         Optional[str] = None
    status:              SimStatus = SimStatus.CREATED
    error:               Optional[str] = None
    agent_profiles:      List[dict] = field(default_factory=list)
    synthesizer_outputs: List[dict] = field(default_factory=list)
    final_synthesis:     Optional[dict] = None
    graph_stats:         Optional[dict] = None
    interviews:          List[dict] = field(default_factory=list)
    created_at:          str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at:          str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    @property
    def id(self): return self.simulation_id

    def touch(self): self.updated_at = datetime.now(timezone.utc).isoformat()

    def to_dict(self):
        d = asdict(self)
        d['status'] = self.status.value
        return d

    def summary(self):
        return {k: self.to_dict()[k] for k in
                ('simulation_id','project_id','analysis_id','status',
                 'graph_stats','created_at','updated_at') if k in self.to_dict()} | {
            'agent_count':    len(self.agent_profiles),
            'interview_count': len(self.interviews),
            'has_synthesis':  self.final_synthesis is not None,
        }

    @classmethod
    def from_dict(cls, d):
        d = dict(d)
        if 'status' in d:
            try: d['status'] = SimStatus(d['status'])
            except: d['status'] = SimStatus.CREATED
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})

import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional, List
from enum import Enum

class ProjectStatus(str, Enum):
    CREATED          = 'created'
    DATA_FETCHING    = 'data_fetching'
    DATA_READY       = 'data_ready'
    GRAPH_BUILDING   = 'graph_building'
    GRAPH_READY      = 'graph_ready'
    COMPLETED        = 'completed'
    FAILED           = 'failed'

@dataclass
class UploadedFile:
    filename:    str
    stored_name: str
    size:        int
    mime:        str = ''
    uploaded_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self): return asdict(self)
    @classmethod
    def from_dict(cls, d):
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})

@dataclass
class Project:
    project_id:   str  = field(default_factory=lambda: f"proj_{uuid.uuid4().hex[:10]}")
    name:         str  = ''
    symbol:       str  = ''
    asset_name:   str  = ''
    asset_type:   str  = 'equity'
    av_key:       str  = ''
    description:  str  = ''          # extra context / research question
    status:       ProjectStatus = ProjectStatus.CREATED
    error:        Optional[str] = None
    # uploaded supplementary files
    files:        List[dict] = field(default_factory=list)
    # pipeline IDs
    analysis_id:  Optional[str] = None
    simulation_id:Optional[str] = None
    # stats
    agent_count:  int = 0
    node_count:   int = 0
    edge_count:   int = 0
    created_at:   str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at:   str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    @property
    def id(self): return self.project_id

    def touch(self):
        self.updated_at = datetime.now(timezone.utc).isoformat()

    def to_dict(self):
        d = asdict(self)
        d['status'] = self.status.value
        return d

    @classmethod
    def from_dict(cls, d):
        d = dict(d)
        if 'status' in d:
            try: d['status'] = ProjectStatus(d['status'])
            except: d['status'] = ProjectStatus.CREATED
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})

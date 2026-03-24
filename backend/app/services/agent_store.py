import json
from pathlib import Path
from ..models.agent import Agent, BUILTIN_AGENTS
from ..utils.logger import get_logger
from datetime import datetime, timezone
log = get_logger('af.agent_store')

class AgentStore:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self._seed()

    def _seed(self):
        agents = [Agent(**{**d, 'created_at': datetime.now(timezone.utc).isoformat()}) for d in BUILTIN_AGENTS]
        self._write(agents)
        log.info(f'Seeded {len(agents)} built-in agents')

    def _read(self):
        try: return [Agent.from_dict(d) for d in json.loads(self.path.read_text())]
        except: return []

    def _write(self, items):
        self.path.write_text(json.dumps(
            [a.to_dict(include_key=True) for a in items], indent=2))

    def list(self): return self._read()
    def get(self, aid): return next((a for a in self._read() if a.agent_id == aid), None)

    def save(self, a: Agent):
        items = self._read()
        idx = next((i for i,x in enumerate(items) if x.agent_id == a.agent_id), None)
        if idx is not None: items[idx] = a
        else: items.append(a)
        self._write(items); return a

    def delete(self, aid):
        items = self._read()
        f = [x for x in items if x.agent_id != aid]
        if len(f) == len(items): return False
        self._write(f); return True

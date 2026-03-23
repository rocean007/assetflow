from .llm_client import call_llm, extract_json, safe_output, is_small_model
from .data_collector import build_world_state, serialize
from .graph_builder import SharedGraph
from .agent_runner import run_agent, run_synthesizer, run_super_synthesizer
from .orchestrator import run_pipeline
from .file_parser import extract_text
from .relevance import get_relevance_context

# Create analysis_store module inline
import json
from pathlib import Path

class AnalysisStore:
    def __init__(self, filepath):
        self.path = Path(filepath)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists(): self.path.write_text('[]')
    def _read(self):
        try: return json.loads(self.path.read_text())
        except: return []
    def save_raw(self, aid, record):
        data = self._read()
        data = [d for d in data if d.get('id') != aid]
        data.append(record)
        self.path.write_text(json.dumps(data[-500:], indent=2, default=str))
    def get(self, aid):
        return next((d for d in self._read() if d.get('id') == aid), None)
    def list_summaries(self, limit=50):
        out = []
        for d in reversed(self._read()[-limit:]):
            syn = d.get('synthesis', {})
            out.append({'id':d.get('id'),'asset':d.get('asset'),'price':d.get('price'),
                        'stats':d.get('stats'),'created_at':d.get('created_at'),
                        'duration_ms':d.get('duration_ms'),
                        'direction':syn.get('primaryDirection'),
                        'up_probability':syn.get('upProbability'),
                        'down_probability':syn.get('downProbability'),
                        'confidence':syn.get('confidence'),
                        'summary':(syn.get('summary') or '')[:200]})
        return out

__all__ = ['call_llm','extract_json','safe_output','is_small_model','build_world_state',
           'serialize','SharedGraph','run_agent','run_synthesizer','run_super_synthesizer',
           'run_pipeline','extract_text','get_relevance_context','AnalysisStore']

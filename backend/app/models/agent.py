import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone

BUILTIN_AGENTS = [
    {'agent_id':'b_groq_spec',  'name':'Groq Analyst (Llama 3.3 70B)',       'provider':'groq',       'model':'llama-3.3-70b-versatile','role':'specialist',  'description':'Fast specialist. Groq runs Llama 70B at 300+ t/s. Free signup.','enabled':True,'builtin':True},
    {'agent_id':'b_groq_synth', 'name':'Groq Synthesizer (Llama 3.3 70B)',   'provider':'groq',       'model':'llama-3.3-70b-versatile','role':'synthesizer', 'description':'Fast synthesizer for final verdict. Free signup.','enabled':True,'builtin':True},
    {'agent_id':'b_or_spec',    'name':'OpenRouter Specialist (Llama 3.1 8B free)','provider':'openrouter','model':'meta-llama/llama-3.1-8b-instruct:free','role':'specialist','description':'Free no-credit-card model via OpenRouter.','enabled':False,'builtin':True},
    {'agent_id':'b_or_synth',   'name':'OpenRouter Synthesizer (Gemma 2 9B free)','provider':'openrouter','model':'google/gemma-2-9b-it:free','role':'synthesizer','description':'Free synthesizer via OpenRouter.','enabled':False,'builtin':True},
    {'agent_id':'b_ollama_spec', 'name':'Ollama Specialist (local)',          'provider':'ollama',     'model':'llama3.2',              'role':'specialist',  'description':'Fully local. Install ollama.com then run: ollama pull llama3.2','enabled':False,'builtin':True},
    {'agent_id':'b_ollama_synth','name':'Ollama Synthesizer (local)',         'provider':'ollama',     'model':'llama3.2',              'role':'synthesizer', 'description':'Fully local synthesizer.','enabled':False,'builtin':True},
]

@dataclass
class Agent:
    agent_id:    str = field(default_factory=lambda: str(uuid.uuid4()))
    name:        str = ''
    provider:    str = 'groq'
    api_key:     str = ''
    model:       str = ''
    base_url:    str = ''
    role:        str = 'specialist'
    description: str = ''
    enabled:     bool = True
    builtin:     bool = False
    created_at:  str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self, include_key=False):
        d = asdict(self)
        if not include_key:
            d.pop('api_key', None)
            d['has_key'] = bool(self.api_key)
        return d

    @classmethod
    def from_dict(cls, d):
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})

import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional

BUILTIN_AGENTS = [
    dict(agent_id='builtin_poll_macro',    name='Macro Agent (Free)',        provider='pollinations', model='mistral', role='macro',            description='Rates, inflation, GDP, central banks. No key needed.', enabled=True, builtin=True),
    dict(agent_id='builtin_poll_sent',     name='Sentiment Agent (Free)',    provider='pollinations', model='mistral', role='sentiment',        description='News narratives, fear/greed, options flow. No key needed.', enabled=True, builtin=True),
    dict(agent_id='builtin_poll_supply',   name='Supply Chain Agent (Free)', provider='pollinations', model='mistral', role='supply_chain',     description='Weather, commodities, shipping, butterfly chains. No key needed.', enabled=True, builtin=True),
    dict(agent_id='builtin_poll_tech',     name='Technical Agent (Free)',    provider='pollinations', model='mistral', role='technical',        description='Price action, momentum, RSI, volume. No key needed.', enabled=True, builtin=True),
    dict(agent_id='builtin_poll_geo',      name='Geopolitical Agent (Free)', provider='pollinations', model='mistral', role='geopolitical',     description='Conflicts, sanctions, trade policy. No key needed.', enabled=True, builtin=True),
    dict(agent_id='builtin_poll_sector',   name='Sector Agent (Free)',       provider='pollinations', model='mistral', role='sector',           description='Earnings, analysts, insiders, M&A. No key needed.', enabled=True, builtin=True),
    dict(agent_id='builtin_poll_social',   name='Social Agent (Free)',       provider='pollinations', model='mistral', role='social_sentiment', description='Reddit/X/StockTwits manipulation detection. No key needed.', enabled=True, builtin=True),
    dict(agent_id='builtin_hf_synth',      name='Synthesizer (Free)',        provider='huggingface_free', model='HuggingFaceH4/zephyr-7b-beta', role='synthesizer', description='Reads complete graph → probability verdict. No key needed.', enabled=True, builtin=True),
]

@dataclass
class Agent:
    agent_id:    str = field(default_factory=lambda: str(uuid.uuid4()))
    name:        str = ''
    provider:    str = 'pollinations'
    api_key:     str = ''
    model:       str = ''
    base_url:    str = ''
    role:        str = 'specialist'
    description: str = ''
    enabled:     bool = True
    builtin:     bool = False
    created_at:  str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    # alias for store
    @property
    def id(self): return self.agent_id

    def to_dict(self, include_key=False):
        d = asdict(self)
        if not include_key:
            d.pop('api_key', None)
            d['has_api_key'] = bool(self.api_key)
        return d

    @classmethod
    def from_dict(cls, d):
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})

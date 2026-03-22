"""
Agent model — stores LLM agent configurations locally as JSON
"""
import json
import uuid
from dataclasses import dataclass, field, asdict
from typing import Optional, List
from datetime import datetime, timezone
from pathlib import Path
from ..utils.logger import get_logger

logger = get_logger('assetflow.models.agent')

# Built-in free agents seeded on first run — zero config, zero API key
BUILTIN_FREE_AGENTS = [
    dict(id='builtin_poll_macro',    name='Macro Agent (Pollinations · Free)',      provider='pollinations',     model='mistral',                            role='macro',            description='Macro economist. Interest rates, inflation, GDP, central banks. Free, no key.',        enabled=True, builtin=True),
    dict(id='builtin_poll_sentiment',name='Sentiment Agent (Pollinations · Free)',  provider='pollinations',     model='mistral',                            role='sentiment',        description='Sentiment analyst. News narratives, fear/greed, social signals. Free, no key.',       enabled=True, builtin=True),
    dict(id='builtin_poll_supply',   name='Supply Chain Agent (Pollinations · Free)',provider='pollinations',    model='mistral',                            role='supply_chain',     description='Supply chain specialist. Weather, commodities, shipping. Free, no key.',            enabled=True, builtin=True),
    dict(id='builtin_poll_technical',name='Technical Agent (Pollinations · Free)',  provider='pollinations',     model='mistral',                            role='technical',        description='Technical analyst. Price action, momentum, volume. Free, no key.',                  enabled=True, builtin=True),
    dict(id='builtin_poll_geo',      name='Geopolitical Agent (Pollinations · Free)',provider='pollinations',    model='mistral',                            role='geopolitical',     description='Geopolitical risk. Conflicts, sanctions, trade policy. Free, no key.',              enabled=True, builtin=True),
    dict(id='builtin_poll_sector',   name='Sector Agent (Pollinations · Free)',     provider='pollinations',     model='mistral',                            role='sector',           description='Sector specialist. Earnings, analysts, insider trades. Free, no key.',              enabled=True, builtin=True),
    dict(id='builtin_poll_social',   name='Social Agent (Pollinations · Free)',     provider='pollinations',     model='mistral',                            role='social_sentiment', description='Social intelligence. Reddit/X/StockTwits manipulation detection. Free, no key.',    enabled=True, builtin=True),
    dict(id='builtin_hf_synth',      name='Synthesizer (HuggingFace · Free)',       provider='huggingface_free', model='HuggingFaceH4/zephyr-7b-beta',       role='synthesizer',      description='Graph synthesizer. Reads complete agent graph → probability verdict. Free, no key.', enabled=True, builtin=True),
]


@dataclass
class Agent:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ''
    provider: str = 'pollinations'
    api_key: str = ''
    model: str = ''
    base_url: str = ''
    role: str = 'specialist'
    description: str = ''
    enabled: bool = True
    builtin: bool = False
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self, include_key: bool = False) -> dict:
        d = asdict(self)
        if not include_key:
            d.pop('api_key', None)
            d['has_api_key'] = bool(self.api_key)
        return d

    @classmethod
    def from_dict(cls, d: dict) -> 'Agent':
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


class AgentManager:
    """Manages agent persistence to local JSON file."""

    def __init__(self, filepath: Path):
        self.filepath = filepath
        self._ensure_file()

    def _ensure_file(self):
        self.filepath.parent.mkdir(parents=True, exist_ok=True)
        if not self.filepath.exists():
            self._write([Agent.from_dict({**a, 'created_at': datetime.now(timezone.utc).isoformat()})
                        for a in BUILTIN_FREE_AGENTS])
            logger.info(f'Seeded {len(BUILTIN_FREE_AGENTS)} built-in free agents')

    def _read(self) -> List[Agent]:
        try:
            data = json.loads(self.filepath.read_text(encoding='utf-8'))
            return [Agent.from_dict(d) for d in data]
        except Exception as e:
            logger.error(f'Failed to read agents: {e}')
            return []

    def _write(self, agents: List[Agent]):
        self.filepath.write_text(
            json.dumps([a.to_dict(include_key=True) for a in agents], indent=2, ensure_ascii=False),
            encoding='utf-8'
        )

    def list_agents(self) -> List[Agent]:
        return self._read()

    def get_agent(self, agent_id: str) -> Optional[Agent]:
        return next((a for a in self._read() if a.id == agent_id), None)

    def save_agent(self, agent: Agent) -> Agent:
        agents = self._read()
        idx = next((i for i, a in enumerate(agents) if a.id == agent.id), None)
        if idx is not None:
            agents[idx] = agent
        else:
            agents.append(agent)
        self._write(agents)
        logger.info(f'Saved agent: {agent.id} ({agent.name})')
        return agent

    def delete_agent(self, agent_id: str) -> bool:
        agents = self._read()
        filtered = [a for a in agents if a.id != agent_id]
        if len(filtered) == len(agents):
            return False
        self._write(filtered)
        logger.info(f'Deleted agent: {agent_id}')
        return True

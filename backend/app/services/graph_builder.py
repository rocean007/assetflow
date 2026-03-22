"""
Graph Builder — SharedGraph class matching MiroFish's graph_builder.py pattern.

Phase 1: All specialist agents independently write nodes + causal edges.
Phase 2: Synthesizer(s) read the complete graph via toSynthesizerInput().
Phase 3: Optional super-synthesizer reconciles multiple synthesizer verdicts.
"""
import uuid
import time
from dataclasses import dataclass, field, asdict
from typing import Optional
from ..utils.logger import get_logger

logger = get_logger('assetflow.services.graph')


@dataclass
class GraphNode:
    id: str
    type: str           # asset | specialist | concept | synthesizer
    label: str
    category: str
    weight: float = 0.5
    agent_id: Optional[str] = None
    agent_name: Optional[str] = None
    data: dict = field(default_factory=dict)
    ts: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class GraphEdge:
    id: str
    source: str
    target: str
    label: str = ''
    weight: float = 0.5
    direction: str = 'neutral'  # bullish | bearish | neutral
    type: str = 'signal'        # root_link | causal | reference
    ts: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class SignalVote:
    agent_id: str
    agent_name: str
    role: str
    role_name: str
    signal: str         # bullish | bearish | neutral
    confidence: int
    reasoning: str
    key_factors: list
    butterflies: list
    ts: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return asdict(self)


class SharedGraph:
    """
    The central intelligence graph.
    All Phase 1 agents write to this independently.
    Phase 2 synthesizer reads the complete serialized graph.
    """

    def __init__(self, asset: dict):
        self.asset = asset
        self.nodes: dict[str, GraphNode] = {}
        self.edges: dict[str, GraphEdge] = {}
        self.signals: list[SignalVote] = []
        self.created_at = time.time()

        # Seed root asset node
        self.add_node(GraphNode(
            id='root', type='asset', label=asset.get('symbol', '?'),
            category='root', weight=1.0,
            data={'name': asset.get('name'), 'asset_type': asset.get('asset_type')}
        ))

    def add_node(self, node: GraphNode):
        self.nodes[node.id] = node

    def add_edge(self, edge: GraphEdge):
        self.edges[edge.id] = edge

    def add_signal(self, vote: SignalVote):
        self.signals.append(vote)

    @property
    def stats(self) -> dict:
        bull = sum(1 for s in self.signals if s.signal == 'bullish')
        bear = sum(1 for s in self.signals if s.signal == 'bearish')
        neut = sum(1 for s in self.signals if s.signal == 'neutral')
        return {
            'total_nodes':   len(self.nodes),
            'total_edges':   len(self.edges),
            'total_agents':  len(self.signals),
            'bull': bull, 'bear': bear, 'neut': neut,
        }

    def to_synthesizer_input(self) -> str:
        """Serialize complete graph as text for the synthesizer LLM."""
        s = self.stats
        total = s['total_agents'] or 1

        vote_lines = '\n'.join(
            f"  {v.role_name} ({v.agent_name}): {v.signal} @ {v.confidence}%"
            for v in self.signals
        )

        node_lines = '\n\n'.join(
            f"[{n.id}] {n.label} ({n.category}) agent={n.agent_name or '?'} "
            f"conf={n.data.get('confidence',0)}% signal={n.data.get('signal','?')}\n"
            f"  Reasoning: {str(n.data.get('reasoning',''))[:300]}\n"
            f"  KeyFactors: {' | '.join(n.data.get('key_factors',[]))}\n"
            f"  Butterflies: {' | '.join(n.data.get('butterflies',[]))}"
            for n in self.nodes.values() if n.type == 'specialist'
        )

        causal_lines = '\n'.join(
            f"  {e.source} --[{e.direction}/{e.weight:.2f}]--> {e.target}  \"{e.label}\""
            for e in self.edges.values() if e.type == 'causal'
        ) or '  (none declared)'

        return (
            f"ASSET: {self.asset.get('symbol')} ({self.asset.get('name','')})\n"
            f"DATE: {time.strftime('%Y-%m-%d', time.gmtime())}\n"
            f"TOTAL AGENTS: {s['total_agents']} | NODES: {s['total_nodes']} | EDGES: {s['total_edges']}\n\n"
            f"VOTE TALLY:\n"
            f"  Bullish: {s['bull']}/{total} ({s['bull']*100//total}%)\n"
            f"  Bearish: {s['bear']}/{total} ({s['bear']*100//total}%)\n"
            f"  Neutral: {s['neut']}/{total} ({s['neut']*100//total}%)\n\n"
            f"INDIVIDUAL VOTES:\n{vote_lines}\n\n"
            f"AGENT ANALYSIS NODES:\n{node_lines}\n\n"
            f"CAUSAL BUTTERFLY CHAINS:\n{causal_lines}"
        )

    def to_flow_format(self) -> dict:
        """Serialize for ReactFlow visualization."""
        return {
            'nodes':   [n.to_dict() for n in self.nodes.values()],
            'edges':   [e.to_dict() for e in self.edges.values()],
            'signals': [s.to_dict() for s in self.signals],
            'stats':   self.stats,
        }

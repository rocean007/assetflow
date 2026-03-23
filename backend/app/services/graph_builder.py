"""SharedGraph — all agents write here in Phase 1. Synthesizer reads it in Phase 2."""
import time
from dataclasses import dataclass, field, asdict
from typing import Optional

@dataclass
class GNode:
    id: str; type: str; label: str; category: str
    weight: float=0.5; agent_id: Optional[str]=None; agent_name: Optional[str]=None
    data: dict=field(default_factory=dict); ts: float=field(default_factory=time.time)
    def to_dict(self): return asdict(self)

@dataclass
class GEdge:
    id: str; source: str; target: str; label: str=''
    weight: float=0.5; direction: str='neutral'; type: str='signal'
    ts: float=field(default_factory=time.time)
    def to_dict(self): return asdict(self)

@dataclass
class Signal:
    agent_id: str; agent_name: str; role: str; role_name: str
    signal: str; confidence: int; reasoning: str
    key_factors: list=field(default_factory=list)
    butterflies: list=field(default_factory=list)
    ts: float=field(default_factory=time.time)
    def to_dict(self): return asdict(self)

class SharedGraph:
    def __init__(self, asset: dict):
        self.asset=asset; self.nodes={}; self.edges={}; self.signals=[]
        self.add_node(GNode(id='root',type='asset',label=asset.get('symbol','?'),
                            category='root',weight=1.0,
                            data={'name':asset.get('asset_name'),'type':asset.get('asset_type')}))

    def add_node(self, n: GNode): self.nodes[n.id]=n
    def add_edge(self, e: GEdge): self.edges[e.id]=e
    def add_signal(self, s: Signal): self.signals.append(s)

    @property
    def stats(self):
        bull=sum(1 for s in self.signals if s.signal=='bullish')
        bear=sum(1 for s in self.signals if s.signal=='bearish')
        neut=sum(1 for s in self.signals if s.signal=='neutral')
        return {'total_nodes':len(self.nodes),'total_edges':len(self.edges),
                'total_agents':len(self.signals),'bull':bull,'bear':bear,'neut':neut}

    def to_synth_input(self):
        st=self.stats; t=st['total_agents'] or 1
        votes='\n'.join(f"  {s.role_name}({s.agent_name}): {s.signal} @{s.confidence}%" for s in self.signals)
        nodes='\n\n'.join(
            f"[{n.id}] {n.label}({n.category}) agent={n.agent_name} conf={n.data.get('confidence',0)}% signal={n.data.get('signal','?')}\n"
            f"  Reasoning: {str(n.data.get('reasoning',''))[:300]}\n"
            f"  Factors: {' | '.join(n.data.get('key_factors',[]))}\n"
            f"  Butterflies: {' | '.join(n.data.get('butterflies',[]))}"
            for n in self.nodes.values() if n.type=='specialist')
        causal='\n'.join(f"  {e.source} --[{e.direction}/{e.weight:.2f}]--> {e.target} \"{e.label}\""
                         for e in self.edges.values() if e.type=='causal') or '  (none)'
        return (f"ASSET: {self.asset.get('symbol')} DATE: {time.strftime('%Y-%m-%d',time.gmtime())}\n"
                f"AGENTS: {st['total_agents']} NODES: {st['total_nodes']} EDGES: {st['total_edges']}\n"
                f"VOTES: {st['bull']}B/{st['bear']}Be/{st['neut']}N (avg confidence estimate)\n\n"
                f"SIGNAL VOTES:\n{votes}\n\nAGENT ANALYSIS:\n{nodes}\n\nCAUSAL CHAINS:\n{causal}")

    def to_flow(self):
        return {'nodes':[n.to_dict() for n in self.nodes.values()],
                'edges':[e.to_dict() for e in self.edges.values()],
                'signals':[s.to_dict() for s in self.signals],'stats':self.stats}

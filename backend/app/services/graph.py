import time
from dataclasses import dataclass, field, asdict
from typing import Optional

@dataclass
class Node:
    id: str; type: str; label: str; weight: float=0.5
    agent_id: Optional[str]=None; data: dict=field(default_factory=dict)
    def to_dict(self): return asdict(self)

@dataclass
class Edge:
    id: str; source: str; target: str
    label: str=''; direction: str='neutral'; weight: float=0.5; type: str='link'
    def to_dict(self): return asdict(self)

@dataclass
class Vote:
    agent_id: str; agent_name: str; role: str
    signal: str; confidence: int; reasoning: str
    factors: list=field(default_factory=list); butterflies: list=field(default_factory=list)
    def to_dict(self): return asdict(self)

class IntelGraph:
    def __init__(self, sym, asset_type):
        self.sym=sym; self.asset_type=asset_type
        self.nodes={}; self.edges={}; self.votes=[]
        self.nodes['root']=Node(id='root',type='asset',label=sym,weight=1.0)

    def add_node(self, n: Node): self.nodes[n.id]=n
    def add_edge(self, e: Edge): self.edges[e.id]=e
    def add_vote(self, v: Vote): self.votes.append(v)

    @property
    def stats(self):
        b=sum(1 for v in self.votes if v.signal=='bullish')
        be=sum(1 for v in self.votes if v.signal=='bearish')
        n=sum(1 for v in self.votes if v.signal=='neutral')
        return {'nodes':len(self.nodes),'edges':len(self.edges),'agents':len(self.votes),
                'bull':b,'bear':be,'neut':n}

    def to_synth_prompt(self):
        st=self.stats; t=st['agents'] or 1
        votes='\n'.join(f"  {v.role}({v.agent_name}): {v.signal} @{v.confidence}%" for v in self.votes)
        agents='\n\n'.join(
            f"[{n.id}] {n.label}({n.type}) signal={n.data.get('signal')} conf={n.data.get('confidence')}%\n"
            f"  Reasoning: {str(n.data.get('reasoning',''))[:300]}\n"
            f"  Factors: {' | '.join(n.data.get('factors',[]))}\n"
            f"  Butterflies: {' | '.join(n.data.get('butterflies',[]))}"
            for n in self.nodes.values() if n.type=='specialist')
        causal='\n'.join(
            f"  {e.source} --[{e.direction}]--> {e.target} '{e.label}'"
            for e in self.edges.values() if e.type=='causal') or '  (none)'
        return (f"ASSET: {self.sym} ({self.asset_type}) DATE: {time.strftime('%Y-%m-%d')}\n"
                f"VOTE TALLY: {st['bull']}B / {st['bear']}Be / {st['neut']}N from {t} agents\n\n"
                f"AGENT SIGNALS:\n{votes}\n\nAGENT NODES:\n{agents}\n\nCAUSAL CHAINS:\n{causal}")

    def to_flow(self):
        return {'nodes':[n.to_dict() for n in self.nodes.values()],
                'edges':[e.to_dict() for e in self.edges.values()],
                'votes':[v.to_dict() for v in self.votes],'stats':self.stats}

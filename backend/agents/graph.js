class SharedGraph {
  constructor(asset) {
    this.asset = asset;
    this.nodes = new Map();
    this.edges = new Map();
    this.signals = [];
    this.createdAt = Date.now();
    this.addNode({ id: 'root', type: 'asset', label: asset.symbol, category: 'root', data: { name: asset.name, assetType: asset.assetType }, weight: 1.0 });
  }

  addNode({ id, type, label, category, data = {}, weight = 0.5, agentId = null, agentName = null }) {
    this.nodes.set(id, { id, type, label, category, data, weight, agentId, agentName, ts: Date.now() });
  }

  addEdge({ id, source, target, label = '', weight = 0.5, direction = 'neutral', type = 'signal' }) {
    this.edges.set(id, { id, source, target, label, weight, direction, type, ts: Date.now() });
  }

  addSignal({ agentId, agentName, role, roleName, signal, confidence, reasoning, keyFactors, butterflies }) {
    this.signals.push({ agentId, agentName, role, roleName, signal, confidence, reasoning, keyFactors, butterflies, ts: Date.now() });
  }

  toSynthesizerInput() {
    const nodes = Array.from(this.nodes.values()).filter(n => n.type !== 'asset');
    const edges = Array.from(this.edges.values()).filter(e => e.type === 'causal');
    const bull = this.signals.filter(s => s.signal === 'bullish').length;
    const bear = this.signals.filter(s => s.signal === 'bearish').length;
    const neut = this.signals.filter(s => s.signal === 'neutral').length;
    const total = this.signals.length || 1;
    const avgConf = this.signals.length ? Math.round(this.signals.reduce((s, a) => s + (a.confidence || 0), 0) / this.signals.length) : 0;

    const nodeText = nodes.map(n => {
      const d = n.data || {};
      return `[${n.id}] ${n.label} (${n.category}) agent="${n.agentName || '?'}" conf=${d.confidence || 0}% signal=${d.signal || '?'}\n  Reasoning: ${String(d.reasoning || '').slice(0, 300)}\n  KeyFactors: ${(d.keyFactors || []).join(' | ')}\n  Butterflies: ${(d.butterflies || []).join(' | ')}`;
    }).join('\n\n');

    const edgeText = edges.map(e => `  ${e.source} --[${e.direction}/${e.weight.toFixed(2)}]--> ${e.target} "${e.label}"`).join('\n');
    const voteText = this.signals.map(s => `  ${s.roleName} (${s.agentName}): ${s.signal} @ ${s.confidence}%`).join('\n');

    return `ASSET: ${this.asset.symbol} (${this.asset.name || ''})
DATE: ${new Date().toISOString().split('T')[0]}
TOTAL AGENTS: ${this.signals.length} | NODES: ${this.nodes.size} | EDGES: ${this.edges.size}

VOTE TALLY:
  Bullish: ${bull}/${total} (${Math.round(bull/total*100)}%)
  Bearish: ${bear}/${total} (${Math.round(bear/total*100)}%)
  Neutral: ${neut}/${total} (${Math.round(neut/total*100)}%)
  Avg confidence: ${avgConf}%

INDIVIDUAL VOTES:
${voteText}

AGENT NODES (full analysis):
${nodeText}

CAUSAL EDGE CLAIMS (butterfly chains declared by agents):
${edgeText || '  (none)'}`;
  }

  toFlowFormat() {
    const bull = this.signals.filter(s => s.signal === 'bullish').length;
    const bear = this.signals.filter(s => s.signal === 'bearish').length;
    const neut = this.signals.filter(s => s.signal === 'neutral').length;
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
      signals: this.signals,
      stats: { totalNodes: this.nodes.size, totalEdges: this.edges.size, totalAgents: this.signals.length, bull, bear, neut }
    };
  }
}

module.exports = { SharedGraph };

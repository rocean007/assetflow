/**
 * SharedGraph — the central intelligence graph that all agents write to.
 *
 * Structure:
 *   nodes: Map<id, Node>   — each agent writes one or more nodes
 *   edges: Map<id, Edge>   — agents declare relationships between their nodes
 *   signals: []            — ordered list of all signal contributions
 *
 * This is the ONLY thing the synthesizer reads. It never sees raw agent
 * outputs directly — it only sees what ended up in the graph.
 */
class SharedGraph {
  constructor(asset) {
    this.asset = asset;
    this.nodes = new Map();
    this.edges = new Map();
    this.signals = [];
    this.createdAt = Date.now();

    // Seed the root node — the asset being analyzed
    this.addNode({
      id: 'root',
      type: 'asset',
      label: asset.symbol,
      category: 'root',
      data: { name: asset.name, assetType: asset.assetType },
      weight: 1.0,
    });
  }

  /** Agent calls this to write its analytical node into the graph */
  addNode({ id, type, label, category, data, weight = 0.5, agentId = null, agentName = null }) {
    this.nodes.set(id, { id, type, label, category, data, weight, agentId, agentName, ts: Date.now() });
  }

  /** Agent calls this to declare a relationship between two nodes */
  addEdge({ id, source, target, label = '', weight = 0.5, direction = 'neutral', type = 'signal' }) {
    this.edges.set(id, { id, source, target, label, weight, direction, type, ts: Date.now() });
  }

  /** Agent calls this to register a top-level directional signal */
  addSignal({ agentId, agentName, role, roleName, signal, confidence, reasoning, keyFactors, butterflies }) {
    this.signals.push({ agentId, agentName, role, roleName, signal, confidence, reasoning, keyFactors, butterflies, ts: Date.now() });
  }

  /** Serialize to a compact text representation the synthesizer can read */
  toSynthesizerInput() {
    const nodeList = Array.from(this.nodes.values())
      .filter(n => n.type !== 'asset')
      .map(n => {
        const d = n.data || {};
        return `[NODE:${n.id}] ${n.label} (${n.category}) w=${n.weight.toFixed(2)} agent="${n.agentName || '?'}"
  signal=${d.signal || '?'} conf=${d.confidence || 0}%
  reasoning=${String(d.reasoning || '').slice(0, 200)}
  keyFactors=${(d.keyFactors || []).join(' | ')}
  butterflies=${(d.butterflies || []).join(' | ')}`;
      }).join('\n\n');

    const edgeList = Array.from(this.edges.values())
      .filter(e => e.source !== 'root' || e.type !== 'root_link') // skip trivial root links
      .map(e => `  ${e.source} --[${e.direction}/${e.weight.toFixed(2)}]--> ${e.target}  "${e.label}"`)
      .join('\n');

    const signalVotes = this.signals.map(s =>
      `  ${s.roleName} (${s.agentName}): ${s.signal} @ ${s.confidence}% conf`
    ).join('\n');

    const bull = this.signals.filter(s => s.signal === 'bullish').length;
    const bear = this.signals.filter(s => s.signal === 'bearish').length;
    const neut = this.signals.filter(s => s.signal === 'neutral').length;
    const total = this.signals.length || 1;
    const avgConf = this.signals.length
      ? Math.round(this.signals.reduce((s, a) => s + (a.confidence || 0), 0) / this.signals.length)
      : 0;

    return `
ASSET: ${this.asset.symbol} (${this.asset.name || ''}) [${this.asset.assetType || 'equity'}]
ANALYSIS DATE: ${new Date().toISOString().split('T')[0]}
TOTAL AGENTS CONTRIBUTED: ${this.signals.length}
GRAPH: ${this.nodes.size} nodes, ${this.edges.size} edges

VOTE SUMMARY:
  Bullish: ${bull}/${total} (${Math.round((bull / total) * 100)}%)
  Bearish: ${bear}/${total} (${Math.round((bear / total) * 100)}%)
  Neutral: ${neut}/${total} (${Math.round((neut / total) * 100)}%)
  Avg confidence: ${avgConf}%

INDIVIDUAL SIGNAL VOTES:
${signalVotes}

FULL GRAPH NODES (all agent contributions):
${nodeList}

GRAPH EDGES (causal/influence relationships):
${edgeList || '  (none declared)'}
`;
  }

  /** Serialize to ReactFlow-compatible format for the frontend */
  toFlowFormat() {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
      signals: this.signals,
      stats: {
        totalNodes: this.nodes.size,
        totalEdges: this.edges.size,
        totalAgents: this.signals.length,
        bull: this.signals.filter(s => s.signal === 'bullish').length,
        bear: this.signals.filter(s => s.signal === 'bearish').length,
        neut: this.signals.filter(s => s.signal === 'neutral').length,
      },
    };
  }
}

module.exports = { SharedGraph };

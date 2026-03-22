import { useMemo } from 'react';
import ReactFlow, { Background, Controls, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';

const SIG  = { bullish: '#00e676', bearish: '#ff3d5a', neutral: '#ffd740', up: '#00e676', down: '#ff3d5a' };
const TYPE = { asset: '#00c8ff', specialist: '#60a5fa', concept: '#64748b', synthesizer: '#a78bfa' };

function layout(nodes) {
  const pos = new Map();
  const specs  = nodes.filter(n => n.type === 'specialist');
  const concs  = nodes.filter(n => n.type === 'concept').slice(0, 28);
  const synths = nodes.filter(n => n.type === 'synthesizer');
  const root   = nodes.find(n => n.type === 'asset');

  if (root) pos.set(root.id, { x: 500, y: 20 });

  const sw = Math.max(900, specs.length * 125);
  specs.forEach((n, i) => pos.set(n.id, { x: 50 + (sw / Math.max(1, specs.length - 1)) * i, y: 160 }));

  const cw = Math.max(1000, concs.length * 78);
  concs.forEach((n, i) => pos.set(n.id, { x: 20 + (cw / Math.max(1, concs.length - 1)) * i, y: 310 }));

  synths.forEach((n, i) => pos.set(n.id, { x: 350 + i * 320, y: 450 }));
  return pos;
}

export default function AgentGraph({ graph }) {
  const { nodes: rfNodes, edges: rfEdges } = useMemo(() => {
    if (!graph?.nodes?.length) return { nodes: [], edges: [] };

    const nodeArr = Array.isArray(graph.nodes) ? graph.nodes : [];
    const pos = layout(nodeArr);

    const nodes = nodeArr.map(n => {
      const p = pos.get(n.id) || { x: 300, y: 300 };
      const sig = n.data?.signal || n.data?.primary_direction || n.data?.primaryDirection;
      const color = (sig && SIG[sig]) ? SIG[sig] : (TYPE[n.type] || '#4a5568');
      const isConcept = n.type === 'concept';
      const isKey = n.type === 'asset' || n.type === 'synthesizer';

      return {
        id: n.id,
        position: p,
        data: {
          label: (
            <div style={{ textAlign: 'center', padding: isConcept ? '1px 3px' : '3px 5px' }}>
              <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: isConcept ? 9 : 11,
                            fontWeight: 600, color, lineHeight: 1.3 }}>
                {(n.label || '').length > 20 ? n.label.slice(0, 18) + '…' : n.label}
              </div>
              {n.data?.confidence != null && !isConcept && (
                <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#4a5568' }}>
                  {n.data.confidence}%
                </div>
              )}
            </div>
          )
        },
        style: {
          background: '#0f1218',
          border: `1px solid ${color}40`,
          borderRadius: isConcept ? 4 : 8,
          minWidth: isConcept ? 65 : 108,
          padding: isConcept ? 2 : 4,
          boxShadow: isKey ? `0 0 18px ${color}25` : `0 0 8px ${color}12`,
        },
      };
    });

    const edgeArr = Array.isArray(graph.edges) ? graph.edges : [];
    const edges = edgeArr
      .filter(e => e.type !== 'reference' && nodeArr.some(n => n.id === e.source) && nodeArr.some(n => n.id === e.target))
      .map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        animated: e.type === 'root_link',
        style: {
          stroke: SIG[e.direction] || '#2d3748',
          strokeWidth: e.type === 'causal' ? 1 : 1.5,
          opacity: e.type === 'causal' ? 0.45 : 0.7,
          strokeDasharray: e.type === 'causal' ? '4 3' : undefined,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: SIG[e.direction] || '#2d3748', width: 10, height: 10 },
      }));

    return { nodes, edges };
  }, [graph]);

  if (!rfNodes.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                    height: '100%', color: '#4a5568', fontFamily: 'monospace', fontSize: 13 }}>
        No graph data
      </div>
    );
  }

  return (
    <ReactFlow nodes={rfNodes} edges={rfEdges}
      fitView fitViewOptions={{ padding: 0.15 }}
      nodesDraggable={false} nodesConnectable={false}
      elementsSelectable={false} panOnDrag zoomOnScroll
      proOptions={{ hideAttribution: true }}>
      <Background color="#1c2333" gap={22} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

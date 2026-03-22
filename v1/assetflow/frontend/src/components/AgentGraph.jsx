import { useMemo } from 'react';
import ReactFlow, { Background, Controls, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';

const SIG_COLOR = { bullish: '#00e676', bearish: '#ff3d5a', neutral: '#ffd740' };
const TYPE_COLOR = { asset: '#00d4ff', specialist: '#60a5fa', concept: '#94a3b8', synthesizer: '#a78bfa' };

// Simple deterministic layout:
// Row 0 (top center): asset root
// Row 1 (spread): all specialist nodes
// Row 2 (spread): concept nodes
// Row 3 (bottom center): synthesizer
function layoutNodes(nodes) {
  const specialists = nodes.filter(n => n.type === 'specialist');
  const concepts = nodes.filter(n => n.type === 'concept').slice(0, 24); // cap visual at 24
  const synthNode = nodes.find(n => n.type === 'synthesizer');
  const rootNode = nodes.find(n => n.type === 'asset');

  const positioned = new Map();

  if (rootNode) positioned.set(rootNode.id, { x: 500, y: 20 });

  // Specialists spread across row 1
  const specWidth = Math.max(800, specialists.length * 130);
  specialists.forEach((n, i) => {
    positioned.set(n.id, {
      x: (specWidth / Math.max(1, specialists.length - 1)) * i + 60,
      y: 160,
    });
  });

  // Concepts spread across row 2
  const concWidth = Math.max(900, concepts.length * 80);
  concepts.forEach((n, i) => {
    positioned.set(n.id, {
      x: (concWidth / Math.max(1, concepts.length - 1)) * i + 20,
      y: 320,
    });
  });

  if (synthNode) positioned.set(synthNode.id, { x: 500, y: 460 });

  return positioned;
}

export default function AgentGraph({ graph }) {
  const { nodes: rfNodes, edges: rfEdges } = useMemo(() => {
    if (!graph?.nodes?.length) return { nodes: [], edges: [] };

    // graph.nodes is an array from toFlowFormat()
    const nodeArr = Array.isArray(graph.nodes)
      ? graph.nodes
      : Array.from(graph.nodes.values ? graph.nodes.values() : []);

    const positions = layoutNodes(nodeArr);

    // Add synthesizer node if present in synthesis but not graph
    const hasSynth = nodeArr.some(n => n.type === 'synthesizer');
    if (!hasSynth) {
      nodeArr.push({ id: 'synthesizer', type: 'synthesizer', label: 'Synthesizer', category: 'synthesizer', data: {} });
      positions.set('synthesizer', { x: 500, y: 460 });
    }

    const nodes = nodeArr.map(n => {
      const pos = positions.get(n.id) || { x: 200, y: 300 };
      const color = n.data?.signal ? SIG_COLOR[n.data.signal] || TYPE_COLOR[n.type] || '#4a5568'
        : TYPE_COLOR[n.type] || '#4a5568';
      const isRoot = n.type === 'asset';
      const isSynth = n.type === 'synthesizer';
      const isConcept = n.type === 'concept';

      return {
        id: n.id,
        position: pos,
        data: {
          label: (
            <div style={{ textAlign: 'center', padding: '2px 4px', minWidth: isConcept ? 70 : 100 }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: isConcept ? 9 : 11, fontWeight: 600, color }}>
                {n.label?.length > 22 ? n.label.slice(0, 20) + '…' : n.label}
              </div>
              {n.data?.confidence != null && (
                <div style={{ fontFamily: 'monospace', fontSize: 9, opacity: 0.6, color: '#e2e8f0' }}>
                  {n.data.confidence}% conf
                </div>
              )}
              {(isSynth && n.data?.upProbability != null) && (
                <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#00e676' }}>
                  ↑{n.data.upProbability}%
                </div>
              )}
            </div>
          ),
        },
        style: {
          background: '#11141a',
          border: `1px solid ${color}50`,
          borderRadius: isConcept ? 4 : 8,
          padding: isConcept ? '1px' : '2px 4px',
          boxShadow: isRoot || isSynth ? `0 0 16px ${color}30` : `0 0 8px ${color}15`,
          minWidth: isConcept ? 70 : 100,
        },
      };
    });

    const edgeArr = Array.isArray(graph.edges)
      ? graph.edges
      : Array.from(graph.edges?.values ? graph.edges.values() : []);

    // Filter to visually meaningful edges only
    const meaningful = edgeArr.filter(e =>
      e.type !== 'reference' && // hide agent→concept reference edges to reduce clutter
      nodeArr.some(n => n.id === e.source) &&
      nodeArr.some(n => n.id === e.target)
    );

    const edges = meaningful.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      animated: e.type === 'root_link',
      style: {
        stroke: e.direction ? SIG_COLOR[e.direction] || '#2d3748' : '#2d3748',
        strokeWidth: e.type === 'causal' ? 1 : e.type === 'root_link' ? 1.5 : 1,
        opacity: e.type === 'causal' ? 0.5 : 0.75,
        strokeDasharray: e.type === 'causal' ? '4 2' : undefined,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: e.direction ? SIG_COLOR[e.direction] || '#2d3748' : '#2d3748',
        width: 12,
        height: 12,
      },
    }));

    return { nodes, edges };
  }, [graph]);

  if (!rfNodes.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#4a5568', fontFamily: 'monospace', fontSize: 13 }}>
        No graph data yet
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnDrag
      zoomOnScroll
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#1e2430" gap={20} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

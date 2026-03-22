import { useMemo } from 'react';
import ReactFlow, { Background, Controls, MiniMap, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';

const SIGNAL_COLOR = { bullish: '#00e676', bearish: '#ff3d5a', neutral: '#ffd740' };
const NODE_TYPE_COLOR = { asset: '#00d4ff', specialist: '#4a5568', synthesizer: '#a78bfa' };

function buildFlowNodes(graph) {
  if (!graph?.nodes) return { nodes: [], edges: [] };

  const nodes = graph.nodes.map(n => {
    const isAsset = n.type === 'asset';
    const isSynth = n.type === 'synthesizer';
    const signal = n.data?.signal || (isSynth ? n.data?.primaryDirection : null);
    const color = isAsset ? '#00d4ff' : isSynth ? '#a78bfa' : SIGNAL_COLOR[signal] || '#4a5568';

    // Automatic layout
    let x = 400, y = 50;
    if (isAsset) { x = 400; y = 30; }
    else if (isSynth) { x = 400; y = 320; }
    else {
      const specialists = graph.nodes.filter(nn => nn.type === 'specialist');
      const idx = specialists.findIndex(nn => nn.id === n.id);
      const total = specialists.length;
      x = 80 + (idx / Math.max(1, total - 1)) * 640;
      y = 170;
    }

    return {
      id: n.id,
      position: { x, y },
      data: {
        label: (
          <div className="text-center px-2 py-1">
            <div className="font-mono text-xs font-semibold" style={{ color }}>{n.label}</div>
            {n.data?.confidence != null && (
              <div className="font-mono text-xs opacity-60">{n.data.confidence}% conf</div>
            )}
            {(n.data?.upProbability != null) && (
              <div className="font-mono text-xs" style={{ color: '#00e676' }}>{n.data.upProbability}% up</div>
            )}
          </div>
        ),
      },
      style: {
        background: '#11141a',
        border: `1px solid ${color}40`,
        borderRadius: 8,
        padding: '2px 4px',
        minWidth: isAsset || isSynth ? 100 : 110,
        boxShadow: `0 0 12px ${color}20`,
      },
    };
  });

  const edges = (graph.edges || []).map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    animated: e.type !== 'influence',
    style: {
      stroke: e.signal ? SIGNAL_COLOR[e.signal] || '#4a5568' : '#2d3748',
      strokeWidth: e.type === 'influence' ? 1 : 1.5,
      opacity: e.type === 'influence' ? 0.3 : 0.7,
    },
    markerEnd: { type: MarkerType.ArrowClosed, color: e.signal ? SIGNAL_COLOR[e.signal] || '#4a5568' : '#2d3748' },
  }));

  return { nodes, edges };
}

export default function AgentGraph({ graph }) {
  const { nodes, edges } = useMemo(() => buildFlowNodes(graph), [graph]);

  if (!nodes.length) return <div className="flex items-center justify-center h-full text-muted text-sm font-mono">No graph data</div>;

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnDrag={true}
      zoomOnScroll={true}
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#1e2430" gap={24} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

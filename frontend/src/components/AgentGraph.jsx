import { useMemo } from 'react';
import ReactFlow, { Background, Controls, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';

const SIG = { bullish:'#10b981',bearish:'#f43f5e',neutral:'#f59e0b',up:'#10b981',down:'#f43f5e' };
const TYPE = { asset:'#0ea5e9',specialist:'#6366f1',concept:'#374151',synthesizer:'#a855f7' };

function layout(nodes) {
  const pos = new Map();
  const specs   = nodes.filter(n=>n.type==='specialist');
  const concs   = nodes.filter(n=>n.type==='concept').slice(0,24);
  const synths  = nodes.filter(n=>n.type==='synthesizer');
  const root    = nodes.find(n=>n.type==='asset');
  if (root) pos.set(root.id,{x:480,y:20});
  const sw = Math.max(880,specs.length*120);
  specs.forEach((n,i)=>pos.set(n.id,{x:40+(sw/Math.max(1,specs.length-1))*i,y:150}));
  const cw = Math.max(960,concs.length*72);
  concs.forEach((n,i)=>pos.set(n.id,{x:16+(cw/Math.max(1,concs.length-1))*i,y:300}));
  synths.forEach((n,i)=>pos.set(n.id,{x:320+i*300,y:420}));
  return pos;
}

export default function AgentGraph({ graph }) {
  const { nodes: rfN, edges: rfE } = useMemo(() => {
    if (!graph?.nodes?.length) return { nodes:[], edges:[] };
    const pos = layout(graph.nodes);
    const nodes = graph.nodes.map(n => {
      const p = pos.get(n.id)||{x:300,y:300};
      const sig = n.data?.signal;
      const col = (sig&&SIG[sig])?SIG[sig]:(TYPE[n.type]||'#374151');
      const tiny = n.type==='concept';
      return {
        id:n.id, position:p,
        data:{ label:(
          <div style={{textAlign:'center',padding:tiny?'1px 4px':'4px 6px'}}>
            <div className="mono" style={{fontSize:tiny?9:11,fontWeight:600,color:col,lineHeight:1.3}}>
              {(n.label||'').length>22?n.label.slice(0,20)+'…':n.label}
            </div>
            {n.data?.confidence!=null&&!tiny&&(
              <div className="mono" style={{fontSize:9,color:'#374151'}}>{n.data.confidence}%</div>
            )}
          </div>
        )},
        style:{background:'#0d1117',border:`1px solid ${col}35`,borderRadius:tiny?4:7,
               minWidth:tiny?60:100,padding:tiny?2:4,boxShadow:`0 0 10px ${col}18`},
      };
    });
    const edges = (graph.edges||[])
      .filter(e=>e.type!=='reference'&&graph.nodes.some(n=>n.id===e.source)&&graph.nodes.some(n=>n.id===e.target))
      .map(e=>({
        id:e.id,source:e.source,target:e.target,animated:e.type==='root_link',
        style:{stroke:SIG[e.direction]||'#1e2433',strokeWidth:e.type==='causal'?1:1.5,
               opacity:e.type==='causal'?.4:.7,strokeDasharray:e.type==='causal'?'4 3':undefined},
        markerEnd:{type:MarkerType.ArrowClosed,color:SIG[e.direction]||'#1e2433',width:10,height:10},
      }));
    return { nodes, edges };
  }, [graph]);

  if (!rfN.length) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',
                 fontFamily:'monospace',fontSize:12,color:'#374151'}}>No graph data</div>
  );
  return (
    <ReactFlow nodes={rfN} edges={rfE} fitView fitViewOptions={{padding:.15}}
      nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
      panOnDrag zoomOnScroll proOptions={{hideAttribution:true}}>
      <Background color="#1e2433" gap={20} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

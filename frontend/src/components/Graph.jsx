import { useMemo } from 'react';
import ReactFlow, { Background, Controls, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';
const SIG={bullish:'#10b981',bearish:'#f43f5e',neutral:'#f59e0b'};
const TYPE={asset:'#3b82f6',specialist:'#6366f1',concept:'#334155',synthesizer:'#a855f7'};
function layout(nodes){
  const pos=new Map();
  const specs=nodes.filter(n=>n.type==='specialist');
  const concs=nodes.filter(n=>n.type==='concept').slice(0,20);
  const root=nodes.find(n=>n.type==='asset');
  if(root) pos.set(root.id,{x:460,y:20});
  const sw=Math.max(860,specs.length*115);
  specs.forEach((n,i)=>pos.set(n.id,{x:30+(sw/Math.max(1,specs.length-1))*i,y:140}));
  const cw=Math.max(920,concs.length*66);
  concs.forEach((n,i)=>pos.set(n.id,{x:14+(cw/Math.max(1,concs.length-1))*i,y:280}));
  return pos;
}
export default function Graph({graph}){
  const{nodes:rfN,edges:rfE}=useMemo(()=>{
    if(!graph?.nodes?.length) return{nodes:[],edges:[]};
    const pos=layout(graph.nodes);
    const nodes=graph.nodes.map(n=>{
      const p=pos.get(n.id)||{x:300,y:300};
      const sig=n.data?.signal;
      const col=(sig&&SIG[sig])?SIG[sig]:(TYPE[n.type]||'#334155');
      const tiny=n.type==='concept';
      return{id:n.id,position:p,data:{label:(
        <div style={{textAlign:'center',padding:tiny?'1px 3px':'3px 5px'}}>
          <div className="mono" style={{fontSize:tiny?9:10,fontWeight:600,color:col,lineHeight:1.3}}>
            {(n.label||'').slice(0,20)}{n.label?.length>20?'…':''}
          </div>
          {n.data?.confidence!=null&&!tiny&&<div className="mono" style={{fontSize:8,color:'#475569'}}>{n.data.confidence}%</div>}
        </div>
      )},style:{background:'#0c0f1a',border:`1px solid ${col}30`,borderRadius:tiny?3:6,
                minWidth:tiny?55:95,padding:tiny?1:3,boxShadow:`0 0 8px ${col}15`}};
    });
    const edges=(graph.edges||[])
      .filter(e=>graph.nodes.some(n=>n.id===e.source)&&graph.nodes.some(n=>n.id===e.target))
      .map(e=>({id:e.id,source:e.source,target:e.target,animated:e.type==='root_link',
                style:{stroke:SIG[e.direction]||'#1a2035',strokeWidth:e.type==='causal'?1:1.5,
                       opacity:e.type==='causal'?.35:.65,strokeDasharray:e.type==='causal'?'4 3':undefined},
                markerEnd:{type:MarkerType.ArrowClosed,color:SIG[e.direction]||'#1a2035',width:9,height:9}}));
    return{nodes,edges};
  },[graph]);
  if(!rfN.length) return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',
                 fontFamily:'monospace',fontSize:12,color:'#334155'}}>No graph</div>);
  return(
    <ReactFlow nodes={rfN} edges={rfE} fitView fitViewOptions={{padding:.12}}
      nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
      panOnDrag zoomOnScroll proOptions={{hideAttribution:true}}>
      <Background color="#1a2035" gap={18} size={1}/>
      <Controls showInteractive={false}/>
    </ReactFlow>);
}

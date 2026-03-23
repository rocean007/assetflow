import { useState } from 'react';
import { SigColor } from './UI';

export default function AgentCard({ output: o }) {
  const [open, setOpen] = useState(false);
  const col = SigColor[o?.signal] || '#f59e0b';
  const kf  = o?.keyFactors || o?.key_factors || [];
  const bf  = o?.butterflies || [];
  return (
    <div style={{ background:'#0d1117',border:`1px solid ${o?._error?'#f43f5e22':'#1e2433'}`,
                  borderRadius:7,padding:14,opacity:o?._error?.6:1 }}>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8 }}>
        <div>
          <span className="mono" style={{ fontSize:12,fontWeight:600,color:'#e2e8f0' }}>
            {o?.role_name||o?.roleName||o?.role}
          </span>
          <span className="mono" style={{ fontSize:10,color:'#374151',marginLeft:8 }}>
            {o?.agent_name||o?.agentName}
          </span>
        </div>
        <span className="mono" style={{ fontSize:10,padding:'2px 8px',borderRadius:4,
          color:col,background:col+'15',border:`1px solid ${col}35` }}>
          {(o?.signal||'?').toUpperCase()} {o?.confidence}%
        </span>
      </div>
      <div style={{ height:2,background:'#1e2433',borderRadius:2,marginBottom:8 }}>
        <div style={{ height:2,width:`${o?.confidence||0}%`,background:col,borderRadius:2,transition:'width .6s' }} />
      </div>
      <p style={{ fontSize:12,lineHeight:1.6,color:'#94a3b8',margin:0 }}>
        {o?.reasoning||'No reasoning provided.'}
      </p>
      {(kf.length>0||bf.length>0)&&(
        <button onClick={()=>setOpen(x=>!x)} className="mono"
          style={{ fontSize:10,color:'#0ea5e9',background:'none',border:'none',marginTop:6,padding:0,cursor:'pointer' }}>
          {open?'▾ less':'▸ details'}
        </button>
      )}
      {open&&(
        <div style={{ marginTop:10,borderTop:'1px solid #1e2433',paddingTop:10,display:'flex',flexDirection:'column',gap:8 }}>
          {kf.length>0&&(
            <div>
              <div className="mono" style={{ fontSize:9,color:'#374151',textTransform:'uppercase',letterSpacing:1,marginBottom:4 }}>Key Factors</div>
              {kf.map((f,i)=>(<div key={i} style={{ display:'flex',gap:6,fontSize:12,color:'#94a3b8',marginBottom:2 }}><span style={{color:'#0ea5e9'}}>›</span>{f}</div>))}
            </div>
          )}
          {bf.length>0&&(
            <div>
              <div className="mono" style={{ fontSize:9,color:'#374151',textTransform:'uppercase',letterSpacing:1,marginBottom:4 }}>🦋 Butterfly Chains</div>
              {bf.map((b,i)=>(<div key={i} style={{ display:'flex',gap:6,fontSize:12,color:'#94a3b8',marginBottom:2 }}><span style={{color:'#f59e0b'}}>›</span>{b}</div>))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { simulationApi } from '../utils/api';
import { CardPad, DirColor } from '../components/UI';

export default function History() {
  const { history, setHistory } = useStore();
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    simulationApi.history(100).then(r=>{setHistory(r.data||[]);setLoading(false);}).catch(()=>setLoading(false));
  }, []);
  if (loading) return <div className="mono" style={{ color:'#374151',padding:32,fontSize:12 }}>Loading...</div>;
  return (
    <div className="slide" style={{ display:'flex',flexDirection:'column',gap:20 }}>
      <div>
        <h1 className="mono" style={{ fontSize:22,fontWeight:600,color:'#e2e8f0' }}>History</h1>
        <p style={{ fontSize:13,color:'#374151',marginTop:4 }}>{history.length} past analyses</p>
      </div>
      {!history.length?(
        <CardPad style={{ textAlign:'center',padding:48 }}>
          <div className="mono" style={{ color:'#374151',fontSize:12 }}>No history yet. Run your first analysis.</div>
        </CardPad>
      ):(
        <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
          {history.map((h,i)=>{
            const dir = h.direction; const col = DirColor(dir);
            return (
              <CardPad key={i} style={{ padding:14 }}>
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                  <div style={{ display:'flex',alignItems:'center',gap:12 }}>
                    <span className="mono" style={{ fontSize:14,fontWeight:600,color:'#e2e8f0',minWidth:48 }}>
                      {h.symbol||h.asset?.symbol}
                    </span>
                    <span className="mono" style={{ fontSize:11,padding:'2px 8px',borderRadius:4,
                      color:col,border:`1px solid ${col}40`,background:col+'10' }}>
                      {(dir||'?').toUpperCase()}
                    </span>
                    <span className="mono" style={{ fontSize:11,color:'#10b981' }}>↑{h.up||h.up_probability}%</span>
                    <span className="mono" style={{ fontSize:11,color:'#f43f5e' }}>↓{h.down||h.down_probability}%</span>
                    <span className="mono" style={{ fontSize:10,color:'#374151' }}>conf {h.confidence}%</span>
                  </div>
                  <span className="mono" style={{ fontSize:10,color:'#374151' }}>
                    {new Date(h.created_at||h.createdAt||Date.now()).toLocaleString()}
                  </span>
                </div>
                {h.excerpt&&<p style={{ fontSize:11,color:'#374151',marginTop:8,lineHeight:1.5,
                  overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical' }}>
                  {h.excerpt}</p>}
              </CardPad>
            );
          })}
        </div>
      )}
    </div>
  );
}

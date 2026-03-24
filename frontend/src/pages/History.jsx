import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionsApi } from '../utils/api';
import { P, Tag, SC } from '../components/UI';

export default function History() {
  const nav = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    sessionsApi.list().then(r=>{setSessions(r.data||[]);setLoading(false);}).catch(()=>setLoading(false));
  },[]);
  if(loading) return <div className="mono" style={{color:'#334155',padding:32,fontSize:12}}>Loading...</div>;
  return (
    <div className="slide" style={{display:'flex',flexDirection:'column',gap:16}}>
      <h1 className="mono" style={{fontSize:22,fontWeight:600,color:'#e2e8f0'}}>History</h1>
      {!sessions.length ? (
        <P style={{textAlign:'center',padding:48}}>
          <div className="mono" style={{color:'#334155',fontSize:12}}>No sessions yet.</div>
        </P>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {sessions.map(s => {
            const r=s.final_result||s.fast_result||{};
            const col=SC(r.direction);
            return (
              <P key={s.session_id} style={{padding:'12px 14px',cursor:'pointer'}}
                 onClick={()=>nav(`/run/${s.session_id}`)}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <span className="mono" style={{fontSize:14,fontWeight:700,color:'#e2e8f0',minWidth:48}}>{s.symbol}</span>
                    <Tag label={s.asset_type}/>
                    <Tag label={s.status} color={s.status==='completed'?'#10b981':s.status==='failed'?'#f43f5e':'#f59e0b'}/>
                    {r.direction && <>
                      <span className="mono" style={{fontSize:11,color:col}}>{r.direction.toUpperCase()}</span>
                      <span className="mono" style={{fontSize:11,color:'#10b981'}}>↑{r.up}%</span>
                      <span className="mono" style={{fontSize:11,color:'#f43f5e'}}>↓{r.down}%</span>
                      <span className="mono" style={{fontSize:10,color:'#334155'}}>conf:{r.confidence}%</span>
                    </>}
                    {s.files_count>0&&<Tag label={`${s.files_count} files`} color="#475569"/>}
                    {s.interviews_count>0&&<Tag label={`${s.interviews_count} interviews`} color="#6366f1"/>}
                  </div>
                  <span className="mono" style={{fontSize:9,color:'#334155'}}>
                    {new Date(s.created_at||Date.now()).toLocaleString()}
                  </span>
                </div>
                {r.summary&&<p style={{fontSize:11,color:'#334155',marginTop:6,lineHeight:1.4,
                  overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{r.summary}</p>}
              </P>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionsApi } from '../utils/api';
import { Card, P, SC, Tag } from '../components/UI';
import Gauge from '../components/Gauge';
import Graph from '../components/Graph';

export default function Home() {
  const nav = useNavigate();
  const [sessions, setSessions] = useState([]);
  useEffect(() => {
    sessionsApi.list().then(r => setSessions(r.data || [])).catch(() => {});
  }, []);
  const latest = sessions[0];
  const r = latest?.final_result || latest?.fast_result;

  return (
    <div className="slide" style={{display:'flex',flexDirection:'column',gap:18}}>
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between'}}>
        <div>
          <h1 className="mono" style={{fontSize:22,fontWeight:600,color:'#e2e8f0'}}>Dashboard</h1>
          <p style={{fontSize:13,color:'#334155',marginTop:3}}>
            Probabilistic multi-agent asset intelligence · single unified flow
          </p>
        </div>
        <button onClick={() => nav('/run')}
          style={{fontFamily:'monospace',fontSize:12,padding:'7px 18px',borderRadius:5,
                  border:'none',color:'#050810',background:'#3b82f6',fontWeight:600,cursor:'pointer'}}>
          ▶ New Analysis
        </button>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
        {[['Sessions',sessions.length,'total'],
          ['Active',sessions.filter(s=>s.status==='running'||s.status==='enriching').length,'running'],
          ['Data Sources','25+','categories'],['Providers','10+','LLM APIs']
        ].map(([l,v,s])=>(
          <P key={l} style={{padding:14}}>
            <div className="mono" style={{fontSize:9,color:'#334155',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>{l}</div>
            <div className="mono" style={{fontSize:22,fontWeight:700,color:'#e2e8f0'}}>{v}</div>
            <div style={{fontSize:11,color:'#334155',marginTop:2}}>{s}</div>
          </P>
        ))}
      </div>

      {latest && r ? (
        <div style={{display:'flex',flexDirection:'column',gap:14}} className="fade">
          <div style={{display:'grid',gridTemplateColumns:'200px 1fr',gap:14}}>
            <P style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:20}}>
              <div className="mono" style={{fontSize:9,color:'#334155',textTransform:'uppercase',letterSpacing:1,marginBottom:12}}>
                {latest.symbol}
              </div>
              <Gauge r={r}/>
            </P>
            <P style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span className="mono" style={{fontSize:16,fontWeight:700,color:'#e2e8f0'}}>{latest.symbol}</span>
                <div style={{display:'flex',gap:6}}>
                  <Tag label={latest.asset_type}/>
                  <Tag label={latest.status} color={latest.status==='completed'?'#10b981':latest.status==='failed'?'#f43f5e':'#f59e0b'}/>
                </div>
              </div>
              {r.summary && <p style={{fontSize:13,lineHeight:1.65,color:'#94a3b8'}}>{r.summary}</p>}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div style={{borderRadius:6,padding:12,background:'rgba(16,185,129,.04)',border:'1px solid rgba(16,185,129,.18)'}}>
                  <div className="mono" style={{fontSize:9,color:'#10b981',marginBottom:6,display:'flex',justifyContent:'space-between'}}>
                    BULL CASE <span>{r.up}%</span>
                  </div>
                  <p style={{fontSize:12,lineHeight:1.5,color:'#94a3b8'}}>{r.bull_case||'—'}</p>
                </div>
                <div style={{borderRadius:6,padding:12,background:'rgba(244,63,94,.04)',border:'1px solid rgba(244,63,94,.18)'}}>
                  <div className="mono" style={{fontSize:9,color:'#f43f5e',marginBottom:6,display:'flex',justifyContent:'space-between'}}>
                    BEAR CASE <span>{r.down}%</span>
                  </div>
                  <p style={{fontSize:12,lineHeight:1.5,color:'#94a3b8'}}>{r.bear_case||'—'}</p>
                </div>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={() => nav(`/run/${latest.session_id}`)}
                  style={{fontFamily:'monospace',fontSize:11,padding:'5px 14px',borderRadius:4,cursor:'pointer',
                          border:'1px solid rgba(59,130,246,.3)',color:'#3b82f6',background:'rgba(59,130,246,.08)'}}>
                  View Full Analysis
                </button>
              </div>
            </P>
          </div>
          {latest.graph && (
            <Card>
              <div style={{padding:'10px 14px',borderBottom:'1px solid #1a2035',display:'flex',justifyContent:'space-between'}}>
                <span className="mono" style={{fontSize:9,color:'#334155',textTransform:'uppercase',letterSpacing:1}}>Intelligence Graph</span>
                <span className="mono" style={{fontSize:9,color:'#334155'}}>
                  {latest.graph.stats?.nodes}n · {latest.graph.stats?.edges}e
                </span>
              </div>
              <div style={{height:300}}><Graph graph={latest.graph}/></div>
            </Card>
          )}
        </div>
      ) : (
        <P style={{textAlign:'center',padding:52}}>
          <div style={{fontSize:32,marginBottom:10}}>◎</div>
          <div className="mono" style={{color:'#e2e8f0',marginBottom:6}}>No analyses yet</div>
          <p style={{fontSize:13,color:'#334155',marginBottom:18}}>
            Enter a ticker, optionally upload research files, and watch the swarm work
          </p>
          <button onClick={() => nav('/run')}
            style={{fontFamily:'monospace',fontSize:12,padding:'8px 20px',borderRadius:5,cursor:'pointer',
                    border:'none',color:'#050810',background:'#3b82f6',fontWeight:600}}>
            Start First Analysis
          </button>
        </P>
      )}

      {sessions.length > 1 && (
        <div>
          <div className="mono" style={{fontSize:9,color:'#334155',textTransform:'uppercase',letterSpacing:1,marginBottom:10}}>
            Recent Sessions
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {sessions.slice(0,5).map(s => {
              const fr=s.final_result||s.fast_result||{};
              const col=SC(fr.direction);
              return (
                <P key={s.session_id} style={{padding:'10px 14px',cursor:'pointer'}}
                   onClick={() => nav(`/run/${s.session_id}`)}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <span className="mono" style={{fontSize:13,fontWeight:700,color:'#e2e8f0',minWidth:44}}>{s.symbol}</span>
                      <Tag label={s.status} color={s.status==='completed'?'#10b981':s.status==='failed'?'#f43f5e':'#f59e0b'}/>
                      {fr.direction && <>
                        <span className="mono" style={{fontSize:11,color:col}}>{fr.direction?.toUpperCase()}</span>
                        <span className="mono" style={{fontSize:11,color:'#10b981'}}>↑{fr.up}%</span>
                        <span className="mono" style={{fontSize:11,color:'#f43f5e'}}>↓{fr.down}%</span>
                      </>}
                    </div>
                    <span className="mono" style={{fontSize:9,color:'#334155'}}>
                      {new Date(s.created_at||Date.now()).toLocaleString()}
                    </span>
                  </div>
                </P>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

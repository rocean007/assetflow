import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sessionsApi } from '../utils/api';
import { Card, P, Bar, Tag, SC, SS } from '../components/UI';
import Gauge from '../components/Gauge';
import Graph from '../components/Graph';

const Sec = ({title,content,color='#475569'}) => content ? (
  <div>
    <div className="mono" style={{fontSize:9,color,textTransform:'uppercase',letterSpacing:1,marginBottom:5}}>{title}</div>
    <p style={{fontSize:12,lineHeight:1.65,color:'#94a3b8'}}>{content}</p>
  </div>
) : null;
const List = ({title,items,color='#475569'}) => items?.length ? (
  <div>
    <div className="mono" style={{fontSize:9,color,textTransform:'uppercase',letterSpacing:1,marginBottom:5}}>{title}</div>
    {items.map((x,i)=><div key={i} style={{display:'flex',gap:6,fontSize:12,color:'#94a3b8',marginBottom:3}}><span style={{color}}>›</span>{x}</div>)}
  </div>
) : null;

export default function Run() {
  const { sid } = useParams();
  const nav = useNavigate();
  const [sess, setSess] = useState(null);
  const [phase, setPhase] = useState('fast'); // 'fast' | 'final'
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState('');
  const [interviews, setInterviews] = useState([]);
  const [log, setLog] = useState([]);
  const esRef = useRef(null);

  useEffect(() => {
    // Start SSE stream
    const es = new EventSource(`/api/sessions/${sid}/stream`);
    esRef.current = es;
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.error) return;
        if (data.done && data.full) {
          setSess(data.full);
          setInterviews(data.full.interviews || []);
          if (data.full.final_result) setPhase('final');
          es.close();
        } else {
          setSess(prev => prev ? {...prev,...data} : data);
          if (data.message) setLog(prev => [...prev.slice(-30), {ts:Date.now(),msg:data.message}]);
          if (data.status === 'completed' && data.final_result) setPhase('final');
        }
      } catch {}
    };
    es.onerror = () => es.close();
    // Also load immediately
    sessionsApi.get(sid).then(r => {
      if (r.data) {
        setSess(r.data);
        setInterviews(r.data.interviews || []);
        if (r.data.status === 'completed') { setPhase('final'); es.close(); }
      }
    }).catch(() => {});
    return () => es.close();
  }, [sid]);

  async function ask(role) {
    if (!question.trim() || !sess) return;
    setAsking(role || 'all');
    try {
      let r;
      if (role === '__all__') {
        r = await sessionsApi.interviewAll(sid, { question });
        setInterviews(prev => [...(r.data?.results || []), ...prev]);
      } else {
        r = await sessionsApi.interview(sid, { question, role });
        setInterviews(prev => [r.data, ...prev]);
      }
      setQuestion('');
    } catch (e) { alert(String(e)); }
    setAsking('');
  }

  if (!sess) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:200,gap:12}}>
      <div style={{width:20,height:20,border:'2px solid #1a2035',borderTopColor:'#3b82f6',
                   borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
      <span className="mono" style={{color:'#475569',fontSize:12}}>Loading session...</span>
    </div>
  );

  const r = (phase==='final' ? sess.final_result : sess.fast_result) || sess.fast_result || sess.final_result;
  const isRunning = sess.status === 'running' || sess.status === 'enriching';
  const dir = r?.direction;
  const col = SC(dir);
  const isEnriching = sess.status === 'enriching';

  return (
    <div className="slide" style={{display:'flex',flexDirection:'column',gap:16}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <h1 className="mono" style={{fontSize:22,fontWeight:600,color:'#e2e8f0'}}>{sess.symbol}</h1>
            <Tag label={sess.asset_type}/>
            <Tag label={sess.status} color={sess.status==='completed'?'#10b981':sess.status==='failed'?'#f43f5e':'#f59e0b'}/>
          </div>
          {sess.description && <p style={{fontSize:12,color:'#475569',marginTop:3}}>{sess.description}</p>}
        </div>
        <div style={{display:'flex',gap:8}}>
          {r && (
            <div style={{display:'flex',gap:4}}>
              {['fast','final'].map(p => (
                <button key={p} onClick={() => setPhase(p)}
                  style={{fontFamily:'monospace',fontSize:10,padding:'4px 10px',borderRadius:4,cursor:'pointer',
                          border:`1px solid ${phase===p?'rgba(59,130,246,.4)':'#1a2035'}`,
                          color:phase===p?'#3b82f6':'#475569',
                          background:phase===p?'rgba(59,130,246,.08)':'transparent'}}>
                  {p==='fast'?'Fast':'Final'}
                  {p==='fast'&&sess.fast_result&&<span style={{marginLeft:4,color:'#10b981'}}>●</span>}
                  {p==='final'&&sess.final_result&&<span style={{marginLeft:4,color:'#10b981'}}>●</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Progress */}
      {isRunning && (
        <P style={{padding:14}} className="fade">
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
            <span className="mono" style={{fontSize:11,color:'#e2e8f0'}}>
              {isEnriching ? '⟳ Deep research running in background...' : '⟳ Analyzing...'}
              {isEnriching && <span style={{marginLeft:8,fontSize:10,color:'#10b981'}}>
                (fast prediction shown above)
              </span>}
            </span>
            <span className="mono" style={{fontSize:11,color:'#3b82f6'}}>{sess.progress||0}%</span>
          </div>
          <Bar v={sess.progress} color={isEnriching?'#10b981':'#3b82f6'}/>
          <div className="mono" style={{fontSize:10,color:'#475569',marginTop:5}}>{sess.message}</div>
          {log.length > 0 && (
            <div style={{marginTop:8,maxHeight:80,overflowY:'auto'}}>
              {log.slice(-6).map((l,i)=>(
                <div key={i} className="mono" style={{fontSize:9,color:'#334155',marginBottom:2}}>
                  <span style={{color:'#1a2035',marginRight:6}}>{new Date(l.ts).toLocaleTimeString()}</span>
                  {l.msg}
                </div>
              ))}
            </div>
          )}
        </P>
      )}
      {sess.status === 'failed' && (
        <P><span className="mono" style={{color:'#f43f5e',fontSize:12}}>Failed: {sess.error}</span></P>
      )}

      {/* Main results */}
      {r && (
        <div style={{display:'flex',flexDirection:'column',gap:14}} className="fade">
          {/* Phase indicator */}
          {sess.fast_result && sess.final_result && (
            <P style={{padding:'10px 14px'}}>
              <div style={{display:'flex',gap:12,alignItems:'center'}}>
                <span className="mono" style={{fontSize:9,color:'#475569',textTransform:'uppercase',letterSpacing:1}}>Viewing:</span>
                <span className="mono" style={{fontSize:11,color:'#3b82f6'}}>
                  {phase==='fast'?'Phase 1 — Fast Prediction (immediate)':'Phase 2 — Final Verdict (enriched deep research)'}
                </span>
                {phase==='final'&&<Tag label="refined" color="#10b981"/>}
              </div>
            </P>
          )}

          {/* Gauge + summary */}
          <div style={{display:'grid',gridTemplateColumns:'195px 1fr',gap:14}}>
            <P style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:18}}>
              <div className="mono" style={{fontSize:9,color:'#334155',textTransform:'uppercase',letterSpacing:1,marginBottom:12}}>
                {sess.symbol} · Next Day
              </div>
              <Gauge r={r}/>
            </P>
            <P style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span className="mono" style={{fontSize:15,fontWeight:700,color:'#e2e8f0'}}>{sess.symbol}</span>
                {dir && <span className="mono" style={{fontSize:11,padding:'3px 10px',borderRadius:4,
                  color:col,border:`1px solid ${col}40`,background:col+'10'}}>{dir.toUpperCase()}</span>}
              </div>
              {r.summary && <p style={{fontSize:13,lineHeight:1.65,color:'#94a3b8'}}>{r.summary}</p>}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div style={{borderRadius:6,padding:12,background:'rgba(16,185,129,.04)',border:'1px solid rgba(16,185,129,.18)'}}>
                  <div className="mono" style={{fontSize:9,color:'#10b981',marginBottom:5,display:'flex',justifyContent:'space-between'}}>BULL CASE <span>{r.up}%</span></div>
                  <p style={{fontSize:12,lineHeight:1.5,color:'#94a3b8'}}>{r.bull_case||'—'}</p>
                </div>
                <div style={{borderRadius:6,padding:12,background:'rgba(244,63,94,.04)',border:'1px solid rgba(244,63,94,.18)'}}>
                  <div className="mono" style={{fontSize:9,color:'#f43f5e',marginBottom:5,display:'flex',justifyContent:'space-between'}}>BEAR CASE <span>{r.down}%</span></div>
                  <p style={{fontSize:12,lineHeight:1.5,color:'#94a3b8'}}>{r.bear_case||'—'}</p>
                </div>
              </div>
            </P>
          </div>

          {/* Deep analysis */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            <P style={{display:'flex',flexDirection:'column',gap:14}}>
              <Sec title="Technical Picture"   content={r.technical}   color="#6366f1"/>
              <Sec title="Fundamental Picture" content={r.fundamental} color="#a855f7"/>
              <Sec title="Signal Conflicts"    content={r.conflicts}   color="#f59e0b"/>
            </P>
            <P style={{display:'flex',flexDirection:'column',gap:14}}>
              <Sec title="World State Highlights"  content={r.world}   color="#10b981"/>
              <Sec title="Social Assessment"       content={r.social}  color="#6366f1"/>
            </P>
          </div>

          {/* Butterflies */}
          {r.butterflies?.length > 0 && (
            <P>
              <div className="mono" style={{fontSize:9,color:'#f59e0b',textTransform:'uppercase',letterSpacing:1,marginBottom:10}}>
                🦋 Butterfly Effect Chains
              </div>
              {r.butterflies.map((b,i) => (
                <div key={i} style={{display:'flex',gap:8,fontSize:12,color:'#94a3b8',marginBottom:6}}>
                  <span className="mono" style={{color:'#f59e0b',minWidth:16}}>{i+1}.</span>{b}
                </div>
              ))}
            </P>
          )}

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            <List title="Top Catalysts" items={r.catalysts} color="#10b981"/>
            <List title="Key Risks"     items={r.risks}     color="#f43f5e"/>
          </div>

          {/* Graph */}
          {sess.graph && (
            <Card>
              <div style={{padding:'10px 14px',borderBottom:'1px solid #1a2035',display:'flex',justifyContent:'space-between'}}>
                <span className="mono" style={{fontSize:9,color:'#475569',textTransform:'uppercase',letterSpacing:1}}>
                  Intelligence Graph
                </span>
                <span className="mono" style={{fontSize:9,color:'#475569'}}>
                  {sess.graph.stats?.nodes}n · {sess.graph.stats?.edges}e · {sess.graph.stats?.bull}B/{sess.graph.stats?.bear}Be/{sess.graph.stats?.neut}N
                </span>
              </div>
              <div style={{height:380}}><Graph graph={sess.graph}/></div>
            </Card>
          )}

          {/* Agent outputs */}
          {sess.agent_outputs?.length > 0 && (
            <div>
              <div className="mono" style={{fontSize:9,color:'#475569',textTransform:'uppercase',letterSpacing:1,marginBottom:10}}>
                Agent Contributions ({sess.agent_outputs.length})
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:10}}>
                {sess.agent_outputs.map((o,i) => {
                  const sc=SS(o.signal)||'#f59e0b';
                  return (
                    <Card key={i} style={{padding:14}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                        <span className="mono" style={{fontSize:11,fontWeight:600,color:'#e2e8f0'}}>{o.role_name||o.role}</span>
                        <Tag label={`${(o.signal||'?').toUpperCase()} ${o.confidence}%`} color={sc}/>
                      </div>
                      <Bar v={o.confidence} color={sc} h={2}/>
                      <p style={{fontSize:11,color:'#94a3b8',marginTop:8,lineHeight:1.5}}>{o.reasoning}</p>
                      {o.butterflies?.length>0 && (
                        <div style={{marginTop:8}}>
                          <div className="mono" style={{fontSize:8,color:'#334155',marginBottom:4}}>🦋 chains</div>
                          {o.butterflies.slice(0,2).map((b,j)=>(
                            <div key={j} style={{fontSize:10,color:'#475569',marginBottom:2}}>› {b}</div>
                          ))}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Interview agents */}
          {sess.agent_outputs?.length > 0 && (
            <P>
              <div className="mono" style={{fontSize:9,color:'#475569',textTransform:'uppercase',letterSpacing:1,marginBottom:12}}>
                Interview Agents
              </div>
              <div style={{display:'flex',gap:8,marginBottom:12}}>
                <input value={question} onChange={e=>setQuestion(e.target.value)}
                  placeholder="Ask all agents a question... (e.g. What is your biggest concern?)"
                  onKeyDown={e=>e.key==='Enter'&&ask('__all__')}
                  style={{flex:1,fontFamily:'JetBrains Mono,monospace',fontSize:12}}/>
                <button onClick={()=>ask('__all__')} disabled={!!asking||!question.trim()}
                  style={{fontFamily:'monospace',fontSize:11,padding:'6px 14px',borderRadius:4,cursor:'pointer',
                          border:'none',color:'#050810',background:asking?'#334155':'#3b82f6',fontWeight:600,whiteSpace:'nowrap'}}>
                  {asking?'Asking...':'Ask All'}
                </button>
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:12}}>
                {sess.agent_outputs.map((o,i) => (
                  <button key={i} onClick={()=>ask(o.role)} disabled={!!asking}
                    style={{fontFamily:'monospace',fontSize:10,padding:'3px 10px',borderRadius:4,cursor:'pointer',
                            border:'1px solid #1a2035',color:'#475569',background:'transparent'}}>
                    {o.role_name||o.role}
                  </button>
                ))}
              </div>

              {interviews.length > 0 && (
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {interviews.map((iv,i) => (
                    <div key={i} style={{borderRadius:6,padding:12,background:'rgba(59,130,246,.04)',border:'1px solid rgba(59,130,246,.15)'}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                        <span className="mono" style={{fontSize:10,color:'#3b82f6'}}>{iv.role_name||iv.role}</span>
                        {iv.ts && <span className="mono" style={{fontSize:9,color:'#334155'}}>{new Date(iv.ts).toLocaleTimeString()}</span>}
                      </div>
                      {iv.question && <div className="mono" style={{fontSize:9,color:'#334155',marginBottom:5}}>Q: {iv.question}</div>}
                      <p style={{fontSize:12,lineHeight:1.6,color:'#94a3b8'}}>{iv.answer||iv.error||'—'}</p>
                    </div>
                  ))}
                </div>
              )}
            </P>
          )}
        </div>
      )}
    </div>
  );
}

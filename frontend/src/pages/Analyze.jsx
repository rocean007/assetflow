import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { projectsApi, graphApi, agentsApi } from '../utils/api';
import { useSocket } from '../hooks/useSocket';
import { Card, CardPad, ProgressBar, DirColor } from '../components/UI';
import Gauge from '../components/Gauge';
import AgentGraph from '../components/AgentGraph';
import AgentCard from '../components/AgentCard';

const mapSyn = (s) => !s ? null : {
  upProbability:s.upProbability??s.up_probability??0,downProbability:s.downProbability??s.down_probability??0,
  neutralProbability:s.neutralProbability??s.neutral_probability??0,
  primaryDirection:s.primaryDirection??s.primary_direction??'sideways',
  expectedMagnitude:s.expectedMagnitude??s.expected_magnitude,confidence:s.confidence??0,
  bullCase:s.bullCase??s.bull_case??'',bearCase:s.bearCase??s.bear_case??'',
  keyRisks:s.keyRisks??s.key_risks??[],topCatalysts:s.topCatalysts??s.top_catalysts??[],
  topButterflyEffects:s.topButterflyEffects??s.top_butterfly_effects??[],
  socialAssessment:s.socialAssessment??s.social_assessment,
  worldStateHighlights:s.worldStateHighlights??s.world_state_highlights,
  signalConflicts:s.signalConflicts??s.signal_conflicts,
  technicalPicture:s.technicalPicture??s.technical_picture,
  fundamentalPicture:s.fundamentalPicture??s.fundamental_picture,summary:s.summary??'',
};

const Sec = ({title,content,color='#374151'})=>content?(
  <div>
    <div className="mono" style={{fontSize:9,color,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>{title}</div>
    <p style={{fontSize:12,lineHeight:1.65,color:'#94a3b8',margin:0}}>{content}</p>
  </div>
):null;

const List = ({title,items,color='#374151'})=>items?.length?(
  <div>
    <div className="mono" style={{fontSize:9,color,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>{title}</div>
    {items.map((x,i)=><div key={i} style={{display:'flex',gap:6,fontSize:12,color:'#94a3b8',marginBottom:3}}><span style={{color}}>›</span>{x}</div>)}
  </div>
):null;

export default function Analyze() {
  const { startPolling } = useSocket();
  const { agents, setAgents, projects, setProjects, activeJob, setActiveJob, currentAnalysis, setCurrentAnalysis } = useStore();
  const [form, setForm] = useState({ project_id:'', symbol:'', asset_type:'equity', av_key:'' });
  const [mode, setMode] = useState('project'); // 'project' | 'quick'
  const [err, setErr] = useState('');

  useEffect(() => {
    agentsApi.list().then(r=>setAgents(r.data||[])).catch(()=>{});
    projectsApi.list().then(r=>setProjects(r.data||[])).catch(()=>{});
  }, []);

  const isRunning = activeJob?.status === 'running';
  const completedProjects = projects.filter(p=>p.status==='completed');

  async function run(e) {
    e.preventDefault(); setErr('');
    const enabled = agents.filter(a=>a.enabled!==false);
    if (!enabled.length) return setErr('No enabled agents — add agents first');
    setCurrentAnalysis(null);
    setActiveJob({ status:'running', progress:0, message:'Starting...' });
    try {
      let pid = form.project_id;
      if (mode==='quick') {
        // Create a temporary project and build immediately
        const pr = await projectsApi.create({ symbol:form.symbol.toUpperCase(), asset_type:form.asset_type, av_key:form.av_key });
        pid = pr.data.project_id;
        setProjects([pr.data, ...projects]);
      }
      const r = await graphApi.build({ project_id: pid });
      if (!r.success) throw new Error(r.error);
      startPolling(r.data.task_id);
    } catch (e2) { setErr(String(e2)); setActiveJob(null); }
  }

  const a = currentAnalysis;
  const syn = mapSyn(a?.synthesis);
  const dir = syn?.primaryDirection;
  const col = DirColor(dir);

  return (
    <div className="slide" style={{ display:'flex',flexDirection:'column',gap:20 }}>
      <div>
        <h1 className="mono" style={{ fontSize:22,fontWeight:600,color:'#e2e8f0' }}>Analyze</h1>
        <p style={{ fontSize:13,color:'#374151',marginTop:4 }}>
          25+ real-time data sources · parallel agents · butterfly chain reasoning
        </p>
      </div>

      {/* Run form */}
      <CardPad>
        <div style={{ display:'flex',gap:8,marginBottom:16 }}>
          {[['project','From Project'],['quick','Quick Symbol']].map(([m,l])=>(
            <button key={m} onClick={()=>setMode(m)}
              style={{ fontFamily:'monospace',fontSize:11,padding:'4px 12px',borderRadius:4,cursor:'pointer',
                       border:`1px solid ${mode===m?'rgba(14,165,233,.4)':'#1e2433'}`,
                       color:mode===m?'#0ea5e9':'#64748b',
                       background:mode===m?'rgba(14,165,233,.08)':'transparent' }}>{l}</button>
          ))}
        </div>
        <form onSubmit={run} style={{ display:'flex',flexWrap:'wrap',gap:12,alignItems:'flex-end' }}>
          {mode==='project'?(
            <div style={{ flex:'1 1 240px' }}>
              <label className="mono" style={{ fontSize:10,color:'#374151',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1 }}>Project *</label>
              <select value={form.project_id} onChange={e=>setForm(f=>({...f,project_id:e.target.value}))}
                style={{ fontFamily:'JetBrains Mono,monospace',fontSize:12 }} required disabled={isRunning}>
                <option value="">— select project —</option>
                {projects.map(p=><option key={p.project_id} value={p.project_id}>{p.symbol} — {p.name} ({p.status})</option>)}
              </select>
            </div>
          ):(
            <>
              <div style={{ flex:'0 0 120px' }}>
                <label className="mono" style={{ fontSize:10,color:'#374151',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1 }}>Symbol *</label>
                <input value={form.symbol} onChange={e=>setForm(f=>({...f,symbol:e.target.value.toUpperCase()}))}
                  placeholder="AAPL" required disabled={isRunning} style={{ fontFamily:'JetBrains Mono,monospace',fontSize:12 }} />
              </div>
              <div style={{ flex:'0 0 140px' }}>
                <label className="mono" style={{ fontSize:10,color:'#374151',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1 }}>Type</label>
                <select value={form.asset_type} onChange={e=>setForm(f=>({...f,asset_type:e.target.value}))} disabled={isRunning}
                  style={{ fontFamily:'JetBrains Mono,monospace',fontSize:12 }}>
                  {['equity','crypto','forex','commodity','index','etf','bond','reit'].map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
            </>
          )}
          <button type="submit" disabled={isRunning}
            style={{ fontFamily:'monospace',fontSize:12,padding:'8px 20px',borderRadius:5,border:'none',
                     color:'#060912',background:isRunning?'#374151':'#0ea5e9',fontWeight:600,whiteSpace:'nowrap' }}>
            {isRunning?'⟳ Running...':'▶ Run Analysis'}
          </button>
        </form>
        {err&&<div className="mono" style={{ color:'#f43f5e',fontSize:11,marginTop:8 }}>{err}</div>}
      </CardPad>

      {/* Progress */}
      {isRunning&&(
        <CardPad className="fade">
          <div style={{ display:'flex',justifyContent:'space-between',marginBottom:8 }}>
            <span className="mono" style={{ fontSize:12,color:'#e2e8f0' }}>Analyzing...</span>
            <span className="mono" style={{ fontSize:12,color:'#0ea5e9' }}>{activeJob.progress||0}%</span>
          </div>
          <ProgressBar value={activeJob.progress} />
          <div className="mono" style={{ fontSize:11,color:'#374151',marginTop:6 }}>{activeJob.message}</div>
        </CardPad>
      )}
      {activeJob?.status==='error'&&(
        <CardPad><span className="mono" style={{ color:'#f43f5e',fontSize:12 }}>Error: {activeJob.error}</span></CardPad>
      )}

      {/* Results */}
      {a&&syn&&(
        <div style={{ display:'flex',flexDirection:'column',gap:16 }} className="fade">

          {/* Stats strip */}
          {a.stats&&(
            <CardPad style={{ padding:12 }}>
              <div style={{ display:'flex',gap:20,flexWrap:'wrap',alignItems:'center' }}>
                <span className="mono" style={{ fontSize:10,color:'#374151',textTransform:'uppercase',letterSpacing:1 }}>Run</span>
                {[['agents',a.stats.phase1_agents],['synths',a.stats.synth_agents],['nodes',a.stats.total_nodes],
                  ['edges',a.stats.total_edges],['social',a.stats.social_total+' posts'],
                  ['alerts',a.stats.weather_alerts+' wx'],['duration',((a.duration_ms||0)/1000).toFixed(0)+'s']
                ].map(([k,v])=>(
                  <div key={k} className="mono" style={{ fontSize:11 }}>
                    <span style={{ color:'#374151' }}>{k}: </span><span style={{ color:'#e2e8f0' }}>{v}</span>
                  </div>
                ))}
              </div>
            </CardPad>
          )}

          {/* Main: gauge + summary */}
          <div style={{ display:'grid',gridTemplateColumns:'220px 1fr',gap:16 }}>
            <CardPad style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center' }}>
              <div className="mono" style={{ fontSize:10,color:'#374151',textTransform:'uppercase',letterSpacing:1,marginBottom:14 }}>
                {a.asset?.symbol}
              </div>
              <Gauge synthesis={syn} />
              {a.price&&(
                <div style={{ marginTop:14,textAlign:'center' }}>
                  <div className="mono" style={{ fontSize:20,fontWeight:700,color:'#e2e8f0' }}>${a.price.price?.toFixed(2)}</div>
                  <div className="mono" style={{ fontSize:12,color:a.price.change_pct>=0?'#10b981':'#f43f5e' }}>
                    {a.price.change_pct>=0?'+':''}{a.price.change_pct?.toFixed(2)}% today
                  </div>
                </div>
              )}
            </CardPad>

            <CardPad style={{ display:'flex',flexDirection:'column',gap:14 }}>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                <span className="mono" style={{ fontSize:16,fontWeight:600,color:'#e2e8f0' }}>{a.asset?.symbol}</span>
                <span className="mono" style={{ fontSize:10,padding:'3px 10px',borderRadius:4,
                  color:col,border:`1px solid ${col}40`,background:col+'10' }}>{dir?.toUpperCase()}</span>
              </div>
              {syn.summary&&<p style={{ fontSize:13,lineHeight:1.65,color:'#94a3b8',margin:0 }}>{syn.summary}</p>}
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
                <div style={{ borderRadius:6,padding:12,background:'rgba(16,185,129,.04)',border:'1px solid rgba(16,185,129,.18)' }}>
                  <div className="mono" style={{ fontSize:10,color:'#10b981',marginBottom:6,display:'flex',justifyContent:'space-between' }}>
                    BULL CASE <span>{syn.upProbability}%</span>
                  </div>
                  <p style={{ fontSize:12,lineHeight:1.5,color:'#94a3b8',margin:0 }}>{syn.bullCase}</p>
                </div>
                <div style={{ borderRadius:6,padding:12,background:'rgba(244,63,94,.04)',border:'1px solid rgba(244,63,94,.18)' }}>
                  <div className="mono" style={{ fontSize:10,color:'#f43f5e',marginBottom:6,display:'flex',justifyContent:'space-between' }}>
                    BEAR CASE <span>{syn.downProbability}%</span>
                  </div>
                  <p style={{ fontSize:12,lineHeight:1.5,color:'#94a3b8',margin:0 }}>{syn.bearCase}</p>
                </div>
              </div>
            </CardPad>
          </div>

          {/* Deep analysis */}
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16 }}>
            <CardPad style={{ display:'flex',flexDirection:'column',gap:16 }}>
              <Sec title="Technical Picture"    content={syn.technicalPicture}    color="#6366f1" />
              <Sec title="Fundamental Picture"  content={syn.fundamentalPicture}  color="#a855f7" />
              <Sec title="Signal Conflicts"     content={syn.signalConflicts}     color="#f59e0b" />
            </CardPad>
            <CardPad style={{ display:'flex',flexDirection:'column',gap:16 }}>
              <Sec title="World State Highlights"   content={syn.worldStateHighlights}  color="#10b981" />
              <Sec title="Social Assessment"        content={syn.socialAssessment}      color="#6366f1" />
              {a.data_snapshot?.weather_alerts?.length>0&&(
                <div>
                  <div className="mono" style={{ fontSize:9,color:'#f59e0b',textTransform:'uppercase',letterSpacing:1,marginBottom:6 }}>⚠ Weather Alerts</div>
                  {a.data_snapshot.weather_alerts.map((w,i)=>(
                    <div key={i} style={{ marginBottom:6 }}>
                      <span className="mono" style={{ fontSize:11,color:'#e2e8f0' }}>{w.region}</span>
                      {(w.alerts||[]).map((al,j)=><div key={j} className="mono" style={{ fontSize:10,color:'#f59e0b',marginTop:2,paddingLeft:8 }}>› {al}</div>)}
                    </div>
                  ))}
                </div>
              )}
            </CardPad>
          </div>

          {/* Butterflies */}
          {syn.topButterflyEffects?.length>0&&(
            <CardPad>
              <div className="mono" style={{ fontSize:9,color:'#f59e0b',textTransform:'uppercase',letterSpacing:1,marginBottom:12 }}>🦋 Top Butterfly Effect Chains</div>
              <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                {syn.topButterflyEffects.map((b,i)=>(
                  <div key={i} style={{ display:'flex',gap:10,fontSize:12,color:'#94a3b8' }}>
                    <span className="mono" style={{ color:'#f59e0b',minWidth:16 }}>{i+1}.</span>{b}
                  </div>
                ))}
              </div>
            </CardPad>
          )}

          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16 }}>
            <List title="Top Catalysts" items={syn.topCatalysts} color="#10b981" />
            <List title="Key Risks"     items={syn.keyRisks}     color="#f43f5e" />
          </div>

          {/* Graph */}
          {a.graph&&(
            <Card>
              <div style={{ padding:'12px 16px',borderBottom:'1px solid #1e2433',display:'flex',justifyContent:'space-between' }}>
                <span className="mono" style={{ fontSize:10,color:'#374151',textTransform:'uppercase',letterSpacing:1 }}>Phase 1 Intelligence Graph</span>
                <span className="mono" style={{ fontSize:10,color:'#374151' }}>
                  {a.graph.stats?.total_nodes}n · {a.graph.stats?.total_edges}e · {a.graph.stats?.bull}B/{a.graph.stats?.bear}Be/{a.graph.stats?.neut}N
                </span>
              </div>
              <div style={{ height:400 }}><AgentGraph graph={a.graph} /></div>
            </Card>
          )}

          {/* Agent cards */}
          {a.agent_outputs?.length>0&&(
            <div>
              <div className="mono" style={{ fontSize:10,color:'#374151',textTransform:'uppercase',letterSpacing:1,marginBottom:12 }}>
                Phase 1 — Agent Contributions ({a.agent_outputs.length})
              </div>
              <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:10 }}>
                {a.agent_outputs.map((o,i)=><AgentCard key={i} output={o} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

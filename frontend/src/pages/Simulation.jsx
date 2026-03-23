import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { projectsApi, simulationApi, agentsApi } from '../utils/api';
import { Card, CardPad, Badge, ProgressBar, SigColor } from '../components/UI';
import { tasksApi } from '../utils/api';

export default function Simulation() {
  const { projects, setProjects, agents, setAgents } = useStore();
  const [sims, setSims]   = useState([]);
  const [selProj, setSelProj] = useState('');
  const [selSim, setSelSim]   = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [prepPct, setPrepPct] = useState(0);
  const [err, setErr] = useState('');

  useEffect(() => {
    projectsApi.list().then(r=>setProjects(r.data||[])).catch(()=>{});
    agentsApi.list().then(r=>setAgents(r.data||[])).catch(()=>{});
    simulationApi.history(50).then(r=>setSims(r.data||[])).catch(()=>{});
  }, []);

  const completedProjects = projects.filter(p=>p.status==='completed');

  async function createSim() {
    if (!selProj) return;
    try {
      const r = await simulationApi.create({ project_id: selProj });
      const sim = r.data;
      setSims([sim, ...sims]);
      await loadSim(sim.simulation_id);
    } catch (e) { setErr(String(e)); }
  }

  async function loadSim(sid) {
    try {
      const r = await simulationApi.get(sid);
      setSelSim(r.data);
      if (r.data.agent_profiles?.length) {
        setProfiles(r.data.agent_profiles);
        const ih = await simulationApi.interviewHistory(sid);
        setInterviews(ih.data || []);
      }
    } catch {}
  }

  async function prepare() {
    if (!selSim) return;
    setPreparing(true); setPrepPct(0); setErr('');
    try {
      const r = await simulationApi.prepare(selSim.simulation_id);
      if (r.data?.already_prepared) {
        await loadSim(selSim.simulation_id); setPreparing(false); return;
      }
      const tid = r.data?.task_id;
      if (!tid) { setPreparing(false); return; }
      // Poll task
      await new Promise((resolve) => {
        const interval = setInterval(async () => {
          try {
            const tr = await tasksApi.get(tid);
            const t = tr.data;
            setPrepPct(t.progress||0);
            if (t.status==='completed'||t.status==='failed') {
              clearInterval(interval);
              await loadSim(selSim.simulation_id);
              resolve();
            }
          } catch { clearInterval(interval); resolve(); }
        }, 1500);
      });
    } catch (e) { setErr(String(e)); }
    setPreparing(false);
  }

  async function askAll() {
    if (!selSim || !question.trim()) return;
    setAsking(true); setErr('');
    try {
      const r = await simulationApi.interviewAll(selSim.simulation_id, { question });
      setInterviews(prev => [...(r.data?.results||[]).map((x,i)=>({...x,interview_id:`new_${i}`})), ...prev]);
      setQuestion('');
    } catch (e) { setErr(String(e)); }
    setAsking(false);
  }

  async function askOne(agentId) {
    const q = prompt(`Ask ${agentId} a question:`);
    if (!q?.trim()) return;
    try {
      const r = await simulationApi.interview(selSim.simulation_id, { agent_id: agentId, question: q });
      setInterviews(prev => [r.data, ...prev]);
    } catch (e) { alert(String(e)); }
  }

  return (
    <div className="slide" style={{ display:'flex',flexDirection:'column',gap:20 }}>
      <div>
        <h1 className="mono" style={{ fontSize:22,fontWeight:600,color:'#e2e8f0' }}>Simulation</h1>
        <p style={{ fontSize:13,color:'#374151',marginTop:4 }}>
          Extract agent profiles from graph analysis, then interview individual agents
        </p>
      </div>

      {/* Create simulation */}
      <CardPad>
        <div className="mono" style={{ fontSize:11,color:'#374151',marginBottom:10,textTransform:'uppercase',letterSpacing:1 }}>
          Create Simulation from Completed Project
        </div>
        <div style={{ display:'flex',gap:10,alignItems:'flex-end' }}>
          <div style={{ flex:1 }}>
            <select value={selProj} onChange={e=>setSelProj(e.target.value)}
              style={{ fontFamily:'JetBrains Mono,monospace',fontSize:12 }}>
              <option value="">— select completed project —</option>
              {completedProjects.map(p=>(
                <option key={p.project_id} value={p.project_id}>{p.symbol} — {p.name}</option>
              ))}
            </select>
          </div>
          <button onClick={createSim} disabled={!selProj}
            style={{ fontFamily:'monospace',fontSize:12,padding:'7px 16px',borderRadius:5,
                     border:'none',color:'#060912',background:selProj?'#0ea5e9':'#374151',fontWeight:600,whiteSpace:'nowrap' }}>
            Create Simulation
          </button>
        </div>
      </CardPad>

      {err&&<div className="mono" style={{ color:'#f43f5e',fontSize:11 }}>{err}</div>}

      {/* Simulation list */}
      {sims.length>0&&(
        <div>
          <div className="mono" style={{ fontSize:10,color:'#374151',textTransform:'uppercase',letterSpacing:1,marginBottom:10 }}>
            Simulations ({sims.length})
          </div>
          <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
            {sims.map(sim=>(
              <Card key={sim.simulation_id} style={{ cursor:'pointer',
                border:`1px solid ${selSim?.simulation_id===sim.simulation_id?'rgba(14,165,233,.4)':'#1e2433'}`,
                background:selSim?.simulation_id===sim.simulation_id?'rgba(14,165,233,.04)':'#0d1117' }}
                onClick={()=>loadSim(sim.simulation_id)}>
                <div style={{ padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                  <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                    <span className="mono" style={{ fontSize:13,fontWeight:600,color:'#e2e8f0' }}>
                      {sim.symbol||sim.simulation_id}
                    </span>
                    <Badge label={sim.status} color={sim.status==='completed'?'#10b981':sim.status==='ready'?'#0ea5e9':'#374151'} />
                    <Badge label={`${sim.agent_count||0} profiles`} />
                    <Badge label={`${sim.interview_count||0} interviews`} color="#6366f1" />
                  </div>
                  <span className="mono" style={{ fontSize:10,color:'#374151' }}>
                    {new Date(sim.created_at||Date.now()).toLocaleDateString()}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Selected simulation */}
      {selSim&&(
        <div style={{ display:'flex',flexDirection:'column',gap:16 }} className="fade">
          <CardPad>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12 }}>
              <div className="mono" style={{ fontSize:13,color:'#e2e8f0' }}>
                Simulation: {selSim.simulation_id}
                <Badge label={selSim.status} color={selSim.status==='ready'?'#10b981':'#374151'} style={{ marginLeft:8 }} />
              </div>
              {selSim.status!=='ready'&&(
                <button onClick={prepare} disabled={preparing}
                  style={{ fontFamily:'monospace',fontSize:12,padding:'6px 14px',borderRadius:5,
                           border:'none',color:'#060912',background:preparing?'#374151':'#0ea5e9',fontWeight:600 }}>
                  {preparing?'Preparing...':'Prepare Profiles'}
                </button>
              )}
            </div>
            {preparing&&(
              <div style={{ marginBottom:12 }}>
                <ProgressBar value={prepPct} />
                <div className="mono" style={{ fontSize:10,color:'#374151',marginTop:4 }}>Extracting agent profiles... {prepPct}%</div>
              </div>
            )}
          </CardPad>

          {/* Agent profiles */}
          {profiles.length>0&&(
            <div>
              <div className="mono" style={{ fontSize:10,color:'#374151',textTransform:'uppercase',letterSpacing:1,marginBottom:12 }}>
                Agent Profiles ({profiles.length}) — click to interview
              </div>
              <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:8 }}>
                {profiles.map((p,i)=>{
                  const col = SigColor[p.signal]||'#f59e0b';
                  return (
                    <Card key={i} style={{ cursor:'pointer' }} onClick={()=>askOne(p.agent_id)}>
                      <div style={{ padding:12 }}>
                        <div style={{ display:'flex',justifyContent:'space-between',marginBottom:6 }}>
                          <span className="mono" style={{ fontSize:11,fontWeight:600,color:'#e2e8f0' }}>{p.role_name}</span>
                          <span className="mono" style={{ fontSize:10,padding:'1px 6px',borderRadius:3,
                            color:col,background:col+'15',border:`1px solid ${col}35` }}>
                            {(p.signal||'?').toUpperCase()} {p.confidence}%
                          </span>
                        </div>
                        <div style={{ height:2,background:'#1e2433',borderRadius:2,marginBottom:6 }}>
                          <div style={{ height:2,width:`${p.confidence||0}%`,background:col,borderRadius:2 }} />
                        </div>
                        <p style={{ fontSize:11,color:'#64748b',margin:0,lineHeight:1.5 }}>
                          {(p.reasoning||'').slice(0,120)}{p.reasoning?.length>120?'…':''}
                        </p>
                        <div className="mono" style={{ fontSize:9,color:'#374151',marginTop:6 }}>
                          {p.agent_name} · click to interview
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Interview all */}
          {profiles.length>0&&(
            <CardPad>
              <div className="mono" style={{ fontSize:11,color:'#e2e8f0',marginBottom:12 }}>Interview All Agents</div>
              <div style={{ display:'flex',gap:10 }}>
                <input value={question} onChange={e=>setQuestion(e.target.value)}
                  placeholder="e.g. What is your single biggest concern for tomorrow?"
                  onKeyDown={e=>e.key==='Enter'&&askAll()}
                  style={{ flex:1,fontFamily:'JetBrains Mono,monospace',fontSize:12 }} />
                <button onClick={askAll} disabled={asking||!question.trim()}
                  style={{ fontFamily:'monospace',fontSize:12,padding:'7px 16px',borderRadius:5,border:'none',
                           color:'#060912',background:asking||!question.trim()?'#374151':'#0ea5e9',fontWeight:600,whiteSpace:'nowrap' }}>
                  {asking?'Asking...':'Ask All'}
                </button>
              </div>
            </CardPad>
          )}

          {/* Interview history */}
          {interviews.length>0&&(
            <div>
              <div className="mono" style={{ fontSize:10,color:'#374151',textTransform:'uppercase',letterSpacing:1,marginBottom:10 }}>
                Interview History ({interviews.length})
              </div>
              <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                {interviews.map((iv,i)=>(
                  <CardPad key={i} style={{ padding:14 }}>
                    <div style={{ display:'flex',justifyContent:'space-between',marginBottom:6 }}>
                      <span className="mono" style={{ fontSize:11,color:'#0ea5e9' }}>
                        {iv.role_name||iv.agent_name}
                      </span>
                      <span className="mono" style={{ fontSize:10,color:'#374151' }}>
                        {iv.timestamp&&new Date(iv.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    {iv.question&&<div className="mono" style={{ fontSize:10,color:'#374151',marginBottom:6 }}>Q: {iv.question}</div>}
                    <p style={{ fontSize:12,lineHeight:1.6,color:'#94a3b8',margin:0 }}>
                      {iv.answer||iv.error||'No response.'}
                    </p>
                  </CardPad>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { projectsApi, graphApi } from '../utils/api';
import { Card, CardPad, Badge, ProgressBar, DirColor } from '../components/UI';
import { useSocket } from '../hooks/useSocket';

const STATUS_COLOR = { created:'#374151',data_fetching:'#f59e0b',data_ready:'#f59e0b',
  graph_building:'#6366f1',graph_ready:'#0ea5e9',completed:'#10b981',failed:'#f43f5e' };

export default function Projects() {
  const nav = useNavigate();
  const { startPolling } = useSocket();
  const { projects, setProjects, agents, setAgents, activeJob, setActiveJob, setCurrentAnalysis, setCurrentProject } = useStore();
  const [form, setForm]   = useState({ name:'', symbol:'', asset_type:'equity', av_key:'', description:'' });
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState({});
  const [building, setBuilding]   = useState({});
  const [err, setErr] = useState('');
  const fileRefs = useRef({});

  useEffect(() => {
    projectsApi.list().then(r => setProjects(r.data || [])).catch(() => {});
  }, []);

  async function createProject(e) {
    e.preventDefault(); setErr('');
    try {
      const r = await projectsApi.create({ ...form, symbol: form.symbol.toUpperCase() });
      setProjects([r.data, ...projects]);
      setForm({ name:'', symbol:'', asset_type:'equity', av_key:'', description:'' });
      setShowForm(false);
    } catch (e2) { setErr(String(e2)); }
  }

  async function uploadFile(pid, file) {
    setUploading(u => ({ ...u, [pid]: true }));
    try {
      const r = await projectsApi.upload(pid, file);
      setProjects(projects.map(p => p.project_id === pid
        ? { ...p, files: [...(p.files||[]), r.data] } : p));
    } catch (e2) { alert('Upload failed: ' + String(e2)); }
    finally { setUploading(u => ({ ...u, [pid]: false })); }
  }

  async function deleteFile(pid, fn) {
    try {
      await projectsApi.deleteFile(pid, fn);
      setProjects(projects.map(p => p.project_id === pid
        ? { ...p, files: (p.files||[]).filter(f => f.stored !== fn && f.filename !== fn) } : p));
    } catch {}
  }

  async function buildGraph(pid) {
    const enabled = agents.filter(a => a.enabled !== false);
    if (!enabled.length) { alert('No enabled agents. Add agents first.'); nav('/agents'); return; }
    setBuilding(b => ({ ...b, [pid]: true }));
    setErr('');
    try {
      const r = await graphApi.build({ project_id: pid });
      if (!r.success) throw new Error(r.error);
      setProjects(projects.map(p => p.project_id === pid ? { ...p, status: 'graph_building' } : p));
      setActiveJob({ status:'running', progress:0, message:'Starting...', task_id: r.data.task_id, project_id: pid });
      startPolling(r.data.task_id);
    } catch (e2) { setErr(String(e2)); setBuilding(b => ({ ...b, [pid]: false })); }
  }

  async function deleteProject(pid) {
    if (!confirm('Delete this project?')) return;
    await projectsApi.delete(pid).catch(() => {});
    setProjects(projects.filter(p => p.project_id !== pid));
  }

  async function viewAnalysis(pid) {
    try {
      const r = await graphApi.get(pid);
      if (r.success) {
        const p = projects.find(x => x.project_id === pid);
        setCurrentProject(p);
        nav('/analyze');
      }
    } catch {}
  }

  const inp = { width:'100%', fontFamily:'JetBrains Mono,monospace', fontSize:12 };

  return (
    <div className="slide" style={{ display:'flex',flexDirection:'column',gap:20 }}>
      <div style={{ display:'flex',alignItems:'flex-end',justifyContent:'space-between' }}>
        <div>
          <h1 className="mono" style={{ fontSize:22,fontWeight:600,color:'#e2e8f0' }}>Projects</h1>
          <p style={{ fontSize:13,color:'#374151',marginTop:4 }}>Create a project, upload research files, run analysis</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ fontFamily:'monospace',fontSize:12,padding:'7px 16px',borderRadius:5,
                   border:'none',color:'#060912',background:'#0ea5e9',fontWeight:600 }}>
          {showForm ? '✕ Cancel' : '+ New Project'}
        </button>
      </div>

      {showForm && (
        <CardPad className="slide">
          <h2 className="mono" style={{ fontSize:13,color:'#e2e8f0',marginBottom:16 }}>New Project</h2>
          <form onSubmit={createProject} style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
            {[['Symbol *','symbol','AAPL',true],['Name','name','My Analysis',false]].map(([l,k,ph,req])=>(
              <div key={k}>
                <label className="mono" style={{ fontSize:10,color:'#374151',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1 }}>{l}</label>
                <input style={inp} value={form[k]} placeholder={ph} required={req}
                  onChange={e=>setForm(f=>({...f,[k]:k==='symbol'?e.target.value.toUpperCase():e.target.value}))} />
              </div>
            ))}
            <div>
              <label className="mono" style={{ fontSize:10,color:'#374151',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1 }}>Asset Type</label>
              <select style={inp} value={form.asset_type} onChange={e=>setForm(f=>({...f,asset_type:e.target.value}))}>
                {['equity','crypto','forex','commodity','index','etf','bond','reit'].map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mono" style={{ fontSize:10,color:'#374151',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1 }}>Alpha Vantage Key (optional)</label>
              <input style={inp} type="password" value={form.av_key} placeholder="Better price data"
                onChange={e=>setForm(f=>({...f,av_key:e.target.value}))} />
            </div>
            <div style={{ gridColumn:'span 2' }}>
              <label className="mono" style={{ fontSize:10,color:'#374151',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1 }}>Research Question / Extra Context</label>
              <textarea style={{ ...inp, minHeight:64, resize:'vertical' }} value={form.description} placeholder="e.g. How might rising oil prices affect this stock over the next week?"
                onChange={e=>setForm(f=>({...f,description:e.target.value}))} />
            </div>
            {err && <div className="mono" style={{ gridColumn:'span 2',color:'#f43f5e',fontSize:11 }}>{err}</div>}
            <div style={{ gridColumn:'span 2',display:'flex',gap:8 }}>
              <button type="submit" style={{ fontFamily:'monospace',fontSize:12,padding:'7px 20px',borderRadius:5,border:'none',color:'#060912',background:'#0ea5e9',fontWeight:600 }}>Create</button>
              <button type="button" onClick={()=>setShowForm(false)} style={{ fontFamily:'monospace',fontSize:12,padding:'7px 16px',borderRadius:5,border:'1px solid #1e2433',color:'#64748b',background:'transparent' }}>Cancel</button>
            </div>
          </form>
        </CardPad>
      )}

      {/* Project cards */}
      {!projects.length ? (
        <CardPad style={{ textAlign:'center',padding:40 }}>
          <div className="mono" style={{ color:'#374151',fontSize:13 }}>No projects yet. Create your first above.</div>
        </CardPad>
      ) : (
        <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
          {projects.map(p => {
            const statCol = STATUS_COLOR[p.status] || '#374151';
            const isBuilding = p.status === 'graph_building' || building[p.project_id];
            const job = activeJob?.project_id === p.project_id ? activeJob : null;
            return (
              <Card key={p.project_id}>
                <div style={{ padding:16 }}>
                  {/* Header */}
                  <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:10 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                      <span className="mono" style={{ fontSize:16,fontWeight:600,color:'#e2e8f0' }}>{p.symbol}</span>
                      <span style={{ fontSize:12,color:'#374151' }}>{p.asset_name}</span>
                      <Badge label={p.asset_type} />
                      <Badge label={p.status} color={statCol} />
                      {p.status==='completed'&&<Badge label={`${p.agent_count}agents`} color="#10b981" />}
                    </div>
                    <div style={{ display:'flex',gap:6 }}>
                      {p.status==='completed'&&(
                        <button onClick={()=>viewAnalysis(p.project_id)}
                          style={{ fontFamily:'monospace',fontSize:11,padding:'4px 12px',borderRadius:4,
                                   border:'1px solid rgba(14,165,233,.3)',color:'#0ea5e9',background:'rgba(14,165,233,.08)' }}>
                          View Analysis
                        </button>
                      )}
                      {(p.status==='created'||p.status==='completed')&&(
                        <button onClick={()=>buildGraph(p.project_id)} disabled={isBuilding}
                          style={{ fontFamily:'monospace',fontSize:11,padding:'4px 12px',borderRadius:4,
                                   border:'none',color:'#060912',background:isBuilding?'#374151':'#0ea5e9',
                                   opacity:isBuilding?.6:1,fontWeight:600 }}>
                          {isBuilding?'Building...':p.status==='completed'?'Rebuild':'Build Graph'}
                        </button>
                      )}
                      <button onClick={()=>deleteProject(p.project_id)}
                        style={{ fontFamily:'monospace',fontSize:11,padding:'4px 10px',borderRadius:4,
                                 border:'1px solid #1e2433',color:'#374151',background:'transparent' }}>
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Progress */}
                  {job?.status==='running'&&(
                    <div style={{ marginBottom:10 }}>
                      <ProgressBar value={job.progress} />
                      <div className="mono" style={{ fontSize:10,color:'#374151',marginTop:4 }}>{job.message}</div>
                    </div>
                  )}

                  {/* Description */}
                  {p.description&&<p style={{ fontSize:12,color:'#64748b',marginBottom:10,lineHeight:1.5 }}>{p.description}</p>}

                  {/* Stats */}
                  {p.status==='completed'&&(
                    <div className="mono" style={{ display:'flex',gap:16,fontSize:10,color:'#374151',marginBottom:10 }}>
                      {[['nodes',p.node_count],['edges',p.edge_count],['agents',p.agent_count]].map(([k,v])=>(
                        <span key={k}>{k}: <span style={{color:'#94a3b8'}}>{v}</span></span>
                      ))}
                    </div>
                  )}

                  {/* File upload */}
                  <div style={{ borderTop:'1px solid #1e2433',paddingTop:10,marginTop:4 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:6 }}>
                      <span className="mono" style={{ fontSize:10,color:'#374151',textTransform:'uppercase',letterSpacing:1 }}>
                        Research Files ({(p.files||[]).length})
                      </span>
                      <input type="file" ref={el=>fileRefs.current[p.project_id]=el}
                        style={{ display:'none' }}
                        accept=".pdf,.docx,.txt,.md,.csv,.json"
                        onChange={e => { if (e.target.files[0]) uploadFile(p.project_id, e.target.files[0]); e.target.value=''; }} />
                      <button onClick={()=>fileRefs.current[p.project_id]?.click()}
                        disabled={uploading[p.project_id]}
                        style={{ fontFamily:'monospace',fontSize:10,padding:'2px 10px',borderRadius:4,
                                 border:'1px solid #1e2433',color:'#64748b',background:'transparent' }}>
                        {uploading[p.project_id]?'Uploading...':'+ Upload'}
                      </button>
                    </div>
                    {(p.files||[]).length>0&&(
                      <div style={{ display:'flex',flexWrap:'wrap',gap:6 }}>
                        {p.files.map((f,i)=>(
                          <div key={i} style={{ display:'flex',alignItems:'center',gap:5,padding:'2px 8px',
                                               borderRadius:4,background:'#1e2433',border:'1px solid #252d3d' }}>
                            <span className="mono" style={{ fontSize:10,color:'#64748b' }}>{f.filename}</span>
                            <button onClick={()=>deleteFile(p.project_id, f.stored||f.filename)}
                              style={{ border:'none',background:'none',color:'#374151',fontSize:10,padding:0,cursor:'pointer',lineHeight:1 }}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <p style={{ fontSize:10,color:'#1e2433',marginTop:4 }}>
                      PDF, DOCX, TXT, MD, CSV, JSON — agents incorporate this data in their analysis
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { agentsApi, simulationApi } from '../utils/api';
import { Card, CardPad, StatBox, DirColor } from '../components/UI';
import Gauge from '../components/Gauge';
import AgentGraph from '../components/AgentGraph';

const mapSyn = (s) => !s ? null : {
  upProbability:      s.upProbability   ?? s.up_probability   ?? 0,
  downProbability:    s.downProbability ?? s.down_probability ?? 0,
  neutralProbability: s.neutralProbability ?? s.neutral_probability ?? 0,
  primaryDirection:   s.primaryDirection ?? s.primary_direction ?? 'sideways',
  expectedMagnitude:  s.expectedMagnitude ?? s.expected_magnitude,
  confidence:         s.confidence ?? 0,
  bullCase:           s.bullCase   ?? s.bull_case   ?? '',
  bearCase:           s.bearCase   ?? s.bear_case   ?? '',
  topButterflyEffects:s.topButterflyEffects ?? s.top_butterfly_effects ?? [],
  summary:            s.summary ?? '',
};

export default function Dashboard() {
  const nav = useNavigate();
  const { agents, setAgents, currentAnalysis, history, setHistory } = useStore();

  useEffect(() => {
    agentsApi.list().then(r => setAgents(r.data || [])).catch(() => {});
    simulationApi.history(5).then(r => setHistory(r.data || [])).catch(() => {});
  }, []);

  const latest = currentAnalysis || history[0];
  const syn    = mapSyn(latest?.synthesis);
  const dir    = syn?.primaryDirection;
  const col    = DirColor(dir);

  return (
    <div className="slide" style={{ display:'flex',flexDirection:'column',gap:20 }}>
      <div style={{ display:'flex',alignItems:'flex-end',justifyContent:'space-between' }}>
        <div>
          <h1 className="mono" style={{ fontSize:22,fontWeight:600,color:'#e2e8f0' }}>Dashboard</h1>
          <p style={{ fontSize:13,color:'#374151',marginTop:4 }}>
            Probabilistic multi-agent asset intelligence
          </p>
        </div>
        <div style={{ display:'flex',gap:8 }}>
          <button onClick={()=>nav('/projects')}
            style={{ fontFamily:'monospace',fontSize:12,padding:'7px 16px',borderRadius:5,
                     border:'1px solid #1e2433',color:'#64748b',background:'transparent' }}>
            + New Project
          </button>
          <button onClick={()=>nav('/analyze')}
            style={{ fontFamily:'monospace',fontSize:12,padding:'7px 16px',borderRadius:5,
                     border:'none',color:'#060912',background:'#0ea5e9',fontWeight:600 }}>
            ▶ Analyze
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12 }}>
        <StatBox label="Agents"       value={agents.length} sub={`${agents.filter(a=>a.enabled!==false).length} enabled`} />
        <StatBox label="Analyses"     value={history.length} sub="total runs" />
        <StatBox label="Data Sources" value="25+" sub="categories per run" />
        <StatBox label="Last Run" value={latest?new Date(latest.created_at||latest.createdAt||Date.now()).toLocaleDateString():'—'} sub={latest?.asset?.symbol||latest?.symbol||'no data'} />
      </div>

      {latest && syn ? (
        <>
          <div style={{ display:'grid',gridTemplateColumns:'2fr 3fr',gap:16 }}>
            <CardPad style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center' }}>
              <div className="mono" style={{ fontSize:10,color:'#374151',textTransform:'uppercase',letterSpacing:1,marginBottom:16 }}>
                {latest.asset?.symbol||latest.symbol} — Next Day
              </div>
              <Gauge synthesis={syn} />
            </CardPad>
            <CardPad style={{ display:'flex',flexDirection:'column',gap:14 }}>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                <span className="mono" style={{ fontSize:16,fontWeight:600,color:'#e2e8f0' }}>
                  {latest.asset?.symbol||latest.symbol}
                </span>
                <span className="mono" style={{ fontSize:11,color:'#374151' }}>
                  {new Date(latest.created_at||latest.createdAt||Date.now()).toLocaleString()}
                </span>
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
              {syn.topButterflyEffects?.length>0&&(
                <div>
                  <div className="mono" style={{ fontSize:10,color:'#374151',marginBottom:8 }}>🦋 BUTTERFLY CHAINS</div>
                  {syn.topButterflyEffects.slice(0,2).map((b,i)=>(
                    <div key={i} style={{ display:'flex',gap:8,fontSize:12,color:'#94a3b8',marginBottom:4 }}>
                      <span style={{color:'#f59e0b'}}>›</span>{b}
                    </div>
                  ))}
                </div>
              )}
            </CardPad>
          </div>

          {latest.graph&&(
            <Card>
              <div style={{ padding:'12px 16px',borderBottom:'1px solid #1e2433',display:'flex',justifyContent:'space-between' }}>
                <span className="mono" style={{ fontSize:10,color:'#374151',textTransform:'uppercase',letterSpacing:1 }}>Intelligence Graph</span>
                <span className="mono" style={{ fontSize:10,color:'#374151' }}>
                  {latest.graph.stats?.total_nodes} nodes · {latest.graph.stats?.total_edges} edges · {latest.graph.stats?.bull}B/{latest.graph.stats?.bear}Be/{latest.graph.stats?.neut}N
                </span>
              </div>
              <div style={{ height:320 }}><AgentGraph graph={latest.graph} /></div>
            </Card>
          )}
        </>
      ) : (
        <CardPad style={{ textAlign:'center',padding:56 }}>
          <div style={{ fontSize:32,marginBottom:12 }}>◎</div>
          <div className="mono" style={{ color:'#e2e8f0',marginBottom:6 }}>No analyses yet</div>
          <p style={{ fontSize:13,color:'#374151',marginBottom:20 }}>Built-in free agents ready — create a project and run your first analysis</p>
          <div style={{ display:'flex',justifyContent:'center',gap:10 }}>
            <button onClick={()=>nav('/projects')}
              style={{ fontFamily:'monospace',fontSize:12,padding:'7px 16px',borderRadius:5,
                       border:'1px solid #1e2433',color:'#64748b',background:'transparent' }}>
              New Project
            </button>
            <button onClick={()=>nav('/analyze')}
              style={{ fontFamily:'monospace',fontSize:12,padding:'7px 16px',borderRadius:5,
                       border:'none',color:'#060912',background:'#0ea5e9',fontWeight:600 }}>
              Quick Analyze
            </button>
          </div>
        </CardPad>
      )}
    </div>
  );
}

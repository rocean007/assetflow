import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { agentsApi } from '../utils/api';
import { CardPad, Badge } from '../components/UI';

const PROVIDERS = [
  { v:'pollinations',     l:'Pollinations.ai ★ FREE no key', free:true,  noKey:true,  models:['mistral','llama','openai','phi'] },
  { v:'huggingface_free', l:'HuggingFace ★ FREE no key',     free:true,  noKey:true,  models:['HuggingFaceH4/zephyr-7b-beta','mistralai/Mistral-7B-Instruct-v0.2'] },
  { v:'together_free',    l:'Together.ai ★ FREE no key',     free:true,  noKey:true,  models:['Qwen/Qwen2.5-7B-Instruct-Turbo'] },
  { v:'groq',             l:'Groq — free signup',            free:true,  noKey:false, models:['llama-3.3-70b-versatile','llama-3.1-8b-instant'] },
  { v:'google',           l:'Google Gemini — free tier',     free:true,  noKey:false, models:['gemini-1.5-flash','gemini-1.5-pro','gemini-2.0-flash-exp'] },
  { v:'openrouter',       l:'OpenRouter — free models',      free:true,  noKey:false, models:['meta-llama/llama-3.1-8b-instruct:free','google/gemini-flash-1.5'] },
  { v:'ollama',           l:'Ollama — local (free)',         free:true,  noKey:true,  models:['llama3.2','mistral','phi3','qwen2.5'] },
  { v:'openai',           l:'OpenAI',                        free:false, noKey:false, models:['gpt-4o-mini','gpt-4o'] },
  { v:'anthropic',        l:'Anthropic',                     free:false, noKey:false, models:['claude-3-5-haiku-20241022','claude-3-5-sonnet-20241022'] },
  { v:'deepseek',         l:'DeepSeek (near-free)',          free:true,  noKey:false, models:['deepseek-chat','deepseek-reasoner'] },
  { v:'mistral',          l:'Mistral AI',                    free:true,  noKey:false, models:['mistral-small-latest'] },
  { v:'cohere',           l:'Cohere',                        free:true,  noKey:false, models:['command-r-plus-08-2024'] },
];

const ROLES = [
  { v:'specialist',        l:'Specialist',          desc:'Auto round-robin across all 7 roles' },
  { v:'macro',             l:'Macro',               desc:'Rates, inflation, GDP, central banks' },
  { v:'sentiment',         l:'Sentiment',           desc:'News, options flow, insider trades, fear/greed' },
  { v:'social_sentiment',  l:'Social Intel',        desc:'Reddit/X/StockTwits manipulation detection' },
  { v:'supply_chain',      l:'Supply Chain',        desc:'Weather, commodities, shipping butterfly chains' },
  { v:'technical',         l:'Technical',           desc:'Price action, RSI, volume, support/resistance' },
  { v:'geopolitical',      l:'Geopolitical',        desc:'Conflicts, sanctions, trade policy' },
  { v:'sector',            l:'Sector',              desc:'Earnings, analysts, insiders, M&A' },
  { v:'synthesizer',       l:'Synthesizer',         desc:'Phase 2: reads complete graph → verdict' },
  { v:'super_synthesizer', l:'Super Synthesizer',   desc:'Phase 3: reconciles multiple synthesizer verdicts' },
];

const EMPTY = { name:'', provider:'pollinations', api_key:'', model:'', base_url:'', role:'specialist', description:'' };

export default function Agents() {
  const { agents, setAgents } = useStore();
  const [form, setForm]    = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [testing, setTesting] = useState(null);
  const [testRes, setTestRes] = useState({});
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState('');

  useEffect(() => { agentsApi.list().then(r=>setAgents(r.data||[])).catch(()=>{}); }, []);

  const prov = PROVIDERS.find(p=>p.v===form.provider);
  const roleInfo = ROLES.find(r=>r.v===form.role);

  async function submit(e) {
    e.preventDefault(); setErr(''); setSaving(true);
    try {
      if (editId) {
        const r = await agentsApi.update(editId, form);
        setAgents(agents.map(a=>a.agent_id===editId?r.data:a));
        setEditId(null);
      } else {
        const r = await agentsApi.create(form);
        setAgents([...agents, r.data]);
      }
      setForm(EMPTY);
    } catch (e2) { setErr(String(e2)); }
    setSaving(false);
  }

  async function test(id) {
    setTesting(id);
    try {
      const r = await agentsApi.test(id);
      setTestRes(t=>({...t,[id]:{ok:r.success,msg:(r.response||r.error||'').slice(0,80)}}));
    } catch (e2) { setTestRes(t=>({...t,[id]:{ok:false,msg:String(e2).slice(0,80)}})); }
    setTesting(null);
  }

  async function toggle(a) {
    const r = await agentsApi.update(a.agent_id, { enabled: !a.enabled }).catch(()=>null);
    if (r?.data) setAgents(agents.map(x=>x.agent_id===a.agent_id?r.data:x));
  }

  async function del(id) {
    if (!confirm('Delete?')) return;
    await agentsApi.delete(id).catch(()=>{});
    setAgents(agents.filter(a=>a.agent_id!==id));
  }

  const phaseGroups = [
    { phase:'Phase 1 — Specialists', color:'#6366f1', agents: agents.filter(a=>!['synthesizer','super_synthesizer'].includes(a.role)) },
    { phase:'Phase 2 — Synthesizers', color:'#a855f7', agents: agents.filter(a=>a.role==='synthesizer') },
    { phase:'Phase 3 — Super Synth',  color:'#ec4899', agents: agents.filter(a=>a.role==='super_synthesizer') },
  ];

  return (
    <div className="slide" style={{ display:'flex',flexDirection:'column',gap:20 }}>
      <div>
        <h1 className="mono" style={{ fontSize:22,fontWeight:600,color:'#e2e8f0' }}>Agents</h1>
        <p style={{ fontSize:13,color:'#374151',marginTop:4 }}>
          Configure LLM agents. Built-in free agents are ready — no API key needed.
        </p>
      </div>

      {/* Phase counts */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12 }}>
        {phaseGroups.map(g=>(
          <CardPad key={g.phase} style={{ padding:14 }}>
            <div className="mono" style={{ fontSize:9,color:g.color,textTransform:'uppercase',letterSpacing:1,marginBottom:4 }}>{g.phase}</div>
            <div className="mono" style={{ fontSize:24,fontWeight:700,color:'#e2e8f0' }}>{g.agents.length}</div>
          </CardPad>
        ))}
      </div>

      {/* Form */}
      <CardPad>
        <h2 className="mono" style={{ fontSize:12,color:'#e2e8f0',marginBottom:14,textTransform:'uppercase',letterSpacing:1 }}>
          {editId?'Edit Agent':'Add Agent'}
        </h2>
        <form onSubmit={submit} style={{ display:'flex',flexDirection:'column',gap:12 }}>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
            {[['Name *','name','My Agent',true],['Description','description','What it does',false]].map(([l,k,ph,req])=>(
              <div key={k}>
                <label className="mono" style={{ fontSize:9,color:'#374151',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1 }}>{l}</label>
                <input value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} placeholder={ph} required={req}
                  style={{ fontFamily:'JetBrains Mono,monospace',fontSize:12 }} />
              </div>
            ))}
            <div>
              <label className="mono" style={{ fontSize:9,color:'#374151',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1 }}>Provider *</label>
              <select value={form.provider} onChange={e=>setForm(f=>({...f,provider:e.target.value,model:''}))}
                style={{ fontFamily:'JetBrains Mono,monospace',fontSize:12 }}>
                {PROVIDERS.map(p=><option key={p.v} value={p.v}>{p.l}</option>)}
              </select>
            </div>
            <div>
              <label className="mono" style={{ fontSize:9,color:'#374151',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1 }}>Model</label>
              <select value={form.model} onChange={e=>setForm(f=>({...f,model:e.target.value}))}
                style={{ fontFamily:'JetBrains Mono,monospace',fontSize:12 }}>
                <option value="">Default</option>
                {prov?.models.map(m=><option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="mono" style={{ fontSize:9,color:'#374151',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1 }}>Role</label>
              <select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}
                style={{ fontFamily:'JetBrains Mono,monospace',fontSize:12 }}>
                {ROLES.map(r=><option key={r.v} value={r.v}>{r.l}</option>)}
              </select>
            </div>
            {prov?.noKey?(
              <div style={{ padding:'8px 12px',borderRadius:5,background:'rgba(16,185,129,.06)',border:'1px solid rgba(16,185,129,.2)' }}>
                <span className="mono" style={{ fontSize:10,color:'#10b981' }}>★ No API key needed</span>
              </div>
            ):(
              <div>
                <label className="mono" style={{ fontSize:9,color:'#374151',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1 }}>API Key</label>
                <input type="password" value={form.api_key} onChange={e=>setForm(f=>({...f,api_key:e.target.value}))}
                  placeholder={editId?'Leave blank to keep existing':'Your key...'}
                  style={{ fontFamily:'JetBrains Mono,monospace',fontSize:12 }} />
              </div>
            )}
          </div>
          {roleInfo&&<div style={{ fontSize:11,color:'#374151' }}>↳ {roleInfo.desc}</div>}
          {err&&<div className="mono" style={{ color:'#f43f5e',fontSize:11 }}>{err}</div>}
          <div style={{ display:'flex',gap:8 }}>
            <button type="submit" disabled={saving}
              style={{ fontFamily:'monospace',fontSize:12,padding:'7px 16px',borderRadius:5,border:'none',
                       color:'#060912',background:'#0ea5e9',fontWeight:600 }}>
              {saving?'Saving...':editId?'Update':'Add Agent'}
            </button>
            {editId&&<button type="button" onClick={()=>{setEditId(null);setForm(EMPTY);}}
              style={{ fontFamily:'monospace',fontSize:12,padding:'7px 14px',borderRadius:5,
                       border:'1px solid #1e2433',color:'#64748b',background:'transparent' }}>Cancel</button>}
          </div>
        </form>
      </CardPad>

      {/* Agent list */}
      {agents.length===0?(
        <CardPad style={{ textAlign:'center',padding:32 }}>
          <div className="mono" style={{ color:'#374151',fontSize:12 }}>No agents. Restart the server to re-seed built-in free agents.</div>
        </CardPad>
      ):(
        <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
          {agents.map(a=>{
            const roleCol = a.role==='super_synthesizer'?'#ec4899':a.role==='synthesizer'?'#a855f7':'#6366f1';
            const tr = testRes[a.agent_id];
            return (
              <CardPad key={a.agent_id} style={{ padding:12,opacity:a.enabled===false?.5:1 }}>
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                  <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                    {/* Toggle */}
                    <div onClick={()=>toggle(a)} style={{ width:30,height:16,borderRadius:8,cursor:'pointer',position:'relative',
                      background:a.enabled!==false?'rgba(14,165,233,.25)':'#1e2433',transition:'background .2s' }}>
                      <div style={{ position:'absolute',top:2,width:12,height:12,borderRadius:'50%',transition:'left .2s',
                        left:a.enabled!==false?15:2,background:a.enabled!==false?'#0ea5e9':'#374151' }} />
                    </div>
                    <span className="mono" style={{ fontSize:12,fontWeight:600,color:'#e2e8f0' }}>{a.name}</span>
                    <span className="mono" style={{ fontSize:10,color:'#374151' }}>{a.provider}/{a.model||'default'}</span>
                    <Badge label={a.role} color={roleCol} />
                    {a.builtin&&<Badge label="built-in free" color="#10b981" />}
                    {!a.builtin&&a.has_api_key&&<span className="mono" style={{ fontSize:9,color:'#10b981' }}>● key</span>}
                  </div>
                  <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                    {tr&&<span className="mono" style={{ fontSize:10,color:tr.ok?'#10b981':'#f43f5e' }}>{tr.ok?'✓ ok':'✗ '+tr.msg}</span>}
                    {[['test',()=>test(a.agent_id),testing===a.agent_id],
                      ['edit',()=>{setEditId(a.agent_id);setForm({name:a.name,provider:a.provider,api_key:'',model:a.model||'',base_url:a.base_url||'',role:a.role,description:a.description||''});},false],
                      ['del', ()=>del(a.agent_id),false]].map(([l,fn,dis])=>(
                      <button key={l} onClick={fn} disabled={dis}
                        style={{ fontFamily:'monospace',fontSize:10,padding:'3px 10px',borderRadius:4,cursor:'pointer',
                                 border:'1px solid #1e2433',color:l==='del'?'#f43f5e':'#64748b',background:'transparent' }}>
                        {dis?'…':l}
                      </button>
                    ))}
                  </div>
                </div>
                {a.description&&<div style={{ fontSize:11,color:'#374151',marginTop:6,paddingLeft:40 }}>{a.description}</div>}
              </CardPad>
            );
          })}
        </div>
      )}
    </div>
  );
}

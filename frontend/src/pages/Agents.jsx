import { useEffect, useState } from 'react';
import { agentsApi } from '../utils/api';
import { P, Card, Tag } from '../components/UI';

const PROVIDERS = [
  {v:'groq',      l:'Groq',           free:true, models:['llama-3.3-70b-versatile','llama-3.1-8b-instant','gemma2-9b-it'],                    note:'FREE signup · fastest · console.groq.com'},
  {v:'openrouter',l:'OpenRouter',     free:true, models:['meta-llama/llama-3.1-8b-instruct:free','google/gemma-2-9b-it:free','mistralai/mistral-7b-instruct:free'], note:'FREE no CC · 50 req/day · openrouter.ai'},
  {v:'google',    l:'Google Gemini',  free:true, models:['gemini-1.5-flash','gemini-1.5-pro','gemini-2.0-flash-exp'],                         note:'FREE tier · aistudio.google.com'},
  {v:'mistral',   l:'Mistral',        free:true, models:['mistral-small-latest','open-mistral-7b'],                                           note:'FREE tier · console.mistral.ai'},
  {v:'together',  l:'Together AI',    free:true, models:['meta-llama/Llama-3.3-70B-Instruct-Turbo','Qwen/Qwen2.5-7B-Instruct-Turbo'],         note:'$25 free credits · platform.together.ai'},
  {v:'cerebras',  l:'Cerebras',       free:true, models:['llama3.1-70b','llama3.1-8b'],                                                      note:'FREE fast tier · inference.cerebras.ai'},
  {v:'deepseek',  l:'DeepSeek',       free:false,models:['deepseek-chat','deepseek-reasoner'],                                               note:'~$0 · $0.00014/1K in · platform.deepseek.com'},
  {v:'openai',    l:'OpenAI',         free:false,models:['gpt-4o-mini','gpt-4o'],                                                            note:'Paid · platform.openai.com'},
  {v:'anthropic', l:'Anthropic',      free:false,models:['claude-3-5-haiku-20241022','claude-3-5-sonnet-20241022'],                          note:'Paid · console.anthropic.com'},
  {v:'ollama',    l:'Ollama (local)', free:true, models:['llama3.2','mistral','phi3','qwen2.5','deepseek-r1'],                               note:'100% local · ollama.com'},
];
const ROLES = [
  {v:'specialist',      l:'Specialist',       d:'Auto round-robin across all 7 specialist roles'},
  {v:'macro',           l:'Macro',            d:'Rates, inflation, GDP, central banks'},
  {v:'sentiment',       l:'Sentiment',        d:'News, options flow, insider trades'},
  {v:'supply',          l:'Supply Chain',     d:'Weather, commodities, shipping'},
  {v:'technical',       l:'Technical',        d:'Price action, RSI, volume, momentum'},
  {v:'geo',             l:'Geopolitical',     d:'Conflicts, sanctions, trade policy'},
  {v:'sector',          l:'Sector',           d:'Earnings, analysts, insiders, M&A'},
  {v:'social',          l:'Social Intel',     d:'Reddit/StockTwits manipulation detection'},
  {v:'synthesizer',     l:'Synthesizer',      d:'Reads complete graph → final verdict'},
];
const EMPTY = {name:'',provider:'groq',api_key:'',model:'',base_url:'',role:'specialist',description:''};
const inp = {fontFamily:'JetBrains Mono,monospace',fontSize:12};

export default function Agents() {
  const [agents, setAgents] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(null);
  const [testRes, setTestRes] = useState({});
  const [err, setErr] = useState('');

  useEffect(() => { agentsApi.list().then(r=>setAgents(r.data||[])).catch(()=>{}); }, []);

  const prov = PROVIDERS.find(p=>p.v===form.provider);

  async function submit(e) {
    e.preventDefault(); setErr(''); setSaving(true);
    try {
      if (editId) {
        const r = await agentsApi.update(editId, form);
        setAgents(prev=>prev.map(a=>a.agent_id===editId?r.data:a));
        setEditId(null);
      } else {
        const r = await agentsApi.create(form);
        setAgents(prev=>[...prev,r.data]);
      }
      setForm(EMPTY);
    } catch(e2){ setErr(String(e2)); }
    setSaving(false);
  }

  async function test(id) {
    setTesting(id);
    try {
      const r = await agentsApi.test(id);
      setTestRes(t=>({...t,[id]:{ok:r.success,msg:(r.response||r.error||'').slice(0,80)}}));
    } catch(e2){
      setTestRes(t=>({...t,[id]:{ok:false,msg:String(e2).slice(0,80)}}));
    }
    setTesting(null);
  }

  async function toggle(a) {
    const r = await agentsApi.update(a.agent_id,{enabled:!a.enabled}).catch(()=>null);
    if(r?.data) setAgents(prev=>prev.map(x=>x.agent_id===a.agent_id?r.data:x));
  }

  async function del(id) {
    if(!confirm('Delete?')) return;
    await agentsApi.delete(id).catch(()=>{});
    setAgents(prev=>prev.filter(a=>a.agent_id!==id));
  }

  return (
    <div className="slide" style={{maxWidth:900,margin:'0 auto',display:'flex',flexDirection:'column',gap:18}}>
      <div>
        <h1 className="mono" style={{fontSize:22,fontWeight:600,color:'#e2e8f0'}}>Agents</h1>
        <p style={{fontSize:13,color:'#334155',marginTop:4}}>
          Configure LLM agents. Groq is the recommended free provider — create a free account in under 2 minutes.
        </p>
      </div>

      {/* Phase counts */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
        {[
          {l:'Phase 1 Specialists',c:'#6366f1',count:agents.filter(a=>a.role!=='synthesizer').length,d:'Write to intelligence graph'},
          {l:'Phase 2 Synthesizers',c:'#a855f7',count:agents.filter(a=>a.role==='synthesizer').length,d:'Read graph → verdict'},
          {l:'Total Enabled',c:'#10b981',count:agents.filter(a=>a.enabled!==false).length,d:'Will run in analysis'},
        ].map(p=>(
          <P key={p.l} style={{padding:14}}>
            <div className="mono" style={{fontSize:9,color:p.c,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>{p.l}</div>
            <div className="mono" style={{fontSize:22,fontWeight:700,color:'#e2e8f0'}}>{p.count}</div>
            <div style={{fontSize:11,color:'#334155',marginTop:2}}>{p.d}</div>
          </P>
        ))}
      </div>

      {/* Form */}
      <P>
        <h2 className="mono" style={{fontSize:11,color:'#e2e8f0',marginBottom:14,textTransform:'uppercase',letterSpacing:1}}>
          {editId?'Edit Agent':'Add Agent'}
        </h2>
        <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <label className="mono" style={{fontSize:9,color:'#475569',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Name *</label>
              <input style={inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="My Groq Agent" required/>
            </div>
            <div>
              <label className="mono" style={{fontSize:9,color:'#475569',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Role</label>
              <select style={inp} value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
                {ROLES.map(r=><option key={r.v} value={r.v}>{r.l} — {r.d}</option>)}
              </select>
            </div>
            <div>
              <label className="mono" style={{fontSize:9,color:'#475569',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Provider *</label>
              <select style={inp} value={form.provider} onChange={e=>setForm(f=>({...f,provider:e.target.value,model:''}))}>
                {PROVIDERS.map(p=><option key={p.v} value={p.v}>{p.l}{p.free?' (free)':''}</option>)}
              </select>
            </div>
            <div>
              <label className="mono" style={{fontSize:9,color:'#475569',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Model</label>
              <select style={inp} value={form.model} onChange={e=>setForm(f=>({...f,model:e.target.value}))}>
                <option value="">Default</option>
                {prov?.models.map(m=><option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          {prov && (
            <div style={{padding:'8px 12px',borderRadius:5,
                         background:prov.free?'rgba(16,185,129,.06)':'rgba(59,130,246,.06)',
                         border:`1px solid ${prov.free?'rgba(16,185,129,.2)':'rgba(59,130,246,.15)'}`}}>
              <span className="mono" style={{fontSize:10,color:prov.free?'#10b981':'#3b82f6'}}>
                {prov.free?'✓ Free: ':'⚑ '}{prov.note}
              </span>
            </div>
          )}
          {form.provider !== 'ollama' ? (
            <div>
              <label className="mono" style={{fontSize:9,color:'#475569',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>API Key</label>
              <input style={inp} type="password" value={form.api_key}
                onChange={e=>setForm(f=>({...f,api_key:e.target.value}))}
                placeholder={editId?'Leave blank to keep existing':'Your API key...'}/>
            </div>
          ) : (
            <div>
              <label className="mono" style={{fontSize:9,color:'#475569',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Ollama URL</label>
              <input style={inp} value={form.base_url}
                onChange={e=>setForm(f=>({...f,base_url:e.target.value}))}
                placeholder="http://localhost:11434"/>
            </div>
          )}
          {err && <p className="mono" style={{fontSize:11,color:'#f43f5e'}}>{err}</p>}
          <div style={{display:'flex',gap:8}}>
            <button type="submit" disabled={saving}
              style={{fontFamily:'monospace',fontSize:12,padding:'7px 18px',borderRadius:5,cursor:'pointer',
                      border:'none',color:'#050810',background:'#3b82f6',fontWeight:600}}>
              {saving?'Saving...':editId?'Update':'Add Agent'}
            </button>
            {editId && <button type="button" onClick={()=>{setEditId(null);setForm(EMPTY);}}
              style={{fontFamily:'monospace',fontSize:12,padding:'7px 14px',borderRadius:5,cursor:'pointer',
                      border:'1px solid #1a2035',color:'#475569',background:'transparent'}}>Cancel</button>}
          </div>
        </form>
      </P>

      {/* Agent list */}
      {!agents.length ? (
        <P style={{textAlign:'center',padding:32}}>
          <div className="mono" style={{color:'#334155',fontSize:12}}>
            No agents. Add a Groq agent above — free signup takes 2 minutes at console.groq.com
          </div>
        </P>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {agents.map(a => {
            const roleCol = a.role==='synthesizer'?'#a855f7':'#6366f1';
            const tr = testRes[a.agent_id];
            return (
              <P key={a.agent_id} style={{padding:12,opacity:a.enabled===false?.45:1}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div onClick={()=>toggle(a)} style={{width:28,height:15,borderRadius:8,cursor:'pointer',position:'relative',
                      background:a.enabled!==false?'rgba(59,130,246,.25)':'#1a2035'}}>
                      <div style={{position:'absolute',top:2,width:11,height:11,borderRadius:'50%',transition:'left .2s',
                        left:a.enabled!==false?14:2,background:a.enabled!==false?'#3b82f6':'#334155'}}/>
                    </div>
                    <span className="mono" style={{fontSize:12,fontWeight:600,color:'#e2e8f0'}}>{a.name}</span>
                    <span className="mono" style={{fontSize:10,color:'#334155'}}>{a.provider}/{a.model||'default'}</span>
                    <Tag label={a.role} color={roleCol}/>
                    {a.builtin && <Tag label="built-in" color="#10b981"/>}
                    {a.has_key && <span className="mono" style={{fontSize:9,color:'#10b981'}}>● key</span>}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:5}}>
                    {tr && <span className="mono" style={{fontSize:9,color:tr.ok?'#10b981':'#f43f5e'}}>{tr.ok?'✓ ok':'✗'}</span>}
                    {[['test',()=>test(a.agent_id),testing===a.agent_id,'#475569'],
                      ['edit',()=>{setEditId(a.agent_id);setForm({name:a.name,provider:a.provider,api_key:'',model:a.model||'',base_url:a.base_url||'',role:a.role,description:a.description||''});},false,'#475569'],
                      ['del', ()=>del(a.agent_id),false,'#f43f5e']].map(([l,fn,dis,c])=>(
                      <button key={l} onClick={fn} disabled={dis}
                        style={{fontFamily:'monospace',fontSize:10,padding:'3px 9px',borderRadius:3,cursor:'pointer',
                                border:`1px solid ${c}35`,color:c,background:'transparent'}}>
                        {dis?'…':l}
                      </button>
                    ))}
                  </div>
                </div>
                {a.description && <div style={{fontSize:11,color:'#334155',marginTop:5,paddingLeft:38}}>{a.description}</div>}
              </P>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionsApi } from '../utils/api';
import { P, Bar } from '../components/UI';

const ATYPES = ['equity','crypto','forex','commodity','index','etf','bond','reit'];
const PROVIDERS = [
  {v:'groq',      l:'Groq',          note:'Llama 3.3 70B · FREE signup · fastest free option · console.groq.com'},
  {v:'openrouter',l:'OpenRouter',     note:'Many :free models · FREE no CC · openrouter.ai'},
  {v:'google',    l:'Google Gemini',  note:'Gemini Flash free tier · aistudio.google.com'},
  {v:'mistral',   l:'Mistral',        note:'Free tier · console.mistral.ai'},
  {v:'together',  l:'Together AI',    note:'$25 free credits · platform.together.ai'},
  {v:'cerebras',  l:'Cerebras',       note:'Fast free tier · inference.cerebras.ai'},
  {v:'deepseek',  l:'DeepSeek',       note:'Near-free $0.00014/1K · platform.deepseek.com'},
  {v:'openai',    l:'OpenAI',         note:'Paid · platform.openai.com'},
  {v:'anthropic', l:'Anthropic',      note:'Paid · console.anthropic.com'},
  {v:'ollama',    l:'Ollama',         note:'Local free · install ollama.com'},
];

export default function NewRun() {
  const nav = useNavigate();
  const fileRef = useRef();
  const [form, setForm] = useState({symbol:'',name:'',asset_type:'equity',description:'',av_key:''});
  const [files, setFiles] = useState([]);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState('');
  const [uploadErr, setUploadErr] = useState('');

  async function submit(e) {
    e.preventDefault(); setErr('');
    if (!form.symbol.trim()) return setErr('Symbol required');
    setCreating(true);
    try {
      const r = await sessionsApi.create({...form, symbol: form.symbol.toUpperCase()});
      if (!r.success) throw new Error(r.error);
      const sid = r.data.session_id;
      // Upload any files
      for (const file of files) {
        try { await sessionsApi.upload(sid, file); } catch {}
      }
      nav(`/run/${sid}`);
    } catch (e2) { setErr(String(e2)); setCreating(false); }
  }

  function addFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    const allowed = ['.pdf','.docx','.txt','.md','.csv','.json'];
    const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
    if (!allowed.includes(ext)) { setUploadErr(`Not allowed: ${ext}`); return; }
    setFiles(prev => [...prev, f]); setUploadErr('');
    e.target.value = '';
  }

  const inp = { fontFamily:'JetBrains Mono,monospace', fontSize:12 };

  return (
    <div className="slide" style={{maxWidth:700,margin:'0 auto',display:'flex',flexDirection:'column',gap:20}}>
      <div>
        <h1 className="mono" style={{fontSize:22,fontWeight:600,color:'#e2e8f0'}}>New Analysis</h1>
        <p style={{fontSize:13,color:'#334155',marginTop:4}}>
          Enter a ticker. Optionally upload research files. Hit Run — analysis starts immediately.
        </p>
      </div>

      {/* Flow diagram */}
      <P style={{padding:16}}>
        <div style={{display:'flex',alignItems:'center',gap:0,justifyContent:'center',flexWrap:'wrap',gap:4}}>
          {[
            ['⬇','Fetch Data','price,news,weather,social,commodities'],
            ['→','Fast Prediction','all agents run concurrently'],
            ['→','Show Results','fast verdict displayed immediately'],
            ['→','Deep Research','background enrichment + re-run'],
            ['→','Final Verdict','refined prediction complete'],
          ].map(([icon,title,sub],i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:4}}>
              {i>0&&<span style={{color:'#334155',fontSize:14}}>→</span>}
              <div style={{textAlign:'center',padding:'6px 10px',borderRadius:5,
                           background:'rgba(59,130,246,.06)',border:'1px solid rgba(59,130,246,.15)'}}>
                <div className="mono" style={{fontSize:11,fontWeight:600,color:'#3b82f6'}}>{icon} {title}</div>
                <div style={{fontSize:9,color:'#475569',marginTop:2}}>{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </P>

      <P>
        <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <label className="mono" style={{fontSize:9,color:'#475569',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Symbol *</label>
              <input style={inp} value={form.symbol} placeholder="AAPL, BTC-USD, GC=F, EURUSD=X..."
                onChange={e=>setForm(f=>({...f,symbol:e.target.value.toUpperCase()}))} required disabled={creating}/>
            </div>
            <div>
              <label className="mono" style={{fontSize:9,color:'#475569',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Asset Type</label>
              <select style={inp} value={form.asset_type}
                onChange={e=>setForm(f=>({...f,asset_type:e.target.value}))} disabled={creating}>
                {ATYPES.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mono" style={{fontSize:9,color:'#475569',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Research Question / Extra Context (optional)</label>
            <textarea style={{...inp,minHeight:72,resize:'vertical'}} value={form.description}
              placeholder="e.g. How might rising oil prices and Fed rate decisions affect this asset over the next week?"
              onChange={e=>setForm(f=>({...f,description:e.target.value}))} disabled={creating}/>
            <p style={{fontSize:10,color:'#334155',marginTop:3}}>This is injected into every agent's context as high-priority guidance.</p>
          </div>
          <div>
            <label className="mono" style={{fontSize:9,color:'#475569',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Alpha Vantage Key (optional)</label>
            <input style={inp} type="password" value={form.av_key} placeholder="Better OHLCV price data — free at alphavantage.co"
              onChange={e=>setForm(f=>({...f,av_key:e.target.value}))} disabled={creating}/>
          </div>

          {/* File upload */}
          <div style={{borderTop:'1px solid #1a2035',paddingTop:14}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
              <span className="mono" style={{fontSize:9,color:'#475569',textTransform:'uppercase',letterSpacing:1}}>
                Research Files ({files.length})
              </span>
              <input ref={fileRef} type="file" style={{display:'none'}}
                accept=".pdf,.docx,.txt,.md,.csv,.json" onChange={addFile}/>
              <button type="button" onClick={()=>fileRef.current?.click()}
                style={{fontFamily:'monospace',fontSize:10,padding:'2px 10px',borderRadius:3,cursor:'pointer',
                        border:'1px solid #1a2035',color:'#475569',background:'transparent'}}>
                + Add File
              </button>
            </div>
            <p style={{fontSize:10,color:'#334155',marginBottom:6}}>
              PDF, DOCX, TXT, MD, CSV, JSON — agents incorporate this into their analysis
            </p>
            {uploadErr && <p style={{fontSize:10,color:'#f43f5e'}}>{uploadErr}</p>}
            {files.length > 0 && (
              <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                {files.map((f,i) => (
                  <div key={i} style={{display:'flex',alignItems:'center',gap:5,padding:'2px 8px',
                                       borderRadius:4,background:'#1a2035',border:'1px solid #243050'}}>
                    <span className="mono" style={{fontSize:10,color:'#64748b'}}>{f.name}</span>
                    <button type="button" onClick={()=>setFiles(prev=>prev.filter((_,j)=>j!==i))}
                      style={{border:'none',background:'none',color:'#334155',cursor:'pointer',fontSize:10,padding:0}}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {err && <p className="mono" style={{fontSize:11,color:'#f43f5e'}}>{err}</p>}

          <button type="submit" disabled={creating}
            style={{fontFamily:'monospace',fontSize:13,padding:'10px 24px',borderRadius:5,cursor:'pointer',
                    border:'none',color:'#050810',background:creating?'#334155':'#3b82f6',fontWeight:700,marginTop:4}}>
            {creating ? '⟳ Starting...' : '▶ Run Analysis'}
          </button>
        </form>
      </P>

      {/* Provider guide */}
      <P>
        <div className="mono" style={{fontSize:9,color:'#475569',textTransform:'uppercase',letterSpacing:1,marginBottom:12}}>
          Supported LLM Providers — configure in Agents tab
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:5}}>
          {PROVIDERS.map(p => (
            <div key={p.v} style={{display:'flex',gap:10,alignItems:'center'}}>
              <span className="mono" style={{fontSize:11,color:'#3b82f6',width:90,flexShrink:0}}>{p.l}</span>
              <span style={{fontSize:11,color:'#475569'}}>{p.note}</span>
            </div>
          ))}
        </div>
      </P>
    </div>
  );
}

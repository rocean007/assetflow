import { SC } from './UI';
export default function Gauge({ r }) {
  if (!r) return null;
  const up=r.up||0; const dn=r.down||0; const sd=r.side||(100-up-dn);
  const dir=r.direction||'sideways'; const main=dir==='up'?up:dir==='down'?dn:sd;
  const col=SC(dir);
  const R=64,CX=82,CY=82;
  const rad=d=>(d-180)*Math.PI/180;
  const arc=(s,e)=>{
    const x1=CX+R*Math.cos(rad(s)),y1=CY+R*Math.sin(rad(s));
    const x2=CX+R*Math.cos(rad(e)),y2=CY+R*Math.sin(rad(e));
    return `M ${x1} ${y1} A ${R} ${R} 0 ${e-s>180?1:0} 1 ${x2} ${y2}`;
  };
  const de=dn/100*180; const se=de+sd/100*180;
  const nd=(main/100*180)-90;
  const nx=CX+50*Math.cos((nd-90)*Math.PI/180);
  const ny=CY+50*Math.sin((nd-90)*Math.PI/180);
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
      <svg width="164" height="88" viewBox="0 0 164 88">
        <path d={arc(0,180)} fill="none" stroke="#1a2035" strokeWidth="10" strokeLinecap="round"/>
        {dn>0&&<path d={arc(0,de)} fill="none" stroke="#f43f5e" strokeWidth="10" opacity=".8"/>}
        {sd>0&&<path d={arc(de,se)} fill="none" stroke="#f59e0b" strokeWidth="10" opacity=".6"/>}
        {up>0&&<path d={arc(se,180)} fill="none" stroke="#10b981" strokeWidth="10" opacity=".8"/>}
        <line x1={CX} y1={CY} x2={nx} y2={ny} stroke={col} strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx={CX} cy={CY} r="4" fill={col}/>
      </svg>
      <div className="mono" style={{fontSize:28,fontWeight:700,color:col,marginTop:-4}}>{main}%</div>
      <div className="mono" style={{fontSize:9,color:'#475569',marginTop:3,textTransform:'uppercase',letterSpacing:1}}>
        {dir==='up'?'prob up':dir==='down'?'prob down':'sideways'}
      </div>
      <div style={{width:'100%',marginTop:10,display:'flex',flexDirection:'column',gap:5}}>
        {[['UP',up,'#10b981'],['SIDE',sd,'#f59e0b'],['DOWN',dn,'#f43f5e']].map(([l,v,c])=>(
          <div key={l} style={{display:'flex',alignItems:'center',gap:6}}>
            <span className="mono" style={{fontSize:9,color:c,width:26}}>{l}</span>
            <div style={{flex:1,height:2,background:'#1a2035',borderRadius:2}}>
              <div style={{height:2,width:`${v}%`,background:c,borderRadius:2,transition:'width .6s'}}/>
            </div>
            <span className="mono" style={{fontSize:9,color:'#475569',width:26,textAlign:'right'}}>{v}%</span>
          </div>
        ))}
      </div>
      <div className="mono" style={{fontSize:9,color:'#475569',marginTop:6}}>
        conf: <span style={{color:'#94a3b8'}}>{r.confidence||0}%</span>
        {r.magnitude&&<> · <span style={{color:'#94a3b8'}}>{r.magnitude}</span></>}
      </div>
    </div>
  );
}

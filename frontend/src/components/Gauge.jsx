export default function Gauge({ synthesis }) {
  if (!synthesis) return null;
  const up   = synthesis.upProbability   || 0;
  const dn   = synthesis.downProbability || 0;
  const side = synthesis.neutralProbability ?? Math.max(0, 100 - up - dn);
  const dir  = synthesis.primaryDirection;
  const main = dir === 'up' ? up : dir === 'down' ? dn : side;
  const col  = dir === 'up' ? '#10b981' : dir === 'down' ? '#f43f5e' : '#f59e0b';
  const R = 66, CX = 85, CY = 85;
  const rad = (d) => (d - 180) * Math.PI / 180;
  const arc = (s, e) => {
    const x1=CX+R*Math.cos(rad(s)),y1=CY+R*Math.sin(rad(s));
    const x2=CX+R*Math.cos(rad(e)),y2=CY+R*Math.sin(rad(e));
    return `M ${x1} ${y1} A ${R} ${R} 0 ${e-s>180?1:0} 1 ${x2} ${y2}`;
  };
  const dnEnd  = (dn/100)*180;
  const sdEnd  = dnEnd + (side/100)*180;
  const ndeg   = (main/100)*180 - 90;
  const nx     = CX + 50*Math.cos((ndeg-90)*Math.PI/180);
  const ny     = CY + 50*Math.sin((ndeg-90)*Math.PI/180);
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
      <svg width="170" height="92" viewBox="0 0 170 92">
        <path d={arc(0,180)} fill="none" stroke="#1e2433" strokeWidth="10" strokeLinecap="round" />
        {dn   > 0 && <path d={arc(0,dnEnd)}  fill="none" stroke="#f43f5e" strokeWidth="10" opacity=".85" />}
        {side > 0 && <path d={arc(dnEnd,sdEnd)} fill="none" stroke="#f59e0b" strokeWidth="10" opacity=".65" />}
        {up   > 0 && <path d={arc(sdEnd,180)} fill="none" stroke="#10b981" strokeWidth="10" opacity=".85" />}
        <line x1={CX} y1={CY} x2={nx} y2={ny} stroke={col} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={CX} cy={CY} r="4" fill={col} />
      </svg>
      <div className="mono" style={{ fontSize:30,fontWeight:700,color:col,marginTop:-4 }}>{main}%</div>
      <div className="mono" style={{ fontSize:10,color:'#374151',marginTop:3,textTransform:'uppercase',letterSpacing:1 }}>
        {dir==='up'?'probability up':dir==='down'?'probability down':'sideways'}
      </div>
      <div style={{ width:'100%', marginTop:12, display:'flex', flexDirection:'column', gap:6 }}>
        {[['UP',up,'#10b981'],['SIDE',side,'#f59e0b'],['DOWN',dn,'#f43f5e']].map(([l,v,c])=>(
          <div key={l} style={{ display:'flex',alignItems:'center',gap:8 }}>
            <span className="mono" style={{ fontSize:9,color:c,width:28 }}>{l}</span>
            <div style={{ flex:1,height:2,background:'#1e2433',borderRadius:2 }}>
              <div style={{ height:2,width:`${v}%`,background:c,borderRadius:2,transition:'width .6s' }} />
            </div>
            <span className="mono" style={{ fontSize:9,color:'#374151',width:28,textAlign:'right' }}>{v}%</span>
          </div>
        ))}
      </div>
      <div className="mono" style={{ fontSize:10,color:'#374151',marginTop:8 }}>
        conf: <span style={{color:'#94a3b8'}}>{synthesis.confidence||0}%</span>
        {synthesis.expectedMagnitude&&<>
          {' '}·{' '}mag: <span style={{color:'#94a3b8'}}>{synthesis.expectedMagnitude}</span>
        </>}
      </div>
    </div>
  );
}

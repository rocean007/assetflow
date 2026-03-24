// Core UI primitives
const C = (s='') => `background:#0c0f1a;border:1px solid #1a2035;border-radius:8px;${s}`;
export const Card = ({children,style={}}) => <div style={{background:'#0c0f1a',border:'1px solid #1a2035',borderRadius:8,...style}}>{children}</div>;
export const P    = ({children,style={}}) => <Card style={{padding:18,...style}}>{children}</Card>;
export const Tag  = ({label,color='#475569'}) => (
  <span className="mono" style={{fontSize:10,padding:'2px 7px',borderRadius:4,
    background:color+'18',color,border:`1px solid ${color}35`}}>{label}</span>
);
export const Bar = ({v,color='#3b82f6',h=2}) => (
  <div style={{height:h,background:'#1a2035',borderRadius:h}}>
    <div style={{height:h,width:`${Math.min(100,v||0)}%`,background:color,borderRadius:h,transition:'width .5s'}}/>
  </div>
);
export const Spin = ({size=16}) => (
  <div style={{width:size,height:size,border:'2px solid #1a2035',borderTopColor:'#3b82f6',
               borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
);
export const SC = dir => dir==='up'?'#10b981':dir==='down'?'#f43f5e':'#f59e0b';
export const SS = sig => sig==='bullish'?'#10b981':sig==='bearish'?'#f43f5e':'#f59e0b';

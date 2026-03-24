import { Outlet, NavLink } from 'react-router-dom';

const NAV = [
  { to:'/',        l:'Dashboard', i:'⬡' },
  { to:'/run',     l:'New Run',   i:'▶' },
  { to:'/agents',  l:'Agents',    i:'⬢' },
  { to:'/history', l:'History',   i:'⊞' },
];

export default function Layout() {
  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',background:'#050810'}}>
      <header style={{background:'rgba(5,8,16,.96)',borderBottom:'1px solid #1a2035',
                      position:'sticky',top:0,zIndex:50,backdropFilter:'blur(8px)'}}>
        <div style={{maxWidth:1400,margin:'0 auto',padding:'0 20px',
                     display:'flex',alignItems:'center',height:50}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginRight:28}}>
            <div style={{width:26,height:26,border:'1px solid #3b82f6',borderRadius:5,
                         display:'flex',alignItems:'center',justifyContent:'center'}}>
              <span style={{color:'#3b82f6',fontSize:13}}>⬡</span>
            </div>
            <span className="mono" style={{color:'#e2e8f0',fontWeight:600,fontSize:14,letterSpacing:'-.5px'}}>AssetFlow</span>
          </div>
          <nav style={{display:'flex',gap:2,flex:1}}>
            {NAV.map(n => (
              <NavLink key={n.to} to={n.to} end={n.to==='/'}
                style={({isActive})=>({
                  display:'flex',alignItems:'center',gap:5,padding:'4px 12px',borderRadius:4,
                  textDecoration:'none',fontFamily:'JetBrains Mono,monospace',fontSize:11,
                  background:isActive?'rgba(59,130,246,.12)':'transparent',
                  color:isActive?'#3b82f6':'#475569',
                  border:isActive?'1px solid rgba(59,130,246,.25)':'1px solid transparent',
                  transition:'all .15s'})}>
                <span>{n.i}</span>{n.l}
              </NavLink>
            ))}
          </nav>
          <div className="mono" style={{fontSize:10,color:'#1a2035'}}>
            multi-agent · real-time · butterfly intelligence
          </div>
        </div>
      </header>
      <main style={{flex:1,maxWidth:1400,margin:'0 auto',padding:'24px 20px',width:'100%'}}>
        <Outlet/>
      </main>
    </div>
  );
}

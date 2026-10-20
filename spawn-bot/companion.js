// Hearthvale player companion. Token and controls key live only in Render environment variables.
// This project uses Spawn's official headless player client and does not edit Hearthvale.
const world="@jbowzer/hearthvale";
const cliPath="/app/node_modules/@spawnco/client/bin/spawn.mjs";
const key=Bun.env.CONTROL_KEY || "";
const spawnToken=Bun.env.SPAWN_TOKEN || "";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let state={phase:"starting",lastAction:null,lastError:null,lastUpdate:null,mode:"follow",active:false,lastWho:[],joinedAt:null};
let loopStarted=false,working=false,enabled=true;
async function cli(args,timeoutMs=60000){
  const proc=Bun.spawn(["bun",cliPath,"client",...args],{
    cwd:"/app",env:{...Bun.env,SPAWN_TOKEN:spawnToken},stdout:"pipe",stderr:"pipe"
  });
  const cancel=setTimeout(()=>{try{proc.kill()}catch{}},timeoutMs);
  try{
    const [stdout,stderr,exitCode]=await Promise.all([
      new Response(proc.stdout).text(),new Response(proc.stderr).text(),proc.exited
    ]);
    return {ok:exitCode===0,code:exitCode,out:(stdout+"\n"+stderr).slice(-7000)};
  }finally{clearTimeout(cancel)}
}
async function join(){
  if(!spawnToken){state.phase="missing-token";state.lastError="Missing SPAWN_TOKEN";return;}
  if(working)return;
  working=true;state.phase="joining";state.lastError=null;
  try{
    const joined=await cli(["join",world,"--ttl","14400"],85000);
    state.lastAction=joined.out.slice(-3500);
    if(!joined.ok){state.phase="join-failed";state.lastError=joined.out.slice(-800);return;}
    state.active=true;state.joinedAt=new Date().toISOString();state.phase="playing";
    await cli(["say","Hey! I'm Hearthvale Companion, an AI-controlled teammate. I'll follow along when you join."],15000);
  }catch(e){state.phase="join-error";state.lastError=String(e)}
  finally{working=false;state.lastUpdate=new Date().toISOString()}
}
async function tick(){
  if(!state.active || working || state.mode!=="follow")return;
  working=true;
  try{
    const r=await cli(["run","/app/play.js"],40000);
    state.lastAction=r.out.slice(-3500);
    state.lastUpdate=new Date().toISOString();
    if(!r.ok){
      state.lastError=r.out.slice(-1000);
      if(/no session|not joined|not found|connection refused|expired/i.test(r.out)){state.active=false;state.phase="disconnected"}
    }else state.lastError=null;
  }catch(e){state.lastError=String(e)}
  finally{working=false}
}
async function background(){
  if(loopStarted)return;loopStarted=true;
  await sleep(2000);await join();
  let previousCheck=Date.now();
  while(enabled){
    if(!working){
      if(!state.active){await join()}
      else await tick();
    }
    if(Date.now()-previousCheck>90_000 && state.active&&!working){
      const r=await cli(["where"],15000);
      if(!r.ok){state.active=false;state.phase="disconnected"}
      previousCheck=Date.now();
    }
    await sleep(14000);
  }
}
function html(){
return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Hearthvale Companion</title><style>
:root{color-scheme:dark}*{box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;margin:0;background:radial-gradient(ellipse at top,#26463e,#101e20 65%);color:#e9f2e8;min-height:100svh;padding:20px}main{max-width:700px;margin:25px auto}h1{font-size:32px;margin:0 0 5px}p{color:#b2c8bd;line-height:1.6}.panel{border:1px solid #446455;border-radius:16px;background:#182b2bea;padding:18px;margin:16px 0}.status{font-size:20px;color:#b4edb3;font-weight:700}button,input{font-size:16px;border-radius:11px;padding:13px;border:1px solid #789286}button{background:#315a45;color:white;cursor:pointer;margin:4px 5px 4px 0}button:disabled{opacity:.4}input{background:#091917;color:white;width:100%;max-width:360px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;color:#bfd0c5}a{color:#bcf2cf}.small{font-size:13px}</style></head><body><main><h1>🌲 Hearthvale Companion</h1><p>Your separate AI player in Hearthvale. It follows you using the game's normal movement system, with no cheats or world modifications.</p><div class="panel"><div id="phase" class="status">Connecting…</div><p id="desc">Checking agent status</p><div id="secure" hidden><button id="start">Join / reconnect</button><button id="stop">Leave world</button><button id="follow">Follow</button><button id="idle">Stay put</button><button id="manual">Manual</button><button id="look">Look around</button><div style="margin-top:12px"><input id="message" maxlength="180" placeholder="Say something in game chat"/><button id="say">Send chat</button></div></div><p id="lock" class="small" hidden>Open this page using the private companion link to enable controls.</p></div><div class="panel"><b>Latest activity</b><pre id="activity">No activity yet</pre><p id="error" class="small"></p></div><p><a href="https://www.spawn.co/@jbowzer/hearthvale/play">Open Hearthvale ↗</a></p></main><script>
const token=new URLSearchParams(location.hash.replace(/^#/,'' )).get('key')||sessionStorage.getItem('hearthvale-control');if(token)sessionStorage.setItem('hearthvale-control',token);
const el=id=>document.getElementById(id);el('secure').hidden=!token;el('lock').hidden=!!token;
async function req(path,data){const r=await fetch('/api/'+path,{method:data?'POST':'GET',headers:{'content-type':'application/json','x-companion-key':token||''},body:data?JSON.stringify(data):undefined,cache:'no-store'});return r.json()}
async function refresh(){try{const r=await req('status');el('phase').textContent=(r.phase||'unknown').replaceAll('-',' ');el('desc').textContent=r.active?'The AI player has joined Hearthvale. Open the game and it will look for you.':'The AI is not currently in the game.';el('activity').textContent=(r.lastAction||'No activity yet').slice(-2500);el('error').textContent=r.lastError||''}catch(e){el('phase').textContent='Service waking up';}}
for(const [id,command,body] of [['start','start',{}],['stop','stop',{}],['follow','mode',{mode:'follow'}],['idle','mode',{mode:'idle'}],['manual','mode',{mode:'manual'}],['look','action',{action:'inspect'}]]){el(id).onclick=async()=>{el(id).disabled=true;await req(command,body);await refresh();el(id).disabled=false}}
el('say').onclick=async()=>{const text=el('message').value.trim();if(!text)return;await req('say',{text});el('message').value='';await refresh()};
refresh();setInterval(refresh,12000);
</script></body></html>`;
}
const server=Bun.serve({hostname:"0.0.0.0",port:Number(Bun.env.PORT || 10000),async fetch(request){
  const url=new URL(request.url);
  if(url.pathname==="/" || url.pathname==="/index.html")return new Response(html(),{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});
  if(url.pathname==="/health")return Response.json({ok:true,phase:state.phase});
  if(url.pathname==="/api/status")return Response.json({...state,controlEnabled:!!key});
  const authorised=!!key&&request.headers.get("x-companion-key")===key;
  if(!authorised)return Response.json({ok:false,error:"unauthorised"},{status:401});
  if(request.method!=="POST")return Response.json({error:"method not allowed"},{status:405});
  let data={};try{data=await request.json()}catch{}
  if(url.pathname==="/api/start"){enabled=true;state.active=false;state.phase="reconnecting";join().catch(e=>state.lastError=String(e));return Response.json({ok:true})}
  if(url.pathname==="/api/stop"){enabled=false;state.mode="idle";state.phase="leaving";const r=await cli(["leave"],20000);state.active=false;state.phase="stopped";return Response.json(r)}
  if(url.pathname==="/api/mode"){state.mode=["idle","follow","manual"].includes(data.mode)?data.mode:"follow";return Response.json({ok:true,mode:state.mode})}
  if(url.pathname==="/api/action"){
    if(working)return Response.json({ok:false,error:"companion is busy, retry"},{status:409});
    const act=String(data.action||"");
    let args;
    if(act==="where")args=["where"];
    else if(act==="players")args=["players"];
    else if(act==="inspect")args=["run","-e","export default async (play) => ({where:await play.where(),players:await play.players(),inputs:await play.inputs(),state:await play.state()})"];
    else if(act==="script"){
      const source=String(data.source||"");
      if(source.length>5000||!source.trim().startsWith("export default async"))return Response.json({ok:false,error:"script must export default async (play) and be at most 5000 chars"},{status:400});
      args=["run","-e",source];
    }else return Response.json({ok:false,error:"action must be where, players, inspect, or script"},{status:400});
    state.mode="manual";working=true;
    try{const result=await cli(args,50000);state.lastAction=result.out;state.lastUpdate=new Date().toISOString();if(!result.ok)state.lastError=result.out.slice(-1200);else state.lastError=null;return Response.json(result)}
    catch(e){return Response.json({ok:false,error:String(e)},{status:500})}
    finally{working=false}
  }
  if(url.pathname==="/api/say"){const value=String(data.text||"").trim().slice(0,180);if(!value)return Response.json({error:"empty"},{status:400});const r=await cli(["say",value],16000);return Response.json(r)}
  return Response.json({error:"not found"},{status:404});
}});
console.log("Hearthvale companion listening on",server.port);
background().catch(e=>{state.phase="error";state.lastError=String(e)});

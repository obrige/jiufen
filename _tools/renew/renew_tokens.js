const fs=require('fs'); const path=require('path'); const https=require('https'); const http=require('http');
const crypto=require('./crypto');
const ROOT=path.resolve(__dirname,'..','..');
const CFG=JSON.parse(fs.readFileSync(path.join(__dirname,'config.json'),'utf8'));
const DATADIR=path.join(ROOT,CFG.dataDir); const ROLLFILE=path.join(__dirname, CFG.rollFile||'renew_roll.json');
const pass=process.env.RENEW_ENCRYPTION_KEY||(fs.existsSync(path.join(__dirname,'.local_key'))?fs.readFileSync(path.join(__dirname,'.local_key'),'utf8').trim():null);
if(!pass){ console.error('缺少加密口令'); process.exit(1); }
const DOMAIN=process.env.RENEW_DOMAIN;
if(!DOMAIN){ console.error('缺少 RENEW_DOMAIN'); process.exit(1); }
const API_URL='https://www.'+DOMAIN+'/api/user-auth/v1/session/renew';
const UA_MANIFEST='https://static.'+DOMAIN+'/electron/stable/latest.yml';
const key=crypto.keyFromPass(pass);
const NOW=Date.now(); const DAY=86400*1000; const keepMs=(CFG.logKeepDays||7)*DAY;
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const randInt=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
function httpsGet(url,timeout=15000){ return new Promise((resolve)=>{ const u=new URL(url); const req=(u.protocol==='https:'?https:http).get(u,{headers:{'user-agent':CFG.userAgent}},res=>{ let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(res.statusCode===200?d:'')); }); req.setTimeout(timeout,()=>{ try{req.destroy();}catch{}; resolve(''); }); req.on('error',()=>resolve('')); }); }
let LIVE_UA=null;
async function resolveUA(){
  if(LIVE_UA) return LIVE_UA;
  const ydl=await httpsGet(UA_MANIFEST);
  const v=(ydl.match(/^version:\s*(\S+)/m)||[])[1];
  LIVE_UA=v? ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ielts-app/'+v+' Chrome/146.0.7680.188 Electron/41.3.0 Safari/537.36') : CFG.userAgent;
  return LIVE_UA;
}
function listFiles(){ return fs.readdirSync(DATADIR).filter(f=>/^captured_tokens_\d+\.json\.enc$/.test(f)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})); }
function readFile(fn){ const ct=JSON.parse(fs.readFileSync(path.join(DATADIR,fn),'utf8')); return crypto.decryptJSON(ct,key); }
function writeFile(fn,arr){ const box=crypto.encryptJSON(arr,key); fs.writeFileSync(path.join(DATADIR,fn), JSON.stringify(box)); }
function loadRoll(){ try{ return JSON.parse(fs.readFileSync(ROLLFILE,'utf8')); }catch{ return {}; } }
function saveRoll(r){ fs.writeFileSync(ROLLFILE, JSON.stringify(r)); }
function decodeJwt(t){ try{ const s=t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4)s+='='; return JSON.parse(Buffer.from(s,'base64').toString('utf8')); }catch{ return null; } }
function renewOne(tok,ua){ return new Promise(resolve=>{ const body=Buffer.from('{}'); const u=new URL(API_URL); const mod=(u.protocol==='http:'?http:https);
  const req=mod.request(u,{method:'POST',headers:{'token':tok.token,'content-type':'application/json','accept':CFG.accept,'user-agent':ua,'accept-language':CFG.acceptLanguage,'host':u.host,'content-length':body.length}},res=>{ let b=''; res.on('data',c=>b+=c); res.on('end',()=>{ let p=null; try{p=JSON.parse(b);}catch{}
    if(res.statusCode===200 && p && p.code==='200' && p.data && p.data.token){ const d=decodeJwt(p.data.token); resolve({ok:true, token:p.data.token, jti:d&&d.jti, exp:d&&d.exp? new Date(d.exp*1000).toISOString():null}); }
    else resolve({ok:false, status:res.statusCode}); }); });
  req.setTimeout(15000,()=>{ try{req.destroy();}catch{}; resolve({ok:false,err:'timeout'}); }); req.write(body); req.end(); }); }
(async()=>{ const ua=await resolveUA(); console.log('[ua] '+ua); const roll=loadRoll(); const files=listFiles();
  for(const k of Object.keys(roll)){ if(!files.includes(k)||(NOW-roll[k])>keepMs) delete roll[k]; }
  const order=files.slice().sort((a,b)=>(roll[a]||0)-(roll[b]||0));
  const batch=order.slice(0, Math.min(order.length, CFG.batchFiles||6));
  const renewed=[]; let dropped=0;
  console.log('[select] files='+files.length+' batch='+batch.length);
  for(const fn of batch){ const arr=readFile(fn); let idx=0;
    const w=async()=>{ while(idx<arr.length){ const i=idx++; const tok=arr[i]; let r,ok=false;
      for(let att=0; att<=CFG.maxRetries&&!ok; att++){ r=await renewOne(tok,ua); ok=r.ok; if(!ok) await sleep(CFG.retryBackoffMs*Math.pow(2,att)+randInt(0,300)); }
      if(ok){ const d=decodeJwt(r.token); tok.token=r.token; tok.exp=r.exp; if(d&&d.jti)tok.jti=d.jti; tok.ts=new Date().toISOString(); tok.source='gh-renew'; } else tok._drop=true;
      await sleep(randInt(CFG.minDelayMs,CFG.maxDelayMs)); } };
    const ws=[]; for(let k=0;k<CFG.concurrency;k++) ws.push(w()); await Promise.all(ws);
    const kept=arr.filter(t=>!t._drop); dropped+=arr.length-kept.length; writeFile(fn,kept); roll[fn]=NOW; renewed.push(fn);
  }
  saveRoll(roll); console.log('[done] renewedFiles='+renewed.length+' ('+renewed.join(',')+') dropped='+dropped+' rollSize='+Object.keys(roll).length);
})();

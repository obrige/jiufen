const fs=require('fs'); const path=require('path'); const crypto=require('./crypto');
const ROOT=path.resolve(__dirname,'..','..');
const SRC=path.join(ROOT,'captured_tokens_split');
const pass=process.argv[2]; const OUT=process.argv[3]||path.join(ROOT,'decrypted');
if(!pass){ console.error('usage: node _tools/renew/decrypt_gh_raw.js "passphrase" [outDir]'); process.exit(1); }
const key=crypto.keyFromPass(pass);
fs.mkdirSync(OUT,{recursive:true});
const files=fs.readdirSync(SRC).filter(f=>/^captured_tokens_\d+\.json\.enc$/.test(f)).sort();
let ok=0; for(const f of files){ const ct=JSON.parse(fs.readFileSync(path.join(SRC,f),'utf8'));
  try{ const plain=crypto.decrypt(ct,key); const outname=f.replace(/\.enc$/,''); fs.writeFileSync(path.join(OUT,outname),plain); ok++; }
  catch(e){ console.error('解密失败或口令错 '+f+': '+e.message); } }
console.log('[done] 解密 '+ok+'/'+files.length+' 个文件 -> '+OUT);

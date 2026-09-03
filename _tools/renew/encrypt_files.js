const fs=require('fs'); const path=require('path'); const crypto=require('./crypto');
const ROOT=path.resolve(__dirname,'..','..');
const SRC=path.join(ROOT,'captured_tokens_split');
const BAK=path.join(ROOT,'captured_tokens_plain');
const pass=process.argv[2];
if(!pass){ console.error('missing pass arg'); process.exit(1); }
const key=crypto.keyFromPass(pass);
fs.mkdirSync(BAK,{recursive:true});
const files=fs.readdirSync(SRC).filter(f=>/^captured_tokens_\d+\.json$/.test(f));
for(const f of files){ const pt=fs.readFileSync(path.join(SRC,f),'utf8'); const ct=crypto.encrypt(pt,key);
  fs.writeFileSync(path.join(SRC,f+'.enc'), JSON.stringify(ct)); fs.writeFileSync(path.join(BAK,f),pt); fs.unlinkSync(path.join(SRC,f)); console.log('enc -> '+f); }
console.log('[done] backup in captured_tokens_plain/, enc in captured_tokens_split/*.json.enc');

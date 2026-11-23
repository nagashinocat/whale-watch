const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
for(const mode of (process.env.MODES||'old,new').split(',')){
 const p=await b.newPage({viewport:{width:1080,height:1920}});p.on('pageerror',e=>console.log('ERR',String(e)));
 await p.goto(`http://localhost:8790/compare.html?mode=${mode}&oy=${process.env.OY||30}&oy=${process.env.OY||30}&oy=${process.env.OY||30}`);await p.waitForFunction(()=>window.ready,null,{timeout:90000});
 const out=`/home/claude/promo/cmp_${mode}`;fs.mkdirSync(out,{recursive:true});
 const n=+(process.env.N||150);
 for(let k=0;k<n;k++){const url=await p.evaluate(t=>window.frame(t),k/30);fs.writeFileSync(`${out}/f${String(k).padStart(5,'0')}.jpg`,Buffer.from(url.split(',')[1],'base64'));}
 await p.close();console.log(mode,'done');}
await b.close();})();

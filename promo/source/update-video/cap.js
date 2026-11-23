// 使い方: [TRIG='式'] [SEED=0] node cap.js <出方> <クジラの番号> <はじめ秒> <おわり秒> <fps> <出力dir> [W] [H] [time]
// アプリの描画ループを止めて、自分で1こまずつ進めて描く(描くのが遅くても、なめらかな動画になる)。
// TRIG があるときは、クジラの高さ y(前のこま pv)が条件を満たした時点を 0 秒として数える
const {chromium}=require('playwright');const fs=require('fs');const {setup,attach}=require('/home/claude/check/common');
const [pat,id,from,to,fps,out,W='1080',H='1920',tm='day']=process.argv.slice(2);
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const log={console:[],pageerror:[],failed:[],blocked:[]};
 const ctx=await b.newContext({viewport:{width:+W,height:+H},locale:'ja-JP',timezoneId:'Asia/Tokyo'});
 if(process.env.SEED!=='0') await ctx.addInitScript(()=>{let s=12345;Math.random=()=>((s=Math.imul(s,1103515245)+12345>>>0)/4294967296);});
 await ctx.addInitScript(([tm])=>{localStorage.setItem('whale-ocean-settings',JSON.stringify({time:tm,camera:'near'}));localStorage.setItem('whale-ocean-tour','done');localStorage.setItem('whale-ocean-first-whale','done');localStorage.setItem('whale-ocean-hints',JSON.stringify(['tap','panel']));},[tm]);
 await setup(ctx,log);const p=await ctx.newPage();attach(p,log);
 await p.goto('http://localhost:8765/index.html?debug=1');await p.waitForTimeout(3000);
 await p.getByText('さぁ、クジラたちに会いにいこう').click().catch(()=>{});await p.waitForTimeout(6000);await p.getByText('スキップ ▶').click({timeout:15000}).catch(()=>{});await p.waitForTimeout(3000);
 await p.addStyleTag({content:'#ui, .debug, .audio-test{visibility:hidden!important} body{background:#000}'});
 if(id) await p.evaluate(v=>{const s=document.querySelector('.debug select');s.value=v;s.dispatchEvent(new Event('change'))},id);
 await p.clock.install();
 await p.evaluate(()=>{window.WHALE_OCEAN.stop();window.WHALE_OCEAN.setEco(true);});
 // 出方の終わりのタイマーは本当の時刻で動くので、撮っているあいだに切れないよう、長いものはのばしておく
 await p.evaluate(()=>{const st=window.setTimeout.bind(window);window.setTimeout=(f,d,...r)=>st(f,(d>=5000?d*100:d),...r);});
 const label=await p.evaluate(async k=>(await import('/src/logic/patterns.js')).PATTERN_LABELS[k],pat);
 await p.evaluate(l=>[...document.querySelectorAll('.debug button')].find(b=>b.textContent===l).click(),label);
 // 進める: 時計(タイマー)と、海・クジラの動きを dt 秒ずつ
 const adv=async(sec,n=1)=>{for(let i=0;i<n;i++){await p.clock.runFor(sec*1000);await p.evaluate(d=>window.WHALE_OCEAN.render(d),sec);}};
 const whaleYs=()=>p.evaluate(()=>{const r=[];window.WHALE_OCEAN.scene.traverse(x=>{if(x.isGroup&&x.children.some(c=>c.isMesh&&c.scale.x>3))r.push(x.position.y)});return r;});
 await adv(0.05,4);
 if(process.env.TRIG){
   const f=new Function('y','pv','return '+process.env.TRIG);
   let prev=await whaleYs(),t=0,hit=false;
   for(let i=0;i<1200&&!hit;i++){await adv(1/30);t+=1/30;const ys=await whaleYs();hit=ys.some((y,j)=>f(y,prev[j]??y));prev=ys;}
   console.log('trigger at',t.toFixed(2),JSON.stringify(prev));
 }
 await adv(1/30,Math.round(+from*30));
 await p.evaluate(()=>window.WHALE_OCEAN.setEco(false));
 if(process.env.HIDE) await p.evaluate(h=>{const c=window.WHALE_OCEAN.scene.children;for(const i of h.split(',').map(Number))c[i].visible=false;console.log(c.map((x,i)=>i+':'+x.type+':'+(x.material?.type||'')).join(' '));},process.env.HIDE);
 const n=Math.round((+to-+from)*(+fps));
 for(let k=0;k<n;k++){
   await p.clock.runFor(1000/(+fps));
   // 描いてすぐ、同じ処理の中でキャンバスの絵を読みとる
   const url=await p.evaluate(d=>{window.WHALE_OCEAN.render(d);return document.getElementById('sea').toDataURL('image/jpeg',0.92);},1/(+fps));
   fs.writeFileSync(`${out}/f${String(k).padStart(5,'0')}.jpg`,Buffer.from(url.split(',')[1],'base64'));
   if(process.env.PROBE){const info=await p.evaluate(()=>{const o=window.WHALE_OCEAN;const r=[];o.scene.traverse(x=>{if(x.isGroup&&x.children.some(c=>c.isMesh&&c.scale.x>3))r.push(x.position.toArray().map(v=>+v.toFixed(1)))});return r;});console.log((k/(+fps)).toFixed(2),JSON.stringify(info));}
 }
 console.log(JSON.stringify({frames:n,pageerror:log.pageerror,failed:log.failed}));
 await b.close();})();

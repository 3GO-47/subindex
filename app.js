/* SubIndex — onchain yield terminal. Independent, unaffiliated.
   Runs entirely in the reader's browser against public endpoints.
   Editorial rule: facts and method, never verdicts. Absent data is labelled
   absent, never rendered as a zero. */
'use strict';

const RPC='https://rpc.mainnet.chain.robinhood.com';
const BS ='https://robinhoodchain.blockscout.com/api/v2';
const EXP='https://robinhoodchain.blockscout.com';
const DS ='https://api.dexscreener.com';

const C={index:'0x56910d4409f3a0c78c64dd8d0545ff0705389870',
 feeHook:'0x2cd91bd228ff4c537031d6b8204782090c84c0cc',
 stockTreas:'0x1604ff11dfeaac437077aeda2fa492ac9ec804df',
 distributor:'0x39adb8acd07427d338b5f1afab436a04abfdb7c4',
 lpLock:'0x889069bd282f1c1c66cb853e10627595c28e71e2',
 poolManager:'0x8366a39cc670b4001a1121b8f6a443a643e40951',
 idxFactory:'0x0148698731f87900073bb6e94af1624dff5e78fb',
 keeper:'0x179a1513adc677042654d904a0fb051577f67c4a',
 stockFactory:'0x4783c67b63de2b358ac5951a7d41f47a38f3c046',
 weth:'0x0bd7d308f8e1639fab988df18a8011f41eacad73',
 initT0:'0xdd466e674ea557f56295e2d0218a125ea4b4f0f6f3307b95f85e6110838d6438'};
const ZERO='0x0000000000000000000000000000000000000000';
const QUOTES=new Set([ZERO,C.weth]);
const RAILS={NVDA:'0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec',AAPL:'0xaf3d76f1834a1d425780943c99ea8a608f8a93f9',
 TSLA:'0x322f0929c4625ed5bad873c95208d54e1c003b2d',MSFT:'0xe93237c50d904957cf27e7b1133b510c669c2e74',
 GOOGL:'0x2e0847e8910a9732eb3fb1bb4b70a580adad4fe3',AMZN:'0x12f190a9f9d7d37a250758b26824b97ce941bf54',
 META:'0xc0d6457c16cc70d6790dd43521c899c87ce02f35',AMD:'0x86923f96303d656e4aa86d9d42d1e57ad2023fdc',
 MU:'0xff080c8ce2e5feadaca0da81314ae59d232d4afd',INTC:'0xc72b96e0e48ecd4dc75e1e45396e26300bc39681',
 ORCL:'0xb0992820e760d836549ba69bc7598b4af75dee03',PLTR:'0x894e1ec2d74ffe5aef8dc8a9e84686accb964f2a',
 COIN:'0x6330d8c3178a418788df01a47479c0ce7ccf450b',CRWV:'0x5f10a1c971b69e47e059e1dc91901b59b3fb49c3',
 SNDK:'0xb90a19ff0af67f7779aff50a882a9cff42446400',SPCX:'0x4a0e65a3eccec6dbe60ae065f2e7bb85fae35eea',
 USAR:'0xd917b029c761d264c6a312bbbcda868658ef86a6',BE:'0x822cc93ffd030293e9842c30bbd678f530701867'};
const SYMBY={};Object.entries(RAILS).forEach(([k,v])=>SYMBY[v]=k);

/* ── plumbing ── */
const jf=async(u,o)=>{const r=await fetch(u,o);if(!r.ok)throw new Error(r.status);return r.json()};
/* EVERY network call is time-boxed. The one call that wasn't (rpc) hung boot at
   "connecting…" with no error and no timeout — a single un-timed await upstream
   of the render is a whole-page outage. */
const withTimeout=(p,ms)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),ms||9000))]);
const rpc=async(m,p)=>{const r=await withTimeout(jf(RPC,{method:'POST',headers:{'Content-Type':'application/json'},
 body:JSON.stringify({jsonrpc:'2.0',id:1,method:m,params:p})}),9000);
 if(r.error)throw new Error(r.error.message);return r.result};
const call=(to,data)=>rpc('eth_call',[{to,data},'latest']);
const bs=p=>withTimeout(jf(BS+p),9000);
const hx=h=>(!h||h==='0x')?null:parseInt(h,16);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const $=s=>document.querySelector(s);
const esc=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const m$=v=>v==null?'—':Math.abs(v)>=1e6?'$'+(v/1e6).toFixed(2)+'M':Math.abs(v)>=1e3?'$'+(v/1e3).toFixed(1)+'k':'$'+(+v).toFixed(2);
const f$=v=>v==null?'—':v>=1?'$'+v.toFixed(2):v>=0.01?'$'+v.toFixed(4):'$'+(+v).toFixed(6);
const px$=v=>v==null?'—':v>=1?'$'+v.toFixed(4):'$'+(+v).toPrecision(3);
const ep=s=>!s?'—':s<3600?(s/60)+'m':s<86400?(s/3600)+'h':(s/86400)+'d';
const ago=sec=>{if(!sec)return '—';const m=(Date.now()/1000-sec)/60;
 return m<60?Math.round(m)+'m':m<1440?(m/60).toFixed(1)+'h':(m/1440).toFixed(1)+'d'};
const agoMs=ms=>{if(!ms)return '—';const m=(Date.now()-ms)/60000;
 return m<60?Math.round(m)+'m':m<1440?(m/60).toFixed(1)+'h':(m/1440).toFixed(1)+'d'};
const sh=a=>a?a.slice(0,6)+'…'+a.slice(-4):'—';
const lnk=(a,k)=>EXP+'/'+(k||'address')+'/'+a;
const num=n=>n==null?'—':(+n).toLocaleString();
/* ── every timestamp on this site is US Eastern. Using the IANA zone rather than
   a fixed offset means DST is correct without us thinking about it (right now
   that is EDT, UTC-4 — a hardcoded -5 would be an hour wrong all summer). ── */
const ET_T={timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hour12:false};
const ET_DT={timeZone:'America/New_York',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false};
const ET_FULL={timeZone:'America/New_York',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false};
const etT=ms=>ms?new Date(ms).toLocaleTimeString('en-US',ET_T):'—';
const etDT=ms=>ms?new Date(ms).toLocaleString('en-US',ET_DT).replace(',',''):'—';
const etFull=ms=>ms?new Date(ms).toLocaleString('en-US',ET_FULL).replace(',',''):'—';
const etZone=()=>{try{const n=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',timeZoneName:'short'})
 .formatToParts(new Date()).find(p=>p.type==='timeZoneName');return n?n.value:'ET'}catch(e){return 'ET'}};
/* Company logos. Measured which hosts actually serve cross-origin (Rialto's CDN
   and Clearbit both refuse): nvstly's icon set and FMP's image-stock both load.
   Strategy = real logo first, generated brand tile behind it, so a missing
   ticker degrades to a coloured initial instead of a broken image. */
const BRAND={NVDA:'#76b900',AAPL:'#2b2b2d',MSFT:'#00a4ef',GOOGL:'#4285f4',AMZN:'#ff9900',
 META:'#0866ff',TSLA:'#cc0000',AMD:'#ed1c24',MU:'#0060a9',INTC:'#0068b5',ORCL:'#f80000',
 PLTR:'#1b1b1f',COIN:'#0052ff',CRWV:'#2f3136',SNDK:'#d5001c',SPCX:'#005288',USAR:'#a9791f',
 BE:'#0a6b3d',SPY:'#1b5faa',QQQ:'#4d3fa3',GME:'#e31837',TSM:'#c8102e',MSTR:'#f37021',
 NFLX:'#e50914',COST:'#005daa',ASTS:'#1f4e79',CRCL:'#3b6ef5',LITE:'#5b7c99',AMAT:'#0071c5',
 BABA:'#ff6a00',RDDT:'#ff4500',SMCI:'#5a6b7b',ZM:'#2d8cff',XOM:'#e01b22',ETH:'#627eea',
 COOP:'#3f6f52',TITN:'#8a5a2b'};
const shade=t=>{let h=0;for(let i=0;i<t.length;i++)h=(h*31+t.charCodeAt(i))|0;
 return 'hsl('+(Math.abs(h)%360)+',34%,42%)'};
const LG_A=t=>'https://financialmodelingprep.com/image-stock/'+t+'.png';
const LG_B=t=>'https://raw.githubusercontent.com/nvstly/icons/main/ticker_icons/'+t+'.png';
const LOGO=(sym,big)=>{const t=String(sym||'').toUpperCase();
 if(!/^[A-Z]{1,6}$/.test(t))return '';
 const c=BRAND[t]||shade(t);
 /* layered: tile paints immediately, the real logo covers it once decoded, and
    a second host is tried before we give up and leave the tile showing */
 return `<span class="lg${big?' b':''}" style="background:${c}">${t[0]}`+
  `<img src="${LG_A(t)}" alt="" `+
  `onload="this.style.opacity=1" onerror="if(!this.dataset.r){this.dataset.r=1;this.src='${LG_B(t)}'}else{this.remove()}">`+
  `</span>`};
/* "/ 01 / LABEL" eyebrow, lifted from their KPI cards */
const EYE=(n,l)=>`<div class="eye">/ ${String(n).padStart(2,'0')} / &nbsp;${l}</div>`;
/* vertical bar sparkline, their KPI-card visual */
const SPARK=(vals,cls)=>{const mx=Math.max(1,...vals);
 return `<div class="spark ${cls||''}">${vals.map(v=>`<i style="height:${Math.max(6,Math.round(100*v/mx))}%"></i>`).join('')}</div>`};

/* ── ERC-20 symbols over RPC ── */
const strRet=h=>{try{const len=parseInt(h.slice(66,130),16);let s='';
 for(let i=0;i<len*2;i+=2)s+=String.fromCharCode(parseInt(h.slice(130+i,132+i),16));
 return s.replace(/\0/g,'')}catch(e){return null}};
const META={};
async function meta(a){if(!a)return null;if(META[a])return META[a];
 let sym=SYMBY[a]||null;
 try{if(!sym)sym=strRet(await call(a,'0x95d89b41'))}catch(e){}
 return META[a]={sym:sym||sh(a)}}
const symOf=a=>a===ZERO?'ETH':(META[a]&&META[a].sym)||SYMBY[a]||sh(a);

/* ── state ── */
const S={tre:[],px:{},pools:[],keeper:null,holders:{},dist:[],block:null,snapAge:null,
 sort:{k:'rounds',dir:-1},filt:{q:'',payers:false,migrated:false,full:false,direct:false,held:false,curve:false},w:null};

/* ── registry snapshot (see METHOD tab for why this is a snapshot) ── */
async function loadRegistry(){
 const d=await jf('protocols.json?t='+Date.now());
 S.snapAge=d.source_generated?(Date.now()-Date.parse(d.source_generated))/60000:null;
 S.keeperSnap=d.keeper||{};
 return (d.coins||[]).map(c=>{let basket=[];
  try{basket=JSON.parse(c.basket||'[]').map(([a,w])=>[String(a).toLowerCase(),w])}catch(e){}
  /* COERCE AT THE BOUNDARY: the GraphQL source returns unix timestamps as
     STRINGS, so `boundAt + epochLength` string-concatenated and produced a
     countdown ~56,000 years long. Force numerics to numbers exactly once,
     here, rather than trusting every call site to remember. */
  const nz=v=>(v==null||v==='')?null:(isFinite(+v)?+v:null);
  return{treasury:(c.treasury||'').toLowerCase(),coin:c.coin?String(c.coin).toLowerCase():null,
   sym:c.sym,name:c.name,basket,bps:nz(c.distribute_bps),epochLength:nz(c.epoch_sec),creator:c.creator,
   rounds:nz(c.rounds_n)||0,lastRound:nz(c.last_round),next:nz(c.next_payout),
   boundAt:nz(c.bound_at),deployedAt:nz(c.deployed_at)}});
}
async function prices(addrs){
 const px={};const list=[...new Set(addrs.filter(Boolean))];
 for(let i=0;i<list.length;i+=28){
  const b=list.slice(i,i+28);
  try{const ps=await jf(DS+'/tokens/v1/robinhood/'+b.join(','));
   (ps||[]).forEach(p=>{const a=((p.baseToken||{}).address||'').toLowerCase();if(!a)return;
    const liq=((p.liquidity||{}).usd)||0;if(px[a]&&px[a].liq>=liq)return;
    px[a]={px:+p.priceUsd||null,liq,mc:+(p.marketCap||p.fdv)||null,vol:((p.volume||{}).h24)||0,
     ch24:(p.priceChange||{}).h24,quote:((p.quoteToken||{}).symbol)||null,sym:((p.baseToken||{}).symbol)||null}})
  }catch(e){}
 }
 return px;
}
async function keeperState(){
 const o={addr:C.keeper};
 try{o.gas=hx(await rpc('eth_getBalance',[C.keeper,'latest']))/1e18}catch(e){}
 if(o.gas==null&&S.keeperSnap&&S.keeperSnap.gas_eth!=null)o.gas=S.keeperSnap.gas_eth;
 /* one page of keeper txs spans seconds (the keeper works in bursts), which is
    too narrow to derive a rate from — so the throughput panel sat at '—'.
    Three pages ≈ 150 calls spans several bursts and gives tpm a real window. */
 try{const it=await bsPages('/addresses/'+C.keeper+'/transactions',3,150);
  o.last=it[0]?Date.parse(it[0].timestamp):null;
  o.recent=it.slice(0,60).map(t=>({ts:t.timestamp,method:t.method||'—',
   to:((t.to||{}).hash||'').toLowerCase(),name:(t.to||{}).name||null,ok:t.status==='ok'}));
  const mm={};it.forEach(t=>{const m=t.method||'—';mm[m]=(mm[m]||0)+1});
  o.methods=mm;o.claims=mm.claimProtocol||0;
  const ts=it.map(t=>Date.parse(t.timestamp)).sort((a,b)=>b-a);const g=[];
  for(let i=0;i<ts.length-1;i++){const d=(ts[i]-ts[i+1])/60000;if(d>1)g.push(d)}
  g.sort((a,b)=>a-b);o.cadence=g.length?g[g.length>>1]:null;
 }catch(e){}
 return o;
}
async function loadPools(blocks){
 const bn=hx(await rpc('eth_blockNumber',[]));S.block=bn;
 const from=Math.max(0,bn-(blocks||90000)),STEP=40000,out=[];
 for(let b=from;b<=bn;b+=STEP){const to=Math.min(b+STEP-1,bn);
  try{const logs=await rpc('eth_getLogs',[{fromBlock:'0x'+b.toString(16),toBlock:'0x'+to.toString(16),
   address:C.poolManager,topics:[C.initT0]}]);
   logs.forEach(l=>{const t=l.topics||[];if(t.length<4)return;
    const c0='0x'+t[2].slice(26).toLowerCase(),c1='0x'+t[3].slice(26).toLowerCase();
    out.push({token:QUOTES.has(c0)?c1:(QUOTES.has(c1)?c0:c1),quote:QUOTES.has(c0)?c0:c1,block:hx(l.blockNumber)})})
  }catch(e){}
 }
 return out;
}
/* distribution feed: outbound stock transfers from the busiest treasuries */
async function loadDistributions(tre){
 const top=tre.filter(t=>t.rounds>0).sort((a,b)=>b.rounds-a.rounds).slice(0,8);
 const out=[];
 let done=0;
 const note=el=>{const e=document.getElementById('areaWrap');
  if(e&&!e.querySelector('svg'))e.innerHTML='<div class="spin">reading payout history — '+el+' of '+top.length+' treasuries ('+out.length+' payouts so far)</div>'};
 for(const t of top){
  note(done);
  try{const r=await bs('/addresses/'+t.treasury+'/token-transfers?filter=from&type=ERC-20');
   (r.items||[]).slice(0,50).forEach(x=>{
    const tk=x.token||{},dec=+(tk.decimals||18);
    out.push({src:t.sym||sh(t.treasury),srcTre:t.treasury,
     asset:tk.symbol||sh((tk.address_hash||'').toLowerCase()),
     assetAddr:(tk.address_hash||'').toLowerCase(),
     amt:parseFloat((x.total||{}).value||'0')/Math.pow(10,dec),
     to:((x.to||{}).hash||'').toLowerCase(),ts:Date.parse(x.timestamp)})})
  }catch(e){}
  done++;
  await sleep(420);
 }
 return out.sort((a,b)=>b.ts-a.ts);
}

/* Blockscout paginates at 50 items. One page of this wallet's transfers covered
   about TWO HOURS — every dividend older than that was invisible, which is
   exactly the under-reporting bug. Follow next_page_params instead, politely,
   with a hard page cap so a busy wallet cannot spin forever. */
async function bsPages(path,maxPages,cap){
 const out=[];let np=null;
 for(let i=0;i<(maxPages||8);i++){
  const q=np?('&'+Object.entries(np).filter(([,v])=>v!=null)
   .map(([k,v])=>k+'='+encodeURIComponent(typeof v==='boolean'?(v?'true':'false'):String(v))).join('&')):'';
  let r;
  try{r=await bs(path+q)}catch(e){break}
  const it=(r&&r.items)||[];
  out.push(...it);
  np=r&&r.next_page_params;
  if(!np||!it.length||(cap&&out.length>=cap))break;
  await sleep(320);
 }
 return out;
}
/* ══ WALLET — read-only. Never requests a signature or a transaction. ══ */
async function walletLoad(addr){
 const w={addr,divs:[],hold:[],bySrc:{},byAsset:{},total:0};
 const treBy={};S.tre.forEach(t=>{if(t.treasury)treBy[t.treasury]=t});
 const [bal,tfItems]=await Promise.all([
  bs('/addresses/'+addr+'/token-balances').catch(()=>null),
  bsPages('/addresses/'+addr+'/token-transfers?type=ERC-20&filter=to',10,500).catch(()=>[])]);
 const tf={items:tfItems};
 w.pagesRead=Math.ceil(tfItems.length/50);w.transfersScanned=tfItems.length;
 (bal||[]).forEach(b=>{const t=b.token||{};const a=(t.address_hash||'').toLowerCase();
  const dec=+(t.decimals||18);const amt=parseFloat(b.value||'0')/Math.pow(10,dec);
  if(amt<=0)return;w.hold.push({addr:a,sym:t.symbol||sh(a),amt})});
 const RAILSET=new Set(Object.values(RAILS));
 let unlabelled=0;
 (((tf||{}).items)||[]).forEach(x=>{
  const t=x.token||{},dec=+(t.decimals||18);
  const from=((x.from||{}).hash||'').toLowerCase();
  const asset0=(t.address_hash||'').toLowerCase();
  let src=from===C.distributor||from===C.stockTreas?'$INDEX'
   :(treBy[from]?(treBy[from].sym||sh(from)):null);
  /* A treasury created after our registry snapshot would have been dropped
     silently, under-reporting the total. If the sender is a contract paying a
     canonical reward asset, count it and SAY it is unidentified rather than
     pretending it did not happen. */
  if(!src&&RAILSET.has(asset0)&&((x.from||{}).is_contract)){src='treasury '+from.slice(0,8)+'…';unlabelled++}
  if(!src)return;                                   /* genuinely not a distribution: a buy, a transfer, a mint */
  const asset=(t.address_hash||'').toLowerCase();
  w.divs.push({src,from,asset,sym:t.symbol||symOf(asset),
   amt:parseFloat((x.total||{}).value||'0')/Math.pow(10,dec),ts:Date.parse(x.timestamp)})});
 w.divs.sort((a,b)=>b.ts-a.ts);
 /* price every asset we saw, then value it */
 const need=[...new Set([...w.divs.map(d=>d.asset),...w.hold.map(h=>h.addr)])];
 Object.assign(S.px,await prices(need));
 w.divs.forEach(d=>{const p=(S.px[d.asset]||{}).px;d.usd=p?d.amt*p:null;
  if(d.usd){w.total+=d.usd;
   w.bySrc[d.src]=(w.bySrc[d.src]||0)+d.usd;
   w.byAsset[d.sym]=(w.byAsset[d.sym]||0)+d.usd}});
 w.first=w.divs.length?w.divs[w.divs.length-1].ts:null;
 w.unlabelled=unlabelled;
 return w;
}
const SI={
 async connect(){
  const eth=window.ethereum;
  if(!eth){$('#wWho').innerHTML='<span class="am">no browser wallet detected — paste an address instead (watch-only works the same)</span>';return}
  try{
   const acc=await eth.request({method:'eth_requestAccounts'});   /* address only. nothing else is ever requested. */
   if(acc&&acc[0])SI.track(acc[0].toLowerCase(),'wallet');
  }catch(e){$('#wWho').innerHTML='<span class="am">connection declined</span>'}
 },
 watch(){const v=($('#wAddr').value||'').trim().toLowerCase();
  if(!/^0x[0-9a-f]{40}$/.test(v)){$('#wWho').innerHTML='<span class="dn">that does not look like an address</span>';return}
  SI.track(v,'watch')},
 async track(addr,mode){
  try{localStorage.setItem('si_w',addr)}catch(e){}
  $('#wAddr').value=addr;
  $('#wWho').innerHTML='<span class="di">reading '+sh(addr)+' — read-only…</span>';
  try{
   S.w=await walletLoad(addr);S.w.mode=mode;
   renderWallet();renderProt();
   $('#wWho').innerHTML='<b class="up">'+sh(addr)+'</b> <span class="di">· '+(mode==='wallet'?'connected':'watch-only')+' · read-only</span>';
  }catch(e){$('#wWho').innerHTML='<span class="dn">lookup failed — the explorer may be rate-limiting; try again shortly</span>'}
 },
 clearW(){S.w=null;try{localStorage.removeItem('si_w')}catch(e){}
  S.filt.held=false;   /* otherwise the ledger silently filters on a wallet that is gone */
  $('#wAddr').value='';$('#wWho').textContent='';$('#wBody').style.display='none';$('#wEmpty').style.display='';
  const wp=$('#wPanel');if(wp)wp.classList.add('grow');try{renderWEmpty()}catch(e){}

  renderProt();try{renderOver()}catch(e){}},
 filter(v){S.filt.q=(v||'').toLowerCase();renderProt();try{renderOver()}catch(e){}},
 toggle(k){
  S.filt[k]=!S.filt[k];
  /* CURVE and MIGRATED are mutually exclusive — turning one on clears the other
     instead of silently producing an empty table */
  /* CURVE means "no external pair"; DIRECT and MIGRATED both require one. Any
     combination of them is an empty set by definition, so switch, don't stack. */
  if(k==='curve'&&S.filt.curve){S.filt.migrated=false;S.filt.direct=false}
  if((k==='migrated'||k==='direct')&&S.filt[k])S.filt.curve=false;
  const btn=FBTN[k];
  if(btn&&$(btn))$(btn).classList.toggle('gh',!S.filt[k]);
  /* the exclusion above may have switched the OTHER one off — reflect that too */
  ['curve','migrated','direct'].forEach(o=>{if($(FBTN[o]))$(FBTN[o]).classList.toggle('gh',!S.filt[o])});
  renderProt();try{renderOver()}catch(e){}
 },
 clearF(){TAGS.forEach(t=>S.filt[t.k]=false);S.filt.q='';
  const qi=$('#q');if(qi)qi.value='';
  Object.values(FBTN).forEach(b2=>{if($(b2))$(b2).classList.add('gh')});
  renderProt();try{renderOver()}catch(e){}},
 /* share the CURRENT measured state, not a slogan — the numbers are the pitch */
 share(){
  const live=S.tre.filter(t=>t.coin),payers=live.filter(t=>t.rounds>0).length;
  const rounds=live.reduce((a,t)=>a+(t.rounds||0),0);
  const t=S.tre.find(x=>x.sym==='SUBINDEX');
  const txt=[
   'Robinhood Chain distribution protocols, live:',
   '',
   live.length+' coins paying tokenized stock to holders · '+payers+' with a finalized round',
   rounds.toLocaleString()+' payout rounds executed on chain',
   'every payout clock, keeper liveness + wallet dividend tracking:',
  ].join('\n');
  window.open('https://x.com/intent/tweet?text='+encodeURIComponent(txt)+'&url='+encodeURIComponent(location.origin+location.pathname),'_blank');
 },
 theme(){
  const cur=document.documentElement.getAttribute('data-theme')==='dark'?'dark':'light';
  const nx=cur==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',nx);
  try{localStorage.setItem('si_theme',nx)}catch(e){}
  const b=document.getElementById('thBtn');if(b)b.textContent=nx==='dark'?'☀':'◐';
 },
 sort(k){if(S.sort.k===k)S.sort.dir*=-1;else S.sort={k,dir:-1};renderProt()},
};
window.SI=SI;

/* ══ drawing ═════════════════════════════════════════════════════════════════
   Hand-rolled SVG. No chart library: this page must stay one file with no
   third-party script, and every mark here is trivial geometry. */
/* ── distribution chart ──────────────────────────────────────────────────────
   The old version plotted a cumulative line against payout ORDINAL, which made
   the x-axis meaningless (payment #1..#56 is not time) and hid the thing that
   actually matters: WHEN value moves and how much per interval. This replaces it
   with a proper time-bucketed column chart — value distributed per bucket, real
   money y-axis, Eastern-time x-axis, a cumulative overlay on its own right-hand
   scale, and per-bucket hover. Buckets auto-size to the observed span so a
   two-hour window and a two-day window both read correctly. */
/* ── distribution chart, stacked by paying protocol ──────────────────────────
   Columns are time buckets; each column is segmented by which protocol paid, so
   a glance answers "is this ecosystem distributing, or is one coin carrying it?"
   Cumulative total rides its own right-hand axis. Buckets auto-size to span. */
/* Identity colors. One hue per PROTOCOL, stable across every pane and both
   themes, assigned by name hash so it never depends on today's ranking. The
   palette is picked for distinguishability on white AND on #151a1f. */
const IDPAL=['#4a72a8','#c07a3a','#3f9b6e','#b0568a','#7a68c0','#c8a03a','#4aa3b8','#c05a50',
             '#6b8f3d','#9c6bb8','#3d7fc0','#b8845c','#488f85','#b04a6e','#8a7a2f','#5a7ab8'];
const idcol=sym=>{const t=String(sym||'?').toUpperCase();let h2=0;
 for(let i=0;i<t.length;i++)h2=(h2*33+t.charCodeAt(i))|0;
 return IDPAL[Math.abs(h2)%IDPAL.length]};
/* the stacked chart uses the same identity colors now */
const pcolOf=(s2,order)=>idcol(s2);
function distChart(pts,w,h,unit){
 /* unit lets the same chart plot payout COUNTS when the assets involved have
    no price feed — better than an empty panel or a fake $0. */
 const U=unit==='n'?(v=>num(Math.round(v))):m$;
 if(!pts||pts.length<2)return '<div class="spin">not enough dated payouts yet to plot</div>';
 /* If every point shares one bucket there is no time axis to draw — a single
    full-width slab looks like a rendering fault. Say what actually happened. */
 {const ta=pts.map(p=>p.t),lo=Math.min(...ta),hi=Math.max(...ta);
  if(hi-lo<60000){
   const by={};pts.forEach(p=>{by[p.src]=(by[p.src]||0)+p.v});
   const top=Object.entries(by).sort((x,y)=>y[1]-x[1]).slice(0,8);
   return `<div class="burst"><div class="bh">All ${num(pts.length)} landed inside one minute —
     a single burst at <b>${etFull(lo)} ${etZone()}</b></div>
     <div class="bl">${top.map(([k2,v2])=>`<span class="fnode">${esc(k2)} <b>${unit==='n'?num(v2):m$(v2)}</b></span>`).join('')}
     ${Object.keys(by).length>8?`<span class="dx">+${Object.keys(by).length-8} more assets</span>`:''}</div>
     <div class="dx" style="margin-top:7px;line-height:1.55">This is how the keeper works: it does nothing for a
     while, then clears a whole Merkle round one transaction per holder. A time chart appears here as soon as
     the sample spans more than a minute.</div></div>`;}}
 const t0=Math.min(...pts.map(p=>p.t)),t1=Math.max(...pts.map(p=>p.t));
 const spanMin=Math.max(1,(t1-t0)/60000);
 const stepMin=spanMin<=60?5:spanMin<=240?15:spanMin<=1440?60:180;
 const stepMs=stepMin*60000,b0=Math.floor(t0/stepMs)*stepMs;
 const nb=Math.max(2,Math.min(60,Math.ceil((t1-b0)/stepMs)+1));
 /* protocol totals decide legend order and colour assignment */
 const tot={};pts.forEach(p=>{tot[p.src]=(tot[p.src]||0)+p.v});
 const order=Object.keys(tot).sort((a,b)=>tot[b]-tot[a]);
 const buk=new Array(nb).fill(0).map(()=>({v:0,n:0,by:{}}));
 pts.forEach(p=>{const i=Math.min(nb-1,Math.floor((p.t-b0)/stepMs));
  buk[i].v+=p.v;buk[i].n++;buk[i].by[p.src]=(buk[i].by[p.src]||0)+p.v});
 let run=0;const cum=buk.map(b=>run+=b.v);
 const P={l:54,r:48,t:10,b:20},iw=w-P.l-P.r,ih=h-P.t-P.b;
 const mx=Math.max(...buk.map(b=>b.v))||1,cmx=cum[cum.length-1]||1,bw=iw/nb;
 const Y=v=>P.t+ih-(v/mx)*ih, YC=v=>P.t+ih-(v/cmx)*ih;
 const money=v=>v>=1?'$'+v.toFixed(0):v>=0.01?'$'+v.toFixed(2):'$'+v.toFixed(4);
 let g='';
 [0,.5,1].forEach(f=>{const y=P.t+ih-ih*f;
  g+=`<line class="gl" x1="${P.l}" y1="${y.toFixed(1)}" x2="${w-P.r}" y2="${y.toFixed(1)}"/>`
   +`<text class="ax" x="${P.l-6}" y="${(y+3).toFixed(1)}" text-anchor="end">${U(mx*f)}</text>`
   +`<text class="ax cu" x="${w-P.r+6}" y="${(y+3).toFixed(1)}">${U(cmx*f)}</text>`});
 /* stacked segments, largest payer at the base */
 buk.forEach((b,i)=>{
  if(b.v<=0)return;
  let acc=0;
  const x=P.l+i*bw+bw*0.16, bwid=bw*0.68;
  const tipRows=order.filter(s2=>b.by[s2]).map(s2=>s2+' '+money(b.by[s2])).join(' · ');
  order.forEach(s2=>{const v=b.by[s2];if(!v)return;
   const y0=Y(acc+v),y1=Y(acc),hh=Math.max(0.8,y1-y0);
   g+=`<rect class="cb" x="${x.toFixed(1)}" y="${y0.toFixed(1)}" width="${bwid.toFixed(1)}" height="${hh.toFixed(1)}" fill="${pcolOf(s2,order)}">`
    +`<title>${etDT(b0+i*stepMs)} ${etZone()} · ${money(b.v)} across ${b.n} payouts\n${tipRows}</title></rect>`;
   acc+=v});
 });
 g+=`<path class="cl" d="M${cum.map((v,i)=>(P.l+i*bw+bw/2).toFixed(1)+','+YC(v).toFixed(1)).join(' L')}"/>`;
 [0,Math.floor(nb/2),nb-1].forEach((i,k)=>{const x=P.l+i*bw+bw/2;
  g+=`<text class="ax" x="${x.toFixed(1)}" y="${h-6}" text-anchor="${k===0?'start':k===2?'end':'middle'}">${etT(b0+i*stepMs)}</text>`});
 g+=`<line class="gl" x1="${P.l}" y1="${P.t+ih}" x2="${w-P.r}" y2="${P.t+ih}"/>`;
 const share=s2=>Math.round(100*tot[s2]/Object.values(tot).reduce((a,b)=>a+b,0));
 return `<svg class="chart" viewBox="0 0 ${w} ${h}" style="height:${h}px">${g}</svg>
  <div class="clg">${order.slice(0,8).map(s2=>`<span title="${money(tot[s2])} distributed">
   <i class="sw" style="background:${pcolOf(s2,order)}"></i>${esc(s2)} <span class="dx">${share(s2)}%</span></span>`).join('')}
   <span><i class="sw l"></i>cumulative</span>
   <span class="dx">per ${stepMin<60?stepMin+' min':(stepMin/60)+' h'} · ${pts.length} payouts · ${etT(t0)}–${etT(t1)} ${etZone()}</span></div>`;
}
function donut(parts,size){
 const tot=parts.reduce((a,p)=>a+p.v,0)||1,R=size/2,r=R*0.62;let a0=-Math.PI/2,out='';
 const COL=['#4a72a8','#a9c0de','#2f4f7a','#c5c4bc','#6b8fbf','#8aa8cc','#dcdad3'];
 parts.forEach((p,i)=>{const a1=a0+(p.v/tot)*Math.PI*2;
  const x0=R+R*Math.cos(a0),y0=R+R*Math.sin(a0),x1=R+R*Math.cos(a1),y1=R+R*Math.sin(a1);
  const xi1=R+r*Math.cos(a1),yi1=R+r*Math.sin(a1),xi0=R+r*Math.cos(a0),yi0=R+r*Math.sin(a0);
  const big=(a1-a0)>Math.PI?1:0;
  out+=`<path d="M${x0.toFixed(1)},${y0.toFixed(1)} A${R},${R} 0 ${big} 1 ${x1.toFixed(1)},${y1.toFixed(1)} L${xi1.toFixed(1)},${yi1.toFixed(1)} A${r},${r} 0 ${big} 0 ${xi0.toFixed(1)},${yi0.toFixed(1)} Z" fill="${COL[i%COL.length]}"><title>${esc(p.k)} ${(100*p.v/tot).toFixed(0)}%</title></path>`;
  a0=a1});
 return `<svg class="donut" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${out}</svg>`;
}
const skel=n=>'<div class="pb">'+new Array(n||4).fill(0).map((_,i)=>`<div class="sk" style="width:${92-i*11}%"></div>`).join('')+'</div>';
function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('on');
 clearTimeout(toast._t);toast._t=setTimeout(()=>el.classList.remove('on'),1800)}
window.copyTxt=async t=>{try{await navigator.clipboard.writeText(t);toast('copied '+(t.length>18?t.slice(0,10)+'…':t))}
 catch(e){toast('copy blocked by the browser')}};

/* ══ protocol drawer: one click gives the whole picture for a protocol ══ */
SI.openD=async function(tre){
 const r=rowsOf().find(x=>x.treasury===tre)||S.tre.find(x=>x.treasury===tre);
 if(!r)return;
 $('#scrim').classList.add('on');$('#drawer').classList.add('on');
 const h=S.holders[r.coin]||{};
 const nx=r.nextT||((r.lastRound&&r.epochLength)?r.lastRound+r.epochLength:null);
 const parts=(r.basket||[]).map(([a,w])=>({k:symOf(a),v:w}));
 const kv=(k,v)=>`<div class="kv"><span>${k}</span><b>${v}</b></div>`;
 $('#drawerBody').innerHTML=`
  <div class="dh"><h3>${LOGO(r.sym)}${esc(r.sym||sh(r.coin))}${pairTag(r)}${badge(r,1)}</h3>
   <button class="dx2" onclick="SI.closeD()">✕</button>
   <div class="eye" style="margin-top:5px">/ ${(r.rounds||0)>0?'VERIFIED PAYER':'NO ROUNDS YET'} / &nbsp;${r.name?esc(r.name):'fee-treasury protocol'}</div></div>
  <div style="display:flex;gap:14px;align-items:center;padding:14px 16px;border-bottom:1px solid var(--hair)">
   ${parts.length?donut(parts,96):''}
   <div style="flex:1;min-width:0">
    <div class="eye">/ PAYS ITS HOLDERS</div>
    <div style="margin-top:6px">${bskHtml(r)}</div>
    <div class="s" style="margin-top:8px;color:var(--mut);font-size:10.5px">every ${ep(r.epochLength)}, funded by this coin's own trading fees</div>
   </div></div>
  ${kv('Next payout',nx?`<span data-cd="${nx}">…</span>`:'—')}
  ${kv('Rounds executed',r.rounds||0)}
  ${kv('Split — holders / creator',r.bps!=null?`<span class="${r.bps===10000?'up':''}">${(r.bps/100).toFixed(0)}% / ${(100-r.bps/100).toFixed(0)}%</span>`:'—')}
  ${kv('Price',r.mkt?px$(r.mkt.px):'<span class="dx">on the bonding curve</span>')}
  ${kv('Market cap',r.mkt?m$(r.mkt.mc):'—')}
  ${kv('Liquidity',r.mkt?m$(r.mkt.liq):'—')}
  ${kv('Volume 24h',r.mkt?m$(r.mkt.vol):'—')}
  ${kv('Paired against',r.mkt&&r.mkt.quote?esc(r.mkt.quote):'—')}
  ${kv('Holders',h.n!=null?num(h.n):'…')}
  ${kv('Bound',r.boundAt?ago(r.boundAt)+' ago':'—')}
  ${kv('Coin',`<span class="cp" onclick="copyTxt('${r.coin}')">${sh(r.coin)}</span>`)}
  ${kv('Treasury',`<span class="cp" onclick="copyTxt('${r.treasury}')">${sh(r.treasury)}</span>`)}
  ${kv('Creator',`<span class="cp" onclick="copyTxt('${r.creator||''}')">${sh(r.creator)}</span>`)}
  <div class="pb" style="display:flex;gap:7px;flex-wrap:wrap;border-bottom:1px solid var(--hair)">
   <a class="btn gh" href="${lnk(r.coin,'token')}" target="_blank" rel="noopener">TOKEN ↗</a>
   <a class="btn gh" href="${lnk(r.treasury)}" target="_blank" rel="noopener">TREASURY ↗</a>
   <a class="btn gh" href="https://indices.theindex.finance/coin/${r.treasury}" target="_blank" rel="noopener">INDICES PAGE ↗</a></div>
  <div class="ph"><h2>Recent payouts</h2><span class="d">read live from this treasury</span></div>
  <div id="dFeed">${skel(5)}</div>
  <div class="note">Values are marked at current prices. A countdown past zero means a payout is
   <b>due</b> — execution is keeper-dependent, not automatic.</div>`;
 /* live per-protocol payout history */
 try{
  const rr=await bs('/addresses/'+r.treasury+'/token-transfers?filter=from&type=ERC-20');
  const it=(rr.items||[]).slice(0,22).map(x=>{const tk=x.token||{},dec=+(tk.decimals||18);
   return{sym:tk.symbol||'?',a:(tk.address_hash||'').toLowerCase(),
    amt:parseFloat((x.total||{}).value||'0')/Math.pow(10,dec),to:((x.to||{}).hash||'').toLowerCase(),
    ts:Date.parse(x.timestamp)}});
  if(!it.length){$('#dFeed').innerHTML='<div class="spin">no outbound payouts on this treasury’s recent pages</div>';return}
  Object.assign(S.px,await prices([...new Set(it.map(x=>x.a))]));
  $('#dFeed').innerHTML='<div class="feed">'+it.map(x=>{const p=(S.px[x.a]||{}).px,u=p?x.amt*p:null;
   return `<div class="frow"><span class="dx">${etT(x.ts)}</span>
    <span>${LOGO(x.sym)}<b>${esc(x.sym)}</b> <span class="dx">→ ${sh(x.to)}</span></span>
    <span class="${u?'up':'di'}">${u?f$(u):x.amt.toPrecision(3)}</span></div>`}).join('')+'</div>';
 }catch(e){$('#dFeed').innerHTML='<div class="spin">payout history unavailable — the public explorer is rate-limiting</div>'}
};
SI.closeD=function(){$('#scrim').classList.remove('on');$('#drawer').classList.remove('on')};
document.addEventListener('keydown',e=>{if(e.key==='Escape')SI.closeD()});

/* ══ rendering ══ */
function badge(r,skipCurve){let b='';
 if(r.rounds>0)b+='<span class="badge b-pay">PAYER</span>';
 if(r.bps===10000)b+='<span class="badge b-full">FULL</span>';
 /* the pairing tag already prints CURVE when there is no external pair, so the
    badge would render it a second time on the same row (it did, visibly). */
 if(!r.mkt&&!skipCurve)b+='<span class="badge b-curve">CURVE</span>';
 if(S.w&&S.w.hold.some(h=>h.addr===r.coin))b+='<span class="badge b-hold">HELD</span>';
 return b}
/* ── pairing tag ─────────────────────────────────────────────────────────────
   What a coin trades against decides how its payout actually executes, so it
   belongs next to the ticker, not buried in a column:
     DIRECT  paired against an asset its own basket pays → fees arrive already
             denominated in the reward, no conversion step at all
     stock   paired against a tokenized equity (still a swap unless it is the
             basket asset)
     ETH/USDG the treasury must `convert` into every basket asset before it can
             pay — more steps, and each needs a liquid pool
   Measured on 2026-08-05: the swap-free coin (JACKET, NVDA/NVDA) leads the board
   on rounds executed. */
function pairTag(r){
 const q=r.mkt&&r.mkt.quote?String(r.mkt.quote).toUpperCase():null;
 if(!q)return '<span class="pt cv" title="still on the Indices bonding curve — no external pair yet">CURVE</span>';
 const inBasket=(r.basket||[]).some(([a])=>symOf(a).toUpperCase()===q);
 if(inBasket)return `<span class="pt dr" title="paired against ${esc(q)}, which this treasury also pays out — fees arrive already in the reward asset, so no conversion is needed. The shortest, least failure-prone payout path.">⇄ ${esc(q)} · DIRECT</span>`;
 if(q==='ETH'||q==='WETH')return '<span class="pt et" title="paired against ETH — the treasury must convert ETH into every basket asset before it can pay holders. More steps per round, and each swap needs a liquid pool.">⇄ ETH</span>';
 if(/^USD/.test(q))return `<span class="pt us" title="paired against ${esc(q)} — the treasury must convert the stablecoin into every basket asset before paying holders.">⇄ ${esc(q)}</span>`;
 return `<span class="pt sk" title="paired against tokenized ${esc(q)} — a swap is still required because ${esc(q)} is not in this treasury's basket.">⇄ ${esc(q)}</span>`;
}
function bskTxt(r){return !r.basket||!r.basket.length?'—':r.basket.map(([a,w])=>symOf(a)+' '+(w/100).toFixed(0)+'%').join(' · ')}
/* the same basket, as logo pills — this is the ecosystem's own visual idiom */
function bskHtml(r){return !r.basket||!r.basket.length?'<span class="dx">—</span>':
 '<span class="bkt">'+r.basket.map(([a,w])=>{const sy=symOf(a);
  return `<span>${LOGO(sy)}${esc(sy)}<em>${(w/100).toFixed(0)}%</em></span>`}).join('')+'</span>'}
/* One predicate, used by the ledger AND the PROTOCOLS table, so a filter set in
   one place means the same thing in the other. */
const FBTN={payers:'#fPay',migrated:'#fMig',full:'#fFull',direct:'#fDir',held:'#fHeld',curve:'#fCrv'};
const TAGS=[
 {k:'payers', l:'PAYER',  t:r=>r.rounds>0,                                 tip:'has finalized at least one payout round on chain'},
 {k:'full',   l:'FULL',   t:r=>r.bps===10000,                              tip:'100% of distributions go to holders'},
 {k:'direct', l:'DIRECT', t:r=>{const q=r.mkt&&r.mkt.quote?String(r.mkt.quote).toUpperCase():null;
        return !!q&&(r.basket||[]).some(([a])=>symOf(a).toUpperCase()===q)}, tip:'paired against an asset it pays — no conversion needed'},
 /* priv: this tag is derived from a wallet the VISITOR pasted into their own
    browser (localStorage si_w, never sent anywhere and never in the repo).
    With no wallet tracked it must not render at all — not greyed out, absent. */
 {k:'held',   l:'HELD',   priv:1, t:r=>!!(S.w&&S.w.hold.some(h=>h.addr===r.coin)),  tip:'held by the wallet you are tracking'},
 {k:'curve',  l:'CURVE',  t:r=>!r.mkt,                                     tip:'still on the bonding curve, no external book yet'},
 {k:'migrated',l:'MIGRATED',t:r=>!!r.mkt,                                  tip:'has an external order book'},
];
function passFilt(r){
 const f=S.filt;
 for(const t of TAGS)if(f[t.k]&&!t.t(r))return false;
 if(f.q&&!((r.sym||'')+' '+bskTxt(r)+' '+(r.coin||'')+' '+(r.treasury||'')).toLowerCase().includes(f.q))return false;
 return true;
}
function syncPrivUI(){
 /* one switch for every surface that can reveal a tracked wallet */
 const on=!!S.w, b=$('#fHeld');
 if(b)b.style.display=on?'':'none';
 if(!on&&S.filt.held)S.filt.held=false;
}
function renderTagBar(rows){
 syncPrivUI();
 const el=document.getElementById('tagBar');if(!el)return;
 const any=TAGS.some(t=>S.filt[t.k])||S.filt.q;
 const TSHOW=TAGS.filter(t=>!t.priv||S.w);
 el.innerHTML='<span class="lbl">FILTER</span>'+TSHOW.map(t=>{
  const n=rows.filter(t.t).length, off=n===0&&!S.filt[t.k];
  /* a chip matching nothing can only ever produce an empty table — disable it and say why */
  const tip=off?(t.k==='held'?'track a wallet on MY DIVIDENDS to use this filter':'nothing matches this tag right now'):t.tip;
  return `<button class="tf${S.filt[t.k]?' on':''}" title="${tip}"${off?' disabled':''} onclick="SI.toggle('${t.k}')">${t.l}<span class="n">${n}</span></button>`}).join('')
  +(any?'<button class="tf" onclick="SI.clearF()" title="clear every filter">✕ CLEAR</button>':'')
  +`<span class="lbl" style="margin-left:auto">${rows.filter(passFilt).length} of ${rows.length} shown</span>`;
}
function rowsOf(){return S.tre.filter(t=>t.coin).map(t=>{const mkt=S.px[t.coin]||null;
 return{...t,mkt,sym:t.sym||(mkt&&mkt.sym)||symOf(t.coin),
  nextT:(t.lastRound&&t.epochLength)?t.lastRound+t.epochLength:t.next||null}})}

function paintTop(){
 const ix=S.px[C.index]||{},k=S.keeper||{},live=S.tre.filter(t=>t.coin);
 $('#tIx').textContent=px$(ix.px);
 $('#tIxCh').innerHTML=ix.ch24!=null?`<span class="${ix.ch24>=0?'up':'dn'}">${ix.ch24>=0?'+':''}${(+ix.ch24).toFixed(1)}%</span>`:'';
 $('#tProt').textContent=live.length;
 $('#tRnd').textContent=live.reduce((a,t)=>a+(t.rounds||0),0);
 $('#tKeep').innerHTML=k.gas!=null?`<span class="${k.gas<0.05?'dn':'up'}">${k.gas.toFixed(3)} Ξ</span>`:'—';
 $('#sblock').textContent=(S.block?'block '+S.block.toLocaleString():'')+
  (S.snapAge!=null?' · snap '+Math.round(S.snapAge)+'m':'');
}
const SIX={coin:'0xfb52da75945a4965183a5cfec1dca7af5881ce24',
 treasury:'0xa50b5777f4cf28b10365bc85fd693006042b0b2a'};
/* our own coin's numbers, held to exactly the same standard as everyone else's:
   absent data is labelled absent, and the payout clock is the same computation
   used for every other treasury on this page. */
function renderTok(){
 const el=document.getElementById('tokMetrics');if(!el)return;
 const t=S.tre.find(x=>(x.coin||'')===SIX.coin)||S.tre.find(x=>x.sym==='SUBINDEX');
 const mkt=S.px[SIX.coin]||null,h=S.holders[SIX.coin];
 const nx=t?((t.lastRound&&t.epochLength)?t.lastRound+t.epochLength
   :(t.boundAt&&t.epochLength?t.boundAt+t.epochLength:null)):null;
 const c=(l,v,sub)=>`<div class="c"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${sub||''}</div></div>`;
 el.innerHTML=
  c('Price',mkt&&mkt.px?px$(mkt.px):'<span class="dx" style="font-size:13px">on curve</span>',
    mkt&&mkt.ch24!=null?`<span class="${mkt.ch24>=0?'up':'dn'}">${mkt.ch24>=0?'+':''}${(+mkt.ch24).toFixed(1)}%</span> 24h`:'not yet migrated')
 +c('Market cap',mkt&&mkt.mc?m$(mkt.mc):'—','fully diluted')
 +c('Liquidity',mkt&&mkt.liq?m$(mkt.liq):'—',mkt&&mkt.quote?'paired '+esc(mkt.quote):'curve stage')
 +c('Volume 24h',mkt&&mkt.vol?m$(mkt.vol):'—','fees fund the payouts')
 +c('Holders',h&&h.n!=null?num(h.n):'…','eligible every round')
 +c('Reward assets','17','the widest basket live')
 +c('To holders','100%','creator takes nothing')
 +c('Rounds paid',t?num(t.rounds||0):'—',t&&t.rounds?'on chain':'awaiting first fees')
 +c('Next payout',(t&&(t.rounds||0)===0&&!(mkt&&mkt.vol>0))
    ?'<span class="dx" style="font-size:13px">no fees yet</span>'
    :nx?`<span data-cd="${nx}" style="font-size:15px">…</span>`:'—',
    (t&&(t.rounds||0)===0&&!(mkt&&mkt.vol>0))?'needs trading volume first':'15-minute epoch');
}
function renderOver(){
 const live=S.tre.filter(t=>t.coin),rows=rowsOf();
 const ix=S.px[C.index]||{},k=S.keeper||{};
 const lastM=k.last?(Date.now()-k.last)/60000:null;
 /* unknown last-run means the explorer is throttling us, NOT that the keeper
    stopped — flagging it red would be a false alarm on our own rate limit */
 const kOk=(lastM==null||lastM<45)&&(k.gas==null||k.gas>0.05);
 const payers=live.filter(t=>t.rounds>0).length;
 const totVol=rows.reduce((a,r)=>a+((r.mkt&&r.mkt.vol)||0),0);
 const totLiq=rows.reduce((a,r)=>a+((r.mkt&&r.mkt.liq)||0),0);
 try{renderTok()}catch(e){}
 /* sparkline series, real data: rounds per protocol, volume per protocol, and
    distributions bucketed per hour over the last 24h */
 const rndS=rows.filter(r=>r.rounds>0).sort((a,b)=>b.rounds-a.rounds).slice(0,26).map(r=>r.rounds);
 const volS=rows.filter(r=>r.mkt&&r.mkt.vol>0).sort((a,b)=>b.mkt.vol-a.mkt.vol).slice(0,26).map(r=>r.mkt.vol);
 const hrs=new Array(24).fill(0);
 S.dist.forEach(d=>{const h=Math.floor((Date.now()-d.ts)/3600000);if(h>=0&&h<24)hrs[23-h]++});
 const liqS=rows.filter(r=>r.mkt&&r.mkt.liq>0).sort((a,b)=>b.mkt.liq-a.mkt.liq).slice(0,26).map(r=>r.mkt.liq);
 $('#heroOver').innerHTML=`
  <div class="mg">${EYE(1,'$INDEX, USD')}<div class="n">${px$(ix.px)}</div>
   <div class="s">${ix.ch24!=null?`<span class="${ix.ch24>=0?'up':'dn'}">${ix.ch24>=0?'+':''}${(+ix.ch24).toFixed(1)}%</span> 24h · `:''}MC ${m$(ix.mc)} · book ${m$(ix.liq)}</div>
   ${SPARK(liqS.length?liqS:[1],'b')}<div class="sparkx"><span>DEEPEST BOOK</span><span>THINNEST</span></div></div>
  <div class="mg">${EYE(2,'Live protocols')}<div class="n">${live.length}</div>
   <div class="s">${payers} have finalized a payout round · ${S.tre.length-live.length} treasuries awaiting a coin</div>
   ${SPARK(rndS.length?rndS:[1],'k')}<div class="sparkx"><span>MOST ROUNDS</span><span>FEWEST</span></div></div>
  <div class="mg">${EYE(3,'Payout rounds, all time')}<div class="n">${num(live.reduce((a,t)=>a+(t.rounds||0),0))}</div>
   <div class="s">distributions executed across every treasury</div>
   ${SPARK(hrs.some(x=>x)?hrs:[1],'b')}<div class="sparkx"><span>24H AGO</span><span>NOW</span></div></div>
  <div class="mg">${EYE(4,'Ecosystem book, USD')}<div class="n">${m$(totLiq)}</div>
   <div class="s">${m$(totVol)} traded in 24h across migrated coins</div>
   ${SPARK(volS.length?volS:[1],'')}<div class="sparkx"><span>MOST TRADED</span><span>LEAST</span></div></div>
  <div class="mg">${EYE(5,'Keeper liveness, ETH')}<div class="n">${k.gas!=null?k.gas.toFixed(3):'—'}</div>
   <div class="s">${lastM!=null?agoMs(k.last)+' since the last distribution run':'<span class="dx">last run unread — explorer busy</span>'}${kOk?'':' · <b class="dn">CHECK</b>'}<br><a onclick="go(\'keep\')" style="cursor:pointer">why a single wallet matters →</a></div></div>`;
 /* feed */
 $('#feedDist').innerHTML=S.dist.length?S.dist.slice(0,60).map(d=>{
  const p=(S.px[d.assetAddr]||{}).px,usd=p?d.amt*p:null;
  /* sub-cent dividends are the norm on a young chain: printing "$0.000000" tells
     the reader nothing, so below a cent we show the token amount instead. */
  const val=(usd!=null&&usd>=0.01)?f$(usd)
   :(usd!=null&&usd>0)?'<span title="'+usd.toExponential(2)+' USD">&lt;$0.01</span>'
   :(d.amt>=0.0001?d.amt.toFixed(4)+' '+esc(d.asset)
    :'<span class="dx" title="'+d.amt.toExponential(3)+' '+esc(d.asset)+'">dust</span>');
  return `<div class="frow" style="box-shadow:inset 3px 0 0 ${idcol(d.src)}"><span class="dx">${etT(d.ts)}</span>
   <span><b class="tk" style="color:${idcol(d.src)}">${esc(d.src)}</b> <span class="di">paid</span> <b class="am">${LOGO(d.asset)}${esc(d.asset)}</b>
    <span class="dx">→ ${sh(d.to)}</span></span>
   <span class="${usd&&usd>=0.01?'up':'mu'}">${val}</span></div>`}).join('')
  :'<div class="spin">no outbound distributions on the recent pages of the busiest treasuries</div>';
 /* bars */
 const vs=rows.filter(r=>r.mkt&&r.mkt.vol>0).sort((a,b)=>b.mkt.vol-a.mkt.vol).slice(0,8);
 const mv=Math.max(1,...vs.map(r=>r.mkt.vol));
 $('#barVol').innerHTML=vs.length?vs.map(r=>`<div class="bar"><span class="lb" style="color:${idcol(r.sym)}">${esc(r.sym)}</span>
  <span class="tr"><i style="width:${(100*r.mkt.vol/mv).toFixed(0)}%;background:${idcol(r.sym)}"></i></span>
  <span class="vl">${m$(r.mkt.vol)}</span></div>`).join('')
  :'<div class="spin">no migrated books yet — curve trading does not print to external feeds</div>';
 const rs=rows.filter(r=>r.rounds>0).sort((a,b)=>b.rounds-a.rounds).slice(0,8);
 const mr=Math.max(1,...rs.map(r=>r.rounds));
 $('#barRnd').innerHTML=rs.length?rs.map(r=>`<div class="bar"><span class="lb" style="color:${idcol(r.sym)}">${esc(r.sym)}</span>
  <span class="tr"><i style="width:${(100*r.rounds/mr).toFixed(0)}%;background:${idcol(r.sym)}"></i></span>
  <span class="vl">${r.rounds} rounds</span></div>`).join(''):'<div class="spin">no rounds observed</div>';
 /* soonest */
 /* upcoming payouts first (ascending), then the overdue ones (least overdue
    first). Sorting purely ascending on the timestamp buried every live clock
    under whichever treasury has been waiting longest — the opposite of the
    question this panel answers. */
 const nowS=Date.now()/1000;
 const soon=rows.filter(r=>r.nextT&&((r.rounds||0)>0||(r.mkt&&r.mkt.vol>0))).sort((a,b)=>{
  const fa=a.nextT>=nowS,fb=b.nextT>=nowS;
  if(fa!==fb)return fa?-1:1;
  return fa?(a.nextT-b.nextT):(b.nextT-a.nextT)}).slice(0,11);
 /* cumulative distributions over the observed window — the ecosystem's shape */
 {const pv=S.dist.slice().map(d=>({t:d.ts,v:d.amt*(((S.px[d.assetAddr]||{}).px)||0),src:d.src}))
   .filter(x=>x.v>0).sort((a,b)=>a.t-b.t);
  if(pv.length>1)$('#areaWrap').innerHTML=distChart(pv,860,190);
  else $('#areaWrap').innerHTML='<div class="spin">waiting on priced payouts — most rounds pay sub-cent dust per holder, so the feed needs a few rounds before there is anything worth plotting</div>';}
 $('#soon').innerHTML=soon.length?soon.map(r=>`<div class="bar">
  <span class="lb" title="${esc(r.sym)}" style="color:${idcol(r.sym)}">${esc(r.sym)}</span>
  <span class="sx">${bskHtml(r)}<span class="dx" style="margin-left:6px">every ${ep(r.epochLength)}</span></span>
  <span class="vl"><span data-cd="${r.nextT}">…</span></span></div>`).join(''):'<div class="spin">…</div>';
 /* the ledger strip: fills the fold with the actual table rather than air —
    same data as PROTOCOLS, trimmed to what fits without scrolling sideways */
 try{renderTagBar(rows)}catch(e){}
 const led=rows.filter(passFilt).sort((a,b)=>(b.rounds||0)-(a.rounds||0));
 if(!led.length){$('#ledger').innerHTML='<div class="spin" style="padding:22px 14px">no protocol carries every tag you selected — '
  +'<a href="#" onclick="SI.clearF();return false" style="color:var(--blu)">clear the filters</a></div>';}else
 $('#ledger').innerHTML=`<table><thead><tr><th class="l">COIN</th><th class="l">PAYS OUT</th>
  <th>EPOCH</th><th>NEXT</th><th>ROUNDS</th><th>SPLIT H/C</th><th>PRICE</th><th>MC</th><th>LIQ</th>
  <th>VOL 24H</th><th>HOLDERS</th><th>AGE</th></tr></thead><tbody>${led.map(r=>{const h=S.holders[r.coin];
  return `<tr data-open onclick="SI.openD('${r.treasury}')"><td class="l tk"><a href="${lnk(r.coin,'token')}" target="_blank" rel="noopener" style="color:${idcol(r.sym)}">${esc(r.sym)}</a>${pairTag(r)}${badge(r,1)}</td>
  <td class="l">${bskHtml(r)}</td><td class="mu">${ep(r.epochLength)}</td>
  <td>${(r.rounds||0)===0&&!(r.mkt&&r.mkt.vol>0)?'<span class="dx" title="no trading volume yet, so no fees have accrued — there is nothing to distribute. This is arithmetic, not a late payout.">no fees yet</span>':r.nextT?`<span data-cd="${r.nextT}">…</span>`:'—'}</td><td class="${(r.rounds||0)===0?'dx':(r.rounds||0)>=20?'up':''}" style="${(r.rounds||0)>=20?'font-weight:700':''}">${r.rounds||0}</td>
  <td class="${r.bps===10000?'up':r.bps!=null&&r.bps<5000?'am':'mu'}" style="${r.bps===10000?'font-weight:700':''}">${r.bps!=null?(r.bps/100).toFixed(0)+'/'+(100-r.bps/100).toFixed(0):'—'}</td>
  <td>${r.mkt?px$(r.mkt.px):'<span class="dx">curve</span>'}</td><td>${r.mkt?m$(r.mkt.mc):'<span class="dx">—</span>'}</td>
  <td>${r.mkt?m$(r.mkt.liq):'<span class="dx">—</span>'}</td><td>${r.mkt?m$(r.mkt.vol):'<span class="dx">—</span>'}</td>
  <td>${h&&h.n!=null?num(h.n):'<span class="dx">…</span>'}</td><td class="mu">${ago(r.boundAt)}</td></tr>`}).join('')}</tbody></table>`;
 /* reward mix */
 const mix={};live.forEach(t=>(t.basket||[]).forEach(([a,w])=>{const s=symOf(a);mix[s]=(mix[s]||0)+1}));
 const me=Object.entries(mix).sort((a,b)=>b[1]-a[1]).slice(0,10);
 const mm=Math.max(1,...me.map(x=>x[1]));
 const rmHtml=me.length?me.map(([s,n])=>`<div class="bar"><span class="lb">${LOGO(s)}${esc(s)}</span>
  <span class="tr"><i style="width:${(100*n/mm).toFixed(0)}%;background:${shade(s)}"></i></span>
  <span class="vl">${n} protocol${n>1?'s':''}</span></div>`).join(''):'<div class="spin">…</div>';
 const rm2=$('#rewMix2');if(rm2)rm2.innerHTML=rmHtml;   /* one renderer, one panel */

 /* Pairing vs throughput. The two panels here used to show the same reward mix
    twice; this one asks a question the data can actually answer — a coin paired
    against an asset it already pays needs no swap before a payout, so it should
    clear rounds faster than one that must convert first. */
 const CLSCOL={DIRECT:'var(--up)',STOCK:'var(--blu)',ETH:'#7a68c0',STABLE:'#3a8f85',CURVE:'var(--gold)'};
const CLS=[
  {k:'DIRECT', d:'paired against an asset it pays — no swap needed',
   t:r=>{const q=qOf(r);return !!q&&(r.basket||[]).some(([a])=>symOf(a).toUpperCase()===q)}},
  {k:'STOCK',  d:'paired against another tokenized stock',
   t:r=>{const q=qOf(r);return !!q&&q!=='ETH'&&q!=='WETH'&&!/^USD/.test(q)}},
  {k:'ETH',    d:'must convert ETH into every basket asset first', t:r=>/^W?ETH$/.test(qOf(r)||'')},
  {k:'STABLE', d:'must convert a stablecoin into every basket asset first', t:r=>/^USD/.test(qOf(r)||'')},
  {k:'CURVE',  d:'still on the bonding curve — no external book yet', t:r=>!r.mkt},
 ];
 const seen=new Set(), grp=[];
 for(const c of CLS){
  /* rows, NOT live: `live` is the raw registry with no market attached, so every
     coin would classify as CURVE. rowsOf() is the enriched view. */
  const m=rows.filter(r=>!seen.has(r.treasury)&&c.t(r));m.forEach(r=>seen.add(r.treasury));
  if(m.length)grp.push({...c,n:m.length,m,
   paid:m.filter(r=>(r.rounds||0)>0).length,
   med:med(m.map(r=>r.rounds||0)), top:Math.max(...m.map(r=>r.rounds||0))});
 }
 const gm=Math.max(1,...grp.map(g=>g.med));
 $('#pairPerf').innerHTML=grp.length?grp.map(g=>`<div class="bar" title="${esc(g.d)}">
  <span class="lb" style="min-width:74px;color:${CLSCOL[g.k]||'var(--ink)'};font-weight:700">${esc(g.k)}</span>
  <span class="tr"><i style="width:${(100*g.med/gm).toFixed(0)}%;background:${CLSCOL[g.k]||'var(--blu)'}"></i></span>
  <span class="vl" style="white-space:nowrap">${g.med} rounds <span class="dx">· ${g.paid}/${g.n}</span></span></div>
  <div class="pchips">${g.m.slice().sort((x,y)=>(y.rounds||0)-(x.rounds||0)).slice(0,16)
    .map(r=>`<span class="pchip" style="color:${idcol(r.sym)};background:color-mix(in srgb,${idcol(r.sym)} 13%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,${idcol(r.sym)} 32%,transparent)" title="${esc(r.sym)} — ${r.rounds||0} rounds">${esc(r.sym)}
      <b style="color:inherit">${r.rounds||0}</b></span>`).join('')}${g.m.length>16?`<span class="dx">+${g.m.length-16}</span>`:''}</div>`).join('')
  +`<div class="dx" style="padding:7px 2px 0;line-height:1.5">Median payout rounds per protocol, grouped by what it trades against.
   A DIRECT pair means the fee currency already is a payout asset, so the treasury skips the
   <code>convert</code> step entirely — the fastest path through the keeper.${grp.some(g=>g.n<5)?` <b style="color:var(--gold)">Small samples</b> (${grp.map(g=>g.k+' n='+g.n).join(', ')}) — read this as direction, not proof: a coin still on the curve has also had less time to trade, so age and pairing are tangled here. It is a lead to watch, not a conclusion.`:''}</div>`
  :'<div class="spin">…</div>';
}
function qOf(r){return r.mkt&&r.mkt.quote?String(r.mkt.quote).toUpperCase():null}
function med(a){if(!a.length)return 0;const b=a.slice().sort((x,y)=>x-y),h=b.length>>1;
 return b.length%2?b[h]:Math.round((b[h-1]+b[h])/2)}
function renderProt(){
 let rows=rowsOf().filter(passFilt);
 const K={sym:r=>(r.sym||'').toLowerCase(),rounds:r=>r.rounds||0,epoch:r=>r.epochLength||0,
  next:r=>r.nextT||9e12,bps:r=>r.bps||0,px:r=>(r.mkt&&r.mkt.px)||0,mc:r=>(r.mkt&&r.mkt.mc)||0,
  liq:r=>(r.mkt&&r.mkt.liq)||0,vol:r=>(r.mkt&&r.mkt.vol)||0,hold:r=>(S.holders[r.coin]||{}).n||0,
  age:r=>r.boundAt||0};
 const kf=K[S.sort.k]||K.rounds;
 rows.sort((a,b)=>{const x=kf(a),y=kf(b);return (x<y?-1:x>y?1:0)*S.sort.dir});
 $('#protCount').textContent=rows.length+' of '+S.tre.filter(t=>t.coin).length+' protocols';
 const H=(k,l,t)=>`<th class="${k==='sym'?'l':''}" onclick="SI.sort('${k}')" title="${t||''}">${l}${S.sort.k===k?(S.sort.dir<0?' ▾':' ▴'):''}</th>`;
 $('#tblProt').innerHTML=`<table><thead><tr>
  ${H('sym','COIN')}<th class="l">PAYS OUT</th>${H('epoch','EPOCH')}${H('next','NEXT PAYOUT')}${H('rounds','ROUNDS')}
  ${H('bps','SPLIT H/C','share of each distribution to holders / creator')}${H('px','PRICE')}${H('mc','MC')}
  ${H('liq','LIQUIDITY')}${H('vol','VOL 24H')}<th>PAIRED</th>${H('hold','HOLDERS')}${H('age','AGE')}
  <th class="l">CREATOR</th><th class="l">TREASURY</th></tr></thead><tbody>${rows.map(r=>{
  const h=S.holders[r.coin];
  return `<tr data-open onclick="SI.openD('${r.treasury}')">
   <td class="l tk"><a href="${lnk(r.coin,'token')}" target="_blank" rel="noopener" style="color:${idcol(r.sym)}">${esc(r.sym)}</a>${pairTag(r)}${badge(r,1)}</td>
   <td class="l">${bskHtml(r)}</td>
   <td class="mu">${ep(r.epochLength)}</td>
   <td>${(r.rounds||0)===0&&!(r.mkt&&r.mkt.vol>0)?'<span class="dx" title="no trading volume yet, so no fees have accrued — there is nothing to distribute. This is arithmetic, not a late payout.">no fees yet</span>':r.nextT?`<span data-cd="${r.nextT}">…</span>`:'—'}</td>
   <td class="${(r.rounds||0)===0?'dx':(r.rounds||0)>=20?'up':''}" style="${(r.rounds||0)>=20?'font-weight:700':''}">${r.rounds||0}</td>
   <td class="${r.bps===10000?'up':r.bps!=null&&r.bps<5000?'am':'mu'}" style="${r.bps===10000?'font-weight:700':''}">${r.bps!=null?(r.bps/100).toFixed(0)+'/'+(100-r.bps/100).toFixed(0):'—'}</td>
   <td>${r.mkt?px$(r.mkt.px):'<span class="dx">curve</span>'}</td>
   <td>${r.mkt?m$(r.mkt.mc):'<span class="dx">—</span>'}</td>
   <td>${r.mkt?m$(r.mkt.liq):'<span class="dx">—</span>'}</td>
   <td>${r.mkt?m$(r.mkt.vol):'<span class="dx">—</span>'}</td>
   <td class="mu">${r.mkt&&r.mkt.quote?esc(r.mkt.quote):'—'}</td>
   <td>${h&&h.n!=null?num(h.n):'<span class="dx">…</span>'}</td>
   <td class="mu">${ago(r.boundAt)}</td>
   <td class="l dx"><a href="${lnk(r.creator)}" target="_blank" rel="noopener">${sh(r.creator)}</a></td>
   <td class="l dx"><a href="${lnk(r.treasury)}" target="_blank" rel="noopener">${sh(r.treasury)}</a></td></tr>`}).join('')}</tbody></table>`;
}
function renderWallet(){
 const w=S.w;if(!w){return}
 $('#wEmpty').style.display='none';$('#wBody').style.display='';
 /* stop stretching the header panel once the real body is showing */
 {const wp=$('#wPanel');if(wp)wp.classList.remove('grow');}
 const srcs=Object.entries(w.bySrc).sort((a,b)=>b[1]-a[1]);
 const asts=Object.entries(w.byAsset).sort((a,b)=>b[1]-a[1]);
 const treBy={};S.tre.forEach(t=>{if(t.coin)treBy[t.coin]=t});
 const held=w.hold.map(h=>({...h,t:treBy[h.addr],px:(S.px[h.addr]||{}).px}))
  .map(h=>({...h,usd:h.px?h.amt*h.px:null}));
 const heldProt=held.filter(h=>h.t).sort((a,b)=>(b.usd||0)-(a.usd||0));
 const stockVal=held.filter(h=>SYMBY[h.addr]).reduce((a,h)=>a+(h.usd||0),0);
 const days=w.first?Math.max(1,(Date.now()-w.first)/86400000):null;
 $('#heroW').innerHTML=`
  <div class="mg" style="--c:var(--up)"><div class="l">Dividends received</div><div class="n">${f$(w.total)}</div>
   <div class="s">${w.divs.length} payments from ${srcs.length} source${srcs.length===1?'':'s'}${days?' over '+days.toFixed(1)+' days':''}
    <span class="dx" title="Blockscout paginates at 50 transfers per page; we follow up to 10 pages. ${w.unlabelled?w.unlabelled+' payment(s) came from a treasury created after our registry snapshot and are labelled by address.':''}">· ${num(w.transfersScanned||0)} transfers scanned${w.unlabelled?' · '+w.unlabelled+' unidentified payer':''}</span></div></div>
  <div class="mg" style="--c:var(--gold)"><div class="l">Run rate</div>
   <div class="n">${days&&w.total?f$(w.total/days):'—'}</div><div class="s">per day, on the history visible here</div></div>
  <div class="mg" style="--c:var(--blu)"><div class="l">Dividend coins held</div><div class="n">${heldProt.length}</div>
   <div class="s">${m$(heldProt.reduce((a,h)=>a+(h.usd||0),0))} of listed protocols</div></div>
  <div class="mg" style="--c:var(--vio)"><div class="l">Reward assets held</div><div class="n">${m$(stockVal)}</div>
   <div class="s">tokenized equities accrued from payouts</div></div>`;
 const mx=Math.max(1,...srcs.map(s=>s[1]));
 $('#wSrc').innerHTML=srcs.length?srcs.map(([s,v])=>`<div class="bar"><span class="lb" style="color:var(--acc)">${esc(s)}</span>
  <span class="tr"><i style="width:${(100*v/mx).toFixed(0)}%"></i></span>
  <span class="vl">${f$(v)}</span></div>`).join('')
  :'<div class="spin">no distributions found from any listed treasury or the $INDEX distributor</div>';
 const ma=Math.max(1,...asts.map(s=>s[1]));
 $('#wAsset').innerHTML=asts.length?asts.map(([s,v])=>`<div class="bar"><span class="lb">${LOGO(s)}${esc(s)}</span>
  <span class="tr"><i class="k" style="width:${(100*v/ma).toFixed(0)}%"></i></span>
  <span class="vl">${f$(v)}</span></div>`).join(''):'<div class="spin">—</div>';
 $('#wHold').innerHTML=heldProt.length?`<table><thead><tr><th class="l">COIN</th><th>BALANCE</th><th>VALUE</th>
  <th class="l">PAYS YOU</th><th>EPOCH</th><th>NEXT PAYOUT</th><th>SPLIT H/C</th><th>ROUNDS</th></tr></thead>
  <tbody>${heldProt.map(h=>{const t=h.t,nx=(t.lastRound&&t.epochLength)?t.lastRound+t.epochLength:t.next;
   return `<tr><td class="l tk"><a href="${lnk(h.addr,'token')}" target="_blank" rel="noopener" style="color:${idcol(h.sym)}">${esc(h.sym)}</a>${pairTag(Object.assign({},t,{mkt:S.px[h.addr]}))}</td>
   <td>${h.amt.toLocaleString(undefined,{maximumFractionDigits:2})}</td><td>${h.usd?f$(h.usd):'<span class="dx">curve</span>'}</td>
   <td class="l">${bskHtml(t)}</td><td class="mu">${ep(t.epochLength)}</td>
   <td>${nx?`<span data-cd="${nx}">…</span>`:'—'}</td>
   <td class="${t.bps===10000?'up':'mu'}">${t.bps!=null?(t.bps/100).toFixed(0)+'/'+(100-t.bps/100).toFixed(0):'—'}</td>
   <td>${t.rounds||0}</td></tr>`}).join('')}</tbody></table>`
  :'<div class="spin">this address holds none of the listed dividend coins</div>';
 $('#wFeed').innerHTML=w.divs.length?`<table><thead><tr><th class="l">TIME (${etZone()})</th><th class="l">SOURCE</th>
  <th class="l">RECEIVED</th><th>AMOUNT</th><th>VALUE NOW</th><th class="l">FROM</th></tr></thead>
  <tbody>${w.divs.slice(0,120).map(d=>`<tr>
   <td class="l dx">${etDT(d.ts)}</td>
   <td class="l tk" style="color:${idcol(d.src)}">${esc(d.src)}</td>
   <td class="l am">${LOGO(d.sym)}${esc(d.sym)}</td>
   <td>${d.amt.toPrecision(4)}</td>
   <td class="${d.usd?'up':'dx'}">${d.usd?f$(d.usd):'—'}</td>
   <td class="l dx"><a href="${lnk(d.from)}" target="_blank" rel="noopener">${sh(d.from)}</a></td></tr>`).join('')}</tbody></table>`
  :'<div class="spin">no dividend payments on the recent pages for this address</div>';
}

/* A funnel drawn from counts, so the drop-off between "machinery exists" and
   "holders actually got paid" is visible instead of buried in a paragraph. */
function funnel(stages){
 const mx=Math.max(1,...stages.map(x=>x.n));
 return `<div class="funnel">${stages.map((x,i)=>{
  const w=Math.max(6,100*x.n/mx), prev=i?stages[i-1].n:null;
  const drop=prev!=null&&prev>0?Math.round(100*(prev-x.n)/prev):null;
  return `<div class="fst" title="${esc(x.d||'')}">
   <div class="fsl"><b>${num(x.n)}</b> ${esc(x.l)}</div>
   <div class="fsb"><i style="width:${w.toFixed(1)}%;background:${x.c||'var(--blu)'}"></i></div>
   <div class="fsd">${drop!=null?(drop>0?`<span class="dn">−${drop}%</span> from the step above`:'<span class="up">no drop</span>'):'&nbsp;'}</div>
  </div>`}).join('')}</div>`;
}

/* Cumulative launch activity. Time on the x-axis, not row order. */
function stepChart(series,w,h,lbl){
 const all=series.flatMap(s=>s.pts); if(all.length<2)return '';
 const t0=Math.min(...all.map(p=>p[0])),t1=Math.max(...all.map(p=>p[0]));
 const vmax=Math.max(1,...series.map(s=>s.pts.length?s.pts[s.pts.length-1][1]:0));
 const L=44,R=12,T=10,B=26,iw=w-L-R,ih=h-T-B;
 const X=t=>L+(t1===t0?iw/2:iw*(t-t0)/(t1-t0)), Y=v=>T+ih-ih*v/vmax;
 const grid=[0,.25,.5,.75,1].map(f=>{const v=vmax*f;
  return `<line x1="${L}" x2="${w-R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="gl"/>
   <text x="${L-6}" y="${(Y(v)+3.5).toFixed(1)}" class="ax" text-anchor="end">${Math.round(v)}</text>`}).join('');
 const ticks=4,tk=[];
 for(let i=0;i<=ticks;i++){const t=t0+(t1-t0)*i/ticks;
  tk.push(`<text x="${X(t).toFixed(1)}" y="${h-8}" class="ax" text-anchor="${i===0?'start':i===ticks?'end':'middle'}">${etDT(t)}</text>`)}
 const lines=series.map(sr=>{
  if(sr.pts.length<2)return '';
  const d=sr.pts.map((p,i)=>`${i?'L':'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ');
  return `<path d="${d}" fill="none" stroke="${sr.c}" stroke-width="2" stroke-linejoin="round"/>`}).join('');
 const leg=series.map(sr=>`<span class="lgi"><i style="background:${sr.c}"></i>${esc(sr.l)}</span>`).join('');
 return `<svg viewBox="0 0 ${w} ${h}" class="chart" preserveAspectRatio="none" style="width:100%;height:${h}px">
  ${grid}${lines}${tk.join('')}</svg><div class="clg">${leg}<span class="dx">${esc(lbl||'')}</span></div>`;
}

function cum(times){const a=times.filter(Boolean).sort((x,y)=>x-y);return a.map((t,i)=>[t,i+1])}

/* ───────────────────────── INDEX ─────────────────────────
   The site's whole claim is "supports INDEX", and until now INDEX appeared
   only as a price in the top rail. This reads the distributor's own outbound
   ERC-20 transfers — the same evidence standard used for every other number
   here — so what INDEX actually pays its holders is measured, not asserted. */
let IDX={loaded:false,busy:false,pays:[],fees:[],err:null};

async function loadIndex(force){
 if(IDX.busy||(IDX.loaded&&!force))return;
 IDX.busy=true;
 try{
  /* Blockscout's filter=from is NOT honoured on this endpoint — it returns both
     directions. Verified by probe: a "filter=from" page came back containing
     transfers whose `from` was some other wallet. So classify in JS and never
     trust the query string, or recipients and senders get mixed together. */
  /* 10 pages at up to 9s each pinned this panel for over a minute when the
     explorer was throttling. 4 pages / 200 transfers is plenty for a live
     view and keeps the worst case inside ~35s. */
  const cap0=$('#idxChartCap');if(cap0)cap0.textContent='reading the distributor contract — this takes a few seconds…';
  const rows=await bsPages('/addresses/'+C.distributor+'/token-transfers?type=ERC-20',4,200);
  const D=C.distributor.toLowerCase();
  const map=t=>{
   const tk=t.token||{},dec=+(tk.decimals||18);
   const raw=t.total&&t.total.value!=null?t.total.value:(t.value||0);
   const amt=Number(raw)/Math.pow(10,dec||18);
   const ad=(tk.address||'').toLowerCase();
   const px=(S.px[ad]||{}).px;
   return{ts:Date.parse(t.timestamp||t.block_timestamp||0)||null,
    sym:(tk.symbol||symOf(ad)||'?').toUpperCase(),addr:ad,amt,usd:px?amt*px:null,
    from:((t.from&&(t.from.hash||t.from))||'').toLowerCase(),
    to:((t.to&&(t.to.hash||t.to))||'').toLowerCase()};
  };
  const all=(rows||[]).map(map).filter(x=>x.ts);
  IDX.pays=all.filter(x=>x.from===D);      // stock baskets leaving for holders
  IDX.fees=all.filter(x=>x.to===D);        // launchpad fee tokens arriving
  IDX.err=null;IDX.loaded=true;
 }catch(e){IDX.err=String(e&&e.message||e)}
 IDX.busy=false;
 /* render unconditionally — gating on "is the tab visible" meant a finished load
    could land while the user was elsewhere and never repaint. */
 try{renderIndex()}catch(e){}
}

function renderIndex(){
 const ix=S.px[C.index]||{},P=IDX.pays;
 const holders=(S.holders&&S.holders[C.index]&&S.holders[C.index].n)||null;
 const usd=P.reduce((a,x)=>a+(x.usd||0),0);
 const recips=new Set(P.map(x=>x.to)).size;
 const assets={};P.forEach(x=>{assets[x.sym]=(assets[x.sym]||0)+(x.usd||0)});
 const last=P.length?Math.max(...P.map(x=>x.ts)):null;
 const priced=P.filter(x=>x.usd!=null).length;

 $('#heroIdx').innerHTML=`
  <div class="mg">${EYE(1,'$INDEX PRICE')}<div class="n">${px$(ix.px)}</div>
   <div class="s">${ix.ch24!=null?`<span class="${ix.ch24>=0?'up':'dn'}">${ix.ch24>=0?'+':''}${(+ix.ch24).toFixed(1)}%</span> 24h · `:''}MC ${m$(ix.mc)}</div></div>
  <div class="mg">${EYE(2,'PAYOUTS TO INDEX HOLDERS')}<div class="n">${P.length?num(P.length):'…'}</div>
   <div class="s">${!P.length?'reading the distributor':usd>0?m$(usd)+' priced ('+priced+' of '+P.length+' transfers)'
     :'<span class="dx">transfers confirmed on chain · these payout assets have no price feed on this chain, so no USD figure is claimed</span>'}</div></div>
  <div class="mg">${EYE(3,'HOLDERS PAID')}<div class="n">${P.length?num(recips):'…'}</div>
   <div class="s">distinct wallets receiving from the distributor</div></div>
  <div class="mg">${EYE(4,'REWARD ASSETS')}<div class="n">${Object.keys(assets).length||'…'}</div>
   <div class="s">distinct tokens INDEX has paid out</div></div>
  <div class="mg">${EYE(5,'LAST PAYOUT')}<div class="n" style="font-size:21px">${last?agoMs(last):'…'}</div>
   <div class="s">${last?etFull(last)+' '+etZone():'no dated transfer in the window'}</div></div>`;

 // value paid to INDEX holders over time — same chart the ecosystem view uses
 /* Prefer dollars; fall back to payout counts rather than showing nothing.
    src drives the stacking/legend in distChart, so pass the asset as src. */
 const pr=P.filter(x=>x.usd!=null).map(x=>({t:x.ts,v:x.usd,src:x.sym})).sort((a,b)=>a.t-b.t);
 const cnt=P.map(x=>({t:x.ts,v:1,src:x.sym})).sort((a,b)=>a.t-b.t);
 const useCnt=pr.length<2&&cnt.length>1;
 $('#idxChart').innerHTML=pr.length>1?distChart(pr,1180,210)
  :useCnt?distChart(cnt,1180,210,'n')
  :`<div class="spin" style="padding:26px 14px">${IDX.err?'distributor read failed — '+esc(IDX.err)
    :'reading the distributor…'}</div>`;
 const cap=$('#idxChartCap');
 /* the caption has to match what actually rendered, including the burst case */
 const isBurst=($('#idxChart')||{}).innerHTML&&$('#idxChart').innerHTML.indexOf('class="burst"')>=0;
 if(cap)cap.textContent=isBurst?'the whole sample landed in one burst, so there is no time axis to draw · all times Eastern'
   :useCnt?'payout transfers per interval, stacked by asset — these assets have no price feed, so this counts payouts rather than dollars · all times Eastern'
   :'value pushed to INDEX holders per interval, with the running total · all times Eastern';

 /* rank by dollars when we have them, otherwise by number of payouts */
 const cnts={};P.forEach(x=>{cnts[x.sym]=(cnts[x.sym]||0)+1});
 const byUsd=Object.values(assets).some(v=>v>0);
 const ae=Object.entries(byUsd?assets:cnts).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,14);
 const am=Math.max(1,...ae.map(x=>x[1]));
 $('#idxMix').innerHTML=ae.length?ae.map(([sy,v])=>`<div class="bar">
   <span class="lb">${LOGO(sy)}${esc(sy)}</span>
   <span class="tr"><i style="width:${(100*v/am).toFixed(0)}%;background:${shade(sy)}"></i></span>
   <span class="vl" style="white-space:nowrap">${byUsd?m$(v):v+' payout'+(v>1?'s':'')}</span></div>`).join('')
   +(byUsd?'':'<div class="dx" style="padding:7px 2px 0">Ranked by number of payouts: these tokenized equities have no price feed on this chain, so a dollar ranking would be invented.</div>')
  :'<div class="spin">no payouts observed yet</div>';

 // the flywheel claim, stated as arithmetic rather than as a slogan
 const live=rowsOf(), payers=live.filter(r=>(r.rounds||0)>0);
 const rounds=live.reduce((a,r)=>a+(r.rounds||0),0);
 const claims=(S.keeper&&S.keeper.claims)||0;
 $('#idxFlow').innerHTML=`
  <div class="flowline">
   <span class="fnode">${live.length} launchpad coins</span><span class="farr">→</span>
   <span class="fnode">trading fees</span><span class="farr">→</span>
   <span class="fnode">${payers.length} treasuries paying</span><span class="farr">→</span>
   <span class="fnode alt">10% <code>claimProtocol</code></span><span class="farr">→</span>
   <span class="fnode idx">$INDEX holders</span>
  </div>
  <div class="dx" style="line-height:1.6;margin-top:9px">
   ${num(rounds)} payout rounds have been finalized across the launchpad, and the keeper has made
   <b>${num(claims)}</b> <code>claimProtocol</code> calls in the sampled window. Each launchpad coin routes
   <b>10% of its distribution</b> to the protocol rather than to its own holders, which is the mechanism by
   which activity anywhere on the launchpad is supposed to reach INDEX.
   <b style="color:var(--gold)">What is verified and what is not:</b> the claims and the distributor's outbound
   transfers above are both observed on chain. The link between them — that protocol fees collected from these
   coins are the same funds leaving the distributor — is <b>not</b> something we can prove from public logs, because
   the treasury contracts are unverified and the funds are fungible once pooled. Treat the flywheel as documented
   intent plus two measured endpoints, not as an audited path.
  </div>`;

 /* Fees arriving AT the distributor — the first hop of the flywheel, and the
    half that is actually observable. Grouped by the coin that sent them. */
 const F=IDX.fees||[];
 const fin={};F.forEach(x=>{fin[x.sym]=fin[x.sym]||{n:0,usd:0};fin[x.sym].n++;fin[x.sym].usd+=x.usd||0});
 const fe=Object.entries(fin).sort((a,b)=>b[1].n-a[1].n).slice(0,14);
 const fm=Math.max(1,...fe.map(x=>x[1].n));
 $('#idxIn').innerHTML=fe.length?fe.map(([sy,v])=>`<div class="bar">
   <span class="lb">${LOGO(sy)}${esc(sy)}</span>
   <span class="tr"><i style="width:${(100*v.n/fm).toFixed(0)}%;background:${idcol(sy)}"></i></span>
   <span class="vl" style="white-space:nowrap">${v.n} in <span class="dx">${v.usd?'· '+m$(v.usd):''}</span></span></div>`).join('')
   +`<div class="dx" style="padding:7px 2px 0;line-height:1.55">${num(F.length)} inbound transfers from
     <b>${fe.length}</b> distinct tokens. These are launchpad coins and reward assets arriving at the
     distributor, which then calls <code>buyStocksRialto</code> to convert them before paying INDEX holders.
     This is the closest thing to direct evidence of the fee flywheel that public logs allow.</div>`
  :(()=>{ /* no inbound in this window — instead of an empty box, show who the
       outbound burst actually paid: the recipients leaderboard from the same read */
    const rc={};P.forEach(x=>{rc[x.to]=(rc[x.to]||0)+1});
    const re=Object.entries(rc).sort((a,b)=>b[1]-a[1]).slice(0,12);
    const rm2=Math.max(1,...re.map(x=>x[1]));
    return `<div class="dx" style="line-height:1.55;margin-bottom:9px">No fee inflows inside the most recent
      ${num(P.length)} transfers — the window is filled by one outbound burst (inflows reappear between bursts).
      So here is where that burst went: <b>every wallet the distributor just paid.</b></div>`
     +re.map(([w,c])=>`<div class="bar">
      <span class="lb"><a href="${lnk(w)}" target="_blank" rel="noopener" style="color:${idcol(w.slice(2,8))}">${sh(w)}</a></span>
      <span class="tr"><i style="width:${(100*c/rm2).toFixed(0)}%;background:${idcol(w.slice(2,8))}"></i></span>
      <span class="vl">${c} payouts</span></div>`).join('');})();

 const recent=P.slice().sort((a,b)=>b.ts-a.ts).slice(0,60);
 $('#idxTbl').innerHTML=recent.length?`<table><thead><tr><th class="l">TIME (${etZone()})</th>
   <th class="l">ASSET</th><th>AMOUNT</th><th>VALUE</th><th class="l">TO</th></tr></thead><tbody>${
   recent.map(x=>`<tr><td class="l dx">${etFull(x.ts)}</td>
    <td class="l tk" style="color:${shade(x.sym)}">${LOGO(x.sym)}${esc(x.sym)}</td>
    <td>${x.amt<0.0001?x.amt.toExponential(2):x.amt.toLocaleString(undefined,{maximumFractionDigits:6})}</td>
    <td>${x.usd!=null?m$(x.usd):'<span class="dx">no feed</span>'}</td>
    <td class="l dx"><a href="${lnk(x.to)}" target="_blank" rel="noopener">${sh(x.to)}</a></td></tr>`).join('')}</tbody></table>`
  :`<div class="spin">${IDX.err?'could not read the distributor: '+esc(IDX.err):'reading the distributor…'}</div>`;
}


/* Fill the not-connected state with the explainer AND a live look at who is
   actually paying, so the tab is useful before you paste anything. */
function renderWEmpty(){
 const el=$('#wEmpty');if(!el)return;
 const rows=rowsOf().filter(r=>(r.rounds||0)>0).sort((a,b)=>(b.rounds||0)-(a.rounds||0)).slice(0,12);
 const mx=Math.max(1,...rows.map(r=>r.rounds||0));
 el.innerHTML=`<div class="wemp">
  <div>
   <h3>See exactly which protocols have paid you</h3>
   <p>Paste any address, or connect a wallet. Either way this is <b>watch-only</b>: the connector asks
    for your address and nothing else — it never requests a signature, never builds a transaction and
    never asks for a key or seed phrase. Nothing is sent anywhere; the lookups go from your browser
    straight to public explorers.</p>
   <div class="st"><span class="no">1</span><div>Your incoming ERC-20 transfers are read from the explorer,
    <b>following pagination</b> — not just the first page, which is how an earlier version under-reported.</div></div>
   <div class="st"><span class="no">2</span><div>Each payment is matched to a payer by its <b>sending contract</b>.
    That is why the source can name a memecoin while the asset you received is a tokenized stock.</div></div>
   <div class="st"><span class="no">3</span><div>Anything we cannot attribute is still <b>counted and labelled</b>
    as an unidentified treasury rather than dropped, so the total is never quietly tidied.</div></div>
   <p class="dx" style="font-size:11px">Values are marked at current prices, not the price at the time you
    were paid. A coin can also be <i>named</i> after a stock, so check the FROM column before assuming.</p>
  </div>
  <div>
   <h3 style="margin-bottom:8px">Who is paying right now</h3>
   ${rows.length?rows.map(r=>`<div class="bar">
     <span class="lb" style="color:${idcol(r.sym)}">${esc(r.sym)}</span>
     <span class="tr"><i style="width:${(100*(r.rounds||0)/mx).toFixed(0)}%;background:${idcol(r.sym)}"></i></span>
     <span class="vl" style="white-space:nowrap">${r.rounds} rounds</span></div>`).join('')
    :'<div class="spin">loading the ledger…</div>'}
   <div class="dx" style="padding:8px 2px 0;line-height:1.55">Ranked by payout rounds finalized on chain.
    If you hold any of these, this tab will show what each one has sent you.</div>
  </div>
 </div>`;
}


/* Documentation, not measurement — but it belongs on the page rather than in a
   README, and it is what makes every other number auditable. */
const PROV=[
 ['Price, market cap, liquidity, 24h volume','DexScreener, deepest pool per token','LIVE','on load + on refresh','coins with no external pool are marked CURVE, never zero'],
 ['Holder counts','Blockscout token holders','LIVE','lazily, per coin','absent until that coin is fetched, shown as … not 0'],
 ['Payout round counts, epoch, split, basket','published treasury snapshot','SNAP','scheduled push','treasury contracts are unverified, so getters cannot be discovered'],
 ['Next-payout countdown','last round + epoch, computed','DERIVED','every second','past zero means DUE, not failed — execution is keeper-dependent'],
 ['Keeper gas balance','Robinhood Chain RPC, eth_getBalance','LIVE','on load','the single wallet that can trigger payouts'],
 ['Keeper calls, methods, targets','Blockscout address transactions','LIVE','on load','method shown by selector when no ABI is available'],
 ['Observed throughput, sweep time, capacity','computed from the keeper sample','DERIVED','with the sample','blank until holder counts are known for the whole set'],
 ['Your dividend payments','Blockscout ERC-20 transfers to your address','LIVE','when you paste or connect','follows pagination; unattributed payments are counted and labelled'],
 ['Dividend source attribution','sending contract matched to the registry','DERIVED','with the payments','a source can be a memecoin while the asset received is a stock'],
 ['$INDEX payouts and fee inflows','Blockscout transfers at the distributor','LIVE','first time tab 6 opens','direction classified in JS — the explorer ignores filter=from here'],
 ['Pools created, pools not yet trading','Uniswap v4 Initialize logs via RPC','LIVE','on load','the PoolManager singleton covers the whole chain'],
 ['Pairing class, DIRECT / ETH / STABLE / CURVE','quote asset vs the coin basket','DERIVED','with prices','DIRECT means the fee currency already is a payout asset'],
 ['Block height and snapshot age','RPC head, snapshot timestamp','LIVE','on load','stamped in the sidebar footer'],
 ['All timestamps','IANA zone America/New_York','DERIVED','continuously','prints EDT or EST correctly rather than a fixed offset'],
];
function renderProv(){
 const el=$('#provTbl');if(!el)return;
 el.innerHTML=`<table><thead><tr><th class="l">FIGURE</th><th class="l">SOURCE</th><th>KIND</th>
  <th class="l">REFRESH</th><th class="l">CAVEAT</th></tr></thead><tbody>${PROV.map(r=>`<tr>
  <td class="l tk">${esc(r[0])}</td><td class="l">${esc(r[1])}</td>
  <td><span class="badge ${r[2]==='LIVE'?'b-full':r[2]==='SNAP'?'b-curve':'b-pay'}">${r[2]}</span></td>
  <td class="l dx">${esc(r[3])}</td><td class="l dx">${esc(r[4])}</td></tr>`).join('')}</tbody></table>`;
}

function renderPipe(){
 const un=S.tre.filter(t=>!t.coin),bound=new Set(S.tre.filter(t=>t.coin).map(t=>t.coin));
 const treTok=new Map(S.tre.filter(t=>t.coin).map(t=>[t.coin,t]));
 const pend=S.pools.filter(p=>p.token&&!S.px[p.token]&&!bound.has(p.token)).slice(-48).reverse();
 $('#heroPipe').innerHTML=`
  <div class="mg" style="--c:var(--acc)"><div class="l">Treasuries awaiting a coin</div><div class="n">${un.length}</div>
   <div class="s">payout machinery already deployed</div></div>
  <div class="mg" style="--c:var(--gold)"><div class="l">Pools not yet trading</div><div class="n">${pend.length}</div>
   <div class="s">initialized on chain, no price feed yet</div></div>
  <div class="mg" style="--c:var(--blu)"><div class="l">Pools scanned</div><div class="n">${num(S.pools.length)}</div>
   <div class="s">v4 Initialize events in the recent window</div></div>`;
 const rowsP=rowsOf();
 const stages=[
  {l:'treasuries deployed', n:S.tre.length, c:'var(--blu1)',
   d:'payout machinery that exists on chain, bound or not'},
  {l:'bound to a coin',     n:rowsP.length, c:'var(--blu)',
   d:'a treasury with a token attached — it can now accrue fees'},
  {l:'have paid holders',   n:rowsP.filter(r=>(r.rounds||0)>0).length, c:'var(--up)',
   d:'at least one payout round finalized on chain'},
  /* migration comes AFTER paying, not before: a coin still on the bonding curve
     accrues fees and pays rounds, so ordering migration as a prerequisite made
     the funnel widen at the bottom — which is nonsense. */
  {l:'migrated to an external book', n:rowsP.filter(r=>r.mkt).length, c:'var(--bluD)',
   d:'left the bonding curve and now trades against a real order book'}];
 $('#pipeFunnel').innerHTML=funnel(stages);
 const tl=stepChart([
   {l:'treasuries deployed',c:'var(--blu1)',pts:cum(S.tre.map(t=>t.deployedAt&&t.deployedAt*1000))},
   {l:'coins bound',        c:'var(--blu)', pts:cum(S.tre.map(t=>t.coin&&t.boundAt&&t.boundAt*1000))}
  ],1180,200,'cumulative count · all times '+etZone());
 $('#pipeTime').innerHTML=tl||'<div class="spin">not enough dated events to plot a timeline yet</div>';
 $('#pipeT').innerHTML=un.length?un.map(t=>`<span class="chip2" onclick="window.open('${lnk(t.treasury)}')">
  <b>${esc(bskTxt(t))||sh(t.treasury)}</b><br><span class="r">will pay its holders this basket</span><br>
  <span class="dx">${ep(t.epochLength)} epochs · ${t.bps!=null?(t.bps/100).toFixed(0)+'% to holders':''} · built ${ago(t.deployedAt)} ago</span></span>`).join('')
  :'<span class="chip2">every treasury we can see is bound to a coin</span>';
 $('#pipeP').innerHTML=pend.length?pend.map(p=>{const t=treTok.get(p.token);
  return `<span class="chip2" onclick="window.open('${lnk(p.token,'token')}')"><b>${esc(symOf(p.token))}</b>
   ${t?`<br><span class="r">→ has a treasury: pays ${esc(bskTxt(t))}</span>`:'<br><span class="dx">no treasury — ordinary launch</span>'}
   <br><span class="dx">quoted in ${esc(symOf(p.quote))}</span></span>`}).join('')
  :'<span class="chip2">no pools without a price feed in this window</span>';
}
function renderKeep(){
 const k=S.keeper||{};const lastM=k.last?(Date.now()-k.last)/60000:null;
 const low=k.gas!=null&&k.gas<0.05,stall=lastM!=null&&lastM>45;
 $('#heroKeep').innerHTML=`
  <div class="mg" style="--c:var(--${low?'dn':'up'})"><div class="l">Gas remaining</div>
   <div class="n">${k.gas!=null?k.gas.toFixed(4)+' Ξ':'—'}</div>
   <div class="s">${low?'<b class="dn">LOW — payouts at risk</b>':'funds the only wallet that can trigger payouts'}</div></div>
  <div class="mg" style="--c:var(--${stall?'dn':'up'})"><div class="l">Last distribution run</div>
   <div class="n">${lastM!=null?agoMs(k.last):'—'}</div>
   <div class="s">${stall?'<b class="dn">STALLED past a normal cycle</b>':'within the normal cycle'}</div></div>
  <div class="mg" style="--c:var(--blu)"><div class="l">Observed cadence</div>
   <div class="n">${k.cadence!=null?Math.round(k.cadence)+'m':'—'}</div>
   <div class="s">median gap between bursts in the recent window</div></div>
  <div class="mg" style="--c:var(--gold)"><div class="l">Protocol-fee claims</div><div class="n">${k.claims||0}</div>
   <div class="s">claimProtocol calls in the sample · destination unverified at the final hop</div></div>`;
 /* The central finding of this site is a throughput claim, so show the arithmetic
    rather than only asserting it in prose. */
 const R=(k.recent||[]).filter(t=>t.ts).map(t=>({...t,ms:Date.parse(t.ts)})).filter(t=>t.ms);
 const rowsK=rowsOf();
 /* Holder counts arrive per coin, lazily. Summing them while most are missing
    treats absent as zero, which made capacity read 809% — a number that flatly
    contradicts this site's own finding. So: measure coverage first, and refuse
    to publish a derived rate until the population is actually known. */
 const kn=rowsK.filter(r=>((S.holders||{})[r.coin]||{}).n!=null);
 const cov=rowsK.length?kn.length/rowsK.length:0;
 const leaves=kn.reduce((a,r)=>a+S.holders[r.coin].n,0);
 const full=cov>=0.9;
 let tpm=null;
 if(R.length>2){const span=(Math.max(...R.map(t=>t.ms))-Math.min(...R.map(t=>t.ms)))/60000;
  if(span>0.5)tpm=R.length/span}
 const sweep=(tpm&&leaves&&full)?leaves/tpm:null;
 const need=full?kn.filter(r=>r.epochLength).reduce((a,r)=>
   a+(S.holders[r.coin].n/((r.epochLength||900)/60)),0):null;
 const pend=`<span class="dx">holder counts known for ${kn.length} of ${rowsK.length} coins — this stays blank until the set is complete</span>`;
 $('#keepMath').innerHTML=`
  <div class="mega" style="margin:0 0 10px">
   <div class="mg">${EYE(1,'OBSERVED THROUGHPUT')}<div class="n">${tpm?tpm.toFixed(1):'—'}</div>
    <div class="s">keeper transactions per minute, from ${R.length} sampled calls</div></div>
   <div class="mg">${EYE(2,'HOLDER-LEAVES TO PAY')}<div class="n">${leaves?num(leaves)+(full?'':'+'):'—'}</div>
    <div class="s">${full?'one transaction each, per full ecosystem sweep':pend}</div></div>
   <div class="mg">${EYE(3,'TIME FOR ONE FULL SWEEP')}<div class="n">${sweep?Math.round(sweep)+'m':'—'}</div>
    <div class="s">${full?'at the observed rate, every treasury once':pend}</div></div>
   <div class="mg">${EYE(4,'RATE THE EPOCHS IMPLY')}<div class="n">${need?need.toFixed(0):'—'}</div>
    <div class="s">${full?'tx/min needed to honour every advertised epoch':pend}</div></div>
   <div class="mg">${EYE(5,'CAPACITY')}<div class="n ${tpm&&need&&tpm/need<.5?'dn':''}">${tpm&&need?Math.round(100*tpm/need)+'%':'—'}</div>
    <div class="s">${full?'of the rate those epochs would require':pend}</div></div>
  </div>
  ${tpm&&need?`<div class="capbar"><i style="width:${Math.min(100,100*tpm/need).toFixed(1)}%"></i>
    <span>${Math.round(100*tpm/need)}% of required throughput</span></div>`:''}
  <div class="dx" style="line-height:1.6;margin-top:8px">A round is a Merkle commit followed by
   <b>one transaction per holder</b>. That makes the epoch a target, not a schedule: the keeper is a single
   sequential wallet, so every coin queues behind the one being paid. Counts come from the sampled window
   above and move as the sample moves.</div>`;

 /* head-of-line blocking, shown directly */
 const tname={};rowsK.forEach(r=>{if(r.treasury)tname[r.treasury.toLowerCase()]=r.sym});
 const byT={};R.forEach(t=>{const a2=(t.to||'').toLowerCase();
  const nm=tname[a2]||t.name||sh(t.to);byT[nm]=(byT[nm]||0)+1});
 const te=Object.entries(byT).sort((a,b)=>b[1]-a[1]).slice(0,12);
 const tm=Math.max(1,...te.map(x=>x[1]));
 $('#keepFocus').innerHTML=te.length?te.map(([n,c])=>`<div class="bar">
   <span class="lb" style="color:${idcol(n)}">${esc(n)}</span>
   <span class="tr"><i style="width:${(100*c/tm).toFixed(0)}%;background:${idcol(n)}"></i></span>
   <span class="vl">${c} call${c>1?'s':''}</span></div>`).join('')
   +`<div class="dx" style="padding:7px 2px 0;line-height:1.55">The last ${R.length} keeper calls touched
     <b>${te.length}</b> of ${rowsK.length} live treasuries. A short list here is head-of-line blocking:
     whatever is not in it is waiting, regardless of what its epoch advertises.</div>`
  :'<div class="spin">keeper history unavailable right now</div>';
 $('#tblKeep').innerHTML=(k.recent&&k.recent.length)?`<table><thead><tr><th class="l">TIME (${etZone()})</th>
  <th class="l">CALL</th><th class="l">TARGET</th><th>STATUS</th></tr></thead><tbody>${k.recent.map(t=>`<tr>
  <td class="l dx">${etFull(Date.parse(t.ts))}</td>
  <td class="l ${/claimProtocol/.test(t.method)?'am':'tk'}">${esc(t.method)}</td>
  <td class="l dx"><a href="${lnk(t.to)}" target="_blank" rel="noopener">${esc(t.name||sh(t.to))}</a></td>
  <td class="${t.ok?'up':'dn'}">${t.ok?'ok':'failed'}</td></tr>`).join('')}</tbody></table>`
  :'<div class="spin">keeper history unavailable right now</div>';
}
async function renderRail(){
 const px=await prices(Object.values(RAILS));Object.assign(S.px,px);
 const rows=Object.entries(RAILS);
 const draw=()=>{$('#tblRail').innerHTML=`<table><thead><tr><th class="l">REWARD TOKEN</th><th>PRICE</th>
  <th>LIQUIDITY</th><th>VOL 24H</th><th>HOLDERS</th><th>PROTOCOLS PAYING IT</th><th class="l">CONTRACT</th></tr></thead>
  <tbody>${rows.map(([sym,a])=>{const p=S.px[a]||{},h=S.holders[a];
   const n=S.tre.filter(t=>t.coin&&(t.basket||[]).some(b=>b[0]===a)).length;
   return `<tr><td class="l tk">${LOGO(sym)}${sym}</td><td>${px$(p.px)}</td><td>${m$(p.liq)}</td><td>${m$(p.vol)}</td>
    <td>${h&&h.n!=null?num(h.n):'<span class="dx">…</span>'}</td>
    <td class="${n?'am':'dx'}">${n||'—'}</td>
    <td class="l dx"><a href="${lnk(a,'token')}" target="_blank" rel="noopener">${sh(a)}</a></td></tr>`}).join('')}</tbody></table>`};
 draw();
 /* Nine addresses with no explanation is a list, not a map. Each card now says
    what the contract does and what it proves, which is the point of this tab. */
 const CMAP=[
  ['$INDEX',C.index,'token','The launchpad\u2019s own token. Protocol fees skimmed from every coin on the launchpad are meant to end up paid out to the people holding this.'],
  ['Distributor',C.distributor,'address','Receives fee tokens, calls buyStocksRialto to convert them, then transfers tokenized equities out to holders. Tab 6 reads this contract directly.'],
  ['Keeper wallet',C.keeper,'address','The single EOA that triggers every payout. One sequential wallet is the reason epochs are targets rather than schedules \u2014 see the throughput panel on KEEPER.'],
  ['Fee hook \u2014 3% native ETH',C.feeHook,'address','The Uniswap v4 hook that takes the trading fee. No trading means no fee, which is why eight bound coins have never paid: arithmetic, not lateness.'],
  ['Indices treasury factory',C.idxFactory,'address','Deploys the per-coin treasuries. Unverified \u2014 it publishes no ABI, which is exactly why the registry on this site is a labelled snapshot.'],
  ['Tokenized-equity factory',C.stockFactory,'address','Deploys the stock tokens. Independent of the launchpad team\u2019s deployer wallets, which is the strongest structural fact here: the protocols pay out the chain\u2019s existing equities, not paper they printed.'],
  ['Stock treasury',C.stockTreas,'address','Holds the tokenized-equity side. Verify the holder counts on the table above against this.'],
  ['LP lock',C.lpLock,'address','Where migrated liquidity is locked after a coin leaves the bonding curve.'],
  ['Uniswap v4 PoolManager',C.poolManager,'address','The chain-wide singleton. One log filter on this address is the entire chain\u2019s trade tape, which is how pool creation is detected without polling every pair.'],
 ];
 $('#cmap').innerHTML=`<div class="cgrid">${CMAP.map(([n,a,k,d])=>`<div class="ccard">
   <div class="ct">${esc(n)}</div>
   <a class="ca" href="${lnk(a,k)}" target="_blank" rel="noopener">${esc(a)}</a>
   <div class="cd">${d}</div></div>`).join('')}</div>`;
 for(const [sym,a] of rows){if(S.holders[a])continue;
  try{const t=await bs('/tokens/'+a);S.holders[a]={n:+(t.holders_count||t.holders)||null};draw()}catch(e){}
  await sleep(650)}
}

/* countdowns tick in place — never rebuild a table the reader is using */
setInterval(()=>{document.querySelectorAll('[data-cd]').forEach(el=>{
 const d=Math.round(+el.dataset.cd-Date.now()/1000);
 if(d>0){const m=Math.floor(d/60);
  el.textContent=m>=60?Math.floor(m/60)+'h '+(m%60)+'m':m+'m '+String(d%60).padStart(2,'0')+'s';
  el.className='up'}
 else{const lm=Math.round(-d/60);
  el.textContent='due '+(lm>=120?Math.floor(lm/60)+'h '+(lm%60)+'m':lm+'m')+' ago';
  /* severity, not a binary: a payout 10m late is normal keeper queueing, one
     6h late is head-of-line blocking worth seeing at a glance */
  el.className=lm<60?'am':'dn';el.style.fontWeight=lm>=360?'700':''}})},1000);

/* nav */
function go(v){
 document.querySelectorAll('.view').forEach(x=>x.classList.toggle('on',x.id==='v-'+v));
 document.querySelectorAll('#nav a').forEach(a=>a.classList.toggle('on',a.dataset.v===v));
 $('#content').scrollTop=0;
 if(v==='rail'&&!go.rail){go.rail=true;renderRail().catch(()=>{})}
 /* the distributor read is heavy, so it runs the first time the tab is opened
    rather than on boot — and renders from cache on every visit after that */
 if(v==='idx'){renderIndex();loadIndex().catch(()=>{})}   /* cached after the first read */
}
window.go=go;
document.querySelectorAll('#nav a').forEach(a=>a.onclick=()=>go(a.dataset.v));
document.addEventListener('keydown',e=>{
 const m={'1':'over','2':'prot','3':'divs','4':'pipe','5':'keep','6':'idx','7':'rail','8':'meth'};
 if(m[e.key]&&e.target.tagName!=='INPUT')go(m[e.key])});
function status(t,c){$('#lstat').textContent=t;$('#ldot').className='dot'+(c?' '+c:'')}

/* ══ boot ══ */
async function boot(){
 try{
  status('reading chain…');
  S.tre=await loadRegistry();                 /* registry first: it is the page */
  (async()=>{try{S.keeper=await keeperState();paintTop();renderOver();renderKeep()}catch(e){}})();
  Object.assign(S.px,await prices([C.index,...S.tre.filter(t=>t.coin).map(t=>t.coin)]));
  Object.assign(S.px,await prices([SIX.coin]));
  try{const j=await bs('/tokens/'+SIX.coin);S.holders[SIX.coin]={n:+(j.holders_count||j.holders)||null}}catch(e){}
  const bskAssets=[...new Set(S.tre.flatMap(t=>(t.basket||[]).map(b=>b[0])))];
  await Promise.all([...S.tre.filter(t=>t.coin).map(t=>t.coin).slice(0,40),...bskAssets]
   .map(a=>meta(a).catch(()=>{})));
  paintTop();renderOver();renderProt();renderKeep();try{renderWEmpty()}catch(e){}try{renderProv()}catch(e){}
  /* warm the INDEX read in the background so opening tab 6 is instant */
  setTimeout(()=>loadIndex().catch(()=>{}),4000);
  status('live','');

  /* saved wallet */
  try{const saved=localStorage.getItem('si_w');
   if(saved){$('#wAddr').value=saved;SI.track(saved,'watch')}}catch(e){}

  /* ── everything below is ENRICHMENT: it runs detached so a slow explorer
     delays one panel instead of holding the whole terminal at "loading". ── */
  (async()=>{try{
    S.pools=await loadPools();
    await Promise.all([...new Set(S.pools.map(p=>p.token))].slice(0,30).map(a=>meta(a).catch(()=>{})));
    renderPipe();paintTop();
  }catch(e){$('#pipeP').innerHTML='<span class="chip2">pool scan unavailable right now — the RPC returned an error. Reload to retry.</span>'}})();

  (async()=>{try{
    S.dist=await loadDistributions(S.tre);
    if(S.dist.length){Object.assign(S.px,await prices(S.dist.map(d=>d.assetAddr)))}
    renderOver();
  }catch(e){}
   if(!S.dist.length)$('#feedDist').innerHTML='<div class="spin">distribution feed unavailable — the public explorer is rate-limiting right now. Payout counts and clocks above are unaffected.</div>';
  })();

  (async()=>{/* no cap: a .slice(0,16) here left 9 coins uncounted forever, which
     permanently blanked the keeper sweep/capacity KPIs (they refuse to publish
     until coverage is complete — correctly). A cap on the loader is a silent
     OFF switch for everything downstream of it. */
   for(const t of S.tre.filter(x=>x.coin)){
    if(S.holders[t.coin])continue;
    try{const r=await bs('/tokens/'+t.coin);S.holders[t.coin]={n:+(r.holders_count||r.holders)||null}}catch(e){}
    await sleep(750)}
   renderProt();try{renderKeep()}catch(e){}})();
 }catch(e){status('chain unreachable — retrying','bad');setTimeout(boot,20000)}
}
try{const fd=document.getElementById('flagDate');
 if(fd)fd.textContent=new Date().toLocaleDateString('en-US',{timeZone:'America/New_York',year:'numeric',month:'short',day:'numeric'}).toUpperCase()}catch(e){}
try{const b=document.getElementById('thBtn');
 if(b)b.textContent=document.documentElement.getAttribute('data-theme')==='dark'?'☀':'◐'}catch(e){}
boot();
/* live refresh: prices + keeper every 60s. Never rebuild a table under the cursor. */
setInterval(async()=>{
 try{
  Object.assign(S.px,await prices([C.index,...S.tre.filter(t=>t.coin).map(t=>t.coin)]));
  S.keeper=await keeperState();
  paintTop();renderKeep();
  if($('#v-over').classList.contains('on'))renderOver();
  if($('#v-prot').classList.contains('on')&&!$('#tblProt table:hover'))renderProt();
 }catch(e){}},60000);

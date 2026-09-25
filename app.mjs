import {PAIRS, INTERVALS, parseCandles, analyze, emaSeries, rsiSeries, macdSeries} from './engine.mjs';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const params=new URLSearchParams(location.search);
const initialSymbol=(params.get('symbol')||'BTCUSDT').toUpperCase();
const defaultWatch=['BTCUSDT','ETHUSDT','SOLUSDT','CRVTRY','BNBUSDT','XRPUSDT'];
let savedWatch;try{savedWatch=JSON.parse(localStorage.getItem('pofcu-watchlist')||'null');}catch(_){}
const state={symbol:/^[A-Z0-9]{3,20}$/.test(initialSymbol)?initialSymbol:'BTCUSDT',interval:INTERVALS[params.get('interval')]?params.get('interval'):'1h',
  watch:Array.isArray(savedWatch)?[...new Set(savedWatch.filter(s=>/^[A-Z0-9]{3,20}$/.test(s)))].slice(0,18):defaultWatch,
  candles:[],analysis:null,ticker:null,tickers:{},showEMA:true,showBB:false,showVolume:true,viewCount:85,offset:0,hover:-1,pointer:null,drag:null,ai:false,request:0};
if(!state.watch.includes(state.symbol))state.watch.unshift(state.symbol);
const money=n=>new Intl.NumberFormat('en-US',{maximumFractionDigits:n>=100?2:n>=1?4:8}).format(n);
const fmt=n=>Number.isFinite(Number(n))?money(Number(n)):'—';
const pct=n=>`${n>=0?'+':''}${Number(n).toFixed(2)}%`;
const time=n=>new Intl.DateTimeFormat('tr-TR',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Istanbul'}).format(n);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function pair(symbol){
  const quote=['FDUSD','USDT','USDC','TRY','BTC'].find(q=>symbol.endsWith(q))||'';
  return {base:quote?symbol.slice(0,-quote.length):symbol,quote:quote||'—',label:PAIRS[symbol]?.label||symbol};
}
function currency(){return pair(state.symbol).quote==='TRY'?'₺':pair(state.symbol).quote==='BTC'?'₿':'$';}
async function getJSON(url,timeout=12000){const res=await fetch(url,{signal:AbortSignal.timeout(timeout),headers:{accept:'application/json'}});if(!res.ok)throw new Error(`Veri sağlayıcısı ${res.status} yanıtı verdi.`);return res.json();}
async function market(symbol,interval){
  try {const d=await getJSON(`/api/market?symbol=${symbol}&interval=${interval}`);if(Array.isArray(d.candles))return d.candles;}catch(_){}
  return getJSON(`https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=260`);
}
async function ticker(symbol){
  try {const d=await getJSON(`/api/ticker?symbol=${symbol}`,8000);if(d.lastPrice)return d;}catch(_){}
  return getJSON(`https://data-api.binance.vision/api/v3/ticker/24hr?symbol=${symbol}`,8000);
}
function updateURL(){const u=new URL(location.href);u.searchParams.set('source','binance');u.searchParams.set('symbol',state.symbol);u.searchParams.set('interval',state.interval);history.replaceState(null,'',u);}
function renderWatch(){
  $('#watch-items').innerHTML=state.watch.map(symbol=>{
    const p=pair(symbol),q=state.tickers[symbol],price=q?fmt(q.lastPrice):'—',change=q?Number(q.priceChangePercent):null;
    return `<button class="watch-item ${symbol===state.symbol?'active':''}" type="button" data-symbol="${esc(symbol)}"><span><strong>${esc(p.base)} / ${esc(p.quote)}</strong><small>${esc(PAIRS[symbol]?.label||'Binance Spot')}</small></span><span class="watch-price">${price}<em class="${change===null?'':change>=0?'positive':'negative'}">${change===null?'—':pct(change)}</em></span></button>`;
  }).join('');
}
function renderHeader(){
  const p=pair(state.symbol),quote=currency(),current=Number(state.ticker?.lastPrice)||state.analysis?.price;
  $('#pair-text').textContent=`${p.base} / ${p.quote}`;$('#pair-label').textContent=`${p.base} / ${p.quote}`;$('#asset-name').firstChild.textContent=p.label+' ';
  $('#coin-icon').textContent=p.base==='BTC'?'₿':p.base.charAt(0);
  $('#live-price').textContent=current?quote+fmt(current):'—';
  const change=Number(state.ticker?.priceChangePercent);
  $('#day-change').textContent=state.ticker?.priceChangePercent!==undefined?pct(change):'—';
  $('#day-change').className=state.ticker?.priceChangePercent===undefined?'':change>=0?'positive':'negative';
  $('#day-range').textContent=state.ticker?.highPrice?`${quote}${fmt(state.ticker.highPrice)} / ${quote}${fmt(state.ticker.lowPrice)}`:'—';
  $('#last-update').textContent=state.analysis?`Son kapanış ${time(state.analysis.asOf)} TSİ`:'Veri bekleniyor';
  $$('.timeframes button').forEach(b=>b.classList.toggle('active',b.dataset.interval===state.interval));
}
function renderAnalysis(){
  const a=state.analysis;if(!a)return;const i=a.indicators,kind=a.score>=3?'buy':a.score<=-3?'sell':'wait';
  const color=kind==='buy'?'positive':kind==='sell'?'negative':'neutral',ratio=Math.round((a.score+5)/10*100),quote=currency();
  $('#analysis-content').innerHTML=`<div class="signal-card ${kind==='buy'?'':kind}"><span class="overline">${esc(state.interval)} · TEKNİK SİNYAL</span><strong class="${color}">${esc(a.direction)}</strong><small>${a.bull} olumlu · ${a.bear} olumsuz · ${a.factors.filter(f=>f.weight===0).length} nötr</small></div>
  <div class="confidence"><div class="confidence-head"><span>GÖSTERGE DENGESİ</span><span class="${color}">${a.score>0?'+':''}${a.score} / 5</span></div><div class="confidence-bar"><i class="${kind==='buy'?'':kind}" style="width:${ratio}%"></i></div></div>
  <div class="insight-section"><h3>TEKNİK GÖSTERGELER</h3><div class="insight-row"><span>RSI (14)</span><strong>${i.rsi.toFixed(1)}</strong></div><div class="insight-row"><span>MACD histogramı</span><strong class="${i.macdHistogram>=0?'positive':'negative'}">${i.macdHistogram.toFixed(4)}</strong></div><div class="insight-row"><span>EMA 20 / 50</span><strong>${quote}${fmt(i.ema20)} / ${quote}${fmt(i.ema50)}</strong></div><div class="insight-row"><span>ADX · trend gücü</span><strong>${i.adx.toFixed(1)}</strong></div><div class="insight-row"><span>Hacim / ortalama</span><strong>${i.volumeRatio===null?'—':i.volumeRatio.toFixed(2)+'×'}</strong></div><div class="insight-row"><span>ATR / fiyat</span><strong>${i.atrPercent.toFixed(2)}%</strong></div></div>
  <div class="insight-section"><h3>SİNYALİN GEREKÇELERİ</h3>${a.factors.map(f=>`<div class="factor"><span class="mark ${f.weight>0?'positive':f.weight<0?'negative':'neutral'}">${f.weight>0?'↑':f.weight<0?'↓':'–'}</span><strong>${esc(f.name)}</strong>${esc(f.detail)}</div>`).join('')}</div>
  <div class="insight-section"><h3>İZLENECEK SEVİYELER</h3><div class="insight-row"><span>Son 20 mum dip / tepe</span><strong>${quote}${fmt(i.support)} / ${quote}${fmt(i.resistance)}</strong></div><div class="insight-row"><span>Bollinger alt / üst</span><strong>${quote}${fmt(i.bollingerLower)} / ${quote}${fmt(i.bollingerUpper)}</strong></div></div>
  ${a.notes.length?`<div class="risk-note">${a.notes.map(n=>`• ${esc(n)}`).join('<br>')}</div>`:''}<p class="source-note">Kaynak: Binance spot · ${time(a.asOf)} TSİ · Yalnızca kapanmış mumlar.</p><div id="fundamental-section"></div>`;
  if(PAIRS[state.symbol]?.gecko)loadFundamentals(state.symbol,state.request);
}
async function loadFundamentals(symbol,req){
  try{
    const id=PAIRS[symbol].gecko;let data;
    try{data=await getJSON(`/api/fundamentals?coin=${id}`,9000);}catch(_){data=await getJSON(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${id}`,9000);}
    if(req!==state.request||!data?.[0])return;
    const c=data[0],el=$('#fundamental-section');if(!el)return;
    el.innerHTML=`<div class="insight-section"><h3>PİYASA VERİLERİ <span class="overline">· COINGECKO</span></h3><div class="insight-row"><span>Piyasa değeri</span><strong>${c.market_cap?'$'+new Intl.NumberFormat('tr-TR',{notation:'compact',maximumFractionDigits:1}).format(c.market_cap):'—'}</strong></div><div class="insight-row"><span>24s hacim</span><strong>${c.total_volume?'$'+new Intl.NumberFormat('tr-TR',{notation:'compact',maximumFractionDigits:1}).format(c.total_volume):'—'}</strong></div><div class="insight-row"><span>Piyasa sırası</span><strong>${c.market_cap_rank?'#'+c.market_cap_rank:'—'}</strong></div><div class="factor">Bu veriler teknik sinyal puanına dahil değildir.</div></div>`;
  }catch(_){}
}
function setup(canvas){const dpr=window.devicePixelRatio||1,r=canvas.getBoundingClientRect(),w=Math.max(1,r.width),h=Math.max(1,r.height);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);return {c,w,h};}
function pathLine(c,values,toX,toY,start,end,color,width=1.5){c.beginPath();let begun=false;for(let j=start;j<end;j++){const v=values[j];if(v===null||!Number.isFinite(v)){begun=false;continue;}const x=toX(j-start),y=toY(v);if(!begun)c.moveTo(x,y);else c.lineTo(x,y);begun=true;}c.strokeStyle=color;c.lineWidth=width;c.stroke();}
function visibleRange(){const end=Math.max(0,state.candles.length-state.offset);const start=Math.max(0,end-state.viewCount);return {start,end,items:state.candles.slice(start,end)};}
function drawPrice(){
  const canvas=$('#price-chart'),{c,w,h}=setup(canvas);c.clearRect(0,0,w,h);const {start,end,items}=visibleRange();if(!items.length)return;
  const L=14,R=68,T=22,B=h-36,priceBottom=state.showVolume?h*.76:h-38,volTop=h*.80;
  const lows=items.map(x=>x.low),highs=items.map(x=>x.high),mn=Math.min(...lows),mx=Math.max(...highs),pad=(mx-mn||mx*.01)*.075,lo=mn-pad,hi=mx+pad;
  const y=v=>T+(hi-v)/(hi-lo)*(priceBottom-T),step=(w-L-R)/items.length,x=j=>L+step*(j+.5);
  c.font="10px 'DM Mono',monospace";c.textAlign='left';
  for(let k=0;k<=4;k++){const yy=T+k*(priceBottom-T)/4;c.strokeStyle='#263643';c.lineWidth=1;c.beginPath();c.moveTo(L,yy+.5);c.lineTo(w-R,yy+.5);c.stroke();c.fillStyle='#70868d';c.fillText(fmt(hi-k*(hi-lo)/4),w-R+7,yy+3);}
  for(let k=0;k<=5;k++){const j=Math.round(k*(items.length-1)/5),xx=x(j);c.strokeStyle='#1b2b37';c.beginPath();c.moveTo(xx,T);c.lineTo(xx,B);c.stroke();c.fillStyle='#6d838b';c.fillText(new Intl.DateTimeFormat('tr-TR',{day:'2-digit',month:'2-digit',hour:state.interval==='1d'||state.interval==='1w'?undefined:'2-digit',timeZone:'Europe/Istanbul'}).format(items[j].time),Math.max(L,xx-20),h-15);}
  const closes=state.candles.map(q=>q.close);
  if(state.showBB){const upper=closes.map((_,j)=>{if(j<19)return null;const v=closes.slice(j-19,j+1),m=v.reduce((a,b)=>a+b,0)/20,s=Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/20);return m+2*s;});const lower=closes.map((_,j)=>{if(j<19)return null;const v=closes.slice(j-19,j+1),m=v.reduce((a,b)=>a+b,0)/20,s=Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/20);return m-2*s;});pathLine(c,upper,x,y,start,end,'#5f86b8aa');pathLine(c,lower,x,y,start,end,'#5f86b8aa');}
  if(state.showEMA){pathLine(c,emaSeries(closes,20),x,y,start,end,'#c4f67c',1.5);pathLine(c,emaSeries(closes,50),x,y,start,end,'#e9c98c',1.3);}
  const maxVol=Math.max(...items.map(q=>q.volume),1);
  items.forEach((q,j)=>{const xx=x(j),up=q.close>=q.open,color=up?'#7ed5a5':'#e17f83',cw=Math.max(1,Math.min(12,step*.7));c.strokeStyle=color;c.lineWidth=1;c.beginPath();c.moveTo(xx,y(q.high));c.lineTo(xx,y(q.low));c.stroke();c.fillStyle=color;c.fillRect(xx-cw/2,Math.min(y(q.open),y(q.close)),cw,Math.max(1,Math.abs(y(q.open)-y(q.close))));if(state.showVolume){c.fillStyle=up?'#528b7890':'#a3596280';c.fillRect(xx-cw/2,B-(q.volume/maxVol)*(B-volTop),cw,Math.max(1,(q.volume/maxVol)*(B-volTop)));}});
  if(state.hover>=start&&state.hover<end&&state.pointer){const j=state.hover-start,xx=x(j),q=state.candles[state.hover];c.setLineDash([4,4]);c.strokeStyle='#9eb8b777';c.beginPath();c.moveTo(xx,T);c.lineTo(xx,B);c.moveTo(L,state.pointer.y);c.lineTo(w-R,state.pointer.y);c.stroke();c.setLineDash([]);c.fillStyle='#d7e8e1';c.fillText(`${currency()}${fmt(q.close)}`,w-R+3,Math.max(T+11,Math.min(priceBottom,state.pointer.y)));$('#ohlc').textContent=`A ${fmt(q.open)} · Y ${fmt(q.high)} · D ${fmt(q.low)} · K ${fmt(q.close)} · ${time(q.closeTime)} TSİ`;
  } else $('#ohlc').textContent='Mumun üzerine gel: açılış · yüksek · düşük · kapanış';
  $('#chart-time').textContent=`${time(items[0].time)} — ${time(items.at(-1).closeTime)} TSİ`;
}
function drawOscillators(){
  if(!state.candles.length)return;const closes=state.candles.map(x=>x.close),{start,end}=visibleRange();
  let {c,w,h}=setup($('#rsi-chart'));const rs=rsiSeries(closes),x=j=>9+(w-18)*(j-start)/Math.max(1,end-start-1),y=v=>9+(100-v)/100*(h-20);
  [30,70].forEach(v=>{c.setLineDash([3,4]);c.strokeStyle='#455667';c.beginPath();c.moveTo(8,y(v));c.lineTo(w-8,y(v));c.stroke();c.setLineDash([]);c.fillStyle='#778c92';c.font='9px monospace';c.fillText(String(v),w-23,y(v)-3);});pathLine(c,rs,j=>x(j+start),y,start,end,'#b393f2',1.6);
  const m=macdSeries(closes);({c,w,h}=setup($('#macd-chart')));const hist=m.histogram.slice(start,end).filter(Number.isFinite),range=Math.max(...hist.map(Math.abs),.0001)*1.2,center=h/2,scale=(h*.43)/range,step=(w-18)/Math.max(1,end-start);
  c.strokeStyle='#43545e';c.beginPath();c.moveTo(7,center+.5);c.lineTo(w-7,center+.5);c.stroke();
  for(let j=start;j<end;j++){const v=m.histogram[j];if(v===null)continue;c.fillStyle=v>=0?'#7ed5a5b0':'#e17f83b0';const xx=9+(j-start)*step,yy=center-v*scale;c.fillRect(xx,Math.min(center,yy),Math.max(1,step*.67),Math.max(1,Math.abs(yy-center)));}
  pathLine(c,m.line,j=>9+(j+start-start)*step, v=>center-v*scale,start,end,'#6aa7eb',1.2);
  pathLine(c,m.signal,j=>9+(j+start-start)*step,v=>center-v*scale,start,end,'#e9c98c',1.1);
  $('#rsi-value').textContent=rs.at(-1)?.toFixed(1)||'—';$('#macd-value').textContent=m.histogram.at(-1)?.toFixed(4)||'—';
}
function redraw(){drawPrice();drawOscillators();}
async function loadMarket(){
  const req=++state.request,symbol=state.symbol,interval=state.interval;
  $('#chart-error').classList.add('hidden');$('#analysis-content').innerHTML='<div class="loading"><div class="loading-ring"></div><p>Göstergeler hesaplanıyor…</p></div>';
  state.analysis=null;state.ticker=null;state.candles=[];renderHeader();renderWatch();updateURL();redraw();
  try{
    const [rows,t]=await Promise.all([market(symbol,interval),ticker(symbol).catch(()=>null)]);if(req!==state.request)return;
    const candles=parseCandles(rows);if(Date.now()-candles.at(-1).closeTime>INTERVALS[interval]*3)throw new Error('Son kapanan mum güncel değil. Eski veriyle sinyal oluşturulmadı.');
    state.candles=candles;state.analysis=analyze(candles,interval,symbol);state.ticker=t;if(t)state.tickers[symbol]=t;
    state.offset=0;state.viewCount=85;state.hover=-1;state.pointer=null;
    renderHeader();renderWatch();renderAnalysis();redraw();
  }catch(e){if(req!==state.request)return;state.candles=[];state.analysis=null;redraw();$('#analysis-content').innerHTML='<div class="loading">Analiz verisi alınamadı.</div>';$('#chart-error').innerHTML=`<strong>Grafik yüklenemedi</strong>${esc(e.message)}<br>Paritenin Binance spot piyasasında işlem gördüğünü kontrol et veya biraz sonra yenile.`;$('#chart-error').classList.remove('hidden');}
}
async function refreshTicker(){if(!state.analysis||document.hidden)return;try{const symbol=state.symbol,t=await ticker(symbol);if(symbol!==state.symbol)return;state.ticker=t;state.tickers[symbol]=t;renderHeader();renderWatch();}catch(_){}}
async function refreshWatch(){if(document.hidden)return;const symbols=state.watch.slice(0,12);await Promise.allSettled(symbols.map(async symbol=>{try{state.tickers[symbol]=await ticker(symbol);}catch(_){}}));renderWatch();}
async function searchSymbols(query){const q=query.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,16);let results=[];try{const d=await getJSON(`/api/symbols?q=${q}`,10000);results=d.symbols||[];}catch(_){results=Object.keys(PAIRS).filter(s=>s.includes(q)).map(s=>({...pair(s),symbol:s}));}
  return results;
}
let searchReq=0,searchTimer;
async function showResults(value){const req=++searchReq;$('#symbol-results').innerHTML='<div class="no-results">Pariteler aranıyor…</div>';const rows=await searchSymbols(value);if(req!==searchReq)return;$('#symbol-results').innerHTML=rows.length?rows.map(x=>`<button type="button" class="symbol-result" data-symbol="${esc(x.symbol)}"><strong>${esc(x.base)} / ${esc(x.quote)}</strong><span>${esc(x.symbol)}</span></button>`).join(''):'<div class="no-results">Eşleşen spot parite bulunamadı.</div>';}
function openDialog(){const d=$('#symbol-dialog');d.showModal();$('#symbol-input').value='';$('#symbol-input').focus();showResults('');}
function selectSymbol(symbol){if(!/^[A-Z0-9]{3,20}$/.test(symbol))return;state.symbol=symbol;if(!state.watch.includes(symbol)){state.watch.unshift(symbol);state.watch=state.watch.slice(0,18);localStorage.setItem('pofcu-watchlist',JSON.stringify(state.watch));}$('#symbol-dialog').close();loadMarket();}
$('#pair-picker').addEventListener('click',openDialog);$('#watch-search').addEventListener('click',openDialog);$('#watch-add').addEventListener('click',openDialog);$('#dialog-close').addEventListener('click',()=>$('#symbol-dialog').close());
$('#symbol-dialog').addEventListener('click',e=>{if(e.target===$('#symbol-dialog'))$('#symbol-dialog').close();});
$('#symbol-input').addEventListener('input',e=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>showResults(e.target.value),180);});
$('#symbol-results').addEventListener('click',e=>{const b=e.target.closest('[data-symbol]');if(b)selectSymbol(b.dataset.symbol);});
$('#watch-items').addEventListener('click',e=>{const b=e.target.closest('[data-symbol]');if(b&&b.dataset.symbol!==state.symbol){state.symbol=b.dataset.symbol;loadMarket();}});
$$('[data-interval]').forEach(b=>b.addEventListener('click',()=>{if(state.interval!==b.dataset.interval){state.interval=b.dataset.interval;loadMarket();}}));
$('#refresh').addEventListener('click',loadMarket);
[['#toggle-ema','showEMA'],['#toggle-bb','showBB'],['#toggle-volume','showVolume']].forEach(([sel,key])=>$(sel).addEventListener('click',e=>{state[key]=!state[key];e.currentTarget.classList.toggle('on',state[key]);e.currentTarget.setAttribute('aria-pressed',String(state[key]));redraw();}));
$('#reset-zoom').addEventListener('click',()=>{state.viewCount=85;state.offset=0;state.hover=-1;redraw();});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!$('#symbol-dialog').open&&document.activeElement?.tagName!=='INPUT'){e.preventDefault();openDialog();}});
const chart=$('#price-chart');
chart.addEventListener('wheel',e=>{if(!state.candles.length)return;e.preventDefault();state.viewCount=Math.max(30,Math.min(180,state.viewCount+(e.deltaY>0?12:-12)));state.offset=Math.min(state.offset,Math.max(0,state.candles.length-state.viewCount));redraw();},{passive:false});
chart.addEventListener('pointerdown',e=>{state.drag={x:e.clientX,offset:state.offset};chart.setPointerCapture(e.pointerId);});
chart.addEventListener('pointermove',e=>{if(!state.candles.length)return;const r=chart.getBoundingClientRect(),{start,end}=visibleRange();if(state.drag){const step=(r.width-82)/Math.max(1,end-start);state.offset=Math.max(0,Math.min(state.candles.length-state.viewCount,state.drag.offset+Math.round((e.clientX-state.drag.x)/step)));}const x=e.clientX-r.left;state.hover=Math.max(start,Math.min(end-1,start+Math.floor((x-14)/((r.width-82)/Math.max(1,end-start)))));state.pointer={x,y:e.clientY-r.top};drawPrice();if(state.drag)drawOscillators();});
chart.addEventListener('pointerup',()=>state.drag=null);chart.addEventListener('pointercancel',()=>state.drag=null);chart.addEventListener('pointerleave',()=>{if(!state.drag){state.hover=-1;state.pointer=null;drawPrice();}});
new ResizeObserver(()=>{if(state.candles.length)redraw();}).observe($('.chart-shell'));
new ResizeObserver(()=>{if(state.candles.length)drawOscillators();}).observe($('.pane-grid'));
$('#ai-button').addEventListener('click',async()=>{const b=$('#ai-button'),o=$('#ai-output');b.disabled=true;b.textContent='Yorum hazırlanıyor…';o.textContent='';try{const r=await fetch('/api/yorum',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({symbol:state.symbol,interval:state.interval}),signal:AbortSignal.timeout(30000)}),d=await r.json();if(!r.ok)throw new Error(d.error||'Yorum alınamadı.');o.textContent=d.text;}catch(e){o.textContent=e.message;}finally{b.disabled=false;b.textContent='Yapay zekâ ile tekrar yorumla ↗';}});
getJSON('/api/status',2500).then(s=>{state.ai=!!s.ai;$('#ai-button').classList.toggle('hidden',!state.ai);if(state.ai)$('#ai-description').textContent='Kapanmış mumlar ve indikatörleri yapay zekâ ile birlikte yorumla.';}).catch(()=>{});
renderWatch();renderHeader();loadMarket();refreshWatch();setInterval(refreshTicker,15000);setInterval(refreshWatch,60000);setInterval(()=>{if(!document.hidden&&state.analysis)loadMarket();},60000);

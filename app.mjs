import { PAIRS, INTERVALS, parseCandles, analyze } from './engine.mjs';

const $ = s => document.querySelector(s);
const asset=$('#asset'), result=$('#result'), fundamentals=$('#fundamentals'), run=$('#run');
let interval='1h', latest=null, aiAvailable=false, requestId=0;
$('#year').textContent=new Date().getFullYear();
document.querySelectorAll('[data-interval]').forEach(button=>button.addEventListener('click',()=>{
  interval=button.dataset.interval;
  document.querySelectorAll('[data-interval]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});
}));
const money = n => new Intl.NumberFormat('en-US',{maximumFractionDigits:n>=100?2:n>=1?4:7}).format(n);
const compact = n => new Intl.NumberFormat('tr-TR',{notation:'compact',maximumFractionDigits:2}).format(n);
const date = n => new Intl.DateTimeFormat('tr-TR',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Istanbul'}).format(n);
const safe = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const indicator=(name,value,cls='')=>`<div class="indicator"><span class="mini">${name}</span><strong class="${cls}">${value}</strong></div>`;

function chart(points,direction){
  const w=760,h=155,pad=12,low=Math.min(...points.map(p=>p.close)),high=Math.max(...points.map(p=>p.close));
  const range=high-low||1;
  const coords=points.map((p,i)=>[pad+i*(w-2*pad)/(points.length-1),h-pad-(p.close-low)/range*(h-2*pad)]);
  const d=coords.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const color=direction==='Olası alım sinyali'?'#c8f875':direction==='Olası satış sinyali'?'#ff8b85':'#e6c887';
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Son ${points.length} kapanmış mumun fiyat çizgisi"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${color}" stop-opacity=".22"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${d} L${coords.at(-1)[0]},${h} L${pad},${h} Z" fill="url(#fill)"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2.4" vector-effect="non-scaling-stroke"/></svg>`;
}
function showAnalysis(a,source){
  const i=a.indicators,kind=a.score>=3?'positive':a.score<=-3?'negative':'neutral';
  const bg=a.score>=3?'':a.score<=-3?'negative-bg':'neutral-bg';
  result.innerHTML=`<div class="meta"><span>${safe(a.symbol.replace('USDT',' / USDT'))} · ${safe(a.interval)} · KAPANMIŞ MUM</span><span>${date(a.asOf)} TSİ</span></div>
  <div class="asset-row"><div><h3>${safe(PAIRS[a.symbol].label)}</h3><small>Son kapanan mum fiyatı</small></div><div class="price">$${money(a.price)}<small class="${a.change>=0?'positive':'negative'}">${a.change>=0?'+':''}${a.change.toFixed(2)}% · ÖNCEKİ MUM</small></div></div>
  ${chart(a.chart,a.direction)}
  <div class="signal ${bg}"><div><span class="mini">TEKNİK GÖSTERGE SONUCU</span><strong class="${kind}">${a.direction}</strong></div><span class="signal-score ${kind}">${a.score>0?'+':''}${a.score} / 5</span></div>
  <div class="indicator-grid">${indicator('RSI · 14',i.rsi.toFixed(1),i.rsi>70||i.rsi<30?'neutral':'')}${indicator('MACD HIST.',i.macdHistogram.toFixed(4),i.macdHistogram>=0?'positive':'negative')}${indicator('ADX · 14',i.adx.toFixed(1))}${indicator('HACİM / ORT.',i.volumeRatio===null?'—':i.volumeRatio.toFixed(2)+'×')}${indicator('EMA · 20','$'+money(i.ema20))}${indicator('EMA · 50','$'+money(i.ema50))}${indicator('EMA · 200',i.ema200===null?'—':'$'+money(i.ema200))}${indicator('ATR / FİYAT',i.atrPercent.toFixed(2)+'%')}</div>
  <details><summary>Göstergeler nasıl yorumlandı? · ${a.bull} olumlu / ${a.bear} olumsuz</summary><ul class="factor-list">${a.factors.map(f=>`<li><strong>${safe(f.name)} <span class="${f.weight>0?'positive':f.weight<0?'negative':'neutral'}">${f.weight>0?'↑':f.weight<0?'↓':'–'}</span></strong><span>${safe(f.detail)}</span></li>`).join('')}<li><strong>20 mum aralığı</strong><span>Destek: $${money(i.support)} · Direnç: $${money(i.resistance)} (geçmiş aralık, ileriye dönük garanti değil)</span></li><li><strong>Bollinger</strong><span>Alt $${money(i.bollingerLower)} · Üst $${money(i.bollingerUpper)}</span></li></ul></details>
  <div class="risk">${a.notes.map(s=>`• ${safe(s)}`).join('<br>') || '• Göstergeler geleceği garanti etmez; işlem öncesi riskini değerlendir.'}</div>
  <div class="risk" style="color:#718985">Kaynak: ${source==='server'?'Pofçu veri sunucusu üzerinden ':'Doğrudan '}Binance spot · ${date(a.asOf)} TSİ</div>
  ${aiAvailable?'<button id="ai-button" class="run" type="button">Yapay zekâ yorumunu getir <span>↗</span></button><div id="ai-output" class="risk" aria-live="polite"></div>':''}`;
  if(aiAvailable) $('#ai-button').addEventListener('click',loadAI);
}
async function json(url){const r=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{accept:'application/json'}});if(!r.ok)throw new Error(`Veri kaynağı yanıt vermedi (${r.status}).`);return r.json();}
async function market(symbol,interval){
  try { const data=await json(`/api/market?symbol=${symbol}&interval=${interval}`);if(!data.candles)throw new Error('Sunucu verisi eksik.');return {rows:data.candles,source:'server'}; }
  catch(_) { const rows=await json(`https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=260`);return {rows,source:'direct'}; }
}
async function getFundamentals(symbol,id){
  const coin=PAIRS[symbol].gecko;
  try{
    let data;
    try {data=await json(`/api/fundamentals?coin=${coin}`);} catch(_){data=await json(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coin}&price_change_percentage=24h`);}
    if(id!==requestId||!Array.isArray(data)||!data[0])return;
    const c=data[0];
    if(!c.market_cap&&!c.total_volume)return;
    fundamentals.innerHTML=`<h3>Proje & piyasa verileri <span class="mini">· COINGECKO</span></h3><div class="fundamental-grid"><div><span class="mini">PİYASA DEĞERİ</span><strong>${c.market_cap?'$'+compact(c.market_cap):'—'}</strong></div><div><span class="mini">24 SAAT HACİM</span><strong>${c.total_volume?'$'+compact(c.total_volume):'—'}</strong></div><div><span class="mini">DOLAŞIM</span><strong>${c.circulating_supply?compact(c.circulating_supply)+' '+safe(PAIRS[symbol].ticker):'—'}</strong></div><div><span class="mini">PİYASA SIRASI</span><strong>${c.market_cap_rank?'#'+c.market_cap_rank:'—'}</strong></div></div><p>Bu bölüm teknik skoru etkilemez. Piyasa değeri ve hacim proje kârlılığı, zincir üstü faaliyet veya gerçek zamanlı para akışı anlamına gelmez. Kaynak: CoinGecko.</p>`;
    fundamentals.classList.remove('hidden');
  }catch(_){if(id===requestId){fundamentals.innerHTML='<p>Proje ve piyasa verileri şu anda alınamıyor. Teknik analiz bağımsız olarak gösterilir.</p>';fundamentals.classList.remove('hidden');}}
}
async function loadAI(){
  const button=$('#ai-button'),out=$('#ai-output');button.disabled=true;button.textContent='Yorum hazırlanıyor…';out.textContent='';
  try{const r=await fetch('/api/yorum',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({symbol:latest.symbol,interval:latest.interval}),signal:AbortSignal.timeout(30000)});
    const data=await r.json();if(!r.ok)throw new Error(data.error||'Yorum alınamadı.');out.textContent=data.text;
  }catch(e){out.textContent=`Yapay zekâ yorumu şu anda alınamadı: ${e.message}`;}finally{button.disabled=false;button.textContent='Yapay zekâ yorumunu yenile ↗';}
}
async function runAnalysis(){
  const id=++requestId,symbol=asset.value;run.disabled=true;run.textContent='Veriler okunuyor…';fundamentals.classList.add('hidden');
  result.innerHTML='<div class="empty"><div class="empty-glyph">⌁</div><h3>Veriler okunuyor…</h3><p>Son kapanan mumlar ve göstergeler hesaplanıyor.</p></div>';
  try{
    const {rows,source}=await market(symbol,interval);if(id!==requestId)return;
    const candles=parseCandles(rows),maxAge=INTERVALS[interval]*3;
    if(Date.now()-candles.at(-1).closeTime>maxAge)throw new Error('Son kapanan mum güncel değil. Eski veriyle sinyal üretilmedi.');
    latest=analyze(candles,interval,symbol);showAnalysis(latest,source);getFundamentals(symbol,id);
  }catch(e){if(id===requestId){result.innerHTML=`<div class="error-state"><strong>Analiz yüklenemedi</strong><p>${safe(e.message)} Veri sağlayıcısı bulunduğun bölgede erişime kapalı veya geçici olarak yanıt vermiyor olabilir. Bir süre sonra tekrar dene.</p></div>`;}}
  finally{if(id===requestId){run.disabled=false;run.innerHTML='Piyasayı yeniden analiz et <span aria-hidden="true">↗</span>';}}
}
run.addEventListener('click',runAnalysis);
fetch('/api/status',{signal:AbortSignal.timeout(2500)}).then(r=>r.ok?r.json():null).then(v=>{aiAvailable=!!v?.ai;}).catch(()=>{});

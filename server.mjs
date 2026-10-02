import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INTERVALS, parseCandles, analyze } from './engine.mjs';
import { scanSymbols, scanRow, SCAN_PRESETS } from './scanner.mjs';
import { cmcId, contextIntervals, normalizeCmc, normalizeFear, assessOutlook } from './outlook.mjs';

const root=fileURLToPath(new URL('.',import.meta.url));
const port=Number(process.env.PORT)||3000;
const cache=new Map(),inflight=new Map(),ipUsage=new Map();
const daily={date:'',count:0};
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.ico':'image/x-icon'};
function send(res,status,value){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(value));}
async function upstream(url,ttl,timeout=10000){
  const hit=cache.get(url);if(hit&&hit.exp>Date.now())return hit.data;
  if(inflight.has(url))return inflight.get(url);
  const pending=(async()=>{
    const response=await fetch(url,{signal:AbortSignal.timeout(timeout),headers:{accept:'application/json'}});
    if(!response.ok)throw new Error(`Veri kaynağı hatası: ${response.status}`);
    const data=await response.json();cache.set(url,{data,exp:Date.now()+ttl});return data;
  })();
  inflight.set(url,pending);
  try{return await pending;}finally{inflight.delete(url);}
}
function validSymbol(symbol){return typeof symbol==='string'&&/^[A-Z0-9]{3,20}$/.test(symbol);}
function validate(url){const symbol=url.searchParams.get('symbol'),interval=url.searchParams.get('interval');if(!validSymbol(symbol)||!INTERVALS[interval])throw Object.assign(new Error('Desteklenmeyen parite veya zaman aralığı.'),{status:400});return {symbol,interval};}
async function candles(symbol,interval){return upstream(`https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=260`,45_000);}
async function outlook(symbol,interval){
  const id=cmcId(symbol),intervals=contextIntervals(interval);
  const jobs=[candles(symbol,interval),...intervals.map(tf=>candles(symbol,tf)),
    id?upstream(`https://pro-api.coinmarketcap.com/public-api/v3/cryptocurrency/quotes/latest?id=${id}&convert=USD`,120_000):Promise.resolve(null),
    upstream('https://pro-api.coinmarketcap.com/public-api/v3/fear-and-greed/latest',600_000)];
  const results=await Promise.allSettled(jobs);
  if(results[0].status!=='fulfilled')throw new Error('Binance temel periyot verisi alınamadı.');
  const parse=(rows,tf)=>{const closed=parseCandles(rows);if(Date.now()-closed.at(-1).closeTime>INTERVALS[tf]*3)throw new Error('Eski mum verisi.');return analyze(closed,tf,symbol);};
  const base=parse(results[0].value,interval),comparisons=[];
  for(let j=0;j<intervals.length;j++){
    if(results[j+1].status==='fulfilled')try{const a=parse(results[j+1].value,intervals[j]);comparisons.push({interval:a.interval,score:a.score,direction:a.direction,asOf:a.asOf});}catch(_){}
  }
  let cmc=null,fear=null;
  if(id&&results.at(-2).status==='fulfilled')try{cmc=normalizeCmc(results.at(-2).value,id);}catch(_){}
  if(results.at(-1).status==='fulfilled')try{fear=normalizeFear(results.at(-1).value);}catch(_){}
  return {symbol,interval,asOf:base.asOf,technical:{score:base.score,direction:base.direction,advanced:base.advanced,
    adx:base.indicators.adx,atrPercent:base.indicators.atrPercent},comparisons,cmc,fear,
    cmcCoverage:id?'known-asset':'unverified-symbol',assessment:assessOutlook(base,comparisons,cmc)};
}
async function scanner(url){
  const scope=url.searchParams.get('scope')||'watch',interval=url.searchParams.get('interval')||'1h';
  if(!INTERVALS[interval])throw Object.assign(new Error('Zaman aralığı geçersiz.'),{status:400});
  const requested=url.searchParams.get('symbols')||'';
  // Every candidate is verified by its Binance candles and ticker request below.
  // A slow exchangeInfo response must not block the whole market scan.
  let symbols;
  try{
    const candidates=scope==='watch'?requested.split(',').map(s=>s.trim()):SCAN_PRESETS[scope]||[];
    symbols=scanSymbols(scope,requested,new Set(candidates));
  }catch(e){throw Object.assign(e,{status:400});}
  if(!symbols.length)return {scope,interval,rows:[],failed:[],checkedAt:Date.now()};
  const rows=[],failed=[];
  let cursor=0;
  await Promise.all(Array.from({length:Math.min(6,symbols.length)},async()=>{
    while(cursor<symbols.length){
      const symbol=symbols[cursor++];
      for(let attempt=0;attempt<2;attempt++){
        try{
          const [klines,ticker]=await Promise.all([
            candles(symbol,interval),
            upstream(`https://data-api.binance.vision/api/v3/ticker/24hr?symbol=${symbol}`,15_000)
          ]);
          rows.push(scanRow(symbol,interval,klines,ticker));break;
        }catch(_){if(attempt===1)failed.push(symbol);}
      }
    }
  }));
  rows.sort((a,b)=>symbols.indexOf(a.symbol)-symbols.indexOf(b.symbol));
  return {scope,interval,rows,failed,checkedAt:Date.now()};
}
function rateLimit(req){
  // For a public deployment also set spending limits in the OpenAI dashboard.
  const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].trim().slice(0,80),now=Date.now();
  const current=ipUsage.get(ip)||{count:0,until:now+3_600_000};if(now>current.until){current.count=0;current.until=now+3_600_000;}current.count++;ipUsage.set(ip,current);
  const day=new Date().toISOString().slice(0,10);if(daily.date!==day){daily.date=day;daily.count=0;}
  const globalLimit=Number(process.env.AI_DAILY_LIMIT)||100;
  if(current.count>5||daily.count>=globalLimit)throw Object.assign(new Error('Yorum sınırına ulaşıldı. Daha sonra tekrar deneyin.'),{status:429});
  daily.count++;
}
async function aiComment(req,res){
  if(!process.env.OPENAI_API_KEY)return send(res,503,{error:'Yapay zekâ özelliği henüz etkin değil.'});
  let raw='';for await(const part of req){raw+=part;if(raw.length>1024){req.destroy();return;}}
  const params=JSON.parse(raw||'{}');if(!validSymbol(params.symbol)||!INTERVALS[params.interval])throw Object.assign(new Error('Desteklenmeyen parite.'),{status:400});
  rateLimit(req);
  const rows=await candles(params.symbol,params.interval),closed=parseCandles(rows);
  if(Date.now()-closed.at(-1).closeTime>INTERVALS[params.interval]*3)throw new Error('Piyasa verisi güncel değil.');
  const snapshot=analyze(closed,params.interval,params.symbol);
  const response=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',signal:AbortSignal.timeout(25000),headers:{authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'content-type':'application/json'},
    body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5.4-mini',store:false,max_output_tokens:500,
      instructions:'Sen Pofçu piyasa veri yorumcususun. Yalnızca verilen hesaplanmış verileri Türkçe, anlaşılır ve 110 kelimeyi geçmeden açıkla. Sonucun zaman aralığına, kapanmış mumlara ve belirsizliğe bağlı olduğunu belirt. Fiyat hedefi, garanti, kesin al/sat emri, kişisel yatırım tavsiyesi, uydurma haber, zincir üstü veri veya para akışı iddiası verme. Göstergeler çelişiyorsa bunu açıkça söyle.',
      input:JSON.stringify({symbol:snapshot.symbol,interval:snapshot.interval,asOf:snapshot.asOf,price:snapshot.price,direction:snapshot.direction,score:snapshot.score,indicators:snapshot.indicators,advanced:snapshot.advanced,factors:snapshot.factors,notes:snapshot.notes})})
  });
  if(!response.ok)throw new Error(`Yapay zekâ sağlayıcısı yanıt vermedi (${response.status}).`);
  const data=await response.json();
  const text=data.output?.filter(x=>x.type==='message').flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n').trim();
  if(!text)throw new Error('Yorum oluşturulamadı.');
  send(res,200,{text,asOf:snapshot.asOf,model:data.model});
}
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/api/status'&&req.method==='GET')return send(res,200,{ai:!!process.env.OPENAI_API_KEY});
    if(url.pathname==='/api/symbols'&&req.method==='GET'){
      const q=(url.searchParams.get('q')||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,16);
      const info=await upstream('https://data-api.binance.vision/api/v3/exchangeInfo',3_600_000,25_000);
      const symbols=(info.symbols||[]).filter(s=>s.status==='TRADING'&&['USDT','TRY','USDC','BTC','FDUSD'].includes(s.quoteAsset));
      const results=symbols.filter(s=>!q||s.symbol.includes(q)||s.baseAsset.includes(q)).sort((a,b)=>{
        const rank=x=>x.symbol===q?0:x.symbol.startsWith(q)?1:x.quoteAsset==='USDT'?2:x.quoteAsset==='TRY'?3:4;
        return rank(a)-rank(b)||a.symbol.localeCompare(b.symbol);
      }).slice(0,40).map(s=>({symbol:s.symbol,base:s.baseAsset,quote:s.quoteAsset}));
      return send(res,200,{symbols:results});
    }
    if(url.pathname==='/api/ticker'&&req.method==='GET'){
      const symbol=url.searchParams.get('symbol');if(!validSymbol(symbol))return send(res,400,{error:'Desteklenmeyen parite.'});
      const data=await upstream(`https://data-api.binance.vision/api/v3/ticker/24hr?symbol=${symbol}`,15_000);
      return send(res,200,{symbol:data.symbol,lastPrice:data.lastPrice,priceChangePercent:data.priceChangePercent,highPrice:data.highPrice,lowPrice:data.lowPrice,quoteVolume:data.quoteVolume,closeTime:data.closeTime});
    }
    if(url.pathname==='/api/scanner'&&req.method==='GET'){
      const scope=url.searchParams.get('scope')||'watch',interval=url.searchParams.get('interval')||'1h';
      const key=`scanner:${scope}:${interval}:${scope==='watch'?(url.searchParams.get('symbols')||''):''}`,hit=cache.get(key);
      if(hit&&hit.exp>Date.now())return send(res,200,hit.data);
      let pending=inflight.get(key);
      if(!pending){pending=scanner(url);inflight.set(key,pending);}
      try{const data=await pending;cache.set(key,{data,exp:Date.now()+30_000});return send(res,200,data);}
      finally{inflight.delete(key);}
    }
    if(url.pathname==='/api/outlook'&&req.method==='GET'){
      const {symbol,interval}=validate(url),key=`outlook:${symbol}:${interval}`,hit=cache.get(key);
      if(hit&&hit.exp>Date.now())return send(res,200,hit.data);
      let pending=inflight.get(key);if(!pending){pending=outlook(symbol,interval);inflight.set(key,pending);}
      try{const data=await pending;cache.set(key,{data,exp:Date.now()+60_000});return send(res,200,data);}
      finally{inflight.delete(key);}
    }
    if(url.pathname==='/api/market'&&req.method==='GET'){const {symbol,interval}=validate(url);return send(res,200,{candles:await candles(symbol,interval)});}
    if(url.pathname==='/api/yorum'&&req.method==='POST')return await aiComment(req,res);
    if(url.pathname.startsWith('/api/'))return send(res,404,{error:'API yolu bulunamadı.'});
    if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,{error:'Desteklenmeyen istek.'});
    const page=url.pathname==='/'?'/index.html':url.pathname;
    const path=resolve(root,'.'+decodeURIComponent(page));
    if(!path.startsWith(root)||!types[extname(path)])return send(res,404,{error:'Sayfa bulunamadı.'});
    const body=await readFile(path);
    res.writeHead(200,{'content-type':types[extname(path)],'cache-control':page==='/index.html'?'no-cache':'public, max-age=300','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin'});
    res.end(req.method==='HEAD'?undefined:body);
  }catch(e){send(res,e.status||((e.code==='ENOENT')?404:503),{error:e.status===400?e.message:'İstek şu anda tamamlanamadı. Lütfen tekrar deneyin.'});}
});
server.listen(port,()=>console.log(`Pofçu http://localhost:${port}`));

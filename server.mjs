import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAIRS, INTERVALS, parseCandles, analyze } from './engine.mjs';

const root=fileURLToPath(new URL('.',import.meta.url));
const port=Number(process.env.PORT)||3000;
const cache=new Map(),ipUsage=new Map();
const daily={date:'',count:0};
const allowedCoins=new Set(Object.values(PAIRS).map(p=>p.gecko));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.ico':'image/x-icon'};
function send(res,status,value){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(value));}
async function upstream(url,ttl){
  const hit=cache.get(url);if(hit&&hit.exp>Date.now())return hit.data;
  const response=await fetch(url,{signal:AbortSignal.timeout(10000),headers:{accept:'application/json'}});
  if(!response.ok)throw new Error(`Veri kaynağı hatası: ${response.status}`);
  const data=await response.json();cache.set(url,{data,exp:Date.now()+ttl});return data;
}
function validate(url){const symbol=url.searchParams.get('symbol'),interval=url.searchParams.get('interval');if(!PAIRS[symbol]||!INTERVALS[interval])throw new Error('Desteklenmeyen parite veya zaman aralığı.');return {symbol,interval};}
async function candles(symbol,interval){return upstream(`https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=260`,45_000);}
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
  const params=JSON.parse(raw||'{}');if(!PAIRS[params.symbol]||!INTERVALS[params.interval])throw Object.assign(new Error('Desteklenmeyen parite.'),{status:400});
  rateLimit(req);
  const rows=await candles(params.symbol,params.interval),closed=parseCandles(rows);
  if(Date.now()-closed.at(-1).closeTime>INTERVALS[params.interval]*3)throw new Error('Piyasa verisi güncel değil.');
  const snapshot=analyze(closed,params.interval,params.symbol);
  const response=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',signal:AbortSignal.timeout(25000),headers:{authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'content-type':'application/json'},
    body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5.4-mini',store:false,max_output_tokens:500,
      instructions:'Sen Pofçu piyasa veri yorumcususun. Yalnızca verilen hesaplanmış verileri Türkçe, anlaşılır ve 110 kelimeyi geçmeden açıkla. Sonucun zaman aralığına, kapanmış mumlara ve belirsizliğe bağlı olduğunu belirt. Fiyat hedefi, garanti, kesin al/sat emri, kişisel yatırım tavsiyesi, uydurma haber, zincir üstü veri veya para akışı iddiası verme. Göstergeler çelişiyorsa bunu açıkça söyle.',
      input:JSON.stringify({symbol:snapshot.symbol,interval:snapshot.interval,asOf:snapshot.asOf,price:snapshot.price,direction:snapshot.direction,score:snapshot.score,indicators:snapshot.indicators,factors:snapshot.factors,notes:snapshot.notes})})
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
    if(url.pathname==='/api/market'&&req.method==='GET'){const {symbol,interval}=validate(url);return send(res,200,{candles:await candles(symbol,interval)});}
    if(url.pathname==='/api/fundamentals'&&req.method==='GET'){
      const coin=url.searchParams.get('coin');if(!allowedCoins.has(coin))return send(res,400,{error:'Desteklenmeyen varlık.'});
      return send(res,200,await upstream(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coin}&price_change_percentage=24h`,90_000));
    }
    if(url.pathname==='/api/yorum'&&req.method==='POST')return await aiComment(req,res);
    if(url.pathname.startsWith('/api/'))return send(res,404,{error:'API yolu bulunamadı.'});
    if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,{error:'Desteklenmeyen istek.'});
    const page=url.pathname==='/'?'/index.html':url.pathname;
    const path=resolve(root,'.'+decodeURIComponent(page));
    if(!path.startsWith(root)||!types[extname(path)])return send(res,404,{error:'Sayfa bulunamadı.'});
    const body=await readFile(path);
    res.writeHead(200,{'content-type':types[extname(path)],'cache-control':'public, max-age=300','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin'});
    res.end(req.method==='HEAD'?undefined:body);
  }catch(e){send(res,e.status||((e.code==='ENOENT')?404:503),{error:e.status===400?e.message:'İstek şu anda tamamlanamadı. Lütfen tekrar deneyin.'});}
});
server.listen(port,()=>console.log(`Pofçu http://localhost:${port}`));

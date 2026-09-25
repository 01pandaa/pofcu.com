// Indicator calculations use only completed spot candles. No historical values are invented.
export const PAIRS = Object.freeze({
  BTCUSDT: { label: 'Bitcoin', ticker: 'BTC', gecko: 'bitcoin' },
  ETHUSDT: { label: 'Ethereum', ticker: 'ETH', gecko: 'ethereum' },
  SOLUSDT: { label: 'Solana', ticker: 'SOL', gecko: 'solana' },
  BNBUSDT: { label: 'BNB', ticker: 'BNB', gecko: 'binancecoin' },
  XRPUSDT: { label: 'XRP', ticker: 'XRP', gecko: 'ripple' },
  ADAUSDT: { label: 'Cardano', ticker: 'ADA', gecko: 'cardano' },
  DOGEUSDT: { label: 'Dogecoin', ticker: 'DOGE', gecko: 'dogecoin' },
  AVAXUSDT: { label: 'Avalanche', ticker: 'AVAX', gecko: 'avalanche-2' },
  CRVTRY: { label: 'Curve DAO', ticker: 'CRV', gecko: 'curve-dao-token' },
  BTCUSDC: { label: 'Bitcoin', ticker: 'BTC', gecko: 'bitcoin' },
  ETHBTC: { label: 'Ethereum', ticker: 'ETH', gecko: 'ethereum' }
});
export const INTERVALS = Object.freeze({ '15m': 900_000, '1h': 3_600_000, '4h': 14_400_000, '1d': 86_400_000, '1w': 604_800_000 });

export function parseCandles(rows, now = Date.now()) {
  if (!Array.isArray(rows)) throw new Error('Mum verisi alınamadı.');
  const candles = rows.map(row => ({
    time: Number(row[0]), open: Number(row[1]), high: Number(row[2]), low: Number(row[3]),
    close: Number(row[4]), volume: Number(row[5]), closeTime: Number(row[6])
  })).filter(c => c.closeTime < now && [c.time,c.open,c.high,c.low,c.close,c.volume].every(Number.isFinite)
    && c.close > 0 && c.high >= c.low && c.volume >= 0);
  if (candles.length < 100) throw new Error('Güvenilir analiz için yeterli kapanmış mum yok.');
  return candles;
}
export function sma(values, n) {
  if (values.length < n) return null;
  return values.slice(-n).reduce((a,b) => a+b, 0) / n;
}
export function emaSeries(values, n) {
  const out = Array(values.length).fill(null);
  if (values.length < n) return out;
  let ema = values.slice(0,n).reduce((a,b)=>a+b,0)/n;
  out[n-1] = ema;
  const k = 2/(n+1);
  for(let i=n;i<values.length;i++) { ema = values[i]*k + ema*(1-k); out[i]=ema; }
  return out;
}
export function rsiSeries(values, n=14) {
  const out = Array(values.length).fill(null);
  if(values.length <= n) return out;
  let gain=0, loss=0;
  for(let i=1;i<=n;i++) { const d=values[i]-values[i-1]; gain+=Math.max(0,d); loss+=Math.max(0,-d); }
  gain/=n; loss/=n;
  const score=()=>loss===0 ? (gain===0 ? 50 : 100) : 100-100/(1+gain/loss);
  out[n]=score();
  for(let i=n+1;i<values.length;i++) { const d=values[i]-values[i-1]; gain=(gain*(n-1)+Math.max(0,d))/n; loss=(loss*(n-1)+Math.max(0,-d))/n; out[i]=score(); }
  return out;
}
export function macdSeries(values) {
  const e12=emaSeries(values,12), e26=emaSeries(values,26);
  const line=values.map((_,i)=>e26[i]===null ? null : e12[i]-e26[i]);
  const signalValues=emaSeries(line.filter(x=>x!==null),9);
  const signal=line.map((v,i)=>v===null ? null : signalValues[i-25] ?? null);
  return { line, signal, histogram:line.map((v,i)=>v===null||signal[i]===null ? null : v-signal[i]) };
}
export function atrSeries(candles, n=14) {
  const out=Array(candles.length).fill(null);
  if(candles.length<=n) return out;
  const trs=candles.map((c,i)=>i===0 ? c.high-c.low : Math.max(c.high-c.low,Math.abs(c.high-candles[i-1].close),Math.abs(c.low-candles[i-1].close)));
  let atr=trs.slice(1,n+1).reduce((a,b)=>a+b,0)/n; out[n]=atr;
  for(let i=n+1;i<candles.length;i++) { atr=(atr*(n-1)+trs[i])/n; out[i]=atr; }
  return out;
}
export function adxSeries(candles,n=14) {
  const len=candles.length, out=Array(len).fill(null);
  if(len<2*n+1) return out;
  const tr=[],pdm=[],mdm=[];
  for(let i=1;i<len;i++) {
    const c=candles[i], prev=candles[i-1], up=c.high-prev.high, down=prev.low-c.low;
    tr[i]=Math.max(c.high-c.low,Math.abs(c.high-prev.close),Math.abs(c.low-prev.close));
    pdm[i]=up>down&&up>0?up:0; mdm[i]=down>up&&down>0?down:0;
  }
  let st=tr.slice(1,n+1).reduce((a,b)=>a+b,0), sp=pdm.slice(1,n+1).reduce((a,b)=>a+b,0), sm=mdm.slice(1,n+1).reduce((a,b)=>a+b,0);
  const dx=[];
  for(let i=n;i<len;i++) {
    if(i>n) { st=st-st/n+tr[i]; sp=sp-sp/n+pdm[i]; sm=sm-sm/n+mdm[i]; }
    const p=st?100*sp/st:0,m=st?100*sm/st:0; dx[i]=p+m ? 100*Math.abs(p-m)/(p+m) : 0;
    if(i===2*n-1) out[i]=dx.slice(n,2*n).reduce((a,b)=>a+b,0)/n;
    else if(i>2*n-1) out[i]=(out[i-1]*(n-1)+dx[i])/n;
  }
  return out;
}
const last=a=>a[a.length-1];
const prev=a=>a[a.length-2];
const round=(x,n=2)=>Number(x.toFixed(n));

export function analyze(candles, interval, symbol) {
  if(!INTERVALS[interval]||!/^[A-Z0-9]{3,20}$/.test(symbol)||candles.length<100) throw new Error('Analiz için geçersiz veri.');
  const close=candles.map(c=>c.close), volumes=candles.map(c=>c.volume), current=last(close);
  const e20=emaSeries(close,20),e50=emaSeries(close,50),e200=emaSeries(close,200);
  const rs=rsiSeries(close), mc=macdSeries(close), at=atrSeries(candles), ad=adxSeries(candles);
  const vavg=sma(volumes.slice(0,-1),20), ratio=vavg ? last(volumes)/vavg : null;
  const mean=sma(close,20),variance=sma(close.slice(-20).map(x=>(x-mean)**2),20),sd=Math.sqrt(variance);
  const high=Math.max(...candles.slice(-20).map(c=>c.high)), low=Math.min(...candles.slice(-20).map(c=>c.low));
  const atr=last(at), rsi=last(rs), macd=last(mc.line), signal=last(mc.signal), histogram=last(mc.histogram);
  const adx=last(ad),ema20=last(e20),ema50=last(e50),ema200=last(e200);
  const factors=[];
  const add=(name,weight,detail)=>factors.push({name,weight,detail});
  add('EMA 20 / 50',ema20>ema50?1:-1,ema20>ema50?'Kısa ortalama uzun ortalamanın üstünde.':'Kısa ortalama uzun ortalamanın altında.');
  add('Fiyat / EMA 200',ema200===null?0:current>ema200?1:-1,ema200===null?'200 dönemlik veri henüz yok.':current>ema200?'Fiyat uzun vadeli ortalamanın üstünde.':'Fiyat uzun vadeli ortalamanın altında.');
  add('MACD',histogram>0?1:-1,`${histogram>0?'Pozitif':'Negatif'} histogram${prev(mc.histogram)!==null ? (histogram>prev(mc.histogram)?', ivme artıyor.':', ivme zayıflıyor.') : '.'}`);
  add('RSI (14)',rsi>70?-1:rsi<30?1:rsi>=55?1:rsi<=45?-1:0,rsi>70?'70 üstü: aşırı alım riski.':rsi<30?'30 altı: aşırı satım, dönüş teyidi gerekir.':rsi>=55?'55 üstü: momentum olumlu.':rsi<=45?'45 altı: momentum zayıf.':'45–55: dengeli bölge.');
  add('Hacim',ratio!==null&&ratio>=1.2 ? (last(close)>prev(close)?1:-1):0,ratio===null?'Hacim ortalaması hesaplanamadı.':`Son kapanan mum hacmi önceki 20 mum ortalamasının ${round(ratio)} katı.`);
  const score=factors.reduce((a,f)=>a+f.weight,0);
  const direction=score>=3?'Olası alım sinyali':score<=-3?'Olası satış sinyali':'Karışık / bekle';
  const bull=factors.filter(f=>f.weight>0).length,bear=factors.filter(f=>f.weight<0).length;
  const notes=[];
  if(adx<20) notes.push('ADX 20 altında: trend gücü düşük, yatay piyasa riski var.');
  if(atr/current>0.045) notes.push('ATR yüksek: fiyat oynaklığı belirgin; risk artabilir.');
  if(rsi>70||rsi<30) notes.push('RSI uç bölgede; tek başına dönüş işareti sayılmaz.');
  if(Math.abs(score)<3) notes.push('Göstergeler aynı yöne işaret etmiyor; net bir teknik sinyal yok.');
  return {
    symbol,interval,asOf:last(candles).closeTime,price:current,change:100*(current/close[close.length-2]-1),
    direction,score,bull,bear,factors,notes,
    indicators:{rsi:round(rsi),macd:round(macd,5),macdSignal:round(signal,5),macdHistogram:round(histogram,5),
      ema20:round(ema20,5),ema50:round(ema50,5),ema200:ema200===null?null:round(ema200,5),adx:round(adx),
      atr:round(atr,5),atrPercent:round(atr/current*100),volumeRatio:ratio===null?null:round(ratio),
      bollingerUpper:round(mean+2*sd,5),bollingerLower:round(mean-2*sd,5),support:low,resistance:high},
    chart:candles.slice(-72).map(c=>({time:c.time,close:c.close}))
  };
}

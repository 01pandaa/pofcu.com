import { INTERVALS, parseCandles, analyze } from './engine.mjs';

// These are small, explicit universes. The exchange listing is checked at request time.
export const SCAN_PRESETS = Object.freeze({
  usdt: ['BTC','ETH','SOL','BNB','XRP','DOGE','ADA','AVAX','LINK','DOT','LTC','TRX'].map(base=>base+'USDT'),
  try: ['BTC','ETH','SOL','BNB','XRP','DOGE','ADA','AVAX','LINK','DOT','CRV','LTC'].map(base=>base+'TRY')
});

export function scanSymbols(scope, requested, active) {
  if (!['watch','usdt','try'].includes(scope)) throw new Error('Tarama grubu geçersiz.');
  if (scope==='watch' && (typeof requested!=='string' || requested.length>250)) throw new Error('İzleme listesi geçersiz.');
  const candidates=scope==='watch' ? requested.split(',').map(x=>x.trim()) : SCAN_PRESETS[scope];
  if (scope==='watch' && (candidates.length>12 || candidates.some(s=>!/^[A-Z0-9]{3,20}$/.test(s)))) throw new Error('En fazla 12 geçerli parite taranabilir.');
  return [...new Set(candidates)].filter(s=>active.has(s)).slice(0,12);
}

export function scanRow(symbol, interval, candleRows, ticker, now=Date.now()) {
  if (!INTERVALS[interval]) throw new Error('Zaman aralığı geçersiz.');
  const candles=parseCandles(candleRows,now);
  if (now-candles.at(-1).closeTime>INTERVALS[interval]*3) throw new Error('Kapanmış mum güncel değil.');
  const analysis=analyze(candles,interval,symbol),change=Number(ticker?.priceChangePercent),volume=Number(ticker?.quoteVolume);
  return {symbol,asOf:analysis.asOf,price:analysis.price,score:analysis.score,direction:analysis.direction,
    rsi:analysis.indicators.rsi,macdHistogram:analysis.indicators.macdHistogram,
    change24h:Number.isFinite(change)?change:null,quoteVolume:Number.isFinite(volume)?volume:null};
}

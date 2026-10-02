// CMC IDs were checked against CoinMarketCap's cryptocurrency quotes endpoint.
// Unknown Binance symbols are deliberately not matched by ticker alone.
export const CMC_IDS=Object.freeze({BTC:1,ETH:1027,SOL:5426,BNB:1839,XRP:52,DOGE:74,ADA:2010,
  AVAX:5805,LINK:1975,DOT:6636,CRV:6538,LTC:2,TRX:1958,SUI:20947,UNI:7083});
const number=x=>x===null||x===undefined?null:Number.isFinite(Number(x))?Number(x):null;

export function quoteAsset(symbol){return ['FDUSD','USDT','USDC','TRY','BTC'].find(q=>symbol.endsWith(q))||null;}
export function cmcId(symbol){const quote=quoteAsset(symbol);return quote?CMC_IDS[symbol.slice(0,-quote.length)]||null:null;}
export function contextIntervals(interval){return ({'15m':['1h','4h'],'1h':['4h','1d'],'4h':['1d','1w'],'1d':['4h','1w'],'1w':['4h','1d']})[interval]||[];}

export function normalizeCmc(payload,id){
  if(String(payload?.status?.error_code??'0')!=='0')throw new Error('CMC veri yanıtı başarısız.');
  const entries=Array.isArray(payload?.data)?payload.data:[];
  const coin=entries.find(x=>Number(x.id)===id);
  const quote=coin?.quote?.find(x=>x.symbol==='USD');
  if(!coin||!quote||!number(quote.market_cap))throw new Error('CMC varlık eşleşmesi bulunamadı.');
  return {id:coin.id,name:coin.name,symbol:coin.symbol,rank:number(coin.cmc_rank),marketCap:number(quote.market_cap),
    volume24h:number(quote.volume_24h),circulatingSupply:number(coin.circulating_supply),maxSupply:number(coin.max_supply),
    change7d:number(quote.percent_change_7d),asOf:quote.last_updated||coin.last_updated||null};
}
export function normalizeFear(payload){
  if(String(payload?.status?.error_code??'0')!=='0')throw new Error('CMC duyarlılık verisi alınamadı.');
  const value=number(payload?.data?.value);
  if(value===null||value<0||value>100)throw new Error('CMC duyarlılık verisi geçersiz.');
  return {value,classification:payload.data.value_classification||'',asOf:payload.data.update_time||null};
}

export function assessOutlook(base,comparisons,cmc){
  const scores=comparisons.map(x=>x.score),advanced=base.advanced;
  const up=base.score>=3&&scores.length>=1&&scores.every(x=>x>=0)&&scores.some(x=>x>=3)
    &&advanced.bull>=2&&advanced.bear<=1;
  const down=base.score<=-3&&scores.length>=1&&scores.every(x=>x<=0)&&scores.some(x=>x<=-3)
    &&advanced.bear>=2&&advanced.bull<=1;
  const direction=up?'Alım yönlü teknik görünüm':down?'Satış baskısı':'Teyit bekle';
  const risks=[];
  if(!cmc)risks.push('CoinMarketCap piyasa verisi eksik; temel piyasa bağlamı değerlendirilemedi.');
  else {
    if(cmc.marketCap<100_000_000)risks.push('CMC piyasa değeri 100 milyon USD altında; ölçek riski daha yüksek olabilir.');
    if(cmc.volume24h!==null&&cmc.volume24h<1_000_000)risks.push('CMC küresel 24 saatlik hacmi 1 milyon USD altında; likidite koşullarını ayrıca incele.');
    if(cmc.maxSupply&&cmc.circulatingSupply/cmc.maxSupply<.5)risks.push('CMC verisine göre azami arzın yarısından azı dolaşımda; arz takvimini ayrıca incele.');
  }
  if(base.indicators.adx<20)risks.push('ADX 20 altında: trend gücü zayıf.');
  if(base.indicators.atrPercent>4.5)risks.push('ATR oranı yüksek: kısa vadeli oynaklık belirgin.');
  return {direction,stance:up?'buy':down?'sell':'wait',risks,confirmations:{bull:advanced.bull,bear:advanced.bear,
    neutral:advanced.confirmations.length-advanced.bull-advanced.bear},
    summary:`${base.interval} teknik puanı ${base.score>0?'+':''}${base.score}/5; diğer periyotlar ${comparisons.map(x=>`${x.interval} ${x.score>0?'+':''}${x.score}/5`).join(' ve ')||'alınamadı'}.`};
}

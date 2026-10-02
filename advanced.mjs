// All studies use completed Binance spot candles passed in by the caller.
const finite=x=>Number.isFinite(x);
const round=(x,n=2)=>finite(x)?Number(x.toFixed(n)):null;

export function stochastic(candles,n=14,smooth=3){
  const k=Array(candles.length).fill(null),d=Array(candles.length).fill(null);
  for(let i=n-1;i<candles.length;i++){
    const period=candles.slice(i-n+1,i+1),high=Math.max(...period.map(c=>c.high)),low=Math.min(...period.map(c=>c.low));
    k[i]=high===low?50:100*(candles[i].close-low)/(high-low);
    if(i>=n+smooth-2)d[i]=k.slice(i-smooth+1,i+1).reduce((a,b)=>a+b,0)/smooth;
  }
  return {k,d};
}

export function mfi(candles,n=14){
  const out=Array(candles.length).fill(null);
  for(let i=n;i<candles.length;i++){
    let positive=0,negative=0;
    for(let j=i-n+1;j<=i;j++){
      const typical=(candles[j].high+candles[j].low+candles[j].close)/3;
      const previous=(candles[j-1].high+candles[j-1].low+candles[j-1].close)/3;
      const flow=typical*candles[j].volume;
      if(typical>previous)positive+=flow;
      else if(typical<previous)negative+=flow;
    }
    out[i]=positive+negative===0?50:negative===0?100:100-100/(1+positive/negative);
  }
  return out;
}

export function cmf(candles,n=20){
  if(candles.length<n)return null;
  const period=candles.slice(-n),total=period.reduce((a,c)=>a+c.volume,0);
  if(!total)return 0;
  return period.reduce((a,c)=>a+(c.high===c.low?0:((2*c.close-c.high-c.low)/(c.high-c.low))*c.volume),0)/total;
}

export function obvPressure(candles,n=10){
  if(candles.length<=n)return null;
  const period=candles.slice(-n),start=candles.length-n,volume=period.reduce((a,c)=>a+c.volume,0);
  if(!volume)return 0;
  let signed=0;
  for(let i=start;i<candles.length;i++)signed+=Math.sign(candles[i].close-candles[i-1].close)*candles[i].volume;
  return signed/volume;
}

export function advancedStudies(candles){
  const st=stochastic(candles),k=st.k.at(-1),d=st.d.at(-1),moneyFlow=mfi(candles).at(-1);
  const cashFlow=cmf(candles),obv=obvPressure(candles);
  const period=candles.slice(-20),total=period.reduce((a,c)=>a+c.volume,0);
  const weightedPrice=total?period.reduce((a,c)=>a+((c.high+c.low+c.close)/3)*c.volume,0)/total:null;
  // These are supporting observations, not independent probabilities.
  const confirmations=[
    {name:'Stokastik (14,3)',value:k!==null&&d!==null?(k>80?0:k<20?0:k>d?1:k<d?-1:0):0},
    {name:'MFI (14)',value:moneyFlow>=55&&moneyFlow<=80?1:moneyFlow<=45&&moneyFlow>=20?-1:0},
    {name:'CMF (20)',value:cashFlow>.05?1:cashFlow<-.05?-1:0},
    {name:'OBV (10)',value:obv>.1?1:obv<-.1?-1:0}
  ];
  return {stochasticK:round(k),stochasticD:round(d),mfi:round(moneyFlow),cmf:round(cashFlow,3),
    obvPressure:round(obv,3),weightedPrice20:weightedPrice===null?null:Number(weightedPrice.toPrecision(9)),confirmations,
    bull:confirmations.filter(x=>x.value>0).length,bear:confirmations.filter(x=>x.value<0).length};
}

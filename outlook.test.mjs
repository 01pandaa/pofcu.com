import test from 'node:test';
import assert from 'node:assert/strict';
import {stochastic,mfi,cmf,obvPressure,advancedStudies} from './advanced.mjs';
import {CMC_IDS,cmcId,contextIntervals,normalizeCmc,normalizeFear,assessOutlook} from './outlook.mjs';

const candles=Array.from({length:35},(_,i)=>({high:102+i,low:98+i,close:101+i,volume:100+i}));

test('stokastik ve para akışı kapalı mumlarla hesaplanır',()=>{
  const st=stochastic(candles);
  assert.ok(st.k.at(-1)>70&&st.k.at(-1)<100);
  assert.ok(st.d.at(-1)>70);
  assert.equal(stochastic(Array(20).fill({high:1,low:1,close:1,volume:1})).k.at(-1),50);
  assert.equal(mfi(candles).at(-1),100);
  assert.equal(mfi(candles.toReversed().map((c,i)=>({...c,volume:100+i}))).at(-1),0);
  assert.ok(cmf(candles)>0);
  assert.equal(obvPressure(candles),1);
  const studies=advancedStudies(candles);
  assert.equal(studies.confirmations.length,4);
  assert.ok(studies.weightedPrice20>0);
  assert.equal(studies.bull+studies.bear,studies.confirmations.filter(x=>x.value!==0).length);
});

test('CMC ID eşleşmesi sembol çakışmasını önler',()=>{
  assert.equal(cmcId('CRVTRY'),6538);
  assert.equal(cmcId('BTCUSDT'),1);
  assert.equal(cmcId('PEPEUSDT'),24478);
  assert.equal(cmcId('ARBUSDT'),11841);
  assert.equal(cmcId('SHIBTRY'),5994);
  assert.equal(Object.keys(CMC_IDS).length,45);
  assert.equal(new Set(Object.values(CMC_IDS)).size,45);
  assert.equal(cmcId('UNKNOWNUSDT'),null);
  assert.deepEqual(contextIntervals('1h'),['4h','1d']);
  const payload={status:{error_code:'0'},data:[
    {id:999,symbol:'CRV',quote:[{symbol:'USD',market_cap:11}]},
    {id:6538,name:'Curve DAO Token',symbol:'CRV',cmc_rank:78,circulating_supply:100,max_supply:200,quote:[{symbol:'USD',market_cap:1_000_000_000,volume_24h:22_000_000,percent_change_7d:-3,last_updated:'2026-10-02T10:00:00Z'}]}
  ]};
  const coin=normalizeCmc(payload,6538);
  assert.equal(coin.id,6538);
  assert.equal(coin.marketCap,1_000_000_000);
  assert.throws(()=>normalizeCmc(payload,42),/eşleşmesi/);
  assert.equal(normalizeFear({status:{error_code:'0'},data:{value:62,value_classification:'Greed'}}).value,62);
});

test('birleşik görünüm çelişkide teyit bekler, eksik CMC bağlamını bildirir',()=>{
  const base={interval:'1h',score:4,advanced:{bull:3,bear:1,confirmations:[1,1,1,-1]},indicators:{adx:24,atrPercent:2}};
  const aligned=assessOutlook(base,[{interval:'4h',score:3},{interval:'1d',score:1}],{marketCap:2e9,volume24h:1e8,maxSupply:100,circulatingSupply:80});
  assert.equal(aligned.stance,'buy');
  assert.equal(assessOutlook(base,[{interval:'4h',score:-3}],null).stance,'wait');
  assert.match(assessOutlook(base,[],null).risks.join(' '),/eksik/);
  const down={...base,score:-4,advanced:{bull:0,bear:3,confirmations:[-1,-1,-1,0]}};
  assert.equal(assessOutlook(down,[{interval:'4h',score:-4}],null).stance,'sell');
});

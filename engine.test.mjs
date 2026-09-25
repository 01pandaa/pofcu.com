import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCandles, rsiSeries, emaSeries, macdSeries, analyze} from './engine.mjs';

const now=1_800_000_000_000;
const candles=(prices)=>prices.map((price,i)=>({time:now-(prices.length-i)*3_600_000,closeTime:now-(prices.length-i-1)*3_600_000-1,
  open:price,high:price*1.002,low:price*.998,close:price,volume:100+i*.2}));

test('açık son mum sinyal hesabına girmez',()=>{
  const rows=Array.from({length:110},(_,i)=>[i,100+i,102+i,99+i,101+i,10,i+1]);
  rows.at(-1)[6]=now+100;
  assert.equal(parseCandles(rows,now).length,109);
  assert.throws(()=>parseCandles(rows.slice(0,90),now),/yeterli/);
});
test('RSI düz seyirde 50, kesintisiz yükselişte 100 verir',()=>{
  assert.equal(rsiSeries(Array(40).fill(100)).at(-1),50);
  assert.equal(rsiSeries(Array.from({length:40},(_,i)=>100+i)).at(-1),100);
});
test('EMA ve MACD başlangıcı yalnızca yeterli veriyle oluşur',()=>{
  assert.deepEqual(emaSeries([1,2],3),[null,null]);
  assert.equal(emaSeries([1,2,3,4],3).at(-1),3);
  const macd=macdSeries(Array(100).fill(100));
  assert.equal(macd.histogram[32],null);
  assert.equal(macd.histogram[33],0);
});
test('yön ve gerekçeler hesaplanan veriden çıkar',()=>{
  const ups=Array.from({length:260},(_,i)=>100+i*.15),downs=Array.from({length:260},(_,i)=>200-i*.15);
  const up=analyze(candles(ups),'1h','BTCUSDT'),down=analyze(candles(downs),'1h','BTCUSDT');
  assert.ok(up.indicators.ema20>up.indicators.ema50);
  assert.ok(down.indicators.ema20<down.indicators.ema50);
  assert.ok(up.score>down.score);
  assert.equal(up.factors.length,5);
  assert.ok(up.chart.length<=72);
});

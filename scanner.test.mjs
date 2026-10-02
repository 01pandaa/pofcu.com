import test from 'node:test';
import assert from 'node:assert/strict';
import { scanSymbols, scanRow, SCAN_PRESETS, MAX_SCAN } from './scanner.mjs';

const active=new Set(['BTCUSDT','ETHUSDT','CRVTRY']);
test('tarama grubu işlem gören paritelerle sınırlanır ve yinelenenler ayrılır',()=>{
  assert.deepEqual(scanSymbols('watch','BTCUSDT,ETHUSDT,BTCUSDT,CRVTRY',active),['BTCUSDT','ETHUSDT','CRVTRY']);
  assert.deepEqual(scanSymbols('try','',active),['CRVTRY']);
  assert.equal(SCAN_PRESETS.usdt.length,30);
  assert.equal(SCAN_PRESETS.try.length,30);
  assert.equal(scanSymbols('watch',SCAN_PRESETS.usdt.join(','),new Set(SCAN_PRESETS.usdt)).length,MAX_SCAN);
  assert.throws(()=>scanSymbols('watch',Array(MAX_SCAN+1).fill('BTCUSDT').join(','),active));
  assert.throws(()=>scanSymbols('watch','BTCUSDT,../secret',active));
});

test('tarayıcı yalnızca kapanan mumların hesabını kullanır ve eski veriyi reddeder',()=>{
  const hour=3_600_000,now=300*hour,rows=Array.from({length:261},(_,i)=>{
    const openTime=(40+i)*hour,price=100+i*.1;
    return [openTime,String(price),String(price+1),String(price-1),String(price+.2),'100',openTime+hour-1];
  });
  const row=scanRow('BTCUSDT','1h',rows,{priceChangePercent:'2.51',quoteVolume:'10000'},now);
  assert.equal(row.asOf,300*hour-1);
  assert.equal(row.change24h,2.51);
  assert.equal(row.quoteVolume,10000);
  assert.equal(row.score>=-5&&row.score<=5,true);
  assert.throws(()=>scanRow('BTCUSDT','1h',rows,{priceChangePercent:'2'},now+4*hour),/güncel değil/);
});

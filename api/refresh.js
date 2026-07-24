const { WATCHLIST, sma, rsi, macd, scoreFromIndicators } = require('../lib/lib');

const TWELVE_DATA_KEY = process.env.TWELVE_DATA_KEY;
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const REFRESH_SECRET = process.env.REFRESH_SECRET;

const GROUP_SIZE = 8; // Twelve Data ucretsiz plan dakikalik kredi limitine uygun

function chunk(arr, size){
  const out = [];
  for(let i=0;i<arr.length;i+=size) out.push(arr.slice(i,i+size));
  return out;
}

async function upstashSet(key, value){
  const res = await fetch(`${UPSTASH_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type':'application/json' },
    body: JSON.stringify(value)
  });
  if(!res.ok) throw new Error('Upstash yazma hatasi: ' + res.status);
}

async function upstashGet(key){
  const res = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
  });
  if(!res.ok) return null;
  const data = await res.json();
  if(data.result == null) return null;
  try{ return JSON.parse(data.result); }catch(e){ return data.result; }
}

module.exports = async (req, res) => {
  if(req.query.secret !== REFRESH_SECRET){
    res.status(401).json({ error: 'Yetkisiz. secret parametresi eksik veya yanlis.' });
    return;
  }
  if(!TWELVE_DATA_KEY || !UPSTASH_URL || !UPSTASH_TOKEN){
    res.status(500).json({ error: 'Ortam degiskenleri eksik.' });
    return;
  }

  const groups = chunk(WATCHLIST, GROUP_SIZE);

  let cursor = 0;
  try{
    const stored = await upstashGet('stock-cursor');
    if(typeof stored === 'number') cursor = stored;
  }catch(e){}

  if(cursor >= groups.length) cursor = 0;
  const group = groups[cursor];

  const results = (await upstashGet('stock-results')) || {};
  const errors = [];

  const symParam = group.map(g=>g.symbol).join(',');
  try{
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symParam)}&interval=1day&outputsize=60&apikey=${TWELVE_DATA_KEY}`;
    const r = await fetch(url);
    const data = await r.json();

    group.forEach(({symbol})=>{
      const entry = group.length===1 ? data : data[symbol];
      if(!entry || entry.status==='error' || !entry.values){
        errors.push(symbol);
        return;
      }
      const closes = entry.values.map(v=>parseFloat(v.close)).filter(v=>!isNaN(v));
      if(closes.length < 5){ errors.push(symbol); return; }

      const price = closes[0];
      const prevClose = closes[1] ?? price;
      const changePct = prevClose ? ((price-prevClose)/prevClose)*100 : 0;
      const sma20 = sma(closes,20);
      const sma50 = sma(closes,50);
      const rsiVal = rsi(closes,14);
      const macdVal = macd(closes);
      const { score, signal } = scoreFromIndicators({ price, sma20, sma50, rsiVal, macdVal });

      results[symbol] = {
        price: Math.round(price*100)/100,
        changePct: Math.round(changePct*100)/100,
        sma20: sma20!=null ? Math.round(sma20*100)/100 : null,
        sma50: sma50!=null ? Math.round(sma50*100)/100 : null,
        rsi: rsiVal!=null ? Math.round(rsiVal*10)/10 : null,
        score,
        signal,
        updatedAt: new Date().toISOString()
      };
    });
  }catch(e){
    group.forEach(g=>errors.push(g.symbol));
  }

  const nextCursor = (cursor + 1) % groups.length;

  try{
    await upstashSet('stock-results', results);
    await upstashSet('stock-cursor', nextCursor);
    await upstashSet('stock-last-refresh', { at: new Date().toISOString(), errors });
  }catch(e){
    res.status(500).json({ error: 'Redis yazma hatasi: ' + e.message });
    return;
  }

  res.status(200).json({
    ok: true,
    processedGroup: cursor,
    totalGroups: groups.length,
    symbolsInThisGroup: group.map(g=>g.symbol),
    errors,
    totalSymbolsWithData: Object.keys(results).length
  });
};

const { WATCHLIST, sma, rsi, macd, scoreFromIndicators } = require('../lib/lib');

const TWELVE_DATA_KEY = process.env.TWELVE_DATA_KEY;
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const REFRESH_SECRET = process.env.REFRESH_SECRET;

function chunk(arr, size){
  const out = [];
  for(let i=0;i<arr.length;i+=size) out.push(arr.slice(i,i+size));
  return out;
}
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function upstashSet(key, value){
  const res = await fetch(`${UPSTASH_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type':'application/json' },
    body: JSON.stringify(value)
  });
  if(!res.ok) throw new Error('Upstash yazma hatası: ' + res.status);
}

module.exports = async (req, res) => {
  if(req.query.secret !== REFRESH_SECRET){
    res.status(401).json({ error: 'Yetkisiz. secret parametresi eksik veya yanlış.' });
    return;
  }
  if(!TWELVE_DATA_KEY || !UPSTASH_URL || !UPSTASH_TOKEN){
    res.status(500).json({ error: 'Ortam değişkenleri eksik (TWELVE_DATA_KEY / UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN).' });
    return;
  }

  const groups = chunk(WATCHLIST, 8); // Twelve Data'ya her seferinde 8 sembol
  const results = {};
  const errors = [];

  for(const group of groups){
    const symParam = group.map(g=>g.symbol).join(',');
    try{
      const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symParam)}&interval=1day&outputsize=60&apikey=${TWELVE_DATA_KEY}`;
      const r = await fetch(url);
      const data = await r.json();

      group.forEach(({symbol})=>{
        // Tek sembol istenirse Twelve Data düz obje döner, çoklu sembolde symbol anahtarlı obje döner
        const entry = group.length===1 ? data : data[symbol];
        if(!entry || entry.status==='error' || !entry.values){
          errors.push(symbol);
          return;
        }
        const closes = entry.values.map(v=>parseFloat(v.close)).filter(v=>!isNaN(v)); // en yeni ilk sırada
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
    await sleep(1200); // Twelve Data ücretsiz plan hız sınırına takılmamak için bekleme
  }

  try{
    await upstashSet('stock-results', results);
    await upstashSet('stock-last-refresh', { at: new Date().toISOString(), errors });
  }catch(e){
    res.status(500).json({ error: 'Redis yazma hatası: ' + e.message });
    return;
  }

  res.status(200).json({
    ok: true,
    updated: Object.keys(results).length,
    errors
  });
};

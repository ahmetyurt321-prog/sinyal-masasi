const { WATCHLIST } = require('../lib/lib');

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

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
  if(!UPSTASH_URL || !UPSTASH_TOKEN){
    res.status(500).json({ error: 'Ortam değişkenleri eksik.' });
    return;
  }
  const results = await upstashGet('stock-results') || {};
  const lastRefresh = await upstashGet('stock-last-refresh') || null;

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  res.status(200).json({
    watchlist: WATCHLIST,
    results,
    lastRefresh
  });
};

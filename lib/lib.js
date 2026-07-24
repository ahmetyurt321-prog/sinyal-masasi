// Ortak sembol listesi ve teknik gösterge hesaplamaları

const WATCHLIST = [
  ["AAPL","Apple","Teknoloji"],["MSFT","Microsoft","Teknoloji"],["GOOGL","Alphabet","Teknoloji"],
  ["AMZN","Amazon","Teknoloji"],["NVDA","Nvidia","Teknoloji"],["META","Meta Platforms","Teknoloji"],
  ["TSLA","Tesla","Teknoloji"],["AVGO","Broadcom","Teknoloji"],["ORCL","Oracle","Teknoloji"],
  ["CRM","Salesforce","Teknoloji"],["ADBE","Adobe","Teknoloji"],["AMD","AMD","Teknoloji"],
  ["INTC","Intel","Teknoloji"],["CSCO","Cisco","Teknoloji"],["IBM","IBM","Teknoloji"],
  ["QCOM","Qualcomm","Teknoloji"],["TXN","Texas Instruments","Teknoloji"],["NOW","ServiceNow","Teknoloji"],
  ["INTU","Intuit","Teknoloji"],["PANW","Palo Alto Networks","Teknoloji"],
  ["UNH","UnitedHealth","Sağlık"],["JNJ","Johnson & Johnson","Sağlık"],["LLY","Eli Lilly","Sağlık"],
  ["PFE","Pfizer","Sağlık"],["ABBV","AbbVie","Sağlık"],["MRK","Merck","Sağlık"],
  ["TMO","Thermo Fisher","Sağlık"],["ABT","Abbott","Sağlık"],["DHR","Danaher","Sağlık"],["BMY","Bristol-Myers","Sağlık"],
  ["JPM","JPMorgan Chase","Finans"],["BAC","Bank of America","Finans"],["WFC","Wells Fargo","Finans"],
  ["GS","Goldman Sachs","Finans"],["MS","Morgan Stanley","Finans"],["BLK","BlackRock","Finans"],
  ["AXP","American Express","Finans"],["V","Visa","Finans"],["MA","Mastercard","Finans"],["SCHW","Charles Schwab","Finans"],
  ["WMT","Walmart","Tüketim"],["PG","Procter & Gamble","Tüketim"],["KO","Coca-Cola","Tüketim"],
  ["PEP","PepsiCo","Tüketim"],["COST","Costco","Tüketim"],["MCD","McDonald's","Tüketim"],
  ["NKE","Nike","Tüketim"],["SBUX","Starbucks","Tüketim"],["HD","Home Depot","Tüketim"],
  ["LOW","Lowe's","Tüketim"],["DIS","Disney","Tüketim"],
  ["XOM","ExxonMobil","Enerji"],["CVX","Chevron","Enerji"],["COP","ConocoPhillips","Enerji"],["SLB","SLB","Enerji"],
  ["BA","Boeing","Sanayi"],["CAT","Caterpillar","Sanayi"],["GE","General Electric","Sanayi"],
  ["HON","Honeywell","Sanayi"],["UPS","UPS","Sanayi"],["LMT","Lockheed Martin","Sanayi"],
  ["NFLX","Netflix","İletişim"],["CMCSA","Comcast","İletişim"],["T","AT&T","İletişim"],["VZ","Verizon","İletişim"]
].map(([symbol,name,sector])=>({symbol,name,sector}));

function sma(values, period){
  if(values.length < period) return null;
  const slice = values.slice(0, period);
  return slice.reduce((a,b)=>a+b,0)/period;
}

function ema(values, period){
  const k = 2/(period+1);
  const rev = values.slice().reverse();
  const out = [];
  let prev;
  rev.forEach((v,i)=>{
    if(i===0){ prev = v; }
    else { prev = v*k + prev*(1-k); }
    out.push(prev);
  });
  return out.reverse();
}

function rsi(closesNewestFirst, period=14){
  if(closesNewestFirst.length < period+1) return null;
  const closes = closesNewestFirst.slice(0, period+1).reverse();
  let gains=0, losses=0;
  for(let i=1;i<closes.length;i++){
    const diff = closes[i]-closes[i-1];
    if(diff>=0) gains+=diff; else losses+=Math.abs(diff);
  }
  const avgGain = gains/period;
  const avgLoss = losses/period;
  if(avgLoss===0) return 100;
  const rs = avgGain/avgLoss;
  return 100 - (100/(1+rs));
}

function macd(closesNewestFirst){
  if(closesNewestFirst.length < 35) return null;
  const ema12 = ema(closesNewestFirst,12);
  const ema26 = ema(closesNewestFirst,26);
  const macdLine = ema12.map((v,i)=> v-ema26[i]);
  const signalLine = ema(macdLine,9);
  return { macd: macdLine[0], signal: signalLine[0] };
}

function scoreFromIndicators({ price, sma20, sma50, rsiVal, macdVal }){
  let score = 0;

  if(sma20!=null && sma50!=null){
    if(price>sma20 && sma20>sma50) score += 40;
    else if(price>sma20) score += 25;
    else if(price<sma20 && sma20<sma50) score += 0;
    else score += 15;
  } else {
    score += 20;
  }

  if(rsiVal!=null){
    if(rsiVal<30) score += 30;
    else if(rsiVal<40) score += 22;
    else if(rsiVal<=60) score += 15;
    else if(rsiVal<=70) score += 10;
    else score += 5;
  } else {
    score += 15;
  }

  if(macdVal){
    if(macdVal.macd>macdVal.signal && macdVal.macd>0) score += 30;
    else if(macdVal.macd>macdVal.signal) score += 20;
    else score += 8;
  } else {
    score += 15;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  let signal = 'TUT';
  if(score>=66) signal='AL';
  else if(score<40) signal='SAT';
  return { score, signal };
}

module.exports = { WATCHLIST, sma, ema, rsi, macd, scoreFromIndicators };

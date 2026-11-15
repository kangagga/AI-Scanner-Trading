'use strict';
/**
 * Technical indicator library. Pure functions over candle arrays
 * ({ time, open, high, low, close, volume }) so the same code powers both the
 * live scanner and the historical backtester.
 */

function sma(values, period) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

function ema(values, period) {
  const out = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i += 1) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

function rsi(closes, period = 14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i += 1) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i += 1) {
    const diff = closes[i] - closes[i - 1];
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

function macd(closes, fast = 12, slow = 26, signalPeriod = 9) {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine = closes.map((_, i) =>
    emaFast[i] !== null && emaSlow[i] !== null ? emaFast[i] - emaSlow[i] : null
  );
  const firstIdx = macdLine.findIndex((v) => v !== null);
  const signalLine = new Array(closes.length).fill(null);
  const histogram = new Array(closes.length).fill(null);
  if (firstIdx >= 0) {
    const compact = macdLine.slice(firstIdx);
    const sig = ema(compact, signalPeriod);
    for (let i = 0; i < sig.length; i += 1) {
      if (sig[i] !== null) {
        signalLine[firstIdx + i] = sig[i];
        histogram[firstIdx + i] = compact[i] - sig[i];
      }
    }
  }
  return { macdLine, signalLine, histogram };
}

function atr(candles, period = 14) {
  const out = new Array(candles.length).fill(null);
  if (candles.length < period + 1) return out;
  const trs = [];
  for (let i = 1; i < candles.length; i += 1) {
    const c = candles[i];
    const prev = candles[i - 1];
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close)));
  }
  let prevAtr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period] = prevAtr;
  for (let i = period; i < trs.length; i += 1) {
    prevAtr = (prevAtr * (period - 1) + trs[i]) / period;
    out[i + 1] = prevAtr;
  }
  return out;
}

function stdev(values, period) {
  const out = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i += 1) {
    const slice = values.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    out[i] = Math.sqrt(variance);
  }
  return out;
}

/** Swing highs/lows via fractal pivots (left/right confirmation bars). */
function swings(candles, left = 3, right = 3) {
  const highs = [];
  const lows = [];
  for (let i = left; i < candles.length - right; i += 1) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - left; j <= i + right; j += 1) {
      if (j === i) continue;
      if (candles[j].high >= candles[i].high) isHigh = false;
      if (candles[j].low <= candles[i].low) isLow = false;
    }
    if (isHigh) highs.push({ index: i, price: candles[i].high, time: candles[i].time });
    if (isLow) lows.push({ index: i, price: candles[i].low, time: candles[i].time });
  }
  return { highs, lows };
}

/** Nearest support/resistance below/above a reference price. */
function supportResistance(candles, price, lookback = 120) {
  const slice = candles.slice(-lookback);
  const { highs, lows } = swings(slice, 3, 3);
  const resistances = highs.map((h) => h.price).filter((p) => p > price * 1.0005).sort((a, b) => a - b);
  const supports = lows.map((l) => l.price).filter((p) => p < price * 0.9995).sort((a, b) => b - a);
  return {
    support: supports[0] ?? Math.min(...slice.map((c) => c.low)),
    resistance: resistances[0] ?? Math.max(...slice.map((c) => c.high)),
    supportLevels: supports.slice(0, 3),
    resistanceLevels: resistances.slice(0, 3),
  };
}

/** Higher-highs/higher-lows vs lower-highs/lower-lows structure. */
function marketStructure(candles, lookback = 90) {
  const slice = candles.slice(-lookback);
  const { highs, lows } = swings(slice, 3, 3);
  const h = highs.slice(-3);
  const l = lows.slice(-3);
  if (h.length < 2 || l.length < 2) return 'RANGING';
  const hh = h[h.length - 1].price > h[h.length - 2].price;
  const hl = l[l.length - 1].price > l[l.length - 2].price;
  const lh = h[h.length - 1].price < h[h.length - 2].price;
  const ll = l[l.length - 1].price < l[l.length - 2].price;
  if (hh && hl) return 'UPTREND';
  if (lh && ll) return 'DOWNTREND';
  return 'RANGING';
}

function volumeRatio(candles, period = 20) {
  const vols = candles.map((c) => c.volume);
  const avg = sma(vols, period);
  const last = candles.length - 1;
  if (avg[last] === null || !avg[last]) return 1;
  return vols[last] / avg[last];
}

function bodyPct(candle) {
  const range = candle.high - candle.low;
  if (range <= 0) return 0;
  return Math.abs(candle.close - candle.open) / range;
}

function isBullish(candle) {
  return candle.close > candle.open;
}

/** Range compression: recent ATR relative to the longer-term ATR. */
function volatilityState(candles) {
  const a = atr(candles, 14);
  const last = a[candles.length - 1];
  const prior = a[candles.length - 30] ?? last;
  if (!last || !prior) return { state: 'NORMAL', ratio: 1 };
  const ratio = last / prior;
  if (ratio < 0.7) return { state: 'COMPRESSED', ratio };
  if (ratio > 1.6) return { state: 'EXPANDING', ratio };
  return { state: 'NORMAL', ratio };
}

/**
 * Full indicator snapshot for one symbol/timeframe.
 * `candles` must be ordered oldest -> newest and contain the forming candle last.
 */
function analyze(candles) {
  if (!Array.isArray(candles) || candles.length < 60) {
    return { ok: false, reason: 'insufficient candles' };
  }
  const closes = candles.map((c) => c.close);
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const price = last.close;

  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const ema200 = ema(closes, 200);
  const rsi14 = rsi(closes, 14);
  const macdData = macd(closes);
  const atr14 = atr(candles, 14);
  const bb = stdev(closes, 20);
  const sr = supportResistance(candles, price);
  const structure = marketStructure(candles);
  const vol = volumeRatio(candles, 20);
  const volatility = volatilityState(candles);

  const i = candles.length - 1;
  const atrVal = atr14[i] || price * 0.01;
  const bbMid = sma(closes, 20)[i];
  const bbUpper = bbMid !== null && bb[i] !== null ? bbMid + bb[i] * 2 : null;
  const bbLower = bbMid !== null && bb[i] !== null ? bbMid - bb[i] * 2 : null;

  // Breakout of the prior N-bar range, plus the "fake breakout" follow-up check.
  const rangeWindow = candles.slice(-21, -1);
  const rangeHigh = Math.max(...rangeWindow.map((c) => c.high));
  const rangeLow = Math.min(...rangeWindow.map((c) => c.low));
  const brokeUp = price > rangeHigh;
  const brokeDown = price < rangeLow;
  // A wick above the range that closes back inside is a failed/fake breakout.
  const fakeBreakoutUp = last.high > rangeHigh && price < rangeHigh;
  const fakeBreakoutDown = last.low < rangeLow && price > rangeLow;

  // Distance to key levels measured in ATR — the anti-chase metric.
  const distToResistanceAtr = (sr.resistance - price) / atrVal;
  const distToSupportAtr = (price - sr.support) / atrVal;

  // Consecutive large bullish candles (the "don't chase" trigger).
  const bigBull = candles.slice(-3).filter((c) => isBullish(c) && (c.close - c.open) > atrVal * 0.8);
  const consecutiveBigBull = bigBull.length;

  const macdHist = macdData.histogram[i];
  const macdHistPrev = macdData.histogram[i - 1];
  const macdCrossUp = macdHist !== null && macdHistPrev !== null && macdHistPrev <= 0 && macdHist > 0;
  const macdCrossDown = macdHist !== null && macdHistPrev !== null && macdHistPrev >= 0 && macdHist < 0;

  const emaStackBull = ema20[i] !== null && ema50[i] !== null && ema20[i] > ema50[i];
  const emaStackBear = ema20[i] !== null && ema50[i] !== null && ema20[i] < ema50[i];
  const aboveEma200 = ema200[i] !== null ? price > ema200[i] : null;

  const sideways =
    volatility.state === 'COMPRESSED' &&
    Math.abs(price - (bbMid || price)) / price < 0.01 &&
    structure === 'RANGING';

  // Rejection: long wick into a level with a close back away from it.
  const upperWick = last.high - Math.max(last.open, last.close);
  const lowerWick = Math.min(last.open, last.close) - last.low;
  const totalRange = Math.max(last.high - last.low, 1e-9);
  const rejectionUp = upperWick / totalRange > 0.5 && upperWick > atrVal * 0.5;
  const rejectionDown = lowerWick / totalRange > 0.5 && lowerWick > atrVal * 0.5;

  return {
    ok: true,
    price,
    prevClose: prev.close,
    atr: atrVal,
    atrPct: (atrVal / price) * 100,
    rsi: rsi14[i],
    ema20: ema20[i],
    ema50: ema50[i],
    ema200: ema200[i],
    emaStackBull,
    emaStackBear,
    aboveEma200,
    macd: macdData.macdLine[i],
    macdSignal: macdData.signalLine[i],
    macdHist,
    macdHistPrev,
    macdCrossUp,
    macdCrossDown,
    bbUpper,
    bbLower,
    bbMid,
    support: sr.support,
    resistance: sr.resistance,
    supportLevels: sr.supportLevels,
    resistanceLevels: sr.resistanceLevels,
    structure,
    volumeRatio: vol,
    volatility: volatility.state,
    volatilityRatio: volatility.ratio,
    rangeHigh,
    rangeLow,
    brokeUp,
    brokeDown,
    fakeBreakoutUp,
    fakeBreakoutDown,
    distToResistanceAtr,
    distToSupportAtr,
    consecutiveBigBull,
    bodyPct: bodyPct(last),
    rejectionUp,
    rejectionDown,
    sideways,
    candleCount: candles.length,
    lastCandle: last,
  };
}

module.exports = {
  sma, ema, rsi, macd, atr, stdev, swings, supportResistance, marketStructure,
  volumeRatio, volatilityState, analyze, isBullish, bodyPct,
};

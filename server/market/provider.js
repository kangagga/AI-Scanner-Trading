'use strict';
/**
 * Market data provider. Binance public REST needs no API key; no private trading
 * credentials or real-order endpoints exist here. If the provider is unreachable,
 * a deterministic clearly-labeled DEMO feed keeps the UI/engine testable.
 */

const { config } = require('../config');
const repo = require('../db/repo');

const TIMEFRAMES = new Set(['1m', '5m', '15m', '1h', '4h', '1d']);
const cache = new Map();
let lastRequestAt = 0;
let requestCount = 0;
let errorCount = 0;
let lastRequestAtTs = null;
let lastError = null;
let providerMode = config.market.provider === 'demo' ? 'DEMO' : 'LIVE';

const demoBase = {
  BTCUSDT: 65432.1,
  ETHUSDT: 3421.88,
  SOLUSDT: 144.26,
  BNBUSDT: 598.42,
  XRPUSDT: 0.5421,
  ADAUSDT: 0.4518,
  DOGEUSDT: 0.1234,
  AVAXUSDT: 34.18,
  LINKUSDT: 14.62,
  DOTUSDT: 6.43,
  LTCUSDT: 82.14,
  BCHUSDT: 412.5,
  UNIUSDT: 9.18,
  APTUSDT: 8.74,
  SUIUSDT: 1.16,
  NEARUSDT: 5.21,
};

function cacheGet(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.at < config.market.cacheTtlMs) return entry.value;
  if (entry) cache.delete(key);
  return null;
}

function cacheSet(key, value, ttl = config.market.cacheTtlMs) {
  cache.set(key, { value, at: Date.now(), ttl });
  return value;
}

async function throttle() {
  const waitMs = Math.max(0, config.market.minRequestGapMs - (Date.now() - lastRequestAt));
  if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
  lastRequestAt = Date.now();
}

async function request(endpoint, params = {}, weight = 1) {
  if (config.market.provider === 'demo') throw new Error('DEMO provider configured');

  const key = `${endpoint}?${new URLSearchParams(params)}`;
  const cached = cacheGet(key);
  if (cached !== null) return cached;

  await throttle();
  const url = new URL(endpoint, config.market.baseUrl);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.market.requestTimeoutMs);
  requestCount += 1;
  lastRequestAtTs = Date.now();

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AI-Scanner-Trading/1.0', Accept: 'application/json' },
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Binance HTTP ${response.status}: ${text.slice(0, 180)}`);
    }
    const data = await response.json();
    // Binance response headers can include current used weight.
    const usedWeight = response.headers.get('x-mbx-used-weight-1m');
    if (usedWeight && Number(usedWeight) > config.market.maxWeightPerMinute) {
      throw new Error(`Market data rate guard: ${usedWeight} request weight/min`);
    }
    return cacheSet(key, data);
  } catch (err) {
    errorCount += 1;
    lastError = err.message;
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function demoRand(seed) {
  let x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function baseFor(symbol) {
  if (demoBase[symbol]) return demoBase[symbol];
  return 0.1 + demoRand(symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) * 100;
}

function demoTicker(symbol, index = 0) {
  const seed = Math.floor(Date.now() / 30000) + index * 7919;
  const base = baseFor(symbol);
  const change = (demoRand(seed) - 0.5) * 12;
  const price = base * (1 + change / 100);
  return {
    symbol,
    price,
    change24h: change,
    volume24h: base * (100000 + demoRand(seed + 1) * 900000),
    high24h: price * (1 + Math.abs(change) / 100),
    low24h: price * (1 - Math.abs(change) / 100),
    source: 'demo',
    ts: Date.now(),
  };
}

function normalizeTicker(t) {
  return {
    symbol: t.symbol,
    price: Number(t.lastPrice),
    change24h: Number(t.priceChangePercent),
    volume24h: Number(t.quoteVolume),
    high24h: Number(t.highPrice),
    low24h: Number(t.lowPrice),
    source: 'live',
    ts: Date.now(),
  };
}

function normalizeKline(k) {
  return {
    time: Number(k[0]),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
    closeTime: Number(k[6]),
    quoteVolume: Number(k[7]),
    trades: Number(k[8]),
    takerBuyVolume: Number(k[9]),
    takerBuyQuoteVolume: Number(k[10]),
  };
}

function demoCandles(symbol, timeframe, limit) {
  const base = baseFor(symbol);
  const intervalMs = { '1m': 60000, '5m': 300000, '15m': 900000, '1h': 3600000, '4h': 14400000, '1d': 86400000 }[timeframe];
  const now = Date.now();
  const seed0 = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const out = [];
  let close = base;
  for (let i = 0; i < limit; i += 1) {
    const seed = seed0 + Math.floor((now - (limit - i) * intervalMs) / intervalMs);
    const drift = (demoRand(seed) - 0.49) * 0.007;
    const open = close;
    close = Math.max(base * 0.5, open * (1 + drift));
    const wick = Math.abs(demoRand(seed + 1) - 0.5) * 0.004 * base;
    const range = Math.abs(close - open);
    out.push({
      time: now - (limit - i) * intervalMs,
      open,
      high: Math.max(open, close) + wick + range * 0.25,
      low: Math.min(open, close) - wick - range * 0.25,
      close,
      volume: base * (500 + demoRand(seed + 2) * 4000),
      closeTime: now - (limit - i - 1) * intervalMs - 1,
      quoteVolume: base * (500 + demoRand(seed + 2) * 4000),
      trades: Math.floor(100 + demoRand(seed + 3) * 5000),
      takerBuyVolume: base * (200 + demoRand(seed + 4) * 2000),
      takerBuyQuoteVolume: 0,
    });
  }
  return out;
}

/** Return market status with clear provider mode and health indicators. */
function status() {
  return {
    provider: providerMode,
    configuredProvider: config.market.provider.toUpperCase(),
    online: providerMode === 'LIVE',
    requestCount,
    errorCount,
    lastRequestAt: lastRequestAtTs,
    lastError,
    cacheEntries: cache.size,
    rateGuardWeightPerMinute: config.market.maxWeightPerMinute,
  };
}

/** Discover liquid USDT spot pairs; fallback to configured or small demo universe. */
async function getUniverse(size = config.market.universeSize) {
  if (config.market.universe.length) return config.market.universe.slice(0, size);
  const cached = cacheGet('universe');
  if (cached) return cached.slice(0, size);
  try {
    const info = await request('/api/v3/exchangeInfo', { permissions: 'SPOT' }, 10);
    const tradable = new Set(
      info.symbols
        .filter((s) => s.quoteAsset === config.market.quoteAsset && s.status === 'TRADING' && !s.isSpotTradingAllowed === false)
        .map((s) => s.symbol)
    );
    const tickers = await request('/api/v3/ticker/24hr', {}, 40);
    const symbols = tickers
      .filter((t) => tradable.has(t.symbol) && Number(t.quoteVolume) > 1_000_000)
      .sort((a, b) => Number(b.quoteVolume) - Number(a.quoteVolume))
      .slice(0, size)
      .map((t) => t.symbol);
    if (symbols.length) {
      cacheSet('universe', symbols, 5 * 60 * 1000);
      providerMode = 'LIVE';
      return symbols;
    }
    throw new Error('No eligible symbols returned by exchangeInfo');
  } catch (err) {
    providerMode = config.market.provider === 'demo' ? 'DEMO' : (providerMode === 'LIVE' ? 'OFFLINE' : 'DEMO');
    lastError = err.message;
    const fallback = Object.keys(demoBase);
    return fallback.slice(0, size);
  }
}

/** Fetch one 24h ticker, falling back to a clearly labeled DEMO ticker. */
async function getTicker(symbol, index = 0) {
  const cached = cacheGet(`ticker:${symbol}`);
  if (cached) return cached;
  try {
    const raw = await request('/api/v3/ticker/24hr', { symbol }, 1);
    const ticker = normalizeTicker(raw);
    providerMode = 'LIVE';
    lastError = null;
    cacheSet(`ticker:${symbol}`, ticker);
    return ticker;
  } catch (err) {
    lastError = err.message;
    if (config.market.provider !== 'demo') providerMode = 'OFFLINE';
    const ticker = demoTicker(symbol, index);
    return { ...ticker, source: providerMode === 'OFFLINE' ? 'demo-fallback' : 'demo' };
  }
}

/** Fetch tickers for a list of symbols, sequentially to respect exchange limits. */
async function getTickers(symbols) {
  const out = [];
  for (let i = 0; i < symbols.length; i += 1) out.push(await getTicker(symbols[i], i));
  repo.insertSnapshots(out);
  return out;
}

/** Fetch candles, with a deterministic demo fallback if market data is offline. */
async function getCandles(symbol, timeframe = '15m', limit = 220) {
  if (!TIMEFRAMES.has(timeframe)) throw new Error(`Unsupported timeframe: ${timeframe}`);
  const clamped = Math.max(30, Math.min(Number(limit) || 220, 1000));
  try {
    const raw = await request('/api/v3/klines', { symbol, interval: timeframe, limit: clamped }, 2);
    providerMode = 'LIVE';
    lastError = null;
    return { candles: raw.map(normalizeKline), source: 'live' };
  } catch (err) {
    lastError = err.message;
    if (config.market.provider !== 'demo') providerMode = 'OFFLINE';
    const source = providerMode === 'OFFLINE' ? 'demo-fallback' : 'demo';
    return { candles: demoCandles(symbol, timeframe, clamped), source };
  }
}

/** Full 24h market overview, sorted and normalized. */
async function getMarketOverview() {
  try {
    const raw = await request('/api/v3/ticker/24hr', {}, 40);
    const usdt = raw
      .filter((t) => t.symbol.endsWith(config.market.quoteAsset) && Number(t.quoteVolume) > 1_000_000)
      .map(normalizeTicker)
      .sort((a, b) => b.volume24h - a.volume24h);
    providerMode = 'LIVE';
    lastError = null;
    return { data: usdt, source: 'live' };
  } catch (err) {
    lastError = err.message;
    providerMode = config.market.provider === 'demo' ? 'DEMO' : 'OFFLINE';
    const symbols = Object.keys(demoBase);
    const data = symbols.map(demoTicker).sort((a, b) => b.volume24h - a.volume24h);
    return { data, source: providerMode === 'OFFLINE' ? 'demo-fallback' : 'demo' };
  }
}

/** Backtest helper — does not fake historical data; demo candles are labeled. */
async function getBacktestCandles(symbol, timeframe, limit = 800) {
  const result = await getCandles(symbol, timeframe, limit);
  return result;
}

module.exports = {
  TIMEFRAMES,
  getUniverse,
  getTicker,
  getTickers,
  getCandles,
  getMarketOverview,
  getBacktestCandles,
  status,
  // exported for tests only
  demoCandles,
};

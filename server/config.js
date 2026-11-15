'use strict';
/**
 * Central configuration for AI SCANNER TRADING.
 *
 * HARD SAFETY RULES (do not relax):
 *  - PAPER TRADING is the only transaction mode. There is no real-order code path.
 *  - BITGET_MIRROR is disabled and cannot be enabled from the UI.
 *  - Secrets are read from the environment only; never hardcoded, never shipped to the client.
 */

const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const env = process.env;

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

const config = {
  root: ROOT,
  publicDir: path.join(ROOT, 'public'),
  docsDir: path.join(ROOT, 'docs'),

  server: {
    host: env.HOST || '127.0.0.1',
    port: num(env.PORT, 4173),
    // Optional shared token. When set, control endpoints (scanner start/stop/config,
    // settings writes) require `Authorization: Bearer <token>`.
    controlToken: env.CONTROL_TOKEN || '',
    // When true, the API rejects requests without a valid token (read endpoints included).
    requireAuth: bool(env.REQUIRE_AUTH, false),
  },

  db: {
    file: env.DB_FILE || path.join(ROOT, 'data', 'scanner.db'),
  },

  // ---------------------------------------------------------------- market data
  market: {
    provider: env.MARKET_PROVIDER || 'binance', // binance | demo
    baseUrl: env.MARKET_BASE_URL || 'https://api.binance.com',
    quoteAsset: 'USDT',
    // Universe of symbols the scanner watches. Empty => auto-discovered by 24h volume.
    universe: (env.SCANNER_UNIVERSE || '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
    universeSize: num(env.UNIVERSE_SIZE, 24),
    requestTimeoutMs: num(env.REQUEST_TIMEOUT_MS, 9000),
    cacheTtlMs: num(env.MARKET_CACHE_TTL_MS, 8000),
    // Conservative client-side pacing so we never trip exchange rate limits.
    minRequestGapMs: num(env.MARKET_MIN_GAP_MS, 120),
    maxWeightPerMinute: num(env.MARKET_MAX_WEIGHT_PER_MIN, 900),
  },

  scanner: {
    autoStart: bool(env.SCANNER_AUTOSTART, true),
    intervalMs: num(env.SCAN_INTERVAL_MS, 45000),
    timeframes: (env.SCAN_TIMEFRAMES || '15m,1h,4h')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    minScore: num(env.SCAN_MIN_SCORE, 55),
    candleLimit: num(env.SCAN_CANDLE_LIMIT, 220),
    // A signal for the same symbol+timeframe+strategy is not re-emitted inside this window.
    dedupeWindowMs: num(env.SCAN_DEDUPE_MS, 30 * 60 * 1000),
    // Auto-open a paper trade for every HIGH quality signal.
    autoPaperTrade: bool(env.AUTO_PAPER_TRADE, true),
    autoPaperTradeMinScore: num(env.AUTO_PAPER_MIN_SCORE, 78),
  },

  paper: {
    // Mirrors the legacy bot configuration.
    enabled: true,
    bitgetMirror: false,
    startingBalance: num(env.PAPER_BALANCE, 10000),
    feeRoundTripPct: num(env.PAPER_FEE_ROUND_TRIP_PCT, 0.12), // 0.12% round trip
    slippagePerSidePct: num(env.PAPER_SLIPPAGE_PER_SIDE_PCT, 0.3), // 0.30% per side
    riskPerTradePct: num(env.PAPER_RISK_PER_TRADE_PCT, 1.0),
    maxOpenPositions: num(env.PAPER_MAX_OPEN, 8),
    maxPositionPctOfEquity: num(env.PAPER_MAX_POSITION_PCT, 25),
    // Simulated liquidation of open trades when price crosses SL/TP.
    settleIntervalMs: num(env.PAPER_SETTLE_MS, 20000),
  },

  analyst: {
    // Optional LLM enrichment. Without a key the analyst runs fully deterministic
    // rule-based reasoning (still real analysis, just no external model).
    llmEnabled: bool(env.LLM_ENABLED, false),
    llmBaseUrl: env.LLM_BASE_URL || '',
    llmModel: env.LLM_MODEL || '',
    llmApiKey: env.LLM_API_KEY || '',
    minScoreHigh: num(env.ANALYST_MIN_HIGH, 80),
    minScoreMedium: num(env.ANALYST_MIN_MEDIUM, 65),
    minScoreLow: num(env.ANALYST_MIN_LOW, 50),
    minRiskReward: num(env.ANALYST_MIN_RR, 1.5),
    // Distance to resistance (in ATR) below which a BUY is considered chasing.
    chaseAtrLimit: num(env.ANALYST_CHASE_ATR, 0.6),
  },

  backtest: {
    defaultCandles: num(env.BACKTEST_CANDLES, 800),
    feeRoundTripPct: num(env.PAPER_FEE_ROUND_TRIP_PCT, 0.12),
    slippagePerSidePct: num(env.PAPER_SLIPPAGE_PER_SIDE_PCT, 0.3),
    minSampleSize: num(env.BACKTEST_MIN_SAMPLE, 30),
  },

  cloud: {
    // Backend-sync target for the future cloud deployment (see docs/CLOUD_MIGRATION.md).
    remoteUrl: env.CLOUD_REMOTE_URL || '',
    apiToken: env.CLOUD_API_TOKEN || '',
  },
};

/** Settings exposed to the Settings screen (safe, non-secret values only). */
function publicConfig() {
  return {
    app: { name: 'AI SCANNER TRADING', version: require('../package.json').version },
    market: {
      provider: config.market.provider,
      quoteAsset: config.market.quoteAsset,
      universeSize: config.market.universeSize,
      universe: config.market.universe,
    },
    scanner: {
      autoStart: config.scanner.autoStart,
      intervalMs: config.scanner.intervalMs,
      timeframes: config.scanner.timeframes,
      minScore: config.scanner.minScore,
      autoPaperTrade: config.scanner.autoPaperTrade,
      autoPaperTradeMinScore: config.scanner.autoPaperTradeMinScore,
    },
    paper: {
      enabled: true,
      bitgetMirror: false,
      startingBalance: config.paper.startingBalance,
      feeRoundTripPct: config.paper.feeRoundTripPct,
      slippagePerSidePct: config.paper.slippagePerSidePct,
      riskPerTradePct: config.paper.riskPerTradePct,
      maxOpenPositions: config.paper.maxOpenPositions,
      maxPositionPctOfEquity: config.paper.maxPositionPctOfEquity,
    },
    analyst: {
      llmEnabled: config.analyst.llmEnabled,
      llmModel: config.analyst.llmEnabled ? config.analyst.llmModel : null,
      minScoreHigh: config.analyst.minScoreHigh,
      minScoreMedium: config.analyst.minScoreMedium,
      minRiskReward: config.analyst.minRiskReward,
    },
    cloud: {
      remoteConfigured: Boolean(config.cloud.remoteUrl),
    },
    security: {
      controlTokenConfigured: Boolean(config.server.controlToken),
      requireAuth: config.server.requireAuth,
    },
  };
}

module.exports = { config, publicConfig };

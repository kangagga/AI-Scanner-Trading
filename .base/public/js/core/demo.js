/**
 * DEMO fixtures — used ONLY when the real bot backend is unreachable and the
 * user has left "Allow demo data" enabled.
 *
 * Every object here carries `__demo: true`, and the UI renders a permanent
 * DEMO banner plus per-card "DEMO" chips. These numbers are illustrative
 * shapes, NOT market data and NOT your bot's results. Control actions are
 * disabled while demo data is displayed.
 */

const T0 = Date.now();
const min = (n) => T0 - n * 60_000;

export const DEMO_BANNER =
  'DEMO DATA — backend bot tidak terhubung. Angka di bawah hanya contoh tampilan, bukan hasil bot Anda.';

export const demoStatus = {
  __demo: true,
  running: false,
  state: 'OFFLINE',
  paperTrading: true,
  bitgetMirror: false,
  coinsTracked: 0,
  signalsToday: 0,
  validSignals: 0,
  rejectedSignals: 0,
  openPositions: 0,
  totalPnl: 0,
  winRate: null,
  marketCondition: 'unknown',
  lastUpdate: null,
  message: 'Backend bot belum terhubung. Data status tidak tersedia.',
};

export const demoSignals = {
  __demo: true,
  // Intentionally empty: never invent a signal, symbol, price, or outcome.
  signals: [],
};

export const demoMarket = {
  __demo: true,
  btcTrend: 'unknown',
  ethTrend: 'unknown',
  sentiment: 'unknown',
  volume: null,
  gainers: [],
  losers: [],
  topVolume: [],
  btcDominance: null,
  condition: 'unknown',
  message: 'Market overview memerlukan backend bot sebagai sumber data.',
};

export const demoPositions = {
  __demo: true,
  positions: [],
};

export const demoTrades = {
  __demo: true,
  trades: [],
};

export const demoPerformance = {
  __demo: true,
  winRate: null,
  profitFactor: null,
  maxDrawdown: null,
  avgWin: null,
  avgLoss: null,
  samples: 0,
  byStrategy: [],
  byTimeframe: [],
  equity: [],
  message: 'Statistik performa hanya tersedia dari database bot lama.',
};

export const demoStrategy = {
  __demo: true,
  strategies: [],
  timeframes: ['1m', '5m', '15m', '1h', '4h', '1d'],
  minScore: null,
  riskPercent: null,
  message: 'Konfigurasi strategi bersifat read-only dan berasal dari bot lama.',
};

export const demoLogs = {
  __demo: true,
  logs: [
    { ts: min(30), level: 'warn', message: 'Control center berjalan tanpa koneksi backend.' },
    { ts: min(29), level: 'info', message: 'Buka Settings dan isi URL backend bot untuk mengaktifkan kontrol.' },
  ],
};

/** Fixtures keyed by resource name, matching the API client's read helpers. */
export const DEMO = {
  status: demoStatus,
  signals: demoSignals,
  market: demoMarket,
  positions: demoPositions,
  trades: demoTrades,
  performance: demoPerformance,
  strategy: demoStrategy,
  logs: demoLogs,
};

export function demoFor(resource) {
  return DEMO[resource] ?? { __demo: true };
}

export function isDemo(payload) {
  return Boolean(payload && payload.__demo);
}

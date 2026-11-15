-- AI SCANNER TRADING — schema
-- Every table here is real and used by the running engine. No placeholder tables.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------- market data
CREATE TABLE IF NOT EXISTS market_snapshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol      TEXT    NOT NULL,
  price       REAL    NOT NULL,
  change_24h  REAL,
  volume_24h  REAL,
  high_24h    REAL,
  low_24h     REAL,
  source      TEXT    NOT NULL DEFAULT 'live',   -- live | demo
  ts          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snap_symbol_ts ON market_snapshots(symbol, ts DESC);

-- -------------------------------------------------------------------- signals
CREATE TABLE IF NOT EXISTS signals (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol        TEXT    NOT NULL,
  timeframe     TEXT    NOT NULL,
  strategy      TEXT    NOT NULL,
  direction     TEXT    NOT NULL,                -- BUY | SELL
  price         REAL    NOT NULL,                -- price at detection
  entry         REAL    NOT NULL,
  stop_loss     REAL    NOT NULL,
  take_profit   REAL    NOT NULL,
  risk_reward   REAL,
  score         INTEGER NOT NULL,
  quality       TEXT    NOT NULL,                -- HIGH | MEDIUM | LOW | REJECTED
  reasons       TEXT,                            -- JSON array of strings
  indicators    TEXT,                            -- JSON object snapshot
  status        TEXT    NOT NULL DEFAULT 'NEW',  -- NEW | ANALYZED | TAKEN | IGNORED
  source        TEXT    NOT NULL DEFAULT 'live',
  dedupe_key    TEXT    UNIQUE,
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_signals_created ON signals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_symbol ON signals(symbol, timeframe);

-- --------------------------------------------------------------- ai analysis
CREATE TABLE IF NOT EXISTS ai_analysis (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  signal_id     INTEGER REFERENCES signals(id) ON DELETE CASCADE,
  symbol        TEXT    NOT NULL,
  verdict       TEXT    NOT NULL,                -- HIGH QUALITY | MEDIUM QUALITY | LOW QUALITY | REJECTED
  confidence    INTEGER NOT NULL,
  summary       TEXT    NOT NULL,
  reasons       TEXT,                            -- JSON array
  evidence      TEXT,                            -- JSON array of {label, value, note}
  reject_reason TEXT,
  model         TEXT    NOT NULL DEFAULT 'rule-engine',
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analysis_signal ON ai_analysis(signal_id);
CREATE INDEX IF NOT EXISTS idx_analysis_created ON ai_analysis(created_at DESC);

-- --------------------------------------------------------------- paper trades
CREATE TABLE IF NOT EXISTS paper_trades (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  signal_id      INTEGER REFERENCES signals(id) ON DELETE SET NULL,
  symbol         TEXT    NOT NULL,
  direction      TEXT    NOT NULL,               -- BUY | SELL
  strategy       TEXT,
  timeframe      TEXT,
  entry_price    REAL    NOT NULL,               -- after slippage
  exit_price     REAL,
  quantity       REAL    NOT NULL,
  notional       REAL    NOT NULL,
  stop_loss      REAL    NOT NULL,
  take_profit    REAL    NOT NULL,
  risk_amount    REAL    NOT NULL,
  fee_paid       REAL    NOT NULL DEFAULT 0,
  slippage_paid  REAL    NOT NULL DEFAULT 0,
  realized_pnl   REAL,
  floating_pnl   REAL    NOT NULL DEFAULT 0,
  status         TEXT    NOT NULL DEFAULT 'OPEN', -- OPEN | CLOSED
  close_reason   TEXT,                            -- TAKE_PROFIT | STOP_LOSS | MANUAL | SIGNAL_EXIT
  source         TEXT    NOT NULL DEFAULT 'live',
  opened_at      INTEGER NOT NULL,
  closed_at      INTEGER
);
CREATE INDEX IF NOT EXISTS idx_trades_status ON paper_trades(status, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON paper_trades(symbol);

-- -------------------------------------------------------------- equity curve
CREATE TABLE IF NOT EXISTS equity_curve (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ts            INTEGER NOT NULL,
  equity        REAL    NOT NULL,
  balance       REAL    NOT NULL,
  unrealized    REAL    NOT NULL DEFAULT 0,
  open_positions INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_equity_ts ON equity_curve(ts DESC);

-- -------------------------------------------------------- strategy performance
CREATE TABLE IF NOT EXISTS strategy_performance (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy      TEXT    NOT NULL,
  timeframe     TEXT    NOT NULL,
  trades        INTEGER NOT NULL DEFAULT 0,
  wins          INTEGER NOT NULL DEFAULT 0,
  losses        INTEGER NOT NULL DEFAULT 0,
  win_rate      REAL    NOT NULL DEFAULT 0,
  profit_factor REAL    NOT NULL DEFAULT 0,
  max_drawdown  REAL    NOT NULL DEFAULT 0,
  avg_win       REAL    NOT NULL DEFAULT 0,
  avg_loss      REAL    NOT NULL DEFAULT 0,
  expectancy    REAL    NOT NULL DEFAULT 0,
  rr_actual     REAL    NOT NULL DEFAULT 0,
  updated_at    INTEGER NOT NULL,
  UNIQUE(strategy, timeframe)
);

-- ------------------------------------------------------------ backtest runs
CREATE TABLE IF NOT EXISTS backtest_runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy      TEXT    NOT NULL,
  timeframe     TEXT    NOT NULL,
  symbols       TEXT    NOT NULL,
  candles       INTEGER NOT NULL,
  trades        INTEGER NOT NULL,
  wins          INTEGER NOT NULL,
  losses        INTEGER NOT NULL,
  win_rate      REAL    NOT NULL,
  profit_factor REAL    NOT NULL,
  max_drawdown  REAL    NOT NULL,
  avg_win       REAL    NOT NULL,
  avg_loss      REAL    NOT NULL,
  expectancy    REAL    NOT NULL,
  rr_actual     REAL    NOT NULL,
  net_pnl       REAL    NOT NULL,
  params        TEXT,
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_backtest_created ON backtest_runs(created_at DESC);

-- ---------------------------------------------------------------- watchlist
CREATE TABLE IF NOT EXISTS watchlist (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol     TEXT    NOT NULL UNIQUE,
  timeframe  TEXT    NOT NULL DEFAULT '1h',
  min_score  INTEGER NOT NULL DEFAULT 60,
  created_at INTEGER NOT NULL
);

-- ----------------------------------------------------------------- settings
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- -------------------------------------------------------------- system logs
CREATE TABLE IF NOT EXISTS system_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  level      TEXT    NOT NULL,                   -- info | warn | error
  scope      TEXT    NOT NULL,
  message    TEXT    NOT NULL,
  meta       TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_logs_created ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level ON system_logs(level, created_at DESC);

-- ----------------------------------------------------------- notifications
CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  type       TEXT    NOT NULL,                   -- SIGNAL | SL | TP | SCANNER | SYSTEM
  title      TEXT    NOT NULL,
  body       TEXT    NOT NULL,
  symbol     TEXT,
  severity   TEXT    NOT NULL DEFAULT 'info',    -- info | success | warning | danger
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications(created_at DESC);

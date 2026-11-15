'use strict';
/**
 * Repository layer — every SQL statement in the app lives here.
 * Engines and HTTP routes never build SQL inline.
 */

const db = require('./index');

const now = () => Date.now();
const parseJson = (value, fallback) => {
  if (value === null || value === undefined) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

/* ------------------------------------------------------------------ settings */

function getSetting(key, fallback = null) {
  const row = db.get('SELECT value FROM settings WHERE key = ?', [key]);
  if (!row) return fallback;
  return parseJson(row.value, row.value);
}

function setSetting(key, value) {
  db.run(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, JSON.stringify(value), now()]
  );
  return value;
}

function allSettings() {
  const out = {};
  for (const row of db.all('SELECT key, value FROM settings')) {
    out[row.key] = parseJson(row.value, row.value);
  }
  return out;
}

/* ---------------------------------------------------------- market snapshots */

function insertSnapshots(rows) {
  if (!rows.length) return 0;
  return db.tx(() => {
    for (const r of rows) {
      db.run(
        `INSERT INTO market_snapshots (symbol, price, change_24h, volume_24h, high_24h, low_24h, source, ts)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.symbol, r.price, r.change24h, r.volume24h, r.high24h, r.low24h, r.source || 'live', r.ts || now()]
      );
    }
    return rows.length;
  });
}

function latestSnapshot(symbol) {
  return db.get('SELECT * FROM market_snapshots WHERE symbol = ? ORDER BY ts DESC LIMIT 1', [symbol]);
}

function snapshotCount() {
  return db.scalar('SELECT COUNT(*) FROM market_snapshots') || 0;
}

/* ------------------------------------------------------------------- signals */

function insertSignal(sig) {
  try {
    const info = db.run(
      `INSERT INTO signals
        (symbol, timeframe, strategy, direction, price, entry, stop_loss, take_profit,
         risk_reward, score, quality, reasons, indicators, status, source, dedupe_key, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        sig.symbol, sig.timeframe, sig.strategy, sig.direction, sig.price, sig.entry,
        sig.stopLoss, sig.takeProfit, sig.riskReward, sig.score, sig.quality,
        JSON.stringify(sig.reasons || []), JSON.stringify(sig.indicators || {}),
        sig.status || 'NEW', sig.source || 'live', sig.dedupeKey || null, sig.createdAt || now(),
      ]
    );
    return Number(info.lastInsertRowid);
  } catch (err) {
    // Dedupe key collision: the signal already exists, which is expected behaviour.
    if (String(err.message).includes('UNIQUE')) return null;
    throw err;
  }
}

function mapSignal(row) {
  if (!row) return null;
  return {
    id: row.id,
    symbol: row.symbol,
    timeframe: row.timeframe,
    strategy: row.strategy,
    direction: row.direction,
    price: row.price,
    entry: row.entry,
    stopLoss: row.stop_loss,
    takeProfit: row.take_profit,
    riskReward: row.risk_reward,
    score: row.score,
    quality: row.quality,
    reasons: parseJson(row.reasons, []),
    indicators: parseJson(row.indicators, {}),
    status: row.status,
    source: row.source,
    createdAt: row.created_at,
  };
}

function listSignals({ limit = 50, symbol, timeframe, quality, direction, since, status } = {}) {
  const where = [];
  const params = [];
  if (symbol) { where.push('symbol = ?'); params.push(symbol); }
  if (timeframe) { where.push('timeframe = ?'); params.push(timeframe); }
  if (quality) { where.push('quality = ?'); params.push(quality); }
  if (direction) { where.push('direction = ?'); params.push(direction); }
  if (status) { where.push('status = ?'); params.push(status); }
  if (since) { where.push('created_at >= ?'); params.push(since); }
  const sql = `SELECT * FROM signals ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY created_at DESC LIMIT ?`;
  params.push(Math.min(Number(limit) || 50, 500));
  return db.all(sql, params).map(mapSignal);
}

function getSignal(id) {
  return mapSignal(db.get('SELECT * FROM signals WHERE id = ?', [id]));
}

function updateSignalStatus(id, status) {
  db.run('UPDATE signals SET status = ? WHERE id = ?', [status, id]);
}

function signalStats(sinceTs) {
  const row = db.get(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN quality = 'HIGH' THEN 1 ELSE 0 END) AS high,
       SUM(CASE WHEN quality = 'MEDIUM' THEN 1 ELSE 0 END) AS medium,
       SUM(CASE WHEN quality = 'LOW' THEN 1 ELSE 0 END) AS low,
       SUM(CASE WHEN quality = 'REJECTED' THEN 1 ELSE 0 END) AS rejected,
       SUM(CASE WHEN direction = 'BUY' THEN 1 ELSE 0 END) AS buy,
       SUM(CASE WHEN direction = 'SELL' THEN 1 ELSE 0 END) AS sell
     FROM signals WHERE created_at >= ?`,
    [sinceTs]
  ) || {};
  return {
    total: row.total || 0,
    high: row.high || 0,
    medium: row.medium || 0,
    low: row.low || 0,
    rejected: row.rejected || 0,
    buy: row.buy || 0,
    sell: row.sell || 0,
  };
}

/** Signals per hour bucket for the dashboard chart. */
function signalHistogram(sinceTs, buckets = 12, bucketMs = 3600000) {
  const rows = db.all(
    'SELECT created_at, direction FROM signals WHERE created_at >= ? ORDER BY created_at ASC',
    [sinceTs]
  );
  const start = Math.floor(sinceTs / bucketMs) * bucketMs;
  const out = [];
  for (let i = 0; i < buckets; i += 1) {
    out.push({ ts: start + i * bucketMs, buy: 0, sell: 0, total: 0 });
  }
  for (const r of rows) {
    const idx = Math.floor((r.created_at - start) / bucketMs);
    if (idx >= 0 && idx < buckets) {
      out[idx].total += 1;
      if (r.direction === 'BUY') out[idx].buy += 1;
      else out[idx].sell += 1;
    }
  }
  return out;
}

/* -------------------------------------------------------------- ai analysis */

function insertAnalysis(a) {
  const info = db.run(
    `INSERT INTO ai_analysis
      (signal_id, symbol, verdict, confidence, summary, reasons, evidence, reject_reason, model, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      a.signalId || null, a.symbol, a.verdict, a.confidence, a.summary,
      JSON.stringify(a.reasons || []), JSON.stringify(a.evidence || []),
      a.rejectReason || null, a.model || 'rule-engine', a.createdAt || now(),
    ]
  );
  if (a.signalId) updateSignalStatus(a.signalId, 'ANALYZED');
  return Number(info.lastInsertRowid);
}

function mapAnalysis(row) {
  if (!row) return null;
  return {
    id: row.id,
    signalId: row.signal_id,
    symbol: row.symbol,
    verdict: row.verdict,
    confidence: row.confidence,
    summary: row.summary,
    reasons: parseJson(row.reasons, []),
    evidence: parseJson(row.evidence, []),
    rejectReason: row.reject_reason,
    model: row.model,
    createdAt: row.created_at,
  };
}

function listAnalysis({ limit = 30, symbol, verdict } = {}) {
  const where = [];
  const params = [];
  if (symbol) { where.push('symbol = ?'); params.push(symbol); }
  if (verdict) { where.push('verdict = ?'); params.push(verdict); }
  const sql = `SELECT * FROM ai_analysis ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY created_at DESC LIMIT ?`;
  params.push(Math.min(Number(limit) || 30, 200));
  return db.all(sql, params).map(mapAnalysis);
}

function analysisForSignal(signalId) {
  return mapAnalysis(
    db.get('SELECT * FROM ai_analysis WHERE signal_id = ? ORDER BY created_at DESC LIMIT 1', [signalId])
  );
}

function analysisStats(sinceTs) {
  const row = db.get(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN verdict = 'HIGH QUALITY' THEN 1 ELSE 0 END) AS high,
            SUM(CASE WHEN verdict = 'MEDIUM QUALITY' THEN 1 ELSE 0 END) AS medium,
            SUM(CASE WHEN verdict = 'LOW QUALITY' THEN 1 ELSE 0 END) AS low,
            SUM(CASE WHEN verdict = 'REJECTED' THEN 1 ELSE 0 END) AS rejected,
            AVG(confidence) AS avg_confidence
     FROM ai_analysis WHERE created_at >= ?`,
    [sinceTs]
  ) || {};
  return {
    total: row.total || 0,
    high: row.high || 0,
    medium: row.medium || 0,
    low: row.low || 0,
    rejected: row.rejected || 0,
    avgConfidence: Math.round(row.avg_confidence || 0),
  };
}

/* ------------------------------------------------------------- paper trades */

function insertTrade(t) {
  const info = db.run(
    `INSERT INTO paper_trades
      (signal_id, symbol, direction, strategy, timeframe, entry_price, quantity, notional,
       stop_loss, take_profit, risk_amount, fee_paid, slippage_paid, floating_pnl, status, source, opened_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      t.signalId || null, t.symbol, t.direction, t.strategy || null, t.timeframe || null,
      t.entryPrice, t.quantity, t.notional, t.stopLoss, t.takeProfit, t.riskAmount,
      t.feePaid || 0, t.slippagePaid || 0, t.floatingPnl || 0, 'OPEN', t.source || 'live',
      t.openedAt || now(),
    ]
  );
  return Number(info.lastInsertRowid);
}

function mapTrade(row) {
  if (!row) return null;
  return {
    id: row.id,
    signalId: row.signal_id,
    symbol: row.symbol,
    direction: row.direction,
    strategy: row.strategy,
    timeframe: row.timeframe,
    entryPrice: row.entry_price,
    exitPrice: row.exit_price,
    quantity: row.quantity,
    notional: row.notional,
    stopLoss: row.stop_loss,
    takeProfit: row.take_profit,
    riskAmount: row.risk_amount,
    feePaid: row.fee_paid,
    slippagePaid: row.slippage_paid,
    realizedPnl: row.realized_pnl,
    floatingPnl: row.floating_pnl,
    status: row.status,
    closeReason: row.close_reason,
    source: row.source,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
  };
}

function listTrades({ status, limit = 100, symbol } = {}) {
  const where = [];
  const params = [];
  if (status) { where.push('status = ?'); params.push(status); }
  if (symbol) { where.push('symbol = ?'); params.push(symbol); }
  const sql = `SELECT * FROM paper_trades ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY opened_at DESC LIMIT ?`;
  params.push(Math.min(Number(limit) || 100, 500));
  return db.all(sql, params).map(mapTrade);
}

function getTrade(id) {
  return mapTrade(db.get('SELECT * FROM paper_trades WHERE id = ?', [id]));
}

function openTrades() {
  return db.all("SELECT * FROM paper_trades WHERE status = 'OPEN' ORDER BY opened_at ASC").map(mapTrade);
}

function countOpenTrades() {
  return db.scalar("SELECT COUNT(*) FROM paper_trades WHERE status = 'OPEN'") || 0;
}

function updateFloating(id, floatingPnl) {
  db.run('UPDATE paper_trades SET floating_pnl = ? WHERE id = ?', [floatingPnl, id]);
}

function closeTrade(id, { exitPrice, realizedPnl, feePaid, closeReason }) {
  db.run(
    `UPDATE paper_trades
       SET exit_price = ?, realized_pnl = ?, fee_paid = ?, floating_pnl = 0,
           status = 'CLOSED', close_reason = ?, closed_at = ?
     WHERE id = ?`,
    [exitPrice, realizedPnl, feePaid, closeReason, now(), id]
  );
}

function tradeStats() {
  const row = db.get(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN status = 'CLOSED' AND realized_pnl > 0 THEN 1 ELSE 0 END) AS wins,
       SUM(CASE WHEN status = 'CLOSED' AND realized_pnl <= 0 THEN 1 ELSE 0 END) AS losses,
       SUM(CASE WHEN status = 'CLOSED' THEN realized_pnl ELSE 0 END) AS realized,
       SUM(CASE WHEN status = 'OPEN' THEN floating_pnl ELSE 0 END) AS floating,
       SUM(CASE WHEN status = 'CLOSED' AND realized_pnl > 0 THEN realized_pnl ELSE 0 END) AS gross_profit,
       SUM(CASE WHEN status = 'CLOSED' AND realized_pnl < 0 THEN -realized_pnl ELSE 0 END) AS gross_loss,
       SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) AS open_count
     FROM paper_trades`
  ) || {};
  const closed = (row.wins || 0) + (row.losses || 0);
  return {
    total: row.total || 0,
    open: row.open_count || 0,
    closed,
    wins: row.wins || 0,
    losses: row.losses || 0,
    winRate: closed ? (row.wins / closed) * 100 : 0,
    realizedPnl: row.realized || 0,
    floatingPnl: row.floating || 0,
    grossProfit: row.gross_profit || 0,
    grossLoss: row.gross_loss || 0,
    profitFactor: row.gross_loss > 0 ? (row.gross_profit || 0) / row.gross_loss : (row.gross_profit > 0 ? Infinity : 0),
  };
}

/** Daily realized P/L for the dashboard chart. */
function dailyPnl(days = 7) {
  const since = Date.now() - days * 86400000;
  const rows = db.all(
    `SELECT closed_at, realized_pnl FROM paper_trades
     WHERE status = 'CLOSED' AND closed_at >= ? ORDER BY closed_at ASC`,
    [since]
  );
  const buckets = [];
  const dayMs = 86400000;
  const start = Math.floor(since / dayMs) * dayMs;
  for (let i = 0; i < days; i += 1) {
    buckets.push({ ts: start + i * dayMs, pnl: 0, trades: 0 });
  }
  for (const r of rows) {
    const idx = Math.floor((r.closed_at - start) / dayMs);
    if (idx >= 0 && idx < days) {
      buckets[idx].pnl += r.realized_pnl || 0;
      buckets[idx].trades += 1;
    }
  }
  return buckets;
}

/* -------------------------------------------------------------- equity curve */

function insertEquityPoint(p) {
  db.run(
    `INSERT INTO equity_curve (ts, equity, balance, unrealized, open_positions) VALUES (?,?,?,?,?)`,
    [p.ts || now(), p.equity, p.balance, p.unrealized || 0, p.openPositions || 0]
  );
}

function equityCurve(limit = 120) {
  const rows = db.all('SELECT * FROM equity_curve ORDER BY ts DESC LIMIT ?', [limit]);
  return rows
    .reverse()
    .map((r) => ({ ts: r.ts, equity: r.equity, balance: r.balance, unrealized: r.unrealized, openPositions: r.open_positions }));
}

/* ------------------------------------------------------- strategy performance */

function upsertStrategyPerformance(p) {
  db.run(
    `INSERT INTO strategy_performance
      (strategy, timeframe, trades, wins, losses, win_rate, profit_factor, max_drawdown,
       avg_win, avg_loss, expectancy, rr_actual, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(strategy, timeframe) DO UPDATE SET
       trades = excluded.trades, wins = excluded.wins, losses = excluded.losses,
       win_rate = excluded.win_rate, profit_factor = excluded.profit_factor,
       max_drawdown = excluded.max_drawdown, avg_win = excluded.avg_win,
       avg_loss = excluded.avg_loss, expectancy = excluded.expectancy,
       rr_actual = excluded.rr_actual, updated_at = excluded.updated_at`,
    [
      p.strategy, p.timeframe, p.trades, p.wins, p.losses, p.winRate, p.profitFactor,
      p.maxDrawdown, p.avgWin, p.avgLoss, p.expectancy, p.rrActual, now(),
    ]
  );
}

function listStrategyPerformance() {
  return db.all('SELECT * FROM strategy_performance ORDER BY trades DESC').map((r) => ({
    strategy: r.strategy,
    timeframe: r.timeframe,
    trades: r.trades,
    wins: r.wins,
    losses: r.losses,
    winRate: r.win_rate,
    profitFactor: r.profit_factor,
    maxDrawdown: r.max_drawdown,
    avgWin: r.avg_win,
    avgLoss: r.avg_loss,
    expectancy: r.expectancy,
    rrActual: r.rr_actual,
    updatedAt: r.updated_at,
  }));
}

/* --------------------------------------------------------------- backtests */

function insertBacktestRun(r) {
  const info = db.run(
    `INSERT INTO backtest_runs
      (strategy, timeframe, symbols, candles, trades, wins, losses, win_rate, profit_factor,
       max_drawdown, avg_win, avg_loss, expectancy, rr_actual, net_pnl, params, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      r.strategy, r.timeframe, r.symbols, r.candles, r.trades, r.wins, r.losses, r.winRate,
      r.profitFactor, r.maxDrawdown, r.avgWin, r.avgLoss, r.expectancy, r.rrActual,
      r.netPnl, JSON.stringify(r.params || {}), now(),
    ]
  );
  return Number(info.lastInsertRowid);
}

function listBacktestRuns(limit = 20) {
  return db.all('SELECT * FROM backtest_runs ORDER BY created_at DESC LIMIT ?', [limit]).map((r) => ({
    id: r.id,
    strategy: r.strategy,
    timeframe: r.timeframe,
    symbols: r.symbols,
    candles: r.candles,
    trades: r.trades,
    wins: r.wins,
    losses: r.losses,
    winRate: r.win_rate,
    profitFactor: r.profit_factor,
    maxDrawdown: r.max_drawdown,
    avgWin: r.avg_win,
    avgLoss: r.avg_loss,
    expectancy: r.expectancy,
    rrActual: r.rr_actual,
    netPnl: r.net_pnl,
    createdAt: r.created_at,
  }));
}

/* --------------------------------------------------------------- watchlist */

function listWatchlist() {
  return db.all('SELECT * FROM watchlist ORDER BY created_at ASC').map((r) => ({
    id: r.id,
    symbol: r.symbol,
    timeframe: r.timeframe,
    minScore: r.min_score,
    createdAt: r.created_at,
  }));
}

function addWatchlist(symbol, timeframe = '1h', minScore = 60) {
  db.run(
    `INSERT INTO watchlist (symbol, timeframe, min_score, created_at) VALUES (?,?,?,?)
     ON CONFLICT(symbol) DO UPDATE SET timeframe = excluded.timeframe, min_score = excluded.min_score`,
    [symbol, timeframe, minScore, now()]
  );
  return db.get('SELECT * FROM watchlist WHERE symbol = ?', [symbol]);
}

function updateWatchlist(symbol, { timeframe, minScore }) {
  const current = db.get('SELECT * FROM watchlist WHERE symbol = ?', [symbol]);
  if (!current) return null;
  db.run('UPDATE watchlist SET timeframe = ?, min_score = ? WHERE symbol = ?', [
    timeframe ?? current.timeframe,
    minScore ?? current.min_score,
    symbol,
  ]);
  return db.get('SELECT * FROM watchlist WHERE symbol = ?', [symbol]);
}

function removeWatchlist(symbol) {
  const info = db.run('DELETE FROM watchlist WHERE symbol = ?', [symbol]);
  return info.changes > 0;
}

/* ------------------------------------------------------------ system logs */

function log(level, scope, message, meta) {
  db.run('INSERT INTO system_logs (level, scope, message, meta, created_at) VALUES (?,?,?,?,?)', [
    level, scope, String(message).slice(0, 2000), meta ? JSON.stringify(meta) : null, now(),
  ]);
  if (level === 'error') errorCount += 1;
}

let errorCount = 0;

function errorCountTotal() {
  return errorCount;
}

function listLogs({ limit = 80, level } = {}) {
  const sql = level
    ? 'SELECT * FROM system_logs WHERE level = ? ORDER BY created_at DESC LIMIT ?'
    : 'SELECT * FROM system_logs ORDER BY created_at DESC LIMIT ?';
  const params = level ? [level, limit] : [limit];
  return db.all(sql, params).map((r) => ({
    id: r.id,
    level: r.level,
    scope: r.scope,
    message: r.message,
    meta: parseJson(r.meta, null),
    createdAt: r.created_at,
  }));
}

/* ---------------------------------------------------------- notifications */

function addNotification({ type, title, body, symbol, severity = 'info' }) {
  const info = db.run(
    'INSERT INTO notifications (type, title, body, symbol, severity, created_at) VALUES (?,?,?,?,?,?)',
    [type, title, body, symbol || null, severity, now()]
  );
  return Number(info.lastInsertRowid);
}

function listNotifications({ limit = 50, unreadOnly = false } = {}) {
  const sql = unreadOnly
    ? 'SELECT * FROM notifications WHERE is_read = 0 ORDER BY created_at DESC LIMIT ?'
    : 'SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?';
  return db.all(sql, [limit]).map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    symbol: r.symbol,
    severity: r.severity,
    isRead: Boolean(r.is_read),
    createdAt: r.created_at,
  }));
}

function unreadCount() {
  return db.scalar('SELECT COUNT(*) FROM notifications WHERE is_read = 0') || 0;
}

function markNotificationRead(id) {
  db.run('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
}

function markAllNotificationsRead() {
  db.run('UPDATE notifications SET is_read = 1 WHERE is_read = 0');
}

function clearNotifications() {
  db.run('DELETE FROM notifications');
}

module.exports = {
  now,
  // settings
  getSetting, setSetting, allSettings,
  // market
  insertSnapshots, latestSnapshot, snapshotCount,
  // signals
  insertSignal, listSignals, getSignal, updateSignalStatus, signalStats, signalHistogram,
  // analysis
  insertAnalysis, listAnalysis, analysisForSignal, analysisStats,
  // trades
  insertTrade, listTrades, getTrade, openTrades, countOpenTrades, updateFloating,
  closeTrade, tradeStats, dailyPnl,
  // equity
  insertEquityPoint, equityCurve,
  // strategy perf
  upsertStrategyPerformance, listStrategyPerformance,
  // backtests
  insertBacktestRun, listBacktestRuns,
  // watchlist
  listWatchlist, addWatchlist, updateWatchlist, removeWatchlist,
  // logs
  log, listLogs, errorCountTotal,
  // notifications
  addNotification, listNotifications, unreadCount, markNotificationRead,
  markAllNotificationsRead, clearNotifications,
};

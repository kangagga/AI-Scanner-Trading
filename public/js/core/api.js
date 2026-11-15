/**
 * API client for the EXISTING AI Scanner bot backend.
 *
 * This module never invents bot state. Every value shown in the UI either
 * comes from your backend, or is explicitly flagged as DEMO (see demo.js).
 *
 * ── Adjusting to your bot ────────────────────────────────────────────────
 * If your legacy bot exposes different routes, change ONLY the PATHS map
 * below. Nothing else in the app hardcodes an endpoint.
 *
 * Required backend contract (minimum for full functionality):
 *   GET  /health              -> { ok: true, version?, uptimeSec? }
 *   GET  /status              -> { running, state, paperTrading, bitgetMirror,
 *                                 coinsTracked, signalsToday, validSignals,
 *                                 rejectedSignals, openPositions, totalPnl,
 *                                 winRate, marketCondition, lastUpdate }
 *   GET  /scanner/signals     -> { signals: [ {id,symbol,timeframe,direction,
 *                                 price,entry,stopLoss,takeProfit,rr,score,
 *                                 quality,reasons[],createdAt} ] }
 *   GET  /market/overview     -> { btcTrend, ethTrend, sentiment, volume,
 *                                 gainers[], losers[], topVolume[],
 *                                 btcDominance, condition }
 *   GET  /paper/positions     -> { positions: [ {id,symbol,side,entry,size,
 *                                 stopLoss,takeProfit,floatingPnl,openedAt} ] }
 *   GET  /trades              -> { trades: [ {id,symbol,side,entry,exit,
 *                                 size,pnl,fee,openedAt,closedAt,reason} ] }
 *   GET  /performance         -> { winRate, profitFactor, maxDrawdown,
 *                                 avgWin, avgLoss, samples, byStrategy[],
 *                                 byTimeframe[], equity[] }
 *   GET  /strategy/config     -> { strategies[], timeframes[], minScore,
 *                                 riskPercent, ... }  (read-only view)
 *   GET  /system/logs         -> { logs: [ {ts,level,message} ] }
 *   POST /bot/start|stop|restart|refresh -> { ok: true, state }
 */

const STORAGE_KEY = 'aist.connection.v1';

export const PATHS = {
  health: '/health',
  status: '/status',
  signals: '/scanner/signals',
  market: '/market/overview',
  positions: '/paper/positions',
  trades: '/trades',
  performance: '/performance',
  strategy: '/strategy/config',
  logs: '/system/logs',
  start: '/bot/start',
  stop: '/bot/stop',
  restart: '/bot/restart',
  refresh: '/bot/refresh',
};

export const DEFAULT_CONNECTION = {
  /** 'direct' = phone talks to the bot; 'proxy' = via this bridge server. */
  mode: 'direct',
  /** e.g. http://192.168.1.10:8080 (Termux on the same WiFi). */
  baseUrl: '',
  /** Optional explicit WebSocket URL; derived from baseUrl when empty. */
  wsUrl: '',
  /** Bearer token for your bot's control endpoints (stored locally only). */
  token: '',
  /** Show clearly-labeled demo fixtures when the backend is unreachable. */
  allowDemo: true,
  /** Seconds before a request is treated as failed. */
  timeoutSec: 12,
};

export const CONNECTION_STATES = Object.freeze({
  OFFLINE: 'OFFLINE',
  CONNECTING: 'CONNECTING',
  ONLINE: 'ONLINE',
  ERROR: 'ERROR',
  DEMO: 'DEMO',
});

export function loadConnection() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONNECTION };
    return { ...DEFAULT_CONNECTION, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONNECTION };
  }
}

export function saveConnection(patch) {
  const next = { ...loadConnection(), ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage may be unavailable in private mode — keep in memory only */
  }
  return next;
}

function trimBase(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

export function buildUrl(path, conn = loadConnection()) {
  if (conn.mode === 'proxy') return `/api/upstream${path}`;
  const base = trimBase(conn.baseUrl);
  if (!base) return null;
  return `${base}${path}`;
}

export function deriveWsUrl(conn = loadConnection()) {
  if (conn.wsUrl) return conn.wsUrl;
  if (conn.mode === 'proxy') {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}/api/upstream/ws`;
  }
  const base = trimBase(conn.baseUrl);
  if (!base) return null;
  try {
    const u = new URL(base);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    u.pathname = `${u.pathname.replace(/\/+$/, '')}/ws`;
    return u.toString();
  } catch {
    return null;
  }
}

/** Low-level request. Returns { ok, status, data, error, message, ms }. */
export async function request(path, { method = 'GET', body, conn = loadConnection(), timeoutSec } = {}) {
  const url = buildUrl(path, conn);
  if (!url) {
    return {
      ok: false,
      status: 0,
      error: 'NO_BACKEND_CONFIGURED',
      message: 'Backend URL is not configured. Open Settings and enter your bot address.',
      ms: 0,
    };
  }

  const controller = new AbortController();
  const limit = (timeoutSec ?? conn.timeoutSec ?? 12) * 1000;
  const timer = setTimeout(() => controller.abort(), limit);
  const started = performance.now();

  try {
    const headers = { accept: 'application/json' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (conn.token) headers.authorization = `Bearer ${conn.token}`;

    const res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
    });

    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text.slice(0, 2000) };
      }
    }

    const ms = Math.round(performance.now() - started);

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data,
        error: data?.error || `HTTP_${res.status}`,
        message: data?.message || `Backend answered HTTP ${res.status}.`,
        ms,
      };
    }
    return { ok: true, status: res.status, data, ms };
  } catch (err) {
    const ms = Math.round(performance.now() - started);
    const aborted = err?.name === 'AbortError';
    return {
      ok: false,
      status: 0,
      error: aborted ? 'TIMEOUT' : 'NETWORK',
      message: aborted
        ? `No response within ${limit / 1000}s.`
        : `Cannot reach backend (${err.message}). Check the URL, WiFi, and that the bot is running.`,
      ms,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Probe the backend: health first, then status. Never throws. */
export async function probe(conn = loadConnection()) {
  if (!conn.baseUrl && conn.mode === 'direct') {
    return { state: CONNECTION_STATES.OFFLINE, message: 'No backend URL configured yet.', health: null, status: null };
  }
  const health = await request(PATHS.health, { conn });
  if (!health.ok) {
    return { state: CONNECTION_STATES.ERROR, message: health.message, error: health.error, health: null, status: null };
  }
  const status = await request(PATHS.status, { conn });
  return {
    state: CONNECTION_STATES.ONLINE,
    message: 'Connected to bot backend.',
    health: health.data,
    status: status.ok ? status.data : null,
    statusError: status.ok ? null : status.message,
    latencyMs: health.ms,
  };
}

/** Control actions. These only succeed if the backend confirms them. */
export async function sendControl(action, conn = loadConnection()) {
  const path = PATHS[action];
  if (!path) return { ok: false, error: 'UNKNOWN_ACTION', message: `Unknown action: ${action}` };
  return request(path, { method: 'POST', body: {}, conn });
}

// ── Read helpers ──────────────────────────────────────────────────────────
export const readStatus = (conn) => request(PATHS.status, { conn });
export const readSignals = (conn, limit = 60) => request(`${PATHS.signals}?limit=${limit}`, { conn });
export const readMarket = (conn) => request(PATHS.market, { conn });
export const readPositions = (conn) => request(PATHS.positions, { conn });
export const readTrades = (conn, limit = 100) => request(`${PATHS.trades}?limit=${limit}`, { conn });
export const readPerformance = (conn) => request(PATHS.performance, { conn });
export const readStrategy = (conn) => request(PATHS.strategy, { conn });
export const readLogs = (conn, limit = 80) => request(`${PATHS.logs}?limit=${limit}`, { conn });

/**
 * WebSocket subscription with exponential backoff.
 * Events expected from the bot: { type: 'signal:new'|'price:tick'|
 * 'trade:update'|'bot:state'|'log', payload: {...} }
 */
export function openSocket({ conn = loadConnection(), onEvent, onState } = {}) {
  const url = deriveWsUrl(conn);
  let socket = null;
  let attempt = 0;
  let closedByUser = false;
  let retryTimer = null;

  const notify = (state, detail) => onState?.({ state, detail });

  function connect() {
    if (!url) {
      notify('unavailable', 'No WebSocket URL — using REST polling.');
      return;
    }
    notify('connecting', url);
    try {
      socket = new WebSocket(url);
    } catch (err) {
      notify('error', err.message);
      scheduleRetry();
      return;
    }

    socket.onopen = () => {
      attempt = 0;
      notify('open', url);
      if (conn.token) {
        try {
          socket.send(JSON.stringify({ type: 'auth', token: conn.token }));
        } catch {
          /* token handshake is optional */
        }
      }
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        onEvent?.(msg);
      } catch {
        onEvent?.({ type: 'raw', payload: event.data });
      }
    };

    socket.onerror = () => notify('error', 'WebSocket error.');
    socket.onclose = () => {
      notify('closed', 'WebSocket closed.');
      if (!closedByUser) scheduleRetry();
    };
  }

  function scheduleRetry() {
    if (closedByUser) return;
    attempt += 1;
    const delay = Math.min(30000, 1500 * 2 ** Math.min(attempt, 4));
    retryTimer = setTimeout(connect, delay);
  }

  connect();

  return {
    close() {
      closedByUser = true;
      clearTimeout(retryTimer);
      try {
        socket?.close();
      } catch {
        /* already closed */
      }
    },
    get url() {
      return url;
    },
  };
}

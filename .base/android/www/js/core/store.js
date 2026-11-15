/**
 * Central app state.
 *
 * Rules enforced here:
 *  - A resource is only marked `demo: false` when the real backend answered.
 *  - Control actions never report success unless the backend confirmed them.
 *  - Every failure keeps its message so the UI can explain what is wrong.
 */

import * as api from './api.js';
import { demoFor } from './demo.js';

const listeners = new Set();

export const state = {
  conn: api.loadConnection(),
  connection: { state: api.CONNECTION_STATES.OFFLINE, message: 'Belum terhubung.', latencyMs: null },
  socket: { state: 'closed', detail: '' },
  bridge: null,
  resources: {},
  controls: { pending: null, last: null },
  toast: null,
  pollTimer: null,
};

const RESOURCE_LOADERS = {
  status: (conn) => api.readStatus(conn),
  signals: (conn) => api.readSignals(conn, 60),
  market: (conn) => api.readMarket(conn),
  positions: (conn) => api.readPositions(conn),
  trades: (conn) => api.readTrades(conn, 100),
  performance: (conn) => api.readPerformance(conn),
  strategy: (conn) => api.readStrategy(conn),
  logs: (conn) => api.readLogs(conn, 80),
};

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) {
    try {
      fn(state);
    } catch (err) {
      console.error('[store] listener failed', err);
    }
  }
}

export function toast(message, kind = 'info', ttl = 4200) {
  state.toast = { message, kind, id: Date.now() };
  emit();
  setTimeout(() => {
    if (state.toast && Date.now() - state.toast.id >= ttl - 50) {
      state.toast = null;
      emit();
    }
  }, ttl);
}

export function updateConnection(patch) {
  state.conn = api.saveConnection(patch);
  emit();
}

/** True only when the app may perform real control actions. */
export function canControl() {
  return state.connection.state === api.CONNECTION_STATES.ONLINE && !isDemoResource('status');
}

export function isDemoResource(name) {
  return Boolean(state.resources[name]?.demo);
}

export function anyDemo() {
  return Object.values(state.resources).some((r) => r && r.demo);
}

/** Load one resource, falling back to labeled demo data when allowed. */
export async function loadResource(name) {
  const loader = RESOURCE_LOADERS[name];
  if (!loader) return;

  const prev = state.resources[name] || {};
  state.resources[name] = { ...prev, loading: true };
  emit();

  const res = await loader(state.conn);

  if (res.ok) {
    state.resources[name] = {
      data: res.data,
      demo: false,
      loading: false,
      error: null,
      updatedAt: Date.now(),
      latencyMs: res.ms,
    };
  } else {
    const useDemo = state.conn.allowDemo;
    state.resources[name] = {
      data: useDemo ? demoFor(name) : null,
      demo: useDemo,
      loading: false,
      error: res.message || res.error || 'Request failed.',
      errorCode: res.error,
      updatedAt: Date.now(),
      latencyMs: res.ms,
    };
  }
  emit();
}

export async function loadBridge() {
  try {
    const res = await fetch('/api/bridge', { cache: 'no-store' });
    if (res.ok) state.bridge = await res.json();
  } catch {
    state.bridge = null;
  }
  emit();
}

/** Probe the bot backend and update connection state. */
export async function testConnection({ quiet = false } = {}) {
  state.connection = { ...state.connection, state: api.CONNECTION_STATES.CONNECTING, message: 'Menghubungkan…' };
  emit();

  const result = await api.probe(state.conn);
  state.connection = {
    state: result.state,
    message: result.message,
    latencyMs: result.latencyMs ?? null,
    health: result.health,
    botStatus: result.status,
    statusError: result.statusError,
    checkedAt: Date.now(),
  };
  emit();

  if (!quiet) {
    if (result.state === api.CONNECTION_STATES.ONLINE) toast('Backend bot terhubung.', 'ok');
    else toast(result.message || 'Backend tidak dapat dihubungi.', 'warn', 6000);
  }
  return result;
}

export async function refreshAll({ silent = false } = {}) {
  if (!silent) await testConnection({ quiet: true });
  const names = Object.keys(RESOURCE_LOADERS);
  await Promise.all(names.map((name) => loadResource(name)));
  if (!silent) toast('Data diperbarui.', 'ok', 2200);
}

export function startPolling(intervalMs = 15000) {
  stopPolling();
  state.pollTimer = setInterval(() => {
    if (document.hidden) return;
    refreshAll({ silent: true });
  }, intervalMs);
}

export function stopPolling() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = null;
}

/**
 * Trigger a bot control action.
 * Returns { ok, message } — success is reported ONLY on backend confirmation.
 */
export async function control(action) {
  const label = action.toUpperCase();
  if (!canControl()) {
    const message =
      state.connection.state !== api.CONNECTION_STATES.ONLINE
        ? 'Tidak terhubung ke backend bot. Kontrol dinonaktifkan.'
        : 'Mode DEMO aktif. Kontrol bot dinonaktifkan.';
    state.controls = { pending: null, last: { action, ok: false, message, at: Date.now() } };
    emit();
    toast(message, 'warn', 5000);
    return { ok: false, message };
  }

  state.controls = { pending: action, last: state.controls.last };
  emit();

  const res = await api.sendControl(action, state.conn);
  const ok = Boolean(res.ok && (res.data?.ok !== false));
  const message = ok
    ? `Perintah ${label} dikonfirmasi backend.`
    : res.data?.message || res.message || `Perintah ${label} gagal.`;

  state.controls = { pending: null, last: { action, ok, message, at: Date.now() } };
  emit();
  toast(message, ok ? 'ok' : 'error', 5000);

  if (ok) {
    await loadResource('status');
    setTimeout(() => loadResource('status'), 1200);
  }
  return { ok, message };
}

/** WebSocket lifecycle, wired to the store. */
let socketHandle = null;

export function connectSocket() {
  disconnectSocket();
  socketHandle = api.openSocket({
    conn: state.conn,
    onState: ({ state: s, detail }) => {
      state.socket = { state: s, detail };
      emit();
    },
    onEvent: (msg) => {
      const type = String(msg?.type || '');
      if (type === 'signal:new') loadResource('signals');
      else if (type === 'trade:update') {
        loadResource('positions');
        loadResource('trades');
      } else if (type === 'bot:state' || type === 'status') loadResource('status');
      else if (type === 'log') loadResource('logs');
      else if (type === 'price:tick') loadResource('market');
    },
  });
}

export function disconnectSocket() {
  socketHandle?.close();
  socketHandle = null;
}

export async function boot() {
  await loadBridge();
  await refreshAll({ silent: true });
  connectSocket();
  startPolling(15000);
}

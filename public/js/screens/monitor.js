/** System Monitor — real-time backend health, connection & metrics panel. */

import { state, testConnection } from '../core/store.js';
import {
  card, statusPill, empty, demoBanner, banner, logLine, meter,
} from '../ui/components.js';
import { renderControls } from '../ui/shell.js';
import { escapeHtml, fmtInt, fmtClock, timeAgo } from '../core/format.js';
import { DEMO } from '../core/demo.js';

export const meta = { id: 'monitor', title: 'System Monitor' };

export function render() {
  const statusRes = state.resources.status || {};
  const logsRes = state.resources.logs || {};
  const status = statusRes.data || {};
  const logs = Array.isArray(logsRes.data?.logs) ? logsRes.data.logs : [];
  const demo = Boolean(statusRes.demo || logsRes.demo);
  const conn = state.connection || {};
  const socket = state.socket || {};

  // --- derive metrics ---
  const running = status.running === true;
  const botState = running ? 'RUNNING' : conn.state || 'STOPPED';
  const apiLatency = conn.latencyMs != null ? `${conn.latencyMs} ms` : '--';
  const coinsTracked = status.coinsTracked != null ? fmtInt(status.coinsTracked) : '--';
  const signalsToday = status.signalsToday != null ? fmtInt(status.signalsToday) : '--';
  const uptimeSec = status.uptimeSec != null ? fmtInt(status.uptimeSec) : '--';
  const dbHealth = status.dbHealth || 'N/A';
  const apiHealth = status.apiHealth || 'N/A';
  const requestCount = status.requestCount24h != null ? fmtInt(status.requestCount24h) : '--';
  const errorCount = status.errorCount24h != null ? fmtInt(status.errorCount24h) : '--';

  // --- build logs HTML snippet ---
  let logsHtml = '';
  if (logs.length > 0) {
    const recent = logs.slice(-30);
    logsHtml = '<div style="height:200px;overflow-y:auto;margin-top:6px">' + recent.map(logLine).join('') + '</div>';
  } else {
    logsHtml = '<p class="muted">Log belum tersedia</p>';
  }

  // --- build status pill classes ---
  const botPill = statusPill(botState);
  const apiPill = conn.latencyMs != null ? 'ONLINE' : 'UNKNOWN';
  const wsState = state.socket?.state || 'closed';
  const wsPill = wsState === 'open' ? 'badge--pos' : wsState === 'connecting' ? 'badge--warn' : 'badge--neg';

  return `<div class="screen">
    ${demo ? '<div class="banner banner--warn"><span class="banner__icon">🧪</span><div><strong>DEMO/OFFLINE.</strong> Tidak ada telemetry bot nyata karena backend belum terhubung.</div></div>' : ''}

    <!-- Status Pill + Controls -->
    <section class="card">
      <div class="card__head">
        <h2 class="card__title">Status Sistem</h2>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        ${botPill}
        <span class="badge ${wsPill}" title="WebSocket state: ${wsState}">WebSocket</span>
        ${running ? '<span class="badge badge--pos">Scanner Aktif</span>' : '<span class="badge badge--muted">Scanner Mati</span>'}
        ${!running ? '<button class="btn btn--small" data-action="start-scanner">▶ Start</button>' : ''}
        ${running ? '<button class="btn btn--small" data-action="stop-scanner">⏸ Stop</button>' : ''}
      </div>
      <div style="margin-top:6px">
        <button class="btn btn--small" data-action="test-connection">🔄 Test koneksi</button>
      </div>
    </section>

    <!-- Metrics Grid -->
    <section class="card" style="margin-top:12px">
      <div class="card__head"><h2 class="card__title">Metrik</h2></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px">
        ${apiLatency !== '--' ? '<div class="stat"><span class="stat__label">API Latency</span><span class="stat__value">' + apiLatency + '</span></div>' : ''}
        ${coinsTracked !== '--' ? '<div class="stat"><span class="stat__label">Coins Tracked</span><span class="stat__value">' + coinsTracked + '</span></div>' : ''}
        ${signalsToday !== '--' ? '<div class="stat"><span class="stat__label">Signals 24h</span><span class="stat__value">' + signalsToday + '</span></div>' : ''}
        ${uptimeSec !== '--' ? '<div class="stat"><span class="stat__label">Uptime</span><span class="stat__value">' + uptimeSec + ' detik</span></div>' : ''}
        ${dbHealth !== 'N/A' ? '<div class="stat"><span class="stat__label">Database</span><span class="stat__value ' + (dbHealth === 'healthy' ? 'pos' : 'neg') + '">' + dbHealth + '</span></div>' : ''}
        ${apiHealth !== 'N/A' ? '<div class="stat"><span class="stat__label">API Health</span><span class="stat__value ' + (apiHealth === 'healthy' ? 'pos' : 'neg') + '">' + apiHealth + '</span></div>' : ''}
        ${requestCount !== '--' ? '<div class="stat"><span class="stat__label">Request 24h</span><span class="stat__value">' + requestCount + '</span></div>' : ''}
        ${errorCount !== '--' ? '<div class="stat neg"><span class="stat__label">Error 24h</span><span class="stat__value">' + errorCount + '</span></div>' : ''}
      </div>
    </section>

    <!-- Logs -->
    <section class="card" style="margin-top:12px">
      <div class="card__head">
        <h2 class="card__title">Bot Logs</h2>
        <small>Diperbarui ${escapeHtml(timeAgo(status.lastUpdate))}</small>
      </div>
      ${logs.length ? '<div style="height:200px;overflow-y:auto;margin-top:6px">' + logs.slice(-30).map(logLine).join('') + '</div>' : '<p class="muted">Log belum tersedia</p>'}
      ${logsRes.error && !logsRes.demo ? '<banner><strong>Log error:</strong> ' + escapeHtml(logsRes.error) + '</banner>' : ''}
    </section>

    <button class="btn btn--block" data-action="refresh-metrics" style="margin-top:8px">🔄 Perbarui Metrik</button>
  </div>`;
}
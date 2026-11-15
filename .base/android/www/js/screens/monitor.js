/** System Monitor — actual bridge/backend health and logs only. */

import { state, testConnection } from '../core/store.js';
import { card, empty, banner, stat, logLine, statusPill, DEMO_CHIP } from '../ui/components.js';
import { escapeHtml, fmtInt, fmtClock, timeAgo } from '../core/format.js';

export const meta = { id: 'monitor', title: 'System Monitor' };

export function render() {
  const statusRes = state.resources.status || {};
  const logsRes = state.resources.logs || {};
  const status = statusRes.data || {};
  const logs = Array.isArray(logsRes.data?.logs) ? logsRes.data.logs : [];
  const demo = Boolean(statusRes.demo || logsRes.demo);
  const conn = state.connection || {};
  const bridge = state.bridge;

  return `<div class="screen">
    ${demo ? '<div class="banner banner--warn"><span class="banner__icon">🧪</span><div><strong>DEMO/OFFLINE.</strong> Tidak ada telemetry bot nyata karena backend belum terhubung.</div></div>' : ''}

    <div class="stat-grid">
      <div class="stat"><div class="stat__label">Bot</div><div class="stat__value stat__value--sm">${statusPill(
    status.running ? 'ONLINE' : conn.state
  )}</div></div>
      <div class="stat"><div class="stat__label">API</div><div class="stat__value stat__value--sm">${statusPill(
    conn.state
  )}</div></div>
      <div class="stat"><div class="stat__label">Bridge</div><div class="stat__value stat__value--sm">${
    bridge ? '<span class="badge badge--pos">ONLINE</span>' : '<span class="badge badge--warn">UNKNOWN</span>'
  }</div></div>
      <div class="stat"><div class="stat__label">WebSocket</div><div class="stat__value stat__value--sm">${escapeHtml(
    state.socket?.state || 'closed'
  )}</div></div>
    </div>

    ${card({
      title: 'Runtime Status',
      body: [
        ['Bot state', escapeHtml(status.state || (status.running ? 'RUNNING' : 'UNKNOWN'))],
        ['Last bot update', escapeHtml(timeAgo(status.lastUpdate))],
        ['Last API check', escapeHtml(timeAgo(conn.checkedAt))],
        ['API latency', conn.latencyMs != null ? `${conn.latencyMs} ms` : '—'],
        ['Coins tracked', fmtInt(status.coinsTracked)],
        ['Signals today', fmtInt(status.signalsToday)],
        ['Bridge uptime', bridge?.uptimeSec ? `${fmtInt(bridge.uptimeSec)} sec` : '—'],
        ['Proxy configured', bridge ? (bridge.proxyAvailable ? 'YES' : 'NO') : '—'],
        ['CPU / RAM', 'not exposed by bot API'],
        ['Database status', 'not exposed by bot API'],
      ]
        .map(([k, v]) => `<div class="kv"><span class="kv__k">${k}</span><span class="kv__v">${v}</span></div>`)
        .join(''),
    })}

    <button class="btn btn--block" data-action="test-connection">🔄 Test backend connection</button>

    ${card({
      title: 'Bot Logs',
      hint: `${logs.length} lines${logsRes.demo ? ' · DEMO' : ''}`,
      body: logs.length
        ? logs.slice(-60).map(logLine).join('')
        : empty({ icon: '📋', title: 'Log belum tersedia', desc: 'Butuh endpoint /system/logs dari backend bot.' }),
    })}

    ${
      logsRes.error && !logsRes.demo
        ? banner(`<strong>Log error:</strong> ${escapeHtml(logsRes.error)}`, 'neg', '⛔')
        : ''
    }
  </div>`;
}

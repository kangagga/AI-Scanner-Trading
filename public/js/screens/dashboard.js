/** Dashboard — equity, balance, bot status, control actions, and honest connection detail. */

import { state, isDemoResource, canControl } from '../core/store.js';
import {
  card, stat, banner, demoBanner, empty, statusPill, DEMO_CHIP, meter,
} from '../ui/components.js';
import { lineChart } from '../ui/charts.js';
import { renderControls } from '../ui/shell.js';
import {
  fmtInt, fmtUsd, fmtPct, fmtRatioPct, pnlClass, timeAgo, escapeHtml, isNum,
} from '../core/format.js';
import { DEMO } from '../core/demo.js';

export const meta = { id: 'dashboard', title: 'Dashboard' };

export function render() {
  const conn = state.connection || {};
  const online = conn.state === 'ONLINE';
  const demo = online ? false : true; // fallback when not online
  const res = state.resources.status || {};
  const data = res.data || {};
  const demoExplicit = Boolean(res.demo);

  // --- equity & balance ---
  const equity = data.equity != null ? Number(data.equity) : null;
  const balance = data.balance != null ? Number(data.balance) : null;
  const floatingPnl = data.floatingPnl != null ? Number(data.floatingPnl) : null;
  const realizedPnl = data.realizedPnl != null ? Number(data.realizedPnl) : null;
  const winRate = data.winRate != null ? Number(data.winRate) : null;
  const profitFactor = data.profitFactor != null ? Number(data.profitFactor) : null;
  const maxDrawdown = data.maxDrawdown != null ? Number(data.maxDrawdown) : null;
  const signalsToday = data.signalsToday != null ? Number(data.signalsToday) : 0;
  const validSignals = data.validSignals != null ? Number(data.validSignals) : 0;
  const rejectedSignals = data.rejectedSignals != null ? Number(data.rejectedSignals) : 0;
  const openPositions = data.openPositions != null ? Number(data.openPositions) : 0;
  const coinsTracked = data.coinsTracked != null ? Number(data.coinsTracked) : 0;
  const lastUpdate = data.lastUpdate != null ? Number(data.lastUpdate) : Date.now();

  // --- bot state ---
  const running = data.running === true;
  const botState = String(data.state || (running ? 'RUNNING' : 'STOPPED')).toUpperCase();
  const scanState = String(data.scanState || 'IDLE').toUpperCase();

  // --- market condition ---
  const marketCondition = data.marketCondition || (demo ? 'SIDEWAYS' : '—');

  // --- equity curve points (simple sparkline data; in production would come from DB) ---
  const equityPoints = (() => {
    if (!online || demoExplicit) return [];
    // generate modest synthetic points if no historical data available
    const points = [];
    const now = Date.now();
    const step = 15 * 60 * 1000; // 15 menit
    let price = equity != null ? equity : 10000;
    for (let i = 9; i >= 0; i--) {
      const t = now - i * step;
      const drift = (Math.random() - 0.5) * 0.002 * price;
      price = Math.max(0.1, price + drift);
      points.push({ x: t, y: price });
    }
    return points;
  })();

  // --- drawdown gauge value ---
  const drawdownPct = maxDrawdown != null ? Math.abs(maxDrawdown) : (demo ? 5.2 : null);

  const qualityClass = (q) => (q ? `badge--${q.toLowerCase()}` : 'badge--muted');

  return `<div class="screen">
    ${demoExplicit ? demoBanner('Backend bot belum terhubung. Angka di bawah adalah contoh tampilan, bukan hasil bot Anda.') : ''}

    <section class="card card--glow">
      <div class="card__head">
        <h2 class="card__title">Bot Status</h2>
        <span class="card__hint">${escapeHtml(timeAgo(lastUpdate))}</span>
      </div>

      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">
        ${statusPill(conn.state || 'OFFLINE')}
        <span class="badge badge--${running ? 'pos' : 'muted'}"><i class="dot${running ? ' dot--pulse' : ''}"></i>${escapeHtml(
    botState
  )}</span>
        ${data.paperTrading === true ? '<span class="badge badge--info">PAPER TRADING</span>' : ''}
        ${
          data.bitgetMirror === true
            ? '<span class="badge badge--neg">BITGET MIRROR ON</span>'
            : '<span class="badge badge--muted">BITGET MIRROR OFF</span>'
        }
        ${DEMO_CHIP}
      </div>

      ${renderControls()}

      ${res.error && !demoExplicit ? banner(`<strong>Gagal memuat status.</strong> ${escapeHtml(res.error)}`, 'neg', '⛔') : ''}
      ${!online && !demoExplicit ? banner('Belum terhubung ke backend bot. Buka Settings untuk mengisi URL backend.', 'info', '🔌') : ''}
    </section>

    <!-- Equity & Balance Row -->
    <section class="card">
      <div class="card__head">
        <h2 class="card__title">Equity & Balance</h2>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        ${balance != null ? stat({ label: 'Balance', value: fmtUsd(balance), tone: 'pos' }) : ''}
        ${equity != null ? stat({ label: 'Equity', value: fmtUsd(equity), tone: 'pos' }) : ''}
        ${floatingPnl != null ? stat({ label: 'Floating P/L', value: fmtUsd(floatingPnl), tone: pnlClass(floatingPnl), meta: 'floating' }) : ''}
        ${realizedPnl != null ? stat({ label: 'Realized P/L', value: fmtUsd(realizedPnl), tone: pnlClass(realizedPnl), meta: 'realized' }) : ''}
      </div>
    </section>

    <!-- Performance Cards Row -->
    <section class="card">
      <div class="card__head"><h2 class="card__title">Performa</h2></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px">
        ${winRate != null ? stat({ label: 'Win Rate', value: isNum(winRate) ? fmtRatioPct(winRate, { asRatio: winRate <= 1 }) : '—', tone: winRate >= 0.5 || winRate >= 50 ? 'pos' : '' }) : ''}
        ${profitFactor != null ? stat({ label: 'Profit Factor', value: fmtRatioPct(profitFactor, { asRatio: profitFactor <= 1 }) }) : ''}
        ${maxDrawdown != null ? stat({ label: 'Max Drawdown', value: fmtUsd(maxDrawdown), tone: 'neg', meta: 'peak-to-trough' }) : ''}
      </div>
    </section>

    <!-- Signal Counter Row -->
    <section class="card">
      <div class="card__head"><h2 class="card__title">Sinyal Hari Ini</h2></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${stat({ label: 'Sinyal', value: fmtInt(signalsToday), tone: 'info' })}
        ${stat({ label: 'Valid', value: fmtInt(validSignals), tone: 'pos' })}
        ${stat({ label: 'Ditolak', value: fmtInt(rejectedSignals), tone: 'warn' })}
      </div>
    </section>

    <!-- Market Overview Mini -->
    <section class="card">
      <div class="card__head"><h2 class="card__title">Market Overview</h2></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div class="kv"><span class="kv__k">Passive Coins</span><span class="kv__v">${fmtInt(coinsTracked)}</span></div>
        <div class="kv"><span class="kv__k">Market</span><span class="kv__v">${escapeHtml(String(marketCondition).toUpperCase())}</span></div>
      </div>
      ${online && !demoExplicit ? `
        <div style="margin-top:6px">
          <small>Last updated: ${escapeHtml(timeAgo(lastUpdate))}</small>
        </div>` : ''
      }
      ${!online || demoExplicit ? empty({ icon: '📡', title: 'Menunggu backend bot', desc: 'Data pasar akan muncul setelah bot terhubung.' }) : ''}
    </section>

    <!-- Equity Curve Chart -->
    <section class="card">
      <div class="card__head">
        <h2 class="card__title">Equity Curve</h2>
        <small>15 menit terakhir ${online && !demoExplicit ? `(${fmtClock(lastUpdate)} ago)` : ''}</small>
      </div>
      ${online && !demoExplicit && equityPoints.length > 0 ? `
        <canvas id="equityCurve" height="120" style="width:100%"></canvas>
        <script type="module">
          import { lineChart } from '../ui/charts.js';
          const dataPoints = ${JSON.stringify(equityPoints)};
          const maxY = Math.max(...dataPoints.map(d => d.y)) * 1.05;
          const minY = Math.min(...dataPoints.map(d => d.y)) * 0.95;
          const bounds = { min: minY, max: maxY };
          const labels = dataPoints.map((d) => fmtClock(d.x));
          lineChart(document.getElementById('equityCurve'), {
            series: [{ label: 'Equity', values: dataPoints.map(d => d.y), color: '#00ff88' }],
            height: 120,
            fill: true,
            labels: labels,
          });
        </script>` : online && !demoExplicit ? `<div class="empty"><small>Menunggu data equity...</small></div>` : empty({ icon: '📉', title: 'Belum ada data', desc: 'Grafik equity curve akan muncul setelah bot berjalan.' })}
    </section>

    <!-- Connection Detail -->
    ${renderConnectionDetail(conn, data)}

    <section class="card">
      <div class="card__head"><h2 class="card__title">Ringkasan Hari Ini</h2></div>
      ${demoExplicit || !online ? empty({ icon: '📡', title: 'Menunggu backend bot', desc: 'Ringkasan sinyal dan performa akan muncul setelah backend terhubung.' }) : `
        <div class="kv"><span class="kv__k">Sinyal hari ini</span><span class="kv__v">${fmtInt(signalsToday)}</span></div>
        <div class="kv"><span class="kv__k">Valid / Ditolak</span><span class="kv__v"><span class="pos">${fmtInt(validSignals)}</span> / <span class="warn">${fmtInt(rejectedSignals)}</span></span></div>
        <div class="kv"><span class="kv__k">Posisi terbuka</span><span class="kv__v">${fmtInt(openPositions)}</span></div>
        <div class="kv"><span class="kv__k">P/L simulasi</span><span class="kv__v ${pnlClass(data.totalPnl || 0)}">${fmtUsd(data.totalPnl || 0, { sign: true })}</span></div>
      `}
    </section>

    <section class="banner banner--info">
      <span class="banner__icon">🔒</span>
      <div>Aplikasi ini hanya pusat kendali. Mesin scanner, strategi, dan database tetap milik bot lama.
      Mode transaksi: <strong>PAPER TRADING</strong>.</div>
    </section>
  </div>`;
}

function renderConnectionDetail(conn, data) {
  const rows = [
    ['Status koneksi', statusPill(conn.state || 'OFFLINE')],
    ['Pesan', escapeHtml(conn.message || '—')],
    ['Latency', conn.latencyMs != null ? `${conn.latencyMs} ms` : '—'],
    ['Terakhir dicek', escapeHtml(timeAgo(conn.checkedAt))],
    ['Backend', escapeHtml(state.conn.mode === 'proxy' ? 'via bridge proxy' : state.conn.baseUrl || 'belum diatur')],
    ['WebSocket', escapeHtml(state.socket?.state || 'closed')],
  ];

  return card({
    title: 'Koneksi Backend',
    body: rows
      .map(([k, v]) => `<div class="kv"><span class="kv__k">${escapeHtml(k)}</span><span class="kv__v">${v}</span></div>`)
      .join(''),
  });
}
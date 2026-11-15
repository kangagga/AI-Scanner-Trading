/** Dashboard — bot status, control actions, and honest connection detail. */

import { state, isDemoResource, canControl } from '../core/store.js';
import { card, stat, banner, demoBanner, empty, statusPill, DEMO_CHIP } from '../ui/components.js';
import { renderControls } from '../ui/shell.js';
import { fmtInt, fmtUsd, fmtPct, fmtRatioPct, pnlClass, timeAgo, escapeHtml, isNum } from '../core/format.js';

export const meta = { id: 'dashboard', title: 'Dashboard' };

export function render() {
  const res = state.resources.status || {};
  const data = res.data || {};
  const demo = Boolean(res.demo);
  const conn = state.connection || {};
  const online = conn.state === 'ONLINE';

  const running = data.running === true;
  const botState = String(data.state || (running ? 'RUNNING' : demo ? 'DEMO' : 'UNKNOWN')).toUpperCase();

  return `<div class="screen">
    ${demo ? demoBanner('Backend bot belum terhubung. Angka di bawah adalah contoh tampilan, bukan hasil bot Anda.') : ''}

    <section class="card card--glow">
      <div class="card__head">
        <h2 class="card__title">Bot Status</h2>
        <span class="card__hint">${escapeHtml(timeAgo(data.lastUpdate))}</span>
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
        ${demo ? DEMO_CHIP : ''}
      </div>

      ${renderControls()}

      ${
        res.error && !demo
          ? banner(`<strong>Gagal memuat status.</strong> ${escapeHtml(res.error)}`, 'neg', '⛔')
          : ''
      }
      ${
        !online && !demo
          ? banner(
              'Belum terhubung ke backend bot. Buka <strong>Settings</strong> untuk mengisi URL backend (mis. <span class="mono">http://192.168.1.10:8080</span>).',
              'info',
              '🔌'
            )
          : ''
      }
    </section>

    <div class="stat-grid">
      ${stat({ label: 'Coins Tracked', value: fmtInt(data.coinsTracked) })}
      ${stat({ label: 'Signals Today', value: fmtInt(data.signalsToday) })}
      ${stat({ label: 'Valid Signals', value: fmtInt(data.validSignals), tone: 'pos' })}
      ${stat({ label: 'Rejected', value: fmtInt(data.rejectedSignals), tone: 'warn' })}
    </div>

    <div class="stat-grid">
      ${stat({
        label: 'Open Positions',
        value: fmtInt(data.openPositions),
        meta: 'paper trading',
      })}
      ${stat({
        label: 'Total P/L',
        value: fmtUsd(data.totalPnl, { sign: true }),
        tone: pnlClass(data.totalPnl),
        meta: 'simulasi',
      })}
      ${stat({
        label: 'Win Rate',
        value: isNum(data.winRate) ? fmtRatioPct(data.winRate, { asRatio: data.winRate <= 1 }) : '—',
        tone: isNum(data.winRate) ? (data.winRate >= 0.5 || data.winRate >= 50 ? 'pos' : 'neg') : '',
      })}
      ${stat({
        label: 'Market',
        value: escapeHtml(String(data.marketCondition || '—').toUpperCase()),
        small: true,
        tone: marketTone(data.marketCondition),
      })}
    </div>

    ${renderConnectionDetail(conn, data)}

    <section class="card">
      <div class="card__head"><h2 class="card__title">Ringkasan Hari Ini</h2></div>
      ${
        demo || !online
          ? empty({
              icon: '📡',
              title: 'Menunggu backend bot',
              desc: 'Ringkasan sinyal dan performa akan muncul setelah backend terhubung.',
            })
          : `<div class="kv"><span class="kv__k">Sinyal hari ini</span><span class="kv__v">${fmtInt(
              data.signalsToday
            )}</span></div>
             <div class="kv"><span class="kv__k">Valid / Ditolak</span><span class="kv__v"><span class="pos">${fmtInt(
               data.validSignals
             )}</span> / <span class="warn">${fmtInt(data.rejectedSignals)}</span></span></div>
             <div class="kv"><span class="kv__k">Posisi terbuka</span><span class="kv__v">${fmtInt(
               data.openPositions
             )}</span></div>
             <div class="kv"><span class="kv__k">P/L simulasi</span><span class="kv__v ${pnlClass(
               data.totalPnl
             )}">${fmtUsd(data.totalPnl, { sign: true })}</span></div>`
      }
    </section>

    <div class="banner banner--info">
      <span class="banner__icon">🔒</span>
      <div>Aplikasi ini hanya pusat kendali. Mesin scanner, strategi, dan database tetap milik bot lama.
      Mode transaksi: <strong>PAPER TRADING</strong>.</div>
    </div>
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

function marketTone(condition) {
  const c = String(condition || '').toLowerCase();
  if (c.includes('bull')) return 'pos';
  if (c.includes('bear')) return 'neg';
  if (c.includes('side')) return 'warn';
  return '';
}

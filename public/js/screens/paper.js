/** Paper Trading — monitor the old bot's simulated positions (read-only). */

import { state } from '../core/store.js';
import { card, positionRow, empty, demoBanner, banner, stat, skeletonRows } from '../ui/components.js';
import { fmtInt, fmtUsd, pnlClass, escapeHtml, isNum } from '../core/format.js';

export const meta = { id: 'paper', title: 'Paper Trading' };

export function render() {
  const res = state.resources.positions || {};
  const statusRes = state.resources.status || {};
  const demo = Boolean(res.demo);
  const positions = Array.isArray(res.data?.positions) ? res.data.positions : [];
  const status = statusRes.data || {};

  const floating = positions.reduce((sum, p) => sum + (isNum(p.floatingPnl) ? p.floatingPnl : 0), 0);
  const exposure = positions.reduce(
    (sum, p) => sum + (isNum(p.entry) && isNum(p.size) ? p.entry * p.size : 0),
    0
  );

  return `<div class="screen">
    ${demo ? demoBanner('Posisi di bawah adalah contoh tampilan. Posisi sebenarnya ada di database bot lama.') : ''}

    <section class="card card--glow">
      <div class="card__head">
        <h2 class="card__title">Mode Simulasi</h2>
        <span class="card__hint">read-only</span>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <span class="badge badge--info">PAPER TRADING ${status.paperTrading === false ? 'OFF' : 'ON'}</span>
        <span class="badge badge--muted">BITGET MIRROR OFF</span>
        <span class="badge badge--muted">NO LIVE ORDERS</span>
      </div>
      <div class="stat__meta" style="margin-top:10px">
        Aplikasi ini tidak membuka posisi dan tidak mengirim order. Semua eksekusi tetap di bot lama
        dengan mode paper trading.
      </div>
    </section>

    <div class="stat-grid">
      ${stat({ label: 'Posisi Aktif', value: fmtInt(positions.length) })}
      ${stat({
        label: 'Floating P/L',
        value: fmtUsd(floating, { sign: true }),
        tone: pnlClass(floating),
      })}
      ${stat({ label: 'Exposure', value: fmtUsd(exposure, { compact: true }) })}
      ${stat({
        label: 'Total P/L',
        value: fmtUsd(status.totalPnl, { sign: true }),
        tone: pnlClass(status.totalPnl),
        meta: 'realized',
      })}
    </div>

    ${res.error && !demo ? banner(`<strong>Gagal memuat posisi.</strong> ${escapeHtml(res.error)}`, 'neg', '⛔') : ''}

    ${card({
      title: 'Posisi Terbuka',
      flush: true,
      body: res.loading && !positions.length
        ? skeletonRows(2)
        : positions.length
        ? `<div class="list">${positions.map((p) => positionRow(p, { demo })).join('')}</div>`
        : empty({
            icon: '📈',
            title: 'Tidak ada posisi terbuka',
            desc: demo
              ? 'Mode demo tidak memuat posisi.'
              : 'Bot belum membuka posisi simulasi, atau endpoint /paper/positions belum aktif.',
          }),
    })}
  </div>`;
}

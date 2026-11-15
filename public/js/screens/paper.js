/** Paper Trading — monitor the old bot's simulated positions (read-only, SIMULATED only). */

import { state, isDemoResource } from '../core/store.js';
import {
  card, positionRow, empty, demoBanner, banner, stat, skeletonRows,
} from '../ui/components.js';
import { fmtInt, fmtUsd, pnlClass, escapeHtml, isNum } from '../core/format.js';
import { DEMO } from '../core/demo.js';

export const meta = { id: 'paper', title: 'Paper Trading' };

export function render() {
  const res = state.resources.positions || {};
  const statusRes = state.resources.status || {};
  const demo = Boolean(res.demo);
  const positions = Array.isArray(res.data?.positions) ? res.data.positions : [];
  const status = statusRes.data || {};

  // --- compute totals ---
  const floating = positions.reduce(
    (sum, p) => sum + (isNum(p.floatingPnl) ? Number(p.floatingPnl) : 0),
    0
  );
  const realized = positions.reduce(
    (sum, p) => sum + (isNum(p.realizedPnl) ? Number(p.realizedPnl) : 0),
    0
  );
  const commission = positions.reduce(
    (sum, p) => sum + (isNum(p.commission) ? Number(p.commission) : 0),
    0
  );
  const slippage = positions.reduce(
    (sum, p) => sum + (isNum(p.slippage) ? Number(p.slippage) : 0),
    0
  );
  const exposure = positions.reduce(
    (sum, p) => sum + (isNum(p.entry) && isNum(p.size) ? Number(p.entry) * Number(p.size) : 0),
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
        <span class="badge badge--info">PAPER TRADING</span>
        <span class="badge badge--muted">BITGET MIRROR OFF</span>
        <span class="badge badge--muted">NO LIVE ORDERS</span>
      </div>
      <div class="stat__meta" style="margin-top:8px">
        Aplikasi ini hanya menampilkan posisii simulasi. Tidak ada order riil.
      </div>
    </section>

    <!-- Summary Stats -->
    <div class="stat-grid">
      ${stat({ label: 'Posisi Aktif', value: fmtInt(positions.length) })}
      ${stat({
        label: 'Floating P/L',
        value: fmtUsd(floating, { sign: true }),
        tone: pnlClass(floating),
        meta: 'floating',
      })}
      ${stat({
        label: 'Realized P/L',
        value: fmtUsd(realized, { sign: true }),
        tone: pnlClass(realized),
        meta: 'realized',
      })}
      ${stat({ label: 'Exposure', value: fmtUsd(exposure, { compact: true }) })}
    </div>

    <!-- Costs -->
    ${commission > 0 || slippage > 0 ? `
    <div class="card" style="margin-top:10px">
      <div class="card__head"><h2 class="card__title">Biaya & Slippage</h2></div>
      <div class="kv-grid">
        ${commission > 0 ? `<div class="kv"><span class="kv__k">Biaya Total</span><span class="kv__v">${fmtUsd(commission, { sign: true })}</span></div>` : ''}
        ${slippage > 0 ? `<div class="kv"><span class="kv__k">Slippage Total</span><span class="kv__v">${fmtUsd(slippage, { sign: true })}</span></div>` : ''}
      </div>
    </div>` : ''}

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
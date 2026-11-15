/** Trade History — closed trades from the old bot's database, fully filterable. */

import { state } from '../core/store.js';
import {
  card, tradeRow, empty, demoBanner, banner, stat, skeletonRows,
} from '../ui/components.js';
import { renderControls } from '../ui/shell.js';
import { escapeHtml, fmtInt, fmtUsd, fmtPct, pnlClass, isNum, timeAgo } from '../core/format.js';
import { DEMO } from '../core/demo.js';

export const meta = { id: 'history', title: 'Trade History' };

const filterLabels = { all: 'Semua', buy: 'BUY', sell: 'SELL' };

export function render() {
  const res = state.resources.trades || {};
  const demo = Boolean(res.demo);
  const all = Array.isArray(res.data?.trades) ? res.data.trades : [];

  // --- filter ---
  const filterSide = document.querySelector('button.chip--active')?.dataset.side || 'all';
  const filtered =
    filterSide === 'all'
      ? all
      : all.filter((t) => String(t.side || '').toUpperCase().includes(filterSide));

  // --- stats ---
  const realized = all.reduce((sum, t) => sum + (isNum(t.pnl) ? Number(t.pnl) : 0), 0);
  const wins = all.filter((t) => isNum(t.pnl) && Number(t.pnl) > 0).length;
  const losses = all.filter((t) => isNum(t.pnl) && Number(t.pnl) < 0).length;
  const winRate = all.length ? ((wins / all.length) * 100).toFixed(1) : '0.0';
  const totalFees = all.reduce((sum, t) => sum + (isNum(t.fee) ? Number(t.fee) : 0), 0);
  const totalSlippage = all.reduce((sum, t) => sum + (isNum(t.slippage) ? Number(t.slippage) : 0), 0);

  return `<div class="screen">
    ${demo ? demoBanner('Riwayat di bawah adalah contoh tampilan. Riwayat asli ada di database bot lama.') : ''}

    <!-- Stats -->
    <div class="stat-grid" style="margin-bottom:12px">
      ${stat({ label: 'Total Trade', value: fmtInt(all.length) })}
      ${stat({ label: 'Realized P/L', value: fmtUsd(realized, { sign: true }), tone: pnlClass(realized) })}
      ${stat({ label: 'Win/Loss', value: `${fmtInt(wins)} / ${fmtInt(losses)}`, tone: wins >= losses ? 'pos' : 'neg' })}
      ${stat({ label: 'Win Rate', value: isNum(winRate) ? fmtRatioPct(winRate, { asRatio: true }) : '—' })}
      ${stat({ label: 'Total Fee', value: fmtUsd(totalFees) })}
    </div>

    <!-- Filters -->
    <div style="margin-bottom:12px">
      <div class="section-title">Filter Arah</div>
      <div class="chips" style="justify-content:flex-start">
        ${[
          { id: 'all', label: 'Semua' },
          { id: 'buy', label: 'BUY' },
          { id: 'sell', label: 'SELL' },
        ]
          .map(
            (f) =>
              `<button class="chip${filterSide === f.id ? ' chip--active' : ''}" data-side="${f.id}">${f.label}</button>`
          )
          .join('')}
      </div>
    </div>

    ${res.error && !demo ? banner(`<strong>Gagal memuat riwayat.</strong> ${escapeHtml(res.error)}`, 'neg', '⛔') : ''}

    <!-- Trade Table -->
    ${card({ flush: true, body: res.loading && !all.length ? skeletonRows(4) : filtered.length ? renderTrades(filtered) : empty({ icon: '🧾', title: 'Belum ada riwayat', desc: demo ? 'Mode demo tidak memuat transaksi.' : 'Belum ada transaksi tertutup.' }) })}

    <!-- Bottom stats -->
    ${all.length > 0 ? `
    <div class="stat-grid" style="margin-top:12px">
      ${stat({ label: 'Total Fee', value: fmtUsd(totalFees) })}
      ${stat({ label: 'Total Slippage', value: fmtUsd(totalSlippage) })}
    </div>` : ''}
  </div>`;
}

/** Render trades list. */
function renderTrades(trades) {
  return `<div class="list">${trades.map(renderTradeRow).join('')}</div>`;
}

/** Render a single trade row with full detail. */
function renderTradeRow(t) {
  const side = String(t.side || '').toUpperCase();
  const pnl = isNum(t.pnl) ? Number(t.pnl) : 0;
  return `<div class="trade-row" style="display:grid;grid-template-columns:140px 1fr 100px;gap:8px;padding:6px 0;border-bottom:1px solid var(--line-soft)">
    <div>
      <strong>${escapeHtml(t.symbol || '—')}</strong>
      <span class="small muted">${escapeHtml(String(t.strategy || '—'))}</span>
    </div>
    <div style="text-align:center;align-self:center">
      <span class="badge badge--${pnl >= 0 ? 'pos' : 'neg'}">${pnl >= 0 ? 'WIN' : 'LOSS'}</span>
    </div>
    <div style="text-align:right;align-self:center">
      <span class="small">${fmtUsd(pnl)}</span>
    </div>
  </div>`;
}
/** Trade History — closed trades from the old bot's database. */

import { state } from '../core/store.js';
import { card, tradeRow, empty, demoBanner, banner, stat, skeletonRows } from '../ui/components.js';
import { fmtInt, fmtUsd, pnlClass, escapeHtml, isNum } from '../core/format.js';

export const meta = { id: 'history', title: 'Trade History' };

const filters = { side: 'all' };

export function render() {
  const res = state.resources.trades || {};
  const demo = Boolean(res.demo);
  const all = Array.isArray(res.data?.trades) ? res.data.trades : [];

  const filtered =
    filters.side === 'all'
      ? all
      : all.filter((t) => String(t.side || '').toUpperCase().includes(filters.side));

  const realized = all.reduce((sum, t) => sum + (isNum(t.pnl) ? t.pnl : 0), 0);
  const wins = all.filter((t) => isNum(t.pnl) && t.pnl > 0).length;
  const losses = all.filter((t) => isNum(t.pnl) && t.pnl < 0).length;
  const fees = all.reduce((sum, t) => sum + (isNum(t.fee) ? t.fee : 0), 0);

  return `<div class="screen">
    ${demo ? demoBanner('Riwayat di bawah adalah contoh tampilan. Riwayat asli ada di database bot lama.') : ''}

    <div class="stat-grid">
      ${stat({ label: 'Total Trade', value: fmtInt(all.length) })}
      ${stat({ label: 'Realized P/L', value: fmtUsd(realized, { sign: true }), tone: pnlClass(realized) })}
      ${stat({ label: 'Win / Loss', value: `${fmtInt(wins)} / ${fmtInt(losses)}` })}
      ${stat({ label: 'Total Fee', value: fmtUsd(fees) })}
    </div>

    <div class="chips">
      ${[
        { id: 'all', label: 'Semua' },
        { id: 'BUY', label: 'BUY' },
        { id: 'SELL', label: 'SELL' },
      ]
        .map(
          (f) =>
            `<button class="chip${filters.side === f.id ? ' chip--active' : ''}" data-side="${f.id}">${f.label}</button>`
        )
        .join('')}
    </div>

    ${res.error && !demo ? banner(`<strong>Gagal memuat riwayat.</strong> ${escapeHtml(res.error)}`, 'neg', '⛔') : ''}

    ${card({
      title: 'Riwayat Transaksi',
      hint: `${filtered.length} entri`,
      flush: true,
      body: res.loading && !all.length
        ? skeletonRows(4)
        : filtered.length
        ? `<div class="list">${filtered.map((t) => tradeRow(t, { demo })).join('')}</div>`
        : empty({
            icon: '🧾',
            title: 'Belum ada riwayat',
            desc: demo
              ? 'Mode demo tidak memuat transaksi.'
              : 'Belum ada transaksi tertutup, atau endpoint /trades belum aktif.',
          }),
    })}
  </div>`;
}

export function bind(root) {
  root.querySelectorAll('[data-side]').forEach((btn) => {
    btn.addEventListener('click', () => {
      filters.side = btn.dataset.side;
      document.dispatchEvent(new CustomEvent('app:rerender'));
    });
  });
}

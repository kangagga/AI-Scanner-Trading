/** Performance — statistics reported by the bot; no strategy evaluation here. */

import { state } from '../core/store.js';
import { card, empty, demoBanner, banner, stat, DEMO_CHIP } from '../ui/components.js';
import { lineChart, barChart } from '../ui/charts.js';
import { fmtRatioPct, fmtUsd, fmtInt, pnlClass, escapeHtml, isNum } from '../core/format.js';

export const meta = { id: 'performance', title: 'Performance' };

export function render() {
  const res = state.resources.performance || {};
  const demo = Boolean(res.demo);
  const d = res.data || {};
  const samples = Array.isArray(d.equity) ? d.equity : [];

  const body = `<div class="screen">
    ${demo ? demoBanner('Statistik berikut adalah contoh kosong. Performa nyata harus dibaca dari backend bot lama.') : ''}

    <div class="stat-grid">
      ${stat({
        label: 'Win Rate',
        value: isNum(d.winRate) ? fmtRatioPct(d.winRate, { asRatio: d.winRate <= 1 }) : '—',
        tone: isNum(d.winRate) ? 'pos' : '',
      })}
      ${stat({ label: 'Profit Factor', value: isNum(d.profitFactor) ? d.profitFactor.toFixed(2) : '—' })}
      ${stat({
        label: 'Max Drawdown',
        value: isNum(d.maxDrawdown) ? `${Math.abs(d.maxDrawdown).toFixed(2)}%` : '—',
        tone: 'neg',
      })}
      ${stat({ label: 'Samples', value: fmtInt(d.samples), meta: 'jumlah transaksi' })}
    </div>

    <div class="stat-grid">
      ${stat({ label: 'Average Win', value: fmtUsd(d.avgWin, { sign: true }), tone: 'pos' })}
      ${stat({ label: 'Average Loss', value: fmtUsd(d.avgLoss, { sign: true }), tone: 'neg' })}
    </div>

    ${res.error && !demo ? banner(`<strong>Gagal memuat statistik.</strong> ${escapeHtml(res.error)}`, 'neg', '⛔') : ''}

    ${card({
      title: 'Equity Curve',
      hint: demo ? DEMO_CHIP : '',
      body: samples.length > 1
        ? '<div class="chart-wrap"><canvas id="equity-chart" data-height="170"></canvas></div>'
        : empty({
            icon: '📈',
            title: 'Belum ada equity data',
            desc: 'Grafik hanya menggunakan data equity dari backend bot lama.',
          }),
    })}

    ${renderBreakdown('Per Strategi', d.byStrategy, 'strategy')}
    ${renderBreakdown('Per Timeframe', d.byTimeframe, 'timeframe')}

    <div class="banner banner--warn">
      <span class="banner__icon">⚠️</span>
      <div>Performa adalah data historis, bukan jaminan hasil. Sampel kecil tidak cukup untuk menyimpulkan
      strategi mempunyai edge.</div>
    </div>
  </div>`;

  return body;
}

export function afterRender(root) {
  const d = state.resources.performance?.data || {};
  const equity = Array.isArray(d.equity) ? d.equity : [];
  const values = equity.map((p) => (typeof p === 'number' ? p : p?.equity)).filter(isNum);
  const canvas = root.querySelector('#equity-chart');
  if (canvas && values.length > 1) lineChart(canvas, { series: [{ values }], height: 170 });

  root.querySelectorAll('canvas[data-bars]').forEach((node) => {
    const attr = node.dataset.bars;
    let list = [];
    try {
      list = JSON.parse(attr);
    } catch {
      list = [];
    }
    if (Array.isArray(list) && list.length) barChart(node, { values: list.map((v) => Number(v) || 0), height: 130 });
  });
}

function renderBreakdown(title, list, key) {
  const items = Array.isArray(list) ? list : [];
  if (!items.length) {
    return card({
      title,
      body: empty({ icon: '📊', title: 'Belum ada breakdown', desc: 'Memerlukan data dari bot lama.' }),
    });
  }
  return card({
    title,
    flush: true,
    body: `<div class="list">${items
      .map((item) => {
        const label = item.name || item.strategy || item.timeframe || item[key] || '—';
        const winRate = isNum(item.winRate) ? fmtRatioPct(item.winRate, { asRatio: item.winRate <= 1 }) : '—';
        const pnl = item.pnl;
        return `<div class="row">
          <div class="row__main">
            <div class="row__title"><span>${escapeHtml(label)}</span></div>
            <div class="row__sub">${fmtInt(item.samples ?? item.trades)} samples · WR ${winRate}</div>
          </div>
          <div class="row__end">
            <div class="row__value ${pnlClass(pnl)}">${fmtUsd(pnl, { sign: true })}</div>
            <div class="row__meta">PF ${isNum(item.profitFactor) ? item.profitFactor.toFixed(2) : '—'}</div>
          </div>
        </div>`;
      })
      .join('')}</div>`,
  });
}

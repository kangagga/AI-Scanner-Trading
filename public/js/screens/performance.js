/** Performance Analytics — professional equity & statistics dashboard. */

import { state, isDemoResource } from '../core/store.js';
import {
  card, stat, empty, demoBanner, banner,
} from '../ui/components.js';
import { lineChart, barChart } from '../ui/charts.js';
import { fmtRatioPct, fmtUsd, fmtInt, pnlClass, escapeHtml, isNum, timeAgo } from '../core/format.js';
import { DEMO } from '../core/demo.js';

export const meta = { id: 'performance', title: 'Performance Analytics' };

export function render() {
  const res = state.resources.performance || {};
  const demo = Boolean(res.demo);
  const d = res.data || {};

  // --- derive data ---
  const equity = Array.isArray(d.equity) ? d.equity : [];
  const winRate = isNum(d.winRate) ? Number(d.winRate) : null;
  const profitFactor = isNum(d.profitFactor) ? Number(d.profitFactor) : null;
  const maxDrawdown = isNum(d.maxDrawdown) ? Math.abs(Number(d.maxDrawdown)) : null;
  const avgWin = isNum(d.avgWin) ? Number(d.avgWin) : null;
  const avgLoss = isNum(d.avgLoss) ? Number(d.avgLoss) : null;
  const totalTraded = isNum(d.totalTraded) ? Number(d.totalTraded) : 0;
  const expectancy = isNum(d.expectancy) ? Number(d.expectancy) : null;
  const sharpe = isNum(d.sharpe) ? Number(d.sharpe) : null;
  const byStrategy = d.byStrategy || [];
  const byTimeframe = d.byTimeframe || [];

  // --- last updated ---
  const updatedAt = d.updatedAt != null ? Number(d.updatedAt) : Date.now();

  // --- equity curve chart ---
  const equityPoints = equity.length > 1 ? equity : [];

  const body = `<div class="screen">
    ${demo ? demoBanner('Statistik berikut adalah contoh kosong. Performa nyata harus dibaca dari backend bot lama.') : ''}

    <!-- KPI Row (mobile full-width) -->
    <div class="kpi-row" style="margin-bottom:12px">
      ${winRate != null ? `<div class="kpi ${winRate >= 0.5 || winRate >= 50 ? 'pos' : 'neg'}"><span class="kpi__label">Win Rate</span><span class="kpi__value">${fmtRatioPct(winRate, { asRatio: true })}</span></div>` : ''}
      ${profitFactor != null ? `<div class="kpi"><span class="kpi__label">Profit Factor</span><span class="kpi__value">${profitFactor.toFixed(2)}</span></div>` : ''}
      ${maxDrawdown != null ? `<div class="kpi neg"><span class="kpi__label">Max Drawdown</span><span class="kpi__value">${maxDrawdown.toFixed(2)}%</span></div>` : ''}
      ${totalTraded > 0 ? `<div class="kpi"><span class="kpi__label">Total Traded</span><span class="kpi__value">${fmtInt(totalTraded)}</span></div>` : ''}
    </div>

    <!-- 2-panel desktop, single mobile -->
    ${window.innerWidth >= 900 ? desktopLayout() : mobileLayout()}

    ${res.error && !demo ? banner(`<strong>Gagal memuat statistik.</strong> ${escapeHtml(res.error)}`, 'neg', '⛔') : ''}

    <div class="banner banner--warn">
      <span class="banner__icon">⚠️</span>
      <div>Performa adalah data historis, bukan jaminan hasil. Sampel kecil (< 30 transaksi) tidak cukup untuk menyimpulkan strategi mempunyai edge.</div>
    </div>
  </div>`;

  return body;
}

/** Mobile layout: single column with equity chart + stats below. */
function mobileLayout() {
  const equityPoints = equity.length > 1 ? equity : [];
  return `
    <!-- Equity Chart -->
    ${equityPoints.length > 1 ? `
      <div class="card">
        <div class="card__head"><h2 class="card__title">Equity Curve</h2></div>
        <div class="chart-wrap"><canvas id="equity-mob" data-height="200" style="width:100%"></canvas></div>
      </div>` : ''}

    <!-- Stats -->
    <div class="stat-grid" style="margin-top:12px">
      ${winRate != null ? `<div class="stat"><span class="stat__label">Win Rate</span><span class="stat__value ${winRate >= 0.5 || winRate >= 50 ? 'pos' : 'neg'}">${fmtRatioPct(winRate, { asRatio: true })}</span></div>` : ''}
      ${profitFactor != null ? `<div class="stat"><span class="stat__label">Profit Factor</span><span class="stat__value">${profitFactor.toFixed(2)}</span></div>` : ''}
      ${maxDrawdown != null ? `<div class="stat neg"><span class="stat__label">Max Drawdown</span><span class="stat__value">${maxDrawdown.toFixed(2)}%</span></div>` : ''}
      ${avgWin != null ? `<div class="stat"><span class="stat__label">Average Win</span><span class="stat__value">${fmtUsd(avgWin, { sign: true })}</span></div>` : ''}
      ${avgLoss != null ? `<div class="stat neg"><span class="stat__label">Average Loss</span><span class="stat__value">${fmtUsd(avgLoss, { sign: true })}</span></div>` : ''}
      ${totalTraded > 0 ? `<div class="stat"><span class="stat__label">Total Traded</span><span class="stat__value">${fmtInt(totalTraded)}</span></div>` : ''}
      ${expectancy != null ? `<div class="stat"><span class="stat__label">Expectancy</span><span class="stat__value">${fmtUsd(expectancy)}</span></div>` : ''}
      ${sharpe != null ? `<div class="stat"><span class="stat__label">Sharpe Ratio</span><span class="stat__value">${sharpe.toFixed(2)}</span></div>` : ''}
    </div>`;
}

/** Desktop layout: two columns — equity chart left, stats right. */
function desktopLayout() {
  const equityPoints = equity.length > 1 ? equity : [];
  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <!-- Left: Equity Chart -->
      ${equityPoints.length > 1 ? `
        <div class="card">
          <div class="card__head"><h2 class="card__title">Equity Curve</h2></div>
          <div class="chart-wrap"><canvas id="equity-desktop" data-height="250" style="width:100%"></canvas></div>
        </div>` : ''}

      <!-- Right: Stats -->
      ${winRate != null || profitFactor != null || maxDrawdown != null || avgWin != null || avgLoss != null || totalTraded > 0 || expectancy != null || sharpe != null ? `
        <div>
          ${winRate != null ? `<div class="stat"><span class="stat__label">Win Rate</span><span class="stat__value ${winRate >= 0.5 || winRate >= 50 ? 'pos' : 'neg'}">${fmtRatioPct(winRate, { asRatio: true })}</span></div>` : ''}
          ${profitFactor != null ? `<div class="stat"><span class="stat__label">Profit Factor</span><span class="stat__value">${profitFactor.toFixed(2)}</span></div>` : ''}
          ${maxDrawdown != null ? `<div class="stat neg"><span class="stat__label">Max Drawdown</span><span class="stat__value">${maxDrawdown.toFixed(2)}%</span></div>` : ''}
          ${avgWin != null ? `<div class="stat"><span class="stat__label">Average Win</span><span class="stat__value">${fmtUsd(avgWin, { sign: true })}</span></div>` : ''}
          ${avgLoss != null ? `<div class="stat neg"><span class="stat__label">Average Loss</span><span class="stat__value">${fmtUsd(avgLoss, { sign: true })}</span></div>` : ''}
          ${totalTraded > 0 ? `<div class="stat"><span class="stat__label">Total Traded</span><span class="stat__value">${fmtInt(totalTraded)}</span></div>` : ''}
          ${expectancy != null ? `<div class="stat"><span class="stat__label">Expectancy</span><span class="stat__value">${fmtUsd(expectancy)}</span></div>` : ''}
          ${sharpe != null ? `<div class="stat"><span class="stat__label">Sharpe Ratio</span><span class="stat__value">${sharpe.toFixed(2)}</span></div>` : ''}
        </div>` : ''}
    </div>`;
}

/** Render breakdown cards (per strategy / timeframe). */
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
        const label = item.name || item.strategy || item.timeframe || (item[key] || '—');
        const winRate = isNum(item.winRate) ? fmtRatioPct(item.winRate, { asRatio: item.winRate <= 1 }) : '—';
        const pnl = item.pnl;
        return `<div class="row">
          <div class="row__main">
            <div class="row__title"><span>${escapeHtml(label)}</span></div>
            <div class="row__sub">samples ${fmtInt(item.samples ?? item.trades)} · WR ${winRate}</div>
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
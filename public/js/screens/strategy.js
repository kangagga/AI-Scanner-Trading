/** Strategy Lab — tabbed interface for 6 supported strategies with backtest & comparison. */

import { state } from '../core/store.js';
import {
  card, empty, demoBanner, banner, kv, chips,
} from '../ui/components.js';
import { renderControls } from '../ui/shell.js';
import { escapeHtml, fmtInt, fmtRatioPct, fmtUsd, pnlClass, isNum } from '../core/format.js';
import { DEMO } from '../core/demo.js';

export const meta = { id: 'strategy', title: 'Strategy Lab' };

const STRATEGIES = [
  'Base Formation',
  'Pullback Entry',
  'Retest Entry',
  'Support Bounce',
  'Resistance Rejection',
  'Momentum Confirmation',
];

const strategyLabels = {
  'Base Formation': 'Formation dasar pola candle',
  'Pullback Entry': 'Entry pullback',
  'Retest Entry': 'Entry retest level',
  'Support Bounce': 'Bounce dari support',
  'Resistance Rejection': 'Penolakan resistance',
  'Momentum Confirmation': 'Konfirmasi momentum',
};

export function render() {
  const res = state.resources.strategy || {};
  const demo = Boolean(res.demo);
  const d = res.data || {};
  const strategies = Array.isArray(d.strategies) ? d.strategies : [];
  const timeframes = Array.isArray(d.timeframes) ? d.timeframes : [];

  // --- per-strategy stats ---
  const strategyStats = {};
  STRATEGIES.forEach((name) => {
    const s = strategies.find((str) => str.name === name || str.id === name);
    strategyStats[name] = {
      totalTrades: s ? (s.totalTrades || 0) : 0,
      wins: s ? (s.wins || 0) : 0,
      losses: s ? (s.losses || 0) : 0,
      avgProfit: s ? (s.avgProfit != null ? Number(s.avgProfit) : null) : null,
      avgLoss: s ? (s.avgLoss != null ? Number(s.avgLoss) : null) : null,
      actualRR: s ? (s.actualRR != null ? Number(s.actualRR) : null) : null,
      winRate: s ? Number(s.winRate || 0) : 0,
      enabled: s ? s.enabled : null,
    };
  });

  // --- edge indicator ---
  function edgeClass(sr) {
    const minSamples = 30;
    if (sr.totalTrades >= minSamples && sr.winRate > 50) return 'pos';
    return 'muted';
  }

  // --- compare table data ---
  const compareRows = STRATEGIES.map((name) => {
    const sr = strategyStats[name];
    return {
      name,
      totalTrades: sr.totalTrades,
      wins: sr.wins,
      losses: sr.losses,
      winRate: sr.winRate / 100,
      actualRR: sr.actualRR,
      avgProfit: sr.avgProfit,
      avgLoss: sr.avgLoss,
      edge: edgeClass(sr),
    };
  });

  return `<div class="screen">
    ${demo ? demoBanner('Konfigurasi strategi belum tersedia. Tidak ada strategi baru atau nilai asumsi.') : ''}

    <div class="banner banner--info">
      <span class="banner__icon">🔒</span>
      <div>Layar ini menampilkan data historis dari bot lama. Tidak ada konfigurasi yang dikirim ke bot.</div>
    </div>

    ${res.error && !demo ? banner(`<strong>Gagal membaca strategi.</strong> ${escapeHtml(res.error)}`, 'neg', '⛔') : ''}

    <!-- Tabs -->
    <div class="tab-bar" style="display:flex;gap:2px;margin-bottom:12px">
      ${STRATEGIES.map((name, i) => `
        <button class="tab-btn${i === 0 ? ' tab-btn--active' : ''}" data-strategy="${name}">${name}</button>
      `).join('')}
    </div>

    <!-- Strategy Content -->
    <div class="strategy-content"></div>

    <!-- Compare Strategies -->
    ${!demo ? `
    <div class="card" style="margin-top:12px">
      <div class="card__head"><h2 class="card__title">Compare Strategies</h2></div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr>
              <th style="padding:8px;text-align:left">Strategi</th>
              <th style="padding:8px;text-align:center">Total Trade</th>
              <th style="padding:8px;text-align:center">Win Rate</th>
              <th style="padding:8px;text-align:center">Profit Factor</th>
              <th style="padding:8px;text-align:center">RR Aktual</th>
              <th style="padding:8px;text-align:center">Edge</th>
            </tr>
          </thead>
          <tbody>
            ${STRATEGIES.map((name) => {
              const sr = strategyStats[name];
              const edgeCls = edgeClass(strategyStats[name]) === 'pos' ? 'pos' : 'muted';
              return `<tr>
                <td style="padding:8px;"><strong>${name}</strong></td>
                <td style="padding:8px;text-align:center">${fmtInt(sr.totalTrades)}</td>
                <td style="padding:8px;text-align:center">${fmtRatioPct(sr.winRate / 100, { asRatio: true })}</td>
                <td style="padding:8px;text-align:center">${sr.actualRR != null ? sr.actualRR.toFixed(2) : '—'}</td>
                <td style="padding:8px;text-align:center">${sr.actualRR != null ? `${sr.actualRR.toFixed(2)}:1` : '—'}</td>
                <td style="padding:8px;text-align:center"><span class="badge badge--${edgeCls}">${sr.totalTrades >= 30 && sr.winRate > 50 ? 'POSITIF EDGE' : 'Perlu Data Lebih Banyak'}</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>` : ''}

    <!-- Backtest Form -->
    ${!demo ? `
    <div class="card" style="margin-top:12px">
      <div class="card__head"><h2 class="card__title">Run Backtest</h2></div>
      <div style="margin-top:8px">
        <select id="backtest-strategy" style="padding:6px 10px;margin-right:8px">
          ${STRATEGIES.map((name) => `<option value="${name}">${name}</option>`).join('')}
        </select>
        <input type="number" id="backtest-samples" min="10" max="500" step="10" value="100"
          style="padding:6px 10px;margin-right:8px"
          placeholder="sample size">+
        <button class="btn btn--primary" style="padding:6px 12px" onclick="runBacktest()">Run</button>
      </div>
    </div>` : ''}

    <div class="stat__meta">
      <small>Catatan: Strategi hanya dianggap memiliki edge jika sampel ≥ 30 transaksi dan win rate > 50%.
      Jangan pernah menganggap strategi menguntungkan hanya dari beberapa transaksi.</small>
    </div>
  </div>`;
}

export function bind(root) {
  // Tab clicks
  root.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-btn--active'));
      btn.classList.add('tab-btn--active');
      const strategy = btn.dataset.strategy;
      const content = root.querySelector('.strategy-content');
      if (content) {
        content.innerHTML = renderStrategyContent(strategy);
      }
    });
  });

  // Initial render
  const initial = root.querySelector('.tab-btn--active')?.dataset.strategy || STRATEGIES[0];
  if (root.querySelector('.strategy-content')) {
    root.querySelector('.strategy-content').innerHTML = renderStrategyContent(initial);
  }
}

function renderStrategyContent(strategyName) {
  const sr = strategyStats[strategyName] || { totalTrades: 0, wins: 0, losses: 0, winRate: 0, actualRR: null, avgProfit: null, avgLoss: null };
  const wins = sr.wins || 0;
  const total = sr.totalTrades || 0;
  const winRate = total ? (sr.winRate / 100) : 0;
  const actualRR = sr.actualRR != null ? sr.actualRR : null;
  const avgProfit = sr.avgProfit != null ? fmtUsd(sr.avgProfit) : '—';
  const avgLoss = sr.avgLoss != null ? fmtUsd(sr.avgLoss) : '—';

  return `<div class="strategy-panel">
    <h3>${escapeHtml(strategyName)}</h3>
    <div class="kv-grid">
      <div class="kv"><span class="kv__label">Total Trade</span><span class="kv__value">${fmtInt(sr.totalTrades)}</span></div>
      <div class="kv"><span class="kv__label">Win Rate</span><span class="kv__value ${winRate >= 0.5 ? 'pos' : 'muted'}">${fmtRatioPct(winRate, { asRatio: true })}</span></div>
      ${actualRR != null ? `<div class="kv"><span class="kv__label">RR Aktual</span><span class="kv__value pos">${actualRR.toFixed(2)}:1</span></div>` : ''}
      <div class="kv"><span class="kv__label">Average Profit</span><span class="kv__value">${avgProfit}</span></div>
      <div class="kv"><span class="kv__label">Average Loss</span><span class="kv__value neg">${avgLoss}</span></div>
    </div>
    ${total > 0 ? `<div class="kv"><span class="kv__label">Edge Indicator</span><span class="badge badge--${edgeClass(strategyStats[strategyName] || { totalTrades: total, winRate: total > 0 ? total / total * 100 : 0 })}">${total >= 30 && winRate > 0.5 ? 'POSITIF EDGE' : 'Perlu Data Lebih Banyak'}</span></div>` : ''}
    <p class="muted">Data dari bot lama. Tidak ada modifikasi strategi.</p>
  </div>`;
}
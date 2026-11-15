/** AI Signals — detailed signal cards with quality classification, indicator evidence, and risk/reward. */

import { state, isDemoResource } from '../core/store.js';
import {
  card, signalCard, empty, demoBanner, banner, chips, skeletonRows,
} from '../ui/components.js';
import { renderControls } from '../ui/shell.js';
import { escapeHtml, fmtInt, fmtUsd, fmtPct, fmtRatioPct, qualityClass, directionClass } from '../core/format.js';
import { DEMO } from '../core/demo.js';

export const meta = { id: 'signals', title: 'AI Signals' };

const qualityLabels = { high: 'HIGH', medium: 'MEDIUM', low: 'LOW', rejected: 'REJECTED' };
const qualityColors = { high: 'pos', medium: 'info', low: 'warn', rejected: 'neg' };

export function render() {
  const res = state.resources.signals || {};
  const demo = Boolean(res.demo);
  const payload = res.data || {};
  const all = Array.isArray(payload.signals) ? payload.signals : [];

  // --- filter by quality ---
  const filters = { quality: 'all' };
  const qualityFilter = document.querySelector('button[data-q].active')?.dataset.q || 'all';
  const filtered =
    filters.quality === 'all'
      ? all
      : all.filter((s) => s.quality === filters.quality);

  // --- counts ---
  const counts = {
    high: all.filter((s) => s.quality === 'high').length,
    medium: all.filter((s) => s.quality === 'medium').length,
    low: all.filter((s) => s.quality === 'low').length,
    rejected: all.filter((s) => s.quality === 'rejected').length,
  };

  return `<div class="screen">
    ${demo ? demoBanner('Klasifikasi AI di bawah berasal dari data contoh, bukan analisis bot Anda.') : ''}

    <!-- Quality Filter -->
    <div style="margin-bottom:12px">
      <div class="section-title">Kualitas</div>
      ${chips(
        [
          { id: 'all', label: `Semua (${all.length})` },
          { id: 'high', label: 'HIGH' },
          { id: 'medium', label: 'MEDIUM' },
          { id: 'low', label: 'LOW' },
          { id: 'rejected', label: 'REJECTED' },
        ],
        filters.quality,
        { dataAttr: 'data-q' }
      )}
    </div>

    <!-- Quality Counts -->
    <div class="stat-grid" style="margin-bottom:12px">
      ${Object.entries(counts).map(([q, label]) => `
        <div class="stat"><div class="stat__label">${qualityLabels[q]}</div><div class="stat__value ${qualityColors[q]}">${fmtInt(label)}</div></div>`).join('')}
    </div>

    ${res.error && !demo ? banner(`<strong>Gagal memuat sinyal.</strong> ${escapeHtml(res.error)}`, 'neg', '⛔') : ''}

    <!-- Signal Cards -->
    ${card({ flush: true, body: res.loading && !all.length ? skeletonRows(3) : filtered.length ? filtered.map(renderSignalCard).join('') : empty({ icon: '🤖', title: 'Belum ada sinyal AI', desc: 'Sinyal dan klasifikasinya berasal dari modul analisis bot lama.' }) })}

    <div class="banner banner--info">
      <span class="banner__icon">ℹ️</span>
      <div>Klasifikasi HIGH/MEDIUM/LOW/REJECTED dihitung oleh bot lama. Aplikasi ini hanya menampilkan — tidak menilai ulang atau mengubah strategi.</div>
    </div>
  </div>`;
}

/** Render a single signal card with full breakdown. */
function renderSignalCard(s) {
  const quality = s.quality || 'UNKNOWN';
  const direction = String(s.direction || '').toUpperCase();
  const score = s.score != null ? Number(s.score) : null;
  const entry = s.entry != null ? Number(s.entry) : null;
  const sl = s.stopLoss != null ? Number(s.stopLoss) : null;
  const tp = s.takeProfit != null ? Number(s.takeProfit) : null;
  const rr = s.rr != null ? Number(s.rr) : null;
  const timeframe = s.timeframe || '—';
  const symbol = s.symbol || '—';

  // indicator evidence — only what actually exists in the data; never invent
  const evidence = s.evidence || s.reasons || [];
  const evidenceList = evidence.length
    ? evidence.map((e) => `<li>${escapeHtml(String(e))}</li>`).join('')
    : `<li><span class="muted">Bukti indikator tidak tersedia — ditandai DEMO.</span></li>`;

  // invalidation — from data or dash
  const invalidation = s.invalidation != null ? String(s.invalidation) : '—';

  return `<div class="signal-card" style="border-left:4px solid ${qualityColors[quality] || 'muted'}">
    <div class="card__head" style="display:flex;justify-content:space-between;align-items:center">
      <h3 class="card__title">${escapeHtml(s.symbol || '—')} ${timeframe}</h3>
      <span class="badge badge--${qualityColors[quality] || 'muted'}">${qualityLabels[quality] || quality}</span>
    </div>

    <div class="kv-grid">
      <div class="kv"><span class="kv__k">Arah</span><span class="kv__v ${directionClass(direction)}">${direction}</span></div>
      ${entry != null ? `<div class="kv"><span class="kv__k">Entry</span><span class="kv__v">${fmtUsd(entry)}</span></div>` : ''}
      ${sl != null ? `<div class="kv"><span class="kv__k">Stop Loss</span><span class="kv__v">${fmtUsd(sl)}</span></div>` : ''}
      ${tp != null ? `<div class="kv"><span class="kv__k">Take Profit</span><span class="kv__v">${fmtUsd(tp)}</span></div>` : ''}
      ${rr != null ? `<div class="kv"><span class="kv__k">Risk/Reward</span><span class="kv__v">${fmtRatioPct(rr)}</span></div>` : ''}
    </div>

    <!-- Indicator Evidence -->
    <details style="margin:8px 0">
      <summary><small>Bukti Indikator</small> <span class="muted">(${evidence.length} bukti)</span></summary>
      <ol>${evidenceList}</ol>
    </details>

    <!-- Risk/Reward Detail -->
    ${rr != null ? `<div class="kv" style="margin:8px 0"><span class="kv__k">RR Actual</span><span class="kv__v pos">${fmtRatioPct(rr)}</span></div>` : ''}

    <div class="kv" style="margin-top:6px">
      <span class="kv__k">Invalidasikan</span>
      <span class="kv__v muted">${escapeHtml(invalidation)}</span>
    </div>
  </div>`;
}

export function bind(root) {
  // Quality filter buttons
  root.querySelectorAll('[data-q]').forEach((btn) => {
    btn.addEventListener('click', () => {
      // update active state
      root.querySelectorAll('[data-q]').forEach(b => b.classList.toggle('active', b === btn));
      filters.quality = btn.dataset.q;
      // dispatch re-render
      const ev = new CustomEvent('app:rerender');
      document.dispatchEvent(ev);
    });
  });
}
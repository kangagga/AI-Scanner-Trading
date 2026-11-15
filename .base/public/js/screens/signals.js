/** AI Signals — signals with the bot's AI verdict/quality classification. */

import { state } from '../core/store.js';
import { card, signalCard, empty, demoBanner, banner, chips, skeletonRows } from '../ui/components.js';
import { escapeHtml, fmtInt, qualityClass } from '../core/format.js';

export const meta = { id: 'signals', title: 'AI Signals' };

const filters = { quality: 'all' };

export function render() {
  const res = state.resources.signals || {};
  const demo = Boolean(res.demo);
  const all = Array.isArray(res.data?.signals) ? res.data.signals : [];

  const counts = {
    high: all.filter((s) => qualityClass(s.quality) === 'high').length,
    medium: all.filter((s) => qualityClass(s.quality) === 'medium').length,
    low: all.filter((s) => qualityClass(s.quality) === 'low').length,
    rejected: all.filter((s) => qualityClass(s.quality) === 'rejected').length,
  };

  const filtered =
    filters.quality === 'all'
      ? all
      : all.filter((s) => qualityClass(s.quality) === filters.quality);

  return `<div class="screen">
    ${demo ? demoBanner('Klasifikasi AI di bawah berasal dari data contoh, bukan analisis bot Anda.') : ''}

    <div class="stat-grid">
      <div class="stat"><div class="stat__label">High</div><div class="stat__value pos">${fmtInt(counts.high)}</div></div>
      <div class="stat"><div class="stat__label">Medium</div><div class="stat__value" style="color:var(--info)">${fmtInt(
    counts.medium
  )}</div></div>
      <div class="stat"><div class="stat__label">Low</div><div class="stat__value warn">${fmtInt(counts.low)}</div></div>
      <div class="stat"><div class="stat__label">Rejected</div><div class="stat__value neg">${fmtInt(
    counts.rejected
  )}</div></div>
    </div>

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

    ${res.error && !demo ? banner(`<strong>Gagal memuat sinyal.</strong> ${escapeHtml(res.error)}`, 'neg', '⛔') : ''}

    ${card({
      flush: true,
      body: res.loading && !all.length
        ? skeletonRows(3)
        : filtered.length
        ? filtered.map((s) => signalCard(s, { showDemo: demo })).join('')
        : empty({
            icon: '🤖',
            title: 'Belum ada sinyal AI',
            desc: 'Sinyal dan klasifikasinya berasal dari modul analisis bot lama.',
          }),
    })}

    <div class="banner banner--info">
      <span class="banner__icon">ℹ️</span>
      <div>Klasifikasi HIGH/MEDIUM/LOW/REJECTED dihitung oleh bot lama. Aplikasi ini hanya menampilkan —
      tidak menilai ulang atau mengubah strategi.</div>
    </div>
  </div>`;
}

export function bind(root) {
  root.querySelectorAll('[data-q]').forEach((btn) => {
    btn.addEventListener('click', () => {
      filters.quality = btn.dataset.q;
      document.dispatchEvent(new CustomEvent('app:rerender'));
    });
  });
}

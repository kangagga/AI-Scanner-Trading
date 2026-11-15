/** Live Scanner — raw scanner output from the existing bot, with filters. */

import { state, isDemoResource, refreshAll } from '../core/store.js';
import { card, signalCard, empty, demoBanner, banner, chips, skeletonRows } from '../ui/components.js';
import { renderControls } from '../ui/shell.js';
import { escapeHtml, fmtInt } from '../core/format.js';

export const meta = { id: 'scanner', title: 'Live Scanner' };

/** Local UI filter state (not bot config). */
const filters = { timeframe: 'all', direction: 'all' };

export function render() {
  const res = state.resources.signals || {};
  const demo = Boolean(res.demo);
  const payload = res.data || {};
  const all = Array.isArray(payload.signals) ? payload.signals : [];

  const timeframes = ['all', ...unique(all.map((s) => s.timeframe).filter(Boolean))];
  const filtered = all.filter((s) => {
    if (filters.timeframe !== 'all' && s.timeframe !== filters.timeframe) return false;
    if (filters.direction !== 'all' && String(s.direction || '').toUpperCase() !== filters.direction) return false;
    return true;
  });

  return `<div class="screen">
    ${demo ? demoBanner('Hasil scanner di bawah adalah contoh tampilan. Hubungkan backend untuk data nyata.') : ''}

    <section class="card">
      <div class="card__head">
        <h2 class="card__title">Kontrol Scanner</h2>
        <span class="card__hint">${fmtInt(all.length)} sinyal</span>
      </div>
      ${renderControls({ compact: true })}
      <div class="stat__meta" style="margin-top:10px">
        Tombol di atas mengirim perintah ke bot lama. Status berubah hanya jika backend mengonfirmasi.
      </div>
    </section>

    <div>
      <div class="section-title">Filter Timeframe</div>
      ${chips(
        timeframes.map((tf) => ({ id: tf, label: tf === 'all' ? 'Semua' : tf })),
        filters.timeframe,
        { dataAttr: 'data-tf' }
      )}
    </div>

    <div>
      <div class="section-title">Arah Sinyal</div>
      ${chips(
        [
          { id: 'all', label: 'Semua' },
          { id: 'BUY', label: 'BUY' },
          { id: 'SELL', label: 'SELL' },
        ],
        filters.direction,
        { dataAttr: 'data-dir' }
      )}
    </div>

    ${res.error && !demo ? banner(`<strong>Gagal memuat sinyal.</strong> ${escapeHtml(res.error)}`, 'neg', '⛔') : ''}

    ${card({
      title: 'Hasil Pemindaian',
      hint: res.loading ? 'memuat…' : '',
      flush: true,
      body: res.loading && !all.length
        ? skeletonRows(3)
        : filtered.length
        ? filtered.map((s) => signalCard(s, { showDemo: demo })).join('')
        : empty({
            icon: '📡',
            title: 'Belum ada sinyal',
            desc: demo
              ? 'Mode demo tidak menampilkan sinyal pasar.'
              : 'Scanner belum menghasilkan sinyal, atau backend belum terhubung.',
          }),
    })}

    <button class="btn btn--ghost btn--block" data-action="refresh">⟳ Muat ulang sinyal</button>
  </div>`;
}

export function bind(root) {
  root.querySelectorAll('[data-tf]').forEach((btn) => {
    btn.addEventListener('click', () => {
      filters.timeframe = btn.dataset.tf;
      refresh();
    });
  });
  root.querySelectorAll('[data-dir]').forEach((btn) => {
    btn.addEventListener('click', () => {
      filters.direction = btn.dataset.dir;
      refresh();
    });
  });
}

function refresh() {
  // Filters are local: re-render without hitting the backend.
  document.dispatchEvent(new CustomEvent('app:rerender'));
}

function unique(list) {
  return [...new Set(list)];
}

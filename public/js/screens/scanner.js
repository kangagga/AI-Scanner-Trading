/** Live Scanner — professional table with filters, status badges, and real-time price ticker. */

import { state, isDemoResource, refreshAll, control } from '../core/store.js';
import {
  card, statusPill, DEMO_CHIP, empty, chips, skeletonRows,
} from '../ui/components.js';
import { renderControls } from '../ui/shell.js';
import { escapeHtml, fmtInt, fmtUsd, fmtPct } from '../core/format.js';
import { DEMO } from '../core/demo.js';

export const meta = { id: 'scanner', title: 'Live Scanner' };

export function render() {
  const res = state.resources.signals || {};
  const demo = Boolean(res.demo);
  const payload = res.data || {};
  const all = Array.isArray(payload.signals) ? payload.signals : [];

  // --- real-time price ticker ---
  const ticker = payload.ticker || (demo ? { symbol: 'BTCUSDT', price: '—', change: '—', changePct: '—' } : null);
  const tickerOnline = state.connection && state.connection.state === 'ONLINE';

  // --- filter state ---
  const timeframes = ['all', ...new Set(all.map((s) => s.timeframe).filter(Boolean))];
  const directions = ['all', ...new Set(all.map((s) => String(s.direction || '').toUpperCase()).filter(Boolean))];
  const filterTimeframe = document.querySelector('button[data-tf]')?.dataset.tf || 'all';
  const filterDirection = document.querySelector('button[data-dir]')?.dataset.dir || 'all';

  const filtered = all.filter((s) => {
    if (filterTimeframe !== 'all' && s.timeframe !== filterTimeframe) return false;
    if (filterDirection !== 'all' && String(s.direction || '').toUpperCase() !== filterDirection) return false;
    return true;
  });

  // --- dedup indicator ---
  const dedupInd = all.length !== filtered.length ? `<span class="badge badge--warn" title="Beberapa sinyal duplikat di-filter">— ${all.length - filtered.length} duplikat</span>` : '';

  return `<div class="screen">
    ${demo ? demoBanner('Hasil scanner di bawah adalah contoh tampilan. Hubungkan backend untuk data nyata.') : ''}

    <!-- Price Ticker Bar -->
    ${tickerOnline ? `
    <div class="ticker-bar" style="background:var(--navy); padding:8px 12px; margin-bottom:12px; border-radius:8px 8px 0 0;">
      <span class="ticker__symbol" style="color:var(--ink);">${escapeHtml(ticker.symbol || '—')}</span>
      <span class="ticker__price" style="color:var(--pos);">${escapeHtml(ticker.price || '—')}</span>
      <span class="ticker__change ${ticker.changePct >= 0 ? 'pos' : 'neg'}" style="color:var(${ticker.changePct >= 0 ? 'pos' : 'neg'})">
        ${escapeHtml(ticker.changePct || '—')}%
      </span>
    </div>` : ''}

    <section class="card">
      <div class="card__head">
        <h2 class="card__title">Kontrol Scanner</h2>
        <span class="card__hint">${fmtInt(all.length)} sinyal terdaftar</span>
      </div>
      ${renderControls({ compact: true })}
      <div class="stat__meta" style="margin-top:8px">
        Tombol di atas mengirim perintah ke bot lama. Status berubah hanya jika backend mengonfirmasi.
      </div>
    </section>

    <!-- Filter Timeframe -->
    <div style="margin-bottom:10px">
      <div class="section-title">Filter Timeframe</div>
      ${chips(
        timeframes.map((tf) => ({ id: `tf-${tf}`, label: tf === 'all' ? 'Semua' : tf, active: filterTimeframe === tf })),
        filterTimeframe,
        { dataAttr: 'data-tf' }
      )}
    </div>

    <!-- Filter Arah -->
    <div style="margin-bottom:10px">
      <div class="section-title">Arah Sinyal</div>
      ${chips(
        directions.map((dir) => ({ id: `dir-${dir}`, label: dir, active: filterDirection === dir })),
        filterDirection,
        { dataAttr: 'data-dir' }
      )}
    </div>

    ${res.error && !demo ? banner(`<strong>Gagal memuat sinyal.</strong> ${escapeHtml(res.error)}`, 'neg', '⛔') : ''}

    <!-- Dedup notice -->
    ${dedupInd}

    <!-- Scanner Results Table -->
    ${card({
      title: 'Hasil Pemindaian',
      hint: res.loading ? 'memuat…' : '',
      flush: true,
      body: res.loading && !all.length
        ? skeletonRows(3)
        : filtered.length
          ? `<div class="scanner-table" style="max-height:400px;overflow-y:auto;">
              ${filtered.map((s) => `
                <div class="scanner-row" style="display:grid;grid-template-columns:160px 1fr 60px;gap:8px;padding:8px 0;border-bottom:1px solid var(--line-soft);">
                  <div>
                    <strong>${escapeHtml(s.symbol || '—')}</strong>
                    <span class="small muted">${escapeHtml(s.timeframe || '—')}</span>
                  </div>
                  <div style="text-align:center;align-self:center">
                    <span class="badge badge--${s.direction === 'BUY' ? 'pos' : s.direction === 'SELL' ? 'neg' : 'muted'}">${escapeHtml(String(s.direction || '—').charAt(0))}</span>
                  </div>
                  <div style="text-align:right;align-self:center">
                    <span class="small">${fmtUsd(s.entry || 0)}</span>
                  </div>
                </div>`).join('')}
            </div>`
          : empty({
              icon: '📡',
              title: 'Belum ada sinyal',
              desc: demo
                ? 'Mode demo tidak menampilkan sinyal pasar.'
                : 'Scanner belum menghasilkan sinyal, atau backend belum terhubung.',
            }),
    })}

    <button class="btn btn--ghost btn--block" data-action="refresh" style="margin-top:8px">⟳ Muat ulang sinyal</button>
  </div>`;
}

export function bind(root) {
  // Timeframe filters
  root.querySelectorAll('[data-tf]').forEach((btn) => {
    btn.addEventListener('click', () => {
      // update active state
      root.querySelectorAll('[data-tf]').forEach(b => b.classList.toggle('active', b === btn));
      // dispatch custom event for re-render
      const ev = new CustomEvent('scanner:filter', { detail: { timeframe: btn.dataset.tf } });
      root.dispatchEvent(ev);
    });
  });

  // Direction filters
  root.querySelectorAll('[data-dir]').forEach((btn) => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('[data-dir]').forEach(b => b.classList.toggle('active', b === btn));
      const ev = new CustomEvent('scanner:filter', { detail: { direction: btn.dataset.dir } });
      root.dispatchEvent(ev);
    });
  });

  // Refresh button
  root.querySelector('[data-action="refresh"]').addEventListener('click', () => {
    control('refresh').then(() => {
      // trigger re-render after control succeeds
      const ev = new CustomEvent('app:rerender');
      document.dispatchEvent(ev);
    });
  });
}
/** Strategy Settings — read-only projection of old bot config, no writes. */

import { state } from '../core/store.js';
import { card, empty, demoBanner, banner, kv, DEMO_CHIP } from '../ui/components.js';
import { escapeHtml, isNum } from '../core/format.js';

export const meta = { id: 'strategy', title: 'Strategy Settings' };

export function render() {
  const res = state.resources.strategy || {};
  const demo = Boolean(res.demo);
  const d = res.data || {};
  const strategies = Array.isArray(d.strategies) ? d.strategies : [];
  const timeframes = Array.isArray(d.timeframes) ? d.timeframes : [];

  return `<div class="screen">
    ${demo ? demoBanner('Konfigurasi strategi belum tersedia. Tidak ada strategi baru atau nilai asumsi.') : ''}

    <div class="banner banner--info">
      <span class="banner__icon">🔒</span>
      <div>Layar ini <strong>read-only</strong>. Tidak ada perubahan konfigurasi yang dikirim.
      Perilaku bot hanya boleh diubah melalui interface resmi yang memang didukung bot lama.</div>
    </div>

    ${res.error && !demo ? banner(`<strong>Gagal membaca config.</strong> ${escapeHtml(res.error)}`, 'neg', '⛔') : ''}

    ${card({
      title: 'Scanner Configuration',
      hint: demo ? DEMO_CHIP : '',
      body: [
        ['Status scanner', d.scannerEnabled === true ? 'Enabled' : d.scannerEnabled === false ? 'Disabled' : '—'],
        ['Min signal score', isNum(d.minScore) ? String(d.minScore) : '—'],
        ['Risk per trade', isNum(d.riskPercent) ? `${d.riskPercent}%` : '—'],
        ['Max positions', isNum(d.maxPositions) ? String(d.maxPositions) : '—'],
        ['Paper trading', d.paperTrading === true ? 'TRUE' : d.paperTrading === false ? 'FALSE' : '—'],
        ['Bitget mirror', d.bitgetMirror === false ? 'FALSE' : d.bitgetMirror === true ? 'TRUE' : '—'],
      ]
        .map(([k, v]) => kv(k, escapeHtml(v)))
        .join(''),
    })}

    ${card({
      title: 'Strategi Aktif',
      flush: true,
      body: strategies.length
        ? `<div class="list">${strategies
            .map(
              (s) => `<div class="row">
              <div class="row__main"><div class="row__title"><span>${escapeHtml(s.name || s.id || '—')}</span></div>
              <div class="row__sub">${escapeHtml(s.description || 'Tidak ada deskripsi dari backend.')}</div></div>
              ${s.enabled === true ? '<span class="badge badge--pos">ON</span>' : s.enabled === false ? '<span class="badge badge--muted">OFF</span>' : '<span class="badge badge--muted">UNKNOWN</span>'}
            </div>`
            )
            .join('')}</div>`
        : empty({ icon: '⚙️', title: 'Konfigurasi strategi belum tersedia', desc: 'Tidak mengarang daftar strategi bot lama.' }),
    })}

    ${card({
      title: 'Timeframes',
      body: timeframes.length
        ? `<div class="chips">${timeframes.map((tf) => `<span class="chip">${escapeHtml(tf)}</span>`).join('')}</div>`
        : '<div class="stat__meta">Tidak ada daftar timeframe dari backend.</div>',
    })}

    <div class="stat__meta">Config tidak dapat diubah dari control center tanpa API resmi dari bot lama.</div>
  </div>`;
}

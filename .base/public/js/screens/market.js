/** Market Overview — market data supplied by the bot's data source. */

import { state } from '../core/store.js';
import { card, empty, demoBanner, banner, stat, badge } from '../ui/components.js';
import { escapeHtml, fmtPrice, fmtPct, fmtUsd, pnlClass, isNum, timeAgo } from '../core/format.js';

export const meta = { id: 'market', title: 'Market Overview' };

export function render() {
  const res = state.resources.market || {};
  const demo = Boolean(res.demo);
  const d = res.data || {};

  const hasAny =
    d.btcTrend || d.ethTrend || d.sentiment || (d.gainers && d.gainers.length) || (d.losers && d.losers.length);

  return `<div class="screen">
    ${demo ? demoBanner('Data pasar di bawah tidak tersedia dari backend. Tidak ada harga yang dikarang.') : ''}

    ${res.error && !demo ? banner(`<strong>Gagal memuat market.</strong> ${escapeHtml(res.error)}`, 'neg', '⛔') : ''}

    <div class="stat-grid">
      ${stat({
        label: 'BTC Trend',
        value: escapeHtml(String(d.btcTrend || '—').toUpperCase()),
        tone: trendTone(d.btcTrend),
        small: true,
      })}
      ${stat({
        label: 'ETH Trend',
        value: escapeHtml(String(d.ethTrend || '—').toUpperCase()),
        tone: trendTone(d.ethTrend),
        small: true,
      })}
      ${stat({
        label: 'Sentiment',
        value: escapeHtml(String(d.sentiment || '—').toUpperCase()),
        tone: trendTone(d.sentiment),
        small: true,
      })}
      ${stat({
        label: 'Kondisi',
        value: escapeHtml(String(d.condition || '—').toUpperCase()),
        tone: trendTone(d.condition),
        small: true,
      })}
    </div>

    <div class="stat-grid">
      ${stat({ label: 'Volume Pasar', value: isNum(d.volume) ? fmtUsd(d.volume, { compact: true }) : '—' })}
      ${stat({
        label: 'BTC Dominance',
        value: isNum(d.btcDominance) ? `${d.btcDominance.toFixed(1)}%` : '—',
        meta: isNum(d.btcDominance) ? '' : 'tidak tersedia',
      })}
    </div>

    ${coinList('Top Gainers', d.gainers, 'pos', demo)}
    ${coinList('Top Losers', d.losers, 'neg', demo)}
    ${coinList('Volume Terbesar', d.topVolume, 'neutral', demo)}

    ${
      !hasAny && !res.loading
        ? card({
            body: empty({
              icon: '🌐',
              title: 'Market overview belum tersedia',
              desc: 'Backend bot belum mengirim data pasar. Pastikan endpoint /market/overview aktif.',
            }),
          })
        : ''
    }

    <div class="stat__meta" style="text-align:center">Diperbarui ${escapeHtml(timeAgo(res.updatedAt))}</div>
  </div>`;
}

function coinList(title, list, tone, demo) {
  const items = Array.isArray(list) ? list : [];
  return card({
    title,
    hint: items.length ? `${items.length} koin` : '',
    flush: true,
    body: items.length
      ? `<div class="list">${items
          .slice(0, 12)
          .map(
            (c) => `<div class="row">
              <div class="row__main">
                <div class="row__title"><span>${escapeHtml(c.symbol || c.name || '—')}</span>${
              demo ? '<span class="badge badge--warn">DEMO</span>' : ''
            }</div>
                <div class="row__sub">${isNum(c.price) ? fmtPrice(c.price) : '—'}</div>
              </div>
              <div class="row__end">
                <div class="row__value ${c.changePct != null ? pnlClass(c.changePct) : tone}">${
              isNum(c.changePct) ? fmtPct(c.changePct, { sign: true }) : '—'
            }</div>
                <div class="row__meta">${isNum(c.volume) ? fmtUsd(c.volume, { compact: true }) : ''}</div>
              </div>
            </div>`
          )
          .join('')}</div>`
      : empty({ icon: '📉', title: `Belum ada data ${title.toLowerCase()}`, desc: 'Menunggu backend bot.' }),
  });
}

function trendTone(value) {
  const v = String(value || '').toLowerCase();
  if (v.includes('bull') || v.includes('greed') || v.includes('up')) return 'pos';
  if (v.includes('bear') || v.includes('fear') || v.includes('down')) return 'neg';
  if (v.includes('side') || v.includes('neutral')) return 'warn';
  return '';
}

/** Market Overview — professional institutional market data panel. */

import { state, isDemoResource } from '../core/store.js';
import {
  card, stat, banner, demoBanner, empty, badge, meter,
} from '../ui/components.js';
import { renderControls } from '../ui/shell.js';
import { escapeHtml, fmtPrice, fmtPct, fmtUsd, fmtRatioPct, timeAgo } from '../core/format.js';
import { DEMO } from '../core/demo.js';

export const meta = { id: 'market', title: 'Market Overview' };

const sentimentLabels = { bull: 'BULLISH', bear: 'BEARISH', side: 'SIDEWAYS' };
const sentimentColors = { bull: 'pos', bear: 'neg', side: 'warn' };

export function render() {
  const res = state.resources.market || {};
  const demo = Boolean(res.demo);
  const d = res.data || {};

  // --- derive trend & sentiment from backend data ---
  const btcTrend = d.btcTrend || (demo ? 'SIDEWAYS' : '—');
  const ethTrend = d.ethTrend || (demo ? 'SIDEWAYS' : '—');
  const sentiment = d.sentiment || (demo ? 'SIDEWAYS' : '—');
  const condition = d.condition || (demo ? 'SIDEWAYS' : '—');
  const volume = d.volume != null ? Number(d.volume) : null;
  const btcDominance = d.btcDominance != null ? Number(d.btcDominance) : null;
  const gainers = Array.isArray(d.gainers) ? d.gainers : [];
  const losers = Array.isArray(d.losers) ? d.losers : [];
  const topVolume = Array.isArray(d.topVolume) ? d.topVolume : [];

  const sentimentKey = String(sentiment).toLowerCase();
  const sentimentLabel = sentimentLabels[sentimentKey] || sentiment;
  const sentimentColor = sentimentColors[sentimentKey] || 'muted';

  // last updated
  const updatedAt = d.updatedAt != null ? Number(d.updatedAt) : Date.now();

  // --- volume heatmap miniature (canvas) ---
  const volumeMin = volume != null ? Math.max(1, volume / 10) : 1;
  const volumeMax = volume != null ? Math.max(10, volume) : 10;

  return `<div class="screen">
    ${demo ? demoBanner('Data pasar di bawah tidak tersedia dari backend. Tidak ada harga yang dikarang.') : ''}

    ${res.error && !demo ? banner(`<strong>Gagal memuat market.</strong> ${escapeHtml(res.error)}`, 'neg', '⛔') : ''}

    <!-- Sentiment & Trends -->
    <section class="card">
      <div class="card__head">
        <h2 class="card__title">Sentiment & Trend</h2>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px">
        <div class="stat"><span class="stat__label">BTC Trend</span><span class="stat__value ${trendTone(
          btcTrend
        )}">${escapeHtml(String(btcTrend).toUpperCase())}</span></div>
        <div class="stat"><span class="stat__label">ETH Trend</span><span class="stat__value ${trendTone(
          ethTrend
        )}">${escapeHtml(String(ethTrend).toUpperCase())}</span></div>
        <div class="stat"><span class="stat__label">Sentiment</span><span class="stat__value ${sentimentColor}">${escapeHtml(
          sentimentLabel
        )}</span></div>
        <div class="stat"><span class="stat__label">Kondisi</span><span class="stat__value ${trendTone(
          condition
        )}">${escapeHtml(String(condition).toUpperCase())}</span></div>
      </div>
    </section>

    <!-- Volume & Dominance -->
    <section class="card">
      <div class="card__head"><h2 class="card__title">Volume & Dominance</h2></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${volume != null ? stat({ label: 'Volume Pasar', value: fmtUsd(volume, { compact: true }), meta: '24h' }) : ''}
        ${btcDominance != null ? stat({ label: 'Dominansi BTC', value: `${btcDominance.toFixed(1)}%` }) : ''}
      </div>
      ${volume != null ? `
        <div style="margin-top:6px">
          <small>Volume tercatat: ${fmtUsd(volume, { compact: true })}</small>
        </div>` : ''}
      ${topVolume.length ? meter(Math.min(100, (topVolume.length / 20) * 100), 'Volume Top') : ''}
    </section>

    <!-- Gainers & Losers -->
    <section class="card">
      <div class="card__head">
        <h2 class="card__title">Top Gainers & Losers</h2>
        <small>Diperbarui ${escapeHtml(timeAgo(updatedAt))}</small>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${coinList('Top Gainers', gainers, 'pos', demo)}
        ${coinList('Top Losers', losers, 'neg', demo)}
      </div>
    </section>

    ${!demo && !res.loading ? empty({ icon: '🌐', title: 'Tidak ada data market', desc: 'Backend bot belum mengirim data pasar.' }) : ''}
  </div>`;
}

function coinList(title, list, tone, demo) {
  const items = Array.isArray(list) ? list : [];
  return card({
    title,
    flush: true,
    body: items.length
      ? `<div class="list">${items
          .slice(0, 10)
          .map(
            (c) => `<div class="row">
              <div class="row__main">
                <div class="row__title"><span>${escapeHtml(c.symbol || c.name || '—')}</span></div>
                <div class="row__price">${isNum(c.price) ? fmtPrice(c.price) : '—'}</div>
              </div>
              <div class="row__change ${isNum(c.changePct) ? pnlClass(c.changePct) : tone}" style="color:${isNum(c.changePct) ? (c.changePct >= 0 ? 'var(--pos)' : 'var(--neg)') : 'var(--muted)'}">
                ${isNum(c.changePct) ? fmtPct(c.changePct, { sign: true }) : '—'}
              </div>
              <div class="row__volume">${isNum(c.volume) ? fmtUsd(c.volume, { compact: true }) : ''}</div>
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
/** Small HTML-string components. All user/backend text is escaped. */

import {
  escapeHtml,
  fmtPrice,
  fmtUsd,
  pnlClass,
  qualityClass,
  directionClass,
  timeAgo,
  isNum,
} from '../core/format.js';

export const DEMO_CHIP = '<span class="badge badge--warn" title="Data contoh, bukan dari bot">DEMO</span>';

export function badge(text, tone = 'muted') {
  return `<span class="badge badge--${tone}">${escapeHtml(text)}</span>`;
}

/** Connection state pill: ONLINE / OFFLINE / CONNECTING / ERROR / DEMO. */
export function statusPill(state, { demo = false } = {}) {
  const s = String(state || 'OFFLINE').toUpperCase();
  const map = {
    ONLINE: { tone: 'pos', label: 'ONLINE' },
    CONNECTING: { tone: 'warn', label: 'CONNECTING' },
    ERROR: { tone: 'neg', label: 'ERROR' },
    DEMO: { tone: 'warn', label: 'DEMO' },
    OFFLINE: { tone: 'muted', label: 'OFFLINE' },
  };
  const cfg = map[s] || map.OFFLINE;
  const pulse = s === 'ONLINE' || s === 'CONNECTING' ? ' dot--pulse' : '';
  return `<span class="badge badge--${cfg.tone}"><i class="dot${pulse}"></i>${cfg.label}</span>`;
}

export function stat({ label, value, tone = '', meta = '', small = false }) {
  return `
    <div class="stat">
      <div class="stat__label">${escapeHtml(label)}</div>
      <div class="stat__value ${small ? 'stat__value--sm' : ''} ${tone}">${value}</div>
      ${meta ? `<div class="stat__meta">${meta}</div>` : ''}
    </div>`;
}

export function card({ title = '', hint = '', body = '', flush = false, glow = false }) {
  const head = title
    ? `<div class="card__head"><h2 class="card__title">${escapeHtml(title)}</h2>${
        hint ? `<span class="card__hint">${hint}</span>` : ''
      }</div>`
    : '';
  return `<section class="card${flush ? ' card--flush' : ''}${glow ? ' card--glow' : ''}">${head}${body}</section>`;
}

export function banner(text, tone = 'warn', icon = '⚠️') {
  return `<div class="banner banner--${tone}"><span class="banner__icon">${icon}</span><div>${text}</div></div>`;
}

export function demoBanner(message) {
  return banner(`<strong>MODE DEMO.</strong> ${escapeHtml(message)}`, 'warn', '🧪');
}

export function empty({ icon = '📭', title = 'Belum ada data', desc = '' } = {}) {
  return `<div class="empty">
    <div class="empty__icon">${icon}</div>
    <div class="empty__title">${escapeHtml(title)}</div>
    ${desc ? `<div>${escapeHtml(desc)}</div>` : ''}
  </div>`;
}

export function kv(label, value, valueClass = '') {
  return `<div class="kv"><span class="kv__k">${escapeHtml(label)}</span><span class="kv__v ${valueClass}">${value}</span></div>`;
}

export function chips(items, activeId, { dataAttr = 'data-chip' } = {}) {
  return `<div class="chips">${items
    .map(
      (item) =>
        `<button class="chip${item.id === activeId ? ' chip--active' : ''}" ${dataAttr}="${escapeHtml(
          item.id
        )}">${escapeHtml(item.label)}</button>`
    )
    .join('')}</div>`;
}

export function meter(pct, label = '') {
  const safe = Math.max(0, Math.min(100, Number(pct) || 0));
  return `<div>
    ${label ? `<div class="stat__meta">${escapeHtml(label)}</div>` : ''}
    <div class="meter"><div class="meter__fill" style="transform:scaleX(${(safe / 100).toFixed(3)})"></div></div>
  </div>`;
}

export function skeletonRows(n = 3) {
  return `<div style="padding:14px;display:flex;flex-direction:column;gap:10px">
    ${Array.from({ length: n })
      .map(() => '<div class="skeleton" style="height:16px"></div>')
      .join('')}
  </div>`;
}

export function logLine(log) {
  const level = String(log?.level || 'info').toLowerCase();
  const tone = level === 'error' ? 'neg' : level === 'warn' ? 'warn' : 'neutral';
  return `<div class="log-line">
    <span class="log-line__ts">${escapeHtml(timeAgo(log?.ts))}</span>
    <span class="log-line__msg ${tone}">${escapeHtml(log?.message || '')}</span>
  </div>`;
}

/** One scanner signal, rendered from backend fields only. */
export function signalCard(signal, { showDemo = false } = {}) {
  const dir = String(signal?.direction || '').toUpperCase();
  const dirTone = directionClass(dir);
  const q = qualityClass(signal?.quality);
  const score = isNum(signal?.score) ? Math.round(signal.score) : null;
  const scoreTone = score == null ? 'neutral' : score >= 75 ? 'pos' : score >= 50 ? 'warn' : 'neg';
  const reasons = Array.isArray(signal?.reasons) ? signal.reasons.slice(0, 6) : [];

  return `<article class="signal">
    <div class="signal__top">
      <span class="signal__symbol">${escapeHtml(signal?.symbol || '—')}</span>
      <span class="signal__tf">${escapeHtml(signal?.timeframe || '—')}</span>
      <span class="badge badge--${dirTone === 'pos' ? 'pos' : dirTone === 'neg' ? 'neg' : 'muted'}">${escapeHtml(
    dir || '—'
  )}</span>
      ${q !== 'unknown' ? badge(String(signal.quality).toUpperCase(), q === 'high' ? 'pos' : q === 'medium' ? 'info' : q === 'low' ? 'warn' : 'neg') : ''}
      ${showDemo ? DEMO_CHIP : ''}
      <span class="signal__score ${scoreTone}">${score == null ? '—' : `${score}/100`}</span>
    </div>
    <div class="signal__grid">
      <div class="signal__cell"><div class="signal__cell-label">Price</div><div class="signal__cell-value">${fmtPrice(
        signal?.price
      )}</div></div>
      <div class="signal__cell"><div class="signal__cell-label">Entry</div><div class="signal__cell-value">${fmtPrice(
        signal?.entry
      )}</div></div>
      <div class="signal__cell"><div class="signal__cell-label">SL</div><div class="signal__cell-value neg">${fmtPrice(
        signal?.stopLoss
      )}</div></div>
      <div class="signal__cell"><div class="signal__cell-label">TP</div><div class="signal__cell-value pos">${fmtPrice(
        signal?.takeProfit
      )}</div></div>
      <div class="signal__cell"><div class="signal__cell-label">R:R</div><div class="signal__cell-value">${
        isNum(signal?.rr) ? `1:${signal.rr.toFixed(2)}` : '—'
      }</div></div>
      <div class="signal__cell"><div class="signal__cell-label">Time</div><div class="signal__cell-value">${escapeHtml(
        timeAgo(signal?.createdAt)
      )}</div></div>
    </div>
    ${
      reasons.length
        ? `<div class="signal__reasons">${reasons
            .map((r) => `<span class="reason">${escapeHtml(r)}</span>`)
            .join('')}</div>`
        : ''
    }
  </article>`;
}

/** Position row for paper trading. */
export function positionRow(p, { demo = false } = {}) {
  const pnl = p?.floatingPnl;
  return `<div class="row">
    <div class="row__main">
      <div class="row__title">
        <span>${escapeHtml(p?.symbol || '—')}</span>
        ${badge(String(p?.side || '—').toUpperCase(), String(p?.side).toUpperCase().includes('SELL') ? 'neg' : 'pos')}
        ${demo ? DEMO_CHIP : ''}
      </div>
      <div class="row__sub">Entry ${fmtPrice(p?.entry)} · Size ${isNum(p?.size) ? p.size : '—'} · SL ${fmtPrice(
    p?.stopLoss
  )} · TP ${fmtPrice(p?.takeProfit)}</div>
    </div>
    <div class="row__end">
      <div class="row__value ${pnlClass(pnl)}">${fmtUsd(pnl, { sign: true })}</div>
      <div class="row__meta">${escapeHtml(timeAgo(p?.openedAt))}</div>
    </div>
  </div>`;
}

/** Closed trade row for history. */
export function tradeRow(t, { demo = false } = {}) {
  const pnl = t?.pnl;
  return `<div class="row">
    <div class="row__main">
      <div class="row__title">
        <span>${escapeHtml(t?.symbol || '—')}</span>
        ${badge(String(t?.side || '—').toUpperCase(), String(t?.side).toUpperCase().includes('SELL') ? 'neg' : 'pos')}
        ${demo ? DEMO_CHIP : ''}
      </div>
      <div class="row__sub">${fmtPrice(t?.entry)} → ${fmtPrice(t?.exit)} · fee ${fmtUsd(t?.fee)} · ${escapeHtml(
    t?.reason || '—'
  )}</div>
    </div>
    <div class="row__end">
      <div class="row__value ${pnlClass(pnl)}">${fmtUsd(pnl, { sign: true })}</div>
      <div class="row__meta">${escapeHtml(timeAgo(t?.closedAt))}</div>
    </div>
  </div>`;
}

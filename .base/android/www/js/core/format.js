/** Formatting helpers shared by every screen. */

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isNum(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Price with sensible precision for both BTC-scale and micro-cap coins. */
export function fmtPrice(value) {
  if (!isNum(value)) return '—';
  const abs = Math.abs(value);
  if (abs === 0) return '0';
  if (abs >= 1000) return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (abs >= 1) return value.toFixed(3);
  if (abs >= 0.01) return value.toFixed(4);
  if (abs >= 0.0001) return value.toFixed(6);
  return value.toFixed(8);
}

export function fmtUsd(value, { sign = false, compact = false } = {}) {
  if (!isNum(value)) return '—';
  const abs = Math.abs(value);
  let body;
  if (compact && abs >= 1_000_000) body = `${(abs / 1_000_000).toFixed(2)}M`;
  else if (compact && abs >= 1_000) body = `${(abs / 1_000).toFixed(1)}K`;
  else body = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const prefix = sign ? (value > 0 ? '+' : value < 0 ? '-' : '') : value < 0 ? '-' : '';
  return `${prefix}$${body}`;
}

export function fmtPct(value, { digits = 2, sign = false } = {}) {
  if (!isNum(value)) return '—';
  const prefix = sign && value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(digits)}%`;
}

/** Accepts 0..1 ratios or 0..100 percentages depending on `asRatio`. */
export function fmtRatioPct(value, { asRatio = true, digits = 1 } = {}) {
  if (!isNum(value)) return '—';
  return `${(asRatio ? value * 100 : value).toFixed(digits)}%`;
}

export function fmtInt(value) {
  if (!isNum(value)) return '—';
  return Math.round(value).toLocaleString('en-US');
}

/** Profit/loss CSS class. */
export function pnlClass(value) {
  if (!isNum(value) || value === 0) return 'neutral';
  return value > 0 ? 'pos' : 'neg';
}

export function timeAgo(ts) {
  if (!ts) return '—';
  const ms = typeof ts === 'number' ? ts : Date.parse(ts);
  if (!Number.isFinite(ms)) return '—';
  const diff = Date.now() - ms;
  if (diff < 0) return 'just now';
  const s = Math.floor(diff / 1000);
  if (s < 45) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ms).toLocaleDateString();
}

export function fmtClock(ts) {
  const ms = typeof ts === 'number' ? ts : Date.parse(ts);
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function fmtDateTime(ts) {
  const ms = typeof ts === 'number' ? ts : Date.parse(ts);
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Normalizes backend quality labels: HIGH QUALITY / MEDIUM / LOW / REJECTED. */
export function qualityClass(quality) {
  const q = String(quality || '').toUpperCase();
  if (q.includes('HIGH')) return 'high';
  if (q.includes('MEDIUM')) return 'medium';
  if (q.includes('LOW')) return 'low';
  if (q.includes('REJECT')) return 'rejected';
  return 'unknown';
}

export function directionClass(direction) {
  const d = String(direction || '').toUpperCase();
  if (d.includes('BUY') || d.includes('LONG')) return 'pos';
  if (d.includes('SELL') || d.includes('SHORT')) return 'neg';
  return 'neutral';
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function debounce(fn, wait = 250) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

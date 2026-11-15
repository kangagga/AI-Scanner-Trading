/**
 * Minimal canvas chart engine (line / bars / donut).
 * No external library: keeps the app dependency-free and works offline.
 * Every draw function returns false when there is nothing to render.
 */

const PALETTE = {
  pos: '#16d99b',
  neg: '#ff4d6a',
  warn: '#ffc247',
  info: '#4aa8ff',
  grid: 'rgba(255,255,255,0.06)',
  axis: '#64768f',
  text: '#9aabc7',
};

function setup(canvas, cssHeight) {
  if (!canvas) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const width = canvas.clientWidth || canvas.parentElement?.clientWidth || 320;
  const height = cssHeight || Number(canvas.dataset.height) || 160;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
}

function niceBounds(values) {
  const nums = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (!nums.length) return null;
  let min = Math.min(...nums);
  let max = Math.max(...nums);
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 1;
    min -= pad;
    max += pad;
  }
  const pad = (max - min) * 0.12;
  return { min: min - pad, max: max + pad };
}

function drawGrid(ctx, width, height, pad, bounds, ticks = 4) {
  ctx.save();
  ctx.strokeStyle = PALETTE.grid;
  ctx.lineWidth = 1;
  ctx.font = '9px ui-monospace, monospace';
  ctx.fillStyle = PALETTE.axis;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  for (let i = 0; i <= ticks; i += 1) {
    const y = pad.top + ((height - pad.top - pad.bottom) * i) / ticks;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();

    const value = bounds.max - ((bounds.max - bounds.min) * i) / ticks;
    ctx.fillText(formatAxis(value), width - pad.right + 2, y);
  }
  ctx.restore();
}

function formatAxis(value) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  if (abs >= 10) return value.toFixed(0);
  if (abs >= 1) return value.toFixed(1);
  return value.toFixed(2);
}

/**
 * Line/area chart.
 * @param {HTMLCanvasElement} canvas
 * @param {{series: Array<{label?:string, color?:string, values:number[]}>, height?:number, fill?:boolean}} opts
 */
export function lineChart(canvas, { series = [], height = 170, fill = true, labels = [] } = {}) {
  const view = setup(canvas, height);
  if (!view) return false;

  const usable = series.filter((s) => Array.isArray(s.values) && s.values.length > 1);
  if (!usable.length) return false;

  const { ctx, width } = view;
  const pad = { top: 12, right: 40, bottom: 18, left: 8 };
  const bounds = niceBounds(usable.flatMap((s) => s.values));
  if (!bounds) return false;

  drawGrid(ctx, width, view.height, pad, bounds);

  const plotW = width - pad.left - pad.right;
  const plotH = view.height - pad.top - pad.bottom;
  const maxLen = Math.max(...usable.map((s) => s.values.length));

  const toX = (i) => pad.left + (plotW * i) / Math.max(1, maxLen - 1);
  const toY = (v) => pad.top + plotH * (1 - (v - bounds.min) / (bounds.max - bounds.min));

  usable.forEach((s, si) => {
    const color = s.color || [PALETTE.pos, PALETTE.info, PALETTE.warn][si % 3];
    const pts = s.values.map((v, i) => [toX(i), toY(v)]);

    if (fill && si === 0) {
      const grad = ctx.createLinearGradient(0, pad.top, 0, view.height - pad.bottom);
      grad.addColorStop(0, hexToRgba(color, 0.26));
      grad.addColorStop(1, hexToRgba(color, 0));
      ctx.beginPath();
      ctx.moveTo(pts[0][0], view.height - pad.bottom);
      pts.forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.lineTo(pts[pts.length - 1][0], view.height - pad.bottom);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }

    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    const [lx, ly] = pts[pts.length - 1];
    ctx.beginPath();
    ctx.arc(lx, ly, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });

  if (labels.length) {
    ctx.save();
    ctx.font = '9px ui-monospace, monospace';
    ctx.fillStyle = PALETTE.axis;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(String(labels[0]), pad.left, view.height - pad.bottom + 4);
    ctx.textAlign = 'right';
    ctx.fillText(String(labels[labels.length - 1]), width - pad.right, view.height - pad.bottom + 4);
    ctx.restore();
  }

  return true;
}

/** Vertical bars, positive/negative colored. */
export function barChart(canvas, { values = [], height = 150, labels = [] } = {}) {
  const view = setup(canvas, height);
  if (!view) return false;
  const nums = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (!nums.length) return false;

  const { ctx, width } = view;
  const pad = { top: 12, right: 8, bottom: 18, left: 8 };
  const plotW = width - pad.left - pad.right;
  const plotH = view.height - pad.top - pad.bottom;

  const maxAbs = Math.max(...nums.map((v) => Math.abs(v)), 1);
  const zeroY = pad.top + plotH / 2;

  ctx.save();
  ctx.strokeStyle = PALETTE.grid;
  ctx.beginPath();
  ctx.moveTo(pad.left, zeroY);
  ctx.lineTo(width - pad.right, zeroY);
  ctx.stroke();
  ctx.restore();

  const slot = plotW / nums.length;
  const barW = Math.max(3, Math.min(22, slot * 0.58));

  nums.forEach((v, i) => {
    const h = Math.max(2, (Math.abs(v) / maxAbs) * (plotH / 2 - 4));
    const x = pad.left + slot * i + (slot - barW) / 2;
    const y = v >= 0 ? zeroY - h : zeroY;
    ctx.fillStyle = v >= 0 ? PALETTE.pos : PALETTE.neg;
    ctx.globalAlpha = 0.9;
    roundRect(ctx, x, y, barW, h, Math.min(3, barW / 2));
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  if (labels.length) {
    ctx.save();
    ctx.font = '9px ui-monospace, monospace';
    ctx.fillStyle = PALETTE.axis;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const step = Math.ceil(nums.length / 6);
    nums.forEach((_, i) => {
      if (i % step) return;
      const label = labels[i];
      if (label === undefined) return;
      ctx.fillText(String(label), pad.left + slot * i + slot / 2, view.height - pad.bottom + 4);
    });
    ctx.restore();
  }

  return true;
}

/** Donut with center label. slices: [{label, value, color}] */
export function donutChart(canvas, { slices = [], height = 160, centerLabel = '', centerSub = '' } = {}) {
  const view = setup(canvas, height);
  if (!view) return false;
  const usable = slices.filter((s) => Number(s.value) > 0);
  const total = usable.reduce((sum, s) => sum + Number(s.value), 0);
  if (!total) return false;

  const { ctx, width } = view;
  const cx = width / 2;
  const cy = view.height / 2;
  const radius = Math.min(width, view.height) / 2 - 10;
  const inner = radius * 0.62;

  let angle = -Math.PI / 2;
  usable.forEach((s, i) => {
    const sweep = (Number(s.value) / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, angle, angle + sweep);
    ctx.arc(cx, cy, inner, angle + sweep, angle, true);
    ctx.closePath();
    ctx.fillStyle = s.color || [PALETTE.pos, PALETTE.neg, PALETTE.warn, PALETTE.info][i % 4];
    ctx.fill();
    angle += sweep;
  });

  if (centerLabel) {
    ctx.save();
    ctx.fillStyle = '#e8eefc';
    ctx.font = '700 17px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(centerLabel, cx, cy - (centerSub ? 7 : 0));
    if (centerSub) {
      ctx.fillStyle = PALETTE.axis;
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(centerSub, cx, cy + 11);
    }
    ctx.restore();
  }

  return true;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hexToRgba(hex, alpha) {
  const clean = String(hex).replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export const CHART_COLORS = PALETTE;

/** Redraw all canvases on resize/orientation change. */
export function onResize(callback) {
  let raf = null;
  const handler = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(callback);
  };
  window.addEventListener('resize', handler);
  window.addEventListener('orientationchange', handler);
  return () => {
    window.removeEventListener('resize', handler);
    window.removeEventListener('orientationchange', handler);
  };
}

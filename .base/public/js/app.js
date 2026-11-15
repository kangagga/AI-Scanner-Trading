/**
 * App bootstrap: router, render loop, shell events.
 * Screens are plain modules exporting render() (and optionally bind/afterRender).
 */

import { state, subscribe, boot, disconnectSocket } from './core/store.js';
import { renderTopbar, renderBottomNav, renderMoreSheet, renderToast, bindShell, routeMeta } from './ui/shell.js';
import { onResize } from './ui/charts.js';

import * as dashboard from './screens/dashboard.js';
import * as scanner from './screens/scanner.js';
import * as signals from './screens/signals.js';
import * as paper from './screens/paper.js';
import * as market from './screens/market.js';
import * as history from './screens/history.js';
import * as performance from './screens/performance.js';
import * as strategy from './screens/strategy.js';
import * as monitor from './screens/monitor.js';
import * as settings from './screens/settings.js';

const SCREENS = { dashboard, scanner, signals, paper, market, history, performance, strategy, monitor, settings };

const VALID = new Set(Object.keys(SCREENS));
let moreOpen = false;
let rendering = false;

function currentRoute() {
  const hash = location.hash.replace(/^#\/?/, '').split('?')[0];
  return VALID.has(hash) ? hash : 'dashboard';
}

function navigate(route) {
  if (!VALID.has(route)) route = 'dashboard';
  moreOpen = false;
  if (currentRoute() === route) {
    render();
  } else {
    location.hash = `#/${route}`;
  }
}

function render() {
  if (rendering) return;
  rendering = true;

  const route = currentRoute();
  const screen = SCREENS[route];
  const app = document.getElementById('app');
  const scrollY = window.scrollY;

  let body = '';
  try {
    body = screen.render();
  } catch (err) {
    console.error(`[app] screen "${route}" failed to render`, err);
    body = `<div class="screen"><div class="banner banner--neg">
      <span class="banner__icon">⛔</span>
      <div><strong>Layar gagal dirender.</strong> ${String(err.message || err)}</div>
    </div></div>`;
  }

  app.innerHTML = `
    ${renderTopbar(route)}
    <main class="content" id="screen-root">${body}</main>
    ${renderBottomNav(route)}
    ${moreOpen ? renderMoreSheet(route) : ''}
    ${renderToast()}
  `;

  document.title = `AI Scanner · ${routeMeta(route).label}`;

  const root = document.getElementById('screen-root');
  try {
    screen.bind?.(root);
    screen.afterRender?.(root);
  } catch (err) {
    console.error(`[app] bind/afterRender for "${route}" failed`, err);
  }

  window.scrollTo(0, Math.min(scrollY, document.body.scrollHeight));
  rendering = false;
}

// ── Global events ────────────────────────────────────────────────────────
bindShell({
  onNavigate: navigate,
  onToggleMore: (open) => {
    moreOpen = open;
    render();
  },
});

window.addEventListener('hashchange', render);

document.addEventListener('app:rerender', render);

// Re-render on state changes, but coalesce bursts (polling updates several
// resources at once) to avoid layout thrash.
let pending = null;
subscribe(() => {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = null;
    render();
  });
});

onResize(() => {
  const route = currentRoute();
  const screen = SCREENS[route];
  const root = document.getElementById('screen-root');
  if (root) screen.afterRender?.(root);
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) render();
});

window.addEventListener('beforeunload', disconnectSocket);

// ── Service worker (offline shell) ───────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('[app] service worker registration failed', err);
    });
  });
}

// ── Start ────────────────────────────────────────────────────────────────
if (!location.hash) location.hash = '#/dashboard';
render();
boot().catch((err) => console.error('[app] boot failed', err));

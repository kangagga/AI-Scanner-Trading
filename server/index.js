/**
 * AI SCANNER TRADING — Control Center bridge server.
 *
 * This process does NOT scan markets, hold strategies, or store trades.
 * It only:
 *   1. serves the static control-center app,
 *   2. optionally relays requests to your EXISTING bot backend (proxy mode),
 *      so the phone app never needs CORS changes on the old bot,
 *   3. exposes /api/health + /api/bridge so the app can state honestly
 *      whether a real backend is reachable.
 *
 * The old bot stays the single source of truth. Nothing here writes to it
 * except the control actions you explicitly trigger from the UI.
 */
'use strict';

const path = require('node:path');
const express = require('express');

const APP_VERSION = require('../package.json').version;
const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || '127.0.0.1';

// Optional: set BOT_BASE_URL to your legacy bot (Termux or cloud), e.g.
//   BOT_BASE_URL=http://127.0.0.1:8080 BOT_TOKEN=secret npm start
const BOT_BASE_URL = String(process.env.BOT_BASE_URL || '').replace(/\/+$/, '');
const BOT_TOKEN = String(process.env.BOT_TOKEN || '');
const UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS || 15000);

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

/** Health of the bridge itself (not of the bot). */
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'ai-scanner-trading-control-center',
    version: APP_VERSION,
    time: Date.now(),
    uptimeSec: Math.round(process.uptime()),
    proxyConfigured: Boolean(BOT_BASE_URL),
  });
});

/** Tells the client which connection modes it may use. */
app.get('/api/bridge', (req, res) => {
  res.json({
    ok: true,
    version: APP_VERSION,
    proxyAvailable: Boolean(BOT_BASE_URL),
    // Never expose the token itself, only whether one is configured.
    tokenConfigured: Boolean(BOT_TOKEN),
    upstreamHost: BOT_BASE_URL ? safeHost(BOT_BASE_URL) : null,
    timeoutMs: UPSTREAM_TIMEOUT_MS,
  });
});

/**
 * Reverse proxy: /api/upstream/<path> -> BOT_BASE_URL/<path>
 * Lets the app talk to a bot that has no CORS headers (typical for a
 * Termux-hosted process). Enabled only when BOT_BASE_URL is set, so the
 * browser can never point this at an arbitrary host.
 */
app.use('/api/upstream', async (req, res) => {
  if (!BOT_BASE_URL) {
    return res.status(503).json({
      ok: false,
      error: 'PROXY_NOT_CONFIGURED',
      message:
        'Bridge proxy is disabled. Start the server with BOT_BASE_URL=<your bot url> or connect the app directly to the bot.',
    });
  }

  const target = BOT_BASE_URL + req.url;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const headers = { accept: 'application/json' };
    if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
    const auth = req.headers.authorization || (BOT_TOKEN ? `Bearer ${BOT_TOKEN}` : '');
    if (auth) headers.authorization = auth;

    const method = req.method.toUpperCase();
    const hasBody = !['GET', 'HEAD'].includes(method);

    const upstream = await fetch(target, {
      method,
      headers,
      body: hasBody ? JSON.stringify(req.body ?? {}) : undefined,
      signal: controller.signal,
      redirect: 'manual',
    });

    const text = await upstream.text();
    const type = upstream.headers.get('content-type') || 'application/json';
    res.status(upstream.status).type(type).send(text);
  } catch (err) {
    const aborted = err && err.name === 'AbortError';
    res.status(aborted ? 504 : 502).json({
      ok: false,
      error: aborted ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNREACHABLE',
      message: aborted
        ? `Bot backend did not answer within ${UPSTREAM_TIMEOUT_MS} ms.`
        : `Cannot reach bot backend at ${safeHost(BOT_BASE_URL)}: ${err.message}`,
    });
  } finally {
    clearTimeout(timer);
  }
});

// Static app shell.
app.use(
  express.static(PUBLIC_DIR, {
    extensions: ['html'],
    setHeaders(res, filePath) {
      if (filePath.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
    },
  })
);

// SPA fallback for client-side routes (never for /api/*).
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'NOT_FOUND', path: req.originalUrl });
});

function safeHost(url) {
  try {
    const u = new URL(url);
    return u.host;
  } catch {
    return null;
  }
}

const server = app.listen(PORT, HOST, () => {
  console.log(`[control-center] http://${HOST}:${PORT}`);
  console.log(`[control-center] proxy: ${BOT_BASE_URL ? `-> ${safeHost(BOT_BASE_URL)}` : 'disabled (no BOT_BASE_URL)'}`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
  });
}

module.exports = { app, server };

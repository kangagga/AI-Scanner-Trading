/** Settings — backend connection, token, demo toggle, safety info. */

import { state, updateConnection, testConnection, refreshAll, connectSocket, toast } from '../core/store.js';
import { card, banner, kv, statusPill } from '../ui/components.js';
import { escapeHtml, timeAgo } from '../core/format.js';
import { PATHS } from '../core/api.js';

export const meta = { id: 'settings', title: 'Settings' };

export function render() {
  const c = state.conn;
  const bridge = state.bridge;
  const conn = state.connection || {};

  return `<div class="screen">
    ${card({
      title: 'Koneksi Backend Bot',
      body: `
        <div class="field">
          <label class="field__label" for="mode">Mode koneksi</label>
          <select class="select" id="mode">
            <option value="direct" ${c.mode === 'direct' ? 'selected' : ''}>Direct — HP terhubung langsung ke bot</option>
            <option value="proxy" ${c.mode === 'proxy' ? 'selected' : ''}>Proxy — lewat bridge server ini</option>
          </select>
          <div class="field__hint">${
            c.mode === 'proxy'
              ? `Proxy ${bridge?.proxyAvailable ? 'aktif' : 'belum aktif'} — jalankan server dengan <span class="mono">BOT_BASE_URL</span>.`
              : 'Gunakan direct jika bot berjalan di Termux/PC yang sama jaringannya.'
          }</div>
        </div>

        <div class="field">
          <label class="field__label" for="baseUrl">URL backend bot</label>
          <input class="input" id="baseUrl" type="url" inputmode="url" autocomplete="off" spellcheck="false"
            placeholder="http://192.168.1.10:8080" value="${escapeHtml(c.baseUrl)}" ${
    c.mode === 'proxy' ? 'disabled' : ''
  } />
          <div class="field__hint">Contoh Termux: <span class="mono">http://127.0.0.1:8080</span> ·
          Cloud: <span class="mono">https://bot.domain.com</span></div>
        </div>

        <div class="field">
          <label class="field__label" for="wsUrl">WebSocket URL (opsional)</label>
          <input class="input" id="wsUrl" type="url" inputmode="url" autocomplete="off" spellcheck="false"
            placeholder="ws://192.168.1.10:8080/ws" value="${escapeHtml(c.wsUrl)}" />
          <div class="field__hint">Kosongkan untuk diturunkan otomatis dari URL backend.</div>
        </div>

        <div class="field">
          <label class="field__label" for="token">Token akses (opsional)</label>
          <input class="input" id="token" type="password" autocomplete="off" spellcheck="false"
            placeholder="Bearer token untuk endpoint kontrol" value="${escapeHtml(c.token)}" />
          <div class="field__hint">Disimpan hanya di perangkat ini (localStorage). Tidak pernah dikirim ke mana pun
          selain backend bot Anda.</div>
        </div>

        <div class="field">
          <label class="field__label" for="timeoutSec">Timeout request (detik)</label>
          <input class="input" id="timeoutSec" type="number" min="3" max="60" step="1" value="${Number(
            c.timeoutSec
          ) || 12}" />
        </div>

        <div class="switch-row">
          <div class="switch-row__text">
            <div class="switch-row__title">Izinkan data demo</div>
            <div class="switch-row__desc">Tampilkan data contoh berlabel DEMO saat backend tidak tersedia.
            Kontrol bot tetap nonaktif.</div>
          </div>
          <button class="switch ${c.allowDemo ? 'switch--on' : ''}" id="allowDemo" aria-pressed="${
    c.allowDemo ? 'true' : 'false'
  }"></button>
        </div>

        <div class="btn-row" style="margin-top:14px">
          <button class="btn btn--primary" id="save-conn">Simpan</button>
          <button class="btn" id="test-conn">Test koneksi</button>
        </div>
      `,
    })}

    ${card({
      title: 'Status Saat Ini',
      body: [
        ['Koneksi', statusPill(conn.state || 'OFFLINE')],
        ['Pesan', escapeHtml(conn.message || '—')],
        ['Latency', conn.latencyMs != null ? `${conn.latencyMs} ms` : '—'],
        ['Terakhir dicek', escapeHtml(timeAgo(conn.checkedAt))],
        ['WebSocket', escapeHtml(state.socket?.state || 'closed')],
        ['Bridge proxy', bridge ? (bridge.proxyAvailable ? 'tersedia' : 'tidak aktif') : 'tidak diketahui'],
      ]
        .map(([k, v]) => kv(k, v))
        .join(''),
    })}

    ${card({
      title: 'Keamanan & Batasan',
      body: `
        <div class="kv"><span class="kv__k">Mode transaksi</span><span class="kv__v pos">PAPER TRADING</span></div>
        <div class="kv"><span class="kv__k">Bitget mirror</span><span class="kv__v">FALSE</span></div>
        <div class="kv"><span class="kv__k">Order riil</span><span class="kv__v neg">TIDAK ADA</span></div>
        <div class="kv"><span class="kv__k">Database trading</span><span class="kv__v">milik bot lama</span></div>
        <div class="stat__meta" style="margin-top:10px">
          Aplikasi tidak menyimpan password/API secret bot, tidak mereset database, dan tidak mengubah strategi.
          Token yang Anda isi hanya dipakai sebagai header Authorization ke backend Anda sendiri.
        </div>
      `,
    })}

    ${card({
      title: 'Endpoint yang Digunakan',
      hint: 'read-only',
      body: `<div class="mono" style="line-height:1.9;color:var(--text-dim)">
        ${Object.entries(PATHS)
          .map(([k, v]) => `${k.padEnd(12, ' ')} ${escapeHtml(v)}`)
          .join('<br>')}
      </div>
      <div class="stat__meta" style="margin-top:10px">Ubah pemetaan di <span class="mono">public/js/core/api.js</span>
      jika bot Anda memakai path berbeda.</div>`,
    })}

    ${banner(
      'APK Android belum di-build: sandbox ini tidak memiliki Android SDK/Gradle. Lihat <span class="mono">docs/APK_BUILD.md</span> untuk langkah membungkus aplikasi ini menjadi APK dengan Capacitor.',
      'info',
      '📦'
    )}
  </div>`;
}

export function bind(root) {
  const $ = (sel) => root.querySelector(sel);

  $('#mode')?.addEventListener('change', (e) => {
    updateConnection({ mode: e.target.value });
    document.dispatchEvent(new CustomEvent('app:rerender'));
  });

  $('#allowDemo')?.addEventListener('click', () => {
    const next = !state.conn.allowDemo;
    updateConnection({ allowDemo: next });
    toast(next ? 'Data demo diizinkan (berlabel DEMO).' : 'Data demo dimatikan.', 'info', 2600);
    refreshAll({ silent: true });
    document.dispatchEvent(new CustomEvent('app:rerender'));
  });

  const collect = () => ({
    baseUrl: ($('#baseUrl')?.value || '').trim(),
    wsUrl: ($('#wsUrl')?.value || '').trim(),
    token: ($('#token')?.value || '').trim(),
    timeoutSec: Math.max(3, Math.min(60, Number($('#timeoutSec')?.value) || 12)),
  });

  $('#save-conn')?.addEventListener('click', async () => {
    const patch = collect();
    if (patch.baseUrl && !/^https?:\/\//i.test(patch.baseUrl)) {
      toast('URL harus diawali http:// atau https://', 'error', 5000);
      return;
    }
    updateConnection(patch);
    toast('Konfigurasi disimpan. Menguji koneksi…', 'info', 2600);
    await testConnection();
    connectSocket();
    await refreshAll({ silent: true });
    document.dispatchEvent(new CustomEvent('app:rerender'));
  });

  $('#test-conn')?.addEventListener('click', async () => {
    const patch = collect();
    updateConnection(patch);
    await testConnection();
    document.dispatchEvent(new CustomEvent('app:rerender'));
  });
}

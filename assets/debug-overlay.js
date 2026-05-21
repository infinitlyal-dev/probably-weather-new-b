/* Probably Weather — Diagnostic Overlay (read-only)
   Activated by ?debug=1 in URL OR localStorage 'pw-debug' = '1'.
   Renders a fixed red banner at top of page with diagnostic state,
   refreshed every 500ms. Does NOT modify install flow or any other
   app behavior — purely observational, used to diagnose real-iPhone
   install failures that aren't reproducible without device-side
   visibility. */

import { detectPlatform } from './install.js';

const URL_DEBUG = new URLSearchParams(window.location.search).get('debug') === '1';
const LS_DEBUG = (() => { try { return localStorage.getItem('pw-debug') === '1'; } catch { return false; } })();

if (URL_DEBUG || LS_DEBUG) {
  // Persist the flag if the user entered via ?debug=1 — the overlay then
  // survives reloads / cross-app handoffs without re-typing the param.
  if (URL_DEBUG) {
    try { localStorage.setItem('pw-debug', '1'); } catch {}
  }
  // Defer to ensure document.body exists.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDebugOverlay, { once: true });
  } else {
    initDebugOverlay();
  }
}

function initDebugOverlay() {
  const overlay = buildOverlay();
  document.body.appendChild(overlay);

  // Track last user gesture independently — don't piggyback on install.js's
  // own interaction listener, which is consumed once.
  let lastGestureAt = null;
  const stamp = () => { lastGestureAt = Date.now(); };
  ['pointerdown', 'touchstart', 'keydown', 'click'].forEach((ev) => {
    window.addEventListener(ev, stamp, { capture: true, passive: true });
  });

  // Read CACHE_VERSION from sw.js once at load. The browser bypasses the
  // service worker for sw.js itself, so this hits the network directly.
  let cacheVersion = '(loading)';
  fetch('/sw.js', { cache: 'no-store' })
    .then((r) => r.text())
    .then((t) => {
      const m = t.match(/CACHE_VERSION\s*=\s*'([^']+)'/);
      cacheVersion = m ? m[1] : '(not found in sw.js)';
    })
    .catch(() => { cacheVersion = '(fetch failed)'; });

  // Track navigator.serviceWorker controller state — useful to know whether
  // the running SW is the new one.
  let swControllerScript = '(none)';
  if ('serviceWorker' in navigator) {
    if (navigator.serviceWorker.controller) {
      swControllerScript = navigator.serviceWorker.controller.scriptURL || '(controller, no url)';
    }
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      swControllerScript = navigator.serviceWorker.controller?.scriptURL || '(claimed)';
    });
  } else {
    swControllerScript = '(no SW support)';
  }

  // Close button — lets the user dismiss the overlay without devtools.
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '× close debug';
  closeBtn.setAttribute('aria-label', 'Close debug overlay');
  Object.assign(closeBtn.style, {
    position: 'absolute',
    top: '4px',
    right: '6px',
    background: '#ffffff',
    color: '#cc0000',
    border: 'none',
    borderRadius: '4px',
    fontFamily: 'inherit',
    fontSize: '11px',
    fontWeight: '700',
    padding: '3px 6px',
    cursor: 'pointer',
  });
  closeBtn.addEventListener('click', () => {
    try { localStorage.removeItem('pw-debug'); } catch {}
    overlay.remove();
  });
  overlay.appendChild(closeBtn);

  const pre = document.createElement('pre');
  Object.assign(pre.style, {
    margin: '0',
    padding: '0',
    color: '#ffffff',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    lineHeight: '1.35',
    whiteSpace: 'pre',
    overflowX: 'auto',
    paddingRight: '110px', // leave room for the close button
  });
  overlay.appendChild(pre);

  function refresh() {
    const ua = navigator.userAgent || '';
    const platform = detectPlatform(ua);
    const standaloneMatch = !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    const iosStandalone = !!(window.navigator && window.navigator.standalone === true);
    const standalone = standaloneMatch || iosStandalone;

    const banner = document.getElementById('installBanner');
    const iosModal = document.getElementById('iosInstallModal');
    const chromeModal = document.getElementById('iosChromeModal');

    const fs = safeGet('pw_install_first_seen');
    const elapsed = fs ? (Date.now() - Number(fs)) : null;
    // Mirrors install.js — banner appears on the timer alone, no
    // interaction gesture required. ENGAGEMENT_MS is now 1500ms (was 10s).
    const ENGAGEMENT_MS = 1500;
    const engagementFired = !!(elapsed !== null && elapsed >= ENGAGEMENT_MS);

    // Banner / body classList — distinguishes hypotheses about why
    // display:none persists. If body has 'standalone-mode', the
    // !important CSS rule wins; if banner still has 'hidden', showBanner
    // never ran. Sentinel set by install.js init reveals whether init
    // completed, took the standalone early-return, or never ran at all.
    const bodyClasses = document.body && document.body.className
      ? document.body.className
      : '(empty)';
    const bannerClasses = banner && banner.className
      ? banner.className
      : '(empty)';
    const installInit = (typeof window.__pwInstallInit === 'string'
      ? window.__pwInstallInit
      : 'undefined (init never ran)');

    // Layer A/B (Bug 1): weather confidence register. __PW_LAST_NORM is set by
    // app.js on every render; conditionConfidence carries the fog-detector audit.
    const pwNorm = window.__PW_LAST_NORM || null;
    const cc = pwNorm && pwNorm.conditionConfidence;
    const fog = cc && cc.fogSignal;
    const weatherLines = pwNorm ? [
      `weather confidence: ${(pwNorm.confidence || 'n/a').toUpperCase()}`,
      `  ensemble→final: ${cc ? `${cc.ensembleVote} → ${cc.finalCondition}` : 'n/a'}`,
      `  detector: ${cc ? cc.detectorVerdict : 'n/a'}${fog ? ` (vis ${fog.visKm}km, RH ${fog.humidity}%, dewΔ ${fog.dewSpread}°C)` : ''}`,
      `  source agreement: ${cc ? cc.sourceAgreement : 'n/a'}  fogTrend: ${cc ? cc.fogTrendIncoming : 'n/a'}`,
      `  copy register: ${pwNorm.confidence === 'low' ? 'LOW-CONFIDENCE' : 'HIGH-CONFIDENCE'}`,
    ] : ['weather confidence: (no payload yet)'];

    const lines = [
      ...weatherLines,
      `href: ${window.location.href}`,
      `UA: ${ua.slice(0, 60)}${ua.length > 60 ? '…' : ''}`,
      `platform: ${platform}`,
      `SW cache: ${cacheVersion}`,
      `SW controller: ${truncate(swControllerScript, 60)}`,
      `standalone: ${standalone} (mm:${standaloneMatch} ios:${iosStandalone})`,
      `body classes: ${bodyClasses}`,
      `installBanner classes: ${bannerClasses}`,
      `install init: ${installInit}`,
      `installBanner: DOM=${!!banner} offsetParent=${describeOffsetParent(banner)} display=${cssDisplay(banner)} visible=${reallyVisible(banner)}`,
      `iosInstallModal: DOM=${!!iosModal} offsetParent=${describeOffsetParent(iosModal)} display=${cssDisplay(iosModal)} visible=${reallyVisible(iosModal)}`,
      `iosChromeModal: DOM=${!!chromeModal} offsetParent=${describeOffsetParent(chromeModal)} display=${cssDisplay(chromeModal)} visible=${reallyVisible(chromeModal)}`,
      `engagement fired: ${engagementFired} (elapsed ${elapsed === null ? 'n/a' : elapsed + 'ms'} / threshold ${ENGAGEMENT_MS}ms)`,
      `last gesture: ${lastGestureAt ? `${new Date(lastGestureAt).toISOString().slice(11, 23)} (${Date.now() - lastGestureAt}ms ago)` : 'never'}`,
      `pw-* localStorage: ${listPwKeys()}`,
      `now: ${new Date().toISOString()}`,
    ];

    pre.textContent = lines.join('\n');
  }

  refresh();
  setInterval(refresh, 500);
}

function reallyVisible(el) {
  if (!el) return false;
  const cs = window.getComputedStyle(el);
  if (cs.display === 'none') return false;
  if (cs.visibility === 'hidden') return false;
  if (parseFloat(cs.opacity || '1') === 0) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function describeOffsetParent(el) {
  if (!el) return 'n/a';
  // Note: for position:fixed elements, offsetParent is null per spec
  // regardless of whether the element is visible. So this metric is
  // unreliable for the install banner / modals (all fixed). The
  // 'visible' field above uses display + bounding-rect instead.
  const op = el.offsetParent;
  if (op === null) return 'null';
  return op.tagName ? op.tagName.toLowerCase() : 'unknown';
}

function cssDisplay(el) {
  if (!el) return 'n/a';
  return window.getComputedStyle(el).display;
}

function truncate(s, n) {
  return s && s.length > n ? s.slice(0, n) + '…' : s;
}

function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }

function listPwKeys() {
  try {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith('pw_install') || k.startsWith('pw-install') || k === 'pw_installed' || k === 'pw-debug') {
        const v = localStorage.getItem(k);
        out.push(`${k}=${v && v.length > 24 ? v.slice(0, 24) + '…' : v}`);
      }
    }
    return out.length ? out.join(' | ') : '(none)';
  } catch {
    return '(unavailable)';
  }
}

function buildOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'pwDebugOverlay';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'off');
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    zIndex: '999999',
    background: '#cc0000',
    color: '#ffffff',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: '12px',
    padding: '8px 10px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
    pointerEvents: 'auto',
    userSelect: 'text',
    maxHeight: '60vh',
    overflowY: 'auto',
    boxSizing: 'border-box',
  });
  return overlay;
}

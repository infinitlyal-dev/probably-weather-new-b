// SW update propagation — every deploy reaches the user without manual
// close-and-reopen ceremony. Tests cover:
//   - sw.js install/activate plumbing (skipWaiting + clients.claim)
//   - sw.js broadcasts PW_UPDATE_AVAILABLE with version when caches replaced
//   - app.js calls registration.update() on launch + visibilitychange
//   - app.js controllerchange listener auto-reloads (with guards)
//   - app.js post-reload toast surfaces from sessionStorage marker
//   - sessionStorage guard prevents infinite reload loops
//   - ?reset=1 escape hatch is not broken by the new flow

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const swSrc = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const appSrc = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');

// ---------------------------------------------------------------------------
// sw.js plumbing
// ---------------------------------------------------------------------------

describe('sw.js — lifecycle plumbing', () => {
  it('install event calls self.skipWaiting() so the new SW activates immediately', () => {
    const installBlock = swSrc.match(/addEventListener\('install',[\s\S]*?\}\);/)?.[0] || '';
    expect(installBlock).toMatch(/self\.skipWaiting\(\)/);
  });

  it('activate event calls self.clients.claim() so the new SW takes over open clients', () => {
    const activateBlock = swSrc.match(/addEventListener\('activate',[\s\S]*?\}\)\(\)\);/)?.[0] || '';
    expect(activateBlock).toMatch(/self\.clients\.claim\(\)/);
  });

  it('activate broadcasts PW_UPDATE_AVAILABLE on any real update (prior SW existed), never on a first-ever install', () => {
    // Cache names are stable across deploys, so a routine deploy purges no caches
    // (oldCaches empty). The page still needs the belt-and-braces reload signal
    // when its controllerchange doesn't fire (iOS standalone), so the broadcast
    // is gated on hadPriorCaches (a prior SW ran here) OR oldCaches — but NOT on
    // a first-ever install (both false → no unwanted first-visit reload).
    const activateBlock = swSrc.match(/addEventListener\('activate',[\s\S]*?\}\)\(\)\);/)?.[0] || '';
    expect(activateBlock).toMatch(/if \(hadPriorCaches \|\| oldCaches\.length\)/);
    expect(activateBlock).toMatch(/postMessage\(\{[\s\S]*?type:\s*['"]PW_UPDATE_AVAILABLE['"]/);
  });

  it('PW_UPDATE_AVAILABLE message includes the new CACHE_VERSION', () => {
    const activateBlock = swSrc.match(/addEventListener\('activate',[\s\S]*?\}\)\(\)\);/)?.[0] || '';
    expect(activateBlock).toMatch(/postMessage\(\{[\s\S]*?version:\s*CACHE_VERSION/);
  });

  it('still listens for explicit SKIP_WAITING messages (manual-skip path preserved)', () => {
    expect(swSrc).toMatch(/event\.data === ['"]SKIP_WAITING['"]/);
  });
});

// ---------------------------------------------------------------------------
// app.js — setupServiceWorkerUpdates
// ---------------------------------------------------------------------------

describe('setupServiceWorkerUpdates — page-side wiring', () => {
  // Extract the function body so the assertions don't accidentally match
  // strings elsewhere in app.js.
  const fnBody = appSrc.match(/function setupServiceWorkerUpdates\(\)\s*\{[\s\S]*?\n  \}/)?.[0] ?? '';

  it('extracts the function body', () => {
    expect(fnBody).toBeTruthy();
  });

  it('bails out cleanly when serviceWorker API is unavailable', () => {
    expect(fnBody).toMatch(/if\s*\(\s*!\(\s*['"]serviceWorker['"]\s*in\s*navigator/);
  });

  it('calls registration.update() immediately after register', () => {
    // Initial update check overrides browser-side sw.js cache (up to 24h).
    // The first .update() must appear inside the register().then() block.
    const registerBlock = fnBody.match(/register\(['"]\/sw\.js['"]\)\.then\([\s\S]*?\)\.catch/)?.[0] ?? '';
    expect(registerBlock).toMatch(/registration\.update\(\)/);
  });

  it('captures the SW registration into a module-level variable so the consolidated visibilitychange handler can poll for updates', () => {
    // Phase 2 Codex S3 — replaces the previously-separate inner listener
    // (setupServiceWorkerUpdates had its own visibilitychange handler).
    // The registration is now exposed via swRegistration so the single
    // outer handler can drive both attemptRefresh and update polling.
    expect(fnBody).toMatch(/swRegistration\s*=\s*registration/);
  });

  it('the consolidated visibilitychange handler at module level polls swRegistration.update() on foreground', () => {
    // Single listener at module level handles both attemptRefresh and the
    // SW update poll. Eliminates the soft race between two separate
    // listeners that fired on the same event.
    expect(appSrc).toMatch(/addEventListener\(['"]visibilitychange['"][\s\S]{0,400}swRegistration[\s\S]{0,80}\.update\(\)/);
  });

  it('only one document.addEventListener(\'visibilitychange\', ...) registration exists', () => {
    // Negative assertion against regression to dual listeners.
    const matches = appSrc.match(/document\.addEventListener\(['"]visibilitychange['"]/g) || [];
    expect(matches.length).toBe(1);
  });

  it('listens for controllerchange', () => {
    expect(fnBody).toMatch(/addEventListener\(['"]controllerchange['"]/);
  });

  it('listens for PW_UPDATE_AVAILABLE messages from the SW', () => {
    expect(fnBody).toMatch(/event\.data\??\.type\s*!==?\s*['"]PW_UPDATE_AVAILABLE['"]/);
  });

  it('the PW_UPDATE_AVAILABLE message reload is gated on hadControllerAtStart (independent guard vs a first-visit / already-fresh reload)', () => {
    // A client with no controller at load fetched fresh code from the network,
    // so it needs no reload; and this is the second line of defence (besides the
    // SW's hadPriorCaches broadcast gate) against reloading a first-ever visit.
    const msgHandler = fnBody.match(/addEventListener\(['"]message['"][\s\S]*?\}\);/)?.[0] ?? '';
    expect(msgHandler).toMatch(/PW_UPDATE_AVAILABLE/);
    expect(msgHandler).toMatch(/if \(!hadControllerAtStart\) return/);
  });

  it('first controllerchange after a fresh install is ignored (no prior controller, not an update)', () => {
    // The hadControllerAtStart guard catches the initial-registration claim
    // so we don't reload on first-ever page load.
    expect(fnBody).toMatch(/hadControllerAtStart/);
  });

  it('reloadForUpdate function sets sessionStorage marker before reload', () => {
    expect(fnBody).toMatch(/sessionStorage\.setItem\(['"]pw_sw_just_updated['"]/);
    expect(fnBody).toMatch(/window\.location\.reload\(\)/);
  });

  it('reload-in-flight guard prevents the message handler firing reload twice', () => {
    expect(fnBody).toMatch(/reloadInFlight/);
  });

  it('post-reload acknowledgment toast reads from sessionStorage marker and clears it', () => {
    expect(fnBody).toMatch(/sessionStorage\.getItem\(['"]pw_sw_just_updated['"]/);
    expect(fnBody).toMatch(/sessionStorage\.removeItem\(['"]pw_sw_just_updated['"]/);
  });

  it('post-reload toast uses the localized updatedToLatest string with a fallback', () => {
    expect(fnBody).toMatch(/t\(['"]toasts['"],\s*['"]updatedToLatest['"]\)\s*\|\|\s*['"]Updated/);
  });

  it("post-reload toast shows for ~1.5s (not the old 10s manual prompt)", () => {
    // Spec called for a brief auto-dismissed acknowledgment.
    expect(fnBody).toMatch(/showToast\([^)]+,\s*1500\)/);
  });

  it('no longer surfaces the old "Update available — refresh to apply" manual prompt', () => {
    // The old 10000ms manual-Refresh-button toast is gone.
    expect(fnBody).not.toMatch(/Update available — refresh to apply/);
    expect(fnBody).not.toMatch(/['"]Refresh['"]/);
  });
});

// ---------------------------------------------------------------------------
// app.js — updatedToLatest is localised across all 5 supported languages
// ---------------------------------------------------------------------------

describe('updatedToLatest toast string is i18n complete', () => {
  // Extract the T.toasts block so the regex doesn't pick up coincidental
  // matches elsewhere in app.js.
  const toastsBlock = appSrc.match(/toasts:\s*\{[\s\S]*?\n\s{4}\},?/m)?.[0] ?? '';

  it('T.toasts block contains updatedToLatest', () => {
    expect(toastsBlock).toMatch(/updatedToLatest:/);
  });

  for (const lang of ['en', 'af', 'zu', 'xh', 'st']) {
    it(`updatedToLatest.${lang} is a non-empty string`, () => {
      const re = new RegExp(`updatedToLatest:[\\s\\S]*?${lang}:\\s*"([^"]+)"`);
      const match = toastsBlock.match(re);
      expect(match, `${lang} value missing`).toBeTruthy();
      expect(match[1].length).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// ?reset=1 escape hatch — must not be broken by the new flow
// ---------------------------------------------------------------------------

describe('?reset=1 escape hatch is not regressed', () => {
  // The inline ?reset=1 script (added in commit f4ec552) clears install
  // localStorage. It must NOT clear our new sessionStorage flags (would
  // be harmless either way but worth confirming the surface stays narrow).
  const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const resetScript = indexHtml.match(/reset=1[\s\S]{0,2000}/)?.[0] ?? '';

  it("?reset=1 still scopes its wipe to pw_install / pw-install / pw_installed keys", () => {
    // Confirms the existing scope (not widened to all pw_* keys, which would
    // catch our new pw_sw_just_updated by accident).
    expect(resetScript).toMatch(/pw_install/);
  });

  it("?reset=1 does NOT clear pw_sw_just_updated (different state, harmless if it did but worth pinning)", () => {
    // Negative assertion — narrow scope preserved.
    expect(resetScript).not.toMatch(/pw_sw_just_updated/);
  });
});

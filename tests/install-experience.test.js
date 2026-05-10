import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  INSTALL_T,
  STORAGE_KEYS,
  DISMISS_DAYS,
  ENGAGEMENT_MS,
  detectPlatform,
  shouldShowBanner,
  dismissUntilTimestamp,
  tInstall,
} from '../assets/install.js';

const html = () => readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const installHtml = () => readFileSync(new URL('../install.html', import.meta.url), 'utf8');
const installJs = () => readFileSync(new URL('../assets/install.js', import.meta.url), 'utf8');
const css = () => readFileSync(new URL('../assets/app.css', import.meta.url), 'utf8');
const sw = () => readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

const SUPPORTED_LANGS = ['en', 'af', 'zu', 'xh', 'st'];

const UA = {
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  iosSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
  iosChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1',
  iosEdge:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 EdgiOS/120.0.0.0 Mobile/15E148 Safari/604.1',
  desktopChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  desktopEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  desktopFirefox:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
};

describe('install — platform detection', () => {
  it('identifies Android Chrome', () => {
    expect(detectPlatform(UA.androidChrome)).toBe('android-chrome');
  });
  it('identifies iOS Safari', () => {
    expect(detectPlatform(UA.iosSafari)).toBe('ios-safari');
  });
  it('identifies iOS Chrome via CriOS UA token', () => {
    expect(detectPlatform(UA.iosChrome)).toBe('ios-chrome');
  });
  it('treats iOS Edge (EdgiOS) as ios-chrome path (same Safari handoff modal)', () => {
    expect(detectPlatform(UA.iosEdge)).toBe('ios-chrome');
  });
  it('identifies desktop Chrome and Edge as desktop-chrome', () => {
    expect(detectPlatform(UA.desktopChrome)).toBe('desktop-chrome');
    expect(detectPlatform(UA.desktopEdge)).toBe('desktop-chrome');
  });
  it('returns desktop-other for desktop Firefox', () => {
    expect(detectPlatform(UA.desktopFirefox)).toBe('desktop-other');
  });
});

describe('install — shouldShowBanner state machine', () => {
  const baseStorage = (overrides = {}) => ({
    installed: null,
    completed: null,
    dismissedUntil: null,
    firstSeen: String(Date.now() - (ENGAGEMENT_MS + 1000)),
    interacted: 'true',
    ...overrides,
  });

  it('does NOT show in standalone mode', () => {
    expect(
      shouldShowBanner({
        storage: baseStorage(),
        standalone: true,
        platform: 'ios-safari',
      })
    ).toBe(false);
  });

  it('does NOT show when pw_install_completed is true', () => {
    expect(
      shouldShowBanner({
        storage: baseStorage({ completed: 'true' }),
        platform: 'android-chrome',
      })
    ).toBe(false);
  });

  it('does NOT show when pw_installed is true', () => {
    expect(
      shouldShowBanner({
        storage: baseStorage({ installed: 'true' }),
        platform: 'android-chrome',
      })
    ).toBe(false);
  });

  it('does NOT show when dismissedUntil is in the future', () => {
    const now = Date.now();
    expect(
      shouldShowBanner({
        storage: baseStorage({ dismissedUntil: String(now + 60_000) }),
        now,
        platform: 'android-chrome',
      })
    ).toBe(false);
  });

  it('DOES show when dismissedUntil is in the past', () => {
    const now = Date.now();
    expect(
      shouldShowBanner({
        storage: baseStorage({ dismissedUntil: String(now - 60_000) }),
        now,
        platform: 'android-chrome',
      })
    ).toBe(true);
  });

  it('does NOT show before engagement window elapses (10s)', () => {
    const now = Date.now();
    expect(
      shouldShowBanner({
        storage: baseStorage({ firstSeen: String(now - 5_000) }),
        now,
        platform: 'android-chrome',
      })
    ).toBe(false);
  });

  it('does NOT show without an interaction signal even after 10s', () => {
    const now = Date.now();
    expect(
      shouldShowBanner({
        storage: baseStorage({ firstSeen: String(now - 60_000), interacted: null }),
        now,
        platform: 'android-chrome',
      })
    ).toBe(false);
  });

  it('does NOT show on desktop-other or other (no install path)', () => {
    expect(shouldShowBanner({ storage: baseStorage(), platform: 'desktop-other' })).toBe(false);
    expect(shouldShowBanner({ storage: baseStorage(), platform: 'other' })).toBe(false);
  });

  it('DOES show on android-chrome / ios-safari / ios-chrome / desktop-chrome with engagement and no dismissal', () => {
    for (const platform of ['android-chrome', 'ios-safari', 'ios-chrome', 'desktop-chrome']) {
      expect(shouldShowBanner({ storage: baseStorage(), platform })).toBe(true);
    }
  });
});

describe('install — dismissUntilTimestamp', () => {
  it('returns now + 7 days by default', () => {
    const now = 1_700_000_000_000;
    expect(dismissUntilTimestamp(now)).toBe(now + 7 * 24 * 60 * 60 * 1000);
    expect(DISMISS_DAYS).toBe(7);
  });
});

describe('install — translations cover all 5 languages', () => {
  it('every install translation entry has en, af, zu, xh, st', () => {
    for (const [key, entry] of Object.entries(INSTALL_T)) {
      for (const lang of SUPPORTED_LANGS) {
        const val = entry[lang];
        expect(val, `${key}.${lang} should exist`).toBeTruthy();
        // bullet-list arrays must have items
        if (Array.isArray(val)) {
          expect(val.length, `${key}.${lang} array length`).toBeGreaterThan(0);
        } else {
          expect(typeof val, `${key}.${lang} type`).toBe('string');
        }
      }
    }
  });
  it('tInstall returns localized string and falls back to English', () => {
    expect(tInstall('bannerInstall', 'af')).toBe(INSTALL_T.bannerInstall.af);
    expect(tInstall('bannerInstall', 'zu')).toBe(INSTALL_T.bannerInstall.zu);
    expect(tInstall('bannerInstall', 'xh')).toBe(INSTALL_T.bannerInstall.xh);
    expect(tInstall('bannerInstall', 'st')).toBe(INSTALL_T.bannerInstall.st);
    // unknown lang -> en fallback
    expect(tInstall('bannerInstall', 'fr')).toBe(INSTALL_T.bannerInstall.en);
    // unknown key -> the key itself
    expect(tInstall('nonexistentKey', 'en')).toBe('nonexistentKey');
  });
});

describe('install — DOM markup wired into index.html', () => {
  it('renders the install banner with required elements', () => {
    const h = html();
    expect(h).toMatch(/id="installBanner"[^>]*class="install-banner hidden"/);
    expect(h).toMatch(/id="installBannerTitle"/);
    expect(h).toMatch(/id="installBannerInstall"/);
    expect(h).toMatch(/id="installBannerDismiss"/);
  });
  it('renders the iOS Safari install modal with 3 step list items', () => {
    const h = html();
    expect(h).toMatch(/id="iosInstallModal"[^>]*role="dialog"/);
    expect(h).toMatch(/id="iosInstallTitle"/);
    expect(h).toMatch(/id="iosInstallClose"/);
    // 3 numbered steps
    const matches = h.match(/install-step-num/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
    // Inline SVG share icon must be present
    expect(h).toMatch(/<svg[\s\S]*?<path d="M12 3v13"\/>/);
  });

  it('iosInstallModal close control is the × icon in the header (no bottom Got-it button)', () => {
    const h = html();
    // × icon button lives inside the modal header
    expect(h).toMatch(/<div class="install-modal-header">[\s\S]*?<button[^>]*id="iosInstallClose"[^>]*class="install-modal-x"[^>]*aria-label="Close"[^>]*>×<\/button>/);
    // The bottom 'Got it' / iosGotIt button is gone
    expect(h).not.toMatch(/data-install-i18n="iosGotIt"/);
    // No iosGotIt translation key either (no longer used anywhere)
    expect(INSTALL_T.iosGotIt).toBeUndefined();
  });

  it('iosInstallModal is anchored at the top of the viewport (CSS align-items: flex-start)', () => {
    const c = css();
    // Top-anchored override scoped to #iosInstallModal — leaves the
    // shared .install-modal bottom-anchor styling alone for #iosChromeModal.
    expect(c).toMatch(/#iosInstallModal\s*\{[^}]*align-items:\s*flex-start/);
    // Card slides down from the top instead of up from the bottom
    expect(c).toMatch(/#iosInstallModal \.install-modal-card\s*\{[^}]*transform:\s*translateY\(-100%\)/);
  });

  it('iosStep1 references Safari Share, iosStep2 unchanged, iosStep3 is the close instruction (5 langs)', () => {
    for (const lang of SUPPORTED_LANGS) {
      const s1 = INSTALL_T.iosStep1[lang];
      const s2 = INSTALL_T.iosStep2[lang];
      const s3 = INSTALL_T.iosStep3[lang];
      // Step 1 mentions Safari and the Share label as a gold-pill
      expect(s1, `iosStep1.${lang}`).toMatch(/Safari/);
      expect(s1, `iosStep1.${lang}`).toMatch(/`Share`/);
      // Step 2 references Add to Home Screen
      expect(s2, `iosStep2.${lang}`).toMatch(/`Add to Home Screen`/);
      // Step 3 is now the close instruction with × inline as a pill
      expect(s3, `iosStep3.${lang}`).toMatch(/`×`/);
      // Step 3 must NOT still be the old "Tap Add to confirm" copy
      expect(s3, `iosStep3.${lang} should not reference Add`).not.toMatch(/`Add`/);
    }
  });

  it('iosConfirmation translation exists in all 5 languages and reads as positive close', () => {
    expect(INSTALL_T.iosConfirmation).toBeTruthy();
    for (const lang of SUPPORTED_LANGS) {
      const v = INSTALL_T.iosConfirmation[lang];
      expect(typeof v, `iosConfirmation.${lang}`).toBe('string');
      expect(v, `iosConfirmation.${lang} mentions Probably Weather`).toMatch(/Probably Weather/);
    }
  });
  it('iosInstallModal renders the confirmation line below the steps and before the hint', () => {
    const h = html();
    expect(h).toMatch(/<p class="install-modal-confirmation"[^>]*data-install-i18n="iosConfirmation"/);
    // Confirmation line must come AFTER the step list and BEFORE the hint
    expect(h).toMatch(/<\/ol>[\s\S]*?install-modal-confirmation[\s\S]*?install-step-hint/);
  });

  it('iosEditActionsHint translation exists in all 5 languages with both iOS labels as gold pills', () => {
    expect(INSTALL_T.iosEditActionsHint).toBeTruthy();
    for (const lang of SUPPORTED_LANGS) {
      const v = INSTALL_T.iosEditActionsHint[lang];
      expect(typeof v, `iosEditActionsHint.${lang}`).toBe('string');
      expect(v, `iosEditActionsHint.${lang} mentions Add to Home Screen`).toMatch(/`Add to Home Screen`/);
      expect(v, `iosEditActionsHint.${lang} mentions Edit Actions`).toMatch(/`Edit Actions`/);
    }
  });
  it('iosInstallModal renders the Edit Actions hint paragraph as auxiliary text', () => {
    const h = html();
    expect(h).toMatch(/<p class="install-step-hint"[^>]*data-install-i18n="iosEditActionsHint"/);
  });

  it('install.js toggles body.install-modal-active when the iOS Safari modal opens / closes', () => {
    const src = installJs();
    expect(src).toMatch(/function openIosModal\(\)[\s\S]*?document\.body\.classList\.add\(['"]install-modal-active['"]\)/);
    expect(src).toMatch(/function closeIosModal\(\)[\s\S]*?document\.body\.classList\.remove\(['"]install-modal-active['"]\)/);
  });
  it('CSS hides the app Share button while body.install-modal-active is set', () => {
    const c = css();
    expect(c).toMatch(/body\.install-modal-active \.share-btn\s*\{[^}]*display:\s*none\s*!important/);
  });

  it('iosInstallModal × tap is treated as a "Not now" dismissal — closes modal, hides banner, sets dismissedUntil', () => {
    const src = installJs();
    // The iosModalClose listener is no longer the bare closeIosModal
    // reference — it's an inline arrow that does all three actions.
    expect(src).not.toMatch(/iosModalClose\?\.addEventListener\(['"]click['"], closeIosModal\)/);
    // × handler writes the same dismissal flag the "Not now" banner button uses
    expect(src).toMatch(/iosModalClose\?\.addEventListener\(['"]click['"], \(\) => \{[\s\S]*?setItem\(STORAGE_KEYS\.dismissedUntil, String\(dismissUntilTimestamp\(\)\)\)/);
    // × handler calls both closeIosModal AND hideBanner
    expect(src).toMatch(/iosModalClose\?\.addEventListener\(['"]click['"], \(\) => \{[\s\S]*?closeIosModal\(\)[\s\S]*?hideBanner\(\)/);
  });

  it('iosInstallModal backdrop tap stays close-modal-only — does NOT dismiss the banner', () => {
    const src = installJs();
    // Backdrop handler is unchanged from before: just closeIosModal,
    // no dismissedUntil write, no hideBanner. Accidental backdrop tap
    // should not penalize the user with a 7-day banner cooldown.
    expect(src).toMatch(/iosModal\?\.addEventListener\(['"]click['"], \(ev\) => \{ if \(ev\.target === iosModal\) closeIosModal\(\); \}\)/);
  });
  it('renders the iOS Chrome handoff modal', () => {
    const h = html();
    expect(h).toMatch(/id="iosChromeModal"[^>]*role="dialog"/);
    expect(h).toMatch(/id="iosChromeOpenSafari"/);
    // The 'Got it' close button (id="iosChromeClose") was removed: it sat
    // next to the 'Open in Safari' primary CTA and tripped real users into
    // dismissing the modal instead of installing. Backdrop tap and Esc
    // still close the modal.
    expect(h).not.toMatch(/id="iosChromeClose"/);
  });
  it('renders the footer Install link with the install-footer-link class', () => {
    const h = html();
    expect(h).toMatch(/id="installFooterLink"[^>]*class="install-footer-link"/);
  });
});

describe('install — standalone mode hiding via CSS and JS', () => {
  it('CSS hides install UI in standalone display-mode', () => {
    const c = css();
    expect(c).toMatch(/@media all and \(display-mode: standalone\)\s*{\s*\.install-banner[\s\S]*display:\s*none/);
  });
  it('CSS hides install UI when body has standalone-mode class', () => {
    const c = css();
    expect(c).toMatch(/body\.standalone-mode \.install-banner[\s\S]*display:\s*none/);
  });
  it('install.js sets pw_installed=true and standalone-mode class when in standalone', () => {
    const src = installJs();
    expect(src).toMatch(/window\.navigator && window\.navigator\.standalone === true/);
    expect(src).toMatch(/document\.body\.classList\.add\('standalone-mode'\)/);
    expect(src).toMatch(/setItem\(STORAGE_KEYS\.installed, 'true'\)/);
  });
});

describe('install — engagement gate wiring', () => {
  it('records first_seen, then waits for an interaction event before scheduling a banner check', () => {
    const src = installJs();
    expect(src).toMatch(/STORAGE_KEYS\.firstSeen/);
    expect(src).toMatch(/STORAGE_KEYS\.interacted/);
    // Listens to at least one of these interaction events
    expect(src).toMatch(/'pointerdown'|'touchstart'|'scroll'|'keydown'/);
  });
  it('engagement constant is 10 seconds', () => {
    expect(ENGAGEMENT_MS).toBe(10_000);
  });
});

describe('install — landing page exists with platform-aware mount point', () => {
  it('install.html has a mount node and loads /assets/install.js', () => {
    const h = installHtml();
    expect(h).toMatch(/<main[^>]*id="installRoot"/);
    expect(h).toMatch(/import\s*{\s*renderLandingPage\s*}\s*from\s*'\/assets\/install\.js'/);
  });
  it('install.html exposes a 5-language switcher', () => {
    const h = installHtml();
    for (const lang of SUPPORTED_LANGS) {
      expect(h).toMatch(new RegExp(`data-lang="${lang}"`));
    }
  });
});

describe('install — service worker caches install assets and bumps cache version', () => {
  it('caches /install, /install.html and /assets/install.js', () => {
    const src = sw();
    expect(src).toMatch(/['"]\/install['"]/);
    expect(src).toMatch(/['"]\/install\.html['"]/);
    expect(src).toMatch(/['"]\/assets\/install\.js['"]/);
  });
  it('bumps the cache version to the new dated value', () => {
    const src = sw();
    expect(src).toMatch(/CACHE_VERSION\s*=\s*'pw-v\d{4}-\d{2}-\d{2}-\d{3}'/);
  });
});

describe('install — vercel rewrite for /install', () => {
  it('vercel.json rewrites /install to /install.html', () => {
    const v = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8');
    expect(v).toMatch(/\{\s*"source":\s*"\/install"\s*,\s*"destination":\s*"\/install\.html"\s*\}/);
  });
});

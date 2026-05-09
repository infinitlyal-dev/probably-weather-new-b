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

  it('does NOT show on desktop-chrome (mobile-only install prompt per product directive)', () => {
    expect(shouldShowBanner({ storage: baseStorage(), platform: 'desktop-chrome' })).toBe(false);
  });

  it('DOES show on android-chrome / ios-safari / ios-chrome with engagement and no dismissal', () => {
    for (const platform of ['android-chrome', 'ios-safari', 'ios-chrome']) {
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
  it('renders the iOS Chrome 3-step preview modal with Open in Safari primary CTA + Got it secondary', () => {
    const h = html();
    expect(h).toMatch(/id="iosChromeInstallModal"[^>]*role="dialog"/);
    expect(h).toMatch(/id="iosChromeInstallTitle"/);
    expect(h).toMatch(/id="iosChromeOpenSafariFromModal"[^>]*class="install-modal-close"/);
    expect(h).toMatch(/id="iosChromeInstallClose"[^>]*class="install-modal-secondary"/);
    expect(h).toMatch(/data-install-i18n="iosChromeStep1Tap"/);
    expect(h).toMatch(/data-install-i18n="iosChromeStep2Share"/);
    expect(h).toMatch(/data-install-i18n="iosChromeStep3Add"/);
    // Edit Actions hint also appears in the Chrome modal
    const hintMatches = h.match(/data-install-i18n="iosEditActionsHint"/g) || [];
    expect(hintMatches.length).toBeGreaterThanOrEqual(2);
  });
  it('does NOT render the legacy iOS Chrome handoff modal from the deleted x-safari-now design', () => {
    const h = html();
    expect(h).not.toMatch(/id="iosChromeModal"\b/); // legacy id, distinct from iosChromeInstallModal
    expect(h).not.toMatch(/id="iosChromeOpenSafari"\b/); // legacy primary id
    expect(h).not.toMatch(/id="iosChromeClose"\b/); // legacy close id
    expect(h).not.toMatch(/id="installModalUrl"/);
  });
  it('install.js iOS Chrome click handler opens the in-Chrome preview modal (no immediate redirect, no async)', () => {
    const src = installJs();
    // Click handler routes ios-chrome to openIosChromeModal (in-Chrome modal),
    // not to a direct x-safari- href.
    expect(src).toMatch(/platform === 'ios-chrome'[\s\S]*?openIosChromeModal\(\);\s*return;/);
    // The buildSafariHandoffUrl helper and its hash/query signal logic are gone.
    expect(src).not.toMatch(/buildSafariHandoffUrl/);
    expect(src).not.toMatch(/url\.hash = ['"]install['"]/);
    expect(src).not.toMatch(/url\.searchParams\.set\(['"]install['"]/);
    expect(src).not.toMatch(/hashHasInstall/);
    expect(src).not.toMatch(/queryHasInstall/);
  });
  it('install.js Open-in-Safari button inside the Chrome modal fires a bare x-safari- URL (no params, no hash)', () => {
    const src = installJs();
    // Bare URL: just scheme + host + pathname, no search, no hash.
    expect(src).toMatch(/iosChromeOpenBtn\?\.addEventListener[\s\S]*?`x-safari-https:\/\/\$\{window\.location\.host\}\$\{window\.location\.pathname\}`/);
  });
  it('install.js auto-opens the iOS Safari modal on first visit when pw-install-modal-seen is unset', () => {
    const src = installJs();
    // First-visit detection on iOS Safari uses the modalSeen storage key
    expect(src).toMatch(/STORAGE_KEYS\.modalSeen/);
    expect(src).toMatch(/platform === 'ios-safari'[\s\S]*?if \(!modalSeen\)[\s\S]*?openIosModal/);
    // Storage key value is the spec-mandated hyphenated form
    expect(src).toMatch(/modalSeen:\s*['"]pw-install-modal-seen['"]/);
  });
  it('install.js sets pw-install-modal-seen when the iOS Safari modal is dismissed (Got it / backdrop / Esc)', () => {
    const src = installJs();
    // closeIosModal sets the flag — covers all three dismissal paths
    expect(src).toMatch(/function closeIosModal[\s\S]*?setItem\(STORAGE_KEYS\.modalSeen, ['"]1['"]\)/);
  });
  it('install.js standalone-mode branch also sets pw-install-modal-seen so a later regular-Safari visit doesn\'t pester the user', () => {
    const src = installJs();
    expect(src).toMatch(/isStandalone[\s\S]*?setItem\(STORAGE_KEYS\.modalSeen, ['"]1['"]\)/);
  });
  it('iosChromeStepN translations exist in all 5 languages with correct backtick conventions', () => {
    for (const key of ['iosChromeStep1Tap', 'iosChromeStep2Share', 'iosChromeStep3Add']) {
      expect(INSTALL_T[key], `${key} exists`).toBeTruthy();
      for (const lang of SUPPORTED_LANGS) {
        const v = INSTALL_T[key][lang];
        expect(typeof v, `${key}.${lang} type`).toBe('string');
      }
    }
    // Step 1 has no iOS native label — pure translated text
    for (const lang of SUPPORTED_LANGS) {
      expect(INSTALL_T.iosChromeStep1Tap[lang]).not.toMatch(/`/);
    }
    // Steps 2 and 3 reference iOS native labels in backticks (gold pills)
    for (const lang of SUPPORTED_LANGS) {
      expect(INSTALL_T.iosChromeStep2Share[lang], `${lang} step2 mentions Share`).toMatch(/`Share`/);
      expect(INSTALL_T.iosChromeStep3Add[lang], `${lang} step3 mentions Add to Home Screen`).toMatch(/`Add to Home Screen`/);
    }
  });
  it('iosEditActionsHint translation exists in all 5 languages and references both iOS labels', () => {
    expect(INSTALL_T.iosEditActionsHint).toBeTruthy();
    for (const lang of SUPPORTED_LANGS) {
      const v = INSTALL_T.iosEditActionsHint[lang];
      expect(typeof v, `${lang} type`).toBe('string');
      // Both iOS labels appear inside backticks (rendered as gold pills)
      expect(v, `${lang} mentions Add to Home Screen`).toMatch(/`Add to Home Screen`/);
      expect(v, `${lang} mentions Edit Actions`).toMatch(/`Edit Actions`/);
    }
  });
  it('iosInstallModal renders the Edit Actions hint between the 3 steps and the Got it button', () => {
    const h = html();
    // Hint paragraph carries the i18n key and sits before the Got it button
    expect(h).toMatch(/data-install-i18n="iosEditActionsHint"[\s\S]*?id="iosInstallClose"/);
    expect(h).toMatch(/class="install-step-hint"/);
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

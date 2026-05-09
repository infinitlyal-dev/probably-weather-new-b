import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  INSTALL_T,
  STORAGE_KEYS,
  detectPlatform,
  shouldShowCard,
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
  it('treats iOS Edge (EdgiOS) as ios-chrome', () => {
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

describe('install — shouldShowCard state machine', () => {
  it('does NOT show in standalone mode', () => {
    expect(shouldShowCard({ standalone: true, platform: 'ios-safari' })).toBe(false);
    expect(shouldShowCard({ standalone: true, platform: 'ios-chrome' })).toBe(false);
  });
  it('does NOT show after the user has dismissed it', () => {
    expect(shouldShowCard({ storage: { cardDismissed: '1' }, platform: 'ios-safari' })).toBe(false);
    expect(shouldShowCard({ storage: { cardDismissed: '1' }, platform: 'ios-chrome' })).toBe(false);
  });
  it('DOES show on iOS Safari and iOS Chrome by default (no dismissal, not standalone)', () => {
    expect(shouldShowCard({ platform: 'ios-safari' })).toBe(true);
    expect(shouldShowCard({ platform: 'ios-chrome' })).toBe(true);
  });
  it('does NOT show on Android Chrome (uses native PWA install affordance instead)', () => {
    expect(shouldShowCard({ platform: 'android-chrome' })).toBe(false);
  });
  it('does NOT show on any desktop platform', () => {
    expect(shouldShowCard({ platform: 'desktop-chrome' })).toBe(false);
    expect(shouldShowCard({ platform: 'desktop-other' })).toBe(false);
  });
  it('does NOT show on unknown / other platforms', () => {
    expect(shouldShowCard({ platform: 'other' })).toBe(false);
  });
});

describe('install — STORAGE_KEYS', () => {
  it('exposes only the cardDismissed key (legacy banner/engagement keys removed)', () => {
    expect(STORAGE_KEYS.cardDismissed).toBe('pw-install-card-dismissed');
    expect(STORAGE_KEYS.installed).toBeUndefined();
    expect(STORAGE_KEYS.dismissedUntil).toBeUndefined();
    expect(STORAGE_KEYS.firstSeen).toBeUndefined();
    expect(STORAGE_KEYS.interacted).toBeUndefined();
    expect(STORAGE_KEYS.modalSeen).toBeUndefined();
  });
});

describe('install — translations cover all 5 languages', () => {
  it('every install translation entry has en, af, zu, xh, st', () => {
    for (const [key, entry] of Object.entries(INSTALL_T)) {
      for (const lang of SUPPORTED_LANGS) {
        const val = entry[lang];
        expect(val, `${key}.${lang} should exist`).toBeTruthy();
        if (Array.isArray(val)) {
          expect(val.length, `${key}.${lang} array length`).toBeGreaterThan(0);
        } else {
          expect(typeof val, `${key}.${lang} type`).toBe('string');
        }
      }
    }
  });
  it('card-frame translations exist (cardTitle, cardSubtitle, cardShowMeHow, cardDismissLabel)', () => {
    for (const key of ['cardTitle', 'cardSubtitle', 'cardShowMeHow', 'cardDismissLabel']) {
      expect(INSTALL_T[key], `${key} exists`).toBeTruthy();
      for (const lang of SUPPORTED_LANGS) {
        expect(typeof INSTALL_T[key][lang], `${key}.${lang}`).toBe('string');
      }
    }
  });
  it('iOS step translations preserve gold-pill backticks for native iOS labels', () => {
    // Safari steps reference Share / Add to Home Screen / Add as English pills
    for (const lang of SUPPORTED_LANGS) {
      expect(INSTALL_T.iosStep1[lang], `iosStep1.${lang}`).toMatch(/`Share`/);
      expect(INSTALL_T.iosStep2[lang], `iosStep2.${lang}`).toMatch(/`Add to Home Screen`/);
      expect(INSTALL_T.iosStep3[lang], `iosStep3.${lang}`).toMatch(/`Add`/);
      expect(INSTALL_T.iosChromeStep2Share[lang], `iosChromeStep2Share.${lang}`).toMatch(/`Share`/);
      expect(INSTALL_T.iosChromeStep3Add[lang], `iosChromeStep3Add.${lang}`).toMatch(/`Add to Home Screen`/);
      expect(INSTALL_T.iosEditActionsHint[lang], `iosEditActionsHint.${lang}`).toMatch(/`Add to Home Screen`/);
      expect(INSTALL_T.iosEditActionsHint[lang], `iosEditActionsHint.${lang}`).toMatch(/`Edit Actions`/);
    }
  });
  it('tInstall returns localized string and falls back to English', () => {
    expect(tInstall('cardShowMeHow', 'af')).toBe(INSTALL_T.cardShowMeHow.af);
    expect(tInstall('cardShowMeHow', 'fr')).toBe(INSTALL_T.cardShowMeHow.en);
    expect(tInstall('nonexistentKey', 'en')).toBe('nonexistentKey');
  });
});

describe('install — DOM markup wired into index.html', () => {
  it('renders the install card with title, subtitle, show-me-how, and dismiss controls', () => {
    const h = html();
    expect(h).toMatch(/id="installCard"[^>]*hidden/);
    expect(h).toMatch(/id="installCardTitle"/);
    expect(h).toMatch(/id="installCardSubtitle"/);
    expect(h).toMatch(/id="installCardShow"[^>]*aria-controls="installCardSteps"/);
    expect(h).toMatch(/id="installCardDismiss"[^>]*aria-label="Dismiss"/);
    expect(h).toMatch(/id="installCardSteps"[^>]*hidden/);
  });
  it('does NOT render the legacy install banner or any of the deleted modals', () => {
    const h = html();
    expect(h).not.toMatch(/id="installBanner"/);
    expect(h).not.toMatch(/id="installBannerInstall"/);
    expect(h).not.toMatch(/id="installBannerDismiss"/);
    expect(h).not.toMatch(/id="iosInstallModal"/);
    expect(h).not.toMatch(/id="iosChromeInstallModal"/);
    expect(h).not.toMatch(/id="iosChromeOpenSafariFromModal"/);
  });
  it('renders the footer Install link (re-shows the card after dismiss)', () => {
    const h = html();
    expect(h).toMatch(/id="installFooterLink"[^>]*class="install-footer-link"/);
  });
});

describe('install — install.js card behavior', () => {
  it('renders steps via JS based on platform: iOS Chrome step 1 has the bare-URL Open in Safari button', () => {
    const src = installJs();
    // iOS Chrome path inside renderSteps populates the open-Safari button
    expect(src).toMatch(/platform === 'ios-chrome'[\s\S]*?id:\s*['"]installCardOpenSafari['"]/);
    // Bare x-safari- URL: scheme + host + pathname, no params, no hash
    expect(src).toMatch(/window\.location\.href = `x-safari-https:\/\/\$\{window\.location\.host\}\$\{window\.location\.pathname\}`/);
  });
  it('shows the iOS Safari Add-to-Home steps + Edit Actions hint on the ios-safari path', () => {
    const src = installJs();
    // iOS Safari step list uses iosStep1/2/3 (Share / Add to Home Screen / Add)
    expect(src).toMatch(/tInstall\(['"]iosStep1['"]/);
    expect(src).toMatch(/tInstall\(['"]iosStep2['"]/);
    expect(src).toMatch(/tInstall\(['"]iosStep3['"]/);
    // Edit Actions hint always rendered after the step list
    expect(src).toMatch(/tInstall\(['"]iosEditActionsHint['"]/);
  });
  it('dismiss writes pw-install-card-dismissed=1 to localStorage', () => {
    const src = installJs();
    expect(src).toMatch(/setItem\(STORAGE_KEYS\.cardDismissed,\s*['"]1['"]\)/);
  });
  it('reopen (footer link click) clears the dismissed flag and expands the card', () => {
    const src = installJs();
    expect(src).toMatch(/function reopen\(\)[\s\S]*?removeItem\(STORAGE_KEYS\.cardDismissed\)[\s\S]*?expand\(\)/);
  });
  it('expand toggles aria-expanded=true on the show button and unhides the steps container', () => {
    const src = installJs();
    expect(src).toMatch(/setAttribute\(['"]aria-expanded['"], ['"]true['"]\)/);
    expect(src).toMatch(/stepsContainer\.hidden = false/);
  });
});

describe('install — dead code from prior designs is gone', () => {
  it('no install banner DOM ids in install.js', () => {
    const src = installJs();
    expect(src).not.toMatch(/installBannerInstall/);
    expect(src).not.toMatch(/installBannerDismiss/);
    expect(src).not.toMatch(/installBannerTitle/);
  });
  it('no engagement gate / interaction tracking', () => {
    const src = installJs();
    expect(src).not.toMatch(/ENGAGEMENT_MS/);
    expect(src).not.toMatch(/scheduleBannerCheck/);
    expect(src).not.toMatch(/recordInteraction/);
  });
  it('no buildSafariHandoffUrl helper or hash/query install signals', () => {
    const src = installJs();
    expect(src).not.toMatch(/buildSafariHandoffUrl/);
    expect(src).not.toMatch(/hashHasInstall/);
    expect(src).not.toMatch(/queryHasInstall/);
    expect(src).not.toMatch(/url\.hash = ['"]install['"]/);
    expect(src).not.toMatch(/searchParams\.set\(['"]install['"]/);
  });
  it('no modal open/close helpers', () => {
    const src = installJs();
    expect(src).not.toMatch(/function openIosModal/);
    expect(src).not.toMatch(/function closeIosModal/);
    expect(src).not.toMatch(/function openIosChromeModal/);
    expect(src).not.toMatch(/function closeIosChromeModal/);
  });
  it('no beforeinstallprompt capture (Android Chrome handles its own native prompt)', () => {
    const src = installJs();
    expect(src).not.toMatch(/beforeinstallprompt/);
    expect(src).not.toMatch(/deferredPrompt/);
  });
});

describe('install — standalone mode hiding via CSS and JS', () => {
  it('CSS hides the install card in standalone display-mode', () => {
    const c = css();
    expect(c).toMatch(/@media all and \(display-mode: standalone\)\s*{\s*\.install-card[\s\S]*display:\s*none/);
  });
  it('CSS hides the install card when body has standalone-mode class', () => {
    const c = css();
    expect(c).toMatch(/body\.standalone-mode \.install-card[\s\S]*display:\s*none/);
  });
  it('install.js sets standalone-mode class and hides the card when in standalone', () => {
    const src = installJs();
    expect(src).toMatch(/window\.navigator && window\.navigator\.standalone === true/);
    expect(src).toMatch(/document\.body\.classList\.add\('standalone-mode'\)/);
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

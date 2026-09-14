import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  INSTALL_T,
  androidStepsKey,
  detectPlatform,
  renderLandingPage,
  tInstall,
} from '../assets/install.js';

// Pure-DOM module, but no jsdom in this project — build the smallest fake tree
// renderLandingPage actually touches (createElement/createTextNode, appendChild,
// setAttribute, className/textContent, querySelector('#id'), DOMParser for the
// inline SVGs). Same spirit as the fakeEl() double in install-experience.test.js.

const installJs = () => readFileSync(new URL('../assets/install.js', import.meta.url), 'utf8');

const SUPPORTED_LANGS = ['en', 'af', 'zu', 'xh', 'st'];

const UA = {
  // Real Samsung Internet UA: carries SamsungBrowser/ AND Chrome/, which is
  // exactly why detectPlatform classifies it as 'android-chrome'.
  samsungInternet:
    'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-A366B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  // Same Samsung handset running stock Chrome — ⋮ menu, not ≡.
  samsungChrome:
    'Mozilla/5.0 (Linux; Android 15; SM-A366B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
  pixelChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  iosSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
  desktopChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

function makeNode(tag) {
  const node = {
    tagName: tag,
    className: '',
    hidden: false,
    attrs: {},
    children: [],
    listeners: {},
    _text: '',
    get textContent() {
      if (node.children.length) return node.children.map((c) => c.textContent).join('');
      return node._text;
    },
    set textContent(v) {
      node.children.length = 0;
      node._text = String(v);
    },
    setAttribute(k, v) {
      node.attrs[k] = String(v);
      // Mirror the real DOM: the hidden content attribute reflects to the property.
      if (k === 'hidden') node.hidden = true;
    },
    getAttribute(k) { return k in node.attrs ? node.attrs[k] : null; },
    appendChild(c) { node.children.push(c); return c; },
    removeChild(c) { node.children.splice(node.children.indexOf(c), 1); return c; },
    get firstChild() { return node.children[0] || null; },
    addEventListener(t, fn) { (node.listeners[t] ||= []).push(fn); },
    click() { (node.listeners.click || []).forEach((fn) => fn({ target: node })); },
    querySelector(sel) { return findById(node, String(sel).replace(/^#/, '')); },
    focus() {},
  };
  return node;
}

function findById(root, id) {
  for (const child of root.children || []) {
    if (child.attrs && child.attrs.id === id) return child;
    const hit = findById(child, id);
    if (hit) return hit;
  }
  return null;
}

function stubDom() {
  const win = new EventTarget();
  win.matchMedia = () => ({ matches: false });
  win.location = { href: 'https://www.probablyweather.co.za/install', origin: 'https://www.probablyweather.co.za' };
  win.navigator = { userAgent: '' };
  vi.stubGlobal('window', win);
  vi.stubGlobal('navigator', win.navigator);
  vi.stubGlobal('document', {
    createElement: (tag) => makeNode(tag),
    createTextNode: (t) => ({ textContent: String(t) }),
  });
  vi.stubGlobal('DOMParser', class {
    parseFromString() { return { documentElement: makeNode('svg') }; }
  });
  return win;
}

/** Render the landing page for a UA, tap "Install now" with no beforeinstallprompt,
 *  and return the fallback hint node the user is left staring at. */
function installNowFallbackHint(uaString, lang = 'en') {
  const host = makeNode('main');
  const result = renderLandingPage(host, { lang, uaString });
  const btn = host.querySelector('#landingInstallNow');
  if (!btn) return { result, hint: null, btn: null };
  const hint = host.querySelector('#landingInstallHint');
  expect(hint.hidden, 'hint starts hidden').toBe(true);
  btn.click();
  return { result, hint, btn };
}

describe('/install landing page — Samsung Internet gets its own menu steps (prelaunch item 9)', () => {
  beforeEach(() => { vi.useFakeTimers(); stubDom(); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('Samsung Internet classifies as android-chrome — the defect is the landing page ignoring the ≡ case', () => {
    expect(detectPlatform(UA.samsungInternet)).toBe('android-chrome');
    expect(androidStepsKey(UA.samsungInternet)).toBe('samsungInternetSteps');
    expect(androidStepsKey(UA.samsungChrome)).toBe('androidChromeSteps');
  });

  it('Samsung Internet: "Install now" with no prompt shows the ≡ Add page to → Home screen steps', () => {
    const { hint } = installNowFallbackHint(UA.samsungInternet);
    expect(hint.hidden).toBe(false);
    expect(hint.textContent).toBe('Menu ≡ → Add page to → Home screen');
    expect(hint.textContent).not.toContain('⋮');
  });

  it('Chrome on Android still gets the ⋮ steps, on a Samsung handset and on a Pixel', () => {
    for (const ua of [UA.samsungChrome, UA.pixelChrome]) {
      const { hint } = installNowFallbackHint(ua);
      expect(hint.hidden).toBe(false);
      expect(hint.textContent).toBe('Menu ⋮ → Add to Home screen / Install app');
      expect(hint.textContent).not.toContain('≡');
    }
  });

  it('desktop Chrome keeps the generic chromium ⋮ sentence (no Samsung case off Android)', () => {
    const { hint } = installNowFallbackHint(UA.desktopChrome);
    expect(hint.hidden).toBe(false);
    expect(hint.textContent).toBe(INSTALL_T.installFallbackChromium.en);
    expect(hint.textContent).toContain('⋮');
  });

  it('the hint is the banner selection, not a parallel copy path — all 5 languages', () => {
    for (const lang of SUPPORTED_LANGS) {
      for (const ua of [UA.samsungInternet, UA.samsungChrome]) {
        const { hint } = installNowFallbackHint(ua, lang);
        const bannerKey = androidStepsKey(ua);
        // Backticks are pill markers stripped by setI18nText when rendered.
        const expected = tInstall(bannerKey, lang).replace(/`/g, '');
        expect(hint.textContent, `${bannerKey}.${lang}`).toBe(expected);
      }
    }
  });

  it('renders the ⋮ / ≡ menu glyph as a gold install-os-label pill, as the banner does', () => {
    const { hint } = installNowFallbackHint(UA.samsungInternet);
    const pills = hint.children.filter((c) => c.className === 'install-os-label');
    expect(pills.map((p) => p.textContent)).toEqual(['≡', 'Add page to', 'Home screen']);
  });

  it('iOS Safari is untouched — step list, no Install-now button, no Android steps', () => {
    const host = makeNode('main');
    const result = renderLandingPage(host, { lang: 'en', uaString: UA.iosSafari });
    expect(result.platform).toBe('ios-safari');
    expect(host.querySelector('#landingInstallNow')).toBeNull();
    expect(host.querySelector('#landingInstallHint')).toBeNull();
    expect(host.textContent).not.toContain('Add page to');
  });

  it('landing page and banner both route through androidStepsKey (one source of truth)', () => {
    // Normalise line endings first: the repo checks out CRLF on Windows, so a
    // raw '\n}\n' slice marker silently matches nothing.
    const src = installJs().replace(/\r\n/g, '\n');
    // Scope to each renderer's own source slice — a repo-wide count would be
    // satisfied by the helper's declaration plus the banner alone, and would
    // still pass if the landing page never called it.
    const bodyOf = (signature) => {
      const start = src.indexOf(signature);
      expect(start, `${signature} found`).toBeGreaterThan(-1);
      const end = src.indexOf('\n}\n', start);
      expect(end, `${signature} body terminated`).toBeGreaterThan(start);
      return src.slice(start, end);
    };
    const banner = bodyOf('export function initInstallExperience');
    const landing = bodyOf('export function renderLandingPage');
    expect(banner, 'banner selects its steps via the helper').toMatch(/androidStepsKey\(/);
    expect(landing, 'landing page selects its steps via the helper').toMatch(/androidStepsKey\(/);
    // Neither renderer re-implements the SamsungBrowser sniff locally.
    expect(banner).not.toMatch(/SamsungBrowser/);
    expect(landing).not.toMatch(/SamsungBrowser/);
    // The landing fallback no longer hardcodes the generic copy as its only option.
    expect(landing).not.toMatch(/hint\.textContent = INSTALL_T\.installFallbackChromium\[lang\]/);
  });
});

describe('/install landing page — the 3-second delayed fallback follows the same selection', () => {
  beforeEach(() => { vi.useFakeTimers(); stubDom(); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  /** Render, wait out the 3s timer WITHOUT tapping, return the delayed hint. */
  function delayedHint(uaString, lang = 'en') {
    const host = makeNode('main');
    renderLandingPage(host, { lang, uaString });
    const hint = host.querySelector('#landingFallbackHint');
    expect(hint, 'delayed fallback hint rendered').toBeTruthy();
    expect(hint.hidden, 'delayed hint starts hidden').toBe(true);
    vi.advanceTimersByTime(3100);
    return { host, hint };
  }

  it('Samsung Internet: the delayed hint shows the ≡ steps, not "open this in Chrome"', () => {
    const { hint } = delayedHint(UA.samsungInternet);
    expect(hint.hidden).toBe(false);
    expect(hint.textContent).toBe('Menu ≡ → Add page to → Home screen');
    expect(hint.textContent).not.toContain('Chrome');
    expect(hint.textContent).not.toContain('⋮');
  });

  it('Chrome on Android: the delayed hint shows the ⋮ steps', () => {
    for (const ua of [UA.samsungChrome, UA.pixelChrome]) {
      const { hint } = delayedHint(ua);
      expect(hint.hidden).toBe(false);
      expect(hint.textContent).toBe('Menu ⋮ → Add to Home screen / Install app');
      expect(hint.textContent).not.toContain('≡');
    }
  });

  it('desktop Chrome keeps the generic open-in-a-real-browser hint (no Android menu steps)', () => {
    const { hint } = delayedHint(UA.desktopChrome);
    expect(hint.hidden).toBe(false);
    expect(hint.textContent).toBe(INSTALL_T.inAppFallbackHint.en);
  });

  it('the delayed hint follows the banner selection in all 5 languages', () => {
    for (const lang of SUPPORTED_LANGS) {
      for (const ua of [UA.samsungInternet, UA.samsungChrome]) {
        const { hint } = delayedHint(ua, lang);
        const bannerKey = androidStepsKey(ua);
        expect(hint.textContent, `${bannerKey}.${lang}`).toBe(tInstall(bannerKey, lang).replace(/`/g, ''));
      }
    }
  });

  it('a tap supersedes the delayed hint instead of printing the same steps twice', () => {
    const { host, hint } = delayedHint(UA.samsungInternet);
    expect(hint.hidden).toBe(false);
    host.querySelector('#landingInstallNow').click();
    const tapHint = host.querySelector('#landingInstallHint');
    expect(tapHint.hidden, 'tap hint takes over').toBe(false);
    expect(tapHint.textContent).toBe('Menu ≡ → Add page to → Home screen');
    expect(hint.hidden, 'delayed hint stands down so the steps appear once').toBe(true);
  });

  it('no delayed hint at all once beforeinstallprompt has armed', () => {
    const host = makeNode('main');
    renderLandingPage(host, { lang: 'en', uaString: UA.samsungInternet });
    window.__pwLandingDeferred = { prompt() {}, userChoice: Promise.resolve({ outcome: 'accepted' }) };
    vi.advanceTimersByTime(3100);
    expect(host.querySelector('#landingFallbackHint').hidden).toBe(true);
    window.__pwLandingDeferred = null;
  });
});

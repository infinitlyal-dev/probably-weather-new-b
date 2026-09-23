// Chrome on iPhone adds the web app itself (2026-09-24, launch eval).
//
// The install flow used to tell every iPhone Chrome user "Chrome on iPhone can't
// install apps" and send them to Safari. Since iOS 16.4 Apple lets other browsers
// add a web app to the Home Screen, and Google's Chrome Help gives the steps:
// "On the right of the address bar, tap Share … tap Add to Home Screen". Chrome on
// iOS 16.4+ now gets the same three steps as Safari, with its own first step;
// older iOS, and Firefox / Edge on iOS, keep the open-in-Safari handoff.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { INSTALL_T, detectPlatform, initInstallExperience, iosChromeCanAddToHomeScreen } from '../assets/install.js';

const ios = (os, browser = 'CriOS/140.0.7339.122') =>
  `Mozilla/5.0 (iPhone; CPU iPhone OS ${os} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) ${browser} Mobile/15E148 Safari/604.1`;
const UA = {
  chrome17: ios('17_3'),
  chrome18: ios('18_6'),
  chrome164: ios('16_4'),
  chrome163: ios('16_3_1'),
  chrome15: ios('15_7'),
  ipadChrome17: 'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0 Mobile/15E148 Safari/604.1',
  firefox17: ios('17_3', 'FxiOS/140.0'),
  edge17: ios('17_3', 'EdgiOS/140.0'),
  safari17: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36',
};

describe('iosChromeCanAddToHomeScreen', () => {
  it('is true for Chrome on iOS 16.4 and later, iPhone and iPad', () => {
    for (const ua of [UA.chrome164, UA.chrome17, UA.chrome18, UA.ipadChrome17]) expect(iosChromeCanAddToHomeScreen(ua), ua).toBe(true);
  });
  it('is false before iOS 16.4, for Firefox/Edge on iOS, and off iOS', () => {
    for (const ua of [UA.chrome163, UA.chrome15, UA.firefox17, UA.edge17, UA.safari17, UA.android, '', 'garbage']) {
      expect(iosChromeCanAddToHomeScreen(ua), ua).toBe(false);
    }
    // Firefox/Edge on iOS are still the ios-chrome platform — they keep the handoff.
    expect(detectPlatform(UA.firefox17)).toBe('ios-chrome');
  });
});

describe('the Chrome step', () => {
  it('exists in all five languages, names Chrome and keeps the Share pill', () => {
    for (const lang of ['en', 'af', 'zu', 'xh', 'st']) {
      const s = INSTALL_T.iosChromeStep1[lang];
      expect(s, lang).toMatch(/Chrome/);
      expect(s, lang).toMatch(/`Share`/);
    }
  });
});

describe('banner Install on Chrome for iPhone', () => {
  function fakeEl(attrs0 = {}) {
    const cls = new Set();
    const attrs = { ...attrs0 };
    const node = {
      hidden: false, children: [], listeners: {}, className: '', attrs,
      setAttribute(k, v) { attrs[k] = String(v); },
      getAttribute(k) { return k in attrs ? attrs[k] : null; },
      classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) },
      get firstChild() { return node.children[0] || null; },
      removeChild(c) { node.children.splice(node.children.indexOf(c), 1); },
      appendChild(c) { node.children.push(c); return c; },
      get text() { return node.children.map((c) => c.textContent).join(''); },
      addEventListener(t, fn) { (node.listeners[t] ||= []).push(fn); },
      click() { (node.listeners.click || []).forEach((fn) => fn({ target: node })); },
      focus() {},
      querySelector: () => null,
    };
    return node;
  }
  let els;
  function boot(ua, lang = 'en') {
    const step1 = fakeEl({ 'data-install-i18n': 'iosStep1' });
    els = Object.fromEntries(['installBanner', 'installBannerInstall', 'installBannerDismiss', 'installBannerTitle', 'installBannerSteps',
      'iosInstallModal', 'iosInstallClose', 'iosChromeModal', 'installModalUrl', 'installFooterLink'].map((id) => [id, fakeEl()]));
    for (const id of ['installBanner', 'iosInstallModal', 'iosChromeModal']) els[id].classList.add('hidden');
    els.iosInstallModal.querySelector = () => step1;
    els.step1 = step1;
    const win = new EventTarget();
    Object.assign(win, { matchMedia: () => ({ matches: false }), navigator: { userAgent: ua }, location: { href: 'https://www.probablyweather.co.za/' }, __PW_FIRST_RENDER: true });
    vi.stubGlobal('window', win);
    vi.stubGlobal('navigator', win.navigator);
    vi.stubGlobal('requestAnimationFrame', (cb) => cb());
    const store = new Map();
    vi.stubGlobal('localStorage', { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) });
    vi.stubGlobal('document', {
      getElementById: (id) => els[id] || null,
      querySelectorAll: (sel) => (sel === '[data-install-i18n]' ? [step1] : []),
      createElement: () => ({ className: '', textContent: '' }),
      createTextNode: (t) => ({ textContent: t }),
      addEventListener() {},
      body: fakeEl(),
    });
    return initInstallExperience({ getLanguage: () => lang });
  }
  const open = (id) => !els[id].classList.contains('hidden');

  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('iOS 17 Chrome: Install opens the three steps with Chrome\'s own first step, not the Safari handoff', () => {
    boot(UA.chrome17);
    els.installBannerInstall.click();
    expect(open('iosInstallModal')).toBe(true);
    expect(open('iosChromeModal')).toBe(false);
    expect(els.step1.getAttribute('data-install-i18n')).toBe('iosChromeStep1');
    expect(els.step1.text).toBe(INSTALL_T.iosChromeStep1.en.replace(/`/g, ''));
  });

  it('the footer link takes the same route', () => {
    boot(UA.chrome18, 'zu');
    els.installFooterLink.listeners.click.forEach((fn) => fn({ preventDefault() {}, target: els.installFooterLink }));
    expect(open('iosInstallModal')).toBe(true);
    expect(els.step1.text).toBe(INSTALL_T.iosChromeStep1.zu.replace(/`/g, ''));
  });

  it('iOS 16.3 Chrome and iOS Firefox keep the open-in-Safari handoff', () => {
    for (const ua of [UA.chrome163, UA.firefox17]) {
      boot(ua);
      els.installBannerInstall.click();
      expect(open('iosChromeModal'), ua).toBe(true);
      expect(open('iosInstallModal'), ua).toBe(false);
      vi.unstubAllGlobals();
    }
  });

  it('Safari still gets its own Safari step', () => {
    boot(UA.safari17);
    els.installBannerInstall.click();
    expect(open('iosInstallModal')).toBe(true);
    expect(els.step1.getAttribute('data-install-i18n')).toBe('iosStep1');
  });
});

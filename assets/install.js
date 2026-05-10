/* Probably Weather — PWA Install Experience
   Self-contained module: engagement gate, platform detection, banner orchestration,
   iOS instruction modal, iOS-Chrome handoff modal, /install landing-page helper.
   Exports a small pure surface for unit testing alongside the DOM init function. */

export const STORAGE_KEYS = {
  installed: 'pw_installed',
  dismissedUntil: 'pw_install_dismissed_until',
  completed: 'pw_install_completed',
  firstSeen: 'pw_install_first_seen',
  interacted: 'pw_install_interacted',
};

export const DISMISS_DAYS = 7;
export const ENGAGEMENT_MS = 10 * 1000;

/* -------- Translations (full T[install] block, also re-used by install.html) -------- */
export const INSTALL_T = {
  bannerTitle: {
    en: 'Add Probably Weather to your home screen',
    af: 'Voeg Probably Weather by jou tuisskerm',
    zu: 'Engeza i-Probably Weather kusikrini sakho sasekhaya',
    xh: 'Yongeza i-Probably Weather kwiscreen sakho sasekhaya',
    st: 'Eketsa Probably Weather skrineng sa hao sa lehae',
  },
  bannerInstall: {
    en: 'Install',
    af: 'Installeer',
    zu: 'Faka',
    xh: 'Faka',
    st: 'Kenya',
  },
  bannerDismiss: {
    en: 'Not now',
    af: 'Nie nou nie',
    zu: 'Hhayi manje',
    xh: 'Hayi ngoku',
    st: 'Eseng hona joale',
  },
  iosTitle: {
    en: 'Install in 3 steps',
    af: 'Installeer in 3 stappe',
    zu: 'Faka ngezinyathelo ezi-3',
    xh: 'Faka kumanyathelo ama-3',
    st: 'Kenya ka mehato e 3',
  },
  // iOS native UI labels (Share, Add to Home Screen, Add) stay English in
  // every language because that's what iOS Safari literally renders on screen
  // — iOS doesn't ship Zulu/Xhosa/Sotho UI, and most SA users run their phones
  // in English even when they prefer other languages in apps. Backticks mark
  // segments that the renderer wraps in <code class="install-os-label"> so
  // the user can pattern-match them visually against the actual iOS UI.
  iosStep1: {
    en: 'Tap the `Share` button',
    af: 'Tik op die `Share`-knoppie',
    zu: 'Thepha inkinobho ye-`Share`',
    xh: 'Cofa iqhosha le-`Share`',
    st: 'Tobetsa konopo ya `Share`',
  },
  iosStep2: {
    en: 'Scroll down, tap `Add to Home Screen`',
    af: 'Scroll af, tik op `Add to Home Screen`',
    zu: 'Skrolela phansi, thepha `Add to Home Screen`',
    xh: 'Skrolela ezantsi, cofa `Add to Home Screen`',
    st: 'Theosa fatshe, tobetsa `Add to Home Screen`',
  },
  iosStep3: {
    en: 'Tap `Add` to confirm',
    af: 'Tik op `Add` om te bevestig',
    zu: 'Thepha u-`Add` ukuqinisekisa',
    xh: 'Cofa u-`Add` ukuqinisekisa',
    st: 'Tobetsa `Add` ho netefatsa',
  },
  // The modal's own "Got it" close button IS PW UI, not native iOS UI, so
  // it gets fully translated.
  iosGotIt: {
    en: 'Got it',
    af: 'Reg so',
    zu: 'Ngiyezwa',
    xh: 'Ndiyaziva',
    st: 'Ke utlwile',
  },
  iosChromeTitle: {
    en: 'Open in Safari to install',
    af: 'Maak in Safari oop om te installeer',
    zu: 'Vula ku-Safari ukuze ufake',
    xh: 'Vula kwi-Safari ukuze ufake',
    st: 'Bula ho Safari ho kenya',
  },
  iosChromeBody: {
    en: 'Chrome on iPhone can’t install apps. Tap below to open this site in Safari, then follow the steps to install.',
    af: 'Chrome op iPhone kan nie programme installeer nie. Tik hieronder om hierdie webwerf in Safari oop te maak, dan volg jy die stappe.',
    zu: 'I-Chrome ku-iPhone ayikwazi ukufaka izinhlelo zokusebenza. Thepha ngezansi ukuze uvule le sayithi ku-Safari, bese ulandela izinyathelo.',
    xh: 'I-Chrome kwi-iPhone ayikwazi ukufaka izicelo. Cofa ezantsi ukuze uvule le saythi kwi-Safari, ulandele amanyathelo.',
    st: 'Chrome ho iPhone e ke ke ea kenya li-app. Tobetsa ka tlase ho bula sebaka sena ho Safari, joale latela mehato.',
  },
  iosChromeOpenSafari: {
    en: 'Open in Safari',
    af: 'Maak in Safari oop',
    zu: 'Vula ku-Safari',
    xh: 'Vula kwi-Safari',
    st: 'Bula ho Safari',
  },
  iosChromeFallback: {
    en: 'If nothing happens, copy this link and paste it into Safari:',
    af: 'As niks gebeur nie, kopieer hierdie skakel en plak dit in Safari:',
    zu: 'Uma kungasebenzi, kopisha isixhumanisi sokugcina sinamathisele ku-Safari:',
    xh: 'Ukuba akukho nto yenzekayo, kopa esi sixhumanisi usincamathisele kwi-Safari:',
    st: 'Haeba ho se na letho le etsahalang, kopitsa sehokelo sena u se kenye ho Safari:',
  },
  landingHero: {
    en: 'Install Probably Weather',
    af: 'Installeer Probably Weather',
    zu: 'Faka i-Probably Weather',
    xh: 'Faka i-Probably Weather',
    st: 'Kenya Probably Weather',
  },
  landingSubhead: {
    en: 'Real SA forecasts, on your home screen. No app store nonsense.',
    af: 'Egte SA voorspellings, op jou tuisskerm. Geen winkelnonsens nie.',
    zu: 'Izibikezelo zangempela ze-SA, kusikrini sakho sasekhaya. Akukho ubuwula besitolo.',
    xh: 'Izibikezelo zase-SA zokwenene, kwiscreen sakho sasekhaya. Akukho bubuxoki bevenkile.',
    st: 'Diponelopele tsa nnete tsa SA, skrineng sa hao sa lehae. Ha ho na bothata ba lebenkele.',
  },
  whyTitle: {
    en: 'Why install?',
    af: 'Hoekom installeer?',
    zu: 'Kungani ufake?',
    xh: 'Kutheni ufake?',
    st: 'Hobaneng o kenye?',
  },
  whyBullets: {
    en: ['One-tap access from your home screen', 'Works offline with last-known forecast', 'No Play Store, no App Store, no fuss'],
    af: ['Een-tik toegang vanaf jou tuisskerm', 'Werk vanlyn met die laaste voorspelling', 'Geen Play Store, geen App Store, geen gedoente'],
    zu: ['Ukufinyelela ngokuthepha okukodwa kusuka kusikrini sasekhaya', 'Kusebenza ngaphandle kwe-inthanethi nokubikezela kokugcina', 'Akukho i-Play Store, akukho i-App Store, akukho inkinga'],
    xh: ['Ukufikelela ngokucofa kanye ukusuka kwiscreen sakho', 'Kusebenza ungekho kwi-intanethi ngesibikezelo sokugqibela', 'Akukho i-Play Store, akukho i-App Store, akukho ingxaki'],
    st: ['Phihlello ka tobetso e le ’ngoe skrineng sa lehae', 'Sebetsa ntle le inthanete ka ponelopele ea ho qetela', 'Ha ho Play Store, ha ho App Store, ha ho mathata'],
  },
  howTitle: {
    en: 'How does this work?',
    af: 'Hoe werk dit?',
    zu: 'Kusebenza kanjani?',
    xh: 'Lo msebenzi usebenza njani?',
    st: 'Sena se sebetsa joang?',
  },
  howBody: {
    en: 'It’s a real app icon on your home screen, but with no Play Store nonsense. Probably Weather is a Progressive Web App (PWA) — same offline access, same fast launch, no store reviews to wait for.',
    af: 'Dit is ’n regte programikoon op jou tuisskerm, sonder Play Store gedoente. Probably Weather is ’n Progressiewe Webprogram (PWA) — dieselfde vanlyn toegang, dieselfde vinnige aanvang, geen winkelresensies om vir te wag nie.',
    zu: 'Yi-icon yangempela yohlelo lokusebenza kusikrini sakho sasekhaya, ngaphandle kobuwula be-Play Store. I-Probably Weather i-Progressive Web App (PWA) — ufinyelelo olufanayo lokungalindelekile, ukuqaliswa okusheshayo okufanayo, akukho ukubuyekezwa kwesitolo okumelwe ulinde.',
    xh: 'Yi-icon yokwenene kwi-screen yakho yasekhaya, ngaphandle kweengxaki ze-Play Store. I-Probably Weather yi-Progressive Web App (PWA) — ufikelelo olufanayo olungekho kwi-intanethi, ukuqalisa okukhawulezayo okufanayo, akukho zihlolwa zevenkile zokulinda.',
    st: 'Ke leswao la nnete la app skrineng sa hao sa lehae, empa ntle le bothata ba Play Store. Probably Weather ke Progressive Web App (PWA) — phihlello e tšoanang ntle le inthanete, qaliso e potlakileng e tšoanang, ha ho na litlhahlobo tsa lebenkele tseo u tlamehang ho li letela.',
  },
  installNow: {
    en: 'Install now',
    af: 'Installeer nou',
    zu: 'Faka manje',
    xh: 'Faka ngoku',
    st: 'Kenya hona joale',
  },
  alreadyInstalled: {
    en: 'You’ve already added Probably Weather to your home screen. Look for the icon!',
    af: 'Jy het reeds Probably Weather by jou tuisskerm gevoeg. Soek vir die ikoon!',
    zu: 'Usuyifakile i-Probably Weather kusikrini sakho sasekhaya. Funa i-icon!',
    xh: 'Sele uyongezile i-Probably Weather kwi-screen yakho yasekhaya. Khangela i-icon!',
    st: 'O se u eketsoeng Probably Weather skrineng sa hao sa lehae. Batla letshwao!',
  },
  desktopOpenOnPhone: {
    en: 'Open this on your phone',
    af: 'Maak dit op jou foon oop',
    zu: 'Yivule lokhu efonini yakho',
    xh: 'Vula oku kwifowuni yakho',
    st: 'Bula sena fonong ea hao',
  },
  desktopQrHint: {
    en: 'Scan with your phone’s camera to install.',
    af: 'Skandeer met jou foonkamera om te installeer.',
    zu: 'Skena ngekhamera yefoni yakho ukuze ufake.',
    xh: 'Skena ngekhamera yefowuni yakho ukuze ufake.',
    st: 'Sekena ka khamera ea fono ea hao ho kenya.',
  },
  footerInstallLink: {
    en: 'Install Probably Weather',
    af: 'Installeer Probably Weather',
    zu: 'Faka i-Probably Weather',
    xh: 'Faka i-Probably Weather',
    st: 'Kenya Probably Weather',
  },
  fallbackPrompt: {
    en: 'Tap your browser menu, then Install app — or try again in a moment.',
    af: "Tik op jou blaaier-kieslys, dan Installeer app — of probeer 'n oomblik weer.",
    zu: 'Thepha imenyu yesiphequluli, bese Faka uhlelo lokusebenza — noma uzame futhi ngomzuzwana.',
    xh: 'Cofa imenyu yebrawza, ze ufakele i-app — okanye uzame kwakhona ngomzuzwana.',
    st: 'Tobetsa menyu ea sebatli, ebe Kenya app — kapa leka hape ka motsotsoana.',
  },
};

/* -------- Pure functions (testable without DOM) -------- */

export function tInstall(key, lang = 'en') {
  const entry = INSTALL_T[key];
  if (!entry) return key;
  return entry[lang] || entry.en || key;
}

/**
 * Detect platform from a User-Agent string + standalone-mode flag.
 * Returns one of: 'android-chrome', 'ios-safari', 'ios-chrome', 'desktop-chrome', 'desktop-other', 'other'.
 */
export function detectPlatform(uaString = '', { standalone = false } = {}) {
  const ua = String(uaString || '');
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !/Windows/.test(ua);
  const isCriOS = /CriOS\//.test(ua);
  const isFxiOS = /FxiOS\//.test(ua);
  const isEdgiOS = /EdgiOS\//.test(ua);
  const isAndroid = /Android/.test(ua);
  const isChrome = /Chrome\//.test(ua) && !/Edg\//.test(ua) && !isCriOS;
  const isEdge = /Edg\//.test(ua);
  if (isIOS) {
    if (isCriOS || isFxiOS || isEdgiOS) return 'ios-chrome';
    return 'ios-safari';
  }
  if (isAndroid) {
    if (isChrome || isEdge) return 'android-chrome';
    return 'other';
  }
  if (isChrome || isEdge) return 'desktop-chrome';
  return 'desktop-other';
}

/**
 * Decide whether the install banner should be shown. Pure function.
 */
export function shouldShowBanner({ storage = {}, now = Date.now(), standalone = false, platform = 'other' } = {}) {
  if (standalone) return false;
  if (storage.installed === 'true' || storage.installed === true) return false;
  if (storage.completed === 'true' || storage.completed === true) return false;
  const dismissedUntil = Number(storage.dismissedUntil || 0);
  if (dismissedUntil && now < dismissedUntil) return false;
  if (!storage.firstSeen) return false;
  const elapsed = now - Number(storage.firstSeen);
  if (elapsed < ENGAGEMENT_MS) return false;
  if (!storage.interacted) return false;
  if (platform === 'other' || platform === 'desktop-other') return false;
  return true;
}

export function dismissUntilTimestamp(now = Date.now(), days = DISMISS_DAYS) {
  return now + days * 24 * 60 * 60 * 1000;
}

/* -------- DOM helpers (no innerHTML; build with createElement) -------- */

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'on') {
      for (const [ev, fn] of Object.entries(v)) node.addEventListener(ev, fn);
    } else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function svgFromMarkup(markup) {
  // Markup is a constant from this module, never user-supplied. Parse via
  // DOMParser so we don't touch innerHTML on a live tree.
  const parser = new DOMParser();
  const doc = parser.parseFromString(markup, 'image/svg+xml');
  return doc.documentElement;
}

/**
 * Render a translation string into a live DOM node, splitting on backticks.
 * Even-indexed segments are plain text; odd-indexed segments are wrapped in
 * <code class="install-os-label"> to visually flag native-iOS button labels
 * that stay in English while the surrounding instruction is translated.
 * Strings without backticks render as a single text node — equivalent to
 * setting textContent.
 */
function setI18nText(node, str) {
  while (node.firstChild) node.removeChild(node.firstChild);
  const parts = String(str).split('`');
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      const code = document.createElement('code');
      code.className = 'install-os-label';
      code.textContent = part;
      node.appendChild(code);
    } else if (part) {
      node.appendChild(document.createTextNode(part));
    }
  });
}

/* -------- DOM init (only runs in browser) -------- */

export function initInstallExperience({ getLanguage = () => 'en', showToast = null } = {}) {
  if (typeof window === 'undefined') return null;

  const banner = document.getElementById('installBanner');
  if (!banner) return null;
  const installBtn = document.getElementById('installBannerInstall');
  const dismissBtn = document.getElementById('installBannerDismiss');
  const titleEl = document.getElementById('installBannerTitle');
  const iosModal = document.getElementById('iosInstallModal');
  const iosModalClose = document.getElementById('iosInstallClose');
  const iosChromeModal = document.getElementById('iosChromeModal');
  const iosChromeClose = document.getElementById('iosChromeClose');
  const iosChromeOpenBtn = document.getElementById('iosChromeOpenSafari');
  const footerLink = document.getElementById('installFooterLink');

  const ua = navigator.userAgent || '';
  const standaloneMatch = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = window.navigator && window.navigator.standalone === true;
  const isStandalone = !!(standaloneMatch || iosStandalone);
  const platform = detectPlatform(ua, { standalone: isStandalone });

  if (isStandalone) {
    document.body.classList.add('standalone-mode');
    try { localStorage.setItem(STORAGE_KEYS.installed, 'true'); } catch {}
    try {
      if (!localStorage.getItem(STORAGE_KEYS.completed)) {
        localStorage.setItem(STORAGE_KEYS.completed, 'true');
      }
    } catch {}
    return { platform, standalone: true };
  }

  try {
    if (!localStorage.getItem(STORAGE_KEYS.firstSeen)) {
      localStorage.setItem(STORAGE_KEYS.firstSeen, String(Date.now()));
    }
  } catch {}

  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (ev) => {
    ev.preventDefault();
    deferredPrompt = ev;
  });
  window.addEventListener('appinstalled', () => {
    try { localStorage.setItem(STORAGE_KEYS.completed, 'true'); } catch {}
    try { localStorage.setItem(STORAGE_KEYS.installed, 'true'); } catch {}
    hideBanner();
  });

  let interactionRecorded = false;
  const recordInteraction = () => {
    if (interactionRecorded) return;
    interactionRecorded = true;
    try { localStorage.setItem(STORAGE_KEYS.interacted, 'true'); } catch {}
    scheduleBannerCheck();
  };
  ['pointerdown', 'touchstart', 'scroll', 'keydown'].forEach((ev) => {
    window.addEventListener(ev, recordInteraction, { once: true, passive: true });
  });

  let bannerCheckTimer = null;
  function scheduleBannerCheck() {
    const firstSeen = Number(localStorage.getItem(STORAGE_KEYS.firstSeen) || Date.now());
    const elapsed = Date.now() - firstSeen;
    const remaining = Math.max(0, ENGAGEMENT_MS - elapsed);
    clearTimeout(bannerCheckTimer);
    bannerCheckTimer = setTimeout(maybeShowBanner, remaining + 50);
  }
  scheduleBannerCheck();

  function readStorage() {
    return {
      installed: safeGet(STORAGE_KEYS.installed),
      dismissedUntil: safeGet(STORAGE_KEYS.dismissedUntil),
      completed: safeGet(STORAGE_KEYS.completed),
      firstSeen: safeGet(STORAGE_KEYS.firstSeen),
      interacted: safeGet(STORAGE_KEYS.interacted),
    };
  }
  function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }

  function applyTranslations() {
    const lang = getLanguage() || 'en';
    if (titleEl) setI18nText(titleEl, tInstall('bannerTitle', lang));
    if (installBtn) setI18nText(installBtn, tInstall('bannerInstall', lang));
    if (dismissBtn) setI18nText(dismissBtn, tInstall('bannerDismiss', lang));
    document.querySelectorAll('[data-install-i18n]').forEach((node) => {
      const key = node.getAttribute('data-install-i18n');
      setI18nText(node, tInstall(key, lang));
    });
    if (footerLink) setI18nText(footerLink, tInstall('footerInstallLink', lang));
  }

  function showBanner() {
    if (!banner) return;
    applyTranslations();
    banner.classList.remove('hidden');
    requestAnimationFrame(() => banner.classList.add('visible'));
  }
  function hideBanner() {
    if (!banner) return;
    banner.classList.remove('visible');
    setTimeout(() => banner.classList.add('hidden'), 280);
  }

  function maybeShowBanner() {
    const storage = readStorage();
    const show = shouldShowBanner({
      storage,
      now: Date.now(),
      standalone: false,
      platform,
    });
    if (show) showBanner();
  }

  function openIosModal() {
    if (!iosModal) return;
    applyTranslations();
    iosModal.classList.remove('hidden');
    requestAnimationFrame(() => iosModal.classList.add('visible'));
    iosModal.focus();
  }
  function closeIosModal() {
    if (!iosModal) return;
    iosModal.classList.remove('visible');
    setTimeout(() => iosModal.classList.add('hidden'), 240);
  }
  function openIosChromeModal() {
    if (!iosChromeModal) return;
    applyTranslations();
    const urlEl = document.getElementById('installModalUrl');
    if (urlEl) urlEl.textContent = window.location.href;
    iosChromeModal.classList.remove('hidden');
    requestAnimationFrame(() => iosChromeModal.classList.add('visible'));
    iosChromeModal.focus();
  }
  function closeIosChromeModal() {
    if (!iosChromeModal) return;
    iosChromeModal.classList.remove('visible');
    setTimeout(() => iosChromeModal.classList.add('hidden'), 240);
  }

  installBtn?.addEventListener('click', async () => {
    if (platform === 'android-chrome' || platform === 'desktop-chrome') {
      if (!deferredPrompt) {
        // Browser hasn't fired beforeinstallprompt yet (eligibility criteria not met
        // this session, or already-installed-once edge case). Tell the user where
        // the manual install lives instead of silently no-op'ing.
        if (typeof showToast === 'function') {
          showToast(tInstall('fallbackPrompt', getLanguage() || 'en'));
        }
        return;
      }
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (choice && choice.outcome === 'accepted') {
          try { localStorage.setItem(STORAGE_KEYS.completed, 'true'); } catch {}
          try { localStorage.setItem(STORAGE_KEYS.installed, 'true'); } catch {}
          hideBanner();
        } else {
          try { localStorage.setItem(STORAGE_KEYS.dismissedUntil, String(dismissUntilTimestamp())); } catch {}
          hideBanner();
        }
      } catch {
        hideBanner();
      }
      return;
    }
    if (platform === 'ios-safari') { openIosModal(); return; }
    if (platform === 'ios-chrome') { openIosChromeModal(); return; }
  });

  dismissBtn?.addEventListener('click', () => {
    try { localStorage.setItem(STORAGE_KEYS.dismissedUntil, String(dismissUntilTimestamp())); } catch {}
    hideBanner();
  });

  iosModalClose?.addEventListener('click', closeIosModal);
  iosChromeClose?.addEventListener('click', closeIosChromeModal);
  iosModal?.addEventListener('click', (ev) => { if (ev.target === iosModal) closeIosModal(); });
  iosChromeModal?.addEventListener('click', (ev) => { if (ev.target === iosChromeModal) closeIosChromeModal(); });
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    if (iosModal && !iosModal.classList.contains('hidden')) closeIosModal();
    if (iosChromeModal && !iosChromeModal.classList.contains('hidden')) closeIosChromeModal();
  });

  iosChromeOpenBtn?.addEventListener('click', () => {
    try {
      window.location.href = `x-safari-${window.location.href}`;
    } catch { /* leave modal open with copy fallback */ }
    try { navigator.clipboard?.writeText(window.location.href).catch(() => {}); } catch {}
  });

  footerLink?.addEventListener('click', (ev) => {
    ev.preventDefault();
    try { localStorage.removeItem(STORAGE_KEYS.dismissedUntil); } catch {}
    if (platform === 'ios-safari') { openIosModal(); return; }
    if (platform === 'ios-chrome') { openIosChromeModal(); return; }
    showBanner();
  });

  applyTranslations();

  return {
    platform,
    standalone: false,
    show: showBanner,
    hide: hideBanner,
    openIosModal,
    openIosChromeModal,
    refreshLanguage: applyTranslations,
  };
}

/* -------- /install landing-page helper (DOM-built, no innerHTML) -------- */

export function renderLandingPage(host, { lang = 'en', uaString = (typeof navigator !== 'undefined' ? navigator.userAgent : '') } = {}) {
  if (!host) return null;
  const standalone = (typeof window !== 'undefined' && window.matchMedia &&
    window.matchMedia('(display-mode: standalone)').matches) ||
    (typeof window !== 'undefined' && window.navigator?.standalone === true);
  const platform = detectPlatform(uaString, { standalone });
  const tx = (k) => tInstall(k, lang);

  while (host.firstChild) host.removeChild(host.firstChild);

  const section = el('section', { class: 'install-landing' });

  const header = el('header', { class: 'install-hero' });
  const heroIcon = el('div', { class: 'install-hero-icon' });
  heroIcon.appendChild(svgFromMarkup(pwLogoSvg()));
  header.appendChild(heroIcon);
  header.appendChild(el('h1', { text: tx('landingHero') }));
  header.appendChild(el('p', { class: 'install-hero-subhead', text: tx('landingSubhead') }));
  section.appendChild(header);

  // Platform-specific CTA card
  let ctaCard;
  if (standalone) {
    ctaCard = el('div', { class: 'install-card install-already' },
      el('p', { text: tx('alreadyInstalled') }));
  } else if (platform === 'android-chrome' || platform === 'desktop-chrome') {
    const btn = el('button', { id: 'landingInstallNow', class: 'install-cta-btn', type: 'button', text: tx('installNow') });
    const hint = el('p', { id: 'landingInstallHint', class: 'install-cta-hint', hidden: true });
    ctaCard = el('div', { class: 'install-card' }, btn, hint);
  } else if (platform === 'ios-safari') {
    const list = el('ol', { class: 'install-step-list' });
    const stepRow = (n, iconMarkup, text) => {
      const li = el('li');
      li.appendChild(el('span', { class: 'install-step-num', text: String(n) }));
      const iconWrap = el('span', { class: 'install-step-icon' });
      iconWrap.appendChild(svgFromMarkup(iconMarkup));
      li.appendChild(iconWrap);
      const textSpan = el('span');
      setI18nText(textSpan, text);
      li.appendChild(textSpan);
      return li;
    };
    list.appendChild(stepRow(1, iosShareIcon(), tx('iosStep1')));
    list.appendChild(stepRow(2, addToHomeIcon(), tx('iosStep2')));
    list.appendChild(stepRow(3, plusIcon(), tx('iosStep3')));
    ctaCard = el('div', { class: 'install-card install-steps' },
      el('h3', { text: tx('iosTitle') }),
      list,
    );
  } else if (platform === 'ios-chrome') {
    ctaCard = el('div', { class: 'install-card' },
      el('h3', { text: tx('iosChromeTitle') }),
      el('p', { text: tx('iosChromeBody') }),
      el('button', { id: 'landingOpenSafari', class: 'install-cta-btn', type: 'button', text: tx('iosChromeOpenSafari') }),
      el('p', { class: 'install-cta-hint', text: tx('iosChromeFallback') }),
      el('code', { class: 'install-cta-url', text: (typeof window !== 'undefined' ? window.location.origin : '') }),
    );
  } else {
    const origin = (typeof window !== 'undefined' ? window.location.origin : '');
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(origin)}`;
    ctaCard = el('div', { class: 'install-card install-desktop-other' },
      el('h3', { text: tx('desktopOpenOnPhone') }),
      el('p', { text: tx('desktopQrHint') }),
      el('div', { class: 'install-qr' },
        el('img', { src: qrSrc, alt: `QR code to ${origin}`, width: '180', height: '180', loading: 'lazy' }),
      ),
    );
  }
  section.appendChild(ctaCard);

  // Why card
  const whyCard = el('section', { class: 'install-card install-why' });
  whyCard.appendChild(el('h3', { text: tx('whyTitle') }));
  const ul = el('ul');
  const bullets = INSTALL_T.whyBullets[lang] || INSTALL_T.whyBullets.en;
  for (const b of bullets) ul.appendChild(el('li', { text: b }));
  whyCard.appendChild(ul);
  section.appendChild(whyCard);

  // How details
  const details = el('details', { class: 'install-how' });
  details.appendChild(el('summary', { text: tx('howTitle') }));
  details.appendChild(el('p', { text: tx('howBody') }));
  section.appendChild(details);

  host.appendChild(section);

  // Wire interactive bits
  const installNowBtn = host.querySelector('#landingInstallNow');
  if (installNowBtn) {
    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (ev) => {
      ev.preventDefault();
      deferredPrompt = ev;
    });
    installNowBtn.addEventListener('click', async () => {
      if (!deferredPrompt) {
        const hint = host.querySelector('#landingInstallHint');
        if (hint) {
          hint.textContent = INSTALL_T.iosChromeFallback[lang] || INSTALL_T.iosChromeFallback.en;
          hint.hidden = false;
        }
        return;
      }
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (choice?.outcome === 'accepted') {
          try { localStorage.setItem(STORAGE_KEYS.completed, 'true'); } catch {}
          try { localStorage.setItem(STORAGE_KEYS.installed, 'true'); } catch {}
        }
      } catch { /* swallowed */ }
    });
  }
  const openSafariBtn = host.querySelector('#landingOpenSafari');
  if (openSafariBtn) {
    openSafariBtn.addEventListener('click', () => {
      try {
        window.location.href = `x-safari-${window.location.href}`;
      } catch { /* swallowed */ }
      try { navigator.clipboard?.writeText(window.location.origin).catch(() => {}); } catch {}
    });
  }

  return { platform, standalone };
}

/* -------- Inline SVG icon strings -------- */

export function iosShareIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v13"/><path d="M7 8l5-5 5 5"/><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>`;
}
export function addToHomeIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>`;
}
export function plusIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>`;
}
export function pwLogoSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="56" height="56" aria-hidden="true">
    <defs><linearGradient id="pwGradInstall" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFDD44"/><stop offset="100%" stop-color="#FFAA00"/>
    </linearGradient></defs>
    <circle cx="50" cy="50" r="48" fill="url(#pwGradInstall)"/>
    <path fill="#fff" d="M25 22 L25 78 L40 78 L40 54 L52 54 Q70 54 70 38 Q70 22 52 22 Z M40 34 L50 34 Q56 34 56 38 Q56 44 50 44 L40 44 Z"/>
  </svg>`;
}

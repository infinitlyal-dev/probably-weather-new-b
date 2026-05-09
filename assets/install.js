/* Probably Weather — PWA Install Card
   Always-visible inline card at the bottom of the page on iOS, with an
   accordion-style "Show me how" expansion that reveals the 3-step
   Add-to-Home-Screen guide. Platform-specific content:
   - iOS Chrome: 3 steps starting with an "Open in Safari" handoff button
   - iOS Safari: 3 Share/Add-to-Home/Add steps + Edit Actions hint
   No engagement gate, no auto-open triggers, no URL handoff signals.
   The card is shown unconditionally on iOS until the user dismisses it. */

export const STORAGE_KEYS = {
  cardDismissed: 'pw-install-card-dismissed',
};

/* -------- Translations (all 5 SA languages: en, af, zu, xh, st) -------- */
export const INSTALL_T = {
  cardTitle: {
    en: 'Install Probably Weather',
    af: 'Installeer Probably Weather',
    zu: 'Faka i-Probably Weather',
    xh: 'Faka i-Probably Weather',
    st: 'Kenya Probably Weather',
  },
  cardSubtitle: {
    en: 'Add to your home screen for the best experience',
    af: 'Voeg by jou tuisskerm vir die beste ervaring',
    zu: 'Engeza kusikrini sakho sasekhaya ukuze uthole okuhle kakhulu',
    xh: 'Yongeza kwiscreen sakho sasekhaya ukuze ufumane okona kuhle',
    st: 'Eketsa skrineng sa hao sa lehae bakeng sa boiphihlelo bo molemo',
  },
  cardShowMeHow: {
    en: 'Show me how',
    af: 'Wys my hoe',
    zu: 'Ngitshele kanjani',
    xh: 'Ndibonise indlela',
    st: 'Mpontshe ka mokhoa',
  },
  cardDismissLabel: {
    en: 'Dismiss',
    af: 'Maak toe',
    zu: 'Cashisa',
    xh: 'Cima',
    st: 'Tlohela',
  },

  // 3-step Add-to-Home guide content (rendered into the expanded card).
  // iOS native UI labels (Share, Add to Home Screen, Add, Edit Actions)
  // stay English in every language because that's what iOS Safari literally
  // renders on screen. Backticks mark segments rendered as <code> "gold pill"
  // chips so users can pattern-match against the actual iOS UI.
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

  // iOS Chrome-specific: step 1 is "tap the button below to switch to
  // Safari" — the button itself fires the bare x-safari- URL. Steps 2 and
  // 3 preview what comes next once Safari is open.
  iosChromeStep1Tap: {
    en: 'Tap to open in Safari',
    af: 'Tik om in Safari oop te maak',
    zu: 'Thepha ukuze uvule ku-Safari',
    xh: 'Cofa ukuze uvule kwi-Safari',
    st: 'Tobetsa ho bula ho Safari',
  },
  iosChromeStep2Share: {
    en: 'In Safari, tap the `Share` button',
    af: 'Tik in Safari op die `Share`-knoppie',
    zu: 'Ku-Safari, thepha inkinobho ye-`Share`',
    xh: 'Kwi-Safari, cofa iqhosha le-`Share`',
    st: 'Ho Safari, tobetsa konopo ya `Share`',
  },
  iosChromeStep3Add: {
    en: 'Tap `Add to Home Screen`',
    af: 'Tik op `Add to Home Screen`',
    zu: 'Thepha `Add to Home Screen`',
    xh: 'Cofa `Add to Home Screen`',
    st: 'Tobetsa `Add to Home Screen`',
  },
  iosChromeOpenSafari: {
    en: 'Open in Safari',
    af: 'Maak in Safari oop',
    zu: 'Vula ku-Safari',
    xh: 'Vula kwi-Safari',
    st: 'Bula ho Safari',
  },
  iosEditActionsHint: {
    en: 'Don’t see `Add to Home Screen`? Tap `Edit Actions` at the bottom of the Share menu and enable it.',
    af: 'Sien jy nie `Add to Home Screen` nie? Tik `Edit Actions` onder in die Deel-kieslys en skakel dit aan.',
    zu: 'Awuyiboni i-`Add to Home Screen`? Thepha u-`Edit Actions` ezansi kwemenyu ye-Share, bese uyivumela.',
    xh: 'Awuyiboni i-`Add to Home Screen`? Cofa u-`Edit Actions` ezantsi kwimenyu ye-Share, uyivumele.',
    st: 'Ha o bone `Add to Home Screen`? Tobetsa `Edit Actions` ka tlase ho menyu ya Share, ebe u e nolofatsa.',
  },

  // Footer link re-shows the card if the user previously dismissed it.
  footerInstallLink: {
    en: 'Install Probably Weather',
    af: 'Installeer Probably Weather',
    zu: 'Faka i-Probably Weather',
    xh: 'Faka i-Probably Weather',
    st: 'Kenya Probably Weather',
  },

  // /install landing-page strings (used by renderLandingPage for shared
  // WhatsApp links). Unchanged from the previous design.
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
};

/* -------- Pure functions (testable without DOM) -------- */

export function tInstall(key, lang = 'en') {
  const entry = INSTALL_T[key];
  if (!entry) return key;
  return entry[lang] || entry.en || key;
}

/**
 * Detect platform from a User-Agent string.
 * Returns one of: 'android-chrome', 'ios-safari', 'ios-chrome',
 * 'desktop-chrome', 'desktop-other', 'other'.
 */
export function detectPlatform(uaString = '') {
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
 * Decide whether the install card should be shown. Pure function.
 * Card is iOS-only, hidden in standalone mode, hidden after explicit dismiss.
 */
export function shouldShowCard({ storage = {}, standalone = false, platform = 'other' } = {}) {
  if (standalone) return false;
  if (storage.cardDismissed === '1' || storage.cardDismissed === 1 || storage.cardDismissed === true) return false;
  return platform === 'ios-safari' || platform === 'ios-chrome';
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
  const parser = new DOMParser();
  const doc = parser.parseFromString(markup, 'image/svg+xml');
  return doc.documentElement;
}

/**
 * Render a translation string into a DOM node, splitting on backticks.
 * Even-indexed segments are plain text; odd-indexed segments are wrapped in
 * <code class="install-os-label"> to render as gold pills for native iOS UI
 * labels (Share, Add to Home Screen, Edit Actions, Add).
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

export function initInstallExperience({ getLanguage = () => 'en' } = {}) {
  if (typeof window === 'undefined') return null;

  const card = document.getElementById('installCard');
  const footerLink = document.getElementById('installFooterLink');

  const ua = navigator.userAgent || '';
  const standaloneMatch = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = window.navigator && window.navigator.standalone === true;
  const isStandalone = !!(standaloneMatch || iosStandalone);
  const platform = detectPlatform(ua);

  if (isStandalone) {
    document.body.classList.add('standalone-mode');
    if (card) card.hidden = true;
    if (footerLink) footerLink.hidden = true;
    return { platform, standalone: true };
  }

  // Card is iOS-only. Android and desktop get nothing from this module —
  // Android Chrome shows its own native PWA install affordance (URL-bar
  // icon / mini-infobar) which we no longer intercept.
  const isIos = platform === 'ios-safari' || platform === 'ios-chrome';
  if (!isIos) {
    if (card) card.hidden = true;
    if (footerLink) footerLink.hidden = true;
    return { platform, standalone: false };
  }

  if (!card) return { platform, standalone: false };

  const titleEl = document.getElementById('installCardTitle');
  const subtitleEl = document.getElementById('installCardSubtitle');
  const showBtn = document.getElementById('installCardShow');
  const dismissBtn = document.getElementById('installCardDismiss');
  const stepsContainer = document.getElementById('installCardSteps');

  // Hide if the user previously dismissed.
  const isDismissed = (() => {
    try { return localStorage.getItem(STORAGE_KEYS.cardDismissed) === '1'; } catch { return false; }
  })();
  if (isDismissed) {
    card.hidden = true;
  } else {
    card.hidden = false;
  }

  function applyTranslations() {
    const lang = getLanguage() || 'en';
    if (titleEl) setI18nText(titleEl, tInstall('cardTitle', lang));
    if (subtitleEl) setI18nText(subtitleEl, tInstall('cardSubtitle', lang));
    if (showBtn) setI18nText(showBtn, tInstall('cardShowMeHow', lang));
    if (dismissBtn) dismissBtn.setAttribute('aria-label', tInstall('cardDismissLabel', lang));
    if (footerLink) setI18nText(footerLink, tInstall('footerInstallLink', lang));
    // Repopulate the expanded steps so language switches refresh them.
    if (stepsContainer && card.classList.contains('expanded')) {
      renderSteps();
    }
  }

  function renderSteps() {
    if (!stepsContainer) return;
    while (stepsContainer.firstChild) stepsContainer.removeChild(stepsContainer.firstChild);
    const lang = getLanguage() || 'en';
    const list = el('ol', { class: 'install-step-list' });

    const stepRow = (n, iconMarkup, text, extra = null) => {
      const li = el('li');
      li.appendChild(el('span', { class: 'install-step-num', text: String(n) }));
      const iconWrap = el('span', { class: 'install-step-icon', 'aria-hidden': 'true' });
      iconWrap.appendChild(svgFromMarkup(iconMarkup));
      li.appendChild(iconWrap);
      const textSpan = el('span');
      setI18nText(textSpan, text);
      li.appendChild(textSpan);
      if (extra) li.appendChild(extra);
      return li;
    };

    if (platform === 'ios-chrome') {
      // Step 1: Tap to open in Safari + primary CTA button on the same row.
      const openBtn = el('button', {
        type: 'button',
        id: 'installCardOpenSafari',
        class: 'install-card-cta',
        text: tInstall('iosChromeOpenSafari', lang),
      });
      openBtn.addEventListener('click', () => {
        // Bare x-safari- URL: no params, no hash. The previous design
        // tried to carry install intent across the handoff via ?install=1
        // and #install — neither is reliable on real iOS.
        try {
          window.location.href = `x-safari-https://${window.location.host}${window.location.pathname}`;
        } catch {}
      });
      list.appendChild(stepRow(1, safariCompassIcon(), tInstall('iosChromeStep1Tap', lang), openBtn));
      list.appendChild(stepRow(2, iosShareIcon(), tInstall('iosChromeStep2Share', lang)));
      list.appendChild(stepRow(3, addToHomeIcon(), tInstall('iosChromeStep3Add', lang)));
    } else {
      // ios-safari: full Add-to-Home flow + Edit Actions hint.
      list.appendChild(stepRow(1, iosShareIcon(), tInstall('iosStep1', lang)));
      list.appendChild(stepRow(2, addToHomeIcon(), tInstall('iosStep2', lang)));
      list.appendChild(stepRow(3, plusIcon(), tInstall('iosStep3', lang)));
    }
    stepsContainer.appendChild(list);

    const hint = el('p', { class: 'install-step-hint' });
    setI18nText(hint, tInstall('iosEditActionsHint', lang));
    stepsContainer.appendChild(hint);
  }

  function expand() {
    if (!stepsContainer) return;
    // firstElementChild ignores HTML comments / whitespace text nodes that
    // may exist in the markup placeholder — only counts real elements.
    if (!stepsContainer.firstElementChild) renderSteps();
    card.classList.add('expanded');
    stepsContainer.hidden = false;
    if (showBtn) {
      showBtn.hidden = true;
      showBtn.setAttribute('aria-expanded', 'true');
    }
  }

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEYS.cardDismissed, '1'); } catch {}
    card.hidden = true;
  }

  function reopen() {
    try { localStorage.removeItem(STORAGE_KEYS.cardDismissed); } catch {}
    card.hidden = false;
    expand();
  }

  showBtn?.addEventListener('click', expand);
  dismissBtn?.addEventListener('click', dismiss);
  footerLink?.addEventListener('click', (ev) => {
    ev.preventDefault();
    reopen();
  });

  applyTranslations();

  return {
    platform,
    standalone: false,
    expand,
    dismiss,
    reopen,
    refreshLanguage: applyTranslations,
  };
}

/* -------- /install landing-page helper (DOM-built, no innerHTML) -------- */

export function renderLandingPage(host, { lang = 'en', uaString = (typeof navigator !== 'undefined' ? navigator.userAgent : '') } = {}) {
  if (!host) return null;
  const standalone = (typeof window !== 'undefined' && window.matchMedia &&
    window.matchMedia('(display-mode: standalone)').matches) ||
    (typeof window !== 'undefined' && window.navigator?.standalone === true);
  const platform = detectPlatform(uaString);
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

  // Platform-specific CTA card on the landing page
  let ctaCard;
  if (standalone) {
    ctaCard = el('div', { class: 'install-card-landing install-already' },
      el('p', { text: tx('alreadyInstalled') }));
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
    ctaCard = el('div', { class: 'install-card-landing install-steps' },
      el('h3', { text: tx('cardTitle') }),
      list,
    );
  } else if (platform === 'ios-chrome') {
    const openBtn = el('button', { id: 'landingOpenSafari', class: 'install-cta-btn', type: 'button', text: tx('iosChromeOpenSafari') });
    openBtn.addEventListener('click', () => {
      try {
        window.location.href = `x-safari-https://${window.location.host}/`;
      } catch {}
    });
    ctaCard = el('div', { class: 'install-card-landing' },
      el('h3', { text: tx('cardTitle') }),
      el('p', { text: tx('cardSubtitle') }),
      openBtn,
    );
  } else {
    // Desktop or unknown: show a QR pointing back to the site so the user
    // can scan it on their phone.
    const origin = (typeof window !== 'undefined' ? window.location.origin : '');
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(origin)}`;
    ctaCard = el('div', { class: 'install-card-landing install-desktop-other' },
      el('h3', { text: tx('desktopOpenOnPhone') }),
      el('p', { text: tx('desktopQrHint') }),
      el('div', { class: 'install-qr' },
        el('img', { src: qrSrc, alt: `QR code to ${origin}`, width: '180', height: '180', loading: 'lazy' }),
      ),
    );
  }
  section.appendChild(ctaCard);

  // Why card
  const whyCard = el('section', { class: 'install-card-landing install-why' });
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
export function safariCompassIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M16.24 7.76 13.06 13.06 7.76 16.24 10.94 10.94 16.24 7.76z"/></svg>`;
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

/* Probably Weather — PWA Install Experience
   Self-contained module: engagement gate, platform detection, banner orchestration,
   iOS instruction modal, iOS-Chrome handoff modal, /install landing-page helper.
   Exports a small pure surface for unit testing alongside the DOM init function. */

export const STORAGE_KEYS = {
  installed: 'pw_installed',
  dismissedUntil: 'pw_install_dismissed_until',
  completed: 'pw_install_completed',
  firstSeen: 'pw_install_first_seen',
};

export const DISMISS_DAYS = 7;
// Banner appears on a short timer alone — no interaction gesture required.
// Users coming from a shared link (WhatsApp etc.) see the install banner
// ~1.5s after page load. The previous 10s + interaction gate suppressed
// the banner for users who landed on the page and didn't move within 10s.
export const ENGAGEMENT_MS = 1500;

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
  // iOS native UI labels (Share, Add to Home Screen, Edit Actions) stay
  // English in every language — that's what iOS Safari literally renders
  // on screen. Backticks mark segments wrapped in <code class="install-os-label">
  // (gold pill) so users can pattern-match them visually against the
  // actual iOS UI. The `×` in step 3 is also wrapped in a pill so it
  // visually maps to the × button in the modal's top-right corner.
  iosStep1: {
    en: "Tap Safari's `Share` button at the bottom of your screen",
    af: "Tik op Safari se `Share`-knoppie onder aan jou skerm",
    zu: 'Thepha inkinobho `Share` ye-Safari ngezansi kwesikrini sakho',
    xh: 'Cofa iqhosha `Share` le-Safari ezantsi kwiscreen yakho',
    st: 'Tobetsa konopo ya `Share` ya Safari ka tlase ho skirini sa hao',
  },
  iosStep2: {
    en: 'Scroll, tap `Add to Home Screen`',
    af: 'Scroll, tik op `Add to Home Screen`',
    zu: 'Skrolela, thepha `Add to Home Screen`',
    xh: 'Skrolela, cofa `Add to Home Screen`',
    st: 'Theosa, tobetsa `Add to Home Screen`',
  },
  iosStep3: {
    en: 'Tap `×` above to close these instructions',
    af: 'Tik `×` hierbo om hierdie instruksies toe te maak',
    zu: 'Thepha `×` ngenhla ukuvala lezi ziyalezo',
    xh: 'Cofa `×` ngentla ukuvala le miyalelo',
    st: 'Tobetsa `×` ka holimo ho koala litaelo tsena',
  },
  // Confirmation line below the 3 steps — positive close, distinct from
  // the steps. Reads as "you're done" rather than a fourth instruction.
  iosConfirmation: {
    en: 'Probably Weather will appear on your home screen — tap the icon to open the app.',
    af: 'Probably Weather sal op jou tuisskerm verskyn — tik die ikoon om die program oop te maak.',
    zu: 'I-Probably Weather izovela kusikrini sakho sasekhaya — thepha i-icon ukuze uvule uhlelo lokusebenza.',
    xh: 'I-Probably Weather iya kuvela kwiscreen yakho yasekhaya — cofa i-icon ukuze uvule i-app.',
    st: 'Probably Weather e tla hlaha skrineng sa hao sa lehae — tobetsa letshwao ho bula app.',
  },
  // Auxiliary hint at the bottom — for users who can't find Add to Home
  // Screen in the Share menu (iOS gates it behind Edit Actions on first use).
  iosEditActionsHint: {
    en: "Don't see `Add to Home Screen`? Tap `Edit Actions` at the bottom of the Share menu and turn it on.",
    af: 'Sien jy nie `Add to Home Screen` nie? Tik `Edit Actions` onder in die Deel-kieslys en skakel dit aan.',
    zu: 'Awuyiboni i-`Add to Home Screen`? Thepha u-`Edit Actions` ezansi kwemenyu ye-Share, bese uyivumela.',
    xh: 'Awuyiboni i-`Add to Home Screen`? Cofa u-`Edit Actions` ezantsi kwimenyu ye-Share, uyivumele.',
    st: 'Ha o bone `Add to Home Screen`? Tobetsa `Edit Actions` ka tlase ho menyu ya Share, ebe u e nolofatsa.',
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
    st: 'Chrome ho iPhone e ke ke ea kenya li-app. Tobetsa ka tlase ho bula sebaka sena ho Safari, ebe u latela mehato',
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
  // Footer link on /install landing page that triggers the ?reset=1 wipe.
  // Defensive escape hatch when install state is stuck on a real device
  // and the user has no devtools access.
  resetInstallState: {
    en: 'Reset install state',
    af: 'Herstel installeer-data',
    zu: 'Sula idatha yokufaka',
    xh: 'Sula idatha yokufaka',
    st: 'Hlakola data ya ho kenya',
  },
  fallbackPrompt: {
    en: 'Tap your browser menu, then Install app — or try again in a moment.',
    af: "Tik op jou blaaier-kieslys, dan Installeer app — of probeer 'n oomblik weer.",
    zu: 'Thepha imenyu yesiphequluli, bese Faka uhlelo lokusebenza — noma uzame futhi ngomzuzwana.',
    xh: 'Cofa imenyu yebrawza, ze ufakele i-app — okanye uzame kwakhona ngomzuzwana.',
    st: 'Tobetsa menyu ea sebatli, ebe Kenya app — kapa leka hape ka motsotsoana.',
  },
  /* -- In-app browser breakout flow (WhatsApp, Instagram, Facebook, etc.) --
     Strings use `{app}` as a placeholder for the detected app name (brand
     names stay untranslated). Voice: direct, slightly wry, no corporate-speak. */
  inAppHeading: {
    en: 'Pop us open properly',
    af: 'Maak ons behoorlik oop',
    zu: 'Sivule kahle',
    xh: 'Sivule kakuhle',
    st: 'Re bule hantle',
  },
  inAppExplain: {
    en: "You're in {app}'s built-in browser. It can't install apps.",
    af: 'Jy is in {app} se ingeboude blaaier. Dit kan nie programme installeer nie.',
    zu: 'Usebenzisa isiphequluli esakhelwe ngaphakathi sika-{app}. Asikwazi ukufaka izinhlelo zokusebenza.',
    xh: 'Usebenzisa ibrawza eyakhelwe ngaphakathi ye-{app}. Ayikwazi ukufaka iiapp.',
    st: 'O sebelisa sebatli se kentsoeng ka hare ho {app}. Ha se khone ho kenya li-app.',
  },
  inAppOpenInChrome: {
    en: 'Open in Chrome',
    af: 'Maak in Chrome oop',
    zu: 'Vula ku-Chrome',
    xh: 'Vula kwi-Chrome',
    st: 'Bula ho Chrome',
  },
  inAppIosManual: {
    en: "iPhone? Tap the ⋯ menu in {app} and choose 'Open in Safari'. That's the only way Apple lets us through.",
    af: "iPhone? Tik die ⋯ kieslys in {app} en kies 'Open in Safari'. Dit is die enigste manier waarop Apple ons deurlaat.",
    zu: "iPhone? Thepha imenyu ye-⋯ ku-{app} bese ukhetha 'Open in Safari'. Yiyo kuphela indlela u-Apple asivumela ngayo.",
    xh: "iPhone? Cofa imenyu ye-⋯ kwi-{app} ukhethe 'Open in Safari'. Yiyo kuphela indlela u-Apple usivumela ngayo.",
    st: "iPhone? Tobetsa menyu ea ⋯ ho {app} u khethe 'Open in Safari'. Ke yona feela tsela eo Apple e re fang.",
  },
  inAppCopyLink: {
    en: 'Copy link',
    af: 'Kopieer skakel',
    zu: 'Kopisha isixhumanisi',
    xh: 'Kopa isixhumanisi',
    st: 'Kopitsa sehokelo',
  },
  inAppLinkCopied: {
    en: 'Link copied — paste it into your browser.',
    af: 'Skakel gekopieer — plak dit in jou blaaier.',
    zu: 'Isixhumanisi sikopishiwe — sinamathisele esipheqululini sakho.',
    xh: 'Isixhumanisi sicophiwe — sincamathisele kwibrawza yakho.',
    st: 'Sehokelo se kopitsoe — se kenye sebatling sa hao.',
  },
  inAppFallbackHint: {
    en: 'Having trouble? Open this page in Chrome (Android) or Safari (iPhone).',
    af: 'Sukkel jy? Maak hierdie blad in Chrome (Android) of Safari (iPhone) oop.',
    zu: 'Unenkinga? Vula leli khasi ku-Chrome (Android) noma i-Safari (iPhone).',
    xh: 'Unobunzima? Vula eli phepha kwi-Chrome (Android) okanye i-Safari (iPhone).',
    st: 'U na le bothata? Bula leqephe lena ho Chrome (Android) kapa Safari (iPhone).',
  },
  // Samsung One UI's Play Protect flags Chrome's WebAPK install with an
  // "Unsafe app blocked" dialog. It's not PW — Samsung is overcautious about
  // any non-Play-Store install. We surface this BEFORE the user taps Install
  // so they know what to expect and how to proceed.
  // EN/AF use translated UI labels (Afrikaans One UI does localize them);
  // zu/xh/st keep the English labels because users on those locales typically
  // see the English One UI strings and need to pattern-match what's on screen.
  samsungPlayProtect: {
    en: "Samsung phones sometimes show a 'Google Play Protect — Unsafe app' warning when installing. It's Samsung being twitchy — Probably Weather is safe. Tap 'More details' → 'Install anyway'.",
    af: "Samsung-fone wys soms 'n 'Google Play Protect — Onveilige app' waarskuwing. Dis Samsung wat senuagtig is — Probably Weather is veilig. Tik 'Meer besonderhede' → 'Installeer in elk geval'.",
    zu: "Amafoni e-Samsung kwesinye isikhathi abonisa isexwayiso esithi 'Google Play Protect — Unsafe app' uma ufaka. Yi-Samsung enovalo nje — i-Probably Weather iphephile. Thepha 'More details' → 'Install anyway'.",
    xh: "Iifowuni ze-Samsung ngamanye amaxesha zibonisa isilumkiso esithi 'Google Play Protect — Unsafe app' xa ufakela. Yi-Samsung enexhala nje — i-Probably Weather ikhuselekile. Cofa 'More details' → 'Install anyway'.",
    st: "Difouno tsa Samsung ka linako tse ling li bontša temoso ya 'Google Play Protect — Unsafe app' ha o kenya. Ke Samsung e tšohileng feela — Probably Weather e bolokehile. Tobetsa 'More details' → 'Install anyway'.",
  },
  // Shown when the user taps "Install now" on android-chrome or desktop-chrome
  // and beforeinstallprompt never fired. Points at Chrome's ⋮ menu — the same
  // icon and labels work on both Android Chrome and desktop Chrome.
  // 'Install app' / 'Add to Home Screen' stay English because that's what
  // Chrome actually renders on screen (cf. iOS step strings at the top).
  installFallbackChromium: {
    en: "If nothing happens, tap the ⋮ menu above and choose 'Install app' or 'Add to Home Screen'.",
    af: "As niks gebeur nie, tik die ⋮ kieslys hierbo en kies 'Installeer app' of 'Voeg by Tuisskerm'.",
    zu: "Uma kungenzeki lutho, thepha imenyu ye-⋮ ngenhla bese ukhetha 'Install app' noma 'Add to Home Screen'.",
    xh: "Ukuba akukho nto yenzekayo, cofa imenyu ye-⋮ ngentla ukhethe 'Install app' okanye 'Add to Home Screen'.",
    st: "Haeba ho se na letho le etsahalang, tobetsa menyu ea ⋮ ka holimo u khethe 'Install app' kapa 'Add to Home Screen'.",
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
 * Detect known in-app browsers (WhatsApp / Instagram / Facebook / TikTok / etc.).
 * Returns `null` for real browsers, otherwise `{ app, os }` where `app` is the
 * human-readable brand label ("WhatsApp", "Facebook"...) and `os` is
 * 'android' | 'ios' | 'unknown'.
 *
 * These browsers can't install PWAs — when users tap a share link in WhatsApp
 * (etc.) the page opens in a Chrome Custom Tab or iOS WebView with the install
 * prompt unavailable. The /install landing page uses this to swap to a breakout
 * UI that points the user at a real browser.
 *
 * Order matters: Messenger's UA contains "FB..." tokens so it must be checked
 * BEFORE the Facebook pattern. iOS WebView fallback (last branch) catches
 * unknown in-app browsers on iOS — Apple's WebKit-only rule means any iOS
 * "browser" without the Safari UA token is almost certainly a WebView.
 */
export function detectInAppBrowser(uaString = '') {
  const ua = String(uaString || '');
  const osFor = (s) => /Android/i.test(s) ? 'android' : (/iPad|iPhone|iPod/.test(s) && !/Windows/.test(s) ? 'ios' : 'unknown');

  if (/Messenger/i.test(ua))                 return { app: 'Messenger', os: osFor(ua) };
  if (/Instagram/i.test(ua))                 return { app: 'Instagram', os: osFor(ua) };
  if (/WhatsApp/i.test(ua))                  return { app: 'WhatsApp',  os: osFor(ua) };
  if (/\b(FBAN|FBAV|FB_IAB|FBIOS)\b/.test(ua)) return { app: 'Facebook', os: osFor(ua) };
  if (/musical_ly|Bytedance/i.test(ua))      return { app: 'TikTok',    os: osFor(ua) };
  if (/\bTwitter\b/.test(ua))                return { app: 'Twitter',   os: osFor(ua) };
  if (/LinkedInApp/i.test(ua))               return { app: 'LinkedIn',  os: osFor(ua) };
  if (/Snapchat/i.test(ua))                  return { app: 'Snapchat',  os: osFor(ua) };

  // iOS WebView catch-all: iOS device with no Safari token and no known iOS
  // browser token (CriOS / FxiOS / EdgiOS) means we're inside a WebView from
  // some app that doesn't identify itself. Treat as in-app for breakout purposes.
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !/Windows/.test(ua);
  if (isIOS) {
    const hasSafari = /Safari\//.test(ua) && !/CriOS\/|FxiOS\/|EdgiOS\//.test(ua);
    const hasKnownIOSBrowser = /CriOS\/|FxiOS\/|EdgiOS\//.test(ua);
    if (!hasSafari && !hasKnownIOSBrowser) {
      return { app: 'WebView', os: 'ios' };
    }
  }
  return null;
}

/**
 * Detect Samsung Android devices (any browser).
 *
 * Samsung's One UI ships an aggressive Play Protect configuration that flags
 * Chrome's WebAPK install with "Unsafe app blocked — built for an older Android
 * version" — even though it's Chrome doing the work. Nothing in PW's codebase
 * triggers it. When detected, /install shows an honest note explaining what to
 * expect and how to proceed ('More details' → 'Install anyway').
 *
 * UA signals:
 *   - `SamsungBrowser/` — Samsung Internet (their default browser).
 *   - `SM-[A-Z]\d+`     — Samsung device model codes (SM-A245F, SM-G991B,
 *                         SM-S921U etc.) appear on EVERY Galaxy phone.
 *   - `SAMSUNG` token — appears in some UAs alongside the SM-* code.
 *
 * Restricted to Android so a Samsung TV or fridge UA can't false-trigger.
 */
export function isSamsungAndroid(uaString = '') {
  const ua = String(uaString || '');
  if (!/Android/.test(ua)) return false;
  return /SamsungBrowser\//.test(ua) || /\bSM-[A-Z]\d/.test(ua) || /\bSAMSUNG\b/.test(ua);
}

/**
 * Build an Android intent:// URL that opens the target URL in Chrome.
 * Includes `S.browser_fallback_url` so if Chrome isn't installed the user
 * lands on the original URL anyway (with hash preserved, since the fallback
 * is the full original URL — the intent path itself drops the hash because
 * `#` is the boundary character between the URL and intent parameters).
 *
 * Per Chrome's docs (developer.chrome.com/docs/android/intents): the click
 * MUST be initiated by a user gesture or Chrome refuses to launch the app.
 * Our breakout flow only fires on click so we're inside the gesture window.
 *
 * Returns null for non-http(s) URLs or unparsable input.
 */
export function buildAndroidIntentUrl(targetUrl) {
  try {
    const u = new URL(String(targetUrl));
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    const scheme = u.protocol.replace(':', '');
    const hostPath = u.host + u.pathname + (u.search || '');
    const fallback = encodeURIComponent(u.toString());
    return `intent://${hostPath}#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
  } catch {
    return null;
  }
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

export function initInstallExperience({ getLanguage = () => 'en', showToast = null, capturedPrompt = null } = {}) {
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
    try { window.__pwInstallInit = 'standalone-early-return'; } catch {}
    return { platform, standalone: true };
  }

  try {
    if (!localStorage.getItem(STORAGE_KEYS.firstSeen)) {
      localStorage.setItem(STORAGE_KEYS.firstSeen, String(Date.now()));
    }
  } catch {}

  let deferredPrompt = capturedPrompt;
  window.addEventListener('beforeinstallprompt', (ev) => {
    ev.preventDefault();
    deferredPrompt = ev;
  });
  window.addEventListener('appinstalled', () => {
    try { localStorage.setItem(STORAGE_KEYS.completed, 'true'); } catch {}
    try { localStorage.setItem(STORAGE_KEYS.installed, 'true'); } catch {}
    // Vercel Web Analytics: fire a custom event so install conversions
    // show up in the dashboard alongside page views. window.va is set up
    // in index.html as a queueing stub before the loader script lands,
    // so this call is safe even if /_vercel/insights/script.js hasn't
    // finished loading yet.
    try {
      if (typeof window !== 'undefined' && typeof window.va === 'function') {
        window.va('event', { name: 'app_installed' });
      }
    } catch {}
    hideBanner();
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
    // Hide the app's own Share pill while the modal is open — it sits at
    // the bottom-left and visually competes with iOS's native share sheet
    // when the user follows step 1.
    document.body.classList.add('install-modal-active');
  }
  function closeIosModal() {
    if (!iosModal) return;
    iosModal.classList.remove('visible');
    setTimeout(() => iosModal.classList.add('hidden'), 240);
    document.body.classList.remove('install-modal-active');
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

  // × tap is an explicit "I'm done with this" — by the time the user
  // taps it they've read the full install instructions, so they've
  // either followed them (banner shouldn't reappear) or chosen not to
  // (also shouldn't reappear). Set the existing pw_install_completed
  // flag for permanent banner suppression. The "Not now" banner button
  // keeps its softer 7-day dismissedUntil cooldown — different intent.
  // Backdrop tap (below) writes nothing — close-modal-only, forgiving
  // for accidental backdrop taps.
  iosModalClose?.addEventListener('click', () => {
    try { localStorage.setItem(STORAGE_KEYS.completed, 'true'); } catch {}
    closeIosModal();
    hideBanner();
  });
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

  try { window.__pwInstallInit = 'completed'; } catch {}

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
  const inApp = detectInAppBrowser(uaString);
  const tx = (k) => tInstall(k, lang);
  const interp = (s, vars) => String(s).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

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
  // In-app browser short-circuit: when WhatsApp / Instagram / etc. opens our
  // /install link, the page is in a Chrome Custom Tab (Android) or WebView
  // (iOS) that CAN'T install PWAs. The normal CTA below would render but do
  // nothing on click. Swap to a breakout card that points the user at a real
  // browser instead — Android via intent://, iOS via the manual ⋯ menu hint
  // (Apple has no programmatic equivalent that reliably works in 2026).
  if (!standalone && inApp) {
    const currentUrl = (typeof window !== 'undefined' ? window.location.href : '');
    const explain = interp(tx('inAppExplain'), { app: inApp.app });
    const iosHint = interp(tx('inAppIosManual'), { app: inApp.app });

    const card = el('div', { class: 'install-card install-inapp' },
      el('h3', { text: tx('inAppHeading') }),
      el('p', { class: 'install-inapp-explain', text: explain }),
    );

    if (inApp.os === 'android') {
      card.appendChild(el('button', {
        id: 'landingOpenInChrome',
        class: 'install-cta-btn',
        type: 'button',
        text: tx('inAppOpenInChrome'),
      }));
    } else if (inApp.os === 'ios') {
      card.appendChild(el('button', {
        id: 'landingOpenSafari',
        class: 'install-cta-btn',
        type: 'button',
        text: tx('iosChromeOpenSafari'),
      }));
      card.appendChild(el('p', { class: 'install-cta-hint', text: iosHint }));
    } else {
      // Unknown OS in-app: instructions only.
      card.appendChild(el('p', { class: 'install-cta-hint', text: tx('inAppFallbackHint') }));
    }

    card.appendChild(el('button', {
      id: 'landingCopyLink',
      class: 'install-cta-btn install-cta-btn-secondary',
      type: 'button',
      text: tx('inAppCopyLink'),
    }));
    card.appendChild(el('code', { class: 'install-cta-url', text: currentUrl }));
    const copiedMsg = el('p', { id: 'landingCopiedMsg', class: 'install-cta-hint', hidden: true });
    card.appendChild(copiedMsg);

    ctaCard = card;
  } else if (standalone) {
    ctaCard = el('div', { class: 'install-card install-already' },
      el('p', { text: tx('alreadyInstalled') }));
  } else if (platform === 'android-chrome' || platform === 'desktop-chrome') {
    const btn = el('button', { id: 'landingInstallNow', class: 'install-cta-btn', type: 'button', text: tx('installNow') });
    const hint = el('p', { id: 'landingInstallHint', class: 'install-cta-hint', hidden: true });
    // Samsung One UI's overcautious Play Protect intercepts Chrome's WebAPK
    // install with an "Unsafe app blocked" dialog. Pre-warn so the user knows
    // the path through (More details → Install anyway) before they tap.
    const cardChildren = [];
    if (platform === 'android-chrome' && isSamsungAndroid(uaString)) {
      cardChildren.push(el('p', { class: 'install-samsung-note', text: tx('samsungPlayProtect') }));
    }
    cardChildren.push(btn, hint);
    ctaCard = el('div', { class: 'install-card' }, ...cardChildren);
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

  // Reset link in landing-page footer. Plain anchor pointing at /install?reset=1
  // — clicking lands on this same page with the reset handler in install.html
  // already firing synchronously before this script runs.
  const footer = el('footer', { class: 'install-landing-footer' });
  footer.appendChild(el('a', {
    href: '/install?reset=1',
    class: 'install-reset-link',
    text: tx('resetInstallState'),
  }));
  section.appendChild(footer);

  host.appendChild(section);

  // Wire interactive bits
  const installNowBtn = host.querySelector('#landingInstallNow');
  if (installNowBtn) {
    // Capture beforeinstallprompt ONCE (renderLandingPage re-runs on language
    // change; the old per-run addEventListener leaked a window listener each
    // time). The deferred event is shared via window so every render reads it.
    if (!window.__pwLandingBipWired) {
      window.__pwLandingBipWired = true;
      window.addEventListener('beforeinstallprompt', (ev) => { ev.preventDefault(); window.__pwLandingDeferred = ev; });
    }
    installNowBtn.addEventListener('click', async () => {
      if (!window.__pwLandingDeferred) {
        const hint = host.querySelector('#landingInstallHint');
        if (hint) {
          // The Install button only renders on android-chrome / desktop-chrome,
          // so the chromium ⋮-menu hint is always the right copy here. Previously
          // shipped iosChromeFallback ("paste into Safari") which is wrong on
          // both platforms — Safari doesn't exist on Android, and a desktop
          // Chrome user has no Safari either. Confirmed live on Samsung A24.
          hint.textContent = INSTALL_T.installFallbackChromium[lang] || INSTALL_T.installFallbackChromium.en;
          hint.hidden = false;
        }
        return;
      }
      try {
        window.__pwLandingDeferred.prompt();
        const choice = await window.__pwLandingDeferred.userChoice;
        window.__pwLandingDeferred = null;
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

  // In-app breakout: Open in Chrome (Android intent URL).
  // Click is a user gesture, which Chrome requires before launching an
  // external app via intent://. Setting window.location.href works inside
  // Chrome Custom Tabs (WhatsApp / FB Messenger / etc. on Android).
  const openInChromeBtn = host.querySelector('#landingOpenInChrome');
  if (openInChromeBtn) {
    openInChromeBtn.addEventListener('click', () => {
      try {
        const intentUrl = buildAndroidIntentUrl(window.location.href);
        if (intentUrl) window.location.href = intentUrl;
      } catch { /* swallowed — the Copy link button is always rendered as fallback */ }
    });
  }

  // In-app breakout: Copy link (works on every platform, ultimate fallback).
  const copyLinkBtn = host.querySelector('#landingCopyLink');
  if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', async () => {
      const msg = host.querySelector('#landingCopiedMsg');
      try {
        await navigator.clipboard?.writeText(window.location.href);
        if (msg) {
          msg.textContent = tx('inAppLinkCopied');
          msg.hidden = false;
        }
      } catch {
        // Clipboard API rejected (insecure context / blocked) — leave the
        // visible <code> URL so the user can long-press to copy manually.
      }
    });
  }

  // 3-second fallback hint: on BIP-dependent paths (android-chrome, desktop-chrome)
  // outside an in-app browser, if beforeinstallprompt hasn't fired after 3s the
  // user is stuck looking at an Install button that won't do anything. Surface a
  // soft "Open in Chrome / Safari" reminder. The CTA button itself remains —
  // this is purely a safety net for the unknown-UA / weird-browser case Al
  // called out as Part 3.
  if (!inApp && (platform === 'android-chrome' || platform === 'desktop-chrome')) {
    const fallbackHint = el('p', {
      id: 'landingFallbackHint',
      class: 'install-cta-hint',
      hidden: true,
      text: tx('inAppFallbackHint'),
    });
    ctaCard.appendChild(fallbackHint);
    // Reuse the shared beforeinstallprompt capture above — no extra window
    // listener here. Show the fallback hint only if the prompt never armed AND
    // the user didn't click within 3s.
    let clicked = false;
    installNowBtn?.addEventListener('click', () => { clicked = true; });
    setTimeout(() => {
      if (!window.__pwLandingDeferred && !clicked) fallbackHint.hidden = false;
    }, 3000);
  }

  return { platform, standalone, inAppBrowser: inApp };
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

import { getSharedPlaceFromSearch } from './startup-location.js';
import { LANGUAGE_OPTIONS, SUPPORTED_LANGS, resolveInitialLanguage } from './language-preferences.js';
// Group 6 bundle split: the five-language bank is no longer a static import.
// COPY_BANK is a live object the per-language file merges into (T below holds
// references to its nested objects); the weekend filter moved to its own
// micro-module so importing it doesn't drag the bank along.
import { COPY_BANK, loadCopyBank } from './copy-loader.js';
import { WITTY_DAY_TAGS, eligibleWittyPool } from './witty-day-tags.js';
import { isWesternCape } from './geo-regions.js';
import { getWeatherBackgroundFallbackFolder, getWeatherBackgroundFolder } from './weather-visuals.js';
import { getRotationWeek, buildPickerPaths, pickRandomIndex } from './image-picker.js';
import { pickConditionEmojiForTime, pickHourlyEmoji, parseLocalIsoMinutes, isHourDaylight } from './weather-emoji.js';
import { buildShareUrl } from './share-url.js';
import {
  FRESHNESS_MS,
  SIGNIFICANT_MOVE_KM,
  PLACE_MODE_GPS,
  PLACE_MODE_PINNED,
  haversineKm,
  shouldRefetchWeather,
  shouldUpdateLocation,
  shouldAcceptWatchUpdate,
  PTR_THRESHOLD_PX,
  PTR_MAX_OVERSCROLL_PX,
  PTR_RESISTANCE,
  PTR_COPY,
} from './refresh-behaviour.js';
import { startFirstOpenLocation } from './first-open-location.js';
import { shouldPersistHomeName } from './home-name.js';
import { HEAT_EXTREME_C } from './weather-thresholds.js';

document.addEventListener("DOMContentLoaded", () => {
  // G4: signal to the index.html boot-failure guard that app.js loaded and
  // started executing. If app.js 404s / fails to parse, this stays unset and
  // the guard shows an honest error state instead of a silent "Loading…" shell.
  window.__PW_ALIVE = true;
  // HIGH-2: in-app splash failsafe — the belt closest to the throw. If anything
  // in this init handler throws before the first render lands (corrupt
  // localStorage in loadSettings, a throw in applySettings, the first-open
  // path), drop the splash so it can't outlive a broken boot. The index.html
  // inline failsafe is the PRIMARY guard (it also survives app.js failing to
  // load/parse, which this listener cannot); this fires a tick sooner on an
  // init throw. CSS auto-hides at 8s as the final backstop.
  window.addEventListener('error', () => {
    document.getElementById('pwSplash')?.classList.add('splash-done');
  }, { once: true });
  const $ = (sel) => document.querySelector(sel);
  const DEBUG = false;
  const debugLog = (...args) => {
    if (DEBUG) console.log(...args);
  };

  // ========== DOM ELEMENTS ==========
  const locationEl = $('#location');
  const headlineEl = $('#headline');
  const tempEl = $('#temp');
  const descriptionEl = $('#description');
  const bgImg = $('#bgImg');
  const saveCurrent = $('#saveCurrent');
  const particlesEl = $('#particles');
  const languageBtn = $('#languageBtn');
  const languageMenu = $('#languageMenu');

  const navHome = $('#navHome');
  const navWeek = $('#navWeek');
  const navSearch = $('#navSearch');
  const navSettings = $('#navSettings');
  const navSources = $('#navSources');
  const navHourlyHome = $('#navHourlyHome');
  const hourlyBack = $('#hourlyBack');

  const screenHome = $('#home-screen');
  const screenHourly = $('#hourly-screen');
  const screenWeek = $('#week-screen');
  const screenDayDetail = $('#day-detail-screen');
  const screenSearch = $('#search-screen');
  const screenSettings = $('#settings-screen');
  const screenSources = $('#sources-screen');

  const hourlyTimeline = $('#hourly-timeline');
  const dailyCards = $('#daily-cards');

  const searchInput = $('#searchInput');
  const useMyLocationBtn = $('#useMyLocationBtn');
  const searchCancel = $('#searchCancel');
  const favoritesList = $('#favoritesList');
  const recentList = $('#recentList');
  const searchEditToggle = $('#searchEditToggle');
  const clearRecentsBtn = $('#clearRecents');

  const unitsTempSelect = $('#unitsTemp');
  const unitsWindSelect = $('#unitsWind');
  const unitsPrecipSelect = $('#unitsPrecip');
  const timeFormatSelect = $('#timeFormat');
  const languageSelect = $('#languageSelect');

  const loader = $('#loader');
  const toast = $('#toast');
  const capeWindBanner = $('#capeWindBanner');
  const capeWindText = $('#capeWindText');
  const capeWindDismiss = $('#capeWindDismiss');

  const STORAGE = { favorites: "pw_favorites", recents: "pw_recents", home: "pw_home", location: "pw_location", lastGps: "pw_last_gps" };
  const SCREENS = [screenHome, screenHourly, screenWeek, screenDayDetail, screenSearch, screenSettings, screenSources];
  // M4: HOT_C now reads the shared extreme-heat constant (35, was a local 32).
  // These numeric rungs are FALLBACKS behind the server's conditionKey — the
  // old 32 let the client second-guess the server's verdict in the 32-34 band.
  const THRESH = { RAIN_PCT: 40, WIND_KPH: 25, COLD_C: 16, HOT_C: HEAT_EXTREME_C };

  // ========== INDEXEDDB WEATHER CACHE ==========
  const CACHE_DB = 'pw_weather_cache';
  const CACHE_STORE = 'responses';
  const CACHE_VERSION = 1;
  const CACHE_MAX_AGE = 30 * 60 * 1000; // 30 minutes
  let cacheDB = null;
  function openCacheDB() {
    return new Promise((resolve, reject) => {
      if (cacheDB) { resolve(cacheDB); return; }
      const req = indexedDB.open(CACHE_DB, CACHE_VERSION);
      req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(CACHE_STORE)) db.createObjectStore(CACHE_STORE); };
      req.onsuccess = () => { cacheDB = req.result; resolve(cacheDB); };
      req.onerror = () => reject(req.error);
    });
  }
  // M-6: the IDB weather cache is keyed by rounded coords PLUS a source
  // discriminator (gps / pinned / shared) so a shared-link place and the user's
  // own place at identical 3-dp coords can't serve each other's cached payload
  // (which carries location.name). Migration-safe: old coord-only keys just miss.
  function cacheSource(place) {
    return place?.shared ? 'shared' : (place?.mode === PLACE_MODE_PINNED ? 'pinned' : 'gps');
  }
  function cacheKey(place) { return `${parseFloat(place.lat).toFixed(3)},${parseFloat(place.lon).toFixed(3)}|${cacheSource(place)}`; }
  async function getCachedWeather(place) {
    try {
      const db = await openCacheDB();
      return new Promise((resolve) => {
        const tx = db.transaction(CACHE_STORE, 'readonly');
        const req = tx.objectStore(CACHE_STORE).get(cacheKey(place));
        req.onsuccess = () => {
          const entry = req.result;
          if (entry && (Date.now() - entry.timestamp) < CACHE_MAX_AGE) resolve(entry);
          else resolve(null);
        };
        req.onerror = () => resolve(null);
      });
    } catch { return null; }
  }
  async function setCachedWeather(place, payload) {
    try {
      const db = await openCacheDB();
      const tx = db.transaction(CACHE_STORE, 'readwrite');
      tx.objectStore(CACHE_STORE).put({ payload, timestamp: Date.now() }, cacheKey(place));
    } catch { /* silent fail */ }
  }
  // Bug 3 (2026-05-24): evict a stale cached payload when the user moves away
  // from a location. The cache is keyed by lat/lon (so locations never read
  // each other's data), but leaving the old entry behind grows the store
  // unbounded as the user drives between places — and a quick return trip
  // would render visibly stale weather before the network refresh lands.
  async function evictWeatherCache(place) {
    if (!place || !Number.isFinite(parseFloat(place.lat)) || !Number.isFinite(parseFloat(place.lon))) return;
    try {
      const db = await openCacheDB();
      const tx = db.transaction(CACHE_STORE, 'readwrite');
      tx.objectStore(CACHE_STORE).delete(cacheKey(place));
      debugLog('[Cache] evicted stale weather for', cacheKey(place));
    } catch { /* silent fail */ }
  }
  const offlineEl = document.getElementById('offlineIndicator');
  function showCacheAge(timestamp) {
    if (!offlineEl) return;
    const mins = Math.round((Date.now() - timestamp) / 60000);
    offlineEl.textContent = mins < 1 ? 'Using cached data (just now)' : `Last updated ${mins} min ago`;
    offlineEl.classList.add('visible');
  }
  function hideCacheAge() { if (offlineEl) offlineEl.classList.remove('visible'); }

  // ========== FULL UI TRANSLATIONS ==========
  const T = {
    // Navigation
    nav: {
      home: { en: "Home", af: "Tuis", zu: "Ikhaya", xh: "Ikhaya", st: "Lapeng" },
      hourly: { en: "Hourly", af: "Uurliks", zu: "Ngamahora", xh: "Ngeyure", st: "Ka hora" },
      // "Weekly" / adverbial forms match the hourly pattern (Ngeviki / Ngeveki / Ka beke parallel Ngamahora / Ngeyure / Ka hora).
      week: { en: "Weekly", af: "Weekliks", zu: "Ngeviki", xh: "Ngeveki", st: "Ka beke" },
      search: { en: "Search", af: "Soek", zu: "Sesha", xh: "Khangela", st: "Batla" },
      settings: { en: "Settings", af: "Instellings", zu: "Izilungiselelo", xh: "Iisetingi", st: "Litlhophiso" },
      sources: { en: "Sources", af: "Bronne", zu: "Imithombo", xh: "Imithombo", st: "Mehlodi" }
    },
    // Screen titles
    screens: {
      hourly: { en: "Hourly", af: "Uurliks", zu: "Ngamahora", xh: "Ngeyure", st: "Ka hora" },
      week: { en: "7-Day", af: "7-Dae", zu: "Izinsuku-7", xh: "Intsuku-7", st: "Matsatsi-7" },
      search: { en: "Search", af: "Soek", zu: "Sesha", xh: "Khangela", st: "Batla" },
      settings: { en: "Settings", af: "Instellings", zu: "Izilungiselelo", xh: "Iisetingi", st: "Litlhophiso" },
      sources: { en: "Sources", af: "Bronne", zu: "Imithombo", xh: "Imithombo", st: "Mehlodi" }
    },
    // Sources page — full destination, AD-FREE. Explainer + attribution.
    // zu/xh/st are starting drafts pending native-speaker review (logged with
    // the existing badges.rainTonight.zu / weather.gusts.{zu,st} backlog).
    sources: {
      explainer: {
        en: "Probably Weather checks five weather sources every time you open the app. We average them so you get a more honest forecast — no single source guessing wrong about whether it'll rain.",
        af: "Probably Weather kyk na vyf weersbronne elke keer wat jy die app oopmaak. Ons stel hulle gemiddelde saam sodat jy 'n meer eerlike voorspelling kry — geen enkele bron wat verkeerd raai oor of dit gaan reën nie.",
        zu: "I-Probably Weather ihlola imithombo emihlanu yesimo sezulu ngaso sonke isikhathi uvula uhlelo lokusebenza. Sihlanganisa amalinganiso ukuze uthole isibikezelo esiqotho — akukho mthombo owodwa oqagela kabi ngokuthi imvula iyona noma cha.",
        xh: "I-Probably Weather ijonga imithombo emihlanu yemozulu ngalo lonke ixesha uvula i-app. Sidibanisa imilinganiselo ukuze ufumane isiprofeto esinyanisekileyo — akukho mthombo omnye oqikelela ngokungafanelekanga ngokuba kuza kuna na okanye hayi.",
        st: "Probably Weather e sheba mehlodi e mehlano ea boemo ba leholimo nako e nngwe le e nngwe ha u bula app. Re kopanya likarolelano hore u fumane ponelopele e tšepahalang — ha ho mohlodi o le mong o akhang hampe ka hore ho tla na pula kapa che."
      },
      attribution: {
        en: "Data from Open-Meteo, WeatherAPI.com, MET Norway, Pirate Weather, and Tomorrow.io. Used with permission and gratitude.",
        af: "Data van Open-Meteo, WeatherAPI.com, MET Norway, Pirate Weather en Tomorrow.io. Gebruik met toestemming en dank.",
        zu: "Idatha ivela ku-Open-Meteo, WeatherAPI.com, MET Norway, i-Pirate Weather ne-Tomorrow.io. Isetshenziswa ngemvume nokubonga.",
        xh: "Idatha ivela ku-Open-Meteo, WeatherAPI.com, MET Norway, i-Pirate Weather ne-Tomorrow.io. Isetyenziswa ngemvume nokubulela.",
        st: "Data e tsoa ho Open-Meteo, WeatherAPI.com, MET Norway, Pirate Weather le Tomorrow.io. E sebelisoa ka tumello le ka teboho."
      },
      // Per-source descriptions for the Sources page. The render code doesn't
      // consume these yet — landing them here so they're available when the
      // Sources UI gains a per-source explainer (planned). zu/xh entries are
      // GPT-drafted and marked PROVISIONAL pending native-speaker review (use
      // zu-qc / xh-qc agents before treating as ship-ready).
      sourceInfo: {
        tomorrowIo: {
          en: "Tomorrow.io — radar-based short-term precipitation nowcasting. Catches active rain that other sources miss.",
          af: "Tomorrow.io — radar-gebaseerde korttermyn-reënvoorspelling. Tel reën op wat ander bronne mis.",
          // PROVISIONAL — TODO: zu native review
          zu: "I-Tomorrow.io — isibikezelo semvula esifushane esisekelwe ku-radar. Ithola imvula yamanje engatholakali kweminye imithombo.",
          // PROVISIONAL — TODO: xh native review
          xh: "I-Tomorrow.io — uqikelelo lwemvula olufutshane olusekwe kwi-radar. Ifumana imvula yangoku engaqondwa ngeminye imithombo.",
          st: "Tomorrow.io — ho bonela pula ka radar. E thusa ho fumana pula eo mehlodi e meng e e hlokomelang."
        }
      }
    },
    // Native ad slot placeholder — shown while Adsterra approval is pending.
    // The .pw-ad-placeholder div gets swapped for the real ad iframe when
    // live; the .pw-ad-slot wrapper stays as the layout anchor.
    adSlot: {
      placeholder: {
        en: "Possible ad one day. Sadly, weather websites don't grow on trees.",
        af: "Dalk eendag 'n advertensie. Ongelukkig groei weersvoorspellingswebwerwe nie op bome nie.",
        zu: "Mhlawumbe isikhangiso ngelinye ilanga. Ngeshwa, amawebhusayithi esimo sezulu awakhuli ezihlahleni.",
        xh: "Mhlawumbi intengiso ngenye imini. Ngelishwa, iiwebhusayithi zemozulu azikhuli emithini.",
        st: "Mohlomong papatso ka tsatsi le leng. Ka bomadimabe, liwebsaete tsa boemo ba leholimo ha li hole lifateng."
      }
    },
    // Search screen
    search: {
      placeholder: { en: "Search for a place", af: "Soek 'n plek", zu: "Sesha indawo", xh: "Khangela indawo", st: "Batla sebaka" },
      cancel: { en: "Cancel", af: "Kanselleer", zu: "Khansela", xh: "Rhoxisa", st: "Hlakola" },
      savedPlaces: { en: "Saved Places", af: "Gestoorde Plekke", zu: "Izindawo Ezigciniwe", xh: "Iindawo Ezigciniweyo", st: "Libaka tse Bolokiloeng" },
      recent: { en: "Recent", af: "Onlangs", zu: "Okwakamuva", xh: "Okutsha", st: "Tsa morao tjena" },
      noSaved: { en: "No saved places yet.", af: "Nog geen gestoorde plekke nie.", zu: "Azikho izindawo ezigciniwe.", xh: "Akukho ndawo igciniweyo okwangoku.", st: "Ha ho libaka tse bolokiloeng." },
      noRecent: { en: "No recent searches yet.", af: "Nog geen onlangse soektogte nie.", zu: "Azikho ukusesha kwakamuva.", xh: "Akukho kukhangela kwakutsha.", st: "Ha ho ho batla ha morao tjena." },
      clearRecents: { en: "Clear recents", af: "Verwyder onlangse soektogte", zu: "Susa okamuva", xh: "Susa okukhangelwe kutshanje", st: "Hlakola tsa morao" },
      edit: { en: "Edit", af: "Wysig", zu: "Hlela", xh: "Hlela", st: "Fetola" },
      manage: { en: "Manage", af: "Bestuur", zu: "Phatha", xh: "Lawula", st: "Tsamaisa" },
      done: { en: "Done", af: "Klaar", zu: "Kwenziwe", xh: "Kugqityiwe.", st: "Ho phethiloe" }
    },
    // Settings screen
    settings: {
      units: { en: "Units", af: "Eenhede", zu: "Iziyunithi", xh: "Iiyunithi", st: "Diyuniti" },
      temperature: { en: "Temperature", af: "Temperatuur", zu: "Izinga lokushisa", xh: "Ubushushu", st: "Mocheso" },
      windSpeed: { en: "Wind speed", af: "Windspoed", zu: "Isivinini somoya", xh: "Isantya somoya", st: "Lebelo la moea" },
      precipitation: { en: "Precipitation", af: "Reënval", zu: "Imvula", xh: "Imvula", st: "Pula" },
      display: { en: "Display", af: "Vertoon", zu: "Ukubonisa", xh: "Ukubonisa", st: "Bonts'a" },
      timeFormat: { en: "Time format", af: "Tydformaat", zu: "Ifomethi yesikhathi", xh: "Ifomathi yexesha", st: "Sebopeho sa nako" },
      language: { en: "Language", af: "Taal", zu: "Ulimi", xh: "Ulwimi", st: "Puo" },
      about: { en: "About", af: "Aangaande", zu: "Mayelana", xh: "Malunga", st: "Mabapi" },
      aboutText: {
        en: "Probably Weather combines forecasts from Open-Meteo, WeatherAPI.com, MET Norway, Pirate Weather & Tomorrow.io to give you a more reliable prediction.",
        af: "Probably Weather kombineer voorspellings van Open-Meteo, WeatherAPI.com, MET Norway, Pirate Weather & Tomorrow.io om jou 'n meer betroubare voorspelling te gee.",
        zu: "I-Probably Weather ihlanganisa izibikezelo ezivela ku-Open-Meteo, WeatherAPI.com, MET Norway, Pirate Weather ne-Tomorrow.io ukukunikeza isibikezelo esithembekile.",
        xh: "I-Probably Weather idibanisa uqikelelo lwemozulu oluvela ku-Open-Meteo, WeatherAPI.com, MET Norway, Pirate Weather ne-Tomorrow.io ukuze ikunike uqikelelo oluthembeke ngakumbi.",
        st: "Probably Weather e kopanya dikakanyo tsa boemo ba leholimo tse tsoang ho Open-Meteo, WeatherAPI.com, MET Norway, Pirate Weather le Tomorrow.io ho u fa ponelopele e tšepahalang."
      }
    },
    // Weather byline terms
    weather: {
      probably: { en: "Probably", af: "Waarskynlik", zu: "Mhlawumbe", xh: "Mhlawumbi", st: "Mohlomong" },
      wind: { en: "Wind", af: "Wind", zu: "Umoya", xh: "Umoya", st: "Moea" },
      rain: { en: "Rain", af: "Reën", zu: "Imvula", xh: "Imvula", st: "Pula" },
      uv: { en: "UV", af: "UV", zu: "UV", xh: "UV", st: "UV" },
      feelsLike: { en: "Feels like", af: "Voel soos", zu: "Kuzwakala sengathi", xh: "Ingathi", st: "Ho utlwahala joalo ka" },
      later: { en: "Later ⏰", af: "Later ⏰", zu: "Kamuva ⏰", xh: "Kamva ⏰", st: "Hamorao ⏰" },
      none: { en: "None", af: "Geen", zu: "Lutho", xh: "Akukho", st: "Ha ho" },
      gusts: { en: "gusts", af: "windstote", zu: "kufika ku", xh: "ukuqhwithela komoya / izivuthuvuthu zomoya", st: "Meea e fokang ka sefutho" },
      unlikely: { en: "Unlikely", af: "Onwaarskynlik", zu: "Akunakulindeleka", xh: "Akunakulindeleka", st: "Ha ho kgonehe" },
      possible: { en: "Possible", af: "Moontlik", zu: "Kungenzeka", xh: "Kunokwenzeka", st: "Ho ka etsahala" },
      likely: { en: "Likely", af: "Waarskynlik", zu: "Kungenzeka", xh: "Kunokubakho", st: "Ho ka etsahala" },
      possibleLater: { en: "Possible later", af: "Moontlik later", zu: "Kungenzeka kamuva", xh: "Kunokwenzeka kamva", st: "Ho ka etsahala hamorao" },
      low: { en: "Low", af: "Laag", zu: "Phansi", xh: "Phantsi", st: "Tlase" },
      moderate: { en: "Moderate", af: "Matig", zu: "Okuphakathi", xh: "Phakathi", st: "Mahareng" },
      high: { en: "High", af: "Hoog", zu: "Phezulu", xh: "Phezulu", st: "Hodimo" },
      veryHigh: { en: "Very High", af: "Baie Hoog", zu: "Phezulu Kakhulu", xh: "Phezulu Kakhulu", st: "Hodimo Haholo" },
      // Table headers
      time: { en: "Time", af: "Tyd", zu: "Isikhathi", xh: "Ixesha", st: "Nako" },
      temp: { en: "Temp", af: "Temp", zu: "Izinga lokushisa", xh: "Temp", st: "Mocheso" },
      day: { en: "Day", af: "Dag", zu: "Usuku", xh: "Usuku", st: "Letsatsi" },
      sunrise: { en: "Sunrise", af: "Sonop", zu: "Ukuphuma kwelanga", xh: "Ukuphuma kwelanga", st: "Ho chaba ha letsatsi" },
      sunset:  { en: "Sunset",  af: "Sononder", zu: "Ukushona kwelanga", xh: "Ukutshona kwelanga", st: "Ho likela ha letsatsi" },
      hourlySoon: {
        en: "Hourly forecast appears 48 hours before this day.",
        af: "Uurlikse voorspelling verskyn 48 uur voor hierdie dag.",
        zu: "Isibikezelo samahora siphuma amahora angu-48 ngaphambi kwalolu suku.",
        xh: "Isibikezelo seeyure sivela kwiiyure ezingama-48 phambi kwalo mhla.",
        st: "Ponelopele ea hora e hlahella lihora tse 48 pele ho letsatsi lena."
      }
    },
    // Day hero badges
    badges: {
      rainy: { en: "Rainy", af: "Reënerig", zu: "Linemvula", xh: "Linemvula", st: "Pula" },
      showers: { en: "Showers", af: "Buie", zu: "Izihlambi zemvula", xh: "Iimvula", st: "Lipula" },
      rainLater: { en: "Rain later", af: "Reën later", zu: "Imvula kamuva", xh: "Imvula kamva", st: "Pula hamorao" },
      rainTonight: { en: "Rain tonight", af: "Reën vanaand", zu: "Imvula ebusuku", xh: "Imvula ngokuhlwa", st: "Pula bosiu" },
      rainMorning: { en: "Rain AM", af: "Reën oggend", zu: "Imvula ekuseni", xh: "Imvula kusasa", st: "Pula hoseng" },
      highUV: { en: "High UV", af: "Hoë UV", zu: "I-UV ephezulu", xh: "I-UV ephezulu", st: "UV e Phahameng" },
      hot: { en: "Hot", af: "Warm", zu: "Kushisa", xh: "Kushushu", st: "Ho chesa" },
      cold: { en: "Cold", af: "Koud", zu: "Makhaza", xh: "Kuyabanda", st: "Ho bata" },
      uvAlert: { en: "UV Alert", af: "UV Waarskuwing", zu: "Isexwayiso se-UV", xh: "Isilumkiso se-UV", st: "Temoso ea UV" }
    },
    // Hero labels — live reference into COPY_BANK; loadCopyBank merges the
    // active language's strings into these exact objects.
    heroLabels: COPY_BANK.heroLabels,
    // Day names (short).
    // Afrikaans abbreviations flagged by tester 2026-05-11:
    //   Maandag → Ma, Dinsdag → Dins, Woensdag → Wo, Donderdag → Don,
    //   Vrydag → Vry, Saterdag → Sat, Sondag → Son.
    // EN/ZU/XH/ST not changed in this pass — Al will get those flagged by
    // native speakers as he sends tester links wider.
    days: {
      sun: { en: "Sun", af: "Son",  zu: "Son", xh: "Caw",   st: "Sont" },
      mon: { en: "Mon", af: "Ma",   zu: "Mso", xh: "Mvu",   st: "Mant" },
      tue: { en: "Tue", af: "Dins", zu: "Bil", xh: "Lwes",  st: "Lab" },
      wed: { en: "Wed", af: "Wo",   zu: "Tha", xh: "Tha",   st: "Lar" },
      thu: { en: "Thu", af: "Don",  zu: "Sin", xh: "Sin",   st: "Labo" },
      fri: { en: "Fri", af: "Vry",  zu: "Hla", xh: "Hlanu", st: "Laboh" },
      sat: { en: "Sat", af: "Sat",  zu: "Mgq", xh: "Mgqi",  st: "Moq" }
    },
    // Headlines
    headlines: COPY_BANK.headlines,
    // Witty lines
    witty: COPY_BANK.witty,
    // Layer B (Bug 1): hedged "probably" register, used when meta.confidence is 'low'.
    witty_low_confidence: COPY_BANK.witty_low_confidence,
    // Cape Doctor wind alert
    capeDr: {
      warningLabel: {
        en: "WIND WARNING",
        af: "WINDWAARSKUWING",
        zu: "ISEXWAYISO SOMOYA",
        xh: "ISILUMKISO SOMOYA",
        st: "TLHOKOMELISO YA MOEA"
      },
      lines: {
        en: ["Ag no, the tablecloth is out 💨", "Cape Doctor is doing rounds today", "Hold onto your hat, the Southeaster means business", "The Southeaster arrived uninvited — as always", "Wind's hectic — even the seagulls are walking"],
        af: ["Ag nee, die tafeldoek is uit 💨", "Die Kaapse Dokter maak vandag huisbesoeke", "Hou jou hoed vas, die Suidooster bedoel sake", "Die Suidooster het ongenooid opgedaag — soos altyd", "Die wind is hectic — selfs die meeuë loop"],
        zu: ["Yoh, ilaphu letafel liphumile 💨", "UDokotela waseKapa uyashayela namuhla", "Bamba isigqoko sakho, iSoutheaster iyasebenza", "Umoya waseNingizimu ufikile ungamenyiwe — njengenjwayelo", "Umoya unamandla — ngisho nezinkonjane ziyahamba"],
        xh: ["Yhuu, ilaphu letafile liphumile 💨", "UGqirha waseKapa uyajikeleza namhlanje", "Bamba umnqwazi wakho, umoya waseMzantsi-Mpuma uzimisele namhlanje", "Umoya waseMzantsi-Mpuma ufike ungamenywanga njengesiqhelo", "Umoya unamandla — neengabangaba zihamba ngeenyawo"],
        st: ["Ag no, lesela la tafoleng le foka moea", "Ngaka ea Cape e etsa litšeliso kajeno", "Tšoara katiba ea hao — Southeaster e tla ka matla, ha e bapale.", "Moea oa boroa o fihlile o sa mengoa — joalo ka kamehla", "Moea o matla — esita le dikoekoe di tsamaea"]
      }
    },
    // Toasts
    toasts: {
      saved: { en: "Saved!", af: "Gestoor!", zu: "Kugciniwe!", xh: "Igciniwe!", st: "E bolokiloe!" },
      removed: { en: "Removed", af: "Verwyder", zu: "Isusiwe", xh: "Isusiwe", st: "E tlositsoe" },
      maxPlaces: { en: "Max 5 places. Remove one first.", af: "Maks 5 plekke. Verwyder een eers.", zu: "Izindawo ezi-5 kuphela. Susa eyodwa kuqala.", xh: "Iindawo ezi-5 kuphela. Susa enye kuqala.", st: "Libaka tse 5 feela. Tlosa e le 'ngoe pele." },
      alreadySaved: { en: "Already saved!", af: "Reeds gestoor!", zu: "Seyigciniwe!", xh: "Sele igciniwe!", st: "E se e bolokiloe!" },
      cleared: { en: "Cleared", af: "Skoongemaak", zu: "Kususiwe", xh: "Kucociwe", st: "E hlakotsoe" },
      noPlaces: { en: "No saved places", af: "Geen gestoorde plekke", zu: "Azikho izindawo", xh: "akukho ndawo zigciniweyo", st: "Ha ho libaka tse bolokiloeng" },
      permissionDeniedBrowser: { en: "Location permission needed. Tap the location icon in your browser's address bar to enable it.", af: "Liggingtoestemming nodig. Tik die ligging-ikoon in jou blaaier se adresbalk om dit aan te skakel.", zu: "Kudingeka imvume yendawo. Thepha isithonjana sendawo kubha yekheli lesiphequluli ukuze uyivule.", xh: "Kufuneka imvume yendawo. Cofa i-ayikhoni yendawo kwibar yedilesi yebhrawuza ukuze uyivule.", st: "Tumello ea sebaka ea hlokahala. Tlanya letshwao la sebaka bareng ea aterese ea sebatli ho e bulela." },
      permissionDeniedStandalone: { en: "Location permission needed. Open device Settings → Apps → Probably Weather → Permissions → Location to enable.", af: "Liggingtoestemming nodig. Maak toestel-instellings → Apps → Probably Weather → Toestemmings → Ligging oop om dit aan te skakel.", zu: "Kudingeka imvume yendawo. Vula Izilungiselelo zedivayisi → Apps → Probably Weather → Permissions → Location ukuze uyivule.", xh: "Kufuneka imvume yendawo. Vula iiSetingi zesixhobo → Apps → Probably Weather → Permissions → Location ukuze uyivule.", st: "Tumello ea sebaka ea hlokahala. Bula Settings ea sesebediswa → Apps → Probably Weather → Permissions → Location ho e bulela." },
      locationUpdated: { en: "Location updated", af: "Ligging opgedateer", zu: "Indawo ibuyekeziwe", xh: "Indawo ihlaziyiwe", st: "Sebaka se ntjhafaditsoe" },
      locationError: { en: "Could not get location", af: "Kon nie ligging kry nie", zu: "Ayikwazanga ukuthola indawo", xh: "Ayikwazanga ukufumana indawo okuyo", st: "Ha e khone ho fumana sebaka" },
      usingSaved: { en: "Using saved location", af: "Gebruik gestoorde ligging", zu: "Isebenzisa indawo egciniwe", xh: "Kusetyenziswa indawo egciniweyo", st: "E sebedisa sebaka se bolokiloeng" },
      weatherTimeout: { en: "Weather lookup taking too long. Try again.", af: "Weervoorspelling neem te lank. Probeer weer.", zu: "Ukubuka isimo sezulu kuthatha isikhathi eside. Zama futhi.", xh: "Ukukhangela isimo sezulu kuthatha ixesha elide. Zama kwakhona", st: "Ho sheba boemo ba leholimo ho nka nako e telele. Leka hape." },
      // Brief acknowledgment shown for 1.5s after the page auto-reloads to
      // pick up a new service-worker version. No version string in the user-
      // facing copy — keeps it terse. Debug overlay still surfaces the
      // version for Al / testers who need it.
      updatedToLatest: { en: "Updated ✓", af: "Bygewerk ✓", zu: "Kubuyekeziwe ✓", xh: "Kuhlaziyiwe ✓", st: "Ho ntjhafalitsoe ✓" },
      // Banner shown when /api/version reports a newer deploy than the one
      // the user booted with. Short copy — full banner = label + CTA + ✕.
      updateAvailable: { en: "New version", af: "Nuwe weergawe", zu: "Inguqulo entsha", xh: "Inguqulelo entsha", st: "Phetolelo e ncha" },
      tapToRefresh: { en: "Tap to refresh", af: "Tik om te verfris", zu: "Thepha ukuze uvuselele", xh: "Cofa ukuze uhlaziye", st: "Tobetsa ho ntlafatsa" }
    },
    // Misc
    misc: {
      loading: { en: "Loading…", af: "Laai…", zu: "Iyalayisha…", xh: "Iyalayisha…", st: "E a jarolla…" },
      error: { en: "Error", af: "Fout", zu: "Iphutha", xh: "Impazamo", st: "Phoso" },
      couldntFetch: { en: "Couldn't fetch weather right now.", af: "Kon nie weer kry nie.", zu: "Ayikwazanga ukuthola isimo sezulu.", xh: "Ayikwazanga ukufumana ulwazi lwemozulu ngoku.", st: "Ha e khone ho fumana boemo ba leholimo." },
      save: { en: "Save", af: "Stoor", zu: "Londoloza", xh: "Gcina", st: "Boloka" },
      saved: { en: "Saved", af: "Gestoor", zu: "Kugciniwe", xh: "Igciniwe", st: "Bolokile" },
      savePlace: { en: "Save this place", af: "Stoor hierdie plek", zu: "Londoloza le ndawo", xh: "Gcina le ndawo", st: "Boloka sebaka sena" },
      share: { en: "Share", af: "Deel", zu: "Yabelana", xh: "Yabelana", st: "Arolelana" },
      shareIn: { en: "in", af: "in", zu: "e-", xh: "e-", st: "ho" },
      // Branded share message body. {city} is replaced with the location name
      // (or "your area" when missing). {url} is the share URL. Tone stays
      // warm and SA-flavoured; native-review flagged for ZU/XH/ST in
      // SHARE_OG_NOTES.md.
      shareMessage: {
        en: "Check the weather in {city} — South African weather in your language: {url}",
        af: "Check die weer in {city} — Suid-Afrikaanse weer in jou taal: {url}",
        zu: "Bheka isimo sezulu e-{city} — isimo sezulu saseNingizimu Afrika ngolimi lwakho: {url}",
        xh: "Jonga imozulu e-{city} — imozulu yaseMzantsi Afrika ngolwimi lwakho: {url}",
        st: "Sheba boemo ba leholimo {city} — boemo ba leholimo ba Afrika Borwa ka puo ya hao: {url}"
      },
      shareYourArea: {
        en: "your area",
        af: "jou omgewing",
        zu: "indawo yakho",
        xh: "indawo yakho",
        st: "sebakeng sa hao"
      },
      // L4: shown under the location name when viewing a shared link.
      // zu/xh/st are PROVISIONAL pending native review (mirrors the existing
      // share vocabulary: yabelana/arolelana + indawo/sebaka).
      viewingShared: {
        en: "Viewing shared location",
        af: "Kyk na gedeelde ligging",
        zu: "Ubuka indawo eyabelwane ngayo",
        xh: "Ujonge indawo ekwabelwene ngayo",
        st: "O sheba sebaka se arolelanoeng"
      },
      // L3: footer attribution — five sources, translated. Derived from the
      // native-reviewed sources.attribution strings (short form).
      dataFrom: {
        en: "Data from Open-Meteo, WeatherAPI.com, MET Norway, Pirate Weather & Tomorrow.io",
        af: "Data van Open-Meteo, WeatherAPI.com, MET Norway, Pirate Weather & Tomorrow.io",
        zu: "Idatha ivela ku-Open-Meteo, WeatherAPI.com, MET Norway, Pirate Weather ne-Tomorrow.io",
        xh: "Idatha ivela ku-Open-Meteo, WeatherAPI.com, MET Norway, Pirate Weather ne-Tomorrow.io",
        st: "Data e tsoa ho Open-Meteo, WeatherAPI.com, MET Norway, Pirate Weather le Tomorrow.io"
      }
    }
  };

  // L6: the ONE place the user-facing version string lives. index.html ships
  // a static copy as the pre-JS fallback; updateUILanguage overwrites it from
  // here. Bumped 1.4 → 1.5 with this release (splash, per-language bundles,
  // server cache, GPS-name fix).
  const APP_VERSION = '1.5';

  // Helper to get translation
  const t = (category, key) => {
    const lang = settings.lang || 'en';
    return T[category]?.[key]?.[lang] || T[category]?.[key]?.en || key;
  };

  // ========== STATE ==========
  let activePlace = null, homePlace = null, lastPayload = null, searchEditMode = false;
  // Captured by setupServiceWorkerUpdates() so the consolidated
  // visibilitychange handler at module bottom can call registration.update()
  // without needing two listeners (Phase 2 Codex S3 deferred-bundle item).
  let swRegistration = null;
  // Set by setupVersionBanner() — the consolidated visibilitychange handler
  // at module bottom invokes it on foreground transitions. Kept at module
  // scope so the single-listener test (sw-update-propagation) stays green.
  let versionCheckOnForeground = null;
  let installExperience = null;
  let activeLocationSeq = 0;
  let activeWeatherController = null;
  window.__PW_LAST_NORM = null;
  const pendingFavMeta = new Set();
  const SETTINGS_KEYS = { temp: 'units.temp', wind: 'units.wind', precip: 'units.precip', time: 'format.time', lang: 'lang' };
  const DEFAULT_SETTINGS = { temp: 'C', wind: 'kmh', precip: 'mm', time: '24', lang: 'en' };
  let settings = { ...DEFAULT_SETTINGS };

  // ========== UTILITIES ==========
  const safeText = (el, txt) => { if (el) el.textContent = txt ?? "--"; };
  const isNum = (v) => typeof v === "number" && Number.isFinite(v);
  const round0 = (n) => isNum(n) ? Math.round(n) : null;
  const loadJSON = (key, fb) => { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fb; } catch { return fb; } };
  const saveJSON = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };
  function normalizeStoredPlaces(places) {
    if (!Array.isArray(places)) return [];
    return places
      .filter(p => p && typeof p === 'object')
      .map(p => ({
        ...p,
        lat: Number(p.lat),
        lon: Number(p.lon),
      }))
      .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  }
  const samePlace = (a, b) => a && b && Number(a.lat).toFixed(4) === Number(b.lat).toFixed(4) && Number(a.lon).toFixed(4) === Number(b.lon).toFixed(4);
  const favoriteKey = (p) => `${Number(p.lat).toFixed(4)},${Number(p.lon).toFixed(4)}`;
  const isPlaceholderName = (name) => { const v = String(name || '').trim(); return !v || /^unknown\b/i.test(v) || /^my location\b/i.test(v); };
  const escapeHtml = (s) => String(s ?? "").replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  // Routed through pickConditionEmojiForTime so search/mini cards also respect
  // day/night. Callers that don't pass an isDay flag get the day glyph; the
  // search result cards in this file fetch a fresh norm and don't have a local
  // hour, so the daytime glyph is the safe default.
  const conditionEmoji = (key, isDay = true) => pickConditionEmojiForTime(key, isDay);

  // ========== IP GEOLOCATION FALLBACK ==========
  // Used when GPS is blocked (e.g. WhatsApp in-app browser).
  // Same-origin /api/locate reads Vercel's x-vercel-ip-* geo headers — the old
  // ipapi.co call was a third-party handshake with a 5s timeout sitting on the
  // first-open critical path (and ipapi throttles hard behind SA carrier NAT).
  // The server rounds coords to 1dp, preserving the old privacy posture.
  async function getIPLocation() {
    try {
      const resp = await fetch('/api/locate', { signal: AbortSignal.timeout(4000) });
      if (!resp.ok) throw new Error('IP lookup failed');
      const data = await resp.json();
      if (data?.ok && isNum(data.lat) && isNum(data.lon)) {
        return { name: data.name || 'My Location', lat: data.lat, lon: data.lon };
      }
    } catch (e) { debugLog('IP geolocation failed:', e); }
    // Ultimate fallback - Johannesburg (most populated SA city)
    return { name: "Johannesburg, ZA", lat: -26.2, lon: 28.0 };
  }

  function loadSettings() {
    const storedLang = loadJSON(SETTINGS_KEYS.lang, null);
    const initialLang = resolveInitialLanguage({ stored: storedLang, navigatorLanguage: navigator.language, navigatorLanguages: navigator.languages });
    if (!storedLang) saveJSON(SETTINGS_KEYS.lang, initialLang);
    settings = { temp: loadJSON(SETTINGS_KEYS.temp, DEFAULT_SETTINGS.temp), wind: loadJSON(SETTINGS_KEYS.wind, DEFAULT_SETTINGS.wind), precip: loadJSON(SETTINGS_KEYS.precip, DEFAULT_SETTINGS.precip), time: loadJSON(SETTINGS_KEYS.time, DEFAULT_SETTINGS.time), lang: initialLang };
  }
  function saveSettings() { saveJSON(SETTINGS_KEYS.temp, settings.temp); saveJSON(SETTINGS_KEYS.wind, settings.wind); saveJSON(SETTINGS_KEYS.precip, settings.precip); saveJSON(SETTINGS_KEYS.time, settings.time); saveJSON(SETTINGS_KEYS.lang, settings.lang); }
  const convertTemp = (c) => !isNum(c) ? null : settings.temp === 'F' ? (c * 9 / 5) + 32 : c;
  const formatTemp = (c) => { const v = convertTemp(c); return isNum(v) ? `${round0(v)}°` : '--°'; };
  const formatWind = (kph) => !isNum(kph) ? '--' : settings.wind === 'mph' ? `${round0(kph * 0.621371)} mph` : settings.wind === 'ms' ? `${round0(kph / 3.6)} m/s` : `${round0(kph)} km/h`;
  // Precipitation amount — number only, no unit suffix (column header carries
  // the unit). Returns em-dash for null/0 so the column reads cleanly when no
  // rain is expected. Inches use more decimals because small values are common.
  function formatPrecipAmount(mm) {
    if (!isNum(mm) || mm <= 0) return '—';
    if (settings.precip === 'in') {
      const inches = mm * 0.0393701;
      return inches >= 1 ? inches.toFixed(1) : inches.toFixed(2);
    }
    return mm >= 1 ? String(Math.round(mm)) : mm.toFixed(1);
  }
  const precipUnitLabel = () => settings.precip === 'in' ? 'in' : 'mm';
  const getTempColorClass = (tempC) => {
    if (!isNum(tempC)) return '';
    if (tempC <= 0) return 'temp-freezing';
    if (tempC <= 10) return 'temp-cold';
    if (tempC >= 35) return 'temp-hot';
    if (tempC >= 28) return 'temp-warm';
    return '';
  };

  // Hourly has no bottom-nav button (reached from the home-screen pill instead),
  // so it's absent from NAV_MAP. Sources is the new last slot.
  const NAV_MAP = [[screenHome, navHome], [screenWeek, navWeek], [screenSearch, navSearch], [screenSettings, navSettings], [screenSources, navSources]];
  function showScreen(which) {
    SCREENS.forEach(s => { if (s) { s.classList.add("hidden"); s.setAttribute('hidden', ''); } });
    if (which) { which.classList.remove("hidden"); which.removeAttribute('hidden'); }
    NAV_MAP.forEach(([scr, btn]) => {
      if (!btn) return;
      const active = scr === which;
      btn.classList.toggle('active', active);
      if (active) btn.setAttribute('aria-current', 'page'); else btn.removeAttribute('aria-current');
    });
    document.body.classList.toggle('modal-open', which && which !== screenHome);
    document.body.classList.toggle('home-active', which === screenHome);
    if (saveCurrent) saveCurrent.style.display = which === screenHome ? '' : 'none';
    if (shareBtn) shareBtn.style.display = which === screenHome ? '' : 'none';
    if (navHourlyHome) navHourlyHome.style.display = which === screenHome ? '' : 'none';
    const sidebar = document.querySelector('.sidebar'); if (sidebar) sidebar.style.display = which === screenHome ? '' : 'none';
  }
  const showLoader = (show) => { if (loader) loader.classList[show ? 'remove' : 'add']('hidden'); };
  function showToast(message, duration = 3000, action = null) {
    if (!toast) return;
    toast.textContent = message;
    if (action?.label && typeof action.onClick === 'function') {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'toast-action';
      button.textContent = action.label;
      button.addEventListener('click', action.onClick);
      toast.append(document.createTextNode(' '), button);
    }
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
  }
  function setupServiceWorkerUpdates() {
    if (!('serviceWorker' in navigator)) return;

    // ----- Post-reload acknowledgment toast -----
    // If the previous page-load triggered a reload-for-update, a sessionStorage
    // marker survives the reload. Show a brief "Updated ✓" toast on the new
    // page, then clear the marker. Sessions in PW are short (10-30s); a 1.5s
    // toast is enough acknowledgment without disrupting the user.
    try {
      const justUpdatedVersion = sessionStorage.getItem('pw_sw_just_updated');
      if (justUpdatedVersion) {
        sessionStorage.removeItem('pw_sw_just_updated');
        // Delay so the toast fires AFTER the home render kicks in.
        setTimeout(() => {
          const msg = t('toasts', 'updatedToLatest') || 'Updated ✓';
          showToast(msg, 1500);
          debugLog('[SW] Post-reload acknowledgment — new version ' + justUpdatedVersion);
        }, 200);
      }
    } catch (_) {}

    // ----- Reload-on-update plumbing -----
    // `controllerchange` fires when a new SW takes over an existing client
    // via clients.claim(). Auto-reload once so the page is running the new
    // code's HTML/JS/CSS. Two in-memory guards:
    //   1. hadControllerAtStart — skip the FIRST controllerchange on a fresh
    //      install (no prior controller means it's the initial registration
    //      claiming, not a real update).
    //   2. reloadInFlight — block any second reload trigger between the
    //      decision to reload and the actual reload() call (defence against
    //      PW_UPDATE_AVAILABLE message firing alongside controllerchange).
    let hadControllerAtStart = !!navigator.serviceWorker.controller;
    let reloadInFlight = false;
    const reloadForUpdate = (version) => {
      if (reloadInFlight) return;
      reloadInFlight = true;
      try { sessionStorage.setItem('pw_sw_just_updated', version || '1'); } catch (_) {}
      debugLog('[SW] Reloading for new version', version || '(no version)');
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadControllerAtStart) {
        // Initial-registration claim, not an update. Note for future events.
        hadControllerAtStart = true;
        return;
      }
      reloadForUpdate();
    });

    // PW_UPDATE_AVAILABLE message from the SW activate handler — belt-and-
    // braces alongside controllerchange. If for any reason controllerchange
    // doesn't fire (which can happen in some browsers when a tab was never
    // controlled), the explicit message still triggers the reload.
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type !== 'PW_UPDATE_AVAILABLE') return;
      reloadForUpdate(event.data.version);
    });

    // ----- Force-activate a waiting SW -----
    // iOS Safari PWA standalone sometimes leaves a freshly-installed SW in
    // the 'waiting' state even when its install handler called skipWaiting().
    // Posting SKIP_WAITING from the page forces activation. The SW already
    // listens for this message (sw.js: `if (event.data === 'SKIP_WAITING') self.skipWaiting()`).
    const forceActivate = (worker) => {
      if (!worker || worker.state !== 'installed') return;
      // Only send when there's an existing controller — first-ever install
      // doesn't need activation forcing (no old SW to displace).
      if (!navigator.serviceWorker.controller) return;
      try {
        worker.postMessage('SKIP_WAITING');
        debugLog('[SW] sent SKIP_WAITING to waiting worker');
      } catch (_) {}
    };

    // ----- Register + poll for updates -----
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Initial update check. The browser can cache /sw.js for up to 24h via
      // HTTP caching headers, which is why Vercel deploys don't always
      // propagate to users on second-launch. Calling update() forces a
      // re-fetch of the SW script with cache-busting headers.
      registration.update().catch(() => {});
      // Expose the registration so the consolidated visibilitychange handler
      // at module bottom can poll for updates without a second listener.
      // (Phase 2 Codex S3 — single combined handler eliminates the soft
      // race between SW update + weather refresh paths.)
      swRegistration = registration;

      // If a new SW was detected during a previous session but never got
      // activated (iOS PWA quirk), it's still sitting in registration.waiting
      // when this page loads. Force it to activate now.
      if (registration.waiting) forceActivate(registration.waiting);

      // updatefound fires when registration.update() detects a new SW and
      // starts installing it. Watch the new SW's state — when it reaches
      // 'installed', explicitly force activation. Belt-and-braces alongside
      // the SW's own install-handler skipWaiting() call, which iOS sometimes
      // honours and sometimes doesn't.
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        debugLog('[SW] updatefound — new worker installing');
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed') forceActivate(newWorker);
        });
      });

      // Periodic update check while the page is open. The existing
      // visibilitychange handler only fires on tab/app focus transitions —
      // a user who just opens PW and uses it without backgrounding the app
      // would never trigger an update check after the initial register call.
      // 60-second polling is cheap: Vercel returns 304 for unchanged /sw.js
      // (verified via curl: ETag set, no-cache header lets browser revalidate).
      setInterval(() => {
        if (swRegistration) swRegistration.update().catch(() => {});
      }, 60_000);
    }).catch((err) => debugLog('Service worker registration failed:', err));
  }
  // Client-side error reporting. Forwards unhandled JS errors + unhandled
  // promise rejections to /api/errors, which logs them to Vercel function
  // logs. Throttled (max ~10 reports/session) and deduped (60s cooldown per
  // signature) so a single hot error doesn't burn the function quota.
  // No external SaaS; upgrade path is to add Sentry later for a UI.
  function setupErrorReporting() {
    let sent = 0;
    const SEND_CAP = 10;
    const seen = new Map(); // signature → last-sent timestamp
    const DEDUPE_MS = 60_000;

    function report(payload) {
      try {
        if (sent >= SEND_CAP) return;
        const sig = `${payload.kind}|${payload.message}|${payload.source || ''}|${payload.line || ''}`;
        const last = seen.get(sig) || 0;
        const now = Date.now();
        if (now - last < DEDUPE_MS) return;
        seen.set(sig, now);
        sent++;
        const body = JSON.stringify({
          ...payload,
          url: location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        });
        // sendBeacon is fire-and-forget and survives page unload — ideal for
        // error reporting where the page may be in the middle of crashing.
        // Falls back to fetch keepalive for browsers without sendBeacon.
        if (navigator.sendBeacon) {
          const blob = new Blob([body], { type: 'application/json' });
          navigator.sendBeacon('/api/errors', blob);
        } else {
          fetch('/api/errors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            keepalive: true,
          }).catch(() => {});
        }
      } catch (_) { /* never let the reporter throw */ }
    }

    window.addEventListener('error', (event) => {
      report({
        kind: 'error',
        message: event.message || String(event.error || 'error'),
        source: event.filename || '',
        line: event.lineno || null,
        col: event.colno || null,
        stack: event.error?.stack || null,
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      const message = (reason && (reason.message || String(reason))) || 'unhandled rejection';
      report({
        kind: 'unhandledrejection',
        message,
        source: '',
        line: null,
        col: null,
        stack: reason?.stack || null,
      });
    });
  }
  // "New version — tap to refresh" banner. Belt-and-braces against any future
  // SW propagation hiccup: even if our auto-reload-on-controllerchange flow
  // fails for any reason (iOS Safari quirk, HTTP cache TTL stuck on old JS,
  // browser refused the update check), the user sees a one-tap escape hatch
  // within ~5 minutes of opening the app instead of silently being stuck on
  // stale code.
  //
  // The probe is /api/version → Vercel commit SHA. Compare the version we saw
  // at boot to the current server version on a 5-min interval + every time
  // the page becomes visible. If they differ AND the banner isn't already up,
  // render it. User tap = location.reload(). Dismiss × = hide for the session.
  function setupVersionBanner() {
    let sessionVersion = null;
    let bannerShown = false;
    const POLL_MS = 5 * 60_000;

    async function checkVersion() {
      try {
        const resp = await fetch('/api/version', { cache: 'no-store' });
        if (!resp.ok) return;
        const data = await resp.json();
        if (!data || typeof data.version !== 'string') return;
        if (sessionVersion === null) {
          sessionVersion = data.version;
          debugLog('[version] session started on', sessionVersion);
          return;
        }
        if (data.version !== sessionVersion && !bannerShown) {
          debugLog('[version] new server version detected:', data.version, 'was', sessionVersion);
          showVersionBanner();
          bannerShown = true;
        }
      } catch (_) { /* network blip — try again on next poll */ }
    }

    function showVersionBanner() {
      const banner = document.createElement('div');
      banner.id = 'versionUpdateBanner';
      banner.className = 'version-update-banner';
      banner.setAttribute('role', 'status');
      banner.setAttribute('aria-live', 'polite');

      const text = document.createElement('span');
      text.className = 'version-update-text';
      text.textContent = t('toasts', 'updateAvailable') || 'New version';

      const action = document.createElement('button');
      action.className = 'version-update-action';
      action.type = 'button';
      action.textContent = t('toasts', 'tapToRefresh') || 'Tap to refresh';
      action.addEventListener('click', () => { window.location.reload(); });

      const dismiss = document.createElement('button');
      dismiss.className = 'version-update-dismiss';
      dismiss.type = 'button';
      dismiss.setAttribute('aria-label', 'Dismiss');
      dismiss.textContent = '×';
      dismiss.addEventListener('click', () => { banner.remove(); });

      banner.appendChild(text);
      banner.appendChild(action);
      banner.appendChild(dismiss);
      document.body.appendChild(banner);
    }

    // Boot probe (records sessionVersion) → interval poll.
    // Foreground-triggered version checks happen via the consolidated
    // visibilitychange handler at module bottom — the test suite enforces
    // a single visibilitychange listener (Phase 2 S3, sw-update-propagation
    // test) to prevent the soft race we hit when there were multiple.
    checkVersion();
    setInterval(checkVersion, POLL_MS);
    versionCheckOnForeground = checkVersion;
  }
  function setSharedLocationIndicator(show) {
    if (!locationEl) return;
    let indicator = document.getElementById('sharedLocationIndicator');
    if (show) {
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'sharedLocationIndicator';
        indicator.className = 'shared-location-indicator';
        locationEl.insertAdjacentElement('afterend', indicator);
      }
      indicator.textContent = t('misc', 'viewingShared');
    } else if (indicator) {
      indicator.remove();
    }
  }

  // ========== UPDATE UI LANGUAGE ==========
  function updateUILanguage() {
    if (navHome) navHome.textContent = t('nav', 'home');
    if (navWeek) navWeek.textContent = t('nav', 'week');
    if (navSearch) navSearch.textContent = t('nav', 'search');
    if (navSettings) navSettings.textContent = t('nav', 'settings');
    if (navSources) navSources.textContent = t('nav', 'sources');
    if (navHourlyHome) navHourlyHome.textContent = `→ ${t('nav', 'hourly')}`;
    if (hourlyBack) hourlyBack.textContent = `← ${t('nav', 'home')}`;
    const dayDetailBackBtn = $('#dayDetailBack');
    if (dayDetailBackBtn) dayDetailBackBtn.textContent = `← ${t('nav', 'week')}`;
    // Sources page populated text — explainer + attribution. The dynamic
    // source-list rows are rendered separately in renderSidebar (data-driven).
    const sourcesExplainerEl = $('#sourcesExplainer');
    if (sourcesExplainerEl) sourcesExplainerEl.textContent = t('sources', 'explainer');
    const sourcesAttributionEl = $('#sourcesAttribution');
    if (sourcesAttributionEl) sourcesAttributionEl.textContent = t('sources', 'attribution');
    const sourcesScreenTitle = screenSources?.querySelector('.screen-title');
    if (sourcesScreenTitle) sourcesScreenTitle.textContent = t('screens', 'sources');
    const hourlyScreenTitle = screenHourly?.querySelector('.screen-title');
    if (hourlyScreenTitle) hourlyScreenTitle.textContent = t('screens', 'hourly');
    const hourlyTitle = screenHourly?.querySelector('.screen-title'); if (hourlyTitle) hourlyTitle.textContent = t('screens', 'hourly');
    const weekTitle = screenWeek?.querySelector('.screen-title'); if (weekTitle) weekTitle.textContent = t('screens', 'week');
    const searchTitle = screenSearch?.querySelector('.screen-title'); if (searchTitle) searchTitle.textContent = t('screens', 'search');
    const settingsTitle = screenSettings?.querySelector('.screen-title'); if (settingsTitle) settingsTitle.textContent = t('screens', 'settings');
    if (searchInput) searchInput.placeholder = t('search', 'placeholder');
    if (searchCancel) searchCancel.textContent = t('search', 'cancel');
    if (clearRecentsBtn) clearRecentsBtn.textContent = t('search', 'clearRecents');
    if (searchEditToggle) searchEditToggle.textContent = searchEditMode ? t('search', 'done') : t('search', 'edit');
    const savedH = screenSearch?.querySelector('.section h3'); if (savedH) savedH.textContent = t('search', 'savedPlaces');
    const recentH = screenSearch?.querySelectorAll('.section h3')[1]; if (recentH) recentH.textContent = t('search', 'recent');
    const unitsH = screenSettings?.querySelector('.settings-section h3'); if (unitsH) unitsH.textContent = t('settings', 'units');
    const tempLabel = unitsTempSelect?.closest('.settings-option')?.querySelector('label'); if (tempLabel) tempLabel.textContent = t('settings', 'temperature');
    const windLabel = unitsWindSelect?.closest('.settings-option')?.querySelector('label'); if (windLabel) windLabel.textContent = t('settings', 'windSpeed');
    const precipLabel = unitsPrecipSelect?.closest('.settings-option')?.querySelector('label'); if (precipLabel) precipLabel.textContent = t('settings', 'precipitation');
    const displayH = screenSettings?.querySelectorAll('.settings-section h3')[1]; if (displayH) displayH.textContent = t('settings', 'display');
    const timeLabel = timeFormatSelect?.closest('.settings-option')?.querySelector('label'); if (timeLabel) timeLabel.textContent = t('settings', 'timeFormat');
    const langH = screenSettings?.querySelectorAll('.settings-section h3')[2]; if (langH) langH.textContent = '';
    const langLabel = languageSelect?.closest('.settings-option')?.querySelector('label'); if (langLabel) langLabel.textContent = t('settings', 'language');
    const aboutH = screenSettings?.querySelectorAll('.settings-section h3')[3]; if (aboutH) aboutH.textContent = t('settings', 'about');
    const aboutP = screenSettings?.querySelector('.settings-section:last-of-type p'); if (aboutP) aboutP.textContent = T.settings.aboutText[settings.lang] || T.settings.aboutText.en;
    if (shareBtn) shareBtn.textContent = `↗ ${t('misc', 'share')}`;
    // L3/L4/L6: footer attribution + shared-location indicator + version are
    // language-managed too.
    const footerAttribution = document.getElementById('footerAttribution');
    if (footerAttribution) footerAttribution.textContent = t('misc', 'dataFrom');
    const versionEl = document.getElementById('appVersion');
    if (versionEl) versionEl.textContent = `Version ${APP_VERSION}`;
    const sharedIndicator = document.getElementById('sharedLocationIndicator');
    if (sharedIndicator) sharedIndicator.textContent = t('misc', 'viewingShared');
    refreshSaveButtonState();
  }

  // Save button has two states (☆ Save / ★ Saved) reflecting whether the
  // active place is in favourites. Called whenever the favourites list,
  // active place, or UI language changes so the pill stays in sync.
  function refreshSaveButtonState() {
    if (!saveCurrent) return;
    const saved = !!(activePlace && loadFavorites().some(p => samePlace(p, activePlace)));
    const label = saved ? t('misc', 'saved') : t('misc', 'save');
    const aria = saved ? t('misc', 'saved') : t('misc', 'savePlace');
    saveCurrent.textContent = `${saved ? '★' : '☆'} ${label}`;
    saveCurrent.title = aria;
    saveCurrent.setAttribute('aria-label', aria);
    saveCurrent.setAttribute('aria-pressed', String(saved));
    saveCurrent.classList.toggle('is-saved', saved);
  }

  function updateLanguageOptions() {
    if (!languageMenu) return;
    languageMenu.querySelectorAll('.language-option').forEach((option) => {
      const selected = option.dataset.lang === settings.lang;
      option.setAttribute('aria-selected', String(selected));
      option.tabIndex = selected ? 0 : -1;
    });
  }

  function openLanguageMenu() {
    if (!languageBtn || !languageMenu) return;
    languageMenu.classList.add('open');
    languageBtn.setAttribute('aria-expanded', 'true');
    updateLanguageOptions();
    const selected = languageMenu.querySelector(`[data-lang="${settings.lang}"]`) || languageMenu.querySelector('.language-option');
    selected?.focus();
  }

  function closeLanguageMenu() {
    if (!languageBtn || !languageMenu) return;
    languageMenu.classList.remove('open');
    languageBtn.setAttribute('aria-expanded', 'false');
  }

  function setSearchEditMode(enabled) {
    searchEditMode = !!enabled;
    screenSearch?.classList.toggle('is-editing', searchEditMode);
    if (searchEditToggle) {
      searchEditToggle.textContent = searchEditMode ? t('search', 'done') : t('search', 'edit');
      searchEditToggle.setAttribute('aria-pressed', String(searchEditMode));
    }
    renderFavorites();
    renderRecents();
  }

  function applyLanguageSelection(lang) {
    if (!SUPPORTED_LANGS.includes(lang)) return;
    settings.lang = lang;
    saveSettings();
    // Ensure the new language's copy bank is loaded (≈30 KB, SW-precached →
    // instant when offline/repeat). applySettings runs in finally so the UI
    // chrome switches immediately even if the bank fetch fails — the witty/
    // headline banks then fall back to en until a later retry succeeds.
    loadCopyBank(lang).catch((e) => console.error('[copy] bank load failed:', e)).finally(() => {
      applySettings();
      closeLanguageMenu();
      languageBtn?.focus();
      installExperience?.refreshLanguage?.();
    });
  }

  function moveLanguageFocus(delta) {
    if (!languageMenu?.classList.contains('open')) return;
    const options = Array.from(languageMenu.querySelectorAll('.language-option'));
    const current = Math.max(0, options.indexOf(document.activeElement));
    const next = (current + delta + options.length) % options.length;
    options[next]?.focus();
  }

  // ========== WEATHER LOGIC ==========
  function computeSkyCondition(norm) {
    const condKey = (norm.conditionKey || '').toLowerCase(), rain = norm.rainPct, cloudPct = norm.cloudPct ?? (Array.isArray(norm.hourly) && norm.hourly[0]?.cloudPct);
    if (condKey === 'thunder') return 'thunder';
    if (condKey === 'hail') return 'hail';
    if (condKey === 'storm' || condKey.includes('thunder')) return 'storm';
    if (condKey === 'fog' || condKey.includes('mist') || condKey.includes('haze')) return 'fog';
    if (isNum(rain) && rain >= 50) return 'rain'; if (isNum(rain) && rain >= 30) return 'rain-possible';
    if (isNum(cloudPct) && cloudPct >= 60) return 'cloudy';
    if (isNum(cloudPct) && cloudPct >= 30) return 'partly-cloudy';
    // If we don't have cloudPct, fall back to condKey
    if (!isNum(cloudPct) && (condKey.includes('overcast') || condKey === 'cloudy')) return 'cloudy';
    if (!isNum(cloudPct) && condKey === 'partly-cloudy') return 'partly-cloudy';
    return 'clear';
  }
  function computeTodaysHero(norm) {
    const apiCondition = (norm.conditionKey || '').toLowerCase();
    const dailyRain = norm.dailyRainPct;
    const effectiveWind = norm.windKph; // Use mean wind, not gusts
    const cloud = norm.cloudPct;
    const isTrulyOvercast    = isNum(cloud) && cloud >= 80;
    const isMostlyCloudy     = isNum(cloud) && cloud >= 55;
    const isSignificantCloud = isNum(cloud) && cloud >= 40;
    const isDay = norm.isDay !== false; // false only when API says night
    // UV temp gate: cold days never warrant a UV headline. Mirror api/weather.js
    // priorities 6 and 16 so the frontend re-rank doesn't reintroduce the bug.
    const hi = norm.todayHigh;
    const uvBlockedByCold = isNum(hi) && hi < 15;
    if (isNum(dailyRain) && dailyRain >= 50) return 'rain';
    if (apiCondition === 'thunder') return 'thunder';
    if (apiCondition === 'hail') return 'hail';
    if (apiCondition === 'storm') return 'storm';
    if (apiCondition === 'cold') return 'cold';
    // cold-clear is preserved as its own display condition so the picker reads
    // from the cold-clear image bucket. Falls through to 'cold' display only if
    // the API didn't classify it that way.
    if (apiCondition === 'cold-clear') return 'cold-clear';
    if (apiCondition === 'heat') return 'heat';
    if (isDay && apiCondition === 'uv' && !(isTrulyOvercast || isMostlyCloudy || isSignificantCloud) && !uvBlockedByCold) return 'uv';
    if (isNum(dailyRain) && dailyRain >= 30) return 'rain';
    if (apiCondition === 'wind') return 'wind';
    if (isNum(effectiveWind) && effectiveWind >= 30) return 'wind';
    if (apiCondition === 'fog') return 'fog';
    if (apiCondition === 'cloudy') return 'cloudy';
    const low = norm.todayLow, uv = norm.uvDaily, feels = norm.feelsLike;
    if (isNum(feels) && feels <= -5) return 'cold';
    if (isNum(low) && low <= 0) return 'cold';
    if (isNum(hi) && hi >= THRESH.HOT_C) return 'heat';
    if (isDay && isNum(uv) && uv >= 8 && !(isTrulyOvercast || isMostlyCloudy || isSignificantCloud) && !uvBlockedByCold) return 'uv';
    if (isNum(effectiveWind) && effectiveWind >= 25) return 'wind';
    if (isNum(hi) && hi <= 10) return 'cold';
    // FIX-003: positive cloud-cover override — don't show 'clear' if the sky is actually 55%+ cloudy
    if (isMostlyCloudy) return 'cloudy';
    return 'clear';
  }
  
  function computeHomeDisplayCondition(norm) {
    const imminentRain = norm.rainPct;
    const apiCondition = (norm.conditionKey || '').toLowerCase();
    const effectiveWind = norm.windKph; // Use mean wind, not gusts
    const cloud = norm.cloudPct;
    const isTrulyOvercast    = isNum(cloud) && cloud >= 80;
    const isMostlyCloudy     = isNum(cloud) && cloud >= 55;
    const isSignificantCloud = isNum(cloud) && cloud >= 40;
    const isDay = norm.isDay !== false;
    // UV temp gate (Bug 2): the server's UV verdict is trusted at L572 below,
    // but the server's UV rung can fire on cold days. Re-check the daily high
    // here so the home label doesn't render "High UV" on a 13°C winter day.
    const hi = norm.todayHigh;
    const uvBlockedByCold = isNum(hi) && hi < 15;

    // FIX-001: Log condition decision for debugging
    const votes = norm.sourceConditions || [];
    debugLog(`[Condition] API=${apiCondition} rain=${imminentRain}% cloud=${cloud}% wind=${effectiveWind}kph`);
    if (votes.length) debugLog('[Source votes]', votes.map(s => `${s.source}:${s.vote}(${s.desc})`).join(', '));

    // FIX-001: Count source votes for majority check
    const rainVotes = votes.filter(v => v.vote === 'rain' || v.vote === 'storm').length;
    const cloudyVotes = votes.filter(v => v.vote === 'cloudy').length;
    const hasMajorityRain = rainVotes >= 2;
    const hasMajorityCloudy = (rainVotes + cloudyVotes) >= 2;

    if (apiCondition === 'thunder') return 'thunder';
    if (apiCondition === 'hail') return 'hail';
    if (apiCondition === 'storm') return 'storm';
    if (apiCondition === 'cold') return 'cold';
    // cold-clear preserved here too — same rationale as computeTodaysHero.
    if (apiCondition === 'cold-clear') return 'cold-clear';
    if (apiCondition === 'heat') return 'heat';
    // FIX: trust the API's rain verdict when 2+ sources voted rain/storm. The API
    // already aggregated source agreement; without this, a unanimous-rain payload
    // gets demoted to 'rain-possible' whenever norm.rainPct happens to land below 50.
    if (apiCondition === 'rain' && votes.length && hasMajorityRain) {
      debugLog(`[Rain consensus] API=rain with ${rainVotes} source votes → returning rain`);
      return 'rain';
    }
    if (isNum(imminentRain) && imminentRain >= 50) return 'rain';
    // FIX-001: rain-possible requires either strong rain signal (≥30%) OR majority source agreement
    if (isNum(imminentRain) && imminentRain >= 30) {
      if (hasMajorityRain || hasMajorityCloudy || !votes.length) return 'rain-possible';
      debugLog(`[FIX-001] Skipping rain-possible: rain=${imminentRain}% but only ${rainVotes} source(s) vote rain`);
    }
    // FIX-003: rain is coming later today (daily ≥50% but not imminent) — show the possible-showers state
    if (norm.rainLater) {
      debugLog(`[FIX-003] rainLater=true, escalating to rain-possible`);
      return 'rain-possible';
    }
    if (isDay && apiCondition === 'uv' && !(isTrulyOvercast || isMostlyCloudy || isSignificantCloud) && !uvBlockedByCold) return 'uv';
    if (apiCondition === 'wind') return 'wind';
    if (isNum(effectiveWind) && effectiveWind >= 30) return 'wind';
    if (apiCondition === 'fog') return 'fog';
    // FIX-001: cloudy requires majority source agreement
    if (apiCondition === 'cloudy') {
      if (hasMajorityCloudy || !votes.length || isTrulyOvercast || isMostlyCloudy) return 'cloudy';
      debugLog(`[FIX-001] Skipping cloudy: only ${cloudyVotes} source(s) vote cloudy, cloud=${cloud}%`);
    }
    if (isNum(effectiveWind) && effectiveWind >= 25) return 'wind';
    const sky = computeSkyCondition(norm);
    if (sky !== 'clear') return sky;
    // FIX-003: positive cloud-cover override — don't show 'clear' if the sky is actually 55%+ cloudy
    if (isMostlyCloudy) {
      debugLog(`[FIX-003] cloud ${cloud}% forces cloudy (sky was clear, apiCondition=${apiCondition})`);
      return 'cloudy';
    }
    return 'clear';
  }

  // ========== TRANSLATED TEXT ==========
  // Defensive copy fallback: if hail/thunder copy is ever missing in a language,
  // fall back to the storm bank for that same language — never English to a
  // non-English user, never the cheerful 'clear' bank for a severe condition.
  const COPY_FALLBACK = { hail: 'storm', thunder: 'storm' };
  function getHeadline(condition) {
    const fb = COPY_FALLBACK[condition];
    return T.headlines[condition]?.[settings.lang]
      || (fb && T.headlines[fb]?.[settings.lang])
      || T.headlines[condition]?.en
      || (fb && T.headlines[fb]?.en)
      || "Clear skies.";
  }
  function getHeroLabel(condition) {
    const fb = COPY_FALLBACK[condition];
    return T.heroLabels[condition]?.[settings.lang]
      || (fb && T.heroLabels[fb]?.[settings.lang])
      || T.heroLabels[condition]?.en
      || (fb && T.heroLabels[fb]?.en)
      || "Pleasant";
  }
  // Witty pools may hold intentional empty slots (partly-cloudy / low-confidence
  // realignment) and day-tagged lines (weekday / weekend / day-named — see
  // witty-day-tags.js). dayAwarePool() is the SINGLE enforcement point: it drops
  // empties and lines not allowed on the current local day, with a never-empty
  // fallback. This replaced the old WEEKDAY_ONLY_FRAGMENTS substring blocklist +
  // weekend-filter.js — structural row-index metadata, not string matching, so a
  // day-named line ("just Tuesday") can never fire on the wrong day in any language.
  const pickRandom = pool => pool.length ? pool[Math.floor(Math.random() * pool.length)] : '';
  function getLocationMonth() {
    const offset = window.__PW_LAST_NORM?.utcOffsetSeconds;
    if (isNum(offset)) {
      const locMs = Date.now() + offset * 1000;
      return new Date(locMs).getUTCMonth() + 1;
    }
    return new Date().getMonth() + 1;
  }
  function getWittyLine(condition) {
    const day = getLocationDayOfWeek(), hour = getLocationHour(activePlace?.lon);
    const context = { day, hour, lat: activePlace?.lat, lon: activePlace?.lon, month: getLocationMonth() };
    const result = eligibleWittyPool({
      copy: T,
      tags: WITTY_DAY_TAGS,
      condition,
      lang: settings.lang,
      context,
      lowConfidence: window.__PW_LAST_NORM?.confidence === 'low',
    });
    if (result.namespace === 'witty_low_confidence') {
      debugLog(`[Witty register] LOW-CONFIDENCE pool for ${condition}/${settings.lang}`);
    }
    return pickRandom(result.pool);
  }
  function getDayBadge(d, dayIndex, hourlyData) {
    const ck = (d.conditionKey || '').toLowerCase();
    if (ck === 'storm') return t('badges', 'rainy');
    if (ck === 'cold' || ck === 'cold-clear') return t('badges', 'cold');
    if (ck === 'heat') return t('badges', 'hot');
    const r = d.rainChance;
    const isRainy = ck === 'rain' || ck === 'rain-possible' || (isNum(r) && r >= 30);
    if (isRainy && dayIndex === 0 && Array.isArray(hourlyData) && hourlyData.length > 0) {
      const currentHour = getLocationHour(activePlace?.lon);
      const rainThreshold = 25;
      let firstRainHour = -1;
      for (let i = 0; i < Math.min(24, hourlyData.length); i++) {
        const h = hourlyData[i];
        if (isNum(h.rainChance) && h.rainChance >= rainThreshold) { firstRainHour = (currentHour + i) % 24; break; }
      }
      if (firstRainHour === -1) return isNum(r) && r >= 50 ? t('badges', 'rainLater') : t('badges', 'showers');
      const hoursUntilRain = firstRainHour >= currentHour ? firstRainHour - currentHour : (24 - currentHour) + firstRainHour;
      if (hoursUntilRain <= 2) return isNum(r) && r >= 50 ? t('badges', 'rainy') : t('badges', 'showers');
      else if (firstRainHour >= 18 || firstRainHour < 5) return t('badges', 'rainTonight');
      else if (firstRainHour >= 5 && firstRainHour < 12) return t('badges', 'rainMorning');
      else return t('badges', 'rainLater');
    }
    if (ck === 'rain') return t('badges', 'rainy');
    if (ck === 'rain-possible') return t('badges', 'showers');
    if (ck === 'uv') return t('badges', 'highUV');
    if (ck === 'wind') return t('heroLabels', 'wind') || 'Windy';
    const u = d.uv, h = d.highC, low = d.lowC;
    if (isNum(low) && low <= 0) return t('badges', 'cold');
    if (isNum(h) && h <= 0) return t('badges', 'cold');
    if (isNum(r) && r >= 50) return t('badges', 'rainy');
    if (isNum(h) && h >= THRESH.HOT_C) return t('badges', 'hot');
    if (isNum(u) && u >= 8) return t('badges', 'highUV');
    if (isNum(r) && r >= 30) return t('badges', 'showers');
    if (isNum(h) && h <= 10) return t('badges', 'cold');
    if (isNum(u) && u >= 6) return t('badges', 'uvAlert');
    return '';
  }
  function getTranslatedDayName(dayIndex) {
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    return t('days', days[dayIndex]);
  }

  // ========== LOCATION TIME HELPER ==========
  function getLocationHour(lon) {
    // Prefer API-provided localHour (uses real UTC offset from Open-Meteo).
    // lon/15 approximation is off by up to 1hr in many SA locations.
    const apiHour = window.__PW_LAST_NORM?.localHour;
    if (isNum(apiHour)) return apiHour;
    if (!isNum(lon)) return new Date().getUTCHours();
    const now = new Date();
    const utcHour = now.getUTCHours() + now.getUTCMinutes() / 60;
    const offsetHours = lon / 15;
    return Math.floor((utcHour + offsetHours + 24) % 24);
  }
  function getLocationDayOfWeek() {
    // Returns 0=Sun,1=Mon...6=Sat for the SEARCHED location, not the device.
    // Uses utcOffsetSeconds from the API to shift UTC time to location time.
    const offset = window.__PW_LAST_NORM?.utcOffsetSeconds;
    if (isNum(offset)) {
      const locationMs = Date.now() + offset * 1000;
      return new Date(locationMs).getUTCDay(); // getUTCDay on shifted time = location's day
    }
    return new Date().getDay(); // fallback to device time
  }
  function getLocationDayOfYear() {
    // Returns 1-366 for the searched location, not the device.
    const offset = window.__PW_LAST_NORM?.utcOffsetSeconds;
    if (isNum(offset)) {
      const locMs = Date.now() + offset * 1000;
      const d = new Date(locMs);
      const start = Date.UTC(d.getUTCFullYear(), 0, 1);
      return Math.floor((locMs - start) / 86400000) + 1;
    }
    const d = new Date();
    const start = new Date(d.getFullYear(), 0, 1);
    return Math.floor((d - start) / 86400000) + 1;
  }

  // ========== BACKGROUND & PARTICLES ==========
  // Bucket the current local time into 'dawn' | 'day' | 'dusk' | 'night' using
  // real solar sunrise/sunset from the API. Falls back to clock hours
  // (5/8/17/20) if the API didn't return sunrise/sunset.
  function getTimeOfDay() {
    const norm = window.__PW_LAST_NORM;
    const parseIsoLocalMinutes = (iso) => {
      // API returns local-labelled ISO strings like "2026-04-15T06:23" (no tz). Read HH/MM directly.
      if (typeof iso !== 'string' || iso.length < 16) return null;
      const h = parseInt(iso.slice(11, 13), 10);
      const m = parseInt(iso.slice(14, 16), 10);
      return (Number.isFinite(h) && Number.isFinite(m)) ? h * 60 + m : null;
    };
    const sunriseMin = parseIsoLocalMinutes(norm?.sunrise);
    const sunsetMin  = parseIsoLocalMinutes(norm?.sunset);
    let timeOfDay;
    if (sunriseMin != null && sunsetMin != null && isNum(norm?.utcOffsetSeconds)) {
      const locMs = Date.now() + norm.utcOffsetSeconds * 1000;
      const locDate = new Date(locMs);
      const nowMin = locDate.getUTCHours() * 60 + locDate.getUTCMinutes();
      // Dawn: 45min before sunrise → 30min after. Dusk: 45min before sunset → 15min after.
      const dawnStart = sunriseMin - 45, dawnEnd = sunriseMin + 30;
      const duskStart = sunsetMin  - 45, duskEnd = sunsetMin  + 15;
      if (nowMin >= dawnStart && nowMin < dawnEnd)        timeOfDay = 'dawn';
      else if (nowMin >= dawnEnd && nowMin < duskStart)   timeOfDay = 'day';
      else if (nowMin >= duskStart && nowMin < duskEnd)   timeOfDay = 'dusk';
      else                                                timeOfDay = 'night';
      debugLog(`[Solar TOD] now=${Math.floor(nowMin/60)}:${String(nowMin%60).padStart(2,'0')} sunrise=${Math.floor(sunriseMin/60)}:${String(sunriseMin%60).padStart(2,'0')} sunset=${Math.floor(sunsetMin/60)}:${String(sunsetMin%60).padStart(2,'0')} → ${timeOfDay}`);
    } else {
      const hour = getLocationHour(activePlace?.lon);
      timeOfDay = hour >= 5 && hour < 8 ? 'dawn' : hour >= 8 && hour < 17 ? 'day' : hour >= 17 && hour < 20 ? 'dusk' : 'night';
      debugLog(`[Solar TOD] fallback to clock hours (no sunrise/sunset in norm) → ${timeOfDay}`);
    }
    return timeOfDay;
  }
  // Hero temperature range, forward-looking by time of day.
  //   dawn  → current temp → today's high   (directional, "warming to")
  //   day   → today's low / today's high    (range, existing behaviour)
  //   dusk  → current temp → tonight's low  (directional, "cooling to")
  //   night → tomorrow's low / tomorrow's high (range)
  function getHeroRange(norm, timeOfDay) {
    const hourly = Array.isArray(norm.hourly) ? norm.hourly : [];
    const localHour = Number.isInteger(norm.localHour) ? norm.localHour : null;
    const fallback = { low: norm.todayLow ?? null, high: norm.todayHigh ?? null, format: 'range' };

    if (timeOfDay === 'dawn') {
      return {
        low: norm.nowTemp ?? norm.todayLow ?? null,
        high: norm.todayHigh ?? null,
        format: 'directional'
      };
    }

    if (timeOfDay === 'dusk') {
      let tonightLow = null;
      if (localHour != null && hourly.length) {
        const sliceEnd = Math.min(localHour + 12, hourly.length);
        const temps = hourly.slice(localHour, sliceEnd).map(h => h?.tempC).filter(isNum);
        if (temps.length) tonightLow = Math.min(...temps);
      }
      if (tonightLow == null) tonightLow = norm.daily?.[1]?.lowC ?? norm.todayLow ?? null;
      return {
        low: tonightLow,
        high: norm.nowTemp ?? norm.todayHigh ?? null,
        format: 'directional'
      };
    }

    if (timeOfDay === 'night') {
      const tomorrow = norm.daily?.[1];
      if (tomorrow?.lowC != null && tomorrow?.highC != null) {
        return { low: tomorrow.lowC, high: tomorrow.highC, format: 'range' };
      }
      return fallback;
    }

    return fallback;
  }
  // Picker state — module-scoped so race-guarding + memoization survive across
  // rapid setBackgroundFor calls (pull-to-refresh fires this 2-3x in succession).
  let __pickerToken = 0;
  // Map keyed by 'folder|time|week'. Map (not single-slot) so condition
  // oscillation A→B→A reuses A's original pick instead of re-rolling.
  // Capped at 16 entries; oldest evicted on overflow (Map preserves insertion order).
  const __pickerMemo = new Map();
  const PICKER_MEMO_CAP = 16;
  function setBackgroundFor(condition) {
    if (!bgImg) return;
    // 4-week date-based rotation (see assets/image-picker.js + docs/picker-rotation-logic.md).
    // The picker reads from the new WebP folder structure:
    //   assets/images/bg/<condition>/week_<1..4>/<dawn|day|dusk|night>/<1..7>.webp
    // Time-of-day comes from getTimeOfDay() (solar-aware, unchanged).
    // Week comes from getRotationWeek() (UTC-anchored to SAST launch Saturday).
    const folder = getWeatherBackgroundFolder(condition);
    const fallbackFolder = getWeatherBackgroundFallbackFolder(condition);
    const timeOfDay = getTimeOfDay();
    const week = getRotationWeek();

    // Memoize the random pick by (folder, time, week). Without this, every
    // re-render (refresh, sidebar re-paint) would pick a fresh image and the
    // background would flicker mid-frame. The memo invalidates the moment any
    // of the three signals changes (condition/time-of-day transition, weekly
    // rollover), so users still get rotation — just not on every paint.
    const key = `${folder}|${timeOfDay}|${week}`;
    let r;
    if (__pickerMemo.has(key)) {
      r = __pickerMemo.get(key);
    } else {
      r = pickRandomIndex();
      __pickerMemo.set(key, r);
      if (__pickerMemo.size > PICKER_MEMO_CAP) {
        const oldest = __pickerMemo.keys().next().value;
        __pickerMemo.delete(oldest);
      }
    }
    const chain = buildPickerPaths(folder, fallbackFolder, timeOfDay, week, r);

    debugLog(`[Image picker] condition=${condition} folder=${folder} week=${week} time=${timeOfDay} pick=${r}/7 → ${chain[0]}`);

    // Race-guarded fallback walk. Each call captures a token; any error/load
    // event from a stale call (cancelled by a later src reassignment) is
    // ignored. Without this, a late error from an aborted load could advance
    // the new chain by one step and show the wrong fallback image.
    const myToken = ++__pickerToken;
    let i = 0;
    const step = () => {
      if (myToken !== __pickerToken) return; // stale
      if (i >= chain.length) {
        debugLog('[Image picker] fallback chain exhausted');
        return;
      }
      if (i > 0) debugLog(`[Image picker] fallback step ${i} → ${chain[i]}`);
      bgImg.src = chain[i];
      i++;
    };
    bgImg.onload = () => {
      if (myToken !== __pickerToken) return;
      // Persist the landed pick so the NEXT cold open paints it immediately
      // from the static shell (index.html inline script reads pw_last_bg)
      // instead of waiting out grace → locate → weather → image — the serial
      // chain measured at 8-10s of black screen on mobile.
      try { localStorage.setItem('pw_last_bg', bgImg.getAttribute('src') || ''); } catch (_) {}
      // Detach so a later cache eviction / network blip can't replay the chain.
      bgImg.onerror = null;
      bgImg.onload = null;
    };
    bgImg.onerror = step;
    step();
  }
  function createParticles(condition) {
    if (!particlesEl) return; particlesEl.innerHTML = '';
    let pc = null, amt = 20;
    if (condition === 'rain' || condition === 'storm') { pc = 'rain'; amt = 28; }
    else if (condition === 'cold') { pc = 'snow'; amt = 18; }
    else if (condition === 'wind') { pc = 'wind'; amt = 16; }
    if (!pc) return;
    for (let i = 0; i < amt; i++) { const p = document.createElement('div'); p.classList.add('particle', pc); p.style.left = `${Math.random() * 100}%`; p.style.animationDelay = `${Math.random() * 2}s`; p.style.animationDuration = `${Math.random() * 3 + 2}s`; particlesEl.appendChild(p); }
  }

  // ========== API ==========
  // Reverse geocode via the server-side LocationIQ proxy (/api/geocode).
  // The proxy resolves the display name (village/town → suburb → city →
  // municipality → state, with the "Ward 4" filter applied) and returns it
  // ready-formatted. Token never reaches the browser.
  async function reverseGeocode(lat, lon) {
    try {
      const resp = await fetch(`/api/geocode?type=reverse&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`, { signal: AbortSignal.timeout(5000) });
      if (!resp.ok) return null;
      const data = await resp.json();
      return (data && data.ok && data.name) ? data.name : null;
    } catch { return null; }
  }
  async function resolvePlaceName(place) { if (!place || !isNum(place.lat) || !isNum(place.lon)) return place?.name || 'Unknown'; if (!isPlaceholderName(place.name)) return place.name; return await reverseGeocode(place.lat, place.lon) || place.name || 'Unknown'; }
  function combineAbortSignals(signals) {
    const active = signals.filter(Boolean);
    if (!active.length) return undefined;
    if (active.length === 1) return active[0];
    if (AbortSignal.any) return AbortSignal.any(active);
    const controller = new AbortController();
    const abort = () => controller.abort();
    active.forEach(signal => {
      if (signal.aborted) abort();
      else signal.addEventListener('abort', abort, { once: true });
    });
    return controller.signal;
  }
  async function fetchProbable(place, options = {}) {
    const url = `/api/weather?lat=${encodeURIComponent(place.lat)}&lon=${encodeURIComponent(place.lon)}&name=${encodeURIComponent(place.name || '')}`;
    const controller = new AbortController();
    let didTimeout = false;
    const timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, 10000);
    const signal = combineAbortSignals([controller.signal, options.signal]);
    try {
      const resp = await fetch(url, { signal });
      if (!resp.ok) throw new Error('API error');
      return await resp.json();
    } catch (err) {
      if (didTimeout && err?.name === 'AbortError') {
        err.weatherTimeout = true;
        showToast(t('toasts', 'weatherTimeout') || 'Weather lookup taking too long. Try again.');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  function normalizePayload(payload) {
    const now = payload.now || {}, today = payload.daily?.[0] || {}, meta = payload.meta || {}, sources = meta.sources || [];
    const hourly = payload.hourly || [];
    // hourly is a 48-entry local-time array (0=midnight today … 47=23:00 tomorrow).
    // Slicing from 0 always grabbed midnight–3am — not "next 4 hours from now".
    // Start at the current local hour so the window genuinely reflects what's
    // about to happen. The 48-hour span gives natural wraparound into tomorrow.
    const localHour = Number.isInteger(payload?.meta?.localHour) ? payload.meta.localHour : null;
    const imminentHours = localHour != null ? hourly.slice(localHour, localHour + 4) : [];
    const imminentRainMax = imminentHours.length > 0 ? Math.max(...imminentHours.map(h => h.rainChance ?? 0)) : null;
    debugLog(`[Imminent slice] localHour=${localHour} → next 4 hours rain max: ${imminentRainMax}%`);
    const displayRainPct = isNum(imminentRainMax) ? imminentRainMax : (today.rainChance ?? now.rainChance ?? null);
    const dailyRainPct = today.rainChance ?? now.rainChance ?? null;
    const rainLater = isNum(imminentRainMax) && imminentRainMax < 30 && isNum(dailyRainPct) && dailyRainPct >= 50;
    return { 
      nowTemp: now.tempC ?? null, feelsLike: now.feelsLikeC ?? null, todayHigh: today.highC ?? null, todayLow: today.lowC ?? null, 
      rainPct: displayRainPct, dailyRainPct: dailyRainPct, rainLater: rainLater,
      uv: now.uv ?? null,        // now.uv is null at night (API nulls it after sunset)
      uvDaily: today.uv ?? null, // today's peak UV, for daytime byline reference only
      isDay: now.isDay !== false, // false only when API explicitly says night
      sunrise: now.sunrise ?? null, // ISO string from Open-Meteo, local-labelled (no tz)
      sunset:  now.sunset  ?? null, // used for real solar-time dawn/dusk/night bucketing
      localHour: meta.localHour ?? null, // correct local hour from API (uses real UTC offset)
      utcOffsetSeconds: meta.utcOffsetSeconds ?? null, // UTC offset for location day-of-week calc
      windKph: isNum(payload.wind_kph) ? payload.wind_kph : (isNum(now.windKph) ? now.windKph : 0), 
      maxWindKph: isNum(payload.maxWindKph) ? payload.maxWindKph : null,
      gustKph: isNum(payload.gustKph) ? payload.gustKph : null,
      cloudPct: isNum(now.cloudPct) ? now.cloudPct : (Array.isArray(payload.hourly) && payload.hourly[0] ? payload.hourly[0].cloudPct ?? null : null),
      conditionKey: now.conditionKey || today.conditionKey || null, conditionLabel: now.conditionLabel || today.conditionLabel || '', 
      confidenceKey: payload.consensus?.confidenceKey || 'mixed', 
      used: sources.filter(s => s.ok).map(s => s.name), failed: sources.filter(s => !s.ok).map(s => s.name),
      hourly: hourly, daily: payload.daily || [], locationName: payload.location?.name, sourceRanges: meta.sourceRanges || [],
      sourceConditions: meta.sourceConditions || [], // FIX-001: per-source condition votes
      // Layer A/B (Bug 1): confidence register. 'high' unless the API flagged a
      // fog trend or source disagreement. getWittyLine reads `confidence`;
      // conditionConfidence is the full audit block for the debug overlay.
      confidence: meta.confidence === 'low' ? 'low' : 'high',
      fogTrendIncoming: meta.fogTrendIncoming === true,
      conditionConfidence: meta.conditionConfidence || null
    };
  }

  // ========== CAPE DOCTOR WIND ALERT ==========
  // Dismissal persisted in localStorage with a 24-hour expiry. Previous session-only
  // flag meant every reload re-fired the banner; persisting it lets the user dismiss
  // today's wind event without losing the affordance for tomorrow's.
  const WIND_BANNER_DISMISS_KEY = 'pw-wind-banner-dismissed-until';
  const WIND_BANNER_DISMISS_MS = 24 * 60 * 60 * 1000;
  function isCapeWindDismissed() {
    try {
      const until = parseInt(localStorage.getItem(WIND_BANNER_DISMISS_KEY) || '0', 10);
      return Number.isFinite(until) && Date.now() < until;
    } catch (_) { return false; }
  }
  function dismissCapeWind() {
    try {
      localStorage.setItem(WIND_BANNER_DISMISS_KEY, String(Date.now() + WIND_BANNER_DISMISS_MS));
    } catch (_) {}
  }
  function syncCapeWindOffset() {
    if (!capeWindBanner) return;
    if (capeWindBanner.classList.contains('hidden')) {
      document.documentElement.style.removeProperty('--cape-wind-offset');
      return;
    }
    // Measure after the banner is unhidden so safe-area padding is included.
    requestAnimationFrame(() => {
      const h = capeWindBanner.getBoundingClientRect().height;
      if (h > 0) document.documentElement.style.setProperty('--cape-wind-offset', `${Math.ceil(h)}px`);
    });
  }
  // Pin the Cape-Doctor warning line per appearance so it doesn't re-roll on
  // every re-render (unit switch, language switch, PTR, interval refresh) — that
  // flicker read as a glitch. Re-picks only when the language changes.
  let capeWindLine = null, capeWindLineKey = null;
  function renderCapeWind(norm) {
    if (!capeWindBanner) return;
    const wind = norm.windKph;
    if (!isCapeWindDismissed() && isWesternCape(activePlace) && isNum(wind) && wind >= 50) {
      const lines = T.capeDr.lines[settings.lang] || T.capeDr.lines.en;
      const label = T.capeDr.warningLabel?.[settings.lang] || T.capeDr.warningLabel?.en || 'WIND WARNING';
      if (capeWindLineKey !== settings.lang || !capeWindLine) {
        capeWindLine = lines[Math.floor(Math.random() * lines.length)];
        capeWindLineKey = settings.lang;
      }
      safeText(capeWindText, `⚠️ ${label} — ${capeWindLine}`);
      capeWindBanner.classList.remove('hidden');
      syncCapeWindOffset();
    } else {
      capeWindBanner.classList.add('hidden');
      syncCapeWindOffset();
    }
  }
  if (capeWindDismiss) capeWindDismiss.addEventListener('click', () => {
    dismissCapeWind();
    if (capeWindBanner) capeWindBanner.classList.add('hidden');
    syncCapeWindOffset();
  });
  // Keep the offset accurate if the user rotates the device or resizes the window.
  window.addEventListener('resize', syncCapeWindOffset);


  // Share button (mobile only — Web Share API)
  const shareBtn = $('#shareBtn');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const lat = activePlace?.lat, lon = activePlace?.lon;
      const lang = settings.lang || 'en';
      const displayCond = window.__PW_LAST_DISPLAY || 'clear';
      const rawCity = (locationEl?.textContent || '').trim();
      const cityForUrl = rawCity || null;
      const url = buildShareUrl({ lat, lon, lang, condition: displayCond, city: cityForUrl });
      const cityForCopy = rawCity || t('misc', 'shareYourArea');
      const text = t('misc', 'shareMessage')
        .replace('{city}', cityForCopy)
        .replace('{url}', url);
      try {
        if (navigator.share) {
          // URL is already interpolated into `text` via the {url} placeholder
          // in T.misc.shareMessage. Passing it again as the dedicated `url`
          // field made WhatsApp render the link twice in the message body
          // (Codex Z5 finding, Phase 2). Dropping the field keeps WhatsApp's
          // preview-card generation intact (it parses URLs from text) while
          // removing the duplication.
          await navigator.share({ title: 'Probably Weather', text });
        } else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          showToast('Share link copied');
        } else {
          window.prompt('Copy this share link', text);
        }
      } catch {}
    });
  }

  // ========== RENDER ==========
  // Splash teardown — the static shell splash (#pwSplash in index.html) stays
  // up until the FIRST real render (weather content or an explicit error).
  // renderLoading keeps it up on purpose: "Locating…" is still pre-content.
  function hideSplash() {
    // G4: mark that a real render landed, so the index.html boot-failure guard
    // knows the boot succeeded and never shows its error state.
    window.__PW_FIRST_RENDER = true;
    const splash = document.getElementById('pwSplash');
    if (!splash) return;
    splash.classList.add('splash-done');
    setTimeout(() => splash.remove(), 450);
  }
  function renderLoading(name) { showLoader(true); safeText(locationEl, name); safeText(headlineEl, t('misc', 'loading')); safeText(tempEl, '--°'); safeText(descriptionEl, '—'); }
  function renderError(msg) { hideSplash(); showLoader(false); safeText(headlineEl, t('misc', 'error')); safeText(descriptionEl, msg || t('misc', 'couldntFetch')); }
  function renderSidebar(norm, heroOverride) {
    if (!norm && window.__PW_LAST_NORM) norm = window.__PW_LAST_NORM; if (!norm) return;
    // Source-list rendering moved to the dedicated /Sources nav page. The old
    // sidebar pill is now the Hourly entry point and doesn't carry data.
    renderSourcesScreen(norm);
  }
  // Sources page — rebuild the per-source temperature-range list from norm.
  // Runs whenever fresh weather data lands AND on language switch (via
  // applySettings → renderSidebar → here). No-op when the screen isn't in the DOM.
  function renderSourcesScreen(norm) {
    const listEl = $('#sourcesList');
    if (!listEl) return;
    const sr = (norm && Array.isArray(norm.sourceRanges)) ? norm.sourceRanges : [];
    listEl.innerHTML = '';
    if (sr.length === 0) {
      const li = document.createElement('li');
      li.className = 'sources-list-empty';
      li.textContent = '--';
      listEl.appendChild(li);
      return;
    }
    for (const s of sr) {
      const li = document.createElement('li');
      li.className = 'sources-list-item';
      const name = document.createElement('span');
      name.className = 'sources-list-name';
      name.textContent = s.name || '—';
      const range = document.createElement('span');
      range.className = 'sources-list-range';
      range.textContent = (isNum(s.minTemp) && isNum(s.maxTemp))
        ? `${round0(s.minTemp)}° – ${round0(s.maxTemp)}°`
        : '--';
      li.appendChild(name);
      li.appendChild(range);
      listEl.appendChild(li);
    }
  }
  // Reserved ad slot — empty container that ships with a witty placeholder.
  // When Adsterra/Media.net approval lands, the .pw-ad-placeholder child gets
  // swapped for the real ad iframe; the .pw-ad-slot wrapper stays as the
  // layout anchor so spacing/sizing don't shift.
  function buildAdSlot(slotName) {
    const slot = document.createElement('div');
    slot.className = 'pw-ad-slot';
    slot.setAttribute('data-ad-slot', slotName);
    const placeholder = document.createElement('div');
    placeholder.className = 'pw-ad-placeholder';
    const label = document.createElement('span');
    label.className = 'pw-ad-label';
    label.textContent = t('adSlot', 'placeholder');
    placeholder.appendChild(label);
    slot.appendChild(placeholder);
    return slot;
  }
  function renderHome(norm) {
    hideSplash();
    showLoader(false);
    const currentTemp = norm.nowTemp, rain = norm.rainPct, wind = norm.windKph, uv = norm.uv;
    const displayCondition = computeHomeDisplayCondition(norm), hero = computeTodaysHero(norm);
    // Body/CSS variant: partly-cloudy reuses cloudy; hail/thunder reuse storm.
    // No dedicated CSS for the new keys — they share storm imagery and theme.
    const CSS_VARIANT_ALIAS = { 'partly-cloudy': 'cloudy', hail: 'storm', thunder: 'storm' };
    const cssVariant = CSS_VARIANT_ALIAS[displayCondition] || displayCondition;
    document.body.classList.remove('weather-cold', 'weather-heat', 'weather-storm', 'weather-rain', 'weather-wind', 'weather-fog', 'weather-clear', 'weather-cloudy');
    document.body.classList.add(`weather-${cssVariant}`);
    let locationName = norm.locationName || activePlace?.name || 'South Africa'; safeText(locationEl, locationName);
    setSharedLocationIndicator(!!activePlace?.shared);
    // GPS-home name persistence (fix: returning-user open showed raw coords).
    // The weather endpoint's location.name is display-only; the stored
    // homePlace.name came from buildLocationName coords-fallbacks and was never
    // healed (the placeholder block below skips a stuck coords string). Write the
    // good name back onto the GPS home so the next-day open reads it. The
    // predicate refuses a coords-shaped name (never re-seed the bug) and a place
    // whose coords don't match the home (never clobber a pinned/shared place).
    if (shouldPersistHomeName({ locationName: norm.locationName, homePlace, activePlace })) {
      homePlace.name = norm.locationName;
      saveJSON(STORAGE.home, homePlace);
    }
    if (isPlaceholderName(locationName) && activePlace?.lat && activePlace?.lon) {
      const cp = activePlace; reverseGeocode(activePlace.lat, activePlace.lon).then(cn => { if (cn && cp === activePlace) { safeText(locationEl, cn); if (activePlace) activePlace.name = cn; if (homePlace && homePlace.lat === cp.lat && homePlace.lon === cp.lon) { homePlace.name = cn; saveJSON(STORAGE.home, homePlace); } } }).catch(() => {});
    }
    // BUG-3 fix: home screen shows min/max range as primary temp, not current temp.
    // Forward-looking: dawn = current → today's high, dusk = current → tonight's low,
    // night = tomorrow's range, day = today's low/high.
    const timeOfDay = getTimeOfDay();
    const { low, high, format } = getHeroRange(norm, timeOfDay);
    debugLog(`[Hero range] timeOfDay=${timeOfDay} format=${format} low=${low} high=${high}`);
    const probablyLabel = t('weather', 'probably');
    const hiStr = isNum(high) ? formatTemp(high) : '--°';
    const loStr = isNum(low) ? formatTemp(low) : '--°';
    if (format === 'directional') {
      // dawn: current (low) → today's high. dusk: current (high) → tonight's low.
      const fromStr = (timeOfDay === 'dusk') ? hiStr : loStr;
      const toStr   = (timeOfDay === 'dusk') ? loStr : hiStr;
      safeText(tempEl, `${probablyLabel} ${fromStr} → ${toStr}`);
    } else {
      safeText(tempEl, `${probablyLabel} ${loStr} / ${hiStr}`);
    }
    const hiLoEl = $('#tempHiLo');
    if (hiLoEl) {
      hiLoEl.textContent = '';
      hiLoEl.style.display = 'none';
    }
    // At night, override 'clear' copy so we don't say "Beach or braai?" at midnight.
    // Use real solar bucketing so dawn/dusk don't get mislabelled as night.
    // (timeOfDay was already computed earlier for the hero range — reuse it.)
    const displayConditionForCopy = (timeOfDay === 'night' && displayCondition === 'clear') ? 'night' : displayCondition;
    debugLog('[Hero copy] timeOfDay:', timeOfDay, 'displayCondition:', displayCondition, 'forCopy:', displayConditionForCopy);
    safeText(headlineEl, getWittyLine(displayConditionForCopy));
    safeText(descriptionEl, getHeadline(displayConditionForCopy));
    debugLog('[Layout] description:', descriptionEl?.textContent, 'headline:', headlineEl?.textContent);
    const bylineEl = $('#weatherByline');
    if (bylineEl) {
      const gust = norm.gustKph;
      const showGust = isNum(gust) && isNum(wind) && gust > wind * 1.3;
      const ws = isNum(wind) ? (showGust ? `${formatWind(wind)} (${t('weather','gusts')||'gusts'} ${formatWind(gust)})` : formatWind(wind)) : '--';
      const rainLabel = t('weather', 'rain'), windLabel = t('weather', 'wind'), uvLabel = t('weather', 'uv');
      let rs = '--';
      if (isNum(rain)) { rs = rain < 10 ? t('weather', 'none') : rain < 30 ? t('weather', 'unlikely') : rain < 55 ? t('weather', 'possible') : t('weather', 'likely'); }
      // Don't say "Unlikely" / "None" when today's daily ensemble says rain — that contradicts the day's outlook
      const todayKey = (norm.daily?.[0]?.conditionKey || '').toLowerCase();
      if ((todayKey === 'rain' || todayKey === 'rain-possible') && isNum(rain) && rain < 30) {
        rs = t('weather', 'possibleLater') || 'Possible later';
      }
      if (norm.rainLater) { rs = t('weather', 'later') || 'Later'; }
      // uv is null at night (API nulls now.uv after sunset) — show nothing
      let us = '--'; if (isNum(uv)) { us = (uv < 3 ? t('weather', 'low') : uv < 6 ? t('weather', 'moderate') : uv < 8 ? t('weather', 'high') : t('weather', 'veryHigh')) + ` (${round0(uv)})`; }
      const feels = norm.feelsLike;
      const showFeels = isNum(feels) && isNum(currentTemp) && Math.abs(feels - currentTemp) >= 3;
      const feelsStr = showFeels ? `${t('weather', 'feelsLike')} ${formatTemp(feels)}` : '';
      const line1 = `${windLabel} ${ws} • ${rainLabel} ${rs}`;
      const line2 = `${uvLabel} ${us}${feelsStr ? ' • ' + feelsStr : ''}`;
      bylineEl.innerHTML = `<div class="byline-row">${line1}</div><div class="byline-row">${line2}</div>`;
    }
    const hc = ['hero-storm', 'hero-rain', 'hero-heat', 'hero-cold', 'hero-wind', 'hero-uv', 'hero-clear', 'hero-cloudy', 'hero-fog'];
    // partly-cloudy reuses the cloudy hero colour — no dedicated CSS yet.
    const heroVariant = displayCondition === 'partly-cloudy' ? 'cloudy' : displayCondition;
    [headlineEl, tempEl].forEach(el => { if (el) { el.classList.remove(...hc); el.classList.add('hero-' + heroVariant); } });
    window.__PW_LAST_DISPLAY = displayCondition; window.__PW_LAST_HERO = hero;
    renderSidebar(norm, hero); setBackgroundFor(displayCondition); createParticles(displayCondition);
    renderCapeWind(norm);
  }
  // Hourly row icon. Delegates to pickHourlyEmoji so every branch
  // (rain, partly cloudy, cloudy, clear, cold, heat) honours isNight — not
  // just the clear fallback. This fixes the 20:00 sun-with-rain-cloud bug
  // (rain-possible was returning 🌦️ regardless of time of day).
  // `cond` is the per-hour categorised condition from the API — lets thunder
  // and fog hours render correctly (the numeric ladder has no weather code).
  function getWeatherIcon(rp, cp, tc, isNight, cond) {
    return pickHourlyEmoji({ rainPct: rp, cloudPct: cp, tempC: tc, isNight: !!isNight, condition: cond });
  }
  function renderHourly(hourly) {
    if (!hourlyTimeline) return; hourlyTimeline.innerHTML = '';
    const nowHour = getLocationHour(activePlace?.lon);
    const currentWind = window.__PW_LAST_NORM?.windKph || null;
    // Bug 2b: solar day/night for the hourly icons. Sunrise/sunset parsed once
    // per render — they drift under 2 minutes across the 48h window so a
    // single day's values cover the whole list.
    const sunriseMin = parseLocalIsoMinutes(window.__PW_LAST_NORM?.sunrise);
    const sunsetMin  = parseLocalIsoMinutes(window.__PW_LAST_NORM?.sunset);
    const header = document.createElement('div');
    header.classList.add('hourly-row', 'hourly-header');
    header.innerHTML = `<span class="h-time">${t('weather', 'time') || 'Time'}</span><span class="h-icon"></span><span class="h-temp">${t('weather', 'temp') || 'Temp'}</span><span class="h-rain">${t('weather', 'rain') || 'Rain'}</span><span class="h-mm">${precipUnitLabel()}</span><span class="h-wind">${t('weather', 'wind') || 'Wind'}</span><span class="h-uv">${t('weather', 'uv') || 'UV'}</span>`;
    hourlyTimeline.appendChild(header);
    // Hourly array starts at midnight local time. Slice from current hour so
    // the data shown matches the time label. Show remaining hours of today + up to 24 total.
    const slicedHourly = hourly.slice(nowHour, nowHour + 24);
    slicedHourly.forEach((h, i) => {
      const div = document.createElement('div'); div.classList.add('hourly-row');
      const hourNum = (nowHour + i) % 24;
      const ht = settings.time === '12' ? `${hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum}${hourNum >= 12 ? 'pm' : 'am'}` : `${String(hourNum).padStart(2, '0')}:00`;
      const iconTemp = (isNum(h.feelsLikeC) && h.feelsLikeC < h.tempC) ? h.feelsLikeC : h.tempC;
      // Bug 2b: real sunrise/sunset day-night, not a hardcoded 20:00 band.
      // Falls back to the old 20:00-05:00 band only when no solar data exists.
      const daylight = isHourDaylight(hourNum, sunriseMin, sunsetMin);
      const isNightHour = daylight === null ? (hourNum >= 20 || hourNum < 5) : !daylight;
      const icon = getWeatherIcon(h.rainChance, h.cloudPct, iconTemp, isNightHour, h.condition);
      const rainPct = isNum(h.rainChance) ? round0(h.rainChance) + '%' : '--';
      const rawWind = h.windKmh ?? h.windKph ?? h.wind_kph ?? (i < 3 ? currentWind : null);
      const windSpeed = isNum(rawWind) ? (settings.wind === 'mph' ? round0(rawWind * 0.621371) : round0(rawWind)) : '--';
      const tempClass = getTempColorClass(h.tempC);
      const uvVal = isNum(h.uv) ? round0(h.uv) : '--';
      const uvClass = isNum(h.uv) ? (h.uv >= 8 ? 'uv-extreme' : h.uv >= 6 ? 'uv-high' : h.uv >= 3 ? 'uv-mod' : '') : '';
      const precipAmount = formatPrecipAmount(h.precipMm);
      div.innerHTML = `<span class="h-time">${ht}</span><span class="h-icon">${icon}</span><span class="h-temp ${tempClass}">${formatTemp(h.tempC)}</span><span class="h-rain">${rainPct}</span><span class="h-mm">${precipAmount}</span><span class="h-wind">${windSpeed}</span><span class="h-uv ${uvClass}">${uvVal}</span>`;
      hourlyTimeline.appendChild(div);
      // Reserved ad slot — after row 6 (0-indexed i===5), so it sits between
      // the 6th and 7th hour. User has scrolled past a few hours but hasn't
      // reached the bottom yet.
      if (i === 5) hourlyTimeline.appendChild(buildAdSlot('hourly'));
    });
  }
  function renderWeek(daily, hourlyData) {
    if (!dailyCards) return; dailyCards.innerHTML = '';
    const header = document.createElement('div');
    header.classList.add('daily-row', 'daily-header');
    header.innerHTML = `<span class="d-day">${t('weather', 'day') || 'Day'}</span><span class="d-icon"></span><span class="d-high">${t('weather', 'high') || 'High'}</span><span class="d-low">${t('weather', 'low') || 'Low'}</span><span class="d-rain">${t('weather', 'rain') || 'Rain'}</span>`;
    dailyCards.appendChild(header);
    daily.forEach((d, i) => {
      const offsetMs = (window.__PW_LAST_NORM?.utcOffsetSeconds ?? 0) * 1000;
      const date = new Date(Date.now() + offsetMs + i * 86400000);
      const dayName = getTranslatedDayName(date.getUTCDay());
      const badge = getDayBadge(d, i, hourlyData);
      // Daily emoji uses the full consensus conditionKey (deriveCondition output),
      // which carries the partly-cloudy / cloudy / storm / fog distinctions that a
      // rain+temp-only fallback cannot — so the week list agrees with the home hero.
      const icon = conditionEmoji(d.conditionKey);
      const rainPct = isNum(d.rainChance) ? round0(d.rainChance) + '%' : '--';
      const highTempClass = getTempColorClass(d.highC);
      const lowTempClass = getTempColorClass(d.lowC);
      const div = document.createElement('div'); div.classList.add('daily-row', 'daily-row-tappable');
      div.dataset.dayIndex = String(i);
      div.setAttribute('role', 'button');
      div.setAttribute('tabindex', '0');
      div.innerHTML = `<span class="d-day">${dayName}${badge ? ` <span class="day-badge">${badge}</span>` : ''}</span><span class="d-icon">${icon}</span><span class="d-high ${highTempClass}">${isNum(d.highC) ? formatTemp(d.highC) : '--°'}</span><span class="d-low ${lowTempClass}">${isNum(d.lowC) ? formatTemp(d.lowC) : '--°'}</span><span class="d-rain">${rainPct}</span>`;
      div.addEventListener('click', () => {
        debugLog(`[Day click] dayIndex=${i}`);
        showScreen(screenDayDetail);
        renderDayDetail(window.__PW_LAST_NORM, i);
      });
      div.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); div.click(); }
      });
      dailyCards.appendChild(div);
      // Reserved ad slot — after day 3 (0-indexed i===2), so it sits between
      // day 3 and day 4 of the 7-day forecast.
      if (i === 2) dailyCards.appendChild(buildAdSlot('weekly'));
    });
  }
  function renderDayDetail(norm, dayIndex) {
    if (!norm) return;
    const day = norm.daily?.[dayIndex];
    if (!day) return;

    // Header: day name + date + condition + high/low.
    const offsetMs = (norm.utcOffsetSeconds ?? 0) * 1000;
    const date = new Date(Date.now() + offsetMs + dayIndex * 86400000);
    const dayName = getTranslatedDayName(date.getUTCDay());
    const dateStr = `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    const hi = isNum(day.highC) ? formatTemp(day.highC) : '--°';
    const lo = isNum(day.lowC)  ? formatTemp(day.lowC)  : '--°';
    const cond = day.conditionLabel || '—';
    const headerName = $('#dayDetailDayName');
    const headerMeta = $('#dayDetailMeta');
    if (headerName) headerName.textContent = `${dayName} ${dateStr}`;
    if (headerMeta) headerMeta.textContent = `${cond} • ${lo} / ${hi}`;

    const content = $('#day-detail-content');
    if (!content) return;
    content.innerHTML = '';

    const hourly = Array.isArray(norm.hourly) ? norm.hourly : [];
    if (dayIndex === 0) {
      // Today: now → end of today only. Hourly slice is [localHour..24).
      const startHour = Number.isInteger(norm.localHour) ? norm.localHour : 0;
      renderDayDetailHourly(content, hourly.slice(startHour, 24), startHour);
    } else if (dayIndex === 1) {
      // Tomorrow: full day, hourly[24..48).
      renderDayDetailHourly(content, hourly.slice(24, 48), 0);
    } else {
      renderDayDetailSummary(content, day);
    }

    debugLog(`[Day detail] dayIndex=${dayIndex} hourly=${dayIndex <= 1} day=${day.conditionLabel}`);
  }
  function renderDayDetailHourly(container, hourlySlice, startHour) {
    const header = document.createElement('div');
    header.classList.add('hourly-row', 'hourly-header');
    header.innerHTML = `<span class="h-time">${t('weather', 'time') || 'Time'}</span><span class="h-icon"></span><span class="h-temp">${t('weather', 'temp') || 'Temp'}</span><span class="h-rain">${t('weather', 'rain') || 'Rain'}</span><span class="h-mm">${precipUnitLabel()}</span><span class="h-wind">${t('weather', 'wind') || 'Wind'}</span><span class="h-uv">${t('weather', 'uv') || 'UV'}</span>`;
    container.appendChild(header);
    const currentWind = window.__PW_LAST_NORM?.windKph || null;
    // Bug 2b: solar day/night for day-detail hourly icons (see renderHourly).
    const sunriseMin = parseLocalIsoMinutes(window.__PW_LAST_NORM?.sunrise);
    const sunsetMin  = parseLocalIsoMinutes(window.__PW_LAST_NORM?.sunset);
    hourlySlice.forEach((h, i) => {
      if (!h) return;
      const div = document.createElement('div'); div.classList.add('hourly-row');
      const hourNum = (startHour + i) % 24;
      const ht = settings.time === '12'
        ? `${hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum}${hourNum >= 12 ? 'pm' : 'am'}`
        : `${String(hourNum).padStart(2, '0')}:00`;
      const iconTemp = (isNum(h.feelsLikeC) && h.feelsLikeC < h.tempC) ? h.feelsLikeC : h.tempC;
      // Bug 2b: real sunrise/sunset day-night, not a hardcoded 20:00 band.
      const daylight = isHourDaylight(hourNum, sunriseMin, sunsetMin);
      const isNightHour = daylight === null ? (hourNum >= 20 || hourNum < 5) : !daylight;
      const icon = getWeatherIcon(h.rainChance, h.cloudPct, iconTemp, isNightHour, h.condition);
      const rainPct = isNum(h.rainChance) ? round0(h.rainChance) + '%' : '--';
      const rawWind = h.windKmh ?? h.windKph ?? h.wind_kph ?? (i < 3 ? currentWind : null);
      const windSpeed = isNum(rawWind) ? (settings.wind === 'mph' ? round0(rawWind * 0.621371) : round0(rawWind)) : '--';
      const tempClass = getTempColorClass(h.tempC);
      const uvVal = isNum(h.uv) ? round0(h.uv) : '--';
      const uvClass = isNum(h.uv) ? (h.uv >= 8 ? 'uv-extreme' : h.uv >= 6 ? 'uv-high' : h.uv >= 3 ? 'uv-mod' : '') : '';
      const precipAmount = formatPrecipAmount(h.precipMm);
      div.innerHTML = `<span class="h-time">${ht}</span><span class="h-icon">${icon}</span><span class="h-temp ${tempClass}">${isNum(h.tempC) ? formatTemp(h.tempC) : '--°'}</span><span class="h-rain">${rainPct}</span><span class="h-mm">${precipAmount}</span><span class="h-wind">${windSpeed}</span><span class="h-uv ${uvClass}">${uvVal}</span>`;
      container.appendChild(div);
      // Reserved ad slot — same position as the main Hourly screen (after row 6).
      if (i === 5) container.appendChild(buildAdSlot('day-detail'));
    });
  }
  function renderDayDetailSummary(container, day) {
    const card = document.createElement('div');
    card.classList.add('day-detail-summary-card');
    // Daily emoji uses the full consensus conditionKey (see renderWeek).
    const icon = conditionEmoji(day.conditionKey);
    const cond = day.conditionLabel || '—';
    const hi = isNum(day.highC) ? formatTemp(day.highC) : '--°';
    const lo = isNum(day.lowC)  ? formatTemp(day.lowC)  : '--°';
    const hiClass = getTempColorClass(day.highC);
    const loClass = getTempColorClass(day.lowC);
    const rainPct = isNum(day.rainChance) ? round0(day.rainChance) + '%' : '--';
    const uvVal = isNum(day.uv) ? round0(day.uv) : '--';
    const uvClass = isNum(day.uv) ? (day.uv >= 8 ? 'uv-extreme' : day.uv >= 6 ? 'uv-high' : day.uv >= 3 ? 'uv-mod' : '') : '';
    const fmtTime = (iso) => {
      if (typeof iso !== 'string' || iso.length < 16) return '--';
      const h = parseInt(iso.slice(11, 13), 10);
      const m = parseInt(iso.slice(14, 16), 10);
      if (!Number.isFinite(h) || !Number.isFinite(m)) return '--';
      if (settings.time === '12') {
        const hh12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return `${hh12}:${String(m).padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`;
      }
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };
    const sunrise = fmtTime(day.sunrise);
    const sunset  = fmtTime(day.sunset);
    const rainLabel = t('weather', 'rain') || 'Rain';
    const uvLabel = t('weather', 'uv') || 'UV';
    const sunriseLabel = t('weather', 'sunrise') || 'Sunrise';
    const sunsetLabel  = t('weather', 'sunset')  || 'Sunset';
    const disclaimer = t('weather', 'hourlySoon') || 'Hourly forecast appears 48 hours before this day.';
    // Card now ends at the stats grid; the disclaimer is appended as a sibling
    // so the reserved ad slot can sit between the stats and the disclaimer
    // (Al's spec for the summary-card view: between temperature stats and disclaimer).
    card.innerHTML = `
      <div class="ds-headline">
        <span class="ds-icon">${icon}</span>
        <span class="ds-condition">${escapeHtml(cond)}</span>
      </div>
      <div class="ds-temps">
        <span class="ds-low ${loClass}">${lo}</span>
        <span class="ds-sep">/</span>
        <span class="ds-high ${hiClass}">${hi}</span>
      </div>
      <div class="ds-stats">
        <div class="ds-stat"><span class="ds-stat-label">${rainLabel}</span><span class="ds-stat-value">${rainPct}</span></div>
        <div class="ds-stat"><span class="ds-stat-label">${uvLabel}</span><span class="ds-stat-value ${uvClass}">${uvVal}</span></div>
        <div class="ds-stat"><span class="ds-stat-label">${sunriseLabel}</span><span class="ds-stat-value">${sunrise}</span></div>
        <div class="ds-stat"><span class="ds-stat-label">${sunsetLabel}</span><span class="ds-stat-value">${sunset}</span></div>
      </div>
    `;
    container.appendChild(card);
    container.appendChild(buildAdSlot('day-detail'));
    const disclaimerEl = document.createElement('div');
    disclaimerEl.className = 'ds-disclaimer';
    disclaimerEl.textContent = disclaimer;
    container.appendChild(disclaimerEl);
  }
  function applySettings() {
    if (unitsTempSelect) unitsTempSelect.value = settings.temp;
    if (unitsWindSelect) unitsWindSelect.value = settings.wind;
    if (unitsPrecipSelect) unitsPrecipSelect.value = settings.precip;
    if (timeFormatSelect) timeFormatSelect.value = settings.time;
    if (languageSelect) languageSelect.value = settings.lang;
    updateUILanguage();
    updateLanguageOptions();
    document.documentElement.lang = settings.lang;
    if (lastPayload) { const norm = normalizePayload(lastPayload); window.__PW_LAST_NORM = norm; renderHome(norm); renderHourly(norm.hourly); renderWeek(norm.daily, norm.hourly); }
    renderFavorites(); renderRecents();
  }
  async function loadAndRender(place) {
    const thisSeq = ++activeLocationSeq;
    activeWeatherController?.abort();
    const requestController = new AbortController();
    activeWeatherController = requestController;
    activePlace = place; renderLoading(place.name || 'My Location');
    refreshSaveButtonState();
    // Kick the network fetch FIRST and let it run while IndexedDB opens —
    // the old `await getCachedWeather()` before fetch serialized a cold IDB
    // open (100-500ms on first launch) in front of the network round-trip.
    const fetchPromise = fetchProbable(place, { signal: requestController.signal });
    fetchPromise.catch(() => {}); // handled at the await below; never unhandled
    // M-5: the active language's copy bank MUST be merged before any content
    // render, or a non-English first paint flashes English seed strings. Kicked
    // here (and at bootstrap) so it loads in parallel with the IDB open below;
    // awaited before the cached/fresh render. Resolves instantly once loaded, so
    // it adds no paint delay beyond the splash floor in the common case.
    const bankReady = loadCopyBank(settings.lang).catch(() => {});
    // 1. Try showing cached data instantly (now in parallel with the fetch)
    const cached = await getCachedWeather(place);
    if (thisSeq !== activeLocationSeq) return;
    await bankReady;
    if (cached) {
      try {
        lastPayload = cached.payload;
        const norm = normalizePayload(cached.payload);
        window.__PW_LAST_NORM = norm;
        renderHome(norm); renderHourly(norm.hourly); renderWeek(norm.daily, norm.hourly);
        showCacheAge(cached.timestamp);
      } catch { /* stale cache, ignore */ }
    }
    // 2. Await the network fetch that was started above
    try {
      const payload = await fetchPromise;
      if (thisSeq !== activeLocationSeq) return;
      lastPayload = payload;
      const norm = normalizePayload(payload);
      window.__PW_LAST_NORM = norm;
      renderHome(norm); renderHourly(norm.hourly); renderWeek(norm.daily, norm.hourly);
      hideCacheAge();
      setCachedWeather(place, payload);
    } catch (e) {
      if (thisSeq !== activeLocationSeq || (e?.name === 'AbortError' && !e.weatherTimeout)) return;
      console.error("Load failed:", e);
      if (!cached) renderError(t('misc', 'couldntFetch'));
      // If cached data was shown, user still sees stale but usable data
    } finally {
      if (activeWeatherController === requestController) activeWeatherController = null;
    }
  }

  // ========== FAVORITES & RECENTS ==========
  const loadFavorites = () => normalizeStoredPlaces(loadJSON(STORAGE.favorites, []));
  const loadRecents = () => normalizeStoredPlaces(loadJSON(STORAGE.recents, []));
  const saveFavorites = (list) => saveJSON(STORAGE.favorites, list);
  const saveRecents = (list) => saveJSON(STORAGE.recents, list);
  function clearRecents() { localStorage.removeItem(STORAGE.recents); renderRecents(); }
  async function addFavorite(place) {
    let list = loadFavorites();
    if (list.some(p => samePlace(p, place))) { showToast(t('toasts', 'alreadySaved')); return; }
    if (list.length >= 5) { showToast(t('toasts', 'maxPlaces')); return; }
    const rn = await resolvePlaceName(place); list.unshift({ ...place, name: rn }); saveFavorites(list.slice(0, 5)); renderFavorites(); showToast(t('toasts', 'saved'));
  }
  async function addRecentIfNew(place) {
    const favs = loadFavorites(); if (favs.some(p => samePlace(p, place))) return;
    const existing = loadRecents(); if (existing.some(p => samePlace(p, place))) return;
    const rn = await resolvePlaceName(place); saveRecents([{ ...place, name: rn }, ...existing.filter(p => !samePlace(p, { ...place, name: rn }))].slice(0, 20)); renderRecents();
  }
  async function toggleFavorite(place) {
    let list = loadFavorites();
    if (list.some(p => samePlace(p, place))) { list = list.filter(p => !samePlace(p, place)); saveFavorites(list); renderFavorites(); refreshSaveButtonState(); showToast(t('toasts', 'removed')); return; }
    await addFavorite(place);
    refreshSaveButtonState();
  }
  async function ensureFavoriteMeta(place) {
    if (!place || !isNum(place.lat) || !isNum(place.lon) || (isNum(place.tempC) && place.conditionKey)) return;
    const key = favoriteKey(place); if (pendingFavMeta.has(key)) return; pendingFavMeta.add(key);
    try { const norm = normalizePayload(await fetchProbable(place)); const list = loadFavorites(); const idx = list.findIndex(p => samePlace(p, place)); if (idx !== -1) { list[idx] = { ...list[idx], tempC: norm.nowTemp ?? null, conditionKey: norm.conditionKey ?? null }; saveFavorites(list); renderFavorites(); } } catch {} finally { pendingFavMeta.delete(key); }
  }
  function renderRecents() {
    if (!recentList) return; const list = loadRecents();
    const logoMini = `<svg class="recent-logo" viewBox="0 0 40 40" width="18" height="18"><circle cx="20" cy="20" r="18" fill="url(#logoGrad)"/><text x="12" y="28" font-family="Poppins,sans-serif" font-size="22" font-weight="800" fill="#fff">P</text><defs><linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFDD44"/><stop offset="100%" stop-color="#FFAA00"/></linearGradient></defs></svg>`;
    recentList.innerHTML = list.map(p => {
      const rb = searchEditMode ? `<button class="remove-recent" aria-label="Remove recent" data-lat="${p.lat}" data-lon="${p.lon}">×</button>` : '';
      return `<li class="recent-item" role="button" tabindex="0" data-lat="${p.lat}" data-lon="${p.lon}" data-name="${escapeHtml(p.name)}">${logoMini}<span class="recent-name">${escapeHtml(p.name)}</span>${rb}</li>`;
    }).join('') || `<li style="opacity:0.6;cursor:default;">${t('search', 'noRecent')}</li>`;
    recentList.querySelectorAll('li[data-lat]').forEach(li => {
      const activate = (ev) => { if (ev?.target?.closest('.remove-recent')) return; showScreen(screenHome); loadAndRender({ name: li.dataset.name, lat: parseFloat(li.dataset.lat), lon: parseFloat(li.dataset.lon), mode: PLACE_MODE_PINNED }); };
      li.addEventListener('click', activate);
      li.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); activate(ev); } });
    });
    recentList.querySelectorAll('.remove-recent').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const list = loadRecents().filter(p => !samePlace(p, { lat: parseFloat(btn.dataset.lat), lon: parseFloat(btn.dataset.lon) }));
        saveRecents(list);
        renderRecents();
        showToast(t('toasts', 'removed'));
      });
    });
  }
  function renderFavorites() {
    if (!favoritesList) return; const list = loadFavorites();
    const fl = document.getElementById('favLimit'); if (fl) fl.style.display = list.length >= 5 ? 'block' : 'none';
    favoritesList.innerHTML = list.map(p => {
      const temp = isNum(p.tempC) ? formatTemp(p.tempC) : '--°';
      const rb = searchEditMode ? `<button class="remove-fav" aria-label="Remove favourite" data-lat="${p.lat}" data-lon="${p.lon}">×</button>` : '';
      return `<li class="favorite-item" data-lat="${p.lat}" data-lon="${p.lon}" data-name="${escapeHtml(p.name)}"><span class="fav-name" role="button" tabindex="0">${escapeHtml(p.name)}</span><span class="fav-temp">${temp}</span>${rb}</li>`;
    }).join('') || `<li style="opacity:0.6;cursor:default;">${t('search', 'noSaved')}</li>`;
    favoritesList.querySelectorAll('li[data-lat] .fav-name').forEach(span => {
      const activate = () => { const li = span.closest('li'); showScreen(screenHome); loadAndRender({ name: li.dataset.name, lat: parseFloat(li.dataset.lat), lon: parseFloat(li.dataset.lon), mode: PLACE_MODE_PINNED }); };
      span.addEventListener('click', activate);
      span.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); activate(); } });
    });
    favoritesList.querySelectorAll('.remove-fav').forEach(btn => { btn.addEventListener('click', (e) => { e.stopPropagation(); let list = loadFavorites(); list = list.filter(p => !samePlace(p, { lat: parseFloat(btn.dataset.lat), lon: parseFloat(btn.dataset.lon) })); saveFavorites(list); renderFavorites(); showToast(t('toasts', 'removed')); }); });
    list.forEach(p => ensureFavoriteMeta(p));
  }

  // ========== SEARCH ==========
  let searchTimeout = null, searchResults = [], activeSearchController = null, searchSeq = 0;
  const searchMiniCache = new Map();
  async function runSearch(query) {
    if (!query || query.length < 2) { renderSearchResults([]); return; }
    const thisSeq = ++searchSeq; if (activeSearchController) activeSearchController.abort(); activeSearchController = new AbortController();
    try {
      // Server-side LocationIQ proxy — token stays off the client, results are ZA-biased.
      const resp = await fetch(`/api/geocode?type=search&q=${encodeURIComponent(query)}`, { signal: activeSearchController.signal });
      if (thisSeq !== searchSeq || !resp.ok) return;
      const data = await resp.json();
      const mapped = (Array.isArray(data?.results) ? data.results : [])
        .map(r => ({
          name: r.name || r.display_name?.split(',')[0] || 'Unknown',
          fullName: r.display_name,
          lat: Number(r.lat),
          lon: Number(r.lon),
          address: r.address,
        }))
        .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lon));
      // De-duplicate: drop a result if an earlier one renders an identical label
      // AND sits within ~1km of it — the "Bryn Mawr triplication" bug, where three
      // OSM objects sharing one container collapsed into three identical rows.
      searchResults = mapped.filter((r, i) => !mapped.slice(0, i).some(prev =>
        formatSearchResult(prev) === formatSearchResult(r) &&
        haversineKm(prev, r) <= 1
      ));
      renderSearchResults(searchResults);
    } catch (e) { if (e.name !== 'AbortError') console.error('Search error:', e); }
  }
  // Lead with the feature's OWN name (r.name = the actual searched place) so
  // "Bryn Mawr" shows as itself, not its container "Lower Merion Township".
  function formatSearchResult(r) { const a = r.address || {}; const city = r.name || a.town || a.village || a.city || 'Unknown'; return a.country ? `${city}, ${a.country}` : city; }
  async function miniFetchTemp(lat, lon) { const key = `${lat.toFixed(2)},${lon.toFixed(2)}`; if (searchMiniCache.has(key)) return searchMiniCache.get(key); try { const norm = normalizePayload(await fetchProbable({ lat, lon, name: '' })); const r = { temp: formatTemp(norm.nowTemp), icon: conditionEmoji(norm.conditionKey) }; if (searchMiniCache.size >= 120) searchMiniCache.delete(searchMiniCache.keys().next().value); searchMiniCache.set(key, r); return r; } catch { return { temp: '--°', icon: '⛅' }; } }
  function renderSearchResults(results) {
    const rl = document.getElementById('searchResults') || (() => { const ul = document.createElement('ul'); ul.id = 'searchResults'; ul.className = 'search-results'; document.querySelector('.search-body')?.prepend(ul); return ul; })();
    if (!results.length) { rl.innerHTML = ''; return; }
    const favs = loadFavorites();
    rl.innerHTML = results.map(r => { const fn = escapeHtml(formatSearchResult(r)), isFav = favs.some(p => samePlace(p, { lat: parseFloat(r.lat), lon: parseFloat(r.lon) })); return `<li class="search-result-item" role="button" tabindex="0" data-lat="${r.lat}" data-lon="${r.lon}" data-name="${fn}"><button class="fav-star${isFav ? ' is-fav' : ''}" aria-label="Toggle favourite" data-lat="${r.lat}" data-lon="${r.lon}">${isFav ? '★' : '☆'}</button><span class="result-icon" aria-hidden="true">⛅</span><span class="result-name">${fn}</span><span class="result-temp">--°</span></li>`; }).join('');
    rl.querySelectorAll('li[data-lat]').forEach(li => {
      const activate = async (e) => { if (e && e.target && e.target.closest('.fav-star')) return; const place = { name: li.dataset.name, lat: parseFloat(li.dataset.lat), lon: parseFloat(li.dataset.lon), mode: PLACE_MODE_PINNED }; showScreen(screenHome); loadAndRender(place); if (searchInput) searchInput.value = ''; rl.innerHTML = ''; addRecentIfNew(place).catch(() => {}); };
      li.addEventListener('click', activate);
      li.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); activate(ev); } });
    });
    rl.querySelectorAll('.fav-star').forEach(btn => { btn.addEventListener('click', async (e) => { e.stopPropagation(); await toggleFavorite({ name: btn.closest('li')?.dataset?.name, lat: parseFloat(btn.dataset.lat), lon: parseFloat(btn.dataset.lon) }); renderSearchResults(results); }); });
    rl.querySelectorAll('li[data-lat]').forEach(async (li) => { const mini = await miniFetchTemp(parseFloat(li.dataset.lat), parseFloat(li.dataset.lon)); const ie = li.querySelector('.result-icon'), te = li.querySelector('.result-temp'); if (ie) ie.textContent = mini.icon || '⛅'; if (te) te.textContent = mini.temp || '--°'; });
  }
  if (searchInput) searchInput.addEventListener('input', (e) => { clearTimeout(searchTimeout); searchTimeout = setTimeout(() => runSearch(e.target.value), 300); });

  // ========== NAV & EVENTS ==========
  navHome?.addEventListener('click', () => { showScreen(screenHome); });
  navWeek?.addEventListener('click', () => showScreen(screenWeek));
  $('#dayDetailBack')?.addEventListener('click', () => showScreen(screenWeek));
  navSearch?.addEventListener('click', () => { showScreen(screenSearch); renderRecents(); renderFavorites(); });
  navSettings?.addEventListener('click', () => showScreen(screenSettings));
  navSources?.addEventListener('click', () => {
    // Re-render so the source list reflects the most recent payload.
    if (window.__PW_LAST_NORM) renderSourcesScreen(window.__PW_LAST_NORM);
    showScreen(screenSources);
  });
  // Home-screen Hourly pill — opens the Hourly screen + resets scroll to top
  // (matches the bottom-nav screen-overlay behaviour, which always shows the
  // top of the panel on open).
  const openHourly = () => {
    showScreen(screenHourly);
    const body = screenHourly?.querySelector('.screen-panel-body');
    if (body) body.scrollTop = 0;
  };
  navHourlyHome?.addEventListener('click', openHourly);
  hourlyBack?.addEventListener('click', () => showScreen(screenHome));
  
  // Build a display name from reverse geocode data. Returns NULL when the
  // payload has no usable fields — callers fall back to their previous name
  // or the 'My Location' placeholder. The old behaviour returned a coords
  // string ("34.1°S, 18.8°E") here, which then got PERSISTED to STORAGE.home
  // by the GPS paths and could never self-heal: a coords name is not a
  // placeholder (no client re-geocode) and the API used to echo it back
  // (no server resolution). Placeholders, by contrast, heal on the next
  // weather call now that api/weather.js resolves them server-side.
  function buildLocationName(data) {
    if (!data || data.ok === false) return null;
    const city = data.city;
    const admin1 = data.admin1;
    if (city && admin1) return `${city}, ${admin1}`;
    return city || admin1 || null;
  }

  function isStandaloneMode() {
    return window.matchMedia?.('(display-mode: standalone)')?.matches || navigator.standalone === true;
  }

  function getGeolocationErrorMessage(err) {
    if (err?.code === 1) return isStandaloneMode() ? t('toasts', 'permissionDeniedStandalone') : t('toasts', 'permissionDeniedBrowser');
    if (err?.code === 2) return "Couldn't get location. Using approximate location instead.";
    if (err?.code === 3) return "Location lookup took too long. Using approximate location instead.";
    return "Couldn't get location. Using approximate location instead.";
  }

  function showGeolocationErrorToast(err) {
    showToast(getGeolocationErrorMessage(err), 5000);
  }

  function loadApproximateLocation() {
    return getIPLocation().then(place => {
      // Tagged 'gps' because it's auto-derived, not user-pinned. On next
      // launch/visibilitychange the auto-refresh path retries getCurrentPosition
      // in case the user has since granted GPS permission.
      homePlace = { ...place, mode: PLACE_MODE_GPS };
      saveJSON(STORAGE.home, homePlace);
      loadAndRender(homePlace);
    });
  }

  // Shared geolocation flow, now used from Search.
  async function getCurrentLocation() {
    showScreen(screenHome);
    const savedGpsLoc = loadJSON(STORAGE.location, null);
    if ("geolocation" in navigator) {
      renderLoading("Getting location…");
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = Math.round(pos.coords.latitude * 10000) / 10000, lon = Math.round(pos.coords.longitude * 10000) / 10000;
        // Bug 3: record the manual "Use my location" tap. The position watch
        // will not override this pick for MANUAL_OVERRIDE_GRACE_MS (30 min) —
        // the user's explicit choice wins over passive re-detection.
        manualLocationAt = Date.now();
        try {
          const rev = await fetch(`/api/weather?reverse=1&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
          // H2: a 429 (rate limiter) or 5xx here used to fall through .json()
          // into the catch and seed a coords-shaped name into STORAGE.home —
          // permanently, since coords names never healed. Throw early instead.
          if (!rev.ok) throw new Error(`reverse geocode HTTP ${rev.status}`);
          const data = await rev.json();
          const displayName = buildLocationName(data) || 'My Location';
          if (data?.ok !== false) saveJSON(STORAGE.location, { city: data?.city, admin1: data?.admin1, countryCode: data?.countryCode, lat, lon });
          saveJSON(STORAGE.lastGps, { lat, lon, ts: Date.now() });
          homePlace = { name: displayName, lat, lon, mode: PLACE_MODE_GPS };
          saveJSON(STORAGE.home, homePlace);
          loadAndRender(homePlace);
          showToast('📍 ' + (t('toasts', 'locationUpdated') || 'Location updated'));
        } catch {
          // API failed — try client-side reverse geocode. NEVER seed coords:
          // a null falls back to the 'My Location' placeholder, which the
          // weather call now heals server-side (api/weather.js placeholder
          // resolution + shouldPersistHomeName write-back).
          const fallbackName = await reverseGeocode(lat, lon);
          saveJSON(STORAGE.lastGps, { lat, lon, ts: Date.now() });
          homePlace = { name: fallbackName || 'My Location', lat, lon, mode: PLACE_MODE_GPS };
          saveJSON(STORAGE.home, homePlace);
          loadAndRender(homePlace);
        }
      }, (err) => {
        debugLog('Geolocation error:', err.code, err.message);
        showGeolocationErrorToast(err);
        if (savedGpsLoc?.lat && savedGpsLoc?.lon) {
          const savedName = savedGpsLoc.city && savedGpsLoc.admin1
            ? `${savedGpsLoc.city}, ${savedGpsLoc.admin1}`
            : (savedGpsLoc.city || savedGpsLoc.admin1 || 'South Africa');
          homePlace = { name: savedName, lat: savedGpsLoc.lat, lon: savedGpsLoc.lon, mode: PLACE_MODE_GPS };
          saveJSON(STORAGE.home, homePlace);
          loadAndRender(homePlace);
        } else {
          // GPS blocked, no saved location - use IP geolocation
          loadApproximateLocation();
        }
      }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
    } else {
      if (savedGpsLoc?.lat && savedGpsLoc?.lon) {
        const savedName = savedGpsLoc.city && savedGpsLoc.admin1
          ? `${savedGpsLoc.city}, ${savedGpsLoc.admin1}`
          : (savedGpsLoc.city || savedGpsLoc.admin1 || 'South Africa');
        homePlace = { name: savedName, lat: savedGpsLoc.lat, lon: savedGpsLoc.lon, mode: PLACE_MODE_GPS };
        saveJSON(STORAGE.home, homePlace);
        loadAndRender(homePlace);
        showToast('📍 ' + (t('toasts', 'usingSaved') || 'Using saved location'));
      } else {
        showToast("Couldn't get location. Using approximate location instead.", 5000);
        loadApproximateLocation();
      }
    }
  }
  
  unitsTempSelect?.addEventListener('change', () => { settings.temp = unitsTempSelect.value; saveSettings(); applySettings(); });
  unitsWindSelect?.addEventListener('change', () => { settings.wind = unitsWindSelect.value; saveSettings(); applySettings(); });
  unitsPrecipSelect?.addEventListener('change', () => { settings.precip = unitsPrecipSelect.value; saveSettings(); applySettings(); });
  timeFormatSelect?.addEventListener('change', () => { settings.time = timeFormatSelect.value; saveSettings(); applySettings(); });
  languageSelect?.addEventListener('change', () => { applyLanguageSelection(languageSelect.value); });
  languageBtn?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (languageMenu?.classList.contains('open')) closeLanguageMenu();
    else openLanguageMenu();
  });
  languageMenu?.querySelectorAll('.language-option').forEach((option) => {
    option.addEventListener('click', (ev) => {
      ev.stopPropagation();
      applyLanguageSelection(option.dataset.lang);
    });
  });
  languageMenu?.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); moveLanguageFocus(1); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); moveLanguageFocus(-1); }
    else if (ev.key === 'Enter') { ev.preventDefault(); applyLanguageSelection(document.activeElement?.dataset?.lang); }
    else if (ev.key === 'Escape') { ev.preventDefault(); closeLanguageMenu(); languageBtn?.focus(); }
  });
  document.addEventListener('click', (ev) => {
    if (!languageMenu?.classList.contains('open')) return;
    if (!ev.target.closest('.language-picker')) closeLanguageMenu();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && languageMenu?.classList.contains('open')) closeLanguageMenu();
  });
  saveCurrent?.addEventListener('click', () => { if (activePlace) toggleFavorite(activePlace); });
  useMyLocationBtn?.addEventListener('click', () => { getCurrentLocation(); });
  searchCancel?.addEventListener('click', () => { setSearchEditMode(false); showScreen(screenHome); if (searchInput) searchInput.value = ''; });
  searchEditToggle?.addEventListener('click', () => { searchEditMode = !searchEditMode; setSearchEditMode(searchEditMode); });
  clearRecentsBtn?.addEventListener('click', () => { clearRecents(); showToast(t('toasts', 'cleared')); });

  // ========== INIT ==========
  // FIX-4: Parse ?lang= URL parameter before loading settings
  // Shared links include ?lang=af so recipients see the sender's language
  const urlParams = new URLSearchParams(window.location.search);
  const urlLang = urlParams.get('lang');
  const sharedPlace = getSharedPlaceFromSearch(window.location.search);
  if (urlLang && SUPPORTED_LANGS.includes(urlLang)) {
    saveJSON(SETTINGS_KEYS.lang, urlLang);
    debugLog(`[FIX-4] Applied ?lang=${urlLang} from URL parameter`);
  }
  setupServiceWorkerUpdates();
  setupErrorReporting();
  setupVersionBanner();
  loadSettings();
  // Kick the per-language copy fetch immediately after the language is known.
  // Not awaited: rendering never blocks on copy (the COPY_BANK seed keeps the
  // getters safe), and in practice this ~30 KB same-origin file always beats
  // the weather fetch. When it lands, re-render so any seed strings update.
  loadCopyBank(settings.lang)
    .then((fresh) => { if (fresh) applySettings(); })
    .catch((e) => console.error('[copy] bank load failed:', e));
  applySettings(); renderRecents(); renderFavorites();
  // Lazy-load install.js (Group 6): 48 KB of install UX that most sessions
  // never exercise no longer sits in the boot module graph. The dynamic
  // import starts immediately (not idle-gated — the engagement gate inside
  // install.js is only 1.5s) but parses off the critical path. The visible
  // error boundary survives: silent throws from install.js caused multiple
  // unexplained iPhone regressions with no device console access.
  const surfaceInstallError = (installInitErr) => {
    try {
      const errBanner = document.createElement('div');
      errBanner.id = 'pwInstallErrorBanner';
      errBanner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999999;padding:8px;background:#cc0000;color:#fff;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;line-height:1.35;max-width:100%;word-break:break-all;white-space:pre-wrap;box-shadow:0 2px 8px rgba(0,0,0,0.5)';
      errBanner.textContent = 'INSTALL INIT ERROR\n' + installInitErr.name + ': ' + installInitErr.message + '\n' + (installInitErr.stack || '(no stack)');
      document.body.appendChild(errBanner);
    } catch (_) { /* if rendering the error banner itself fails, fall through silently */ }
    console.error('[install] init failed', installInitErr);
  };
  import('./install.js')
    .then((mod) => {
      try {
        installExperience = mod.initInstallExperience({ getLanguage: () => settings.lang || 'en', showToast });
      } catch (installInitErr) {
        surfaceInstallError(installInitErr);
      }
    })
    .catch((loadErr) => surfaceInstallError(loadErr));
  homePlace = loadJSON(STORAGE.home, null);
  // Migration: pre-Phase-B-3 homePlace records had no `mode` field. Default
  // legacy data to 'gps' since the previous code only set homePlace from
  // getCurrentPosition or IP fallback (never from search-tab pins).
  if (homePlace && !homePlace.mode) {
    homePlace.mode = PLACE_MODE_GPS;
    saveJSON(STORAGE.home, homePlace);
  }
  const savedLoc = loadJSON(STORAGE.location, null);
  if (sharedPlace) {
    // Shared links land the recipient on a specific place. Treat as pinned
    // so a recipient in a different city doesn't get GPS-overridden after
    // opening someone else's share.
    showScreen(screenHome);
    loadAndRender({ ...sharedPlace, mode: PLACE_MODE_PINNED });
  }
  else if (homePlace) { showScreen(screenHome); loadAndRender(homePlace); }
  else if (savedLoc?.lat && savedLoc?.lon) {
    const sn = savedLoc.city && savedLoc.admin1 ? `${savedLoc.city}, ${savedLoc.admin1}` : (savedLoc.city || savedLoc.admin1 || 'South Africa');
    homePlace = { name: sn, lat: savedLoc.lat, lon: savedLoc.lon, mode: PLACE_MODE_GPS }; saveJSON(STORAGE.home, homePlace); showScreen(screenHome); loadAndRender(homePlace);
  }
  else { showScreen(screenHome); renderLoading("Locating…");
    if ("geolocation" in navigator) {
      // First-open with no saved location. Previously this waited up to 8s on
      // getCurrentPosition before any IP fallback ran — a fresh install showed a
      // blank "Locating…" for the whole timeout. The coordinator now races GPS
      // against a ~1s grace timer: IP paints fast if GPS is slow, and a late GPS
      // fix upgrades to precise coords without clobbering a place the user chose
      // in the meantime. See assets/first-open-location.js.
      startFirstOpenLocation({
        getCurrentPosition: (onSuccess, onError) => navigator.geolocation.getCurrentPosition(
          (pos) => onSuccess(pos.coords), onError,
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
        ),
        gpsPlaceFromCoords: (coords) => {
          const lat = Math.round(coords.latitude * 10000) / 10000, lon = Math.round(coords.longitude * 10000) / 10000;
          saveJSON(STORAGE.lastGps, { lat, lon, ts: Date.now() });
          // Placeholder name so the weather paints immediately — renderHome
          // reverse-geocodes the real label in parallel and writes it back to
          // homePlace/STORAGE.home (same path shared links already use).
          return { name: 'My Location', lat, lon, mode: PLACE_MODE_GPS };
        },
        fetchIpPlace: async () => ({ ...(await getIPLocation()), mode: PLACE_MODE_GPS }),
        paint: (place) => loadAndRender(place),
        persistHome: (place) => { homePlace = place; saveJSON(STORAGE.home, homePlace); },
        getActivePlace: () => activePlace,
        onApproxToast: (err) => showGeolocationErrorToast(err),
      });
    } else {
      // No geolocation support - use IP geolocation
      showToast("Couldn't get location. Using approximate location instead.", 5000);
      loadApproximateLocation();
    }
  }

  // ========== AUTO-REFRESH ==========
  // Phase-B-3 refresh flow. Resolves the "drove from Strand to Paarl, app still
  // shows Strand" bug: the previous handler only re-fetched WEATHER for the
  // cached homePlace; it never asked GPS for a new fix. The new attemptRefresh
  // path re-detects location for GPS-mode places, re-fetches weather when data
  // is stale, and leaves pinned places alone.
  let lastFetchTime = Date.now();

  function attemptRefresh({ source }) {
    if (!activePlace) return;
    // Snapshot the place at request time. GPS / weather-fetch responses can
    // arrive seconds later, by which point the user may have tapped a saved
    // place or a search result. Without the snapshot the success callback
    // would apply results to whatever activePlace points to NOW — hijacking
    // the user's current view. Phase 2 Codex S4 deferred-bundle item.
    const placeAtRequestTime = activePlace;
    const isPinned = placeAtRequestTime.mode === PLACE_MODE_PINNED;
    const wantsFetch = shouldRefetchWeather({ lastFetchTime, source });

    if (isPinned) {
      // Pinned places: never override with GPS detection. Only re-fetch
      // weather if data is stale (or pull-to-refresh) AND the user is
      // still on this place.
      if (wantsFetch && activePlace === placeAtRequestTime) {
        loadAndRender(placeAtRequestTime);
        lastFetchTime = Date.now();
      }
      return;
    }

    // GPS mode: ask the device for a current fix.
    if (!('geolocation' in navigator)) {
      // Silent fallback — no GPS API. Just refresh weather if stale.
      if (wantsFetch && activePlace === placeAtRequestTime) {
        loadAndRender(placeAtRequestTime);
        lastFetchTime = Date.now();
      }
      return;
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const newLat = Math.round(pos.coords.latitude * 10000) / 10000;
      const newLon = Math.round(pos.coords.longitude * 10000) / 10000;
      const newGps = { lat: newLat, lon: newLon };
      saveJSON(STORAGE.lastGps, { lat: newLat, lon: newLon, ts: Date.now() });

      if (shouldUpdateLocation({ activePlace: placeAtRequestTime, newGps })) {
        debugLog(`[Refresh] GPS moved ${haversineKm({ lat: placeAtRequestTime.lat, lon: placeAtRequestTime.lon }, newGps).toFixed(1)}km from ${placeAtRequestTime.name} (${source}) — re-detecting`);
        // Reverse-geocode for a display name, then load fresh weather.
        // H2: failures are non-destructive — keep the previous display name
        // rather than ever writing a coords string into STORAGE.home.
        let displayName = placeAtRequestTime.name;
        try {
          const rev = await fetch(`/api/weather?reverse=1&lat=${encodeURIComponent(newLat)}&lon=${encodeURIComponent(newLon)}`);
          if (!rev.ok) throw new Error(`reverse geocode HTTP ${rev.status}`);
          const data = await rev.json();
          displayName = buildLocationName(data) || displayName;
          if (data?.ok !== false) saveJSON(STORAGE.location, { city: data?.city, admin1: data?.admin1, countryCode: data?.countryCode, lat: newLat, lon: newLon });
        } catch {
          try { displayName = (await reverseGeocode(newLat, newLon)) || displayName; } catch {}
        }
        const newPlace = { name: displayName, lat: newLat, lon: newLon, mode: PLACE_MODE_GPS };
        // Always update homePlace — that's a useful side effect even if the
        // user has navigated to a different view in the meantime.
        homePlace = newPlace;
        saveJSON(STORAGE.home, homePlace);
        // Only render + toast if the user is still on the same place. If
        // they switched views during the GPS wait, don't hijack their UI.
        if (activePlace === placeAtRequestTime) {
          loadAndRender(newPlace);
          lastFetchTime = Date.now();
          showToast('📍 ' + (t('toasts', 'locationUpdated') || 'Location updated'));
        }
      } else if (wantsFetch && activePlace === placeAtRequestTime) {
        loadAndRender(placeAtRequestTime);
        lastFetchTime = Date.now();
      }
    }, (err) => {
      // Silent fallback per spec: keep showing existing data, no UI crash,
      // no infinite spinner. Permission revoked / GPS lost mid-flight is
      // the common case here.
      debugLog('[Refresh] GPS failed (' + source + '):', err.code, err.message);
      if (wantsFetch && activePlace === placeAtRequestTime) {
        loadAndRender(placeAtRequestTime);
        lastFetchTime = Date.now();
      }
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  }

  // Background interval — keep data fresh while app is open in foreground.
  // Uses the same attemptRefresh path so the 15-min freshness guard and GPS
  // re-detection still apply uniformly.
  // Bug 3 (2026-05-24): dropped 30 min → 10 min. A 15-minute drive between
  // suburbs could finish between two 30-min ticks. At 10 min the interval is
  // the backstop for devices where watchPosition is throttled (battery-saver,
  // older Android). 10 min < the 15-min freshness guard, so a stationary tick
  // re-checks GPS but skips the weather re-fetch — exactly what we want.
  const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
  setInterval(() => {
    if (document.visibilityState === 'visible') attemptRefresh({ source: 'interval' });
  }, REFRESH_INTERVAL_MS);

  // Visibility return — single consolidated listener doing two jobs:
  //   1. Load-bearing trigger for the Strand→Paarl scenario (attemptRefresh)
  //   2. SW update poll so deploys reach the user on foreground (Phase 2 S3
  //      eliminates the soft race against the previously-separate listener
  //      inside setupServiceWorkerUpdates).
  // Order matters: attemptRefresh first so the regex test in
  // refresh-behaviour.test.js still matches (no `}` between the event name
  // and the call). swRegistration may still be null during the brief window
  // between register() and the .then() resolving — guard for that.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    attemptRefresh({ source: 'visibilitychange' });
    if (swRegistration) swRegistration.update().catch(() => {});
    // 3. /api/version probe so the "New version — tap to refresh" banner
    //    fires within ~1s when the user foregrounds the app after a deploy.
    //    Belt-and-braces against any SW propagation hiccup.
    if (versionCheckOnForeground) versionCheckOnForeground();
  });

  // Launch — after initial cached/fresh render has kicked off above, attempt
  // a refresh so GPS users get re-detection on cold start, not just on tab
  // resume. A short delay lets the initial fetch settle (so the freshness
  // guard sees lastFetchTime correctly).
  setTimeout(() => attemptRefresh({ source: 'launch' }), 500);

  // ========== BUG 3: CONTINUOUS POSITION WATCH ==========
  // attemptRefresh (interval / visibilitychange / launch / PTR) only samples
  // GPS at discrete moments — a user driving Strand→Somerset West with the app
  // open could cover the whole trip between two ticks. watchPosition() streams
  // position updates as the user actually moves, closing that gap.
  //
  // shouldAcceptWatchUpdate() (refresh-behaviour.js) is the pure decision gate:
  //   · 60s debounce        — GPS chatters; don't act on every micro-update
  //   · 30min manual grace  — a manual "Use my location" pick is not overridden
  //   · GPS-mode + >1.5km   — the shared shouldUpdateLocation distance test
  let lastWatchAcceptedAt = 0;   // debounce clock — last ACCEPTED watch update
  let positionWatchId = null;
  // manualLocationAt is assigned by getCurrentLocation() on a manual tap. It is
  // declared here (after that function's definition but before any runtime
  // call) so the watch and the manual handler share one timestamp.
  let manualLocationAt = 0;

  // Reverse-geocode a watched move and swap to the new place. Mirrors the
  // GPS-success path of attemptRefresh, but push-driven (no getCurrentPosition
  // round-trip) and with old-location cache eviction.
  async function applyWatchedMove(newGps) {
    const previousPlace = activePlace;
    saveJSON(STORAGE.lastGps, { lat: newGps.lat, lon: newGps.lon, ts: Date.now() });
    let displayName = previousPlace?.name || 'My Location';
    try {
      const rev = await fetch(`/api/weather?reverse=1&lat=${encodeURIComponent(newGps.lat)}&lon=${encodeURIComponent(newGps.lon)}`);
      // H2: non-OK responses (rate-limit 429, 5xx) must not crash through
      // .json() into a coords-name seed — keep the previous name instead.
      if (!rev.ok) throw new Error(`reverse geocode HTTP ${rev.status}`);
      const data = await rev.json();
      displayName = buildLocationName(data) || displayName;
      if (data?.ok !== false) saveJSON(STORAGE.location, { city: data?.city, admin1: data?.admin1, countryCode: data?.countryCode, lat: newGps.lat, lon: newGps.lon });
    } catch {
      try { displayName = (await reverseGeocode(newGps.lat, newGps.lon)) || displayName; } catch { /* keep previous name */ }
    }
    // Bug 3: evict the cached weather for the place we just left.
    if (previousPlace) evictWeatherCache(previousPlace);
    const newPlace = { name: displayName, lat: newGps.lat, lon: newGps.lon, mode: PLACE_MODE_GPS };
    homePlace = newPlace;
    saveJSON(STORAGE.home, homePlace);
    // Only swap the view if the user hasn't navigated elsewhere during the
    // reverse-geocode wait (same guard attemptRefresh uses).
    if (activePlace === previousPlace) {
      loadAndRender(newPlace);
      lastFetchTime = Date.now();
      showToast('📍 ' + (t('toasts', 'locationUpdated') || 'Location updated'));
    }
  }

  function onWatchedPosition(pos) {
    // Skip fixes too imprecise to trust against a 1.5km threshold. With
    // enableHighAccuracy:false the browser may return a cell/wifi fix whose
    // own accuracy radius is 1-3km — that fix cannot tell a real 1.5km move
    // from positioning noise, so acting on it would chatter the location.
    const acc = pos?.coords?.accuracy;
    if (typeof acc === 'number' && acc > 2000) {
      debugLog('[watchPosition] fix accuracy ~' + Math.round(acc) + 'm too low — ignoring');
      return;
    }
    const newGps = {
      lat: Math.round(pos.coords.latitude * 10000) / 10000,
      lon: Math.round(pos.coords.longitude * 10000) / 10000,
    };
    const accept = shouldAcceptWatchUpdate({
      now: Date.now(),
      lastAcceptedAt: lastWatchAcceptedAt,
      manualSetAt: manualLocationAt,
      activePlace,
      newGps,
    });
    if (!accept) return;
    lastWatchAcceptedAt = Date.now();
    debugLog('[watchPosition] movement accepted — re-detecting location');
    applyWatchedMove(newGps);
  }

  function setupPositionWatch() {
    if (!('geolocation' in navigator) || typeof navigator.geolocation.watchPosition !== 'function') return;
    try {
      positionWatchId = navigator.geolocation.watchPosition(
        onWatchedPosition,
        (err) => {
          // Permission denied / position unavailable. The 10-min attemptRefresh
          // interval (also GPS + 1.5km) stays as the backstop — no UI change.
          debugLog('[watchPosition] error', err?.code, err?.message);
        },
        { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 },
      );
    } catch (e) {
      debugLog('[watchPosition] setup failed', e);
    }
  }
  setupPositionWatch();

  // ========== PULL-TO-REFRESH (Home tab) ==========
  // Native pull-to-refresh isn't available in iOS PWA standalone mode (no
  // browser chrome to host it). Implement gesture-based PTR with touch
  // handlers. Constraints:
  //  - Home tab only. Other tabs left untouched.
  //  - Active only at scrollTop === 0 so it doesn't interfere with normal
  //    scrolling further down the page.
  //  - Edge-swipe-back (iOS) starts near startX < 30 — bail in that range.
  //  - Single-touch only — bail on multi-touch (pinch-zoom).
  setupPullToRefresh();

  function setupPullToRefresh() {
    const home = document.getElementById('home-screen');
    if (!home) return;

    // Build the affordance once and mount it on <body> as a viewport-anchored
    // overlay, NOT as a child of #home-screen. The original mounting-as-child
    // combined with `position: absolute` made the pill permanently visible
    // overlapping the header. The new contract is:
    //   - position: fixed; default opacity:0 + visibility:hidden + translated
    //     above the viewport. Pill is INVISIBLE and pointer-events:none at rest.
    //   - JS adds `.ptr-active` only when the user begins pulling down. This
    //     flips visibility:visible and lets the slide-down animation play.
    //   - JS writes a `--ptr-slide` CSS variable for the per-frame drag
    //     position. CSS uses it via translate(-50%, var(--ptr-slide)).
    //   - On release / snap-back, JS removes inline --ptr-slide (so CSS
    //     transitions the pill back above the viewport), then removes
    //     `.ptr-active` after the transition completes (so visibility
    //     returns to hidden and accessibility tree no longer sees it).
    let ptr = document.getElementById('ptrAffordance');
    if (!ptr) {
      ptr = document.createElement('div');
      ptr.id = 'ptrAffordance';
      ptr.className = 'ptr-affordance';
      ptr.setAttribute('aria-hidden', 'true');
      ptr.innerHTML = '<span class="ptr-spinner" aria-hidden="true"></span><span class="ptr-text"></span>';
      document.body.appendChild(ptr);
    }
    const textEl = ptr.querySelector('.ptr-text');

    // Default rest text — never visible, but populated so the first frame of
    // a pull doesn't show an empty pill.
    const setText = (state) => {
      const lang = settings.lang || 'en';
      const copy = PTR_COPY[state]?.[lang] || PTR_COPY[state]?.en || '';
      if (textEl) textEl.textContent = copy;
    };
    setText('pull');

    // SLIDE_HIDDEN_PX matches the CSS rest value. JS writes --ptr-slide
    // between SLIDE_HIDDEN_PX (fully offscreen) and SLIDE_VISIBLE_PX (just
    // below the safe-area inset) as the user pulls.
    const SLIDE_HIDDEN_PX = -160;
    const SLIDE_VISIBLE_PX = 0;
    const SCROLL_TOP_TOLERANCE = 2; // px of scroll jitter to ignore
    const HIDE_TRANSITION_MS = 250; // matches CSS transform/visibility timing

    let startY = 0, startX = 0, dragY = 0, dragging = false, activated = false, refreshing = false;
    let hideTimer = null;

    const showActive = () => {
      if (activated) return;
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      ptr.classList.add('ptr-active');
      // Belt-and-braces: set inline opacity/visibility directly. The CSS
      // .ptr-active rule has higher specificity and would normally win the
      // cascade — but headless browsers occasionally miscompute class-driven
      // overrides on dynamically-created elements, leaving the pill invisible
      // even when activated. Inline always wins. Removed on hide.
      ptr.style.setProperty('opacity', '1');
      ptr.style.setProperty('visibility', 'visible');
      activated = true;
    };
    const hideAfterTransition = () => {
      // Clear the inline slide so CSS transitions back to the hidden rest.
      ptr.style.removeProperty('--ptr-slide');
      ptr.classList.remove('ptr-armed', 'ptr-refreshing');
      setText('pull');
      // After the slide-up completes, drop .ptr-active so opacity/visibility
      // return to fully invisible. Belt-and-braces with a slight buffer.
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        ptr.classList.remove('ptr-active');
        ptr.style.removeProperty('opacity');
        ptr.style.removeProperty('visibility');
        activated = false;
        hideTimer = null;
      }, HIDE_TRANSITION_MS + 50);
    };

    const dragYToSlidePx = (drag) => {
      // Map dragY [0, PTR_THRESHOLD_PX] → slidePx [SLIDE_HIDDEN_PX, SLIDE_VISIBLE_PX].
      // Beyond the threshold the pill stays at fully-visible, matching the
      // sticky-armed state.
      const ratio = Math.min(drag / PTR_THRESHOLD_PX, 1);
      return SLIDE_HIDDEN_PX + (SLIDE_VISIBLE_PX - SLIDE_HIDDEN_PX) * ratio;
    };

    home.addEventListener('touchstart', (ev) => {
      if (refreshing) return;
      // Only the home screen is allowed to PTR; bail if user has navigated away.
      if (home.classList.contains('hidden')) return;
      if (ev.touches.length !== 1) return;
      if (window.scrollY > SCROLL_TOP_TOLERANCE) return;
      const t = ev.touches[0];
      // iOS edge-swipe-back: starts within ~20px of left edge. Don't capture it.
      if (t.clientX < 30) return;
      startY = t.clientY;
      startX = t.clientX;
      dragY = 0;
      dragging = true;
    }, { passive: true });

    home.addEventListener('touchmove', (ev) => {
      if (!dragging || refreshing) return;
      const t = ev.touches[0];
      const dy = t.clientY - startY;
      const dx = Math.abs(t.clientX - startX);
      // Horizontal drift dominant — user is swiping, not pulling. Bail without
      // ever showing the affordance.
      if (dx > Math.abs(dy)) { dragging = false; if (activated) hideAfterTransition(); return; }
      if (dy <= 0) {
        // User dragging up — reset the affordance state and let normal scroll
        // happen. If we'd already shown the pill from an earlier frame, hide it.
        dragY = 0;
        if (activated) hideAfterTransition();
        return;
      }
      // Pulling down — apply resistance, cap, and show the affordance.
      dragY = Math.min(dy * PTR_RESISTANCE, PTR_MAX_OVERSCROLL_PX);
      showActive();
      ptr.style.setProperty('--ptr-slide', `${dragYToSlidePx(dragY)}px`);
      const armed = dragY >= PTR_THRESHOLD_PX;
      ptr.classList.toggle('ptr-armed', armed);
      setText(armed ? 'release' : 'pull');
      // Only suppress iOS rubber-band bounce when we're actively pulling.
      // Don't suppress everywhere — that would break scrolling further down.
      if (ev.cancelable && dy > 5) ev.preventDefault();
    }, { passive: false });

    const finishDrag = () => {
      if (!dragging) return;
      const wasArmed = dragY >= PTR_THRESHOLD_PX;
      dragging = false;
      if (wasArmed) {
        // Hold the pill at fully-visible while the refresh fires, then
        // animate it back offscreen + hidden.
        refreshing = true;
        ptr.classList.add('ptr-refreshing');
        ptr.style.setProperty('--ptr-slide', `${SLIDE_VISIBLE_PX}px`);
        setText('refreshing');
        attemptRefresh({ source: 'pull-to-refresh' });
        setTimeout(() => {
          refreshing = false;
          hideAfterTransition();
        }, 1200);
      } else if (activated) {
        // User let go before reaching threshold — slide back without firing.
        hideAfterTransition();
      }
      dragY = 0;
    };
    home.addEventListener('touchend', finishDrag, { passive: true });
    home.addEventListener('touchcancel', finishDrag, { passive: true });
  }
});


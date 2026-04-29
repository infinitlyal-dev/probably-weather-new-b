import { getSharedPlaceFromSearch } from './startup-location.js';
import { LANGUAGE_OPTIONS, SUPPORTED_LANGS, resolveInitialLanguage } from './language-preferences.js';
import { WEATHER_COPY } from './weather-copy.js';
import { getWeatherBackgroundFallbackFolder, getWeatherBackgroundFolder } from './weather-visuals.js';
import { buildShareUrl } from './share-url.js';

document.addEventListener("DOMContentLoaded", () => {
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
  const navHourly = $('#navHourly');
  const navWeek = $('#navWeek');
  const navSearch = $('#navSearch');
  const navSettings = $('#navSettings');

  const screenHome = $('#home-screen');
  const screenHourly = $('#hourly-screen');
  const screenWeek = $('#week-screen');
  const screenDayDetail = $('#day-detail-screen');
  const screenSearch = $('#search-screen');
  const screenSettings = $('#settings-screen');

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
  const probRangeToggle = $('#probRange');
  const timeFormatSelect = $('#timeFormat');
  const languageSelect = $('#languageSelect');

  const loader = $('#loader');
  const toast = $('#toast');
  const capeWindBanner = $('#capeWindBanner');
  const capeWindText = $('#capeWindText');
  const capeWindDismiss = $('#capeWindDismiss');

  const STORAGE = { favorites: "pw_favorites", recents: "pw_recents", home: "pw_home", location: "pw_location" };
  const SCREENS = [screenHome, screenHourly, screenWeek, screenDayDetail, screenSearch, screenSettings];
  const THRESH = { RAIN_PCT: 40, WIND_KPH: 25, COLD_C: 16, HOT_C: 32 };

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
  function cacheKey(place) { return `${parseFloat(place.lat).toFixed(3)},${parseFloat(place.lon).toFixed(3)}`; }
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
      week: { en: "Week", af: "Week", zu: "Iviki", xh: "Iveki", st: "Beke" },
      search: { en: "Search", af: "Soek", zu: "Sesha", xh: "Khangela", st: "Batla" },
      settings: { en: "Settings", af: "Instellings", zu: "Izilungiselelo", xh: "Iisetingi", st: "Litlhophiso" }
    },
    // Screen titles
    screens: {
      hourly: { en: "Hourly", af: "Uurliks", zu: "Ngamahora", xh: "Ngeyure", st: "Ka hora" },
      week: { en: "7-Day", af: "7-Dae", zu: "Izinsuku-7", xh: "Intsuku-7", st: "Matsatsi-7" },
      search: { en: "Search", af: "Soek", zu: "Sesha", xh: "Khangela", st: "Batla" },
      settings: { en: "Settings", af: "Instellings", zu: "Izilungiselelo", xh: "Iisetingi", st: "Litlhophiso" }
    },
    // Search screen
    search: {
      placeholder: { en: "Search for a place", af: "Soek 'n plek", zu: "Sesha indawo", xh: "Khangela indawo", st: "Batla sebaka" },
      cancel: { en: "Cancel", af: "Kanselleer", zu: "Khansela", xh: "Rhoxisa", st: "Hlakola" },
      savedPlaces: { en: "Saved Places", af: "Gestoorde Plekke", zu: "Izindawo Ezigciniwe", xh: "Iindawo Ezigciniweyo", st: "Libaka tse Bolokiloeng" },
      recent: { en: "Recent", af: "Onlangs", zu: "Okwakamuva", xh: "Okutsha", st: "Tsa morao tjena" },
      noSaved: { en: "No saved places yet.", af: "Nog geen gestoorde plekke nie.", zu: "Azikho izindawo ezigciniwe.", xh: "Akukho ndawo igciniweyo.", st: "Ha ho libaka tse bolokiloeng." },
      noRecent: { en: "No recent searches yet.", af: "Nog geen onlangse soektogte nie.", zu: "Azikho ukusesha kwakamuva.", xh: "Akukho kukhangela kwakutsha.", st: "Ha ho ho batla ha morao tjena." },
      clearRecents: { en: "Clear recents", af: "Verwyder onlangs", zu: "Susa okamuva", xh: "Susa okutsha", st: "Hlakola tsa morao" },
      edit: { en: "Edit", af: "Wysig", zu: "Hlela", xh: "Hlela", st: "Fetola" },
      manage: { en: "Manage", af: "Bestuur", zu: "Phatha", xh: "Lawula", st: "Tsamaisa" },
      done: { en: "Done", af: "Klaar", zu: "Kwenziwe", xh: "Kwenziwe", st: "Ho phethiloe" }
    },
    // Settings screen
    settings: {
      units: { en: "Units", af: "Eenhede", zu: "Iziyunithi", xh: "Iiyunithi", st: "Diyuniti" },
      temperature: { en: "Temperature", af: "Temperatuur", zu: "Izinga lokushisa", xh: "Ubushushu", st: "Mocheso" },
      windSpeed: { en: "Wind speed", af: "Windspoed", zu: "Isivinini somoya", xh: "Isantya somoya", st: "Lebelo la moea" },
      display: { en: "Display", af: "Vertoon", zu: "Ukubonisa", xh: "Ukubonisa", st: "Bonts'a" },
      showRange: { en: "Show temperature range", af: "Wys temperatuurreeks", zu: "Bonisa ibanga lokushisa", xh: "Bonisa uluhlu lobushushu", st: "Bonts'a sekhahla sa mocheso" },
      timeFormat: { en: "Time format", af: "Tydformaat", zu: "Ifomethi yesikhathi", xh: "Ifomathi yexesha", st: "Sebopeho sa nako" },
      language: { en: "Language", af: "Taal", zu: "Ulimi", xh: "Ulwimi", st: "Puo" },
      wittyIn: { en: "Language", af: "Taal", zu: "Ulimi", xh: "Ulwimi", st: "Puo" },
      about: { en: "About", af: "Aangaande", zu: "Mayelana", xh: "Malunga", st: "Mabapi" },
      aboutText: {
        en: "Probably Weather combines forecasts from Open-Meteo, WeatherAPI.com, MET Norway & Pirate Weather to give you a more reliable prediction.",
        af: "Probably Weather kombineer voorspellings van Open-Meteo, WeatherAPI.com, MET Norway & Pirate Weather om jou 'n meer betroubare voorspelling te gee.",
        zu: "I-Probably Weather ihlanganisa izibikezelo ezivela ku-Open-Meteo, WeatherAPI.com, MET Norway & Pirate Weather ukukunikeza isibikezelo esithembekile.",
        xh: "I-Probably Weather idibanisa izithembiso ezivela ku-Open-Meteo, WeatherAPI.com, MET Norway & Pirate Weather ukukunika isithembiso esithembekileyo.",
        st: "Probably Weather e kopanya diponelopele tse tsoang ho Open-Meteo, WeatherAPI.com, MET Norway & Pirate Weather ho u fa ponelopele e tšepahalang."
      }
    },
    // Sidebar
    sidebar: {
      todaysHero: { en: "Right Now:", af: "Nou:", zu: "Manje:", xh: "Ngoku:", st: "Hona Joale:" },
      sources: { en: "Sources", af: "Bronne", zu: "Imithombo", xh: "Imithombo", st: "Mehlodi" }
    },
    // Weather byline terms
    weather: {
      probably: { en: "Probably", af: "Waarskynlik", zu: "Mhlawumbe", xh: "Mhlawumbi", st: "Mohlomong" },
      wind: { en: "Wind", af: "Wind", zu: "Umoya", xh: "Umoya", st: "Moea" },
      rain: { en: "Rain", af: "Reën", zu: "Imvula", xh: "Imvula", st: "Pula" },
      uv: { en: "UV", af: "UV", zu: "UV", xh: "UV", st: "UV" },
      feelsLike: { en: "Feels like", af: "Voel soos", zu: "Kuzwakala sengathi", xh: "Kuziva ngathi", st: "Ho utlwahala joalo ka" },
      later: { en: "Later ⏰", af: "Later ⏰", zu: "Kamuva ⏰", xh: "Kamva ⏰", st: "Hamorao ⏰" },
      none: { en: "None", af: "Geen", zu: "Lutho", xh: "Akukho", st: "Ha ho" },
      gusts: { en: "gusts", af: "windstote", zu: "amafindo", xh: "iimphuphuma", st: "lifofane" },
      unlikely: { en: "Unlikely", af: "Onwaarskynlik", zu: "Akunakwenzeka", xh: "Akunakwenzeka", st: "Ha ho kgonehe" },
      possible: { en: "Possible", af: "Moontlik", zu: "Kungenzeka", xh: "Kunokwenzeka", st: "Ho ka etsahala" },
      likely: { en: "Likely", af: "Waarskynlik", zu: "Kungenzeka", xh: "Kunokubakho", st: "Ho ka etsahala" },
      low: { en: "Low", af: "Laag", zu: "Phansi", xh: "Phantsi", st: "Tlase" },
      moderate: { en: "Moderate", af: "Matig", zu: "Okuphakathi", xh: "Phakathi", st: "Mahareng" },
      high: { en: "High", af: "Hoog", zu: "Phezulu", xh: "Phezulu", st: "Hodimo" },
      veryHigh: { en: "Very High", af: "Baie Hoog", zu: "Phezulu Kakhulu", xh: "Phezulu Kakhulu", st: "Hodimo Haholo" },
      // Table headers
      time: { en: "Time", af: "Tyd", zu: "Isikhathi", xh: "Ixesha", st: "Nako" },
      temp: { en: "Temp", af: "Temp", zu: "Temp", xh: "Temp", st: "Temp" },
      day: { en: "Day", af: "Dag", zu: "Usuku", xh: "Usuku", st: "Letsatsi" },
      sunrise: { en: "Sunrise", af: "Sonop", zu: "Ukuphuma kwelanga", xh: "Ukuphuma kwelanga", st: "Mafube" },
      sunset:  { en: "Sunset",  af: "Sononder", zu: "Ukushona kwelanga", xh: "Ukutshona kwelanga", st: "Letsatsi le likela" },
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
      rainy: { en: "Rainy", af: "Reënerig", zu: "Imvula", xh: "Imvula", st: "Pula" },
      showers: { en: "Showers", af: "Buie", zu: "Izihlambi", xh: "Iimvula", st: "Lipula" },
      rainLater: { en: "Rain later", af: "Reën later", zu: "Imvula kamuva", xh: "Imvula kamva", st: "Pula hamorao" },
      rainTonight: { en: "Rain tonight", af: "Reën vanaand", zu: "Imvula namhlanje", xh: "Imvula ngokuhlwa", st: "Pula bosiu" },
      rainMorning: { en: "Rain AM", af: "Reën oggend", zu: "Imvula ekuseni", xh: "Imvula kusasa", st: "Pula hoseng" },
      highUV: { en: "High UV", af: "Hoë UV", zu: "UV Ephezulu", xh: "UV Ephezulu", st: "UV e Phahameng" },
      hot: { en: "Hot", af: "Warm", zu: "Kushisa", xh: "Kushushu", st: "Ho tjhesa" },
      cold: { en: "Cold", af: "Koud", zu: "Kubanda", xh: "Kubanda", st: "Ho bata" },
      uvAlert: { en: "UV Alert", af: "UV Waarskuwing", zu: "Isexwayiso se-UV", xh: "Isilumkiso se-UV", st: "Temoso ea UV" }
    },
    // Hero labels
    heroLabels: WEATHER_COPY.heroLabels,
    // Day names (short)
    days: {
      sun: { en: "Sun", af: "Son", zu: "Son", xh: "Caw", st: "Sont" },
      mon: { en: "Mon", af: "Maa", zu: "Mso", xh: "Mvu", st: "Mant" },
      tue: { en: "Tue", af: "Din", zu: "Bil", xh: "Lwes", st: "Lab" },
      wed: { en: "Wed", af: "Woe", zu: "Tha", xh: "Tha", st: "Lar" },
      thu: { en: "Thu", af: "Don", zu: "Sin", xh: "Sin", st: "Labo" },
      fri: { en: "Fri", af: "Vry", zu: "Hla", xh: "Hlanu", st: "Laboh" },
      sat: { en: "Sat", af: "Sat", zu: "Mgq", xh: "Mgqi", st: "Moq" }
    },
    // Headlines
    headlines: WEATHER_COPY.headlines,
    // Witty lines
    witty: WEATHER_COPY.witty,
    // Cape Doctor wind alert
    capeDr: {
      lines: {
        en: ["Ag no, the tablecloth is out 💨", "Cape Doctor is doing rounds today", "Hold onto your hat, the Southeaster means business", "The Southeaster arrived uninvited — as always", "Wind's hectic — even the seagulls are walking"],
        af: ["Ag nee, die tafeldoek is uit 💨", "Die Kaapse Dokter maak vandag huisbesoeke", "Hou jou hoed vas, die Suidooster bedoel sake", "Die Suidooster het ongenooid opgedaag — soos altyd", "Die wind is hectic — selfs die meeuë loop"],
        zu: ["Yoh, ilaphu letafel liphumile 💨", "UDokotela waseKapa uyashayela namuhla", "Bamba isigqoko sakho, iSoutheaster iyasebenza", "Umoya waseNingizimu ufikile ungamenyiwe — njengenjwayelo", "Umoya unamandla — ngisho nezinkonjane ziyahamba"],
        xh: ["Yhuu, ilaphu letafile liphumile 💨", "UGqirha waseKapa wenza iindwendwe namhlanje", "Bamba umnqwazi, iSoutheaster iyasebenza", "Umoya waseMzantsi ufikile ungamenywanga — njengoko eqhelile", "Umoya unamandla — neenkonjane ziyahamba"],
        st: ["Eish, lesela la tafoleng le teng 💨", "Ngaka ea Cape e etsa litšeliso kajeno", "Tšoara katiba ea hao, Southeaster e bolela ka nnete", "Moea oa boroa o fihlile o sa mengoa — joalo ka kamehla", "Moea o matla — esita le dikoekoe di tsamaea"]
      }
    },
    // Toasts
    toasts: {
      saved: { en: "Saved!", af: "Gestoor!", zu: "Kugciniwe!", xh: "Igciniwe!", st: "E bolokiloe!" },
      removed: { en: "Removed", af: "Verwyder", zu: "Isusiwe", xh: "Isusiwe", st: "E tlositsoe" },
      maxPlaces: { en: "Max 5 places. Remove one first.", af: "Maks 5 plekke. Verwyder een eers.", zu: "Izindawo ezi-5 kuphela. Susa eyodwa kuqala.", xh: "Iindawo ezi-5 kuphela. Susa enye kuqala.", st: "Libaka tse 5 feela. Tlosa e le 'ngoe pele." },
      alreadySaved: { en: "Already saved!", af: "Reeds gestoor!", zu: "Seyigciniwe!", xh: "Sele igciniwe!", st: "E se e bolokiloe!" },
      cleared: { en: "Cleared", af: "Skoongemaak", zu: "Kususiwe", xh: "Kucociwe", st: "E hlakiloe" },
      noPlaces: { en: "No saved places", af: "Geen gestoorde plekke", zu: "Azikho izindawo", xh: "Akukho ndawo", st: "Ha ho libaka" },
      locationUpdated: { en: "Location updated", af: "Ligging opgedateer", zu: "Indawo ibuyekeziwe", xh: "Indawo ihlaziyiwe", st: "Sebaka se ntjhafaditsoe" },
      locationError: { en: "Could not get location", af: "Kon nie ligging kry nie", zu: "Ayikwazanga ukuthola indawo", xh: "Ayikwazanga ukufumana indawo", st: "Ha e khone ho fumana sebaka" },
      usingSaved: { en: "Using saved location", af: "Gebruik gestoorde ligging", zu: "Isebenzisa indawo egciniwe", xh: "Isebenzisa indawo egciniweyo", st: "E sebedisa sebaka se bolokiloeng" }
    },
    // Misc
    misc: {
      loading: { en: "Loading…", af: "Laai…", zu: "Iyalayisha…", xh: "Iyalayisha…", st: "E a jarolla…" },
      error: { en: "Error", af: "Fout", zu: "Iphutha", xh: "Impazamo", st: "Phoso" },
      couldntFetch: { en: "Couldn't fetch weather right now.", af: "Kon nie weer kry nie.", zu: "Ayikwazanga ukuthola isimo sezulu.", xh: "Ayikwazanga ukufumana imozulu.", st: "Ha e khone ho fumana boemo ba leholimo." },
      share: { en: "Share", af: "Deel", zu: "Yabelana", xh: "Yabelana", st: "Arolelana" },
      shareIn: { en: "in", af: "in", zu: "e-", xh: "e-", st: "ho" }
    }
  };

  // Helper to get translation
  const t = (category, key) => {
    const lang = settings.lang || 'en';
    return T[category]?.[key]?.[lang] || T[category]?.[key]?.en || key;
  };

  // ========== STATE ==========
  let activePlace = null, homePlace = null, lastPayload = null, searchEditMode = false;
  window.__PW_LAST_NORM = null;
  const pendingFavMeta = new Set();
  const SETTINGS_KEYS = { temp: 'units.temp', wind: 'units.wind', range: 'display.range', time: 'format.time', lang: 'lang' };
  const DEFAULT_SETTINGS = { temp: 'C', wind: 'kmh', range: false, time: '24', lang: 'en' };
  let settings = { ...DEFAULT_SETTINGS };

  // ========== UTILITIES ==========
  const safeText = (el, txt) => { if (el) el.textContent = txt ?? "--"; };
  const isNum = (v) => typeof v === "number" && Number.isFinite(v);
  const round0 = (n) => isNum(n) ? Math.round(n) : null;
  const loadJSON = (key, fb) => { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fb; } catch { return fb; } };
  const saveJSON = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };
  const samePlace = (a, b) => a && b && Number(a.lat).toFixed(4) === Number(b.lat).toFixed(4) && Number(a.lon).toFixed(4) === Number(b.lon).toFixed(4);
  const favoriteKey = (p) => `${Number(p.lat).toFixed(4)},${Number(p.lon).toFixed(4)}`;
  const isPlaceholderName = (name) => { const v = String(name || '').trim(); return !v || /^unknown\b/i.test(v) || /^my location\b/i.test(v); };
  const escapeHtml = (s) => String(s ?? "").replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  const conditionEmoji = (key) => { const m = { storm: '⛈️', rain: '🌧️', wind: '💨', cold: '❄️', heat: '🔥', fog: '🌫️', clear: '☀️' }; return m[String(key || '').toLowerCase()] || '⛅'; };

  // ========== IP GEOLOCATION FALLBACK ==========
  // Used when GPS is blocked (e.g. WhatsApp in-app browser)
  async function getIPLocation() {
    try {
      const resp = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) });
      if (!resp.ok) throw new Error('IP lookup failed');
      const data = await resp.json();
      if (data.latitude && data.longitude) {
        return {
          name: data.city && data.country_code ? `${data.city}, ${data.country_code}` : (data.city || 'My Location'),
          lat: Math.round(data.latitude * 10) / 10,
          lon: Math.round(data.longitude * 10) / 10
        };
      }
    } catch (e) { debugLog('IP geolocation failed:', e); }
    // Ultimate fallback - Johannesburg (most populated SA city)
    return { name: "Johannesburg, ZA", lat: -26.2, lon: 28.0 };
  }

  function loadSettings() {
    const storedLang = loadJSON(SETTINGS_KEYS.lang, null);
    const initialLang = resolveInitialLanguage({ stored: storedLang, navigatorLanguage: navigator.language, navigatorLanguages: navigator.languages });
    if (!storedLang) saveJSON(SETTINGS_KEYS.lang, initialLang);
    settings = { temp: loadJSON(SETTINGS_KEYS.temp, DEFAULT_SETTINGS.temp), wind: loadJSON(SETTINGS_KEYS.wind, DEFAULT_SETTINGS.wind), range: loadJSON(SETTINGS_KEYS.range, DEFAULT_SETTINGS.range), time: loadJSON(SETTINGS_KEYS.time, DEFAULT_SETTINGS.time), lang: initialLang };
  }
  function saveSettings() { saveJSON(SETTINGS_KEYS.temp, settings.temp); saveJSON(SETTINGS_KEYS.wind, settings.wind); saveJSON(SETTINGS_KEYS.range, settings.range); saveJSON(SETTINGS_KEYS.time, settings.time); saveJSON(SETTINGS_KEYS.lang, settings.lang); }
  const convertTemp = (c) => !isNum(c) ? null : settings.temp === 'F' ? (c * 9 / 5) + 32 : c;
  const formatTemp = (c) => { const v = convertTemp(c); return isNum(v) ? `${round0(v)}°` : '--°'; };
  const formatWind = (kph) => !isNum(kph) ? '--' : settings.wind === 'mph' ? `${round0(kph * 0.621371)} mph` : settings.wind === 'ms' ? `${round0(kph / 3.6)} m/s` : `${round0(kph)} km/h`;
  const getTempColorClass = (tempC) => {
    if (!isNum(tempC)) return '';
    if (tempC <= 0) return 'temp-freezing';
    if (tempC <= 10) return 'temp-cold';
    if (tempC >= 35) return 'temp-hot';
    if (tempC >= 28) return 'temp-warm';
    return '';
  };

  const NAV_MAP = [[screenHome, navHome], [screenHourly, navHourly], [screenWeek, navWeek], [screenSearch, navSearch], [screenSettings, navSettings]];
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
    const sidebar = document.querySelector('.sidebar'); if (sidebar) sidebar.style.display = which === screenHome ? '' : 'none';
  }
  const showLoader = (show) => { if (loader) loader.classList[show ? 'remove' : 'add']('hidden'); };
  function showToast(message, duration = 3000) { if (!toast) return; toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), duration); }
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
      indicator.textContent = 'Viewing shared location';
    } else if (indicator) {
      indicator.remove();
    }
  }

  // ========== UPDATE UI LANGUAGE ==========
  function updateUILanguage() {
    if (navHome) navHome.textContent = t('nav', 'home');
    if (navHourly) navHourly.textContent = t('nav', 'hourly');
    if (navWeek) navWeek.textContent = t('nav', 'week');
    if (navSearch) navSearch.textContent = t('nav', 'search');
    if (navSettings) navSettings.textContent = t('nav', 'settings');
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
    const displayH = screenSettings?.querySelectorAll('.settings-section h3')[1]; if (displayH) displayH.textContent = t('settings', 'display');
    const rangeLabel = probRangeToggle?.closest('.settings-option')?.querySelector('label'); if (rangeLabel) rangeLabel.textContent = t('settings', 'showRange');
    const timeLabel = timeFormatSelect?.closest('.settings-option')?.querySelector('label'); if (timeLabel) timeLabel.textContent = t('settings', 'timeFormat');
    const langH = screenSettings?.querySelectorAll('.settings-section h3')[2]; if (langH) langH.textContent = '';
    const langLabel = languageSelect?.closest('.settings-option')?.querySelector('label'); if (langLabel) langLabel.textContent = t('settings', 'language');
    const aboutH = screenSettings?.querySelectorAll('.settings-section h3')[3]; if (aboutH) aboutH.textContent = t('settings', 'about');
    const aboutP = screenSettings?.querySelector('.settings-section:last-of-type p'); if (aboutP) aboutP.textContent = T.settings.aboutText[settings.lang] || T.settings.aboutText.en;
    const sourcesLabel = document.querySelector('.sources-desktop .label'); if (sourcesLabel) sourcesLabel.textContent = t('sidebar', 'sources');
    const sourcesToggleLabel = document.querySelector('.sources-toggle-label'); if (sourcesToggleLabel) sourcesToggleLabel.textContent = `4 ${t('sidebar', 'sources').toLowerCase()}`;
    if (shareBtn) shareBtn.textContent = `↗ ${t('misc', 'share')}`;
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
    applySettings();
    closeLanguageMenu();
    languageBtn?.focus();
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
    if (isNum(dailyRain) && dailyRain >= 50) return 'rain';
    if (apiCondition === 'storm') return 'storm';
    if (apiCondition === 'cold') return 'cold';
    if (apiCondition === 'heat') return 'heat';
    if (isDay && apiCondition === 'uv' && !(isTrulyOvercast || isMostlyCloudy || isSignificantCloud)) return 'uv';
    if (isNum(dailyRain) && dailyRain >= 30) return 'rain';
    if (apiCondition === 'wind') return 'wind';
    if (isNum(effectiveWind) && effectiveWind >= 30) return 'wind';
    if (apiCondition === 'fog') return 'fog';
    if (apiCondition === 'cloudy') return 'cloudy';
    const hi = norm.todayHigh, low = norm.todayLow, uv = norm.uvDaily, feels = norm.feelsLike;
    if (isNum(feels) && feels <= -5) return 'cold';
    if (isNum(low) && low <= 0) return 'cold';
    if (isNum(hi) && hi >= THRESH.HOT_C) return 'heat';
    if (isDay && isNum(uv) && uv >= 8 && !(isTrulyOvercast || isMostlyCloudy || isSignificantCloud)) return 'uv';
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

    // FIX-001: Log condition decision for debugging
    const votes = norm.sourceConditions || [];
    debugLog(`[Condition] API=${apiCondition} rain=${imminentRain}% cloud=${cloud}% wind=${effectiveWind}kph`);
    if (votes.length) debugLog('[Source votes]', votes.map(s => `${s.source}:${s.vote}(${s.desc})`).join(', '));

    // FIX-001: Count source votes for majority check
    const rainVotes = votes.filter(v => v.vote === 'rain' || v.vote === 'storm').length;
    const cloudyVotes = votes.filter(v => v.vote === 'cloudy').length;
    const hasMajorityRain = rainVotes >= 2;
    const hasMajorityCloudy = (rainVotes + cloudyVotes) >= 2;

    if (apiCondition === 'storm') return 'storm';
    if (apiCondition === 'cold') return 'cold';
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
    if (isDay && apiCondition === 'uv' && !(isTrulyOvercast || isMostlyCloudy || isSignificantCloud)) return 'uv';
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
  function getHeadline(condition) { return T.headlines[condition]?.[settings.lang] || T.headlines[condition]?.en || "Clear skies."; }
  function getHeroLabel(condition) { return T.heroLabels[condition]?.[settings.lang] || T.heroLabels[condition]?.en || "Pleasant"; }
  // Lowercase substrings that mark a witty line as weekday-coded (commute / office /
  // Monday references). On Sat/Sun we filter these out of the pool so they don't fire
  // out of context. Match against the lowercased line — fragments stay lowercase here.
  // Sotho lines use straight ASCII apostrophes, not curly ones — match accordingly.
  const WEEKDAY_ONLY_FRAGMENTS = [
    // English commute / office / weekday markers
    'commute', 'traffic', 'office', 'taxi on the road', 'school run',
    'monday', 'past-you made plans', 'hair plans',
    'aircon war', 'aircon debate', 'garage pie for lunch',
    'joburg drivers', 'every taxi',
    // Afrikaans
    'die rit', 'die verkeer', 'kantoor', 'maandag',
    'joburg-bestuurders', 'elke taxi', 'haarplanne',
    'garage-pastei', 'aircon oorlog', 'aircon debat',
    // Zulu
    'ithrafikhi', 'ihhovisi', 'umsombuluko',
    'itekisi emgwaqweni', 'izinhlelo zezinwele',
    'i-aircon yasehhovisi',
    // Xhosa
    'itrafikhi', 'iofisi', 'umvulo',
    'itekisi endleleni', 'izicwangciso zeenwele',
    'i-aircon yaseofisini',
    // Sotho
    'sephethephethe', 'ofisi', 'mantaha',
    "tekisi e 'ngoe le e 'ngoe tseleng", 'merero ea moriri',
    'aircon ea ofisi'
  ];
  function getWittyLine(condition) {
    const day = getLocationDayOfWeek(), hour = getLocationHour(activePlace?.lon);
    const isWeekend = day === 0 || day === 6 || (day === 5 && hour >= 16);
    if (isWeekend && (condition === 'clear' || condition === 'heat')) {
      const wl = T.witty.weekend[settings.lang] || T.witty.weekend.en; return wl[Math.floor(Math.random() * wl.length)];
    }
    let lines = T.witty[condition]?.[settings.lang] || T.witty[condition]?.en || T.witty.clear.en;
    // On strict Sat/Sun, filter out weekday-coded jokes. Friday-after-16:00 already
    // routes to the weekend pool above for clear/heat, so it doesn't need filtering here.
    const isStrictWeekend = day === 0 || day === 6;
    if (isStrictWeekend) {
      const filtered = lines.filter(line => {
        const lower = line.toLowerCase();
        return !WEEKDAY_ONLY_FRAGMENTS.some(frag => lower.includes(frag));
      });
      // Safety: if the filter would leave fewer than 3 lines, keep the full pool —
      // better a slightly off line than the same line every refresh.
      if (filtered.length >= 3) {
        if (filtered.length < lines.length) {
          debugLog(`[Witty filter] ${condition}/${settings.lang}: ${lines.length}→${filtered.length} lines (weekend filter)`);
        }
        lines = filtered;
      } else {
        debugLog(`[Witty filter] ${condition}/${settings.lang}: filtered pool too small (${filtered.length}), using full pool`);
      }
    }
    return lines[Math.floor(Math.random() * lines.length)];
  }
  function getDayBadge(d, dayIndex, hourlyData) {
    const ck = (d.conditionKey || '').toLowerCase();
    if (ck === 'storm') return t('badges', 'rainy');
    if (ck === 'cold') return t('badges', 'cold');
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
  function setBackgroundFor(condition) {
    const base = 'assets/images/bg';
    const folder = getWeatherBackgroundFolder(condition);
    const fallbackFolder = getWeatherBackgroundFallbackFolder(condition);
    const timeOfDay = getTimeOfDay();
    const dayOfYear = getLocationDayOfYear();
    let imgFile;
    if (timeOfDay === 'day') {
      // 14-day cycle: day_1 through day_14
      // Sat always day_6 or day_13, Sun always day_7 or day_14
      const dayOfWeek = getLocationDayOfWeek(); // 0=Sun, 1=Mon...6=Sat
      const baseSlot = dayOfWeek === 0 ? 7 : dayOfWeek; // Mon=1...Sat=6, Sun=7
      const weekParity = Math.floor((dayOfYear - 1) / 7) % 2; // 0=week1, 1=week2
      const dayNum = baseSlot + (weekParity * 7); // 1-7 or 8-14
      imgFile = `day_${dayNum}`;
    } else {
      // Dawn/dusk/night: rotate through 3 options using day of year
      const slot = ((dayOfYear - 1) % 3) + 1; // 1, 2, or 3
      imgFile = `${timeOfDay}_${slot}`;
    }
    debugLog(`[Image picker] Condition: ${condition}, Folder: ${folder}, Day of year: ${dayOfYear}, Time: ${timeOfDay}, Image: ${imgFile}.jpg`);
    if (bgImg) {
      bgImg.src = `${base}/${folder}/${imgFile}.jpg`;
      bgImg.onerror = () => { bgImg.src = `${base}/${folder}/day.jpg`; bgImg.onerror = () => { bgImg.src = `${base}/${fallbackFolder}/day.jpg`; bgImg.onerror = () => { bgImg.src = `${base}/default.jpg`; }; }; };
    }
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
  // Cascading reverse geocode: zoom=16 for hamlet/suburb detail, smart fallback
  // Priority: village/town BEFORE city — so "Wilderness" wins over "George"
  async function reverseGeocode(lat, lon) {
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1`, { headers: { 'User-Agent': 'howzit@probablyweather.co.za' }, signal: AbortSignal.timeout(5000) });
      if (!resp.ok) return null;
      const data = await resp.json();
      const addr = data.address || {};
      const smallPlace = addr.village || addr.town;
      const suburb = addr.suburb || addr.neighbourhood;
      const city = addr.city || addr.municipality;
      const province = addr.state || addr.province || addr.region;
      const country = addr.country;
      if (smallPlace) return province ? `${smallPlace}, ${province}` : (country ? `${smallPlace}, ${country}` : smallPlace);
      if (suburb && city) return `${suburb}, ${city}`;
      if (suburb) return province ? `${suburb}, ${province}` : (country ? `${suburb}, ${country}` : suburb);
      if (city) return province ? `${city}, ${province}` : (country ? `${city}, ${country}` : city);
      if (province) return country ? `${province}, ${country}` : province;
      if (country) return country;
      return null;
    } catch { return null; }
  }
  async function resolvePlaceName(place) { if (!place || !isNum(place.lat) || !isNum(place.lon)) return place?.name || 'Unknown'; if (!isPlaceholderName(place.name)) return place.name; return await reverseGeocode(place.lat, place.lon) || place.name || 'Unknown'; }
  async function fetchProbable(place) { const url = `/api/weather?lat=${encodeURIComponent(place.lat)}&lon=${encodeURIComponent(place.lon)}&name=${encodeURIComponent(place.name || '')}`; const resp = await fetch(url); if (!resp.ok) throw new Error('API error'); return await resp.json(); }
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
      sourceConditions: meta.sourceConditions || [] // FIX-001: per-source condition votes
    };
  }

  // ========== CAPE DOCTOR WIND ALERT ==========
  let capeWindDismissed = false;
  function isWesternCape(place) {
    if (!place || !isNum(place.lat) || !isNum(place.lon)) return false;
    return place.lat >= -34.5 && place.lat <= -33.0 && place.lon >= 17.5 && place.lon <= 20.0;
  }
  function renderCapeWind(norm) {
    if (!capeWindBanner) return;
    const wind = norm.windKph;
    if (!capeWindDismissed && isWesternCape(activePlace) && isNum(wind) && wind >= 50) {
      const lines = T.capeDr.lines[settings.lang] || T.capeDr.lines.en;
      safeText(capeWindText, lines[Math.floor(Math.random() * lines.length)]);
      capeWindBanner.classList.remove('hidden');
    } else {
      capeWindBanner.classList.add('hidden');
    }
  }
  if (capeWindDismiss) capeWindDismiss.addEventListener('click', () => { capeWindDismissed = true; if (capeWindBanner) capeWindBanner.classList.add('hidden'); });

  // Sources tap-to-swap (mobile only — CSS hides toggle on desktop)
  const sourcesToggle = $('#sourcesToggle');
  const sidebarEl = document.querySelector('.sidebar');
  let sourcesTimer = null;
  if (sourcesToggle && sidebarEl) {
    sourcesToggle.addEventListener('click', () => {
      const opening = !sidebarEl.classList.contains('sources-open');
      if (sourcesTimer) { clearTimeout(sourcesTimer); sourcesTimer = null; }
      if (opening) {
        sidebarEl.classList.add('sources-open');
        sourcesToggle.setAttribute('aria-expanded', 'true');
        sourcesTimer = setTimeout(() => { sidebarEl.classList.remove('sources-open'); sourcesToggle.setAttribute('aria-expanded', 'false'); sourcesTimer = null; }, 4000);
      } else {
        sidebarEl.classList.remove('sources-open');
        sourcesToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Share button (mobile only — Web Share API)
  const shareBtn = $('#shareBtn');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const norm = window.__PW_LAST_NORM;
      const hi = norm?.todayHigh, low = norm?.todayLow;
      const hiStr = isNum(hi) ? formatTemp(hi) : '--°';
      const loStr = isNum(low) ? formatTemp(low) : '--°';
      const loc = locationEl?.textContent || '';
      const displayCond = window.__PW_LAST_DISPLAY || 'clear';
      const emoji = conditionEmoji(displayCond);
      const heroLabel = getHeroLabel(displayCond);
      const text = `Waarskynlik ${loStr}/${hiStr} in ${loc} — ${heroLabel} ${emoji}`;
      const lat = activePlace?.lat, lon = activePlace?.lon;
      const lang = settings.lang || 'en';
      const url = buildShareUrl({ lat, lon, lang });
      try {
        if (navigator.share) {
          await navigator.share({ title: 'Probably Weather', text, url });
        } else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
          showToast('Share link copied');
        } else {
          window.prompt('Copy this share link', url);
        }
      } catch {}
    });
  }

  // ========== RENDER ==========
  function renderLoading(name) { showLoader(true); safeText(locationEl, name); safeText(headlineEl, t('misc', 'loading')); safeText(tempEl, '--°'); safeText(descriptionEl, '—'); }
  function renderError(msg) { showLoader(false); safeText(headlineEl, t('misc', 'error')); safeText(descriptionEl, msg || t('misc', 'couldntFetch')); }
  function renderSidebar(norm, heroOverride) {
    if (!norm && window.__PW_LAST_NORM) norm = window.__PW_LAST_NORM; if (!norm) return;
    const sr = norm.sourceRanges || [];
    const text = sr.length > 0 ? (sr.filter(s => isNum(s.minTemp) && isNum(s.maxTemp)).map(s => `${s.name}: ${round0(s.minTemp)}°-${round0(s.maxTemp)}°`).join('\n') || '--') : ({ strong: 'Strong', decent: 'Decent', mixed: 'Mixed' }[norm.confidenceKey] || 'Mixed');
    safeText($('#confidenceValue'), text);
    safeText($('#confidenceValueDesktop'), text);
    safeText($('#sourcesSwap'), text);
  }
  function renderHome(norm) {
    showLoader(false);
    const currentTemp = norm.nowTemp, rain = norm.rainPct, wind = norm.windKph, uv = norm.uv;
    const displayCondition = computeHomeDisplayCondition(norm), hero = computeTodaysHero(norm);
    // Body/CSS variant for partly-cloudy reuses the cloudy theme — no dedicated CSS yet.
    const cssVariant = displayCondition === 'partly-cloudy' ? 'cloudy' : displayCondition;
    document.body.classList.remove('weather-cold', 'weather-heat', 'weather-storm', 'weather-rain', 'weather-wind', 'weather-fog', 'weather-clear', 'weather-cloudy');
    document.body.classList.add(`weather-${cssVariant}`);
    let locationName = norm.locationName || activePlace?.name || 'South Africa'; safeText(locationEl, locationName);
    setSharedLocationIndicator(!!activePlace?.shared);
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
      // Show current temp below the range when toggle is on
      if (settings.range && isNum(currentTemp)) {
        hiLoEl.textContent = `${t('weather', 'feelsLike') || 'Now'} ${formatTemp(currentTemp)}`;
        hiLoEl.style.display = '';
      } else {
        hiLoEl.textContent = '';
        hiLoEl.style.display = 'none';
      }
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
  function getWeatherIcon(rp, cp, tc, isNight) {
    if (isNum(tc) && tc <= 0) return '❄️';
    if (isNum(rp) && rp >= 50) return '🌧️';
    if (isNum(rp) && rp >= 30) return '🌦️';
    if (isNum(tc) && tc >= 35) return '🔥';
    if (isNum(cp) && cp >= 70) return '☁️';
    if (isNum(cp) && cp >= 40) return '⛅';
    if (isNum(tc) && tc <= 10) return '❄️';
    // BUG-2 fix: show moon at night instead of sun for clear conditions
    return isNight ? '🌙' : '☀️';
  }
  function renderHourly(hourly) {
    if (!hourlyTimeline) return; hourlyTimeline.innerHTML = '';
    const nowHour = getLocationHour(activePlace?.lon);
    const currentWind = window.__PW_LAST_NORM?.windKph || null;
    const header = document.createElement('div');
    header.classList.add('hourly-row', 'hourly-header');
    header.innerHTML = `<span class="h-time">${t('weather', 'time') || 'Time'}</span><span class="h-icon"></span><span class="h-temp">${t('weather', 'temp') || 'Temp'}</span><span class="h-rain">${t('weather', 'rain') || 'Rain'}</span><span class="h-wind">${t('weather', 'wind') || 'Wind'}</span><span class="h-uv">${t('weather', 'uv') || 'UV'}</span>`;
    hourlyTimeline.appendChild(header);
    // Hourly array starts at midnight local time. Slice from current hour so
    // the data shown matches the time label. Show remaining hours of today + up to 24 total.
    const slicedHourly = hourly.slice(nowHour, nowHour + 24);
    slicedHourly.forEach((h, i) => {
      const div = document.createElement('div'); div.classList.add('hourly-row');
      const hourNum = (nowHour + i) % 24;
      const ht = settings.time === '12' ? `${hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum}${hourNum >= 12 ? 'pm' : 'am'}` : `${String(hourNum).padStart(2, '0')}:00`;
      const iconTemp = (isNum(h.feelsLikeC) && h.feelsLikeC < h.tempC) ? h.feelsLikeC : h.tempC;
      // BUG-2 fix: night hours (20:00-05:00) get moon icon instead of sun
      const isNightHour = hourNum >= 20 || hourNum < 5;
      const icon = getWeatherIcon(h.rainChance, h.cloudPct, iconTemp, isNightHour);
      const rainPct = isNum(h.rainChance) ? round0(h.rainChance) + '%' : '--';
      const rawWind = h.windKmh ?? h.windKph ?? h.wind_kph ?? (i < 3 ? currentWind : null);
      const windSpeed = isNum(rawWind) ? (settings.wind === 'mph' ? round0(rawWind * 0.621371) : round0(rawWind)) : '--';
      const tempClass = getTempColorClass(h.tempC);
      const uvVal = isNum(h.uv) ? round0(h.uv) : '--';
      const uvClass = isNum(h.uv) ? (h.uv >= 8 ? 'uv-extreme' : h.uv >= 6 ? 'uv-high' : h.uv >= 3 ? 'uv-mod' : '') : '';
      div.innerHTML = `<span class="h-time">${ht}</span><span class="h-icon">${icon}</span><span class="h-temp ${tempClass}">${formatTemp(h.tempC)}</span><span class="h-rain">${rainPct}</span><span class="h-wind">${windSpeed}</span><span class="h-uv ${uvClass}">${uvVal}</span>`;
      hourlyTimeline.appendChild(div);
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
      const iconTemp = isNum(d.lowC) && d.lowC <= 0 ? d.lowC : d.highC;
      // Daily entries don't have cloudPct from the API. Pass null so getWeatherIcon
      // falls back to rain + temp signals only — matches renderDayDetailSummary behaviour.
      const icon = getWeatherIcon(d.rainChance, null, iconTemp);
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
    header.innerHTML = `<span class="h-time">${t('weather', 'time') || 'Time'}</span><span class="h-icon"></span><span class="h-temp">${t('weather', 'temp') || 'Temp'}</span><span class="h-rain">${t('weather', 'rain') || 'Rain'}</span><span class="h-wind">${t('weather', 'wind') || 'Wind'}</span><span class="h-uv">${t('weather', 'uv') || 'UV'}</span>`;
    container.appendChild(header);
    const currentWind = window.__PW_LAST_NORM?.windKph || null;
    hourlySlice.forEach((h, i) => {
      if (!h) return;
      const div = document.createElement('div'); div.classList.add('hourly-row');
      const hourNum = (startHour + i) % 24;
      const ht = settings.time === '12'
        ? `${hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum}${hourNum >= 12 ? 'pm' : 'am'}`
        : `${String(hourNum).padStart(2, '0')}:00`;
      const iconTemp = (isNum(h.feelsLikeC) && h.feelsLikeC < h.tempC) ? h.feelsLikeC : h.tempC;
      const isNightHour = hourNum >= 20 || hourNum < 5;
      const icon = getWeatherIcon(h.rainChance, h.cloudPct, iconTemp, isNightHour);
      const rainPct = isNum(h.rainChance) ? round0(h.rainChance) + '%' : '--';
      const rawWind = h.windKmh ?? h.windKph ?? h.wind_kph ?? (i < 3 ? currentWind : null);
      const windSpeed = isNum(rawWind) ? (settings.wind === 'mph' ? round0(rawWind * 0.621371) : round0(rawWind)) : '--';
      const tempClass = getTempColorClass(h.tempC);
      const uvVal = isNum(h.uv) ? round0(h.uv) : '--';
      const uvClass = isNum(h.uv) ? (h.uv >= 8 ? 'uv-extreme' : h.uv >= 6 ? 'uv-high' : h.uv >= 3 ? 'uv-mod' : '') : '';
      div.innerHTML = `<span class="h-time">${ht}</span><span class="h-icon">${icon}</span><span class="h-temp ${tempClass}">${isNum(h.tempC) ? formatTemp(h.tempC) : '--°'}</span><span class="h-rain">${rainPct}</span><span class="h-wind">${windSpeed}</span><span class="h-uv ${uvClass}">${uvVal}</span>`;
      container.appendChild(div);
    });
  }
  function renderDayDetailSummary(container, day) {
    const card = document.createElement('div');
    card.classList.add('day-detail-summary-card');
    const iconTemp = isNum(day.lowC) && day.lowC <= 0 ? day.lowC : day.highC;
    const icon = getWeatherIcon(day.rainChance, null, iconTemp);
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
    card.innerHTML = `
      <div class="ds-headline">
        <span class="ds-icon">${icon}</span>
        <span class="ds-condition">${cond}</span>
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
      <div class="ds-disclaimer">${disclaimer}</div>
    `;
    container.appendChild(card);
  }
  function applySettings() {
    if (unitsTempSelect) unitsTempSelect.value = settings.temp;
    if (unitsWindSelect) unitsWindSelect.value = settings.wind;
    if (probRangeToggle) probRangeToggle.checked = !!settings.range;
    if (timeFormatSelect) timeFormatSelect.value = settings.time;
    if (languageSelect) languageSelect.value = settings.lang;
    updateUILanguage();
    updateLanguageOptions();
    document.documentElement.lang = settings.lang;
    if (lastPayload) { const norm = normalizePayload(lastPayload); window.__PW_LAST_NORM = norm; renderHome(norm); renderHourly(norm.hourly); renderWeek(norm.daily, norm.hourly); }
    renderFavorites(); renderRecents();
  }
  async function loadAndRender(place) {
    activePlace = place; renderLoading(place.name || 'My Location');
    // 1. Try showing cached data instantly
    const cached = await getCachedWeather(place);
    if (cached) {
      try {
        lastPayload = cached.payload;
        const norm = normalizePayload(cached.payload);
        window.__PW_LAST_NORM = norm;
        renderHome(norm); renderHourly(norm.hourly); renderWeek(norm.daily, norm.hourly);
        showCacheAge(cached.timestamp);
      } catch { /* stale cache, ignore */ }
    }
    // 2. Fetch fresh data from network
    try {
      const payload = await fetchProbable(place);
      lastPayload = payload;
      const norm = normalizePayload(payload);
      window.__PW_LAST_NORM = norm;
      renderHome(norm); renderHourly(norm.hourly); renderWeek(norm.daily, norm.hourly);
      hideCacheAge();
      setCachedWeather(place, payload);
    } catch (e) {
      console.error("Load failed:", e);
      if (!cached) renderError(t('misc', 'couldntFetch'));
      // If cached data was shown, user still sees stale but usable data
    }
  }

  // ========== FAVORITES & RECENTS ==========
  const loadFavorites = () => loadJSON(STORAGE.favorites, []);
  const loadRecents = () => loadJSON(STORAGE.recents, []);
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
    if (list.some(p => samePlace(p, place))) { list = list.filter(p => !samePlace(p, place)); saveFavorites(list); renderFavorites(); showToast(t('toasts', 'removed')); return; }
    await addFavorite(place);
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
      const activate = (ev) => { if (ev?.target?.closest('.remove-recent')) return; showScreen(screenHome); loadAndRender({ name: li.dataset.name, lat: parseFloat(li.dataset.lat), lon: parseFloat(li.dataset.lon) }); };
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
      const activate = () => { const li = span.closest('li'); showScreen(screenHome); loadAndRender({ name: li.dataset.name, lat: parseFloat(li.dataset.lat), lon: parseFloat(li.dataset.lon) }); };
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
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=8&addressdetails=1`, { headers: { 'User-Agent': 'howzit@probablyweather.co.za' }, signal: activeSearchController.signal });
      if (thisSeq !== searchSeq || !resp.ok) return;
      searchResults = (await resp.json()).map(r => ({ name: r.display_name?.split(',')[0] || 'Unknown', fullName: r.display_name, lat: r.lat, lon: r.lon, address: r.address }));
      renderSearchResults(searchResults);
    } catch (e) { if (e.name !== 'AbortError') console.error('Search error:', e); }
  }
  function formatSearchResult(r) { const a = r.address || {}; const city = a.city || a.town || a.village || r.name; return a.country ? `${city}, ${a.country}` : city; }
  async function miniFetchTemp(lat, lon) { const key = `${lat.toFixed(2)},${lon.toFixed(2)}`; if (searchMiniCache.has(key)) return searchMiniCache.get(key); try { const norm = normalizePayload(await fetchProbable({ lat, lon, name: '' })); const r = { temp: formatTemp(norm.nowTemp), icon: conditionEmoji(norm.conditionKey) }; searchMiniCache.set(key, r); return r; } catch { return { temp: '--°', icon: '⛅' }; } }
  function renderSearchResults(results) {
    const rl = document.getElementById('searchResults') || (() => { const ul = document.createElement('ul'); ul.id = 'searchResults'; ul.className = 'search-results'; document.querySelector('.search-body')?.prepend(ul); return ul; })();
    if (!results.length) { rl.innerHTML = ''; return; }
    const favs = loadFavorites();
    rl.innerHTML = results.map(r => { const fn = escapeHtml(formatSearchResult(r)), isFav = favs.some(p => samePlace(p, { lat: parseFloat(r.lat), lon: parseFloat(r.lon) })); return `<li class="search-result-item" role="button" tabindex="0" data-lat="${r.lat}" data-lon="${r.lon}" data-name="${fn}"><button class="fav-star${isFav ? ' is-fav' : ''}" aria-label="Toggle favourite" data-lat="${r.lat}" data-lon="${r.lon}">${isFav ? '★' : '☆'}</button><span class="result-icon" aria-hidden="true">⛅</span><span class="result-name">${fn}</span><span class="result-temp">--°</span></li>`; }).join('');
    rl.querySelectorAll('li[data-lat]').forEach(li => {
      const activate = async (e) => { if (e && e.target && e.target.closest('.fav-star')) return; const place = { name: li.dataset.name, lat: parseFloat(li.dataset.lat), lon: parseFloat(li.dataset.lon) }; showScreen(screenHome); loadAndRender(place); if (searchInput) searchInput.value = ''; rl.innerHTML = ''; addRecentIfNew(place).catch(() => {}); };
      li.addEventListener('click', activate);
      li.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); activate(ev); } });
    });
    rl.querySelectorAll('.fav-star').forEach(btn => { btn.addEventListener('click', async (e) => { e.stopPropagation(); await toggleFavorite({ name: btn.closest('li')?.dataset?.name, lat: parseFloat(btn.dataset.lat), lon: parseFloat(btn.dataset.lon) }); renderSearchResults(results); }); });
    rl.querySelectorAll('li[data-lat]').forEach(async (li) => { const mini = await miniFetchTemp(parseFloat(li.dataset.lat), parseFloat(li.dataset.lon)); const ie = li.querySelector('.result-icon'), te = li.querySelector('.result-temp'); if (ie) ie.textContent = mini.icon || '⛅'; if (te) te.textContent = mini.temp || '--°'; });
  }
  if (searchInput) searchInput.addEventListener('input', (e) => { clearTimeout(searchTimeout); searchTimeout = setTimeout(() => runSearch(e.target.value), 300); });

  // ========== NAV & EVENTS ==========
  navHome?.addEventListener('click', () => { showScreen(screenHome); });
  navHourly?.addEventListener('click', () => showScreen(screenHourly));
  navWeek?.addEventListener('click', () => showScreen(screenWeek));
  $('#dayDetailBack')?.addEventListener('click', () => showScreen(screenWeek));
  navSearch?.addEventListener('click', () => { showScreen(screenSearch); renderRecents(); renderFavorites(); });
  navSettings?.addEventListener('click', () => showScreen(screenSettings));
  
  // Build a display name from reverse geocode data — never returns "My Location, ZA"
  function buildLocationName(data, lat, lon) {
    const city = data?.city;
    const admin1 = data?.admin1;
    const nearCity = data?.nearCity;
    if (city && admin1) return `${city}, ${admin1}`;
    if (city) return city;
    if (admin1) return admin1;
    // Ultimate fallback: use coordinates rounded for display
    return `${Math.abs(lat).toFixed(1)}°${lat < 0 ? 'S' : 'N'}, ${Math.abs(lon).toFixed(1)}°${lon < 0 ? 'W' : 'E'}`;
  }

  // Shared geolocation flow, now used from Search.
  async function getCurrentLocation() {
    showScreen(screenHome);
    const savedGpsLoc = loadJSON(STORAGE.location, null);
    if ("geolocation" in navigator) {
      renderLoading("Getting location…");
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = Math.round(pos.coords.latitude * 10) / 10, lon = Math.round(pos.coords.longitude * 10) / 10;
        try {
          const rev = await fetch(`/api/weather?reverse=1&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
          const data = await rev.json();
          const displayName = buildLocationName(data, lat, lon);
          saveJSON(STORAGE.location, { city: data?.city, admin1: data?.admin1, countryCode: data?.countryCode, lat, lon });
          homePlace = { name: displayName, lat, lon };
          saveJSON(STORAGE.home, homePlace);
          loadAndRender(homePlace);
          showToast('📍 ' + (t('toasts', 'locationUpdated') || 'Location updated'));
        } catch {
          // API failed — try client-side reverse geocode
          const fallbackName = await reverseGeocode(lat, lon);
          homePlace = { name: fallbackName || `${Math.abs(lat).toFixed(1)}°S, ${Math.abs(lon).toFixed(1)}°E`, lat, lon };
          saveJSON(STORAGE.home, homePlace);
          loadAndRender(homePlace);
        }
      }, (err) => {
        debugLog('Geolocation error:', err.code, err.message);
        if (savedGpsLoc?.lat && savedGpsLoc?.lon) {
          const savedName = savedGpsLoc.city && savedGpsLoc.admin1
            ? `${savedGpsLoc.city}, ${savedGpsLoc.admin1}`
            : (savedGpsLoc.city || savedGpsLoc.admin1 || 'South Africa');
          homePlace = { name: savedName, lat: savedGpsLoc.lat, lon: savedGpsLoc.lon };
          saveJSON(STORAGE.home, homePlace);
          loadAndRender(homePlace);
          showToast('📍 ' + (t('toasts', 'usingSaved') || 'Using saved location'));
        } else {
          // GPS blocked, no saved location - use IP geolocation
          getIPLocation().then(place => {
            homePlace = place;
            saveJSON(STORAGE.home, homePlace);
            loadAndRender(homePlace);
          });
        }
      }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
    } else {
      if (savedGpsLoc?.lat && savedGpsLoc?.lon) {
        const savedName = savedGpsLoc.city && savedGpsLoc.admin1
          ? `${savedGpsLoc.city}, ${savedGpsLoc.admin1}`
          : (savedGpsLoc.city || savedGpsLoc.admin1 || 'South Africa');
        homePlace = { name: savedName, lat: savedGpsLoc.lat, lon: savedGpsLoc.lon };
        saveJSON(STORAGE.home, homePlace);
        loadAndRender(homePlace);
        showToast('📍 ' + (t('toasts', 'usingSaved') || 'Using saved location'));
      } else {
        getIPLocation().then(place => {
          homePlace = place;
          saveJSON(STORAGE.home, homePlace);
          loadAndRender(homePlace);
        });
      }
    }
  }
  
  unitsTempSelect?.addEventListener('change', () => { settings.temp = unitsTempSelect.value; saveSettings(); applySettings(); });
  unitsWindSelect?.addEventListener('change', () => { settings.wind = unitsWindSelect.value; saveSettings(); applySettings(); });
  probRangeToggle?.addEventListener('change', () => { settings.range = !!probRangeToggle.checked; saveSettings(); applySettings(); });
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
  saveCurrent?.addEventListener('click', () => { if (activePlace) addFavorite(activePlace); });
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
  loadSettings(); applySettings(); renderRecents(); renderFavorites();
  homePlace = loadJSON(STORAGE.home, null);
  const savedLoc = loadJSON(STORAGE.location, null);
  if (sharedPlace) { showScreen(screenHome); loadAndRender(sharedPlace); }
  else if (homePlace) { showScreen(screenHome); loadAndRender(homePlace); }
  else if (savedLoc?.lat && savedLoc?.lon) {
    const sn = savedLoc.city && savedLoc.admin1 ? `${savedLoc.city}, ${savedLoc.admin1}` : (savedLoc.city || savedLoc.admin1 || 'South Africa');
    homePlace = { name: sn, lat: savedLoc.lat, lon: savedLoc.lon }; saveJSON(STORAGE.home, homePlace); showScreen(screenHome); loadAndRender(homePlace);
  }
  else { showScreen(screenHome); renderLoading("Locating…");
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = Math.round(pos.coords.latitude * 10) / 10, lon = Math.round(pos.coords.longitude * 10) / 10;
        try {
          const rev = await fetch(`/api/weather?reverse=1&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`); const data = await rev.json();
          const displayName = buildLocationName(data, lat, lon);
          saveJSON(STORAGE.location, { city: data?.city, admin1: data?.admin1, countryCode: data?.countryCode, lat, lon });
          homePlace = { name: displayName, lat, lon }; saveJSON(STORAGE.home, homePlace); loadAndRender(homePlace);
        } catch {
          const fn = await reverseGeocode(lat, lon);
          homePlace = { name: fn || 'South Africa', lat, lon }; saveJSON(STORAGE.home, homePlace); loadAndRender(homePlace);
        }
      }, () => {
        // GPS blocked on first visit - use IP geolocation instead of hardcoded city
        getIPLocation().then(place => {
          homePlace = place;
          saveJSON(STORAGE.home, homePlace);
          loadAndRender(homePlace);
        });
      }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
    } else {
      // No geolocation support - use IP geolocation
      getIPLocation().then(place => {
        homePlace = place;
        saveJSON(STORAGE.home, homePlace);
        loadAndRender(place);
      });
    }
  }

  // ========== AUTO-REFRESH ==========
  // Refresh weather data every 30 minutes to keep conditions current
  const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes
  let lastFetchTime = Date.now();
  setInterval(() => {
    if (activePlace && document.visibilityState === 'visible') {
      loadAndRender(activePlace);
      lastFetchTime = Date.now();
    }
  }, REFRESH_INTERVAL);

  // Also refresh when user returns to the app after being away
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && activePlace) {
      const elapsed = Date.now() - lastFetchTime;
      // Only refresh if more than 15 minutes since last fetch
      if (elapsed > 15 * 60 * 1000) {
        loadAndRender(activePlace);
        lastFetchTime = Date.now();
      }
    }
  });
});


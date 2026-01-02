document.addEventListener('DOMContentLoaded', () => {
  /* =========================================================
     Probably Weather — Full Production App.js (Feature Complete)
     Fixes:
       - Hourly starts from NOW (in searched place local time)
       - Time-of-day (dawn/day/dusk/night) based on place timezone
       - "Agreement" replaces "Confidence" (Strong/Decent/Mixed)
       - Proves sources used (Open-Meteo / OpenWeatherMap / WeatherAPI)
       - Home button returns to GEOLOCATION (not last search)
       - Keeps: screens, search, favorites, recents, settings, particles, loader, toast
     ========================================================= */

  // ---------- DOM ----------
  const bgImg = document.getElementById('bgImg');
  const heatOverlay = document.getElementById('heatOverlay');
  const body = document.body;

  const headline = document.getElementById('headline');
  const tempEl = document.getElementById('temp');
  const description = document.getElementById('description');

  const extremeLabel = document.getElementById('extremeLabel');
  const extremeValue = document.getElementById('extremeValue');
  const rainValue = document.getElementById('rainValue');
  const uvValue = document.getElementById('uvValue');

  // Keep IDs to avoid CSS changes
  const agreementValueEl = document.getElementById('confidenceValue'); // display "Strong/Decent/Mixed"
  const agreementLineEl = document.getElementById('confidence');       // top line on home screen
  const agreementBar = document.getElementById('confidenceBar');
  const sourcesEl = document.getElementById('sources');               // new in index.html

  const locationEl = document.getElementById('location');
  const particles = document.getElementById('particles');

  const homeScreen = document.getElementById('home-screen');
  const hourlyScreen = document.getElementById('hourly-screen');
  const weekScreen = document.getElementById('week-screen');
  const searchScreen = document.getElementById('search-screen');
  const settingsScreen = document.getElementById('settings-screen');

  const hourlyTimeline = document.getElementById('hourly-timeline');
  const dailyCards = document.getElementById('daily-cards');

  const searchInput = document.getElementById('searchInput');
  const favoritesList = document.getElementById('favoritesList');
  const recentList = document.getElementById('recentList');
  const saveCurrentBtn = document.getElementById('saveCurrent');
  const manageFavoritesBtn = document.getElementById('manageFavorites');

  const loader = document.getElementById('loader');
  const toast = document.getElementById('toast');

  const navHome = document.getElementById('navHome');
  const navHourly = document.getElementById('navHourly');
  const navWeek = document.getElementById('navWeek');
  const navSearch = document.getElementById('navSearch');
  const navSettings = document.getElementById('navSettings');

  const unitsSelect = document.getElementById('units');
  const themeSelect = document.getElementById('theme');

  // ---------- KEYS (as you requested) ----------
  const WEATHERAPI_KEY = "a98886bfef6c4dcd8bf111514251512";
  const OPENWEATHER_KEY = "a56be2054510bc8fed22998c68972876";

  // ---------- STORAGE KEYS ----------
  const LS_FAV = 'pw_favorites_v1';
  const LS_RECENT = 'pw_recents_v1';
  const LS_SETTINGS = 'pw_settings_v1';

  // ---------- LIMITS ----------
  const MAX_FAV = 5;
  const MAX_RECENT = 10;

  // ---------- DEFAULT FALLBACK ----------
  const DEFAULT_LOC = { name: 'Strand, WC', lat: -34.1069, lon: 18.8273 };

  // ---------- APP STATE ----------
  let geoLoc = null;             // {name, lat, lon}
  let currentLoc = null;         // last viewed location (search result etc.)
  let currentData = null;        // aggregated data for currentLoc
  let openMeteoTZ = null;        // timezone string from Open-Meteo
  let openMeteoNowLocal = null;  // ISO string local time from OM current_weather.time

  let settings = loadSettings();
  applySettingsToUI();

  // ---------- UTIL ----------
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2400);
  }

  function setLoading(on) {
    if (!loader) return;
    loader.classList.toggle('hidden', !on);
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function isNum(v) {
    return typeof v === 'number' && !Number.isNaN(v);
  }

  function roundTemp(vC) {
    if (!isNum(vC)) return null;
    if (settings.units === 'F') return Math.round((vC * 9/5) + 32);
    return Math.round(vC);
  }

  function formatTemp(vC) {
    const v = roundTemp(vC);
    if (!isNum(v)) return '--';
    return `${v}°`;
  }

  function median(arr) {
    const a = arr.filter(isNum).sort((x, y) => x - y);
    if (!a.length) return null;
    const mid = Math.floor(a.length / 2);
    return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  }

  function spread(arr) {
    const a = arr.filter(isNum);
    if (a.length < 2) return null;
    return Math.max(...a) - Math.min(...a);
  }

  function safeISODatePart(isoOrDateString) {
    // Accept "2026-01-02T18:00" or "2026-01-02"
    if (!isoOrDateString) return null;
    return String(isoOrDateString).slice(0, 10);
  }

  function safeISOTimePart(isoOrDateString) {
    // Accept "2026-01-02T18:00"
    if (!isoOrDateString) return null;
    const s = String(isoOrDateString);
    const t = s.split('T')[1];
    return t ? t.slice(0, 5) : null; // HH:MM
  }

  function isoHour(isoOrDateString) {
    const t = safeISOTimePart(isoOrDateString);
    if (!t) return null;
    const h = parseInt(t.split(':')[0], 10);
    return Number.isFinite(h) ? h : null;
  }

  function computeTimeOfDayFromHour(h) {
    // Simple, consistent buckets
    if (h === null) return 'day';
    if (h >= 5 && h < 8) return 'dawn';
    if (h >= 8 && h < 17) return 'day';
    if (h >= 17 && h < 20) return 'dusk';
    return 'night';
  }

  // ---------- SCREENS ----------
  function showScreen(which) {
    const map = {
      home: homeScreen,
      hourly: hourlyScreen,
      week: weekScreen,
      search: searchScreen,
      settings: settingsScreen
    };
    Object.values(map).forEach(el => el && el.classList.add('hidden'));
    map[which] && map[which].classList.remove('hidden');
  }

  // ---------- SETTINGS ----------
  function loadSettings() {
    try {
      const raw = localStorage.getItem(LS_SETTINGS);
      if (!raw) return { units: 'C', theme: 'auto' };
      const parsed = JSON.parse(raw);
      return {
        units: (parsed.units === 'F' ? 'F' : 'C'),
        theme: (['auto','light','dark'].includes(parsed.theme) ? parsed.theme : 'auto')
      };
    } catch {
      return { units: 'C', theme: 'auto' };
    }
  }

  function saveSettings() {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
  }

  function applySettingsToUI() {
    if (unitsSelect) unitsSelect.value = settings.units;
    if (themeSelect) themeSelect.value = settings.theme;
    applyTheme();
  }

  function applyTheme() {
    body.classList.remove('theme-light', 'theme-dark');
    if (settings.theme === 'light') body.classList.add('theme-light');
    if (settings.theme === 'dark') body.classList.add('theme-dark');
    // 'auto' = leave as CSS weather-based vibe (your design)
  }

  // ---------- FAVORITES / RECENTS ----------
  function loadFavs() {
    try { return JSON.parse(localStorage.getItem(LS_FAV) || '[]'); } catch { return []; }
  }
  function saveFavs(favs) {
    localStorage.setItem(LS_FAV, JSON.stringify(favs.slice(0, MAX_FAV)));
  }

  function loadRecents() {
    try { return JSON.parse(localStorage.getItem(LS_RECENT) || '[]'); } catch { return []; }
  }
  function saveRecents(recents) {
    localStorage.setItem(LS_RECENT, JSON.stringify(recents.slice(0, MAX_RECENT)));
  }

  function addRecent(place) {
    const recents = loadRecents();
    const filtered = recents.filter(p => !(p.lat === place.lat && p.lon === place.lon));
    filtered.unshift(place);
    saveRecents(filtered);
    renderRecents();
  }

  function renderFavs() {
    if (!favoritesList) return;
    const favs = loadFavs();
    favoritesList.innerHTML = '';
    if (!favs.length) {
      favoritesList.innerHTML = '<li class="muted">None yet</li>';
      return;
    }
    favs.forEach((p, idx) => {
      const li = document.createElement('li');
      li.className = 'place-item';
      li.innerHTML = `
        <button class="place-btn" data-lat="${p.lat}" data-lon="${p.lon}" data-name="${escapeHtml(p.name)}">
          ${escapeHtml(p.name)}
        </button>
        <button class="place-del" data-idx="${idx}" title="Remove">✕</button>
      `;
      favoritesList.appendChild(li);
    });

    favoritesList.querySelectorAll('.place-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const place = {
          name: btn.getAttribute('data-name'),
          lat: parseFloat(btn.getAttribute('data-lat')),
          lon: parseFloat(btn.getAttribute('data-lon'))
        };
        loadPlace(place, { from: 'favorites' });
        showScreen('home');
      });
    });

    favoritesList.querySelectorAll('.place-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.getAttribute('data-idx'), 10);
        const favs2 = loadFavs();
        favs2.splice(i, 1);
        saveFavs(favs2);
        renderFavs();
      });
    });
  }

  function renderRecents() {
    if (!recentList) return;
    const recents = loadRecents();
    recentList.innerHTML = '';
    if (!recents.length) {
      recentList.innerHTML = '<li class="muted">None yet</li>';
      return;
    }
    recents.forEach(p => {
      const li = document.createElement('li');
      li.className = 'place-item';
      li.innerHTML = `
        <button class="place-btn" data-lat="${p.lat}" data-lon="${p.lon}" data-name="${escapeHtml(p.name)}">
          ${escapeHtml(p.name)}
        </button>
      `;
      recentList.appendChild(li);
    });

    recentList.querySelectorAll('.place-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const place = {
          name: btn.getAttribute('data-name'),
          lat: parseFloat(btn.getAttribute('data-lat')),
          lon: parseFloat(btn.getAttribute('data-lon'))
        };
        loadPlace(place, { from: 'recents' });
        showScreen('home');
      });
    });
  }

  function escapeHtml(str) {
    return String(str || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  // ---------- HUMOR / CONDITION ----------
  function determineCondition(avgTempC, rainChance, windKph) {
    // You can refine later; keeping stable and predictable now.
    if ((isNum(rainChance) && rainChance >= 50)) return 'rain';
    if (isNum(windKph) && windKph >= 35) return 'wind';
    if (isNum(avgTempC) && avgTempC >= 30) return 'heat';
    if (isNum(avgTempC) && avgTempC <= 8) return 'cold';
    return 'clear';
  }

  function humorLine(condition, tod) {
    const pack = {
      clear: {
        day: ["Braai weather, boet!", "Sky’s on your side today.", "No Ja-No-Maybe. Just lekker."],
        dawn: ["Morning is behaving—enjoy it.", "Sun’s clocking in early."],
        dusk: ["Golden hour looking sharp.", "Evening vibes: sorted."],
        night: ["Clear night—star duty.", "Night’s calm. Don’t jinx it."]
      },
      rain: {
        day: ["The clouds are crying—plan accordingly.", "Rain jacket energy.", "Not a braai day unless you’re brave."],
        dawn: ["Wet start—coffee first.", "Morning drizzle vibes."],
        dusk: ["Evening rain—blanket and series weather.", "Rain’s doing a night shift."],
        night: ["Listen… that’s rain. Not ghosts.", "Night rain: cozy, not convenient."]
      },
      cold: {
        day: ["Jacket weather. No debates.", "Cold day—perfect excuse for a potjie."],
        dawn: ["Cold morning—rug up tight!", "Air’s got attitude today."],
        dusk: ["Cold evening—hands in pockets mode.", "Cold outside. Warm inside. Sorted."],
        night: ["Cold night—extra blanket tax.", "Winter’s flexing again."]
      },
      heat: {
        day: ["Hot hot hot—hydrate, boet.", "Heatwave energy.", "Braai weather… but you’ll sweat."],
        dawn: ["Warm early—today’s not playing.", "Morning already spicy."],
        dusk: ["Still hot at sunset—rude.", "Evening heat hangover."],
        night: ["Hot night—fan on, hope on.", "Sleep? In this heat? Good luck."]
      },
      wind: {
        day: ["Wind’s got opinions today.", "Hold onto your hat—literally."],
        dawn: ["Windy morning—hair’s doing its own thing.", "Breezy start—brace yourself."],
        dusk: ["Wind at sunset—dramatic.", "Evening gusts: chaos-lite."],
        night: ["Windy night—doors will slam themselves.", "Wind’s practicing for a storm."]
      },
      fog: {
        day: ["Foggy—drive like you’ve got sense.", "Visibility: vibes only."],
        dawn: ["Foggy morning—slow and steady.", "Mist mode activated."],
        dusk: ["Fog rolling in—movie scene energy.", "Evening mist—spooky but chill."],
        night: ["Fog at night—use your lights properly.", "Foggy night—take it easy."]
      },
      storm: {
        day: ["Storm vibes—don’t start a fight with the sky.", "It’s throwing hands out there."],
        dawn: ["Stormy morning—stay grounded.", "Lightning isn’t a vibe."],
        dusk: ["Storm at sunset—cinematic, but dangerous.", "Nature’s being dramatic."],
        night: ["Storm at night—charge your phone.", "If it bangs, it’s probably thunder."]
      }
    };
    const bucket = pack[condition] || pack.clear;
    const list = bucket[tod] || bucket.day || ["Probably fine."];
    return list[Math.floor(Math.random() * list.length)];
  }

  // ---------- BACKGROUNDS ----------
  function bgPath(condition, tod) {
    // expects your folder structure: assets/images/bg/<condition>/<tod>.jpg
    // condition folders: clear, cold, fog, heat, rain, storm, wind
    const c = condition || 'clear';
    const t = tod || 'day';
    return `assets/images/bg/${c}/${t}.jpg`;
  }

  function setBackground(condition, tod) {
    const url = bgPath(condition, tod);

    // Quick pre-load to avoid harsh swap
    const img = new Image();
    img.onload = () => {
      bgImg.src = url;
      bgImg.classList.add('loaded');
    };
    img.onerror = () => {
      // fallback to clear/day
      const fallback = `assets/images/bg/clear/day.jpg`;
      if (bgImg.src !== fallback) bgImg.src = fallback;
    };
    img.src = url;

    // Heat overlay only for heat
    heatOverlay.style.opacity = (condition === 'heat') ? '1' : '0';
  }

  // ---------- PARTICLES ----------
  function clearParticles() {
    if (!particles) return;
    particles.innerHTML = '';
    particles.className = '';
  }

  function addParticles(condition) {
    if (!particles) return;
    clearParticles();
    particles.classList.add(`p-${condition}`);

    // light, cheap particles: create 30 for rain/snow-like, 18 for wind/storm
    let count = 0;
    if (condition === 'rain') count = 40;
    else if (condition === 'storm') count = 28;
    else if (condition === 'wind') count = 22;
    else if (condition === 'fog') count = 18;
    else count = 0;

    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.left = `${Math.random() * 100}%`;
      p.style.animationDelay = `${Math.random() * 2}s`;
      p.style.animationDuration = `${2 + Math.random() * 3}s`;
      particles.appendChild(p);
    }
  }

  // ---------- AGREEMENT ----------
  function computeAgreement(tempSpreadC, rainSpreadPct) {
    // Mixed should be rare, Decent most common.
    const t = isNum(tempSpreadC) ? tempSpreadC : null;
    const r = isNum(rainSpreadPct) ? rainSpreadPct : null;

    if (t === null && r === null) return { label: 'Decent', pct: 60 };

    // Strong: close alignment
    const strongT = (t === null) || (t <= 3);
    const strongR = (r === null) || (r <= 20);
    if (strongT && strongR) return { label: 'Strong', pct: 85 };

    // Decent: normal variance
    const decentT = (t === null) || (t <= 6);
    const decentR = (r === null) || (r <= 40);
    if (decentT && decentR) return { label: 'Decent', pct: 60 };

    // Mixed: models disagree
    return { label: 'Mixed', pct: 40 };
  }

  function renderAgreement(label, pct, sourcesUsed) {
    const srcText = sourcesUsed?.length ? ` • Based on ${sourcesUsed.length} source${sourcesUsed.length === 1 ? '' : 's'}` : '';
    agreementLineEl.textContent = `PROBABLY • ${label.toUpperCase()} AGREEMENT${srcText}`;
    agreementValueEl.textContent = label.toUpperCase();
    if (agreementBar) agreementBar.style.width = `${clamp(pct, 0, 100)}%`;

    if (sourcesEl) {
      sourcesEl.textContent = sourcesUsed?.length
        ? `Sources: ${sourcesUsed.join(' • ')}`
        : `Sources: —`;
    }
  }

  // ---------- SOURCES FETCH ----------
  async function safeFetchJson(url, timeoutMs = 7000) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
  }

  async function fetchOpenMeteo(lat, lon) {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}` +
      `&current_weather=true` +
      `&hourly=temperature_2m,precipitation_probability,windspeed_10m` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max` +
      `&timezone=auto&forecast_days=7`;
    return await safeFetchJson(url, 7500);
  }

  async function fetchOpenWeather(lat, lon) {
    // Using 2.5 forecast (3-hour) because it’s the most consistently available on free tiers
    const url =
      `https://api.openweathermap.org/data/2.5/forecast?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}` +
      `&appid=${OPENWEATHER_KEY}&units=metric`;
    return await safeFetchJson(url, 7500);
  }

  async function fetchWeatherAPI(lat, lon) {
    const url =
      `https://api.weatherapi.com/v1/forecast.json?key=${WEATHERAPI_KEY}&q=${encodeURIComponent(lat + ',' + lon)}&days=7&aqi=no&alerts=no`;
    return await safeFetchJson(url, 7500);
  }

  // ---------- AGGREGATION CORE ----------
  function normalizeFromOpenMeteo(om) {
    if (!om) return null;

    const nowTemp = om.current_weather?.temperature;
    const nowTime = om.current_weather?.time || null;
    const tz = om.timezone || null;

    const daily = om.daily || {};
    const dHigh = daily.temperature_2m_max?.[0];
    const dLow = daily.temperature_2m_min?.[0];
    const dRain = daily.precipitation_probability_max?.[0];
    const dUv = daily.uv_index_max?.[0];

    // Hourly arrays
    const hourly = om.hourly || {};
    const hTimes = hourly.time || [];
    const hTemps = hourly.temperature_2m || [];
    const hRain = hourly.precipitation_probability || [];
    const hWind = hourly.windspeed_10m || [];

    return {
      source: 'Open-Meteo',
      tz,
      nowTime,
      nowTemp,
      todayHigh: dHigh,
      todayLow: dLow,
      todayRain: dRain,
      todayUv: dUv,
      hourly: { times: hTimes, temps: hTemps, rain: hRain, wind: hWind },
      daily: daily
    };
  }

  function normalizeFromOpenWeather(owm) {
    if (!owm) return null;
    const first = owm.list?.[0];
    const nowTemp = first?.main?.temp;

    // derive today high/low from the next ~24h in 3-hour blocks
    const list = Array.isArray(owm.list) ? owm.list : [];
    const slice = list.slice(0, 8); // 8 * 3h = 24h
    const highs = slice.map(x => x?.main?.temp_max).filter(isNum);
    const lows = slice.map(x => x?.main?.temp_min).filter(isNum);
    const pops = slice.map(x => (isNum(x?.pop) ? x.pop * 100 : null)).filter(isNum);

    const todayHigh = highs.length ? Math.max(...highs) : null;
    const todayLow = lows.length ? Math.min(...lows) : null;
    const todayRain = pops.length ? Math.max(...pops) : null;

    // hourly-like from 3-hour blocks
    const times = slice.map(x => x?.dt_txt || null).filter(Boolean);
    const temps = slice.map(x => x?.main?.temp).filter(isNum);
    const rain = slice.map(x => (isNum(x?.pop) ? Math.round(x.pop * 100) : 0));

    return {
      source: 'OpenWeatherMap',
      nowTemp,
      todayHigh,
      todayLow,
      todayRain,
      todayUv: null,
      hourly3h: { times, temps, rain }
    };
  }

  function normalizeFromWeatherAPI(wa) {
    if (!wa) return null;

    const nowTemp = wa.current?.temp_c;
    const nowUv = wa.current?.uv;

    const fd0 = wa.forecast?.forecastday?.[0];
    const day = fd0?.day;
    const todayHigh = day?.maxtemp_c;
    const todayLow = day?.mintemp_c;
    const todayRain = day?.daily_chance_of_rain;

    // hourly from WeatherAPI (hourly array has localtime strings)
    const hours = fd0?.hour || [];
    const times = hours.map(h => h?.time).filter(Boolean);
    const temps = hours.map(h => h?.temp_c).filter(isNum);
    const rain = hours.map(h => isNum(h?.chance_of_rain) ? h.chance_of_rain : 0);

    // week
    const week = (wa.forecast?.forecastday || []).map(d => ({
      date: d?.date,
      high: d?.day?.maxtemp_c,
      low: d?.day?.mintemp_c,
      rain: d?.day?.daily_chance_of_rain
    }));

    return {
      source: 'WeatherAPI',
      nowTemp,
      todayHigh,
      todayLow,
      todayRain,
      todayUv: nowUv,
      hourly: { times, temps, rain },
      week
    };
  }

  function aggregateAll(norms) {
    const sourcesUsed = norms.map(n => n.source);

    const tempsNow = norms.map(n => n.nowTemp);
    const highs = norms.map(n => n.todayHigh);
    const lows = norms.map(n => n.todayLow);
    const rains = norms.map(n => n.todayRain);
    const uvs = norms.map(n => n.todayUv);

    const tempNow = median(tempsNow);
    const hi = median(highs);
    const lo = median(lows);
    const rainChance = median(rains);
    const uv = median(uvs);

    const tSpread = spread(tempsNow);
    const rSpread = spread(rains);
    const agree = computeAgreement(tSpread, rSpread);

    return {
      sourcesUsed,
      tempNow,
      high: hi,
      low: lo,
      rainChance,
      uv,
      agreement: agree.label,
      agreementPct: agree.pct
    };
  }

  // ---------- HOURLY BUILD (THE BIG FIX) ----------
  function buildHourlyFromOpenMeteo(omNorm) {
    // We treat Open-Meteo as the time authority because it returns timezone=auto
    // and provides current_weather.time aligned to location local time.
    const h = omNorm.hourly;
    if (!h?.times?.length) return null;

    const nowISO = omNorm.nowTime; // e.g. "2026-01-02T18:00"
    if (!nowISO) return null;

    const nowIdx = h.times.findIndex(t => t >= nowISO);
    const start = (nowIdx >= 0) ? nowIdx : 0;

    const out = [];
    const end = Math.min(h.times.length, start + 12);
    for (let i = start; i < end; i++) {
      out.push({
        iso: h.times[i],
        timeLabel: safeISOTimePart(h.times[i]) || '--:--',
        datePart: safeISODatePart(h.times[i]),
        tempC: isNum(h.temps[i]) ? h.temps[i] : null,
        rain: isNum(h.rain[i]) ? h.rain[i] : 0,
        wind: isNum(h.wind[i]) ? h.wind[i] : null
      });
    }
    return out;
  }

  function renderHourly(hourly) {
    if (!hourlyTimeline) return;
    hourlyTimeline.innerHTML = '';

    if (!hourly || !hourly.length) {
      hourlyTimeline.innerHTML = '<div class="muted">No hourly data available.</div>';
      return;
    }

    const todayPart = hourly[0].datePart;

    hourly.forEach((h) => {
      const dayLabel = (h.datePart === todayPart) ? 'Today' : 'Tomorrow';
      const card = document.createElement('div');
      card.classList.add('hourly-card');
      card.innerHTML = `
        <div class="hour-time">${dayLabel} ${h.timeLabel}</div>
        <div class="hour-temp">${formatTemp(h.tempC)}</div>
        <div class="hour-rain">${Math.round(h.rain)}% rain</div>
      `;
      hourlyTimeline.appendChild(card);
    });
  }

  // ---------- WEEK BUILD ----------
  function buildWeekFromOpenMeteo(om) {
    const d = om.daily || {};
    const dates = d.time || [];
    const highs = d.temperature_2m_max || [];
    const lows = d.temperature_2m_min || [];
    const rains = d.precipitation_probability_max || [];

    const out = [];
    for (let i = 0; i < Math.min(7, dates.length); i++) {
      out.push({
        date: dates[i],
        highC: isNum(highs[i]) ? highs[i] : null,
        lowC: isNum(lows[i]) ? lows[i] : null,
        rain: isNum(rains[i]) ? rains[i] : 0
      });
    }
    return out.length ? out : null;
  }

  function renderWeek(week) {
    if (!dailyCards) return;
    dailyCards.innerHTML = '';

    if (!week || !week.length) {
      dailyCards.innerHTML = '<div class="muted">No weekly data available.</div>';
      return;
    }

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    week.forEach((d, i) => {
      const dateObj = new Date(d.date + 'T00:00:00');
      const dayName = i === 0 ? 'Today' : days[dateObj.getDay()];
      const dateStr = dateObj.toLocaleDateString('en-ZA', { weekday: 'short', month: 'short', day: 'numeric' });

      const avgTemp = isNum(d.highC) && isNum(d.lowC) ? (d.highC + d.lowC) / 2 : null;
      const cond = determineCondition(avgTemp, d.rain, null);

      const card = document.createElement('div');
      card.classList.add('day-card');
      card.innerHTML = `
        <div class="day-name">${dayName}</div>
        <div class="day-date">${dateStr}</div>
        <div class="day-temp">${formatTemp(d.lowC)}–${formatTemp(d.highC)}</div>
        <div class="day-rain">Rain: ${Math.round(d.rain)}%</div>
        <div class="day-humor"><em>${escapeHtml(humorLine(cond, 'day'))}</em></div>
      `;
      dailyCards.appendChild(card);
    });
  }

  // ---------- MAIN RENDER ----------
  function renderAll(place, aggregated, omNorm) {
    currentLoc = place;
    currentData = aggregated;

    // Use Open-Meteo current local time for time-of-day + background logic
    openMeteoTZ = omNorm?.tz || null;
    openMeteoNowLocal = omNorm?.nowTime || null;

    const nowHour = isoHour(openMeteoNowLocal);
    const tod = computeTimeOfDayFromHour(nowHour);

    // Determine condition using median “today average”, rain, wind from Open-Meteo now hour if available
    const avgTemp = (isNum(aggregated.high) && isNum(aggregated.low)) ? (aggregated.high + aggregated.low) / 2 : aggregated.tempNow;
    const windNow = (() => {
      const h = omNorm?.hourly;
      if (!h?.times?.length || !openMeteoNowLocal) return null;
      const idx = h.times.findIndex(t => t === openMeteoNowLocal);
      if (idx < 0) return null;
      const w = h.wind?.[idx];
      return isNum(w) ? w : null;
    })();

    const condition = determineCondition(avgTemp, aggregated.rainChance, windNow);

    // Background + particles
    setBackground(condition, tod);
    addParticles(condition);

    // Headline + temps
    headline.textContent = `This is ${condition}.`;
    tempEl.textContent = `${formatTemp(aggregated.low)}–${formatTemp(aggregated.high)}`.replace('--°–--°','--°');
    if (isNum(aggregated.low) && isNum(aggregated.high)) {
      tempEl.textContent = `${formatTemp(aggregated.low)}–${formatTemp(aggregated.high)}`;
    } else if (isNum(aggregated.tempNow)) {
      tempEl.textContent = formatTemp(aggregated.tempNow);
    } else {
      tempEl.textContent = '--°';
    }

    // Description / humor
    description.textContent = humorLine(condition, tod);

    // Sidebar values
    extremeValue.textContent = condition.charAt(0).toUpperCase() + condition.slice(1);
    rainValue.textContent = isNum(aggregated.rainChance) ? `${Math.round(aggregated.rainChance)}%` : '--';
    uvValue.textContent = isNum(aggregated.uv) ? String(Math.round(aggregated.uv)) : '--';

    // Agreement + sources proof
    renderAgreement(aggregated.agreement, aggregated.agreementPct, aggregated.sourcesUsed);

    // Location line
    if (locationEl) locationEl.textContent = place.name;

    // Hourly / Week
    const hourly = buildHourlyFromOpenMeteo(omNorm);
    renderHourly(hourly);
    const week = buildWeekFromOpenMeteo(omNorm);
    renderWeek(week);
  }

  // ---------- LOAD PLACE ----------
  async function loadPlace(place, opts = {}) {
    setLoading(true);
    try {
      // Fetch all three sources in parallel, tolerate failures
      const [om, owm, wa] = await Promise.all([
        fetchOpenMeteo(place.lat, place.lon),
        fetchOpenWeather(place.lat, place.lon),
        fetchWeatherAPI(place.lat, place.lon)
      ]);

      const norms = [];
      const omNorm = normalizeFromOpenMeteo(om);
      const owmNorm = normalizeFromOpenWeather(owm);
      const waNorm = normalizeFromWeatherAPI(wa);

      if (omNorm) norms.push(omNorm);
      if (owmNorm) norms.push(owmNorm);
      if (waNorm) norms.push(waNorm);

      if (!norms.length) {
        showToast("Couldn’t fetch weather sources. Showing fallback.");
        // fallback minimal render
        renderAll(place, {
          sourcesUsed: [],
          tempNow: null,
          high: null,
          low: null,
          rainChance: null,
          uv: null,
          agreement: 'Decent',
          agreementPct: 60
        }, { tz: null, nowTime: null, hourly: { times: [], temps: [], rain: [], wind: [] }, daily: {} });
        return;
      }

      const aggregated = aggregateAll(norms);
      // Use Open-Meteo as time authority; if OM failed, we still render but hourly/week may be limited
      const omAuthority = omNorm || norms.find(n => n.source === 'Open-Meteo') || omNorm;

      renderAll(place, aggregated, omAuthority);

      // record recent if not home-load
      if (opts.from !== 'geo') addRecent(place);

    } catch (err) {
      console.error(err);
      showToast("Something went wrong fetching weather.");
    } finally {
      setLoading(false);
    }
  }

  // ---------- GEOLOCATION / HOME BEHAVIOR ----------
  async function loadHomeFromGeo() {
    // Home must return to geoLoc (or fallback default)
    const target = geoLoc || DEFAULT_LOC;
    await loadPlace(target, { from: 'geo' });
    showScreen('home');
  }

  function initGeolocation() {
    if (!navigator.geolocation) {
      geoLoc = null;
      loadHomeFromGeo();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        geoLoc = {
          name: 'My Location',
          lat: pos.coords.latitude,
          lon: pos.coords.longitude
        };
        loadHomeFromGeo();
      },
      () => {
        geoLoc = null;
        loadHomeFromGeo();
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
    );
  }

  // ---------- SEARCH ----------
  async function doSearch(query) {
    // Remove previous results list if any
    const existing = document.querySelector('.search-results-list');
    if (existing) existing.remove();

    const resultsList = document.createElement('ul');
    resultsList.className = 'search-results-list';
    searchInput.after(resultsList);
    resultsList.innerHTML = '<li class="muted">Searching...</li>';

    const url =
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=8&addressdetails=1`;

    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json'
        }
      });
      const places = await res.json();

      resultsList.innerHTML = '';

      if (!Array.isArray(places) || !places.length) {
        resultsList.innerHTML = '<li class="muted">No places found</li>';
        return;
      }

      places.forEach(p => {
        const name = p.display_name;
        const lat = parseFloat(p.lat);
        const lon = parseFloat(p.lon);

        const li = document.createElement('li');
        li.className = 'place-item';
        li.innerHTML = `
          <button class="place-btn" data-lat="${lat}" data-lon="${lon}" data-name="${escapeHtml(name)}">
            ${escapeHtml(name)}
          </button>
        `;
        resultsList.appendChild(li);
      });

      resultsList.querySelectorAll('.place-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const place = {
            name: btn.getAttribute('data-name'),
            lat: parseFloat(btn.getAttribute('data-lat')),
            lon: parseFloat(btn.getAttribute('data-lon'))
          };
          await loadPlace(place, { from: 'search' });
          showScreen('home');
          // clear results
          resultsList.remove();
        });
      });

    } catch (e) {
      resultsList.innerHTML = '<li class="muted">Search failed. Try again.</li>';
    }
  }

  // ---------- SAVE CURRENT ----------
  function saveCurrentPlace() {
    if (!currentLoc) return;
    const favs = loadFavs();
    const exists = favs.some(p => p.lat === currentLoc.lat && p.lon === currentLoc.lon);
    if (exists) {
      showToast("Already saved.");
      return;
    }
    favs.unshift(currentLoc);
    saveFavs(favs);
    renderFavs();
    showToast("Saved.");
  }

  // ---------- MANAGE FAVORITES ----------
  let manageMode = false;
  function toggleManageFavorites() {
    manageMode = !manageMode;
    body.classList.toggle('manage-favs', manageMode);
    showToast(manageMode ? "Manage mode on" : "Manage mode off");
  }

  // ---------- NAV ----------
  navHome?.addEventListener('click', () => {
    // IMPORTANT: Home returns to GEOLOCATION
    loadHomeFromGeo();
  });

  navHourly?.addEventListener('click', () => showScreen('hourly'));
  navWeek?.addEventListener('click', () => showScreen('week'));
  navSearch?.addEventListener('click', () => {
    renderFavs();
    renderRecents();
    showScreen('search');
  });
  navSettings?.addEventListener('click', () => showScreen('settings'));

  // ---------- SETTINGS EVENTS ----------
  unitsSelect?.addEventListener('change', () => {
    settings.units = unitsSelect.value === 'F' ? 'F' : 'C';
    saveSettings();
    applySettingsToUI();
    // Re-render current data immediately
    if (currentLoc) loadPlace(currentLoc, { from: 'settings' });
  });

  themeSelect?.addEventListener('change', () => {
    settings.theme = ['auto','light','dark'].includes(themeSelect.value) ? themeSelect.value : 'auto';
    saveSettings();
    applyTheme();
  });

  // ---------- SEARCH EVENTS ----------
  searchInput?.addEventListener('keyup', async (e) => {
    if (e.key !== 'Enter') return;
    const q = searchInput.value.trim();
    if (!q) return;
    await doSearch(q);
  });

  // ---------- FAVORITES EVENTS ----------
  saveCurrentBtn?.addEventListener('click', saveCurrentPlace);
  manageFavoritesBtn?.addEventListener('click', toggleManageFavorites);

  // ---------- INIT ----------
  renderFavs();
  renderRecents();
  showScreen('home');
  initGeolocation();

  // ---------- PWA REGISTER ----------
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
});

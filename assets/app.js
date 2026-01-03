document.addEventListener("DOMContentLoaded", () => {
  const $ = (sel) => document.querySelector(sel);

  const locationEl = $('#location');
  const headlineEl = $('#headline');
  const tempEl = $('#temp');
  const descriptionEl = $('#description');
  const extremeValueEl = $('#extremeValue');
  const rainValueEl = $('#rainValue');
  const uvValueEl = $('#uvValue');
  const confidenceEl = $('#confidence');
  const sourcesEl = $('#sources');
  const bgImg = $('#bgImg');
  const confidenceBarEl = $('#confidenceBar');
  const particlesEl = $('#particles');
  const loader = $('#loader');
  const toast = $('#toast');

  const navHome = $('#navHome');
  const navHourly = $('#navHourly');
  const navWeek = $('#navWeek');
  const navSearch = $('#navSearch');
  const navSettings = $('#navSettings');

  const screenHome = $('#home-screen');
  const screenHourly = $('#hourly-screen');
  const screenWeek = $('#week-screen');
  const screenSearch = $('#search-screen');
  const screenSettings = $('#settings-screen');

  const hourlyTimeline = $('#hourly-timeline');
  const dailyCards = $('#daily-cards');

  const searchInput = $('#searchInput');
  const searchCancel = $('#searchCancel');
  const favoritesList = $('#favoritesList');
  const recentList = $('#recentList');
  const manageFavorites = $('#manageFavorites');
  const favLimit = $('#favLimit');

  const unitsTemp = $('#unitsTemp');
  const unitsWind = $('#unitsWind');
  const probRange = $('#probRange');
  const timeFormat = $('#timeFormat');
  const languagePlain = document.querySelector('input[name="language"][value="plain"]');
  const languageHuman = document.querySelector('input[name="language"][value="human"]');

  const STORAGE = {
    unitsTemp: "pw_units_temp",
    unitsWind: "pw_units_wind",
    probRange: "pw_prob_range",
    timeFormat: "pw_time_format",
    language: "pw_language",
    favorites: "pw_favorites",
    recents: "pw_recents",
    home: "pw_home_place"
  };

  const SCREENS = [screenHome, screenHourly, screenWeek, screenSearch, screenSettings];

  let activePlace = null;
  let homePlace = null;
  let lastPayload = null;
  let isHumanLanguage = loadJSON(STORAGE.language, true);
  let showProbRange = loadJSON(STORAGE.probRange, false);

  const safeText = (el, txt) => { if (el) el.textContent = txt ?? "--"; };
  const isNum = (v) => typeof v === "number" && Number.isFinite(v);

  function round0(n) { return isNum(n) ? Math.round(n) : null; }

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }
  function saveJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }

  function samePlace(a, b) {
    if (!a || !b) return false;
    return Number(a.lat).toFixed(4) === Number(b.lat).toFixed(4) &&
           Number(a.lon).toFixed(4) === Number(b.lon).toFixed(4);
  }

  function showScreen(which) {
    SCREENS.forEach(s => s.classList.add("hidden"));
    which.classList.remove("hidden");
  }

  function showLoader(show) {
    loader.classList[show ? 'remove' : 'add']('hidden');
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function hashString(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
    return h | 0;
  }

  function suntimes(lat, lng) {
    var d = new Date();
    var radians = Math.PI / 180.0;
    var degrees = 180.0 / Math.PI;

    var a = Math.floor((14 - (d.getMonth() + 1.0)) / 12);
    var y = d.getFullYear() + 4800 - a;
    var m = (d.getMonth() + 1) + 12 * a - 3;
    var j_day = d.getDate() + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
    var n_star = j_day - 2451545.0009 - lng / 360.0;
    var n = Math.floor(n_star + 0.5);
    var solar_noon = 2451545.0009 - lng / 360.0 + n;
    var M = 356.0470 + 0.9856002585 * n;
    var C = 1.9148 * Math.sin(M * radians) + 0.02 * Math.sin(2 * M * radians) + 0.0003 * Math.sin(3 * M * radians);
    var L = (M + 102.9372 + C + 180) % 360;
    var j_transit = solar_noon + 0.0053 * Math.sin(M * radians) - 0.0069 * Math.sin(2 * L * radians);
    var D = Math.asin(Math.sin(L * radians) * Math.sin(23.45 * radians)) * degrees;
    var cos_omega = (Math.sin(-0.83 * radians) - Math.sin(lat * radians) * Math.sin(D * radians)) / (Math.cos(lat * radians) * Math.cos(D * radians));

    if (cos_omega > 1) return [null, -1]; // sun never rises
    if (cos_omega < -1) return [-1, null]; // sun never sets

    var omega = Math.acos(cos_omega) * degrees;
    var j_set = j_transit + omega / 360.0;
    var j_rise = j_transit - omega / 360.0;

    var utc_time_set = 24 * (j_set - j_day) + 12;
    var utc_time_rise = 24 * (j_rise - j_day) + 12;
    var tz_offset = -1 * d.getTimezoneOffset() / 60;
    var local_rise = (utc_time_rise + tz_offset) % 24;
    var local_set = (utc_time_set + tz_offset) % 24;
    return [local_rise, local_set];
  }

  function setBackgroundFor(dp, rainPct, maxC, low, wind) {
    const base = "assets/images/bg";
    let folder = "clear";

    const dpl = String(dp || "").toLowerCase();

    if (isNum(low) && low < 10) folder = "cold";
    else if (isNum(wind) && wind > 30) folder = "wind";
    else if (dpl.includes("fog") || dpl.includes("mist") || dpl.includes("haze")) folder = "fog";
    else if (dpl.includes("storm") || dpl.includes("thunder") || dpl.includes("lightning")) folder = "storm";
    else if (dpl.includes("cloud") || dpl.includes("overcast")) folder = "cloudy";
    else if (isNum(rainPct) && rainPct >= 60) folder = "rain";
    else if (isNum(maxC) && maxC >= 32) folder = "heat";
    else folder = "clear";

    const [rise, set] = suntimes(activePlace.lat, activePlace.lon);
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;

    let timeOfDay = 'day';
    if (rise !== null && set !== null) {
      if (currentHour < rise || currentHour > set) timeOfDay = 'night';
      else if (Math.abs(currentHour - rise) < 1.5) timeOfDay = 'dawn';
      else if (Math.abs(currentHour - set) < 1.5) timeOfDay = 'dusk';
      else timeOfDay = 'day';
    } else {
      timeOfDay = rise === null ? 'night' : 'day';
    }

    const path = `${base}/${folder}/${timeOfDay}.jpg`;

    if (bgImg) {
      bgImg.src = path;
      bgImg.onerror = () => console.error(`Background image failed to load: ${path} - Check if file exists in repo (e.g., assets/images/bg/${folder}/${timeOfDay}.jpg).`);
    }

    document.body.className = `weather-${folder}`;
  }

  function createParticles(folder, count = 20) {
    if (!particlesEl) return;
    particlesEl.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      particle.classList.add('particle');
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.animationDuration = `${Math.random() * 3 + 2}s`;
      particle.style.animationDelay = `${Math.random() * 2}s`;
      particlesEl.appendChild(particle);
    }
  }

  function isWeekendLocal() {
    const d = new Date();
    const day = d.getDay();
    return day === 0 || day === 5 || day === 6;
  }

  function pickWittyLine(rainPct, maxC, dp) {
    const dpl = String(dp || "").toLowerCase();
    const hot = isNum(maxC) && maxC >= 30;

    if (isWeekendLocal() && (isNum(rainPct) ? rainPct < 25 : true) && !dpl.includes("storm") && !dpl.includes("rain")) {
      return "Braai weather, boet!";
    }

    if (dpl.includes("storm") || dpl.includes("thunder")) return "Electric vibes. Don’t be the tallest thing outside.";
    if (dpl.includes("fog") || dpl.includes("mist")) return "Misty mayhem—can't see your braai from the stoep!";
    if (isNum(rainPct) && rainPct >= 70) return "The clouds are crying like NZ at the '23 World Cup!";
    if (isNum(rainPct) && rainPct >= 40) return "Keep a jacket close.";
    if (hot) return "Frying an egg is a real option.";
    if (dpl.includes("cloud")) return "Soft light, no drama. Take the win.";
    if (dpl.includes("cold")) return "Time to build a snowman.";
    if (dpl.includes("wind")) return "Windy dawn—hairdo beware!";
    return "Good day to get stuff done outside.";
  }

  function computeAgreementFromNorms(norms) {
    const temps = norms.map(n => n.nowTemp).filter(isNum);
    if (temps.length < 2) {
      return { label: temps.length === 1 ? "DECENT" : "—", explain: temps.length === 1 ? "Only one source responded." : "No sources responded." };
    }

    const min = Math.min(...temps);
    const max = Math.max(...temps);
    const spread = max - min;

    if (spread <= 1.5) return { label: "STRONG", explain: "All sources line up closely." };
    if (spread <= 3.5) return { label: "DECENT", explain: "Two sources agree, one’s a bit off." };
    return { label: "MIXED", explain: "Sources disagree today; we’re showing the most probable middle-ground." };
  }

  async function fetchProbable(place) {
    const url = `/api/weather?lat=${encodeURIComponent(place.lat)}&lon=${encodeURIComponent(place.lon)}&name=${encodeURIComponent(place.name || '')}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('API error');
    return await response.json();
  }

  function normalizePayload(payload) {
    if (Array.isArray(payload.norms)) {
      const norms = payload.norms;
      const medNow = median(norms.map(n => n.nowTemp).filter(isNum));
      const medHigh = median(norms.map(n => n.todayHigh).filter(isNum));
      const medLow = median(norms.map(n => n.todayLow).filter(isNum));
      const medRain = median(norms.map(n => n.todayRain).filter(isNum));
      const medUv = median(norms.map(n => n.todayUv).filter(isNum));
      const mostDesc = pickMostCommon(norms.map(n => n.desc).filter(Boolean)) || 'Weather today';
      const medWind = median(norms.map(n => n.wind).filter(isNum));

      return {
        nowTemp: medNow,
        todayHigh: medHigh,
        todayLow: medLow,
        rainPct: medRain,
        uv: medUv,
        desc: mostDesc,
        wind: medWind,
        agreement: computeAgreementFromNorms(norms),
        used: payload.used || [],
        failed: payload.failed || [],
        countUsed: norms.length,
        hourly: payload.hourly || [],
        daily: payload.daily || [],
      };
    }
    return {
      nowTemp: payload.now?.temp ?? null,
      todayHigh: payload.today?.high ?? null,
      todayLow: payload.today?.low ?? null,
      rainPct: payload.today?.rainPct ?? null,
      uv: payload.today?.uv ?? null,
      desc: payload.today?.desc ?? 'Weather today',
      wind: payload.today?.wind ?? null,
      agreement: payload.agreement || { label: '—', explain: '' },
      used: payload.sources?.used || [],
      failed: payload.sources?.failed || [],
      countUsed: payload.sources?.countUsed || 0,
      hourly: payload.hourly || [],
      daily: payload.daily || [],
    };
  }

  function renderLoading(name) {
    showLoader(true);
    safeText(locationEl, name);
    safeText(headlineEl, 'Loading...');
    safeText(tempEl, '--°');
    safeText(descriptionEl, '—');
    safeText(extremeValueEl, '--');
    safeText(rainValueEl, '--');
    safeText(uvValueEl, '--');
    safeText(confidenceEl, 'PROBABLY • —');
    safeText(sourcesEl, 'Sources: —');
    if (confidenceBarEl) confidenceBarEl.style.width = '0%';
  }

  function renderError(msg) {
    showLoader(false);
    safeText(headlineEl, 'Error');
    safeText(descriptionEl, msg);
  }

  function renderHome(norm) {
    showLoader(false);

    const hi = norm.todayHigh;
    const low = norm.todayLow;
    const rain = norm.rainPct;
    const uv = norm.uv;
    const desc = norm.desc;
    const wind = norm.wind;
    const condition = getConditionFromDesc(desc);

    safeText(locationEl, activePlace.name + ', ZA' || '—');
    safeText(headlineEl, `This is ${condition}.`);
    safeText(tempEl, `${round0(low)}–${round0(hi)}°`);
    safeText(descriptionEl, isHumanLanguage ? pickWittyLine(rain, hi, desc) : 'Standard weather description.');

    safeText(extremeValueEl, isNum(hi) && hi > 35 ? 'Heat' : isNum(low) && low < 10 ? 'Cold' : 'Clear');

    safeText(rainValueEl, rain >= 60 ? 'Heavy rain expected' : rain >= 40 ? 'Steady showers' : 'Probably none today');

    safeText(uvValueEl, uv > 8 ? 'Very high (' + round0(uv) + ')' : uv > 5 ? 'Moderate (' + round0(uv) + ')' : 'Low (' + round0(uv) + ')');

    const label = norm.agreement.label.toUpperCase();
    safeText(confidenceEl, `PROBABLY • ${label}`);
    safeText(confidenceValueEl, `${label} Based on 3 sources →`);

    if (confidenceBarEl) {
      const width = label === "STRONG" ? '100%' : label === "DECENT" ? '70%' : '40%';
      confidenceBarEl.style.width = width;
    }

    const usedTxt = norm.used.length ? `Used: ${norm.used.join(", ")}` : "Used: —";
    const failedTxt = norm.failed.length ? `Failed: ${norm.failed.join(", ")}` : "";
    safeText(sourcesEl, `${usedTxt}${failedTxt ? " · " + failedTxt : ""}`);

    setBackgroundFor(desc, rain, hi, low, wind);
    createParticles('cloudy');
  }

  function loadAndRender(place) {
    activePlace = place;
    renderLoading(place.name || 'My Location');
    fetchProbable(place).then(payload => {
      lastPayload = payload;
      const norm = normalizePayload(payload);
      renderHome(norm);
      renderHourly(norm.hourly);
      renderWeek(norm.daily);
    }).catch(e => {
      console.error("Load failed:", e);
      renderError("Couldn’t fetch weather right now.");
    });
  }

  // ... (Add full search, settings listeners, etc. from previous)

  // Init
  unitsTemp.value = loadJSON(STORAGE.unitsTemp, 'C');
  unitsWind.value = loadJSON(STORAGE.unitsWind, 'kmh');
  probRange.checked = showProbRange;
  timeFormat.value = loadJSON(STORAGE.timeFormat, '24');
  if (isHumanLanguage) languageHuman.checked = true;
  else languagePlain.checked = true;

  // Listeners for settings...
  unitsTemp.addEventListener('change', () => saveJSON(STORAGE.unitsTemp, unitsTemp.value));
  // Similar for others, rerender if needed

  // Full search logic...
  async function runSearch(q) {
    if (!q || q.trim().length < 2) return;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=8`;
    const data = await (await fetch(url)).json();
    const ul = document.createElement('ul');
    data.forEach(r => {
      const li = document.createElement('li');
      li.textContent = r.display_name;
      li.addEventListener('click', () => {
        const p = { name: r.display_name, lat: r.lat, lon: r.lon };
        addRecent(p);
        showScreen(screenHome);
        loadAndRender(p);
      });
      ul.appendChild(li);
    });
    // Append ul to search-screen below input
  }

  // Favorites with temps - fetch mini data for each
  function renderFavorites() {
    const list = loadFavorites();
    favoritesList.innerHTML = '';
    list.forEach(p => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="star">★</span> ${p.name} <span class="mini-temp">--°</span> <span class="mini-icon">--</span>`;
      favoritesList.appendChild(li);
      // Fetch mini
      fetchProbable(p).then(norm => {
        li.querySelector('.mini-temp').textContent = `${round0(norm.nowTemp)}°`;
        li.querySelector('.mini-icon').textContent = getIcon(norm);
      });
    });
    if (list.length >= 5) favLimit.textContent = "You've saved 5 places. Remove one to add a new favourite.";
  }

  // Similar for recents

  // Icon helper
  function getIcon(h) {
    // Return emoji based on desc/temp/rain
    return '☁️'; // Placeholder
  }

  // Rest of init, nav listeners, etc.
});
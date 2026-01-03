document.addEventListener("DOMContentLoaded", () => {
  // -------------------- DOM --------------------
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
  const saveCurrentBtn = $('#saveCurrent');
  const confidenceBarEl = $('#confidenceBar');
  const particlesEl = $('#particles');

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
  const favoritesList = $('#favoritesList');
  const recentList = $('#recentList');
  const manageFavorites = $('#manageFavorites');

  const loader = $('#loader');

  // -------------------- State --------------------
  const STORAGE = {
    units: "pw_units",           
    theme: "pw_theme",           
    favorites: "pw_favorites",   
    recents: "pw_recents",       
    home: "pw_home_place"        
  };

  const SCREENS = [screenHome, screenHourly, screenWeek, screenSearch, screenSettings];

  let activePlace = null;
  let homePlace = null;
  let lastPayload = null;

  // -------------------- Helpers --------------------
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

  // -------------------- Sunrise/Sunset Calculation --------------------
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

  // -------------------- Backgrounds --------------------
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

    // Get time of day
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
      timeOfDay = rise === null ? 'night' : 'day'; // Polar day/night
    }

    const path = `${base}/${folder}/${timeOfDay}.jpg`;

    if (bgImg) {
      bgImg.src = path;
      bgImg.onerror = () => console.error(`Background image failed to load: ${path} - Check if file exists in repo (e.g., assets/images/bg/${folder}/${timeOfDay}.jpg).`);
    }

    document.body.className = `weather-${folder}`;
  }

  // -------------------- Particles --------------------
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

  // -------------------- Witty Line --------------------
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
    if (dpl.includes("fog") || dpl.includes("mist")) return "Visibility vibes: drive like you’ve got a gran in the back.";
    if (isNum(rainPct) && rainPct >= 70) return "Plan indoors — today’s moody.";
    if (isNum(rainPct) && rainPct >= 40) return "Keep a jacket close.";
    if (hot) return "Big heat — pace yourself outside.";
    if (dpl.includes("cloud") || dpl.includes("overcast")) return "Soft light, no drama. Take the win.";
    return "Good day to get stuff done outside.";
  }

  // -------------------- Agreement --------------------
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

  // -------------------- API Fetch --------------------
  async function fetchProbable(place) {
    const url = `/api/weather?lat=${encodeURIComponent(place.lat)}&lon=${encodeURIComponent(place.lon)}&name=${encodeURIComponent(place.name || '')}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('API error');
    return await response.json();
  }

  // -------------------- Normalize Payload --------------------
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

  // -------------------- Render Functions --------------------
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

    safeText(locationEl, activePlace.name || '—');
    safeText(headlineEl, desc);
    safeText(tempEl, `${round0(low)}° - ${round0(hi)}°`);
    safeText(descriptionEl, pickWittyLine(rain, hi, desc));

    safeText(extremeValueEl, isNum(hi) && hi > 35 ? 'Scorching hot' : isNum(low) && low < 0 ? 'Freezing cold' : 'Mild');

    if (isNum(rain)) {
      const rp = round0(rain);
      safeText(rainValueEl, `${rp}% (${rp >= 40 ? "Possible rain" : "Low chance"})`);
    } else safeText(rainValueEl, '--');

    if (isNum(uv)) safeText(uvValueEl, `${round0(uv)}`);
    else safeText(uvValueEl, '--');

    const label = (norm.agreement?.label || "—").toUpperCase();
    const agreeWord = label === "STRONG" ? "STRONG AGREEMENT" : label === "DECENT" ? "DECENT AGREEMENT" : label === "MIXED" ? "MIXED AGREEMENT" : "—";
    safeText(confidenceEl, `PROBABLY • ${agreeWord}`);

    if (confidenceBarEl) {
      const width = label === "STRONG" ? '100%' : label === "DECENT" ? '70%' : label === "MIXED" ? '40%' : '0%';
      confidenceBarEl.style.width = width;
    }

    const usedTxt = norm.used.length ? `Used: ${norm.used.join(", ")}` : "Used: —";
    const failedTxt = norm.failed.length ? `Failed: ${norm.failed.join(", ")}` : "";
    safeText(sourcesEl, `${usedTxt}${failedTxt ? " · " + failedTxt : ""}`);

    setBackgroundFor(desc, rain, hi, low, wind);
    createParticles('cloudy'); // Update based on folder if needed
  }

  function renderHourly(hourly) {
    if (!hourlyTimeline) return;
    hourlyTimeline.innerHTML = '';
    hourly.forEach((h, i) => {
      const div = document.createElement('div');
      div.classList.add('hourly-card');
      const hourTime = new Date(Date.now() + i * 3600000).toLocaleTimeString([], { hour: 'numeric', hour12: true });
      div.innerHTML = `
        <div class="hour-time">${hourTime}</div>
        <div class="hour-temp">${round0(h.temp)}°</div>
        <div class="hour-rain">${round0(h.rain)}%</div>
      `;
      hourlyTimeline.appendChild(div);
    });
  }

  function renderWeek(daily) {
    if (!dailyCards) return;
    dailyCards.innerHTML = '';
    daily.forEach((d, i) => {
      const date = new Date(Date.now() + i * 86400000);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const div = document.createElement('div');
      div.classList.add('daily-card');
      div.innerHTML = `
        <div class="day-name">${dayName}</div>
        <div class="day-temp">${round0(d.low)}° - ${round0(d.high)}°</div>
        <div class="day-rain">${round0(d.rain)}%</div>
        <div class="day-humor">${d.desc}</div>
      `;
      dailyCards.appendChild(div);
    });
  }

  // -------------------- Main flow --------------------
  async function loadAndRender(place) {
    activePlace = place;
    renderLoading(place.name || 'My Location');
    try {
      const payload = await fetchProbable(place);
      lastPayload = payload;
      const norm = normalizePayload(payload);
      renderHome(norm);
      renderHourly(norm.hourly);
      renderWeek(norm.daily);
    } catch (e) {
      console.error("Load failed:", e);
      renderError("Couldn’t fetch weather right now.");
    }
  }

  // -------------------- Places --------------------
  function loadFavorites() { return loadJSON(STORAGE.favorites, []); }
  function loadRecents() { return loadJSON(STORAGE.recents, []); }

  function saveFavorites(list) { saveJSON(STORAGE.favorites, list); }
  function saveRecents(list) { saveJSON(STORAGE.recents, list); }

  function addRecent(place) {
    let list = loadRecents().filter(p => !samePlace(p, place));
    list.unshift(place);
    saveRecents(list.slice(0, 10));
    renderRecents();
  }

  function addFavorite(place) {
    let list = loadFavorites();
    if (list.some(p => samePlace(p, place)) ) return;
    list.unshift(place);
    saveFavorites(list.slice(0, 5));
    renderFavorites();
  }

  function renderRecents() {
    if (!recentList) return;
    const list = loadRecents();
    recentList.innerHTML = list.map(p => `
      <li data-lat="${p.lat}" data-lon="${p.lon}" data-name="${escapeHtml(p.name)}">${escapeHtml(p.name)}</li>
    `).join('') || '<li>No recent searches yet.</li>';

    recentList.querySelectorAll('li').forEach(li => {
      li.addEventListener('click', () => {
        const p = { name: li.dataset.name, lat: parseFloat(li.dataset.lat), lon: parseFloat(li.dataset.lon) };
        addRecent(p);
        showScreen(screenHome);
        loadAndRender(p);
      });
    });
  }

  function renderFavorites() {
    if (!favoritesList) return;
    const list = loadFavorites();
    favoritesList.innerHTML = list.map(p => `
      <li data-lat="${p.lat}" data-lon="${p.lon}" data-name="${escapeHtml(p.name)}">${escapeHtml(p.name)}</li>
    `).join('') || '<li>No saved places yet.</li>';

    favoritesList.querySelectorAll('li').forEach(li => {
      li.addEventListener('click', () => {
        const p = { name: li.dataset.name, lat: parseFloat(li.dataset.lat), lon: parseFloat(li.dataset.lon) };
        showScreen(screenHome);
        loadAndRender(p);
      });
    });
  }

  function escapeHtml(s) {
    return String(s ?? "").replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  // -------------------- Search --------------------
  async function runSearch(q) {
    if (!q || q.trim().length < 2) return;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=8`;
    try {
      const data = await (await fetch(url)).json();
      console.log('Search results:', data);
    } catch (e) {
      console.error(e);
    }
  }

  // -------------------- Buttons --------------------
  navHome.addEventListener('click', () => {
    showScreen(screenHome);
    if (homePlace) loadAndRender(homePlace);
  });
  navHourly.addEventListener('click', () => {
    showScreen(screenHourly);
    if (lastPayload) renderHourly(normalizePayload(lastPayload).hourly);
  });
  navWeek.addEventListener('click', () => {
    showScreen(screenWeek);
    if (lastPayload) renderWeek(normalizePayload(lastPayload).daily);
  });
  navSearch.addEventListener('click', () => {
    showScreen(screenSearch);
    renderRecents();
    renderFavorites();
  });
  navSettings.addEventListener('click', () => showScreen(screenSettings));

  saveCurrentBtn.addEventListener('click', () => {
    if (activePlace) addFavorite(activePlace);
  });

  if (searchInput) searchInput.addEventListener('input', () => runSearch(searchInput.value));

  // -------------------- Init --------------------
  renderRecents();
  renderFavorites();

  homePlace = loadJSON(STORAGE.home, null);
  if (homePlace) {
    loadAndRender(homePlace);
  } else if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        homePlace = { name: 'My Location', lat: pos.coords.latitude, lon: pos.coords.longitude };
        saveJSON(STORAGE.home, homePlace);
        loadAndRender(homePlace);
      },
      () => {
        homePlace = { name: "Cape Town", lat: -33.9249, lon: 18.4241 };
        saveJSON(STORAGE.home, homePlace);
        loadAndRender(homePlace);
      }
    );
  } else {
    homePlace = { name: "Cape Town", lat: -33.9249, lon: 18.4241 };
    saveJSON(STORAGE.home, homePlace);
    loadAndRender(homePlace);
  }

  // Helpers
  function median(values) {
    if (values.length === 0) return null;
    values.sort((a, b) => a - b);
    const half = Math.floor(values.length / 2);
    return values.length % 2 ? values[half] : (values[half - 1] + values[half]) / 2.0;
  }

  function pickMostCommon(arr) {
    if (arr.length === 0) return null;
    const count = arr.reduce((acc, v) => ({ ...acc, [v]: (acc[v] || 0) + 1 }), {});
    return Object.keys(count).reduce((a, b) => count[a] > count[b] ? a : b);
  }
});
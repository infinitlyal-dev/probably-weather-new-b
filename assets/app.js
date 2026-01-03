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
  const saveCurrent = $('#saveCurrent');
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

  const STORAGE = "pw_";
  const SCREENS = [screenHome, screenHourly, screenWeek, screenSearch, screenSettings];

  let activePlace = null;
  let homePlace = null;
  let lastPayload = null;

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

  function hashString(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
    return h | 0;
  }

  function setBackgroundFor(dp, rainPct, maxC) {
    const base = "assets/images/bg";
    let folder = "clear";

    const dpl = String(dp || "").toLowerCase();

    if (dpl.includes("fog") || dpl.includes("mist") || dpl.includes("haze")) folder = "fog";
    else if (dpl.includes("storm") || dpl.includes("thunder") || dpl.includes("lightning")) folder = "storm";
    else if (dpl.includes("cloud") || dpl.includes("overcast")) folder = "cloudy";
    else if (isNum(rainPct) && rainPct >= 60) folder = "rain";
    else if (isNum(maxC) && maxC >= 32) folder = "heat";
    else folder = "clear";

    const n = 1 + (Math.abs(hashString((dp || "") + String(maxC || ""))) % 4);
    const path = `${base}/${folder}/${folder}${n}.jpg`;

    if (bgImg) bgImg.src = path;
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
    if (dpl.includes("fog") || dpl.includes("mist")) return "Visibility vibes: drive like you’ve got a gran in the back.";
    if (isNum(rainPct) && rainPct >= 70) return "Plan indoors — today’s moody.";
    if (isNum(rainPct) && rainPct >= 40) return "Keep a jacket close.";
    if (hot) return "Big heat — pace yourself outside.";
    if (dpl.includes("cloud")) return "Soft light, no drama. Take the win.";
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

      return {
        nowTemp: medNow,
        todayHigh: medHigh,
        todayLow: medLow,
        rainPct: medRain,
        uv: medUv,
        desc: mostDesc,
        agreement: computeAgreementFromNorms(norms),
        used: payload.used || [],
        failed: payload.failed || [],
        countUsed: norms.length,
        hourly: payload.hourly || [],
        daily: payload.daily || [],
      };
    }
    // Fallback for other shape (from summary)
    return {
      nowTemp: payload.now?.temp ?? null,
      todayHigh: payload.today?.high ?? null,
      todayLow: payload.today?.low ?? null,
      rainPct: payload.today?.rainPct ?? null,
      uv: payload.today?.uv ?? null,
      desc: payload.today?.desc ?? 'Weather today',
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
    safeText(confidenceEl, `PROBABLY . ${label} AGREEMENT`);

    const usedTxt = norm.used.length ? `Used: ${norm.used.join(", ")}` : "Used: —";
    const failedTxt = norm.failed.length ? `Failed: ${norm.failed.join(", ")}` : "";
    safeText(sourcesEl, `${usedTxt}${failedTxt ? " · " + failedTxt : ""}`);

    setBackgroundFor(desc, rain, hi);
    createParticles('cloudy');
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

  // Places: recents/favorites
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
    if (list.some(p => samePlace(p, place))) return;
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

  // Search
  async function runSearch(q) {
    if (!q || q.trim().length < 2) return;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=8`;
    try {
      const data = await (await fetch(url)).json();
      // Render results
      console.log(data); // TODO: Add search results rendering to #search-screen
    } catch (e) {
      console.error(e);
    }
  }

  // Buttons / Nav
  navHome.addEventListener('click', () => {
    showScreen(screenHome);
    if (homePlace) loadAndRender(homePlace);
  });
  navHourly.addEventListener('click', () => showScreen(screenHourly));
  navWeek.addEventListener('click', () => showScreen(screenWeek));
  navSearch.addEventListener('click', () => {
    showScreen(screenSearch);
    renderRecents();
    renderFavorites();
  });
  navSettings.addEventListener('click', () => showScreen(screenSettings));

  saveCurrent.addEventListener('click', () => {
    if (activePlace) addFavorite(activePlace);
  });

  // Init
  renderRecents();
  renderFavorites();

  homePlace = loadJSON(STORAGE.home, null);
  if (homePlace) {
    showScreen(screenHome);
    loadAndRender(homePlace);
  } else {
    // Geolocation
    showScreen(screenHome);
    renderLoading("My Location");

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = round1(pos.coords.latitude);
          const lon = round1(pos.coords.longitude);
          homePlace = { name: "My Location", lat, lon };
          saveJSON(STORAGE.home, homePlace);
          loadAndRender(homePlace);
        },
        () => {
          // fallback: Cape Town
          homePlace = { name: "Cape Town", lat: -33.9249, lon: 18.4241 };
          saveJSON(STORAGE.home, homePlace);
          loadAndRender(homePlace);
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
      );
    } else {
      homePlace = { name: "Cape Town", lat: -33.9249, lon: 18.4241 };
      saveJSON(STORAGE.home, homePlace);
      loadAndRender(homePlace);
    }
  }

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
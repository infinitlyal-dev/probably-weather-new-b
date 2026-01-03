document.addEventListener('DOMContentLoaded', () => {
  /* =========================================================
     Probably Weather — Stable Frontend (API proxy edition)
     - No client-side API keys
     - /api/weather returns normalized + proof
     - Defensive rendering (no "haywire" crashes)
     ========================================================= */

  // ---------- DOM ----------
  const bgImg = document.getElementById('bgImg');
  const locationEl = document.getElementById('location');
  const headlineEl = document.getElementById('headline');
  const tempEl = document.getElementById('temp');
  const descEl = document.getElementById('description');

  const confidenceEl = document.getElementById('confidence');
  const sourcesEl = document.getElementById('sources');

  const extremeValueEl = document.getElementById('extremeValue');
  const rainValueEl = document.getElementById('rainValue');
  const uvValueEl = document.getElementById('uvValue');
  const confidenceValueEl = document.getElementById('confidenceValue');
  const confidenceBarEl = document.getElementById('confidenceBar');

  const hourlyTimeline = document.getElementById('hourly-timeline');
  const dailyCards = document.getElementById('daily-cards');

  const loader = document.getElementById('loader');
  const toast = document.getElementById('toast');

  const navHome = document.getElementById('navHome');
  const navHourly = document.getElementById('navHourly');
  const navWeek = document.getElementById('navWeek');
  const navSearch = document.getElementById('navSearch');
  const navSettings = document.getElementById('navSettings');

  const homeScreen = document.getElementById('home-screen');
  const hourlyScreen = document.getElementById('hourly-screen');
  const weekScreen = document.getElementById('week-screen');
  const searchScreen = document.getElementById('search-screen');
  const settingsScreen = document.getElementById('settings-screen');

  const searchInput = document.getElementById('searchInput');
  const favoritesList = document.getElementById('favoritesList');
  const recentList = document.getElementById('recentList');
  const saveCurrentBtn = document.getElementById('saveCurrent');
  const manageFavoritesBtn = document.getElementById('manageFavorites');

  const unitsSelect = document.getElementById('units');
  const themeSelect = document.getElementById('theme');

  // ---------- STATE ----------
  const STORAGE_KEYS = {
    favorites: 'pw_favorites_v1',
    recents: 'pw_recents_v1',
    settings: 'pw_settings_v2',
    geoHome: 'pw_geo_home_v1',
  };

  const settings = loadSettings();
  applySettingsToUI();

  let geoHome = loadGeoHome(); // {lat, lon, name}
  let currentPlace = null;     // {lat, lon, name}
  let lastPayload = null;
  let managingFavorites = false;

  // ---------- UTILS ----------
  function isNum(v) {
    return typeof v === 'number' && !Number.isNaN(v);
  }

  function roundTempC(vC) {
    if (!isNum(vC)) return null;
    if (settings.units === 'F') return Math.round((vC * 9/5) + 32);
    return Math.round(vC);
  }

  function formatTemp(vC) {
    const v = roundTempC(vC);
    return isNum(v) ? `${v}°` : '--';
  }

  function showLoader(on) {
    loader.classList.toggle('hidden', !on);
  }

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function safeText(el, txt) {
    if (el) el.textContent = txt ?? '—';
  }

  function showScreen(which) {
    homeScreen.classList.toggle('hidden', which !== 'home');
    hourlyScreen.classList.toggle('hidden', which !== 'hourly');
    weekScreen.classList.toggle('hidden', which !== 'week');
    searchScreen.classList.toggle('hidden', which !== 'search');
    settingsScreen.classList.toggle('hidden', which !== 'settings');
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.settings);
      const s = raw ? JSON.parse(raw) : {};
      return {
        units: s.units === 'F' ? 'F' : 'C',
        theme: (s.theme === 'light' || s.theme === 'dark') ? s.theme : 'auto',
      };
    } catch {
      return { units: 'C', theme: 'auto' };
    }
  }

  function applySettingsToUI() {
    if (unitsSelect) unitsSelect.value = settings.units;
    if (themeSelect) themeSelect.value = settings.theme;
    applyTheme();
  }

  function applyTheme() {
    // Keep simple: auto = system
    document.documentElement.dataset.theme = settings.theme;
  }

  function loadGeoHome() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.geoHome);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveGeoHome(place) {
    geoHome = place;
    localStorage.setItem(STORAGE_KEYS.geoHome, JSON.stringify(place));
  }

  function loadFavorites() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.favorites) || '[]');
    } catch {
      return [];
    }
  }

  function saveFavorites(list) {
    localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(list));
  }

  function loadRecents() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.recents) || '[]');
    } catch {
      return [];
    }
  }

  function saveRecents(list) {
    localStorage.setItem(STORAGE_KEYS.recents, JSON.stringify(list));
  }

  function addRecent(place) {
    const list = loadRecents().filter(p => !(samePlace(p, place)));
    list.unshift(place);
    saveRecents(list.slice(0, 10));
    renderRecents();
  }

  function samePlace(a, b) {
    if (!a || !b) return false;
    return Number(a.lat).toFixed(4) === Number(b.lat).toFixed(4) &&
           Number(a.lon).toFixed(4) === Number(b.lon).toFixed(4);
  }

  function dayNameFromDatePart(dp) {
    // dp = YYYY-MM-DD
    const d = new Date(`${dp}T12:00:00`);
    return d.toLocaleDateString(undefined, { weekday: 'short' });
  }

  function isWeekend(dp) {
    const d = new Date(`${dp}T12:00:00`);
    const day = d.getDay(); // 0 Sun ... 6 Sat
    return day === 0 || day === 5 || day === 6; // Sun/Fri/Sat
  }

  function rainWord(rainPct) {
    if (!isNum(rainPct)) return '—';
    if (rainPct >= 70) return 'High chance';
    if (rainPct >= 40) return 'Possible rain';
    if (rainPct >= 20) return 'Small chance';
    return 'Low chance';
  }

  // ---------- HUMOUR RULES ----------
  function dailyLine(dp, rainPct, maxC) {
    const weekend = isWeekend(dp);
    const lowRain = isNum(rainPct) ? rainPct <= 20 : false;
    const hot = isNum(maxC) ? maxC >= 30 : false;

    if (weekend && lowRain) {
      if (hot) return "Braai weather — but hydrate, boet.";
      return "Braai weather, boet.";
    }

    // Weekday-friendly / general lines
    if (isNum(rainPct) && rainPct >= 70) return "Plan indoors — today’s moody.";
    if (isNum(rainPct) && rainPct >= 40) return "Keep a jacket close.";
    if (hot) return "Big heat — pace yourself outside.";
    return "Good day to get stuff done outside.";
  }

  // ---------- BACKGROUND ----------
  function setBackgroundFor(dp, rainPct, maxC) {
    // Simple mapping to your existing bg folder approach
    // You can expand this later once we have your final image set.
    const base = 'assets/images/bg';
    let folder = 'clear';

    if (isNum(rainPct) && rainPct >= 60) folder = 'rain';
    else if (isNum(maxC) && maxC >= 32) folder = 'heat';
    else folder = 'clear';

    // pick deterministic-ish image (1..4)
    const n = 1 + (Math.abs(hashString(dp || 'x')) % 4);
    const path = `${base}/${folder}/${folder}${n}.jpg`;

    if (bgImg) bgImg.src = path;
  }

  function hashString(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
    return h | 0;
  }

  // ---------- API ----------
  async function fetchProbable(place) {
    const url = `/api/weather?lat=${encodeURIComponent(place.lat)}&lon=${encodeURIComponent(place.lon)}&name=${encodeURIComponent(place.name || '')}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 9500);

    try {
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      clearTimeout(t);
      throw e;
    }
  }

  async function setPlaceAndRender(place, { asHome = false } = {}) {
    currentPlace = place;
    showLoader(true);

    try {
      const payload = await fetchProbable(place);
      lastPayload = payload;

      if (asHome) saveGeoHome(place);

      // proof / agreement
      const used = payload?.sources?.used || [];
      const failed = payload?.sources?.failed || [];
      const countUsed = payload?.sources?.countUsed ?? used.length;

      const agreeLabel = payload?.agreement?.label ? payload.agreement.label.toUpperCase() : '—';
      const agreeWord =
        agreeLabel === 'STRONG' ? 'STRONG AGREEMENT' :
        agreeLabel === 'DECENT' ? 'DECENT AGREEMENT' :
        agreeLabel === 'MIXED' ? 'MIXED AGREEMENT' : '—';

      safeText(confidenceEl, `PROBABLY • ${agreeWord}`);
      safeText(confidenceValueEl, agreeLabel === '—' ? '--' : agreeLabel);

      if (confidenceBarEl) {
        const score = isNum(payload?.agreement?.score) ? payload.agreement.score : 0.5;
        confidenceBarEl.style.width = `${Math.round(score * 100)}%`;
      }

      const failedNames = failed.map(f => f.provider).filter(Boolean);
      const sourcesLine =
        failedNames.length
          ? `Based on ${countUsed} source${countUsed === 1 ? '' : 's'} • Used: ${used.join(', ')} • Failed: ${failedNames.join(', ')}`
          : `Based on ${countUsed} source${countUsed === 1 ? '' : 's'} • Used: ${used.join(', ')}`;

      safeText(sourcesEl, sourcesLine);

      // headline
      safeText(locationEl, place.name || 'Your location');
      safeText(headlineEl, place.name ? `This is ${place.name}.` : `This is your weather.`);

      // now
      safeText(tempEl, formatTemp(payload?.now?.tempC));
      const todayRain = payload?.today?.rainPct;
      const todayMax = payload?.today?.maxC;
      const todayMin = payload?.today?.minC;
      safeText(descEl, dailyLine(payload?.daily?.times?.[0] || null, todayRain, todayMax));

      // side cards
      safeText(extremeValueEl, `${formatTemp(todayMin)} → ${formatTemp(todayMax)}`);
      safeText(rainValueEl, isNum(todayRain) ? `${Math.round(todayRain)}% (${rainWord(todayRain)})` : '--');
      safeText(uvValueEl, isNum(payload?.today?.uv) ? `${Math.round(payload.today.uv)}` : '--');

      // background
      setBackgroundFor(payload?.daily?.times?.[0] || null, todayRain, todayMax);

      // render lists
      renderHourly(payload);
      renderWeek(payload);

      addRecent(place);
      showLoader(false);
    } catch (e) {
      showLoader(false);
      showToast(`Couldn’t fetch weather. Try again.`);
      // Keep UI stable even on failure
    }
  }

  // ---------- RENDER HOURLY ----------
  function renderHourly(payload) {
    if (!hourlyTimeline) return;
    hourlyTimeline.innerHTML = '';

    const times = Array.isArray(payload?.hourly?.times) ? payload.hourly.times : [];
    const temps = Array.isArray(payload?.hourly?.medianTempC) ? payload.hourly.medianTempC : [];
    const rains = Array.isArray(payload?.hourly?.medianRainPct) ? payload.hourly.medianRainPct : [];
    const nowIso = payload?.now?.time || null;

    if (!times.length) {
      hourlyTimeline.innerHTML = `<div class="hourly-empty">Hourly data unavailable.</div>`;
      return;
    }

    // Start from "now" hour if present
    let startIdx = 0;
    if (nowIso) {
      const idx = times.findIndex(t => t && t >= nowIso);
      startIdx = idx >= 0 ? idx : 0;
    }

    const end = Math.min(times.length, startIdx + 12);

    for (let i = startIdx; i < end; i++) {
      const iso = times[i] || '';
      const hhmm = iso.slice(11, 16) || '--:--';

      const tC = isNum(temps[i]) ? temps[i] : null;
      const r = isNum(rains[i]) ? rains[i] : null;

      const card = document.createElement('div');
      card.className = 'hourly-card';
      card.innerHTML = `
        <div class="hour-time">${hhmm}</div>
        <div class="hour-temp">${formatTemp(tC)}</div>
        <div class="hour-rain">${isNum(r) ? `${Math.round(r)}% rain` : `--`}</div>
      `;
      hourlyTimeline.appendChild(card);
    }
  }

  // ---------- RENDER WEEK ----------
  function renderWeek(payload) {
    if (!dailyCards) return;
    dailyCards.innerHTML = '';

    const days = Array.isArray(payload?.daily?.times) ? payload.daily.times : [];
    const maxs = Array.isArray(payload?.daily?.medianMaxC) ? payload.daily.medianMaxC : [];
    const mins = Array.isArray(payload?.daily?.medianMinC) ? payload.daily.medianMinC : [];
    const rains = Array.isArray(payload?.daily?.medianRainPct) ? payload.daily.medianRainPct : [];

    if (!days.length) {
      dailyCards.innerHTML = `<div class="daily-empty">Weekly data unavailable.</div>`;
      return;
    }

    for (let i = 0; i < Math.min(days.length, 7); i++) {
      const dp = days[i];
      const maxC = isNum(maxs[i]) ? maxs[i] : null;
      const minC = isNum(mins[i]) ? mins[i] : null;
      const rain = isNum(rains[i]) ? rains[i] : null;

      const card = document.createElement('div');
      card.className = 'day-card';
      card.innerHTML = `
        <div class="day-top">
          <div class="day-name">${i === 0 ? 'Today' : dayNameFromDatePart(dp)}</div>
          <div class="day-rain">${isNum(rain) ? `${Math.round(rain)}%` : '--'}</div>
        </div>
        <div class="day-temps">${formatTemp(minC)} → ${formatTemp(maxC)}</div>
        <div class="day-line">${dailyLine(dp, rain, maxC)}</div>
      `;
      dailyCards.appendChild(card);
    }
  }

  // ---------- SEARCH ----------
  async function geocode(query) {
    // Keep this client-side for now; later we can move to /api/geocode if needed.
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=8&addressdetails=1`;
    const res = await fetch(url, { headers: { 'accept': 'application/json' } });
    if (!res.ok) throw new Error('geocode_failed');
    return res.json();
  }

  function renderRecents() {
    if (!recentList) return;
    const recents = loadRecents();
    recentList.innerHTML = '';
    recents.forEach((p) => {
      const li = document.createElement('li');
      li.className = 'place-row';
      li.innerHTML = `<button class="place-btn">${p.name}</button>`;
      li.querySelector('button').addEventListener('click', () => {
        setPlaceAndRender(p);
        showScreen('home');
      });
      recentList.appendChild(li);
    });
  }

  function renderFavs() {
    if (!favoritesList) return;
    const favs = loadFavorites();
    favoritesList.innerHTML = '';
    favs.forEach((p) => {
      const li = document.createElement('li');
      li.className = 'place-row';
      li.innerHTML = `
        <button class="place-btn">${p.name}</button>
        ${managingFavorites ? `<button class="delete-btn" aria-label="Remove">✕</button>` : ``}
      `;

      li.querySelector('.place-btn').addEventListener('click', () => {
        setPlaceAndRender(p);
        showScreen('home');
      });

      if (managingFavorites) {
        li.querySelector('.delete-btn').addEventListener('click', () => {
          const next = loadFavorites().filter(x => !samePlace(x, p));
          saveFavorites(next);
          renderFavs();
        });
      }

      favoritesList.appendChild(li);
    });
  }

  function toggleManageFavorites() {
    managingFavorites = !managingFavorites;
    if (manageFavoritesBtn) manageFavoritesBtn.textContent = managingFavorites ? 'Done' : 'Manage favorites';
    renderFavs();
  }

  function saveCurrentPlace() {
    if (!currentPlace) return;
    const favs = loadFavorites();

    // limit to 5
    const exists = favs.some(f => samePlace(f, currentPlace));
    if (exists) {
      showToast('Already saved.');
      return;
    }
    if (favs.length >= 5) {
      showToast('Max 5 saved places.');
      return;
    }
    favs.unshift(currentPlace);
    saveFavorites(favs);
    renderFavs();
    showToast('Saved ⭐');
  }

  // ---------- NAV ----------
  navHome?.addEventListener('click', () => {
    // Home ALWAYS returns to GEO location (geoHome)
    if (geoHome) setPlaceAndRender(geoHome);
    showScreen('home');
  });
  navHourly?.addEventListener('click', () => showScreen('hourly'));
  navWeek?.addEventListener('click', () => showScreen('week'));
  navSearch?.addEventListener('click', () => showScreen('search'));
  navSettings?.addEventListener('click', () => showScreen('settings'));

  // ---------- SETTINGS ----------
  unitsSelect?.addEventListener('change', () => {
    settings.units = unitsSelect.value === 'F' ? 'F' : 'C';
    saveSettings();
    // Re-render only (no refetch needed)
    if (lastPayload && currentPlace) {
      setPlaceAndRender(currentPlace);
    }
  });

  themeSelect?.addEventListener('change', () => {
    settings.theme = themeSelect.value;
    saveSettings();
    applyTheme();
  });

  // ---------- SEARCH INPUT ----------
  let searchDebounce = null;
  searchInput?.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    const q = (searchInput.value || '').trim();
    if (q.length < 3) return;
    searchDebounce = setTimeout(async () => {
      try {
        const results = await geocode(q);
        // put results at the top of search screen by reusing recents UI area
        // Keep it minimal: we’ll polish later.
        const tmp = document.createElement('div');
        tmp.className = 'search-results';
        tmp.innerHTML = `<h3>Results</h3><ul class="results"></ul>`;

        const ul = tmp.querySelector('ul');
        results.forEach((r) => {
          const name = r.display_name?.split(',').slice(0, 2).join(',') || r.display_name || 'Unknown';
          const place = { name, lat: Number(r.lat), lon: Number(r.lon) };

          const li = document.createElement('li');
          li.className = 'place-row';
          li.innerHTML = `<button class="place-btn">${name}</button>`;
          li.querySelector('button').addEventListener('click', () => {
            setPlaceAndRender(place);
            showScreen('home');
          });
          ul.appendChild(li);
        });

        // Replace existing results block (if any)
        const existing = searchScreen.querySelector('.search-results');
        if (existing) existing.remove();
        searchScreen.insertBefore(tmp, searchScreen.firstChild.nextSibling);
      } catch {
        // ignore
      }
    }, 350);
  });

  // ---------- GEOLOCATION INIT ----------
  function initGeolocation() {
    if (!navigator.geolocation) {
      // fallback: if no geo, load last home if exists
      if (geoHome) setPlaceAndRender(geoHome);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const place = { name: 'My Location', lat, lon };
        saveGeoHome(place);
        setPlaceAndRender(place, { asHome: true });
      },
      () => {
        // if denied, fallback to last saved geoHome or a sensible default
        const fallback = geoHome || { name: 'Johannesburg', lat: -26.2041, lon: 28.0473 };
        setPlaceAndRender(fallback, { asHome: true });
      },
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 10 * 60 * 1000 }
    );
  }

  // ---------- INIT ----------
  renderFavs();
  renderRecents();
  showScreen('home');
  initGeolocation();

  // ---------- PWA REGISTER + UPDATE SIGNAL ----------
  if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            showToast('Update available — refresh to get the latest.');
          }
        });
      });
    }).catch(() => {});
  }

  // Favorites buttons
  saveCurrentBtn?.addEventListener('click', saveCurrentPlace);
  manageFavoritesBtn?.addEventListener('click', toggleManageFavorites);
});

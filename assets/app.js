document.addEventListener("DOMContentLoaded", () => {
  /* =========================================================
     Probably Weather — Frontend (assets/app.js)
     Fixes:
     - No crashes on missing data
     - Correct /api/weather URL (NO ellipses)
     - Doesn’t hang forever: timeout + safe fallback UI
     - Works with BOTH API shapes:
       A) { used:[], failed:[], norms:[] }
       B) { sources:{used,failed,countUsed}, agreement:{label,explain}, now/today/hourly/week... }
     ========================================================= */

  // -------------------- DOM --------------------
  const $ = (sel) => document.querySelector(sel);

  const titleEl = $("#locationTitle") || $(".hero h1") || $("h1");
  const subTitleEl = $("#locationSubTitle") || $(".hero h2") || $("h2");

  const heroLineEl = $("#heroLine");
  const heroTempEl = $("#heroTemp");
  const heroWitEl = $("#heroWit");

  const extremeEl = $("#todayExtreme");
  const rainEl = $("#todayRain");
  const uvEl = $("#todayUv");

  const confidenceEl = $("#confidenceLabel");
  const confidenceValueEl = $("#confidenceValue");
  const confidenceExplainEl = $("#confidenceExplain");
  const sourcesLineEl = $("#sourcesLine");

  const bgImg = $("#bgImage") || $("#bg") || $("img.bg") || $("#bgImg");

  const homeBtn = $("#navHome") || $("#btnHome") || $("#homeBtn");
  const hourlyBtn = $("#navHourly") || $("#btnHourly");
  const weekBtn = $("#navWeek") || $("#btnWeek");
  const searchBtn = $("#navSearch") || $("#btnSearch");
  const settingsBtn = $("#navSettings") || $("#btnSettings");

  const screenHome = $("#screenHome") || $("#homeScreen") || $("#home");
  const screenHourly = $("#screenHourly") || $("#hourlyScreen") || $("#hourly");
  const screenWeek = $("#screenWeek") || $("#weekScreen") || $("#week");
  const screenSearch = $("#screenSearch") || $("#searchScreen") || $("#search");
  const screenSettings = $("#screenSettings") || $("#settingsScreen") || $("#settings");

  const hourlyTimeline = $("#hourlyTimeline") || $("#hourlyList") || $("#hourlyGrid");
  const weekGrid = $("#weekGrid") || $("#weekCards") || $("#weekList");

  const searchInput = $("#searchInput");
  const searchResults = $("#searchResults");
  const recentsList = $("#recentsList");
  const favoritesList = $("#favoritesList");

  const savePlaceBtn = $("#savePlaceBtn");

  // -------------------- State --------------------
  const STORAGE = {
    units: "pw_units",           // "C" | "F" | "AUTO"
    theme: "pw_theme",           // "AUTO" | "LIGHT" | "DARK"
    favorites: "pw_favorites",   // [{name,lat,lon}]
    recents: "pw_recents",       // [{name,lat,lon}]
    home: "pw_home_place"        // {name,lat,lon} (geolocated)
  };

  const SCREENS = [screenHome, screenHourly, screenWeek, screenSearch, screenSettings].filter(Boolean);

  let activePlace = null;     // current viewed place
  let homePlace = null;       // your geolocation place (used by Home button)
  let lastPayload = null;

  // -------------------- Helpers --------------------
  const safeText = (el, txt) => { if (el) el.textContent = txt ?? ""; };
  const isNum = (v) => typeof v === "number" && Number.isFinite(v);

  function round0(n) { return isNum(n) ? Math.round(n) : null; }
  function round1(n) { return isNum(n) ? Math.round(n * 10) / 10 : null; }

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
    SCREENS.forEach(s => s && s.classList.add("hidden"));
    if (which) which.classList.remove("hidden");
  }

  // -------------------- Backgrounds --------------------
  function hashString(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
    return h | 0;
  }

  function setBackgroundFor(dp, rainPct, maxC) {
    // expects folders:
    // assets/images/bg/clear/clear1.jpg .. clear4.jpg
    // assets/images/bg/rain/rain1.jpg .. rain4.jpg
    // assets/images/bg/storm/storm1.jpg .. storm4.jpg
    // assets/images/bg/heat/heat1.jpg .. heat4.jpg
    // assets/images/bg/fog/fog1.jpg .. fog4.jpg
    // assets/images/bg/cloudy/cloudy1.jpg .. cloudy4.jpg

    const base = "assets/images/bg";
    let folder = "clear";

    const dpl = String(dp || "").toLowerCase();

    if (dpl.includes("fog") || dpl.includes("mist") || dpl.includes("haze")) folder = "fog";
    else if (dpl.includes("storm") || dpl.includes("thunder") || dpl.includes("lightning")) folder = "storm";
    else if (dpl.includes("cloud")) folder = "cloudy";
    else if (isNum(rainPct) && rainPct >= 60) folder = "rain";
    else if (isNum(maxC) && maxC >= 32) folder = "heat";
    else folder = "clear";

    const n = 1 + (Math.abs(hashString((dp || "") + String(maxC || ""))) % 4);
    const path = `${base}/${folder}/${folder}${n}.jpg`;

    if (bgImg) bgImg.src = path;
  }

  // -------------------- Copy / Wit --------------------
  function isWeekendLocal() {
    const d = new Date();
    const day = d.getDay(); // 0 Sun .. 6 Sat
    return day === 0 || day === 5 || day === 6; // Fri/Sat/Sun
  }

  function pickWittyLine(rainPct, maxC, dp) {
    const dpl = String(dp || "").toLowerCase();
    const hot = isNum(maxC) && maxC >= 30;

    // Braai rule: mainly Fri/Sat/Sun and low rain
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

  // -------------------- Agreement (if API doesn’t provide) --------------------
  function computeAgreementFromNorms(norms) {
    // norms: [{source, nowTemp, todayHigh, todayLow, todayRain, todayUv}, ...]
    const temps = (norms || []).map(n => n && n.nowTemp).filter(isNum);
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
    // ✅ correct URL (relative to current domain)
    const url = `/api/weather?lat=${encodeURIComponent(place.lat)}&lon=${encodeURIComponent(place.lon)}&name=${encodeURIComponent(place.name || "")}`;

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 9500);

    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`API ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  // -------------------- Normalizing API payload --------------------
  function normalizePayload(payload) {
    // Supports API shape A (your screenshot):
    // { ok, name, lat, lon, used:[], failed:[], norms:[{source, nowTemp, todayHigh, ...}] }
    // And shape B:
    // { sources:{used,failed,countUsed}, agreement:{label,explain}, now:{}, today:{}, hourly:{}, week:{} }

    const out = {
      placeName: payload?.name || payload?.place?.name || activePlace?.name || "—",
      used: payload?.used || payload?.sources?.used || [],
      failed: payload?.failed || payload?.sources?.failed || [],
      countUsed: payload?.sources?.countUsed ?? (payload?.used ? payload.used.length : (payload?.sources?.used?.length || 0)),
      norms: payload?.norms || payload?.sources?.norms || [],
      agreement: payload?.agreement || null,

      // best guess values:
      nowTempC: null,
      todayHighC: null,
      todayLowC: null,
      rainPct: null,
      uv: null,
      desc: payload?.desc || payload?.summary || payload?.now?.summary || payload?.now?.desc || null,

      hourly: payload?.hourly || null,
      week: payload?.week || null
    };

    // If we have norms, use median as “probable”
    const norms = out.norms || [];
    const nowTemps = norms.map(n => n?.nowTemp).filter(isNum).sort((a,b)=>a-b);
    const highs = norms.map(n => n?.todayHigh).filter(isNum).sort((a,b)=>a-b);
    const lows  = norms.map(n => n?.todayLow).filter(isNum).sort((a,b)=>a-b);
    const rains = norms.map(n => n?.todayRain).filter(isNum).sort((a,b)=>a-b);
    const uvs   = norms.map(n => n?.todayUv).filter(isNum).sort((a,b)=>a-b);

    const median = (arr) => {
      if (!arr.length) return null;
      const mid = Math.floor(arr.length/2);
      return arr.length % 2 ? arr[mid] : (arr[mid-1] + arr[mid]) / 2;
    };

    out.nowTempC   = median(nowTemps);
    out.todayHighC = median(highs);
    out.todayLowC  = median(lows);
    out.rainPct    = median(rains);
    out.uv         = median(uvs);

    // Agreement
    if (!out.agreement) out.agreement = computeAgreementFromNorms(norms);

    return out;
  }

  // -------------------- Render --------------------
  function renderLoading(placeName) {
    safeText(titleEl, "Probably Weather");
    safeText(subTitleEl, placeName || "—");
    safeText(heroLineEl, "Loading…");
    safeText(heroTempEl, "--°");
    safeText(heroWitEl, "—");

    safeText(extremeEl, "-- → --");
    safeText(rainEl, "--");
    safeText(uvEl, "--");

    safeText(confidenceEl, "PROBABLY • —");
    safeText(confidenceValueEl, "--");
    safeText(confidenceExplainEl, "");
    safeText(sourcesLineEl, "Sources: —");

    if (hourlyTimeline) hourlyTimeline.innerHTML = "";
    if (weekGrid) weekGrid.innerHTML = "";
  }

  function renderError(msg) {
    safeText(heroLineEl, "This is… complicated.");
    safeText(heroTempEl, "--°");
    safeText(heroWitEl, msg || "Couldn’t fetch right now. Try again.");

    safeText(confidenceEl, "PROBABLY • —");
    safeText(confidenceValueEl, "--");
    safeText(confidenceExplainEl, "No sources responded.");
    safeText(sourcesLineEl, "Sources: none");

    safeText(extremeEl, "-- → --");
    safeText(rainEl, "--");
    safeText(uvEl, "--");
  }

  function renderHome(norm) {
    const placeName = norm.placeName || "—";

    safeText(titleEl, "Probably Weather");
    safeText(subTitleEl, placeName);

    // headline + temp
    safeText(heroLineEl, `This is ${String(norm.desc || "").trim() || "your weather"}.`.replace(/\s+\./g, "."));
    const hi = round0(norm.todayHighC);
    const lo = round0(norm.todayLowC);

    if (isNum(hi) && isNum(lo)) safeText(heroTempEl, `${lo}–${hi}°`);
    else if (isNum(norm.nowTempC)) safeText(heroTempEl, `${round0(norm.nowTempC)}°`);
    else safeText(heroTempEl, "--°");

    safeText(heroWitEl, pickWittyLine(norm.rainPct, hi, norm.desc));

    // side cards
    if (isNum(hi) && isNum(lo)) safeText(extremeEl, `${lo}° → ${hi}°`);
    else safeText(extremeEl, "-- → --");

    if (isNum(norm.rainPct)) {
      const rp = round0(norm.rainPct);
      safeText(rainEl, `${rp}% (${rp >= 40 ? "Possible rain" : "Low chance"})`);
    } else safeText(rainEl, "--");

    if (isNum(norm.uv)) safeText(uvEl, `${round0(norm.uv)}`);
    else safeText(uvEl, "--");

    // agreement + sources
    const label = (norm.agreement?.label || "—").toUpperCase();
    const agreeWord =
      label === "STRONG" ? "STRONG AGREEMENT" :
      label === "DECENT" ? "DECENT AGREEMENT" :
      label === "MIXED" ? "MIXED AGREEMENT" : "—";

    safeText(confidenceEl, `PROBABLY • ${agreeWord}`);
    safeText(confidenceValueEl, label === "—" ? "--" : label);
    safeText(confidenceExplainEl, norm.agreement?.explain || "");

    const used = Array.isArray(norm.used) ? norm.used : [];
    const failed = Array.isArray(norm.failed) ? norm.failed : [];
    const usedTxt = used.length ? `Used: ${used.join(", ")}` : "Used: —";
    const failedTxt = failed.length ? `Failed: ${failed.join(", ")}` : "";
    safeText(sourcesLineEl, `Based on ${norm.countUsed || used.length || 0} sources · ${usedTxt}${failedTxt ? " · " + failedTxt : ""}`);

    // background
    setBackgroundFor(norm.desc, norm.rainPct, hi);
  }

  // -------------------- Main flow --------------------
  async function loadAndRender(place) {
    activePlace = place;

    renderLoading(place?.name || "—");
    try {
      const payload = await fetchProbable(place);
      lastPayload = payload;
      const norm = normalizePayload(payload);
      renderHome(norm);
    } catch (e) {
      console.error("Load failed:", e);
      renderError("Couldn’t fetch weather right now.");
    }
  }

  // -------------------- Places: recents/favorites --------------------
  function loadFavorites() { return loadJSON(STORAGE.favorites, []); }
  function loadRecents() { return loadJSON(STORAGE.recents, []); }

  function saveFavorites(list) { saveJSON(STORAGE.favorites, list); }
  function saveRecents(list) { saveJSON(STORAGE.recents, list); }

  function addRecent(place) {
    const list = loadRecents().filter(p => !samePlace(p, place));
    list.unshift(place);
    saveRecents(list.slice(0, 10));
    renderRecents();
  }

  function addFavorite(place) {
    const list = loadFavorites();
    if (list.some(p => samePlace(p, place))) return;
    list.unshift(place);
    saveFavorites(list.slice(0, 5));
    renderFavorites();
  }

  function renderRecents() {
    if (!recentsList) return;
    const list = loadRecents();
    recentsList.innerHTML = list.map(p => `
      <button class="place-pill" data-lat="${p.lat}" data-lon="${p.lon}" data-name="${escapeHtml(p.name)}">${escapeHtml(p.name)}</button>
    `).join("") || `<div class="muted">No recent searches yet.</div>`;

    recentsList.querySelectorAll("button.place-pill").forEach(btn => {
      btn.addEventListener("click", () => {
        const p = { name: btn.dataset.name, lat: Number(btn.dataset.lat), lon: Number(btn.dataset.lon) };
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
      <button class="place-pill fav" data-lat="${p.lat}" data-lon="${p.lon}" data-name="${escapeHtml(p.name)}">★ ${escapeHtml(p.name)}</button>
    `).join("") || `<div class="muted">No saved places yet.</div>`;

    favoritesList.querySelectorAll("button.place-pill").forEach(btn => {
      btn.addEventListener("click", () => {
        const p = { name: btn.dataset.name, lat: Number(btn.dataset.lat), lon: Number(btn.dataset.lon) };
        showScreen(screenHome);
        loadAndRender(p);
      });
    });
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  // -------------------- Search --------------------
  async function runSearch(q) {
    if (!searchResults) return;
    if (!q || q.trim().length < 2) {
      searchResults.innerHTML = `<div class="muted">Type a place name…</div>`;
      return;
    }

    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=8&addressdetails=1`;
    try {
      const res = await fetch(url, {
        headers: { "Accept": "application/json" }
      });
      const data = await res.json();

      const items = (data || []).map(d => ({
        name: d.display_name,
        lat: Number(d.lat),
        lon: Number(d.lon)
      }));

      searchResults.innerHTML = items.map(p => `
        <button class="search-row" data-lat="${p.lat}" data-lon="${p.lon}" data-name="${escapeHtml(p.name)}">
          ${escapeHtml(p.name)}
        </button>
      `).join("") || `<div class="muted">No results.</div>`;

      searchResults.querySelectorAll("button.search-row").forEach(btn => {
        btn.addEventListener("click", () => {
          const p = { name: btn.dataset.name, lat: Number(btn.dataset.lat), lon: Number(btn.dataset.lon) };
          addRecent(p);
          showScreen(screenHome);
          loadAndRender(p);
        });
      });
    } catch (e) {
      console.error(e);
      searchResults.innerHTML = `<div class="muted">Search failed. Try again.</div>`;
    }
  }

  // -------------------- Buttons / Nav --------------------
  if (homeBtn) homeBtn.addEventListener("click", () => {
    showScreen(screenHome);
    if (homePlace) loadAndRender(homePlace);
    else if (activePlace) loadAndRender(activePlace);
  });

  if (hourlyBtn) hourlyBtn.addEventListener("click", () => showScreen(screenHourly || screenHome));
  if (weekBtn) weekBtn.addEventListener("click", () => showScreen(screenWeek || screenHome));
  if (searchBtn) searchBtn.addEventListener("click", () => { showScreen(screenSearch || screenHome); renderRecents(); renderFavorites(); });
  if (settingsBtn) settingsBtn.addEventListener("click", () => showScreen(screenSettings || screenHome));

  if (savePlaceBtn) savePlaceBtn.addEventListener("click", () => {
    if (activePlace) addFavorite(activePlace);
  });

  if (searchInput) {
    let t = null;
    searchInput.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => runSearch(searchInput.value), 250);
    });
  }

  // -------------------- Init --------------------
  renderRecents();
  renderFavorites();

  // Try stored home place first (fast)
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
});

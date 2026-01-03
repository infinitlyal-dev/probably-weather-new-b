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
  const searchCancel = $('#searchCancel');
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
      const raw = localStorage.getItem(STORAGE + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }
  function saveJSON(key, val) {
    try { localStorage.setItem(STORAGE + key, JSON.stringify(val)); } catch {}
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

  // (Keep your suntimes, setBackgroundFor, createParticles, isWeekendLocal, pickWittyLine, computeAgreementFromNorms, fetchProbable, normalizePayload, renderLoading, renderError, renderHome, renderHourly, renderWeek, loadAndRender, addRecent, addFavorite, renderRecents, renderFavorites, escapeHtml, runSearch, nav listeners, init, median, pickMostCommon)

});

/* Probably Weather — Frontend controller
   IMPORTANT:
   - We no longer call WeatherAPI/OpenWeather from the browser (keys + CORS headaches).
   - We call our serverless proxy instead: /api/weather
   - Open-Meteo remains the “time authority” for Hourly/Week because it supports timezone=auto.
*/

(() => {
  "use strict";

  // -----------------------------
  // ELEMENTS
  // -----------------------------
  const $ = (sel) => document.querySelector(sel);

  const bgImgEl = $("#bgImg");
  const placeTitleEl = $("#placeTitle");
  const placeSubEl = $("#placeSub");
  const heroTempEl = $("#heroTemp");
  const heroHeadlineEl = $("#heroHeadline");
  const heroSublineEl = $("#heroSubline");

  const cardExtremeEl = $("#cardExtreme");
  const cardRainEl = $("#cardRain");
  const cardUvEl = $("#cardUV");
  const cardAgreeEl = $("#cardAgreement");

  const agreementLineEl = $("#agreementLine");
  const agreementValueEl = $("#agreementValue");
  const agreementBar = $("#agreementBar");
  const sourcesEl = $("#sourcesLine");

  const navHome = $("#navHome");
  const navHourly = $("#navHourly");
  const navWeek = $("#navWeek");
  const navSearch = $("#navSearch");
  const navSettings = $("#navSettings");

  const viewHome = $("#viewHome");
  const viewHourly = $("#viewHourly");
  const viewWeek = $("#viewWeek");
  const viewSearch = $("#viewSearch");
  const viewSettings = $("#viewSettings");

  const hourlyWrap = $("#hourlyWrap");
  const weekWrap = $("#weekWrap");

  const searchForm = $("#searchForm");
  const searchInput = $("#searchInput");
  const searchResults = $("#searchResults");

  const btnSavePlace = $("#btnSavePlace");
  const savedWrap = $("#savedWrap");
  const btnUseLocation = $("#btnUseLocation"); // if present

  // -----------------------------
  // CONFIG
  // -----------------------------
  const WEATHERAPI_KEY = null; // moved server-side (Vercel env) via /api/weather
  const OPENWEATHER_KEY = null; // removed (no longer used)

  const STORAGE = {
    SAVED: "pw_saved_places_v1",
    LAST: "pw_last_place_v1"
  };

  const DEFAULT_PLACE = {
    name: "My Location",
    lat: -33.9249,
    lon: 18.4241,
    isGeo: true
  };

  // -----------------------------
  // UTILS
  // -----------------------------
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const round0 = (n) => (Number.isFinite(n) ? Math.round(n) : null);
  const round1 = (n) => (Number.isFinite(n) ? Math.round(n * 10) / 10 : null);
  const isNum = (n) => Number.isFinite(n);

  const safeJSON = async (res) => {
    try {
      return await res.json();
    } catch {
      return null;
    }
  };

  async function safeFetchJson(url, timeoutMs = 8000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const res = await fetch(url, { signal: ctrl.signal });
      const data = await safeJSON(res);
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          error: data?.error || data?.message || "Request failed"
        };
      }
      return data || { ok: false, error: "Empty JSON" };
    } catch (e) {
      return { ok: false, error: e?.message || "Fetch failed" };
    } finally {
      clearTimeout(t);
    }
  }

  function setActiveNav(btn) {
    [navHome, navHourly, navWeek, navSearch, navSettings].forEach((b) => b?.classList?.remove("active"));
    btn?.classList?.add("active");
  }

  function showView(which) {
    [viewHome, viewHourly, viewWeek, viewSearch, viewSettings].forEach((v) => v?.classList?.add("hidden"));
    which?.classList?.remove("hidden");
  }

  function saveLastPlace(place) {
    try {
      localStorage.setItem(STORAGE.LAST, JSON.stringify(place));
    } catch {}
  }

  function loadLastPlace() {
    try {
      const raw = localStorage.getItem(STORAGE.LAST);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE.SAVED);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveSaved(arr) {
    try {
      localStorage.setItem(STORAGE.SAVED, JSON.stringify(arr));
    } catch {}
  }

  function samePlace(a, b) {
    if (!a || !b) return false;
    return round1(a.lat) === round1(b.lat) && round1(a.lon) === round1(b.lon);
  }

  // -----------------------------
  // BACKGROUNDS / CONDITIONS
  // -----------------------------
  function pickIconFromCode(code) {
    // very simple fallback mapping; your existing UI icons can override this
    if (code == null) return "☁️";
    const c = Number(code);
    if ([0].includes(c)) return "☀️";
    if ([1, 2].includes(c)) return "⛅";
    if ([3].includes(c)) return "☁️";
    if ([45, 48].includes(c)) return "🌫️";
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(c)) return "🌧️";
    if ([95, 96, 99].includes(c)) return "⛈️";
    if ([71, 73, 75, 77, 85, 86].includes(c)) return "🌨️";
    return "☁️";
  }

  function determineCondition({ rainChance, windKph, code }) {
    // Priority: storm > fog > rain > wind > cloudy/partly > clear
    const c = Number(code);

    const isFog = [45, 48].includes(c);
    const isStorm = [95, 96, 99].includes(c);

    if (isStorm) return "storm";
    if (isFog) return "fog";

    if (isNum(rainChance) && rainChance >= 60) return "rain";
    if (isNum(windKph) && windKph >= 30) return "wind";

    // Cloudiness from WMO codes
    if ([3].includes(c)) return "cloudy";
    if ([1, 2].includes(c)) return "partly_cloudy";
    if ([0].includes(c)) return "clear";

    // fallback
    if (isNum(rainChance) && rainChance >= 30) return "partly_cloudy";
    return "partly_cloudy";
  }

  function timeOfDayFromNow() {
    const h = new Date().getHours();
    if (h >= 5 && h < 8) return "dawn";
    if (h >= 8 && h < 17) return "day";
    if (h >= 17 && h < 20) return "dusk";
    return "night";
  }

  function setBackground(condition) {
    if (!bgImgEl) return;

    // Your folder structure should be: assets/images/<condition>/<1-4>.jpg (or .png)
    // condition keys: clear, partly_cloudy, cloudy, rain, storm, wind, fog
    const map = {
      clear: "clear",
      partly_cloudy: "partly_cloudy",
      cloudy: "cloudy",
      rain: "rain",
      storm: "storm",
      wind: "wind",
      fog: "fog"
    };

    const folder = map[condition] || "partly_cloudy";
    const idx = 1 + Math.floor(Math.random() * 4);
    bgImgEl.src = `assets/images/${folder}/${idx}.jpg`;
    bgImgEl.onerror = () => {
      // fallback to png if you used pngs
      bgImgEl.src = `assets/images/${folder}/${idx}.png`;
    };
  }

  // -----------------------------
  // COPY
  // -----------------------------
  function humorLine(condition, tod, ctx = {}) {
    const isWeekend = !!ctx.isWeekend;
    const rainChance = Number.isFinite(ctx.rainChance) ? ctx.rainChance : null;

    const pack = {
      clear: {
        day: ["Braai weather, boet!", "Sky’s on your side today.", "No Ja-No-Maybe. Just lekker."],
        dawn: ["Morning is behaving—enjoy it.", "Sun’s clocking in early."],
        dusk: ["Golden hour looking sharp.", "Evening vibes: sorted."],
        night: ["Clear night—star duty.", "Night’s calm. Don’t jinx it."]
      },
      partly_cloudy: {
        day: ["Mixed bag, but still playable.", "Could go either way—keep options.", "Sun’s peeking. Clouds are lurking."],
        dawn: ["Clouds waking up too.", "Soft morning light—nice and mild."],
        dusk: ["Clouds at sunset—proper mood lighting.", "Evening: comfy, not chaotic."],
        night: ["Cloud cover—no star show tonight.", "Mellow night—no drama."]
      },
      cloudy: {
        day: ["Grey skies, but life goes on.", "Cloud blanket mode.", "Not sunny, not tragic—just cloudy."],
        dawn: ["Cloudy morning—slow start.", "Soft light, zero glare."],
        dusk: ["Clouds catching the last light.", "Evening’s a bit moody."],
        night: ["Cloudy night—quiet vibes.", "No stars, still fine."]
      },
      rain: {
        day: ["The clouds are crying—plan accordingly.", "Rain jacket energy.", "Not a braai day unless you’re brave."],
        dawn: ["Wet start—coffee first.", "Morning drizzle vibes."],
        dusk: ["Evening rain—blanket and series weather.", "Rain’s doing a night shift."],
        night: ["Listen… that’s rain. Not ghosts.", "Night rain: cozy, not convenient."]
      },
      storm: {
        day: ["Stormy. Secure the patio chairs.", "Lightning’s doing the most.", "Eish. Stay inside if you can."],
        dawn: ["Stormy start—take it easy.", "Morning thunder? Rude."],
        dusk: ["Storm rolling in—wrap up early.", "Evening lightning show (from indoors)."],
        night: ["Storm night—keep your phone charged.", "Thunder’s the soundtrack tonight."]
      },
      fog: {
        day: ["Foggy—drive like a human, please.", "Low visibility, high vibes.", "Fog mode: slow and steady."],
        dawn: ["Foggy morning—take it slow.", "You can taste the mist."],
        dusk: ["Fog at sunset—spooky but pretty.", "Evening fog—headlights on."],
        night: ["Fog night—everything feels closer.", "Misty streets, quiet sounds."]
      },
      wind: {
        day: ["Windy. Hold onto your hat.", "The breeze chose violence.", "Good day for a kite, bad day for hair."],
        dawn: ["Windy morning—brisk start.", "Breeze before breakfast."],
        dusk: ["Wind picking up—zip that jacket.", "Evening gusts incoming."],
        night: ["Windy night—rattly vibes.", "If it bangs, it’s probably the wind."]
      }
    };

    const bucket = pack[condition] || pack.partly_cloudy;
    const list = bucket[tod] || bucket.day || ["Probably."];
    let choices = list.slice();

    // Braai rule: only weekends AND only if rain chance looks low
    if (condition === "clear" && tod === "day") {
      choices = choices.filter((l) => {
        if (!l.toLowerCase().includes("braai")) return true;
        if (!isWeekend) return false;
        if (rainChance === null) return true;
        return rainChance <= 20;
      });
      if (!choices.length) choices = list.filter((l) => !l.toLowerCase().includes("braai"));
      if (!choices.length) choices = list.slice();
    }

    return choices[Math.floor(Math.random() * choices.length)];
  }

  // -----------------------------
  // OPEN-METEO (Hourly/Week + time authority)
  // -----------------------------
  async function fetchOpenMeteo(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(
      lat
    )}&longitude=${encodeURIComponent(lon)}&current_weather=true&timezone=auto&hourly=temperature_2m,precipitation_probability,windspeed_10m,weathercode&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode,uv_index_max&forecast_days=7`;

    return await safeFetchJson(url, 9000);
  }

  function normalizeFromOpenMeteo(om) {
    try {
      if (!om || !om.current_weather) return null;

      const nowTemp = Number(om.current_weather.temperature);
      const nowWind = Number(om.current_weather.windspeed);
      const nowTime = om.current_weather.time;
      const nowCode = om.current_weather.weathercode;

      const dailyMax = om.daily?.temperature_2m_max?.[0];
      const dailyMin = om.daily?.temperature_2m_min?.[0];
      const dailyRainMax = om.daily?.precipitation_probability_max?.[0];
      const dailyUvMax = om.daily?.uv_index_max?.[0];

      return {
        source: "Open-Meteo",
        nowTemp,
        todayHigh: Number(dailyMax),
        todayLow: Number(dailyMin),
        todayRain: Number(dailyRainMax),
        todayUv: Number(dailyUvMax),
        nowTime,
        nowCode,
        hourly: {
          times: om.hourly?.time || [],
          temps: om.hourly?.temperature_2m || [],
          rain: om.hourly?.precipitation_probability || [],
          wind: om.hourly?.windspeed_10m || [],
          codes: om.hourly?.weathercode || []
        },
        daily: {
          times: om.daily?.time || [],
          max: om.daily?.temperature_2m_max || [],
          min: om.daily?.temperature_2m_min || [],
          rainMax: om.daily?.precipitation_probability_max || [],
          codes: om.daily?.weathercode || [],
          uvMax: om.daily?.uv_index_max || []
        }
      };
    } catch {
      return null;
    }
  }

  function buildHourlyFromOpenMeteo(omNorm) {
    // Compare using Date values (not string compare) to avoid UTC/local mismatches.
    const h = omNorm.hourly;
    if (!h?.times?.length) return null;

    const nowISO = omNorm.nowTime;
    const nowMs = nowISO ? Date.parse(nowISO) : NaN;
    const start = Number.isFinite(nowMs)
      ? Math.max(0, h.times.findIndex((t) => Date.parse(t) >= nowMs))
      : 0;

    const safeStart = start >= 0 ? start : 0;

    const out = [];
    const end = Math.min(h.times.length, safeStart + 12);
    for (let i = safeStart; i < end; i++) {
      out.push({
        time: h.times[i],
        temp: h.temps?.[i],
        rain: h.rain?.[i],
        wind: h.wind?.[i],
        code: h.codes?.[i],
        icon: pickIconFromCode(h.codes?.[i])
      });
    }
    return out;
  }

  // -----------------------------
  // SERVERLESS PROXY BUNDLE
  // -----------------------------
  async function fetchProxyBundle(lat, lon, name) {
    // Server-side proxy aggregates: Open-Meteo + WeatherAPI + MET Norway
    const q = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      name: name || ""
    });
    return await safeFetchJson(`/api/weather?${q.toString()}`, 9000);
  }

  // -----------------------------
  // AGREEMENT / “PROBABLY”
  // -----------------------------
  function median(arr) {
    const a = arr.filter((x) => Number.isFinite(x)).slice().sort((x, y) => x - y);
    if (!a.length) return null;
    const mid = Math.floor(a.length / 2);
    return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  }

  function spreadPct(values) {
    const a = values.filter((x) => Number.isFinite(x)).slice().sort((x, y) => x - y);
    if (a.length < 2) return 0;
    const lo = a[0];
    const hi = a[a.length - 1];
    const denom = Math.max(1, Math.abs(median(a)));
    return Math.min(100, Math.round((Math.abs(hi - lo) / denom) * 100));
  }

  function agreementLabelFromSpread(spread) {
    // Spread is relative percent difference. Lower spread = higher agreement.
    // Tuned for “Strong / Decent / Mixed” vibe.
    if (spread <= 8) return { label: "Strong", pct: 92 };
    if (spread <= 18) return { label: "Decent", pct: 70 };
    return { label: "Mixed", pct: 45 };
  }

  function aggregateAll(norms) {
    const nowTemps = norms.map((n) => n.nowTemp);
    const highs = norms.map((n) => n.todayHigh);
    const lows = norms.map((n) => n.todayLow);
    const rains = norms.map((n) => n.todayRain);
    const uvs = norms.map((n) => n.todayUv);

    const nowTemp = median(nowTemps);
    const todayHigh = median(highs);
    const todayLow = median(lows);
    const todayRain = median(rains);
    const todayUv = median(uvs);

    const spread = spreadPct(nowTemps);
    const agree = agreementLabelFromSpread(spread);

    return {
      nowTemp,
      todayHigh,
      todayLow,
      todayRain,
      todayUv,
      sourcesUsed: norms.map((n) => n.source),
      failedSources: [],
      agreement: agree
    };
  }

  function renderAgreement(label, pct, usedSources, failedSources) {
    const used = Array.isArray(usedSources) ? usedSources : [];
    const failed = Array.isArray(failedSources) ? failedSources : [];

    const usedText = used.length ? ` • Based on ${used.length} source${used.length === 1 ? "" : "s"}` : "";
    const failedText = failed.length ? ` • Failed: ${failed.join(", ")}` : "";

    agreementLineEl.textContent = `PROBABLY • ${label.toUpperCase()} AGREEMENT${usedText}`;
    agreementValueEl.textContent = label.toUpperCase();
    if (agreementBar) agreementBar.style.width = `${clamp(pct, 0, 100)}%`;

    if (sourcesEl) {
      if (used.length || failed.length) {
        const parts = [];
        if (used.length) parts.push(`Used: ${used.join(" • ")}`);
        if (failed.length) parts.push(`Failed: ${failed.join(" • ")}`);
        sourcesEl.textContent = parts.join(" • ");
      } else {
        sourcesEl.textContent = "";
      }
    }
  }

  // -----------------------------
  // RENDERERS
  // -----------------------------
  function renderHome(place, aggregated, omNorm) {
    if (placeTitleEl) placeTitleEl.textContent = "Probably Weather";
    if (placeSubEl) placeSubEl.textContent = place?.name || "";

    const temp = round0(aggregated.nowTemp);
    heroTempEl.textContent = temp != null ? `${temp}°` : "--";

    const tod = timeOfDayFromNow();

    // Use Open-Meteo WMO code + wind/rain to determine the “mood”
    const rainPct = isNum(aggregated.todayRain) ? aggregated.todayRain : 0;
    const windKph = omNorm?.hourly?.wind?.length ? omNorm.hourly.wind[0] : null;
    const code = omNorm?.nowCode;

    const condition = determineCondition({ rainChance: rainPct, windKph, code });

    // Headlines
    const headlineMap = {
      clear: "This is clear.",
      partly_cloudy: "This is mixed.",
      cloudy: "This is cloudy.",
      rain: "This is rainy.",
      storm: "This is stormy.",
      wind: "This is windy.",
      fog: "This is fog."
    };

    heroHeadlineEl.textContent = headlineMap[condition] || "This is Probably.";
    setBackground(condition);

    const nowD = new Date();
    const dow = nowD.getDay(); // 0=Sun ... 6=Sat
    const isWeekend = dow === 0 || dow === 5 || dow === 6;
    const rainChance = isNum(aggregated.todayRain) ? aggregated.todayRain : (isNum(aggregated.rainPct) ? aggregated.rainPct : null);
    heroSublineEl.textContent = humorLine(condition, tod, { isWeekend, rainChance });

    // Right-side cards
    const hi = round0(aggregated.todayHigh);
    const lo = round0(aggregated.todayLow);
    cardExtremeEl.textContent = (hi != null && lo != null) ? `${lo}° → ${hi}°` : `-- → --`;

    // Rain copy
    const r = round0(aggregated.todayRain);
    if (r == null) cardRainEl.textContent = "--";
    else if (r <= 10) cardRainEl.textContent = "None expected";
    else if (r <= 35) cardRainEl.textContent = `${r}% (Low chance)`;
    else if (r <= 65) cardRainEl.textContent = `${r}% (Possible rain)`;
    else cardRainEl.textContent = `${r}% (Likely rain)`;

    // UV
    const uv = round0(aggregated.todayUv);
    cardUvEl.textContent = uv != null ? `${uv}` : "--";

    // Agreement card
    cardAgreeEl.textContent = aggregated?.agreement?.label?.toUpperCase?.() || "--";

    // Agreement line + sources
    const agreementLabel = aggregated.agreement.label;
    const agreementPct = aggregated.agreement.pct;
    renderAgreement(agreementLabel, agreementPct, aggregated.sourcesUsed, aggregated.failedSources);

    // Save button state
    if (btnSavePlace) {
      const saved = loadSaved();
      const already = saved.some((p) => samePlace(p, place));
      btnSavePlace.classList.toggle("saved", already);
      btnSavePlace.textContent = already ? "★ Saved" : "☆ Save this place";
    }
  }

  function renderHourly(hourly) {
    if (!hourlyWrap) return;
    hourlyWrap.innerHTML = "";

    if (!hourly || !hourly.length) {
      hourlyWrap.innerHTML = `<div class="muted">No hourly data available.</div>`;
      return;
    }

    for (const h of hourly) {
      const d = new Date(h.time);
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");

      const t = round0(h.temp);
      const r = round0(h.rain);
      const w = round0(h.wind);

      const item = document.createElement("div");
      item.className = "hourItem";
      item.innerHTML = `
        <div class="hourTime">${hh}:${mm}</div>
        <div class="hourIcon">${h.icon || "☁️"}</div>
        <div class="hourTemp">${t != null ? `${t}°` : "--"}</div>
        <div class="hourMeta">
          <span>Rain: ${r != null ? `${r}%` : "--"}</span>
          <span>Wind: ${w != null ? `${w} km/h` : "--"}</span>
        </div>
      `;
      hourlyWrap.appendChild(item);
    }
  }

  function renderWeek(omNorm) {
    if (!weekWrap) return;
    weekWrap.innerHTML = "";

    const d = omNorm?.daily;
    if (!d?.times?.length) {
      weekWrap.innerHTML = `<div class="muted">No week data available.</div>`;
      return;
    }

    for (let i = 0; i < d.times.length; i++) {
      const date = new Date(d.times[i]);
      const day = date.toLocaleDateString(undefined, { weekday: "short" });

      const hi = round0(d.max?.[i]);
      const lo = round0(d.min?.[i]);
      const rain = round0(d.rainMax?.[i]);
      const code = d.codes?.[i];
      const icon = pickIconFromCode(code);

      const condition = determineCondition({ rainChance: rain, windKph: null, code });
      const tod = "day";
      const line = humorLine(condition, tod);

      const card = document.createElement("div");
      card.className = "weekCard";
      card.innerHTML = `
        <div class="weekDay">${day}</div>
        <div class="weekIcon">${icon}</div>
        <div class="weekTemps">${lo != null ? lo : "--"}° → ${hi != null ? hi : "--"}°</div>
        <div class="weekRain">${rain != null ? `${rain}%` : "--"}</div>
        <div class="weekLine">${line}</div>
      `;
      weekWrap.appendChild(card);
    }
  }

  // -----------------------------
  // SEARCH (Nominatim)
  // -----------------------------
  async function searchPlaces(query) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=8`;
    return await safeFetchJson(url, 9000);
  }

  function renderSearchResults(list) {
    if (!searchResults) return;
    searchResults.innerHTML = "";

    if (!list || !list.length) {
      searchResults.innerHTML = `<div class="muted">No results.</div>`;
      return;
    }

    list.forEach((r) => {
      const btn = document.createElement("button");
      btn.className = "searchResult";
      btn.type = "button";
      btn.textContent = r.display_name;
      btn.addEventListener("click", async () => {
        const place = {
          name: r.display_name.split(",").slice(0, 2).join(","),
          lat: Number(r.lat),
          lon: Number(r.lon),
          isGeo: false
        };
        await loadPlace(place);
        setActiveNav(navHome);
        showView(viewHome);
      });
      searchResults.appendChild(btn);
    });
  }

  // -----------------------------
  // SAVED PLACES UI
  // -----------------------------
  function renderSaved() {
    if (!savedWrap) return;

    const saved = loadSaved();
    savedWrap.innerHTML = "";

    if (!saved.length) {
      savedWrap.innerHTML = `<div class="muted">No saved places yet.</div>`;
      return;
    }

    saved.forEach((p) => {
      const row = document.createElement("div");
      row.className = "savedRow";
      row.innerHTML = `
        <button class="savedGo" type="button">${p.name}</button>
        <button class="savedDel" type="button">Remove</button>
      `;

      row.querySelector(".savedGo").addEventListener("click", async () => {
        await loadPlace(p);
        setActiveNav(navHome);
        showView(viewHome);
      });

      row.querySelector(".savedDel").addEventListener("click", () => {
        const next = loadSaved().filter((x) => !samePlace(x, p));
        saveSaved(next);
        renderSaved();
      });

      savedWrap.appendChild(row);
    });
  }

  // -----------------------------
  // GEOLOCATION
  // -----------------------------
  async function getGeoPlace() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            name: "My Location",
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            isGeo: true
          });
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  // -----------------------------
  // MAIN LOAD PLACE
  // -----------------------------
  async function loadPlace(place) {
    const safePlace = place || DEFAULT_PLACE;

    // Fetch Open-Meteo direct (hourly/week + timezone)
    // Fetch proxy bundle for agreement + “probably”
    const [om, bundle] = await Promise.all([
      fetchOpenMeteo(safePlace.lat, safePlace.lon),
      fetchProxyBundle(safePlace.lat, safePlace.lon, safePlace.name)
    ]);

    const omNorm = normalizeFromOpenMeteo(om);

    const norms = [];
    if (bundle && bundle.ok && Array.isArray(bundle.norms)) {
      for (const n of bundle.norms) {
        if (n && typeof n === "object" && n.source) norms.push(n);
      }
    } else {
      if (omNorm) norms.push(omNorm);
    }

    if (omNorm && !norms.some((n) => n.source === "Open-Meteo")) norms.push(omNorm);

    const aggregated = aggregateAll(norms);

    // Proof of sources (server-side proxy tells us what succeeded/failed)
    if (bundle && bundle.ok) {
      if (Array.isArray(bundle.used)) aggregated.sourcesUsed = bundle.used;
      if (Array.isArray(bundle.failed)) aggregated.failedSources = bundle.failed;
    } else {
      aggregated.failedSources = [];
    }

    renderHome(safePlace, aggregated, omNorm);

    // Hourly + Week
    const hourly = omNorm ? buildHourlyFromOpenMeteo(omNorm) : null;
    renderHourly(hourly);
    renderWeek(omNorm);

    saveLastPlace(safePlace);
  }

  // -----------------------------
  // EVENTS
  // -----------------------------
  navHome?.addEventListener("click", async () => {
    setActiveNav(navHome);
    showView(viewHome);

    const last = loadLastPlace() || DEFAULT_PLACE;
    await loadPlace(last);
  });

  navHourly?.addEventListener("click", () => {
    setActiveNav(navHourly);
    showView(viewHourly);
  });

  navWeek?.addEventListener("click", () => {
    setActiveNav(navWeek);
    showView(viewWeek);
  });

  navSearch?.addEventListener("click", () => {
    setActiveNav(navSearch);
    showView(viewSearch);
    searchInput?.focus();
  });

  navSettings?.addEventListener("click", () => {
    setActiveNav(navSettings);
    showView(viewSettings);
    renderSaved();
  });

  btnSavePlace?.addEventListener("click", () => {
    const place = loadLastPlace();
    if (!place) return;

    const saved = loadSaved();
    const exists = saved.some((p) => samePlace(p, place));

    if (exists) {
      saveSaved(saved.filter((p) => !samePlace(p, place)));
    } else {
      saved.unshift(place);
      saveSaved(saved.slice(0, 12));
    }
    renderSaved();
    // Refresh button state
    const nowSaved = loadSaved().some((p) => samePlace(p, place));
    btnSavePlace.classList.toggle("saved", nowSaved);
    btnSavePlace.textContent = nowSaved ? "★ Saved" : "☆ Save this place";
  });

  btnUseLocation?.addEventListener("click", async () => {
    const geo = await getGeoPlace();
    if (geo) {
      await loadPlace(geo);
      setActiveNav(navHome);
      showView(viewHome);
    }
  });

  searchForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = (searchInput?.value || "").trim();
    if (!q) return;
    const results = await searchPlaces(q);
    renderSearchResults(results);
  });

  // -----------------------------
  // INIT
  // -----------------------------
  (async () => {
    // Default view
    setActiveNav(navHome);
    showView(viewHome);

    // Prefer geolocation once on first load if we don’t have a last place saved
    const last = loadLastPlace();
    if (last) {
      await loadPlace(last);
      return;
    }

    const geo = await getGeoPlace();
    if (geo) {
      await loadPlace(geo);
    } else {
      await loadPlace(DEFAULT_PLACE);
    }
  })();
})();

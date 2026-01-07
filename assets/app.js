// assets/app.js
(() => {
  const C = window.PW_CONFIG;

  // ---------------- DOM helpers
  const $ = (id) => document.getElementById(id);

  const dom = {
    // Background
    bgImg: $("bgImg"),

    // Topbar
    cityLine: $("cityLine"),
    subhead: $("subhead"),
    updatedAt: $("updatedAt"),

    // Home hero
    confidenceTop: $("confidenceTop"),
    conditionText: $("conditionText"),
    bigTemp: $("bigTemp"),
    wittyLine: $("wittyLine"),

    // Home cards
    todayExtremeKicker: $("todayExtremeKicker"),
    todayExtremeTitle: $("todayExtremeTitle"),
    todayExtremeRange: $("todayExtremeRange"),
    rainSummary: $("rainSummary"),
    uvSummary: $("uvSummary"),
    confidenceTitle: $("confidenceTitle"),
    confidenceSub: $("confidenceSub"),

    // Lists
    hourlyList: $("hourlyList"),
    weekList: $("weekList"),

    // Search
    searchInput: $("searchInput"),
    searchBtn: $("searchBtn"),

    // Settings
    sourcesList: $("sourcesList"),

    // Screens
    screens: {
      home: $("screen-home"),
      hourly: $("screen-hourly"),
      week: $("screen-week"),
      search: $("screen-search"),
      settings: $("screen-settings"),
    },
  };

  const state = {
    // fallback city if geo fails/blocked
    fallbackCity: "Cape Town",

    // What we send to /api/weather?q=
    cityQuery: "Cape Town",

    // Last data
    data: null,
  };

  // ---------------- formatting helpers
  const isNum = (v) => typeof v === "number" && Number.isFinite(v);

  const fmtTemp = (c) => (isNum(c) ? `${Math.round(c)}°` : "—");
  const fmtRange = (lowC, highC) => {
    if (!isNum(lowC) && !isNum(highC)) return "—";
    if (isNum(lowC) && isNum(highC)) return `${Math.round(lowC)}–${Math.round(highC)}°`;
    return isNum(lowC) ? `${Math.round(lowC)}°` : `${Math.round(highC)}°`;
  };

  const rainCopy = (pct) => {
    if (!isNum(pct)) return "—";
    if (pct < 10) return "None expected";
    if (pct < 30) return "Unlikely";
    if (pct < 55) return "Possible";
    return "Likely";
  };

  const uvBand = (uv) => {
    if (!isNum(uv)) return "—";
    if (uv < 3) return "Low";
    if (uv < 6) return "Moderate";
    if (uv < 8) return "High";
    if (uv < 11) return "Very High";
    return "Extreme";
  };

  const confidenceLabel = (key) => {
    const map = C?.confidence || {};
    if (key && map[key]?.label) return map[key].label;
    if (key === "strong") return "High";
    if (key === "decent") return "Medium";
    return "Low";
  };

  const confidenceTopLine = (label) => `PROBABLY · ${String(label).toUpperCase()} CONFIDENCE`;

  const wittyFor = (conditionKey, daily0) => {
    const high = daily0?.highC;
    const rain = daily0?.rainChance;

    if (conditionKey === "clear") {
      if (isNum(high) && high >= 26) return "Braai weather, boet!";
      return "Looks good outside.";
    }
    if (conditionKey === "rain" || conditionKey === "storm") {
      if (isNum(rain) && rain >= 60) return "Plan B. Then Plan C.";
      return "Maybe. Maybe not. Probably wet.";
    }
    if (conditionKey === "cloudy") return "50/50 weather.";
    if (conditionKey === "wind") return "Hold onto your hat.";
    if (conditionKey === "fog") return "Drive like you’ve got sense.";
    return "Just… probably.";
  };

  // ---------------- background logic
  function getTimeOfDayLabel() {
    const h = new Date().getHours();
    if (h >= 5 && h < 8) return "dawn";
    if (h >= 8 && h < 17) return "day";
    if (h >= 17 && h < 20) return "dusk";
    return "night";
  }

  function setBackground(conditionKey) {
    const key = conditionKey || "cloudy";
    const folder =
      C?.assets?.conditionToFolder?.[key] ||
      C?.assets?.fallbackFolder ||
      "cloudy";

    const tod = getTimeOfDayLabel();
    const base = C?.assets?.bgBasePath || "/assets/images/bg";
    const src = `${base}/${folder}/${tod}.jpg`;

    dom.bgImg.src = src;
  }

  // ---------------- screen nav
  function showScreen(target) {
    const screens = dom.screens;
    Object.keys(screens).forEach((k) => {
      if (!screens[k]) return;
      screens[k].hidden = k !== target;
    });

    document.querySelectorAll(".nav-btn").forEach((btn) => {
      const t = btn.getAttribute("data-target");
      btn.classList.toggle("is-active", t === target);
    });
  }

  // ---------------- geo helpers (browser coords -> "City, Country")
  function getBrowserLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        (err) => reject(err),
        {
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 10 * 60 * 1000,
        }
      );
    });
  }

  async function reverseGeocodeToCityCountry(lat, lon) {
    // Nominatim reverse geocode (single call on boot).
    // We only need: a place name and a country name/code.
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=14&addressdetails=1`;

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Reverse geocode failed: HTTP ${res.status}`);

    const json = await res.json();
    const addr = json?.address || {};

    const city =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.suburb ||
      addr.hamlet ||
      addr.county ||
      "";

    // user said they don’t care if code or name; prefer name for clarity.
    const country =
      addr.country ||
      (addr.country_code ? String(addr.country_code).toUpperCase() : "");

    const cityClean = String(city || "").trim();
    const countryClean = String(country || "").trim();

    if (!cityClean && !countryClean) return "";
    if (cityClean && countryClean) return `${cityClean}, ${countryClean}`;
    return cityClean || countryClean;
  }

  // ---------------- renderers
  function renderHome(data) {
    const name = data?.location?.name || state.cityQuery || "—";
    const country = data?.location?.country || "";
    dom.cityLine.textContent = country ? `${name}, ${country}` : name;

    const daily0 = data?.daily?.[0] || {};
    const now = data?.now || {};

    const conditionLabel = (now?.conditionLabel || daily0?.conditionLabel || "Unclear").toLowerCase();
    dom.conditionText.textContent = `This is ${conditionLabel}.`;
    dom.bigTemp.textContent = fmtRange(daily0?.lowC, daily0?.highC);

    const cKey = data?.consensus?.confidenceKey || "mixed";
    const cLabel = confidenceLabel(cKey);
    dom.confidenceTop.textContent = confidenceTopLine(cLabel);

    dom.wittyLine.textContent = wittyFor(now?.conditionKey, daily0);

    dom.todayExtremeTitle.textContent = daily0?.conditionLabel || now?.conditionLabel || "—";
    dom.todayExtremeRange.textContent = fmtRange(daily0?.lowC, daily0?.highC);

    const rainPct = isNum(daily0?.rainChance) ? daily0.rainChance : now?.rainChance;
    dom.rainSummary.textContent = rainCopy(rainPct);

    const uv = daily0?.uv;
    dom.uvSummary.textContent = isNum(uv) ? `${uvBand(uv)} (${Math.round(uv)})` : "—";

    dom.confidenceTitle.textContent = cLabel;
    const n = Array.isArray(data?.meta?.sources) ? data.meta.sources.length : 0;
    dom.confidenceSub.textContent = n ? `Based on ${n} forecasts →` : "—";

    dom.updatedAt.textContent = data?.meta?.updatedAtLabel || "—";
    if (dom.sourcesList) {
      dom.sourcesList.textContent = Array.isArray(data?.meta?.sources)
        ? data.meta.sources.join(" · ")
        : "—";
    }

    setBackground(now?.conditionKey || daily0?.conditionKey);
  }

  function renderHourly(data) {
    const items = Array.isArray(data?.hourly) ? data.hourly : [];
    dom.hourlyList.innerHTML = "";

    items.slice(0, 24).forEach((h) => {
      const row = document.createElement("div");
      row.className = "list-row";

      const left = document.createElement("div");
      left.className = "list-left";
      left.innerHTML = `
        <div class="list-time">${h?.timeLocal || "—"}</div>
        <div class="list-cond">${h?.conditionLabel || "—"}</div>
      `;

      const mid = document.createElement("div");
      mid.className = "list-mid";
      mid.textContent = fmtTemp(h?.tempC);

      const right = document.createElement("div");
      right.className = "list-right";
      const rain = isNum(h?.rainChance) ? `${Math.round(h.rainChance)}%` : "—";
      const wind = isNum(h?.windKph) ? `${Math.round(h.windKph)} km/h` : "—";
      right.textContent = `${rain} · ${wind}`;

      row.appendChild(left);
      row.appendChild(mid);
      row.appendChild(right);
      dom.hourlyList.appendChild(row);
    });
  }

  function renderWeek(data) {
    const items = Array.isArray(data?.daily) ? data.daily : [];
    dom.weekList.innerHTML = "";

    items.slice(0, 7).forEach((d) => {
      const row = document.createElement("div");
      row.className = "list-row";

      const left = document.createElement("div");
      left.className = "list-left";
      left.innerHTML = `
        <div class="list-day">${d?.dayLabel || "—"}</div>
        <div class="list-cond">${d?.conditionLabel || "—"}</div>
      `;

      const mid = document.createElement("div");
      mid.className = "list-mid";
      mid.textContent = `${fmtTemp(d?.highC)} / ${fmtTemp(d?.lowC)}`;

      const right = document.createElement("div");
      right.className = "list-right";
      const rain = isNum(d?.rainChance) ? `${Math.round(d.rainChance)}%` : "—";
      const uv = isNum(d?.uv) ? `UV ${Math.round(d.uv)}` : "UV —";
      right.textContent = `${rain} · ${uv}`;

      row.appendChild(left);
      row.appendChild(mid);
      row.appendChild(right);
      dom.weekList.appendChild(row);
    });
  }

  function renderAll(data) {
    renderHome(data);
    renderHourly(data);
    renderWeek(data);
  }

  // ---------------- data fetch
  async function loadCity(cityQuery) {
    const q = (cityQuery || "").trim();
    if (!q) return;

    state.cityQuery = q;

    try {
      const url = `${C?.endpoints?.weather || "/api/weather"}?q=${encodeURIComponent(q)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`HTTP ${res.status}: ${t}`);
      }
      const data = await res.json();
      state.data = data;
      renderAll(data);
    } catch (err) {
      console.error(err);
      dom.conditionText.textContent = "This is unclear.";
      dom.bigTemp.textContent = "—";
      dom.wittyLine.textContent = "Something’s not pulling through.";
      dom.confidenceTop.textContent = "PROBABLY · LOW CONFIDENCE";
      dom.confidenceTitle.textContent = "Low";
      dom.confidenceSub.textContent = "Check the API / key.";
      setBackground("cloudy");
    }
  }

  // ---------------- events
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = btn.getAttribute("data-target");
      if (t) showScreen(t);
    });
  });

  if (dom.searchBtn && dom.searchInput) {
    dom.searchBtn.addEventListener("click", () => {
      const v = (dom.searchInput.value || "").trim();
      if (!v) return;
      loadCity(v);
      showScreen("home");
    });

    dom.searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") dom.searchBtn.click();
    });
  }

  // ---------------- boot (geo -> "City, Country" -> load)
  async function boot() {
    showScreen("home");
    setBackground("cloudy");

    try {
      const pos = await getBrowserLocation();
      const lat = pos?.coords?.latitude;
      const lon = pos?.coords?.longitude;

      if (isNum(lat) && isNum(lon)) {
        const q = await reverseGeocodeToCityCountry(lat, lon);

        // If we got something usable, use it (more specific than "Strand")
        if (q) {
          await loadCity(q);
          return;
        }
      }

      // If geo didn’t produce a query, fall back
      await loadCity(state.fallbackCity);
    } catch (err) {
      // Permission blocked / timeout / unsupported — just fall back
      console.warn("[PW] Geolocation unavailable, using fallback city.", err);
      await loadCity(state.fallbackCity);
    }
  }

  boot();
})();

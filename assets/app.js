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
    city: "", // IMPORTANT: no Cape Town fallback
    data: null,
    usingGeo: false,
    geoLabel: "",
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
    const folder = C?.assets?.conditionToFolder?.[key] || C?.assets?.fallbackFolder || "cloudy";

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
  // --- Dominant “vibe” condition (used for hero text + background) ---
const WIND_KPH = 25;
const RAIN_PCT = 50;
const HEAT_C = 32;
const COLD_C = 16;

function pickDominantConditionKey(now, daily0) {
  const keyNow = String(now?.conditionKey || "").toLowerCase();
  const keyDay = String(daily0?.conditionKey || "").toLowerCase();

  const rainNow = Number.isFinite(now?.rainChance) ? now.rainChance : null;
  const rainDay = Number.isFinite(daily0?.rainChance) ? daily0.rainChance : null;
  const rainChance = Math.max(rainNow ?? -1, rainDay ?? -1);

  const windKph = Number.isFinite(now?.windKph) ? now.windKph : null;
  const highC = Number.isFinite(daily0?.highC) ? daily0.highC : null;
  const lowC = Number.isFinite(daily0?.lowC) ? daily0.lowC : null;

  // 1) Storm (if present in condition keys)
  if (
    keyNow.includes("thunder") || keyNow.includes("storm") ||
    keyDay.includes("thunder") || keyDay.includes("storm")
  ) {
    return "storm";
  }

  // 2) Rain overrides (your rule)
  if (rainChance >= RAIN_PCT) return "rain";

  // 3) Fog / low cloud overrides
  if (
    keyNow.includes("fog") || keyNow.includes("mist") || keyNow.includes("lowcloud") ||
    keyDay.includes("fog") || keyDay.includes("mist") || keyDay.includes("lowcloud")
  ) {
    return "fog";
  }

  // 4) Wind (folder name is "wind", label will say "windy")
  if (windKph != null && windKph >= WIND_KPH) return "wind";

  // 5) Heat
  if (highC != null && highC >= HEAT_C) return "heat";

  // 6) Cold
  if (lowC != null && lowC <= COLD_C) return "cold";

  // 7) Fall back to API condition keys
  if (keyNow) return keyNow;
  if (keyDay) return keyDay;

  return "clear";
}

function dominantLabelFromKey(key) {
  const k = String(key || "").toLowerCase();
  if (k === "wind") return "windy";
  if (k === "heat") return "hot";
  if (k === "cold") return "cold";
  if (k === "fog") return "foggy";
  if (k === "storm") return "stormy";
  if (k === "clear") return "clear";
  if (k === "cloudy") return "cloudy";
  if (k === "rain") return "rainy";
  return k || "unclear";
}


  // ---------------- renderers
  function renderHome(data) {
    // If we got a reverse-geocoded label, show that.
    if (state.usingGeo && state.geoLabel) {
      dom.cityLine.textContent = state.geoLabel;
    } else {
      const name = data?.location?.name || state.city || "—";
      const country = data?.location?.country || "";
      dom.cityLine.textContent = country ? `${name}, ${country}` : name;
    }

    const daily0 = data?.daily?.[0] || {};
    const now = data?.now || {};





    const conditionLabel = (now?.conditionLabel || daily0?.conditionLabel || "Unclear").toLowerCase();
    const dominantKey = pickDominantConditionKey(now, daily0);
    const dominantLabel = dominantLabelFromKey(dominantKey);
    dom.conditionText.textContent = `This is ${dominantLabel}.`;
    
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
 dom.confidenceSub.textContent = n ? `Temperature agreement across ${n} forecasts →` : "—";


    dom.updatedAt.textContent = data?.meta?.updatedAtLabel || "—";
    if (dom.sourcesList) {
      dom.sourcesList.textContent = Array.isArray(data?.meta?.sources)
        ? data.meta.sources.map((s) => s?.name || s).join(" · ")
        : "—";
    }
    setBackground(dominantKey);

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

  function renderGeoBlocked() {
    dom.cityLine.textContent = "Location unavailable — search for a city";
    dom.conditionText.textContent = "This is unclear.";
    dom.bigTemp.textContent = "—";
    dom.wittyLine.textContent = "Allow location or search.";
    dom.confidenceTop.textContent = "PROBABLY · LOW CONFIDENCE";
    dom.confidenceTitle.textContent = "Low";
    dom.confidenceSub.textContent = "Waiting for a location.";
    dom.updatedAt.textContent = "—";
    if (dom.sourcesList) dom.sourcesList.textContent = "—";
    setBackground("cloudy");
  }

  // ---------------- data fetch
  async function loadCity(city) {
    const q = (city || "").trim();
    if (!q) return;

    state.city = q;
    state.usingGeo = false;
    state.geoLabel = "";

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

  async function reverseGeocodeLabel(lat, lon) {
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
      );
      if (!r.ok) return "";
      const j = await r.json();
      const a = j.address || {};
      const city = a.town || a.city || a.village || a.suburb || a.hamlet || "";
      const country = a.country || "";
      if (city && country) return `${city}, ${country}`;
      if (city) return city;
      return "";
    } catch {
      return "";
    }
  }

  async function loadCoords(lat, lon) {
    state.usingGeo = true;
    state.city = "";
    state.geoLabel = "";

    try {
      const url = `${C?.endpoints?.weather || "/api/weather"}?lat=${encodeURIComponent(
        lat
      )}&lon=${encodeURIComponent(lon)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`HTTP ${res.status}: ${t}`);
      }
      const data = await res.json();
      state.data = data;
      renderAll(data);

      // display-only label (does not affect weather)
      const label = await reverseGeocodeLabel(lat, lon);
      if (label) {
        state.geoLabel = label;
        // update header without rerendering everything
        dom.cityLine.textContent = label;
      }
    } catch (err) {
      console.error(err);
      renderGeoBlocked();
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

  // ---------------- boot
  showScreen("home");
  setBackground("cloudy");

  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        loadCoords(lat, lon);
      },
      () => {
        // No fallback city: user must search
        renderGeoBlocked();
      },
      { timeout: 8000, maximumAge: 60000, enableHighAccuracy: false }
    );
  } else {
    renderGeoBlocked();
  }
})();

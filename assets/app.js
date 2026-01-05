// assets/app.js
(() => {
  const C = window.PW_CONFIG;

  const $ = (id) => document.getElementById(id);
  const $q = (sel) => document.querySelector(sel);

  const dom = {
    subhead: $("subhead"),
    updatedAt: $("updatedAt"),
    cityName: $("cityName"),
    countryName: $("countryName"),
    bigTemp: $("bigTemp"),
    conditionText: $("conditionText"),
    wittyLine: $("wittyLine"),

    // NOTE: keeping IDs so layout doesn't break, but we repurpose the content
    confidencePill: $("confidencePill"),
    confidenceNote: $("confidenceNote"),

    feelsLike: $("feelsLike"),
    windKph: $("windKph"),
    humidity: $("humidity"),
    rainChance: $("rainChance"),

    toneTitle: $("toneTitle"),
    toneVibe: $("toneVibe"),
    toneNote: $("toneNote"),

    // NEW: explanation card
    agreementLabel: $("agreementLabel"),
    agreementNote: $("agreementNote"),
    sourcesBreakdown: $("sourcesBreakdown"),

    hourlyList: $("hourlyList"),
    weekList: $("weekList"),

    searchInput: $("searchInput"),
    searchBtn: $("searchBtn"),
    searchHint: $("searchHint"),

    sourcesList: $("sourcesList"),

    screenHourly: $("screen-hourly"),
    screenWeek: $("screen-week"),
    screenSearch: $("screen-search"),
    screenSettings: $("screen-settings"),
  };

  function fmtC(v) {
    if (v === null || v === undefined || !Number.isFinite(Number(v))) return "—";
    return `${Math.round(Number(v))}°C`;
  }
  function fmtCShort(v) {
    if (v === null || v === undefined || !Number.isFinite(Number(v))) return "—";
    return `${Math.round(Number(v))}°`;
  }
  function fmtKph(v) {
    if (v === null || v === undefined || !Number.isFinite(Number(v))) return "—";
    return `${Math.round(Number(v))} km/h`;
  }
  function fmtPct(v) {
    if (v === null || v === undefined || !Number.isFinite(Number(v))) return "—";
    return `${Math.round(Number(v))}%`;
  }

  function pickToneKey(conditionKey) {
    return C.conditionMap?.[conditionKey] || conditionKey || "unknown";
  }

  function getWittyLine(conditionKey, rainChance) {
    const key = pickToneKey(conditionKey);
    const t = C.conditionTone[key] || C.conditionTone.unknown;

    // If it’s clear but rain chance is not tiny, avoid "Braai weather" optimism
    const rc = Number.isFinite(Number(rainChance)) ? Number(rainChance) : null;
    if (key === "clear" && rc !== null && rc >= 35) return "Looks good… but keep a plan B.";

    if (typeof t.witty === "function") return t.witty(rc);
    if (typeof t.witty === "string") return t.witty;

    // fallback
    if (key === "clear") return "Braai weather, boet!";
    return t.vibe;
  }

  function renderTone(conditionKey) {
    const key = pickToneKey(conditionKey);
    const t = C.conditionTone[key] || C.conditionTone.unknown;
    dom.toneTitle.textContent = t.title;
    dom.toneVibe.textContent = t.vibe;
    dom.toneNote.textContent = t.note;
  }

  // HERO meta: no more duplicate "confidence" language here
  function renderHeroMeta(data) {
    const n = data?.meta?.sources?.length || 0;
    // simple, intentional language
    dom.confidencePill.textContent = n ? `Based on ${n} forecasts` : "Based on forecasts";
    dom.confidenceNote.textContent = "A combined read from multiple sources.";
  }

  // Right-side explanation: agreement + what each source is saying
  function renderWhyProbably(confKey, data) {
    const conf = C.confidence[confKey] || C.confidence.mixed;

    dom.agreementLabel.textContent = `${conf.label} agreement`;
    dom.agreementNote.textContent = conf.long;

    const list = data?.meta?.sources;
    if (!Array.isArray(list) || list.length === 0) {
      dom.sourcesBreakdown.textContent = "—";
      return;
    }

    // Each source line: Name — Condition · Temp (or down)
    const lines = list.map((s) => {
      const name = s?.name || "Source";
      const ok = !!s?.ok;

      if (!ok) return `${name}: unavailable`;

      const cond = s?.conditionLabel || "Unclear";
      const t = Number.isFinite(Number(s?.tempC)) ? `${Math.round(Number(s.tempC))}°` : "—";
      return `${name}: ${cond} · ${t}`;
    });

    dom.sourcesBreakdown.textContent = lines.join(" • ");
  }

  function renderSources(list) {
    // Settings screen source string: human-friendly (no [object Object])
    if (!Array.isArray(list) || list.length === 0) {
      dom.sourcesList.textContent = "—";
      return;
    }
    dom.sourcesList.textContent = list
      .map((s) => `${s.name}${s.ok ? "" : " (down)"}`)
      .join(" • ");
  }

  function renderHourly(hourly) {
    dom.hourlyList.innerHTML = "";
    if (!Array.isArray(hourly) || hourly.length === 0) {
      dom.hourlyList.textContent = "No hourly data.";
      return;
    }

    hourly.forEach((h) => {
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `
        <div class="row-left">
          <div class="row-time">${h.timeLocal || "—"}</div>
          <div class="row-sub">${h.conditionLabel || "—"}</div>
        </div>
        <div class="row-mid">${fmtCShort(h.tempC)}</div>
        <div class="row-right">${fmtPct(h.rainChance)} · ${fmtKph(h.windKph)}</div>
      `;
      dom.hourlyList.appendChild(row);
    });
  }

  function renderWeek(daily) {
    dom.weekList.innerHTML = "";
    if (!Array.isArray(daily) || daily.length === 0) {
      dom.weekList.textContent = "No weekly data.";
      return;
    }

    daily.forEach((d) => {
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `
        <div class="row-left">
          <div class="row-time">${d.dayLabel || "—"}</div>
          <div class="row-sub">${d.conditionLabel || "—"}</div>
        </div>
        <div class="row-mid">${fmtCShort(d.highC)} / ${fmtCShort(d.lowC)}</div>
        <div class="row-right">${fmtPct(d.rainChance)} · UV ${d.uv ?? "—"}</div>
      `;
      dom.weekList.appendChild(row);
    });
  }

  function setBackground(conditionKey) {
    const key = pickToneKey(conditionKey);
    const bg = C.backgrounds?.[key] || C.backgrounds?.unknown;

    // apply background image to body via CSS var or class (depends on your existing CSS)
    document.body.style.backgroundImage = bg ? `url(${bg})` : "none";
  }

  function showScreen(which) {
    // hide all
    dom.screenHourly.hidden = true;
    dom.screenWeek.hidden = true;
    dom.screenSearch.hidden = true;
    dom.screenSettings.hidden = true;

    // show chosen
    if (which === "hourly") dom.screenHourly.hidden = false;
    else if (which === "week") dom.screenWeek.hidden = false;
    else if (which === "search") dom.screenSearch.hidden = false;
    else if (which === "settings") dom.screenSettings.hidden = false;
  }

  function setActiveNav(target) {
    document.querySelectorAll(".nav-btn").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.target === target);
    });
  }

  async function fetchWeather(params) {
    const qs = new URLSearchParams(params);
    const r = await fetch(`/api/weather?${qs.toString()}`);
    if (!r.ok) throw new Error(`Weather fetch failed: ${r.status}`);
    return await r.json();
  }

  function renderHome(data) {
    dom.updatedAt.textContent = data?.meta?.updatedAtLabel || "—";
    dom.cityName.textContent = data?.location?.city || "—";

    // country string
    const bits = [data?.location?.admin1, data?.location?.country].filter(Boolean);
    dom.countryName.textContent = bits.join(", ");

    // hero temps (today range if available, else now temp)
    const low = data?.today?.lowC;
    const high = data?.today?.highC;

    if (Number.isFinite(Number(low)) && Number.isFinite(Number(high))) {
      dom.bigTemp.textContent = `${Math.round(low)}°C—${Math.round(high)}°C`;
    } else {
      dom.bigTemp.textContent = fmtC(data?.now?.tempC);
    }

    // hero statement
    const key = data?.today?.conditionKey || data?.now?.conditionKey;
    const heroKey = pickToneKey(key);
    const heroTone = C.conditionTone?.[heroKey] || C.conditionTone.unknown;

    dom.conditionText.textContent = heroTone.hero || `This is ${heroTone.title?.toLowerCase() || "weather"}.`;
    dom.wittyLine.textContent = getWittyLine(key, data?.now?.rainChance);

    // details
    dom.feelsLike.textContent = fmtC(data?.now?.feelsLikeC);
    dom.windKph.textContent = fmtKph(data?.now?.windKph);
    dom.humidity.textContent = fmtPct(data?.now?.humidity);
    dom.rainChance.textContent = fmtPct(data?.now?.rainChance);

    // tone + agreement explanation
    renderTone(data?.now?.conditionKey);
    renderHeroMeta(data);
    renderWhyProbably(data?.consensus?.confidenceKey, data);

    // settings sources list
    renderSources(data?.meta?.sources);

    setBackground(key);
  }

  // Wire nav buttons
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = btn.dataset.target;
      setActiveNav(t);
      if (t === "home") {
        showScreen(null);
      } else {
        showScreen(t);
      }
    });
  });

  // Search
  if (dom.searchBtn) {
    dom.searchBtn.addEventListener("click", async () => {
      const q = (dom.searchInput.value || "").trim();
      if (!q) return;
      try {
        const data = await fetchWeather({ city: q });
        // go home view after search
        setActiveNav("home");
        showScreen(null);
        renderHome(data);
      } catch (e) {
        dom.searchHint.textContent = "Could not fetch that location. Try another city.";
        console.error(e);
      }
    });
  }

  // Initial load: default city from config
  (async function init() {
    try {
      const data = await fetchWeather({ city: C.defaultCity || "Cape Town" });
      renderHome(data);
      // pre-render screens (so switching feels instant)
      renderHourly(data.hourly);
      renderWeek(data.daily);
    } catch (e) {
      console.error(e);
      dom.conditionText.textContent = "Could not load weather.";
      dom.wittyLine.textContent = "Check your connection and try again.";
    }
  })();
})();

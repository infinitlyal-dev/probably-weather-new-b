/* Probably Weather — assets/app.js
   Single-file, static-host friendly.
   Aggregates Open-Meteo + WeatherAPI + OpenWeatherMap into a "probable" forecast (median + confidence).
*/

document.addEventListener("DOMContentLoaded", () => {
  // ---------- DOM ----------
  const body = document.body;

  const bgImg = document.getElementById("bgImg");
  const particles = document.getElementById("particles");
  const heatOverlay = document.getElementById("heatOverlay");
  const loader = document.getElementById("loader");
  const toast = document.getElementById("toast");

  const locationEl = document.getElementById("location");
  const saveCurrentBtn = document.getElementById("saveCurrent");

  const homeScreen = document.getElementById("home-screen");
  const hourlyScreen = document.getElementById("hourly-screen");
  const weekScreen = document.getElementById("week-screen");
  const searchScreen = document.getElementById("search-screen");
  const settingsScreen = document.getElementById("settings-screen");

  const navHome = document.getElementById("navHome");
  const navHourly = document.getElementById("navHourly");
  const navWeek = document.getElementById("navWeek");
  const navSearch = document.getElementById("navSearch");
  const navSettings = document.getElementById("navSettings");

  const confidenceEl = document.getElementById("confidence");
  const headlineEl = document.getElementById("headline");
  const tempEl = document.getElementById("temp");
  const descriptionEl = document.getElementById("description");

  const extremeLabelEl = document.getElementById("extremeLabel");
  const extremeValueEl = document.getElementById("extremeValue");
  const rainValueEl = document.getElementById("rainValue");
  const uvValueEl = document.getElementById("uvValue");
  const confidenceValueEl = document.getElementById("confidenceValue");
  const confidenceBarEl = document.getElementById("confidenceBar");

  const hourlyTimeline = document.getElementById("hourlyTimeline");
  const dailyCards = document.getElementById("dailyCards");

  const searchInput = document.getElementById("searchInput");
  const favoritesList = document.getElementById("favoritesList");
  const recentList = document.getElementById("recentList");
  const manageFavoritesBtn = document.getElementById("manageFavorites");

  const unitsSelect = document.getElementById("units");
  const themeSelect = document.getElementById("theme");

  // ---------- CONFIG ----------
  // NOTE: these keys are now in the client bundle (public). Rotate them later since they were shared in chat.
  const WEATHERAPI_KEY = "a98886bfef6c4dcd8bf111514251512";
  const OPENWEATHER_KEY = "a56be2054510bc8fed22998c68972876";

  const FALLBACK = { name: "Strand, WC", lat: -34.106, lon: 18.827 };
  const STORAGE = {
    last: "lastWeatherData_v2",
    favs: "probablyFavorites",
    recents: "probablyRecents",
    units: "probablyUnits",
    theme: "probablyTheme",
  };

  // Particles counts by condition
  const PARTICLE_COUNTS = {
    clear: 0,
    fog: 22,
    cold: 26,
    heat: 14,
    wind: 26,
    rain: 60,
    storm: 90,
  };

  // ---------- STATE ----------
  let currentLat = FALLBACK.lat;
  let currentLon = FALLBACK.lon;
  let currentName = FALLBACK.name;

  let favorites = safeParse(localStorage.getItem(STORAGE.favs), []);
  let recents = safeParse(localStorage.getItem(STORAGE.recents), []);

  let manageMode = false;
  let lastHumorPick = ""; // to reduce repetition

  const units = (localStorage.getItem(STORAGE.units) || "C").toUpperCase();
  const theme = (localStorage.getItem(STORAGE.theme) || "auto").toLowerCase();
  unitsSelect.value = units === "F" ? "F" : "C";
  themeSelect.value = ["auto", "light", "dark"].includes(theme) ? theme : "auto";

  // ---------- HUMOR ----------
  const HUMOR = {
    clear: {
      dawn: [
        "Clear dawn—sunrise is doing the most.",
        "Crisp morning vibes. Kettle on, world off.",
        "Clear skies. Your alarm clock is the birds now.",
      ],
      day: [
        "Braai weather, boet!",
        "Blue skies. Big plans. Minimal regrets.",
        "It’s giving: shorts, shades, and confidence.",
      ],
      dusk: [
        "Golden hour is clocking in—enjoy it.",
        "Clear evening. Sunset: 10/10, would watch again.",
        "Lekker dusk. The day’s drama is over.",
      ],
      night: [
        "Clear night—stars are showing off.",
        "Perfect stargazing weather. Make a wish.",
        "Still, clear, and quiet… suspiciously peaceful.",
      ],
    },
    rain: {
      dawn: [
        "Rainy morning—toast tastes better in this weather.",
        "The clouds started early. Typical.",
        "Umbrella energy from sunrise, sorry.",
      ],
      day: [
        "The clouds are crying like NZ at the ’23 World Cup!",
        "Rain on the schedule. Mood: indoors.",
        "If you’re braaing today… you’re committed.",
      ],
      dusk: [
        "Evening rain—blanket and series weather.",
        "Wet roads, bright lights. Drive like a grown-up.",
        "Rain at dusk: romantic… until you’re soaked.",
      ],
      night: [
        "Night rain—sleep soundtrack unlocked.",
        "Pitter-patter vibes. Just don’t overthink life.",
        "Rainy night. Lock the gate and relax.",
      ],
    },
    storm: {
      dawn: [
        "Stormy dawn—someone upset the sky.",
        "Thunder at sunrise. The weather is fighting.",
        "Stay in bed if you can. If not… good luck.",
      ],
      day: [
        "Thunder’s rolling—don’t get zapped!",
        "Storm mode: activated. Charge your phone, hey.",
        "If the power trips, just call it ambience.",
      ],
      dusk: [
        "Evening storm—candles might be your vibe.",
        "Lightning at dusk. The sky’s doing special effects.",
        "Secure the bins. Secure your life.",
      ],
      night: [
        "Stormy night—sleep if you’re brave.",
        "If it rattles, it’s just… character-building.",
        "Thunder outside. Peace inside. Hopefully.",
      ],
    },
    wind: {
      dawn: [
        "Windy dawn—hairdo beware!",
        "The Cape Doctor is doing overtime.",
        "Hold onto your coffee. And your dignity.",
      ],
      day: [
        "Gale force—your bakkie might fly!",
        "Wind so strong it’s editing your thoughts.",
        "Bin day + wind day = chaos season.",
      ],
      dusk: [
        "Evening gusts—secure the bins!",
        "Wind at dusk… dramatic for no reason.",
        "Jacket? Yes. Stylish? Maybe.",
      ],
      night: [
        "Howling night—close the windows.",
        "If it whistles, it’s not ghosts. It’s just wind. Probably.",
        "Sleep tight—nature is practicing sound effects.",
      ],
    },
    heat: {
      dawn: [
        "Warm start—early braai? Don’t tempt us.",
        "Morning already hot. The sun woke up angry.",
        "Hydrate before you even blink.",
      ],
      day: [
        "Frying an egg is a real option.",
        "Heatwave vibes. Shade is a lifestyle.",
        "If you’re wearing jeans today… respect.",
      ],
      dusk: [
        "Hot evening—ice cream time!",
        "Sunset’s cute but the heat stayed.",
        "Braai? Yes. Standing near fire? Questionable.",
      ],
      night: [
        "Sizzling night—fan on full.",
        "Sleep is a suggestion in this heat.",
        "If your pillow is warm… we’re in trouble.",
      ],
    },
    cold: {
      dawn: [
        "Chilly start—coffee and blankets time!",
        "Cold morning. Your bones know.",
        "If you see frost, don’t act surprised.",
      ],
      day: [
        "Jacket weather. No debates.",
        "Cold day—perfect excuse for a potjie.",
        "If you leave the house, do it respectfully.",
      ],
      dusk: [
        "Freezing evening—rug up tight!",
        "Cold at dusk. Soup time. Immediately.",
        "This is ‘two pairs of socks’ weather.",
      ],
      night: [
        "Polar bear weather—stay warm!",
        "If you can see your breath indoors… shame.",
        "Winter is auditioning. It got the role.",
      ],
    },
    fog: {
      dawn: [
        "Foggy dawn—ghostly start.",
        "Misty morning. Visibility: vibes only.",
        "Drive like you have sense, please.",
      ],
      day: [
        "Misty mayhem—can’t see your braai from the stoep!",
        "Fog is committed today. Headlights on.",
        "If you’re late, blame the fog. Works every time.",
      ],
      dusk: [
        "Evening fog—early lights on.",
        "Fog at dusk = spooky season.",
        "Take it slow. The road is hiding.",
      ],
      night: [
        "Foggy night—watch your step!",
        "Mist + streetlights = movie scene.",
        "If something moves… it’s probably just a cat. Probably.",
      ],
    },
  };

  // ---------- NAV / SCREENS ----------
  const SCREENS = [homeScreen, hourlyScreen, weekScreen, searchScreen, settingsScreen];
  const NAVS = [navHome, navHourly, navWeek, navSearch, navSettings];

  function setActiveNav(btn) {
    NAVS.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  }

  function showScreen(screen) {
    SCREENS.forEach((s) => s.classList.add("hidden"));
    screen.classList.remove("hidden");

    if (screen === homeScreen) setActiveNav(navHome);
    if (screen === hourlyScreen) setActiveNav(navHourly);
    if (screen === weekScreen) setActiveNav(navWeek);
    if (screen === searchScreen) {
      setActiveNav(navSearch);
      renderFavorites();
      renderRecents();
    }
    if (screen === settingsScreen) setActiveNav(navSettings);
  }

  navHome.addEventListener("click", () => showScreen(homeScreen));
  navHourly.addEventListener("click", () => showScreen(hourlyScreen));
  navWeek.addEventListener("click", () => showScreen(weekScreen));
  navSearch.addEventListener("click", () => showScreen(searchScreen));
  navSettings.addEventListener("click", () => showScreen(settingsScreen));

  // ---------- SETTINGS ----------
  unitsSelect.addEventListener("change", () => {
    localStorage.setItem(STORAGE.units, unitsSelect.value);
    toastMsg("Units updated.");
    const cached = safeParse(localStorage.getItem(STORAGE.last), null);
    if (cached) applyAll(cached);
  });

  themeSelect.addEventListener("change", () => {
    localStorage.setItem(STORAGE.theme, themeSelect.value);
    toastMsg("Theme updated.");
    const cached = safeParse(localStorage.getItem(STORAGE.last), null);
    if (cached) applyThemeAndBg(cached.condition, cached.timeOfDay);
  });

  // ---------- FAVORITES / RECENTS ----------
  manageFavoritesBtn.addEventListener("click", () => {
    manageMode = !manageMode;
    manageFavoritesBtn.textContent = manageMode ? "Done" : "Manage favorites";
    renderFavorites();
  });

  saveCurrentBtn.addEventListener("click", () => {
    const place = { name: currentName, lat: Number(currentLat), lon: Number(currentLon) };
    addFavorite(place);
    toastMsg("Saved.");
  });

  function addFavorite(place) {
    const lat = Number(place.lat);
    const lon = Number(place.lon);
    if (!isFinite(lat) || !isFinite(lon)) return;

    const exists = favorites.some((f) => closeEnough(f.lat, lat) && closeEnough(f.lon, lon));
    if (!exists) {
      favorites.push({ name: place.name, lat, lon });
      if (favorites.length > 5) favorites.shift();
      localStorage.setItem(STORAGE.favs, JSON.stringify(favorites));
    }
    renderFavorites();
  }

  function addRecent(place) {
    const lat = Number(place.lat);
    const lon = Number(place.lon);
    if (!isFinite(lat) || !isFinite(lon)) return;

    recents = recents.filter((r) => !(closeEnough(r.lat, lat) && closeEnough(r.lon, lon)));
    recents.unshift({ name: place.name, lat, lon });
    if (recents.length > 10) recents.pop();
    localStorage.setItem(STORAGE.recents, JSON.stringify(recents));
    renderRecents();
  }

  function renderFavorites() {
    favoritesList.innerHTML = "";
    if (!favorites.length) {
      favoritesList.innerHTML = "<li>None yet.</li>";
      return;
    }

    favorites.forEach((f, idx) => {
      const li = document.createElement("li");
      li.style.cursor = "pointer";
      li.innerHTML = `${escapeHtml(f.name)}${manageMode ? `<span class="remove-fav" title="Remove">×</span>` : ""}`;

      li.addEventListener("click", (e) => {
        const removeClicked = manageMode && e.target && e.target.classList && e.target.classList.contains("remove-fav");
        if (removeClicked) {
          favorites.splice(idx, 1);
          localStorage.setItem(STORAGE.favs, JSON.stringify(favorites));
          renderFavorites();
          return;
        }
        loadPlace(f);
      });

      favoritesList.appendChild(li);
    });
  }

  function renderRecents() {
    recentList.innerHTML = "";
    if (!recents.length) {
      recentList.innerHTML = "<li>Nothing yet.</li>";
      return;
    }
    recents.forEach((r) => {
      const li = document.createElement("li");
      li.style.cursor = "pointer";
      li.textContent = r.name;
      li.addEventListener("click", () => loadPlace(r));
      recentList.appendChild(li);
    });
  }

  // ---------- SEARCH ----------
  searchInput.addEventListener("keyup", async (e) => {
    if (e.key !== "Enter") return;
    const query = searchInput.value.trim();
    if (!query) return;

    const existing = document.querySelector(".search-results-list");
    if (existing) existing.remove();

    const resultsList = document.createElement("ul");
    resultsList.className = "search-results-list";
    searchInput.after(resultsList);
    resultsList.innerHTML = "<li>Loading…</li>";

    try {
      const places = await searchPlaces(query);
      resultsList.innerHTML = "";

      if (!places.length) {
        resultsList.innerHTML = "<li>No places found</li>";
        return;
      }

      places.forEach((p) => {
        const li = document.createElement("li");
        li.innerHTML = `${escapeHtml(p.name)}<br><small>${escapeHtml(p.full)}</small>`;
        li.addEventListener("click", () => {
          loadPlace(p);
          resultsList.remove();
          searchInput.value = "";
        });
        resultsList.appendChild(li);
      });
    } catch (err) {
      console.error(err);
      resultsList.innerHTML = "<li>Search failed</li>";
    }
  });

  async function searchPlaces(query) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=8&addressdetails=1`;
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map((d) => {
      const short = (d.display_name || "").split(",")[0]?.trim() || "Unknown";
      return { name: short, full: d.display_name || short, lat: Number(d.lat), lon: Number(d.lon) };
    }).filter((p) => isFinite(p.lat) && isFinite(p.lon));
  }

  // ---------- CORE: LOAD PLACE ----------
  async function loadPlace(place) {
    if (!place) return;

    currentLat = Number(place.lat);
    currentLon = Number(place.lon);
    currentName = place.name || "Your Location";
    locationEl.textContent = currentName;

    addRecent({ name: currentName, lat: currentLat, lon: currentLon });

    showScreen(homeScreen);
    await fetchAndRender(currentLat, currentLon, currentName);
  }

  // ---------- WEATHER FETCH / AGGREGATION ----------
  async function fetchAndRender(lat, lon, displayName) {
    showLoader(true);

    try {
      const tasks = [
        getOpenMeteo(lat, lon),
        WEATHERAPI_KEY ? getWeatherApi(lat, lon, WEATHERAPI_KEY) : Promise.resolve(null),
        OPENWEATHER_KEY ? getOpenWeather(lat, lon, OPENWEATHER_KEY) : Promise.resolve(null),
      ];

      const results = await Promise.allSettled(tasks);

      const sources = results
        .filter((r) => r.status === "fulfilled" && r.value && r.value.ok)
        .map((r) => slicingHack(r.value)); // defensive clone

      if (!sources.length) throw new Error("All sources failed.");

      const aggregated = aggregateSources(sources, displayName);

      localStorage.setItem(STORAGE.last, JSON.stringify(aggregated));
      applyAll(aggregated);

      saveCurrentBtn.classList.remove("hidden");
    } catch (err) {
      console.error("fetchAndRender failed:", err);
      toastMsg("Couldn’t fetch live data. Using cached/fallback.");
      useCachedOrFallback();
    } finally {
      showLoader(false);
    }
  }

  function slicingHack(obj) {
    // Defensive: avoid weird mutation bugs across renders
    return JSON.parse(JSON.stringify(obj));
  }

  function aggregateSources(sources, displayName) {
    const activeSources = sources.length;

    const hourlyLen = 24;
    const dailyLen = 7;

    const hourly = [];
    for (let i = 0; i < hourlyLen; i++) {
      const temps = sources.map((s) => s.hourly?.[i]?.temp).filter(isNumber);
      const rains = sources.map((s) => s.hourly?.[i]?.rain).filter(isNumber);

      const time = sources.find((s) => s.hourly?.[i]?.time)?.hourly?.[i]?.time || new Date(Date.now() + i * 3600000).toISOString();

      hourly.push({
        time,
        temp: roundSafe(median(temps)),
        rain: clamp01(roundSafe(median(rains))),
      });
    }

    const daily = [];
    for (let i = 0; i < dailyLen; i++) {
      const highs = sources.map((s) => s.daily?.[i]?.high).filter(isNumber);
      const lows = sources.map((s) => s.daily?.[i]?.low).filter(isNumber);
      const rains = sources.map((s) => s.daily?.[i]?.rainChance).filter(isNumber);
      const uvs = sources.map((s) => s.daily?.[i]?.uv).filter(isNumber);
      const winds = sources.map((s) => s.daily?.[i]?.windKph).filter(isNumber);
      const texts = sources.map((s) => s.daily?.[i]?.conditionText).filter(Boolean);

      const date = sources.find((s) => s.daily?.[i]?.date)?.daily?.[i]?.date || new Date(Date.now() + i * 86400000).toISOString();

      daily.push({
        date,
        high: roundSafe(median(highs)),
        low: roundSafe(median(lows)),
        rainChance: clamp01(roundSafe(median(rains))),
        uv: roundSafe(median(uvs)),
        windKph: roundSafe(median(winds)),
        conditionText: mostCommonText(texts) || "",
      });
    }

    const today = daily[0] || {};
    const tempLow = isNumber(today.low) ? today.low : roundSafe(median(sources.map((s) => s.todayLow).filter(isNumber)));
    const tempHigh = isNumber(today.high) ? today.high : roundSafe(median(sources.map((s) => s.todayHigh).filter(isNumber)));
    const rainChance = isNumber(today.rainChance) ? today.rainChance : roundSafe(median(sources.map((s) => s.todayRain).filter(isNumber)));
    const uv = isNumber(today.uv) ? today.uv : roundSafe(median(sources.map((s) => s.todayUv).filter(isNumber)));
    const windKph = isNumber(today.windKph) ? today.windKph : roundSafe(median(sources.map((s) => s.todayWindKph).filter(isNumber)));

    const conditionText = today.conditionText || mostCommonText(sources.map((s) => s.conditionText).filter(Boolean)) || "";
    const condition = determineCondition({
      temp: roundSafe(median([tempLow, tempHigh].filter(isNumber))),
      rain: rainChance,
      windKph,
      conditionText,
    });

    const timeOfDay = getTimeOfDay(new Date().getHours());

    const todayHighs = sources.map((s) => s.todayHigh).filter(isNumber);
    const todayLows = sources.map((s) => s.todayLow).filter(isNumber);
    const todayRains = sources.map((s) => s.todayRain).filter(isNumber);

    const tempSpread = spread([...todayHighs, ...todayLows]);
    const rainSpread = spread(todayRains);

    const confidence = computeConfidence(tempSpread, rainSpread);
    const confidencePct = confidence === "High" ? 90 : confidence === "Medium" ? 60 : 30;

    return {
      ok: true,
      placeName: displayName || "Your Location",
      lat: currentLat,
      lon: currentLon,
      activeSources,
      sourcesUsed: sources.map((s) => s.sourceName).filter(Boolean),
      lowTemp: tempLow,
      highTemp: tempHigh,
      rainChance,
      uv,
      windKph,
      condition,
      conditionText,
      timeOfDay,
      confidence,
      confidencePct,
      hourly,
      daily,
      updatedAt: new Date().toISOString(),
    };
  }

  // ---------- PROVIDERS ----------
  async function getOpenMeteo(lat, lon) {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}` +
      `&current=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,is_day` +
      `&hourly=temperature_2m,precipitation_probability` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,wind_speed_10m_max` +
      `&timezone=auto&forecast_days=7`;

    const data = await fetchJson(url, 7000);
    if (!data || !data.current || !data.daily || !data.hourly) return { ok: false, sourceName: "Open-Meteo" };

    const hourly = [];
    const hTimes = safeArr(data.hourly.time);
    const hTemps = safeArr(data.hourly.temperature_2m);
    const hRains = safeArr(data.hourly.precipitation_probability);

    for (let i = 0; i < 24; i++) {
      hourly.push({
        time: hTimes[i] || new Date(Date.now() + i * 3600000).toISOString(),
        temp: num(hTemps[i]),
        rain: num(hRains[i]),
      });
    }

    const daily = [];
    const dTimes = safeArr(data.daily.time);
    const dHighs = safeArr(data.daily.temperature_2m_max);
    const dLows = safeArr(data.daily.temperature_2m_min);
    const dRains = safeArr(data.daily.precipitation_probability_max);
    const dUvs = safeArr(data.daily.uv_index_max);
    const dWind = safeArr(data.daily.wind_speed_10m_max);

    for (let i = 0; i < 7; i++) {
      daily.push({
        date: dTimes[i] ? new Date(dTimes[i]).toISOString() : new Date(Date.now() + i * 86400000).toISOString(),
        high: num(dHighs[i]),
        low: num(dLows[i]),
        rainChance: num(dRains[i]),
        uv: num(dUvs[i]),
        windKph: isNumber(dWind[i]) ? num(dWind[i]) * 3.6 : null,
        conditionText: "",
      });
    }

    return {
      ok: true,
      sourceName: "Open-Meteo",
      todayLow: num(daily[0]?.low),
      todayHigh: num(daily[0]?.high),
      todayRain: num(daily[0]?.rainChance),
      todayUv: num(daily[0]?.uv),
      todayWindKph: num(daily[0]?.windKph) ?? (num(data.current.wind_speed_10m) ? num(data.current.wind_speed_10m) * 3.6 : null),
      conditionText: "",
      hourly,
      daily,
    };
  }

  async function getWeatherApi(lat, lon, key) {
    const url = `https://api.weatherapi.com/v1/forecast.json?key=${encodeURIComponent(key)}&q=${lat},${lon}&days=7&aqi=no&alerts=no`;
    const data = await fetchJson(url, 7000);
    if (!data || !data.current || !data.forecast || !Array.isArray(data.forecast.forecastday)) return { ok: false, sourceName: "WeatherAPI" };

    const forecastDays = data.forecast.forecastday;

    const hourly = [];
    const now = Date.now();
    const allHours = [];
    forecastDays.forEach((fd) => {
      if (fd && Array.isArray(fd.hour)) allHours.push(...fd.hour);
    });

    const upcoming = allHours
      .map((h) => ({
        time: h.time ? new Date(h.time).toISOString() : null,
        t: num(h.temp_c),
        rain: num(h.chance_of_rain),
      }))
      .filter((h) => h.time && new Date(h.time).getTime() >= now);

    for (let i = 0; i < 24; i++) {
      const h = upcoming[i] || {};
      hourly.push({
        time: h.time || new Date(now + i * 3600000).toISOString(),
        temp: h.t ?? null,
        rain: h.rain ?? null,
      });
    }

    const daily = [];
    for (let i = 0; i < 7; i++) {
      const fd = forecastDays[i];
      daily.push({
        date: fd?.date ? new Date(fd.date).toISOString() : new Date(Date.now() + i * 86400000).toISOString(),
        high: num(fd?.day?.maxtemp_c),
        low: num(fd?.day?.mintemp_c),
        rainChance: num(fd?.day?.daily_chance_of_rain),
        uv: num(fd?.day?.uv),
        windKph: num(fd?.day?.maxwind_kph),
        conditionText: fd?.day?.condition?.text || "",
      });
    }

    return {
      ok: true,
      sourceName: "WeatherAPI",
      todayLow: num(daily[0]?.low),
      todayHigh: num(daily[0]?.high),
      todayRain: num(daily[0]?.rainChance),
      todayUv: num(daily[0]?.uv),
      todayWindKph: num(daily[0]?.windKph),
      conditionText: daily[0]?.conditionText || data.current?.condition?.text || "",
      hourly,
      daily,
    };
  }

  async function getOpenWeather(lat, lon, key) {
    const curUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&appid=${encodeURIComponent(key)}&units=metric`;
    const fcUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&appid=${encodeURIComponent(key)}&units=metric`;

    const [cur, fc] = await Promise.all([fetchJson(curUrl, 7000), fetchJson(fcUrl, 7000)]);
    if (!cur || !fc || !Array.isArray(fc.list)) return { ok: false, sourceName: "OpenWeatherMap" };

    const now = Date.now();
    const steps = fc.list
      .map((x) => ({
        time: x.dt ? new Date(x.dt * 1000).toISOString() : null,
        temp: num(x.main?.temp),
        rain: isNumber(x.pop) ? x.pop * 100 : null,
        text: x.weather?.[0]?.description || "",
      }))
      .filter((x) => x.time && new Date(x.time).getTime() >= now);

    const hourly = [];
    for (let i = 0; i < 24; i++) {
      const target = now + i * 3600000;
      const nearest = steps.reduce((best, s) => {
        if (!s.time) return best;
        const diff = Math.abs(new Date(s.time).getTime() - target);
        if (!best) return { s, diff };
        return diff < best.diff ? { s, diff } : best;
      }, null);

      hourly.push({
        time: new Date(target).toISOString(),
        temp: nearest?.s?.temp ?? null,
        rain: nearest?.s?.rain ?? null,
      });
    }

    const byDay = new Map();
    steps.forEach((s) => {
      const d = new Date(s.time);
      const keyDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
      if (!byDay.has(keyDay)) byDay.set(keyDay, []);
      byDay.get(keyDay).push(s);
    });

    const daily = [];
    const dayKeys = Array.from(byDay.keys()).sort();
    for (let i = 0; i < 7; i++) {
      const dk = dayKeys[i];
      const arr = dk ? byDay.get(dk) : null;
      if (!arr || !arr.length) {
        daily.push({
          date: new Date(Date.now() + i * 86400000).toISOString(),
          high: null,
          low: null,
          rainChance: null,
          uv: null,
          windKph: null,
          conditionText: "",
        });
        continue;
      }

      const temps = arr.map((x) => x.temp).filter(isNumber);
      const rains = arr.map((x) => x.rain).filter(isNumber);
      const texts = arr.map((x) => x.text).filter(Boolean);

      daily.push({
        date: dk,
        high: temps.length ? Math.max(...temps) : null,
        low: temps.length ? Math.min(...temps) : null,
        rainChance: rains.length ? Math.max(...rains) : null,
        uv: null,
        windKph: num(cur.wind?.speed) ? num(cur.wind.speed) * 3.6 : null,
        conditionText: mostCommonText(texts) || "",
      });
    }

    return {
      ok: true,
      sourceName: "OpenWeatherMap",
      todayLow: num(daily[0]?.low),
      todayHigh: num(daily[0]?.high),
      todayRain: num(daily[0]?.rainChance),
      todayUv: null,
      todayWindKph: num(cur.wind?.speed) ? num(cur.wind.speed) * 3.6 : null,
      conditionText: cur.weather?.[0]?.main || cur.weather?.[0]?.description || "",
      hourly,
      daily,
    };
  }

  // ---------- UI APPLY ----------
  function applyAll(data) {
    if (!data) return;

    showScreen(homeScreen);

    locationEl.textContent = data.placeName || currentName || "Your Location";

    const conf = (data.confidence || "Low").toUpperCase();
    const sourcesText = data.activeSources ? ` • Based on ${data.activeSources} source${data.activeSources === 1 ? "" : "s"}` : "";
    confidenceEl.textContent = `PROBABLY • ${conf} CONFIDENCE${sourcesText}`;

    const cond = data.condition || "clear";
    const tod = data.timeOfDay || "day";
    setHeadline(cond);

    const useF = (localStorage.getItem(STORAGE.units) || "C").toUpperCase() === "F";
    const low = convertTemp(data.lowTemp, useF);
    const high = convertTemp(data.highTemp, useF);
    tempEl.textContent = (isNumber(low) && isNumber(high)) ? `${low}–${high}°` : "--°";

    descriptionEl.textContent = pickHumor(cond, tod);

    extremeLabelEl.textContent = "Today's extreme:";
    extremeValueEl.textContent = describeExtreme(cond, data.lowTemp, data.highTemp);

    rainValueEl.textContent = isNumber(data.rainChance) ? `${clamp01(roundSafe(data.rainChance))}%` : "--";
    uvValueEl.textContent = isNumber(data.uv) ? `${roundSafe(data.uv)}` : "--";

    confidenceValueEl.textContent = conf;
    confidenceBarEl.style.width = `${clamp(0, 100, data.confidencePct ?? 30)}%`;

    applyThemeAndBg(cond, tod);
    spawnParticles(cond);

    renderHourly(data.hourly || []);
    renderWeek(data.daily || [], useF);

    saveCurrentBtn.classList.remove("hidden");
  }

  function applyThemeAndBg(condition, timeOfDay) {
    const cond = condition || "clear";
    const tod = timeOfDay || "day";

    body.classList.remove("theme-light", "theme-dark");
    const t = (localStorage.getItem(STORAGE.theme) || "auto").toLowerCase();
    if (t === "light") body.classList.add("theme-light");
    if (t === "dark") body.classList.add("theme-dark");

    body.classList.remove("weather-cold", "weather-heat", "weather-storm", "weather-rain", "weather-wind", "weather-fog", "weather-clear");
    body.classList.add(`weather-${cond}`);

    bgImg.src = `assets/images/bg/${cond}/${tod}.jpg`;

    if (heatOverlay) {
      if (cond === "heat") {
        heatOverlay.style.display = "block";
        heatOverlay.style.opacity = "0.22";
      } else {
        heatOverlay.style.display = "none";
        heatOverlay.style.opacity = "0";
      }
    }
  }

  function setHeadline(cond) {
    const label = {
      clear: "clear",
      rain: "rain",
      storm: "storm",
      wind: "wind",
      heat: "heat",
      cold: "cold",
      fog: "fog",
    }[cond] || "clear";

    const text = `This is ${label}.`;

    if (label === "wind") {
      const html = text.split("").map((ch, i) =>
        `<span class="wind-letter" style="animation-delay:${(i * 0.05).toFixed(2)}s">${ch === " " ? "&nbsp;" : escapeHtml(ch)}</span>`
      ).join("");
      headlineEl.innerHTML = html;
    } else {
      headlineEl.textContent = text;
    }
  }

  function renderHourly(items) {
    hourlyTimeline.innerHTML = "";
    const useF = (localStorage.getItem(STORAGE.units) || "C").toUpperCase() === "F";

    const safe = Array.isArray(items) ? items.slice(0, 24) : [];
    safe.forEach((h) => {
      const card = document.createElement("div");
      card.className = "hourly-card";

      const dt = new Date(h.time || Date.now());
      const label = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      const t = convertTemp(h.temp, useF);
      const r = isNumber(h.rain) ? `${clamp01(roundSafe(h.rain))}%` : "--";

      card.innerHTML = `
        <div class="hour-time">${escapeHtml(label)}</div>
        <div class="hour-temp">${isNumber(t) ? `${t}°` : "--"}</div>
        <div class="hour-rain">Rain: ${escapeHtml(r)}</div>
      `;
      hourlyTimeline.appendChild(card);
    });
  }

  function renderWeek(days, useF) {
    dailyCards.innerHTML = "";
    const safe = Array.isArray(days) ? days.slice(0, 7) : [];

    safe.forEach((d) => {
      const card = document.createElement("div");
      card.className = "daily-card";

      const dt = new Date(d.date || Date.now());
      const dayName = dt.toLocaleDateString([], { weekday: "short" });
      const dayDate = dt.toLocaleDateString([], { month: "short", day: "numeric" });

      const hi = convertTemp(d.high, useF);
      const lo = convertTemp(d.low, useF);

      const rain = isNumber(d.rainChance) ? `${clamp01(roundSafe(d.rainChance))}%` : "--";
      const humor = pickHumor(determineCondition({ temp: median([d.low, d.high].filter(isNumber)), rain: d.rainChance, windKph: d.windKph, conditionText: d.conditionText }), getTimeOfDay(12));

      card.innerHTML = `
        <div class="day-name">${escapeHtml(dayName)}</div>
        <div class="day-date">${escapeHtml(dayDate)}</div>
        <div class="day-temp">${isNumber(lo) && isNumber(hi) ? `${lo}–${hi}°` : "--"}</div>
        <div class="day-rain">Rain: ${escapeHtml(rain)}</div>
        <div class="day-humor">${escapeHtml(humor)}</div>
      `;

      dailyCards.appendChild(card);
    });
  }

  function spawnParticles(cond) {
    if (!particles) return;
    particles.innerHTML = "";

    const count = PARTICLE_COUNTS[cond] ?? 0;
    if (!count) return;

    for (let i = 0; i < count; i++) {
      const p = document.createElement("div");
      p.className = "particle";

      const left = Math.random() * 100;
      const top = Math.random() * 100;

      const size = (cond === "rain" || cond === "storm")
        ? (2 + Math.random() * 3)
        : (2 + Math.random() * 6);

      const dur = (cond === "storm")
        ? (1.4 + Math.random() * 1.8)
        : (cond === "rain")
          ? (2.0 + Math.random() * 2.5)
          : (cond === "wind")
            ? (2.0 + Math.random() * 2.8)
            : (5 + Math.random() * 6);

      const delay = Math.random() * 2.0;

      p.style.left = `${left}vw`;
      p.style.top = `${top}vh`;
      p.style.width = `${size}px`;
      p.style.height = `${cond === "wind" ? 2 : size}px`;
      p.style.animationDuration = `${dur}s`;
      p.style.animationDelay = `${delay}s`;

      particles.appendChild(p);
    }
  }

  function determineCondition({ temp, rain, windKph, conditionText }) {
    const r = isNumber(rain) ? rain : 0;
    const t = isNumber(temp) ? temp : 22;
    const w = isNumber(windKph) ? windKph : 0;
    const txt = String(conditionText || "").toLowerCase();

    if (txt.includes("fog") || txt.includes("mist") || txt.includes("haze")) return "fog";
    if (r >= 60) return "storm";
    if (r >= 35) return "rain";
    if (w >= 45) return "wind";
    if (t <= 12) return "cold";
    if (t >= 32) return "heat";
    return "clear";
  }

  function getTimeOfDay(hour) {
    const h = Number(hour);
    if (h < 6 || h >= 20) return "night";
    if (h < 9) return "dawn";
    if (h < 17) return "day";
    return "dusk";
  }

  function computeConfidence(tempSpread, rainSpread) {
    const t = isNumber(tempSpread) ? tempSpread : 99;
    const r = isNumber(rainSpread) ? rainSpread : 99;

    if (t <= 2 && r <= 15) return "High";
    if (t <= 5 && r <= 30) return "Medium";
    return "Low";
  }

  function describeExtreme(cond, lowC, highC) {
    const low = isNumber(lowC) ? lowC : null;
    const high = isNumber(highC) ? highC : null;

    if (high !== null && high >= 32) return "Heat";
    if (low !== null && low <= 10) return "Cold";

    return (cond || "clear").charAt(0).toUpperCase() + (cond || "clear").slice(1);
  }

  // ---------- BOOT ----------
  function boot() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }

    showScreen(homeScreen);

    const cached = safeParse(localStorage.getItem(STORAGE.last), null);
    if (cached && cached.ok) applyAll(cached);
    else useCachedOrFallback();

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        currentLat = pos.coords.latitude;
        currentLon = pos.coords.longitude;

        const city = await reverseGeocode(currentLat, currentLon);
        currentName = city || "Your Location";
        locationEl.textContent = currentName;

        await fetchAndRender(currentLat, currentLon, currentName);
      },
      async () => {
        currentLat = FALLBACK.lat;
        currentLon = FALLBACK.lon;
        currentName = FALLBACK.name;
        locationEl.textContent = FALLBACK.name;

        await fetchAndRender(currentLat, currentLon, currentName);
      },
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 600000 }
    );
  }

  async function reverseGeocode(lat, lon) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
      const data = await fetchJson(url, 6000);
      const a = data?.address || {};
      return a.city || a.town || a.village || a.suburb || a.county || null;
    } catch {
      return null;
    }
  }

  function useCachedOrFallback() {
    const cached = safeParse(localStorage.getItem(STORAGE.last), null);
    if (cached && cached.ok) {
      applyAll(cached);
      return;
    }

    const dummy = makeDummy(FALLBACK.name);
    localStorage.setItem(STORAGE.last, JSON.stringify(dummy));
    applyAll(dummy);

    saveCurrentBtn.classList.add("hidden");
  }

  function makeDummy(name) {
    const now = Date.now();
    const hourly = Array.from({ length: 24 }, (_, i) => ({
      time: new Date(now + i * 3600000).toISOString(),
      temp: 22 + Math.sin(i / 3) * 4,
      rain: Math.max(0, Math.min(100, 10 + Math.random() * 20)),
    }));

    const daily = Array.from({ length: 7 }, (_, i) => ({
      date: new Date(now + i * 86400000).toISOString(),
      high: 26 + i * 0.2,
      low: 18 + i * 0.2,
      rainChance: Math.max(0, Math.min(100, 15 + i * 4)),
      uv: 7,
      windKph: 18,
      conditionText: "",
    }));

    return {
      ok: true,
      placeName: name,
      lat: FALLBACK.lat,
      lon: FALLBACK.lon,
      activeSources: 1,
      sourcesUsed: ["Fallback"],
      lowTemp: 18,
      highTemp: 26,
      rainChance: 20,
      uv: 7,
      windKph: 18,
      condition: "clear",
      conditionText: "",
      timeOfDay: getTimeOfDay(new Date().getHours()),
      confidence: "Low",
      confidencePct: 30,
      hourly,
      daily,
      updatedAt: new Date().toISOString(),
    };
  }

  // ---------- UTIL ----------
  function showLoader(on) {
    if (!loader) return;
    loader.classList.toggle("hidden", !on);
  }

  function toastMsg(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove("hidden");
    toast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.classList.add("hidden"), 250);
    }, 1800);
  }

  async function fetchJson(url, timeoutMs) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs || 7000);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { "Accept": "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  function safeParse(s, fallback) {
    try {
      return s ? JSON.parse(s) : fallback;
    } catch {
      return fallback;
    }
  }

  function safeArr(a) { return Array.isArray(a) ? a : []; }

  function isNumber(x) { return typeof x === "number" && isFinite(x); }

  function num(x) { const n = Number(x); return isFinite(n) ? n : null; }

  function roundSafe(x) { const n = Number(x); return isFinite(n) ? Math.round(n) : null; }

  function clamp(min, max, v) { const n = Number(v); if (!isFinite(n)) return min; return Math.max(min, Math.min(max, n)); }

  function clamp01(v) { return clamp(0, 100, v); }

  function closeEnough(a, b) { return Math.abs(Number(a) - Number(b)) < 0.001; }

  function median(arr) {
    const a = (Array.isArray(arr) ? arr : []).map(Number).filter((n) => isFinite(n)).sort((x, y) => x - y);
    if (!a.length) return null;
    const mid = Math.floor(a.length / 2);
    return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  }

  function spread(arr) {
    const a = (Array.isArray(arr) ? arr : []).map(Number).filter((n) => isFinite(n));
    if (!a.length) return null;
    return Math.max(...a) - Math.min(...a);
  }

  function mostCommonText(arr) {
    if (!Array.isArray(arr) || !arr.length) return "";
    const freq = new Map();
    arr.forEach((t) => {
      const s = String(t || "").trim();
      if (!s) return;
      freq.set(s, (freq.get(s) || 0) + 1);
    });
    let best = "";
    let bestN = 0;
    for (const [k, v] of freq.entries()) {
      if (v > bestN) { bestN = v; best = k; }
    }
    return best;
  }

  function convertTemp(celsiusValue, useF) {
    if (!isNumber(celsiusValue)) return null;
    const c = Number(celsiusValue);
    const val = useF ? (c * 9) / 5 + 32 : c;
    return Math.round(val);
  }

  function pickHumor(cond, tod) {
    const c = HUMOR[cond] ? cond : "clear";
    const t = HUMOR[c][tod] ? tod : "day";
    const options = HUMOR[c][t] || ["Probably…"];
    if (options.length === 1) return options[0];

    let pick = options[Math.floor(Math.random() * options.length)];
    if (pick === lastHumorPick) pick = options[(options.indexOf(pick) + 1) % options.length];
    lastHumorPick = pick;
    return pick;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  // ---------- START ----------
  boot();
});

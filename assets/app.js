(() => {
  const $ = (id) => document.getElementById(id);
  const C = window.PW_CONFIG;

  const dom = {
    cityLine: $("cityLine"),
    conditionText: $("conditionText"),
    bigTemp: $("bigTemp"),
    confidenceTop: $("confidenceTop"),
    wittyLine: $("wittyLine"),
    todayExtremeRange: $("todayExtremeRange"),
    rainSummary: $("rainSummary"),
    uvSummary: $("uvSummary"),
    updatedAt: $("updatedAt"),
  };

  const isNum = (v) => typeof v === "number" && Number.isFinite(v);

  function fmtRange(lo, hi) {
    if (isNum(lo) && isNum(hi)) return `${Math.round(lo)}–${Math.round(hi)}°`;
    return "—";
  }

  async function reverseGeocode(lat, lon) {
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
      );
      if (!r.ok) return null;
      const j = await r.json();
      const a = j.address || {};
      const city =
        a.city || a.town || a.village || a.suburb || a.hamlet || "";
      const country = a.country || "";
      return city && country ? `${city}, ${country}` : city || "Near you";
    } catch {
      return null;
    }
  }

  async function loadByCoords(lat, lon) {
    const r = await fetch(
      `${C.endpoints.weather}?lat=${lat}&lon=${lon}`
    );
    if (!r.ok) throw new Error("Weather failed");
    return r.json();
  }

  function render(data) {
    dom.cityLine.textContent =
      data.location.country
        ? `${data.location.name}, ${data.location.country}`
        : data.location.name;

    dom.conditionText.textContent = "This is today.";
    dom.bigTemp.textContent = fmtRange(
      data.daily?.[0]?.lowC,
      data.daily?.[0]?.highC
    );

    dom.confidenceTop.textContent = "PROBABLY · MIXED CONFIDENCE";
    dom.wittyLine.textContent = "Just… probably.";

    dom.todayExtremeRange.textContent = dom.bigTemp.textContent;
    dom.rainSummary.textContent = isNum(data.now.rainChance)
      ? `${Math.round(data.now.rainChance)}%`
      : "—";
    dom.uvSummary.textContent = isNum(data.daily?.[0]?.uv)
      ? `UV ${Math.round(data.daily[0].uv)}`
      : "—";

    dom.updatedAt.textContent = data.meta.updatedAtLabel;
  }

  function showBlocked() {
    dom.cityLine.textContent = "Location unavailable — search for a city";
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        const data = await loadByCoords(lat, lon);
        render(data);

        const label = await reverseGeocode(lat, lon);
        if (label) dom.cityLine.textContent = label;
      } catch {
        showBlocked();
      }
    },
    () => {
      showBlocked();
    },
    { timeout: 8000 }
  );
})();

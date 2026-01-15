// assets/app.js
// Probably Weather - Clean Build
// Single Source of Truth Implementation

(function() {
  "use strict";
  
  var C = window.PW_CONFIG;
  
  // ============ DOM ELEMENTS ============
  var dom = {
    bgImg: document.getElementById("bgImg"),
    location: document.getElementById("location"),
    updated: document.getElementById("updated"),
    confidenceLine: document.getElementById("confidenceLine"),
    headline: document.getElementById("headline"),
    tempRange: document.getElementById("tempRange"),
    witty: document.getElementById("witty"),
    extremeTitle: document.getElementById("extremeTitle"),
    extremeValue:  document.getElementById("extremeValue"),
    rainValue: document.getElementById("rainValue"),
    uvValue: document.getElementById("uvValue"),
    confidenceTitle:  document.getElementById("confidenceTitle"),
    confidenceSub: document. getElementById("confidenceSub"),
    hourlyList: document.getElementById("hourlyList"),
    weekList: document.getElementById("weekList"),
    searchInput: document.getElementById("searchInput"),
    searchBtn: document. getElementById("searchBtn"),
    sourcesList: document.getElementById("sourcesList")
  };
  
  // ============ UTILITY FUNCTIONS ============
  function isNum(v) {
    return typeof v === "number" && isFinite(v);
  }
  
  function round(n) {
    return isNum(n) ? Math.round(n) : null;
  }
  
  // ============ SINGLE SOURCE OF TRUTH ============
  // This function determines THE dominant condition
  // Priority: Storm > Rain > Wind > Cold > Heat > Fog > Cloudy > Clear
  function computeCondition(data) {
    var now = data.now || {};
    var today = (data.daily && data.daily[0]) || {};
    
    var apiCondition = (now.conditionKey || today.conditionKey || "").toLowerCase();
    var rain = isNum(today.rainChance) ? today.rainChance : now.rainChance;
    var windNow = now.windKph;
    var windHourlyMax = null;
    if (data.hourly && data.hourly.length) {
      windHourlyMax = data.hourly.reduce(function(max, h) {
        if (isNum(h.windKph)) {
          return isNum(max) ? Math.max(max, h.windKph) : h.windKph;
        }
        return max;
      }, null);
    }
    var wind = isNum(windHourlyMax) ? windHourlyMax : windNow;
    if (isNum(windNow) && isNum(windHourlyMax)) {
      wind = Math.max(windNow, windHourlyMax);
    }
    var high = today.highC;
    
    // 1. STORM
    if (apiCondition === "storm" || apiCondition. indexOf("thunder") >= 0) {
      return "storm";
    }
    
    // 2. RAIN (>=40%)
    if (isNum(rain) && rain >= C.thresholds.rainPct) {
      return "rain";
    }
    
    // 3. WIND (>=25 km/h)
    if (isNum(wind) && wind >= C.thresholds.windKph) {
      return "wind";
    }
    
    // 4. COLD (max <=16°C)
    if (isNum(high) && high <= C.thresholds.coldC) {
      return "cold";
    }
    
    // 5. HEAT (max >=32°C)
    if (isNum(high) && high >= C.thresholds.hotC) {
      return "heat";
    }
    
    // 6. FOG
    if (apiCondition === "fog" || apiCondition. indexOf("mist") >= 0) {
      return "fog";
    }
    
    // 7. CLOUDY
    if (apiCondition === "cloudy" || apiCondition.indexOf("overcast") >= 0) {
      return "cloudy";
    }
    
    // 8. CLEAR (default)
    return "clear";
  }
  
  // ============ DISPLAY HELPERS ============
  function getTimeOfDay() {
    var h = new Date().getHours();
    if (h >= 5 && h < 8) return "dawn";
    if (h >= 8 && h < 17) return "day";
    if (h >= 17 && h < 20) return "dusk";
    return "night";
  }
  
  function setBackground(condition) {
    var folder = C.conditionFolders[condition] || "clear";
    var tod = getTimeOfDay();
    var src = C.bgPath + "/" + folder + "/" + tod + ". jpg";
    
    dom.bgImg.onerror = function() {
      // Try day. jpg as fallback
      dom.bgImg.onerror = function() {
        dom. bgImg.src = C.fallbackBg;
      };
      dom.bgImg. src = C.bgPath + "/" + folder + "/day.jpg";
    };
    dom.bgImg.src = src;
  }
  
  function formatTemp(low, high) {
    if (! isNum(low) && !isNum(high)) return "—";
    if (isNum(low) && isNum(high)) {
      return round(low) + "–" + round(high) + "°";
    }
    return isNum(low) ? round(low) + "°" : round(high) + "°";
  }
  
  function getRainText(pct) {
    if (! isNum(pct)) return "—";
    if (pct < 10) return C.rainDescriptions. none;
    if (pct < 30) return C.rainDescriptions.unlikely;
    if (pct < 55) return C.rainDescriptions.possible;
    if (pct < 80) return C.rainDescriptions.likely;
    return C.rainDescriptions.heavy;
  }
  
  function getUVText(uv) {
    if (! isNum(uv)) return "—";
    var label;
    if (uv < 3) label = "Low";
    else if (uv < 6) label = "Moderate";
    else if (uv < 8) label = "High";
    else if (uv < 11) label = "Very high";
    else label = "Extreme";
    return label + " (" + round(uv) + ")";
  }
  
  function getWittyLine(condition) {
    // Check if it's a weekend for clear weather
    var day = new Date().getDay();
    var isWeekend = (day === 0 || day === 5 || day === 6);
    
    if (condition === "clear" && isWeekend) {
      return "Braai weather, boet!";
    }
    
    return C.wittyLines[condition] || "Just...  probably. ";
  }
  
  // ============ RENDER FUNCTIONS ============
  function renderHome(data, condition) {
    var now = data.now || {};
    var today = (data.daily && data.daily[0]) || {};
    var loc = data.location || {};
    var meta = data.meta || {};
    var consensus = data.consensus || {};
    
    // Location
    var locText = loc.name || "—";
    if (loc.country) locText += ", " + loc.country;
    dom.location.textContent = locText;
    
    // Updated time
    dom.updated.textContent = meta.updatedAtLabel || "—";
    
    // Confidence line
    var confKey = consensus.confidenceKey || "mixed";
    var confLabel = C.confidenceLabels[confKey] || "Low";
    dom. confidenceLine.textContent = "PROBABLY · " + confLabel. toUpperCase() + " CONFIDENCE";
    
    // Headline - driven by condition
    dom.headline.textContent = C.headlines[condition] || "This is weather.";
    
    // Temperature range
    dom.tempRange.textContent = formatTemp(today.lowC, today.highC);
    
    // Witty line - driven by condition
    dom.witty. textContent = getWittyLine(condition);
    
    // Today's extreme card
    dom.extremeTitle. textContent = C. extremeLabels[condition] || "—";
    dom. extremeValue.textContent = formatTemp(today.lowC, today.highC);
    
    // Rain card
    var rainPct = isNum(today.rainChance) ? today.rainChance :  now.rainChance;
    dom. rainValue.textContent = getRainText(rainPct);
    
    // UV card
    dom.uvValue.textContent = getUVText(today.uv);
    
    // Confidence card
    dom.confidenceTitle.textContent = confLabel;
    var sourceCount = 0;
    if (meta.sources && Array.isArray(meta.sources)) {
      sourceCount = meta.sources.filter(function(s) { return s. ok; }).length;
    }
    dom.confidenceSub.textContent = "Based on " + sourceCount + " forecasts →";
    
    // Sources list (settings)
    if (dom.sourcesList && meta.sources) {
      var names = meta.sources. map(function(s) { return s.name; });
      dom.sourcesList.textContent = names.join(", ");
    }
    
    // Background - driven by SAME condition
    setBackground(condition);
  }
  
  function renderHourly(data) {
    var items = data.hourly || [];
    dom.hourlyList. innerHTML = "";
    
    items.slice(0, 24).forEach(function(h) {
      var row = document.createElement("div");
      row.className = "list-row";
      
      var time = h.timeLocal || "—";
      var temp = isNum(h.tempC) ? round(h.tempC) + "°" : "—";
      var cond = h.conditionLabel || "—";
      var rain = isNum(h.rainChance) ? round(h.rainChance) + "%" : "—";
      
      row.innerHTML = 
        '<div class="list-time">' + time + '</div>' +
        '<div class="list-cond">' + cond + '</div>' +
        '<div class="list-temp">' + temp + '<div class="list-extra">' + rain + ' rain</div></div>';
      
      dom.hourlyList. appendChild(row);
    });
  }
  
  function renderWeek(data) {
    var items = data.daily || [];
    dom.weekList.innerHTML = "";
    
    items.slice(0, 7).forEach(function(d) {
      var row = document.createElement("div");
      row.className = "list-row";
      
      var day = d.dayLabel || "—";
      var cond = d.conditionLabel || "—";
      var temps = formatTemp(d.lowC, d.highC);
      var rain = isNum(d.rainChance) ? round(d.rainChance) + "%" : "—";
      
      row. innerHTML = 
        '<div class="list-time">' + day + '</div>' +
        '<div class="list-cond">' + cond + '</div>' +
        '<div class="list-temp">' + temps + '<div class="list-extra">' + rain + ' rain</div></div>';
      
      dom. weekList.appendChild(row);
    });
  }
  
  function renderAll(data) {
    // Compute condition ONCE - Single Source of Truth
    var condition = computeCondition(data);
    
    // Use that ONE condition for everything
    renderHome(data, condition);
    renderHourly(data);
    renderWeek(data);
  }
  
  function renderError(msg) {
    dom.headline.textContent = "This is unclear. ";
    dom. tempRange.textContent = "—";
    dom.witty. textContent = msg || "Something went wrong.";
    dom.confidenceLine.textContent = "PROBABLY · LOW CONFIDENCE";
    setBackground("cloudy");
  }
  
  // ============ API FETCH ============
  function fetchWeather(query) {
    var url;
    if (typeof query === "string") {
      // City search
      url = C.api + "?q=" + encodeURIComponent(query);
    } else {
      // Coordinates
      url = C.api + "? lat=" + encodeURIComponent(query.lat) + "&lon=" + encodeURIComponent(query.lon);
    }
    
    return fetch(url)
      .then(function(res) {
        if (!res.ok) throw new Error("API error:  " + res.status);
        return res.json();
      });
  }
  
  function loadCity(city) {
    fetchWeather(city)
      .then(function(data) {
        renderAll(data);
      })
      .catch(function(err) {
        console.error(err);
        renderError("Couldn't load weather for " + city);
      });
  }
  
  function loadCoords(lat, lon) {
    fetchWeather({ lat: lat, lon: lon })
      .then(function(data) {
        renderAll(data);
      })
      .catch(function(err) {
        console.error(err);
        renderError("Couldn't load weather for your location.");
      });
  }
  
  // ============ NAVIGATION ============
  function showScreen(name) {
    var screens = document.querySelectorAll(". screen");
    screens.forEach(function(s) {
      s.classList.add("hidden");
    });
    
    var target = document.getElementById("screen-" + name);
    if (target) target.classList.remove("hidden");
    
    var btns = document.querySelectorAll(".nav-btn");
    btns.forEach(function(btn) {
      var screen = btn.getAttribute("data-screen");
      if (screen === name) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }
  
  // ============ EVENT LISTENERS ============
  document.querySelectorAll(".nav-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var screen = btn.getAttribute("data-screen");
      if (screen) showScreen(screen);
    });
  });
  
  if (dom.searchBtn) {
    dom.searchBtn.addEventListener("click", function() {
      var val = dom.searchInput.value.trim();
      if (val) {
        loadCity(val);
        showScreen("home");
      }
    });
  }
  
  if (dom.searchInput) {
    dom.searchInput.addEventListener("keydown", function(e) {
      if (e.key === "Enter") {
        dom.searchBtn.click();
      }
    });
  }
  
  // ============ INIT ============
  showScreen("home");
  setBackground("clear");
  
  // Try geolocation first
  if ("geolocation" in navigator) {
    navigator.geolocation. getCurrentPosition(
      function(pos) {
        loadCoords(pos. coords.latitude, pos.coords.longitude);
      },
      function() {
        // Geolocation denied - show message
        renderError("Allow location or search for a city.");
      },
      { timeout: 8000, maximumAge: 60000, enableHighAccuracy: false }
    );
  } else {
    renderError("Search for a city to get started.");
  }
  
})();
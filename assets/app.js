<parameter name="command">update</parameter>
<parameter name="id">weather_condition_fix</parameter>
<parameter name="old_str">  function renderHourly(hourly) {
    if (!hourlyTimeline) return;
    hourlyTimeline.innerHTML = '';</parameter>
<parameter name="new_str">  function renderHourly(hourly) {
    if (!hourlyTimeline) return;
    hourlyTimeline.innerHTML = '';
    hourly.forEach((h, i) => {
      const div = document.createElement('div');
      div.classList.add('hourly-card');
      const spread = isNum(h.tempC) && isNum(h.windKph) ? Math.abs(h.tempC - h.windKph / 5) : null;
      const confClass = spread == null ? 'conf-med'
        : spread < 2 ? 'conf-high'
        : spread < 5 ? 'conf-med'
        : 'conf-low';
      const hourTime = h.timeLocal || new Date(Date.now() + i * 3600000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: settings.time === '12'
      });
      const tempStr = formatTemp(h.tempC);
      const rainStr = isNum(h.rainChance) ? `${round0(h.rainChance)}%` : '--%';
      const windStr = isNum(h.windKph) ? formatWind(h.windKph) : '--';
      div.innerHTML = `
        <div class="hour-row">
          <div class="hour-time">${hourTime}</div>
          <div class="confidence-row">
            <span class="confidence-dot ${confClass}"></span>
            <span class="confidence-dot ${confClass}"></span>
            <span class="confidence-dot ${confClass}"></span>
          </div>
        </div>
        <div class="hour-temp">${tempStr}</div>
        <div class="hour-rain"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 14h12M8 18h8M9 10h6" /></svg> ${rainStr}</div>
        <div class="hour-wind"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h18M3 6h18M3 18h18" /></svg> ${windStr}</div>
        <div class="precip-bar" style="--prob:${isNum(h.rainChance) ? round0(h.rainChance) : 0}"></div>
      `;
      hourlyTimeline.appendChild(div);
    });
  }

  function renderWeek(daily) {
    if (!dailyCards) return;
    dailyCards.innerHTML = '';
    daily.forEach((d, i) => {
      const dayName = d.dayLabel || new Date(Date.now() + i * 86400000).toLocaleDateString('en-US', { weekday: 'short' });
      const lowStr = isNum(d.lowC) ? formatTemp(d.lowC).replace('°', '') : '--';
      const highStr = isNum(d.highC) ? formatTemp(d.highC).replace('°', '') : '--';
      const medianStr = isNum(d.lowC) && isNum(d.highC)
        ? round0((convertTemp(d.lowC) + convertTemp(d.highC)) / 2)
        : '--';
      const rainStr = isNum(d.rainChance) ? `${round0(d.rainChance)}%` : '--%';
      const spread = isNum(d.highC) && isNum(d.lowC) ? Math.abs(d.highC - d.lowC) : null;
      const confClass = spread == null ? 'conf-med'
        : spread < 2 ? 'conf-high'
        : spread < 5 ? 'conf-med'
        : 'conf-low';
      const div = document.createElement('div');
      div.classList.add('daily-card');
      const tempLine = settings.range
        ? `${lowStr}° – ${highStr}°`
        : `${medianStr}°`;
      div.innerHTML = `
        <div class="day-row">
          <div class="day-name">${dayName}</div>
          <div class="confidence-row">
            <span class="confidence-dot ${confClass}"></span>
            <span class="confidence-dot ${confClass}"></span>
            <span class="confidence-dot ${confClass}"></span>
          </div>
        </div>
        <div class="day-temp">${tempLine}</div>
        <div class="day-rain"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 14h12M8 18h8M9 10h6" /></svg> ${rainStr}</div>
        <div class="day-uv"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v4M12 17v4M4.2 6.2l2.8 2.8M17 17l2.8 2.8M3 12h4M17 12h4M6.2 19.8l2.8-2.8M17 7l2.8-2.8" /></svg> ${isNum(d.uv) ? round0(d.uv) : '--'}</div>
        <div class="precip-bar" style="--prob:${isNum(d.rainChance) ? round0(d.rainChance) : 0}"></div>
      `;
      dailyCards.appendChild(div);
    });
  }

  function loadCity(city) {
    if (typeof city === 'string' && city.trim()) {
      state.city = city.trim();
    }
    const place = activePlace || homePlace;
    if (place) loadAndRender(place);
  }

  function applySettings() {
    if (unitsTempSelect) unitsTempSelect.value = settings.temp;
    if (unitsWindSelect) unitsWindSelect.value = settings.wind;
    if (probRangeToggle) probRangeToggle.checked = !!settings.range;
    if (timeFormatSelect) timeFormatSelect.value = settings.time;

    if (taglineEl) {
      taglineEl.textContent = 'No more Ja-No-Maybe weather. Just Probably.';
    }

    if (lastPayload) {
      const norm = normalizePayload(lastPayload);
      window.__PW_LAST_NORM = norm;
      renderHome(norm);
      renderHourly(norm.hourly);
      renderWeek(norm.daily);
      renderUpdatedAt(lastPayload);
    }
  }

  async function loadAndRender(place) {
    activePlace = place;
    renderLoading(place.name || 'My Location');
    try {
      const payload = await fetchProbable(place);
      lastPayload = payload;
      const norm = normalizePayload(payload);
      window.__PW_LAST_NORM = norm;
      renderHome(norm);
      renderHourly(norm.hourly);
      renderWeek(norm.daily);
      renderUpdatedAt(payload);
    } catch (e) {
      console.error("Load failed:", e);
      renderError("Couldn't fetch weather right now.");
    }
  }

  // ========== PLACES: FAVORITES & RECENTS ==========
  
  function loadFavorites() { return loadJSON(STORAGE.favorites, []); }
  function loadRecents() { return loadJSON(STORAGE.recents, []); }

  function saveFavorites(list) { saveJSON(STORAGE.favorites, list); }
  function saveRecents(list) { saveJSON(STORAGE.recents, list); }

  function addRecent(place) {
    const favorites = loadFavorites();
    if (favorites.some(p => samePlace(p, place))) return;
    const existing = loadRecents();
    if (existing.some(p => samePlace(p, place))) return;
    const list = [place, ...existing.filter(p => !samePlace(p, place))];
    saveRecents(list.slice(0, 20));
    renderRecents();
  }

  function clearRecents() {
    localStorage.removeItem(STORAGE.recents);
    renderRecents();
  }

  async function addFavorite(place) {
    let list = loadFavorites();
    if (list.some(p => samePlace(p, place))) {
      showToast('This place is already saved!');
      return;
    }
    if (list.length >= 5) {
      showToast('You can only save up to 5 places. Remove one first.');
      return;
    }
    const resolvedName = await resolvePlaceName(place);
    list.unshift({ ...place, name: resolvedName });
    saveFavorites(list.slice(0, 5));
    renderFavorites();
    showToast(`Saved ${place.name}!`);
  }

  async function addRecentIfNew(place) {
    const favorites = loadFavorites();
    if (favorites.some(p => samePlace(p, place))) return;
    const existing = loadRecents();
    if (existing.some(p => samePlace(p, place))) return;
    const resolvedName = await resolvePlaceName(place);
    const normalized = { ...place, name: resolvedName };
    const list = [normalized, ...existing.filter(p => !samePlace(p, normalized))];
    saveRecents(list.slice(0, 20));
    renderRecents();
  }

  async function toggleFavorite(place) {
    let list = loadFavorites();
    if (list.some(p => samePlace(p, place))) {
      list = list.filter(p => !samePlace(p, place));
      saveFavorites(list);
      renderFavorites();
      showToast('Place removed from favorites');
      return;
    }
    await addFavorite(place);
  }

  async function ensureFavoriteMeta(place) {
    if (!place || !isNum(place.lat) || !isNum(place.lon)) return;
    if (isNum(place.tempC) && place.conditionKey) return;
    const key = favoriteKey(place);
    if (pendingFavMeta.has(key)) return;
    pendingFavMeta.add(key);
    try {
      const payload = await fetchProbable(place);
      const norm = normalizePayload(payload);
      const list = loadFavorites();
      const idx = list.findIndex(p => samePlace(p, place));
      if (idx !== -1) {
        list[idx] = {
          ...list[idx],
          tempC: norm.nowTemp ?? null,
          conditionKey: norm.conditionKey ?? null
        };
        saveFavorites(list);
        renderFavorites();
      }
    } catch {
    } finally {
      pendingFavMeta.delete(key);
    }
  }

  function renderRecents() {
    if (!recentList) return;
    const list = loadRecents();
    recentList.innerHTML = list.map(p => `
      <li class="recent-item" data-lat="${p.lat}" data-lon="${p.lon}" data-name="${escapeHtml(p.name)}">${escapeHtml(p.name)}</li>
    `).join('') || '<li>No recent searches yet.</li>';

    recentList.querySelectorAll('li[data-lat]').forEach(li => {
      li.addEventListener('click', () => {
        const p = { name: li.dataset.name, lat: parseFloat(li.dataset.lat), lon: parseFloat(li.dataset.lon) };
        showScreen(screenHome);
        loadAndRender(p);
      });
    });
  }

  function renderFavorites() {
    if (!favoritesList) return;
    const list = loadFavorites();
    const favLimit = document.getElementById('favLimit');
    if (favLimit) {
      favLimit.style.display = list.length >= 5 ? 'block' : 'none';
    }
    favoritesList.innerHTML = list.map(p => {
      const temp = isNum(p.tempC) ? formatTemp(p.tempC) : '--°';
      const removeBtn = manageMode
        ? `<button class="remove-fav" data-lat="${p.lat}" data-lon="${p.lon}">✕</button>`
        : '';
      return `
      <li class="favorite-item" data-lat="${p.lat}" data-lon="${p.lon}" data-name="${escapeHtml(p.name)}">
        <button class="fav-star" data-lat="${p.lat}" data-lon="${p.lon}" aria-label="Remove favourite">★</button>
        <span class="fav-name">${escapeHtml(p.name)}</span>
        <span class="fav-temp">${temp}</span>
        ${removeBtn}
      </li>`;
    }).join('') || '<li>No saved places yet.</li>';

    favoritesList.querySelectorAll('li[data-lat] .fav-name').forEach(span => {
      span.addEventListener('click', () => {
        const li = span.closest('li');
        const p = { name: li.dataset.name, lat: parseFloat(li.dataset.lat), lon: parseFloat(li.dataset.lon) };
        showScreen(screenHome);
        loadAndRender(p);
      });
    });

    favoritesList.querySelectorAll('.fav-star').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const lat = parseFloat(btn.dataset.lat);
        const lon = parseFloat(btn.dataset.lon);
        const p = { name: btn.closest('li')?.dataset?.name, lat, lon };
        await toggleFavorite(p);
      });
    });
    
    favoritesList.querySelectorAll('.remove-fav').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const lat = parseFloat(btn.dataset.lat);
        const lon = parseFloat(btn.dataset.lon);
        let list = loadFavorites();
        list = list.filter(p => !samePlace(p, {lat, lon}));
        saveFavorites(list);
        renderFavorites();
        showToast('Place removed from favorites');
      });
    });

    list.forEach((p) => {
      ensureFavoriteMeta(p);
    });
  }

  // ========== SEARCH ==========
  
  let searchTimeout = null;
  let searchResults = [];
  const searchMiniCache = new Map();

  function parseQuery(raw) {
    const trimmed = raw.trim();
    const parts = trimmed.split(/\s+/);
    const last = parts[parts.length - 1];
    const countryMap = {
      us: 'us', usa: 'us', america: 'us', unitedstates: 'us', 'united-states': 'us',
      uk: 'gb', britain: 'gb', england: 'gb', scotland: 'gb', wales: 'gb',
      uae: 'ae', emirates: 'ae', sa: 'za', southafrica: 'za'
    };
    const lastKey = last?.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, '');
    const countryCode = countryMap[lastKey] || (lastKey && lastKey.length === 2 ? lastKey : null);
    const baseQuery = countryCode ? parts.slice(0, -1).join(' ') : trimmed;
    return { baseQuery, countryCode };
  }

  async function miniFetchTemp(lat, lon) {
    const key = `${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;
    if (searchMiniCache.has(key)) return searchMiniCache.get(key);
    try {
      const payload = await fetchProbable({ lat, lon, name: '' });
      const norm = normalizePayload(payload);
      const result = {
        temp: isNum(norm.nowTemp) ? formatTemp(norm.nowTemp) : '--°',
        icon: conditionEmoji(norm.conditionKey)
      };
      searchMiniCache.set(key, result);
      return result;
    } catch {
      return { temp: '--°', icon: '⛅' };
    }
  }
  
  async function runSearch(q) {
    if (!q || q.trim().length < 2) {
      const resultsContainer = document.getElementById('searchResults');
      if (resultsContainer) resultsContainer.innerHTML = '';
      return;
    }

    const { baseQuery, countryCode } = parseQuery(q);
    const queryText = baseQuery;

    const baseUrl = (query) =>
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}` +
      `&format=jsonv2&limit=10&addressdetails=1&bounded=0` +
      `&featureclass=P&featureclass=A` +
      `${countryCode ? `&countrycodes=${countryCode}` : `&countrycodes=za`}`;
    const hasComma = queryText.includes(',');
    try {
      let data = await (await fetch(baseUrl(queryText))).json();
      if (!hasComma && !countryCode && (!Array.isArray(data) || data.length === 0)) {
        data = await (await fetch(baseUrl(`${queryText}, South Africa`))).json();
      }
      if (!hasComma && !countryCode && (!Array.isArray(data) || data.length === 0)) {
        data = await (await fetch(baseUrl(`${queryText}, Western Cape, South Africa`))).json();
      }
      searchResults = data;
      renderSearchResults(data);
    } catch (e) {
      console.error('Search failed:', e);
    }
  }
  
  function renderSearchResults(results) {
    let resultsContainer = document.getElementById('searchResults');
    if (!resultsContainer) {
      resultsContainer = document.createElement('div');
      resultsContainer.id = 'searchResults';
      resultsContainer.className = 'section';
      const searchTitle = document.createElement('h3');
      searchTitle.textContent = 'Search results';
      resultsContainer.appendChild(searchTitle);
      const resultsList = document.createElement('ul');
      resultsList.id = 'searchResultsList';
      resultsContainer.appendChild(resultsList);
      
      const searchScreen = document.getElementById('search-screen');
      const cancelBtn = document.getElementById('searchCancel');
      if (searchScreen && cancelBtn) {
        cancelBtn.after(resultsContainer);
      }
    }
    
    const resultsList = document.getElementById('searchResultsList');
    if (!resultsList) return;
    
    if (results.length === 0) {
      resultsList.innerHTML = '<li>No results found.</li>';
      return;
    }

    const favorites = loadFavorites();
    
    resultsList.innerHTML = results.map(r => {
      const displayName = escapeHtml(r.display_name);
      const isFav = favorites.some(p => samePlace(p, { lat: parseFloat(r.lat), lon: parseFloat(r.lon) }));
      const star = isFav ? '★' : '☆';
      return `
        <li class="search-result-item" data-lat="${r.lat}" data-lon="${r.lon}" data-name="${displayName}">
          <button class="fav-star${isFav ? ' is-fav' : ''}" data-lat="${r.lat}" data-lon="${r.lon}" aria-label="Toggle favourite">${star}</button>
          <span class="result-icon">⛅</span>
          <span class="result-name">${displayName}</span>
          <span class="result-temp">--°</span>
        </li>`;
    }).join('');
    
    resultsList.querySelectorAll('li[data-lat]').forEach(li => {
      li.addEventListener('click', async () => {
        const place = { 
          name: li.dataset.name, 
          lat: parseFloat(li.dataset.lat), 
          lon: parseFloat(li.dataset.lon) 
        };
        await addRecentIfNew(place);
        showScreen(screenHome);
        loadAndRender(place);
        if (searchInput) searchInput.value = '';
        resultsList.innerHTML = '';
      });
    });

    resultsList.querySelectorAll('.fav-star').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const lat = parseFloat(btn.dataset.lat);
        const lon = parseFloat(btn.dataset.lon);
        const name = btn.closest('li')?.dataset?.name;
        await toggleFavorite({ name, lat, lon });
        renderSearchResults(results);
      });
    });

    resultsList.querySelectorAll('li[data-lat]').forEach(async (li) => {
      const lat = parseFloat(li.dataset.lat);
      const lon = parseFloat(li.dataset.lon);
      const iconEl = li.querySelector('.result-icon');
      const tempEl = li.querySelector('.result-temp');
      const mini = await miniFetchTemp(lat, lon);
      if (iconEl) iconEl.textContent = mini.icon || '⛅';
      if (tempEl) tempEl.textContent = mini.temp || '--°';
    });
  }
  
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        runSearch(e.target.value);
      }, 300);
    });
  }

  // ========== NAVIGATION ==========
  
  navHome.addEventListener('click', () => {
    showScreen(screenHome);
    if (homePlace) loadAndRender(homePlace);
  });
  
  navHourly.addEventListener('click', () => {
    showScreen(screenHourly);
    if (window.__PW_LAST_NORM) {
      renderSidebar(window.__PW_LAST_NORM);
    } else {
      console.warn('[NAVIGATION] Switched to Hourly but no weather data loaded yet');
    }
  });
  
  navWeek.addEventListener('click', () => {
    showScreen(screenWeek);
    if (window.__PW_LAST_NORM) {
      renderSidebar(window.__PW_LAST_NORM);
    } else {
      console.warn('[NAVIGATION] Switched to Week but no weather data loaded yet');
    }
  });
  
  navSearch.addEventListener('click', () => {
    showScreen(screenSearch);
    renderRecents();
    renderFavorites();
    if (window.__PW_LAST_NORM) {
      renderSidebar(window.__PW_LAST_NORM);
    } else {
      console.warn('[NAVIGATION] Switched to Search but no weather data loaded yet');
    }
  });
  
  navSettings.addEventListener('click', () => {
    showScreen(screenSettings);
    if (window.__PW_LAST_NORM) {
      renderSidebar(window.__PW_LAST_NORM);
    } else {
      console.warn('[NAVIGATION] Switched to Settings but no weather data loaded yet');
    }
  });

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      if (navigator.onLine && state?.city) {
        loadCity(state.city);
      }
    });
  }

  if (unitsTempSelect) {
    unitsTempSelect.addEventListener('change', () => {
      settings.temp = unitsTempSelect.value;
      saveSettings();
      applySettings();
    });
  }

  if (unitsWindSelect) {
    unitsWindSelect.addEventListener('change', () => {
      settings.wind = unitsWindSelect.value;
      saveSettings();
      applySettings();
    });
  }

  if (probRangeToggle) {
    probRangeToggle.addEventListener('change', () => {
      settings.range = !!probRangeToggle.checked;
      saveSettings();
      applySettings();
    });
  }

  if (timeFormatSelect) {
    timeFormatSelect.addEventListener('change', () => {
      settings.time = timeFormatSelect.value;
      saveSettings();
      applySettings();
    });
  }

  if (saveCurrent) {
    saveCurrent.addEventListener('click', () => {
      if (activePlace) addFavorite(activePlace);
    });
  }
  
  if (searchCancel) {
    searchCancel.addEventListener('click', () => {
      showScreen(screenHome);
      if (searchInput) searchInput.value = '';
    });
  }
  
  if (manageFavorites) {
    manageFavorites.addEventListener('click', () => {
      const list = loadFavorites();
      if (list.length === 0) {
        showToast('No saved places to manage');
        return;
      }
      manageMode = !manageMode;
      manageFavorites.textContent = manageMode ? 'Done' : 'Manage favourites';
      renderFavorites();
    });
  }

  if (clearRecentsBtn) {
    clearRecentsBtn.addEventListener('click', () => {
      clearRecents();
    });
  }

  // ========== INITIALIZATION ==========
  
  renderRecents();
  renderFavorites();
  loadSettings();
  applySettings();

  homePlace = loadJSON(STORAGE.home, null);
  const savedLocation = loadJSON(STORAGE.location, null);
  if (homePlace) {
    showScreen(screenHome);
    loadAndRender(homePlace);
  } else if (savedLocation?.lat && savedLocation?.lon) {
    const label = savedLocation.city && savedLocation.countryCode
      ? `${savedLocation.city}, ${savedLocation.countryCode}`
      : (savedLocation.city || "My Location");
    homePlace = { name: label, lat: savedLocation.lat, lon: savedLocation.lon };
    saveJSON(STORAGE.home, homePlace);
    showScreen(screenHome);
    loadAndRender(homePlace);
  } else {
    showScreen(screenHome);
    renderLoading("My Location");

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = round1(pos.coords.latitude);
          const lon = round1(pos.coords.longitude);
          try {
            const rev = await fetch(`/api/weather?reverse=1&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
            const data = await rev.json();
            const city = data?.city || "My Location";
            const countryCode = data?.countryCode || null;
            const name = countryCode ? `${city}, ${countryCode}` : city;
            saveJSON(STORAGE.location, { city, admin1: data?.admin1 || null, countryCode, lat, lon });
            homePlace = { name, lat, lon };
            saveJSON(STORAGE.home, homePlace);
            loadAndRender(homePlace);
          } catch {
            homePlace = { name: "My Location", lat, lon };
            saveJSON(STORAGE.home, homePlace);
            loadAndRender(homePlace);
          }
        },
        () => {
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
});</parameter>
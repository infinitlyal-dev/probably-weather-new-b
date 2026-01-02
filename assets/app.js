document.addEventListener('DOMContentLoaded', () => {
  const bgImg = document.getElementById('bgImg');
  const heatOverlay = document.getElementById('heatOverlay');
  const body = document.body;
  const headline = document.getElementById('headline');
  const headlineIcon = document.getElementById('headline-icon');
  const temp = document.getElementById('temp');
  const description = document.getElementById('description');
  const extremeLabel = document.getElementById('extremeLabel');
  const extremeValue = document.getElementById('extremeValue');
  const rainValue = document.getElementById('rainValue');
  const uvValue = document.getElementById('uvValue');
  const confidenceValue = document.getElementById('confidenceValue');
  const confidenceEl = document.getElementById('confidence');
  const confidenceBar = document.getElementById('confidenceBar');
  const locationEl = document.getElementById('location');
  const particles = document.getElementById('particles');
  const homeScreen = document.getElementById('home-screen');
  const hourlyScreen = document.getElementById('hourly-screen');
  const weekScreen = document.getElementById('week-screen');
  const searchScreen = document.getElementById('search-screen');
  const settingsScreen = document.getElementById('settings-screen');
  const dailyCards = document.getElementById('dailyCards');
  const hourlyTimeline = document.getElementById('hourlyTimeline');
  const searchInput = document.getElementById('searchInput');
  const saveCurrentBtn = document.getElementById('saveCurrent');
  const manageFavorites = document.getElementById('manageFavorites');
  const loader = document.getElementById('loader');
  const toast = document.getElementById('toast');
  const navHome = document.getElementById('navHome');
  const navHourly = document.getElementById('navHourly');
  const navWeek = document.getElementById('navWeek');
  const navSearch = document.getElementById('navSearch');
  const navSettings = document.getElementById('navSettings');

  let currentLat = -34.104;
  let currentLon = 18.817;
  let units = localStorage.getItem('units') || 'C';
  let theme = localStorage.getItem('theme') || 'auto';
  let favorites = JSON.parse(localStorage.getItem('probablyFavorites') || '[]');
  let recents = JSON.parse(localStorage.getItem('probablyRecents') || '[]');

  const humor = {
    cold: 'Time to build a snowman',
    heat: 'Frying an egg is a real option',
    storm: 'Better stay indoors',
    rain: 'The clouds are crying like NZ at the \'23 World Cup!',
    wind: 'Gale force—your bakkie might fly!',
    fog: 'Misty mayhem—can\'t see your braai from the stoep!',
    clear: 'Braai weather, boet!'
  };

  const icons = { cold: '❄️', heat: '🔥', storm: '⚡', rain: '🌧️', wind: '💨', fog: '🌫️', clear: '☀️' };

  const dummyHourly = new Array(24).fill(0).map((_, i) => ({ time: new Date(Date.now() + i*3600000).toISOString(), temp: 25 + Math.sin(i/4)*5, rain: Math.random()*20 }));
  const dummyDaily = new Array(7).fill(0).map((_, i) => ({ date: new Date(Date.now() + i*86400000).toISOString(), high: 30 + i*0.5, low: 20 + i*0.5, rainChance: 10 + i*5 }));

  const cached = localStorage.getItem('lastWeatherData');
  if (cached) {
    const data = JSON.parse(cached);
    updateUI(data);
    renderHourly(data.hourly || dummyHourly);
    renderWeek(data.daily || dummyDaily);
  } else {
    fallbackUI();
  }

  navigator.geolocation.getCurrentPosition(async (pos) => {
    currentLat = pos.coords.latitude;
    currentLon = pos.coords.longitude;
    const city = await reverseGeocode(currentLat, currentLon);
    locationEl.innerText = city || 'Your Location';
    await fetchWeather(currentLat, currentLon);
  }, async () => {
    locationEl.innerText = 'Strand, WC';
    await fetchWeather(currentLat, currentLon);
  });

  async function reverseGeocode(lat, lon) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
      const res = await fetch(url);
      const data = await res.json();
      return data.address.city || data.address.town || data.address.village || 'Your Location';
    } catch {
      return null;
    }
  }

  async function fetchWeather(lat, lon) {
    loader.classList.remove('hidden');
    try {
      const omUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,is_day&hourly=temperature_2m,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&timezone=auto&forecast_days=7`;
      const owmUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=a56be2054510bc8fed22998c68972876&units=metric`;
      const waUrl = `https://api.weatherapi.com/v1/forecast.json?key=a98886bfef6c4dcd8bf111514251512&q=${lat},${lon}&days=7`;

      const [omRes, owmRes, waRes] = await Promise.all([fetch(omUrl), fetch(owmRes), fetch(waUrl)].map(p => p.catch(() => null)));
      const omData = omRes && omRes.ok ? await omRes.json() : null;
      const owmData = owmRes && owmRes.ok ? await owmRes.json() : null;
      const waData = waRes && waRes.ok ? await waRes.json() : null;

      const activeSources = [omData, owmData, waData].filter(Boolean).length;
      if (activeSources === 0) throw new Error('No sources available');

      function median(arr) {
        const sorted = arr.filter(v => v != null).sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
      }

      const temps = [omData?.current.temperature_2m, owmData?.list[0].main.temp, waData?.current.temp_c];
      const highs = [omData?.daily.temperature_2m_max[0], owmData?.list[0].main.temp_max, waData?.forecast.forecastday[0].day.maxtemp_c];
      const lows = [omData?.daily.temperature_2m_min[0], owmData?.list[0].main.temp_min, waData?.forecast.forecastday[0].day.mintemp_c];
      const rainProbs = [omData?.daily.precipitation_probability_max[0], owmData?.list[0].rain?.['3h'] || 0, waData?.forecast.forecastday[0].day.daily_chance_of_rain];
      const uv = median([omData?.daily.uv_index_max[0], waData?.forecast.forecastday[0].day.uv]);
      const windKph = median([omData?.current.wind_speed_10m * 3.6, owmData?.list[0].wind.speed * 3.6, waData?.current.wind_kph]);

      const tempRange = Math.max(...temps.filter(v => v != null)) - Math.min(...temps.filter(v => v != null));
      const rainRange = Math.max(...rainProbs.filter(v => v != null)) - Math.min(...rainProbs.filter(v => v != null));
      const confidence = activeSources >= 3 && tempRange <= 3 && rainRange <= 20 ? 'High' : activeSources >= 2 ? 'Medium' : 'Low';

      const processed = {
        lowTemp: Math.round(median(lows)),
        highTemp: Math.round(median(highs)),
        rainChance: Math.round(median(rainProbs)),
        uv: Math.round(uv),
        windKph: Math.round(windKph),
        condition: determineCondition(median(temps), median(rainProbs), windKph),
        timeOfDay: getTimeOfDay(omData?.current.is_day === 1 || waData?.current.is_day === 1, new Date().getHours()),
        confidence,
        activeSources,
        hourly: omData?.hourly.time.map((t, i) => ({ time: t, temp: Math.round(median([omData.hourly.temperature_2m[i], waData.forecast.forecastday[Math.floor(i/24)].hour[i%24].temp_c])), rain: Math.round(median([omData.hourly.precipitation_probability[i], waData.forecast.forecastday[Math.floor(i/24)].hour[i%24].chance_of_rain])) })) || dummyHourly,
        daily: omData?.daily.time.map((t, i) => ({ date: t, high: Math.round(median([omData.daily.temperature_2m_max[i], waData.forecast.forecastday[i].day.maxtemp_c])), low: Math.round(median([omData.daily.temperature_2m_min[i], waData.forecast.forecastday[i].day.mintemp_c])), rainChance: Math.round(median([omData.daily.precipitation_probability_max[i], waData.forecast.forecastday[i].day.daily_chance_of_rain])) })) || dummyDaily
      };

      localStorage.setItem('lastWeatherData', JSON.stringify(processed));
      updateUI(processed);
      renderHourly(processed.hourly);
      renderWeek(processed.daily);
    } catch (e) {
      console.error('Fetch error:', e);
      fallbackUI();
    } finally {
      loader.classList.add('hidden');
    }
  }

  function determineCondition(temp, rainChance, windKph) {
    if (rainChance >= 60) return 'storm';
    if (rainChance >= 40) return 'rain';
    if (windKph >= 45) return 'wind';
    if (temp <= 12) return 'cold';
    if (temp >= 32) return 'heat';
    if (rainChance >= 20 || windKph >= 30) return 'fog';
    return 'clear';
  }

  function getTimeOfDay(isDay, hour) {
    if (hour < 6 || hour >= 20) return 'night';
    if (hour < 9) return 'dawn';
    if (hour < 17) return 'day';
    return 'dusk';
  }

  function updateUI(data) {
    const tod = data.timeOfDay || 'day';
    const cond = data.condition || 'clear';

    body.className = '';
    body.classList.add(`weather-${cond}`);
    heatOverlay.style.display = 'none';

    bgImg.src = `assets/images/bg/${cond}/${tod}.jpg`;

    headlineIcon.innerText = icons[cond];
    headline.innerHTML = `This is ${cond}.`;
    temp.innerText = `${data.lowTemp}—${data.highTemp}°`;
    description.innerText = humor[cond] + (cond === 'clear' || cond === 'heat' ? '<span class="braai-icon">🍖</span>' : '');
    extremeValue.innerText = cond.toUpperCase() + ` ${data.lowTemp}—${data.highTemp}°`;

    rainValue.innerText = data.rainChance < 20 ? 'Unlikely' : data.rainChance < 50 ? 'Possible' : 'Likely';
    rainValue.parentElement.classList.add(data.rainChance < 20 ? 'low' : data.rainChance < 50 ? 'medium' : 'high');

    uvValue.innerText = data.uv > 8 ? `High (${data.uv})` : data.uv > 5 ? `Moderate (${data.uv})` : `Low (${data.uv})`;
    uvValue.parentElement.classList.add(data.uv > 8 ? 'high' : data.uv > 5 ? 'medium' : 'low');

    confidenceEl.innerText = `PROBABLY • ${data.confidence.toUpperCase()} CONFIDENCE`;
    confidenceValue.innerHTML = `${data.confidence} <br><small>Based on ${data.activeSources} forecasts →</small>`;
    confidenceBar.style.width = `${(data.activeSources / 3 * 100)}%`;

    if (cond === 'heat') {
      heatOverlay.style.backgroundImage = `url(${bgImg.src})`;
      heatOverlay.style.display = 'block';
      heatOverlay.style.opacity = '0.5';
    }

    addParticles(cond);
    saveCurrentBtn.classList.remove('hidden');
  }

  // ... (keep renderHourly, renderWeek, fallbackUI, addParticles, renderFavorites, renderRecents, addToRecents, loadPlace, saveCurrentBtn listener with toast, manageFavorites, searchInput, showScreen, settings handlers, sw.js registration) ...
});
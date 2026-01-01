document.addEventListener('DOMContentLoaded', () => {
  const bgImg = document.getElementById('bgImg');
  const body = document.body;
  const headline = document.getElementById('headline');
  const temp = document.getElementById('temp');
  const description = document.getElementById('description');
  const extremeLabel = document.getElementById('extremeLabel');
  const extremeValue = document.getElementById('extremeValue');
  const rainValue = document.getElementById('rainValue');
  const uvValue = document.getElementById('uvValue');
  const confidenceValue = document.getElementById('confidenceValue');
  const location = document.getElementById('location');
  const particles = document.getElementById('particles');

  const humor = {
    // ... (same as previous)
  };

  const hour = new Date().getHours();
  let timeOfDay;
  if (hour < 6) timeOfDay = 'night';
  else if (hour < 12) timeOfDay = 'dawn';
  else if (hour < 18) timeOfDay = 'day';
  else timeOfDay = 'dusk';

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    location.innerText = 'Your Location';
    await fetchWeather(lat, lon);
  }, async () => {
    location.innerText = 'Strand, WC';
    await fetchWeather(-34.104, 18.817);
  });

  async function fetchWeather(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation_probability,uv_index,wind_speed_10m&hourly=temperature_2m`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      const current = data.current;
      const temp = current.temperature_2m;
      const tempRange = `${Math.floor(temp - 2)}–${Math.ceil(temp + 2)}°`;
      const rain = current.precipitation_probability || 0;
      const uv = current.uv_index || 0;
      const wind = current.wind_speed_10m || 0;

      let condition = 'clear';
      if (rain > 50) condition = 'storm';
      else if (rain > 10) condition = 'rain';
      if (wind > 40) condition = 'wind';
      if (uv < 2 && temp < 15) condition = 'fog';
      if (temp < 10) condition = 'cold';
      if (temp > 30) condition = 'heat';

      body.classList.add(`weather-${condition}`);
      bgImg.src = `assets/images/bg/${condition}/${timeOfDay}.jpg`;
      headline.innerText = `This is ${condition}.`;
      temp.innerText = tempRange;
      description.innerText = humor[condition][timeOfDay] || humor[condition]['day'];
      extremeLabel.innerText = "Today's extreme: " + condition.charAt(0).toUpperCase() + condition.slice(1);
      extremeValue.innerText = tempRange;
      rainValue.innerText = rain > 10 ? 'Likely' : 'Unlikely';
      uvValue.innerText = uv > 6 ? 'High' : uv > 3 ? 'Moderate' : 'Low';
      confidenceValue.innerHTML = 'High<br>Based on Open-Meteo';
      addParticles(condition);
    } catch (e) {
      console.error(e);
      fallbackUI();
    }
  }

  function fallbackUI() {
    // ... (same as previous)
  }

  function addParticles(condition) {
    // ... (same as previous)
  }
});
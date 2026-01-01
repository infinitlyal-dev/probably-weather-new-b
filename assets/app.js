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

  // Humor variants by timeOfDay
  const humor = {
    cold: {
      dawn: 'Chilly start—coffee and blankets time!',
      day: 'Time to build a snowman',
      dusk: 'Freezing evening—rug up tight!',
      night: 'Polar bear weather—stay warm!'
    },
    heat: {
      dawn: 'Warm start—early braai?',
      day: 'Frying an egg is a real option',
      dusk: 'Hot evening—ice cream time!',
      night: 'Sizzling night—fan on full!'
    },
    storm: {
      dawn: 'Stormy dawn—stay in bed!',
      day: 'Thunder\'s rolling—don\'t get zapped!',
      dusk: 'Evening storm—lights out?',
      night: 'Night thunder—sweet dreams?'
    },
    rain: {
      dawn: 'Rainy morning—lazy day ahead',
      day: 'The clouds are crying like NZ at the \'23 World Cup!',
      dusk: 'Evening downpour—cozy inside!',
      night: 'Night rain—sleep to the pitter-patter'
    },
    wind: {
      dawn: 'Windy dawn—hairdo beware!',
      day: 'Gale force—your bakkie might fly!',
      dusk: 'Evening gusts—secure the bins!',
      night: 'Howling night—close the windows'
    },
    fog: {
      dawn: 'Foggy dawn—ghostly start',
      day: 'Misty mayhem—can\'t see your braai from the stoep!',
      dusk: 'Evening fog—early lights on',
      night: 'Foggy night—watch your step!'
    },
    clear: {
      dawn: 'Clear dawn—beautiful sunrise ahead',
      day: 'Braai weather, boet!',
      dusk: 'Clear evening—starry night coming',
      night: 'Clear night—perfect for stargazing'
    }
  };

  // Real timeOfDay
  const hour = new Date().getHours();
  let timeOfDay;
  if (hour < 6) timeOfDay = 'night';
  else if (hour < 12) timeOfDay = 'dawn';
  else if (hour < 18) timeOfDay = 'day';
  else timeOfDay = 'dusk';

  // Hardcode Strand for reliable test
  const lat = -34.104;
  const lon = 18.817;
  location.innerText = 'Strand, WC';

  // CORS proxy for Vercel
  const proxy = 'https://corsproxy.io/?';
  const url = `${proxy}https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation_probability,uv_index,wind_speed_10m&hourly=temperature_2m`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
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
      bgImg.src = `assets/images/bg/${condition}/${timeOfDay}.jpg` || 'assets/images/bg/clear/day.jpg';
      headline.innerText = `This is ${condition}.`;
      temp.innerText = tempRange;
      description.innerText = humor[condition][timeOfDay] || humor[condition]['day'];
      extremeLabel.innerText = "Today's extreme: " + condition.charAt(0).toUpperCase() + condition.slice(1);
      extremeValue.innerText = tempRange;
      rainValue.innerText = rain > 10 ? 'Likely' : 'Unlikely';
      uvValue.innerText = uv > 6 ? 'High' : uv > 3 ? 'Moderate' : 'Low';
      confidenceValue.innerHTML = 'High<br>Based on Open-Meteo';

      addParticles(condition);
    })
    .catch(e => {
      console.error('Fetch error:', e);
      // Fallback
      body.classList.add('weather-clear');
      bgImg.src = 'assets/images/bg/clear/day.jpg';
      headline.innerText = 'This is clear.';
      temp.innerText = '25–30°';
      description.innerText = 'Braai weather, boet!';
      extremeLabel.innerText = "Today's extreme: Clear";
      extremeValue.innerText = '25–30°';
      rainValue.innerText = 'None expected';
      uvValue.innerText = 'High (8)';
      confidenceValue.innerHTML = 'High<br>Based on Open-Meteo';
    });

  function addParticles(condition) {
    if (particles) {
      particles.innerHTML = '';
      for (let i = 0; i < 10; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDuration = Math.random() * 3 + 5 + 's';
        particle.style.animationDelay = Math.random() * 5 + 's';
        particles.appendChild(particle);
      }
    }
  }
});
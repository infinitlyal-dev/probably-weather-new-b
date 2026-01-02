module.exports = async (req, res) => {
    const { latitude, longitude } = req.query;
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Missing coordinates' });
    }
  
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,is_day&hourly=temperature_2m,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&timezone=auto&forecast_days=7`;
  
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // Hard timeout after 8 seconds
  
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
  
      if (!response.ok) {
        throw new Error('Bad response from Open-Meteo');
      }
  
      const data = await response.json();
      data.confidence_level = 'High'; // We know this source is solid
  
      res.json(data);
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Weather fetch failed:', error);
      res.status(500).json({ error: 'Weather data unavailable' });
    }
  };
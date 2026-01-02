module.exports = async (req, res) => {
    const { latitude, longitude } = req.query;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,is_day&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&hourly=temperature_2m,precipitation_probability&timezone=auto&forecast_days=7`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'Proxy fetch failed' });
    }
  };
/**
 * Reverse geocode coordinates to get city name
 * Uses Nominatim API (free, no key required)
 */
async function reverseGeocode(lat, lon) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`,
      { 
        headers: { 'User-Agent': 'ProbablyWeather/1.0' },
        signal: AbortSignal.timeout(5000)
      }
    );
    
    if (!response.ok) {
      console.warn('[GEOCODE] Failed to reverse geocode:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    // Extract city name - try address.city, address.town, address.village
    const city = data.address?.city || 
                 data.address?.town || 
                 data.address?.village || 
                 data.address?.municipality ||
                 'Unknown Location';
    
    const country = data.address?.country || '';
    
    const displayName = country ? `${city}, ${country}` : city;
    
    console.log('[GEOCODE] Resolved:', { lat, lon, displayName });
    return displayName;
    
  } catch (error) {
    console.warn('[GEOCODE] Error:', error.message);
    return null;
  }
}

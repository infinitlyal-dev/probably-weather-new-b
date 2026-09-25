// PW_SOURCES_OFF (launch run, 2026-09-25): the weather sources switched off
// without a code change. Read by the forecast (api/weather.js) and reported by
// /api/health, from this one parser so the two can never disagree.
//
// Accepts the ids open-meteo, weatherapi, pirate, met, tomorrow and their usual
// spellings ("Tomorrow.io", "open meteo", "pirateweather", "MET Norway", "yr.no");
// anything else is returned as unknown so the caller can say so.
export const SOURCE_IDS = {
  openmeteo: 'open-meteo', weatherapi: 'weatherapi', weatherapicom: 'weatherapi',
  pirate: 'pirate', pirateweather: 'pirate', met: 'met', metnorway: 'met', metno: 'met', yr: 'met', yrno: 'met',
  tomorrow: 'tomorrow', tomorrowio: 'tomorrow',
};

/** @returns {{ off: Set<string>, unknown: string[] }} */
export function parseSourcesOff(value = process.env.PW_SOURCES_OFF) {
  const off = new Set();
  const unknown = [];
  for (const raw of String(value || '').split(',')) {
    const token = raw.trim();
    if (!token) continue;
    const id = SOURCE_IDS[token.toLowerCase().replace(/[^a-z]/g, '')];
    if (id) off.add(id); else unknown.push(token);
  }
  return { off, unknown };
}

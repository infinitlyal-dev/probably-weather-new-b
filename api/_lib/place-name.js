// Server-side place-name fallback for share previews (2026-09-15).
//
// A share preview needs a place. The share link now carries one; when it does
// not (an old /share?lat&lon link, or a sender whose own name was a
// placeholder) and the forecast came back without a resolved name — a cell
// cached as 'Unknown' after a skipped or timed-out LocationIQ lookup — this asks
// LocationIQ's reverse endpoint once, through api/geocode.js, so the call spends
// the same global LocationIQ budget and per-IP limit as every other lookup.
import geocodeHandler from '../geocode.js';
import { cleanShareName } from '../../assets/share-url.js';

export async function reversePlaceName(lat, lon, clientIp) {
  let body = null;
  const req = {
    query: { type: 'reverse', lat: String(lat), lon: String(lon) },
    headers: clientIp ? { 'x-real-ip': clientIp } : {},
  };
  const res = {
    status() { return this; },
    setHeader() { return this; },
    json(payload) { body = payload; return this; },
  };
  try {
    await geocodeHandler(req, res);
  } catch (error) {
    console.error(`[pw-share-name] reverse lookup failed lat=${lat} lon=${lon}: ${error?.message || error}`);
    return null;
  }
  const name = body?.ok ? cleanShareName(body.name) : '';
  return name || null;
}

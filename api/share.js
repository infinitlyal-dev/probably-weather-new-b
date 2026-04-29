import { buildOgImageUrl, SHARE_ORIGIN } from '../assets/share-url.js';

const escapeAttr = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const isValidLat = (value) => Number.isFinite(Number(value)) && Number(value) >= -90 && Number(value) <= 90;
const isValidLon = (value) => Number.isFinite(Number(value)) && Number(value) >= -180 && Number(value) <= 180;

function getQuery(req) {
  if (req?.query) return req.query;
  const url = new URL(req?.url || '/', SHARE_ORIGIN);
  return Object.fromEntries(url.searchParams.entries());
}

export function buildShareMetaHtml(query = {}) {
  const lat = query.lat;
  const lon = query.lon;
  const lang = query.lang || 'en';
  const hasCoords = isValidLat(lat) && isValidLon(lon);
  const appParams = new URLSearchParams();
  if (hasCoords) {
    appParams.set('lat', String(lat));
    appParams.set('lon', String(lon));
  }
  appParams.set('lang', String(lang));
  const appUrl = `${SHARE_ORIGIN}/?${appParams.toString()}`;
  const ogImage = buildOgImageUrl({ lat, lon, lang });
  const shareUrl = `${SHARE_ORIGIN}/share?${new URLSearchParams({ ...(hasCoords ? { lat: String(lat), lon: String(lon) } : {}), lang: String(lang) }).toString()}`;

  return `<!doctype html>
<html lang="${escapeAttr(String(lang).slice(0, 2) || 'en')}">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
  <title>Probably Weather</title>
  <meta name="description" content="South African weather, in your language."/>
  <meta property="og:title" content="Probably Weather"/>
  <meta property="og:description" content="South African weather, in your language."/>
  <meta property="og:type" content="website"/>
  <meta property="og:url" content="${escapeAttr(shareUrl)}"/>
  <meta property="og:image" content="${escapeAttr(ogImage)}"/>
  <meta property="og:image:width" content="1200"/>
  <meta property="og:image:height" content="630"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="Probably Weather"/>
  <meta name="twitter:description" content="South African weather, in your language."/>
  <meta name="twitter:image" content="${escapeAttr(ogImage)}"/>
  <meta http-equiv="refresh" content="0; url=${escapeAttr(appUrl)}"/>
  <script>window.location.replace(${JSON.stringify(appUrl)});</script>
</head>
<body>
  <p><a href="${escapeAttr(appUrl)}">Open Probably Weather</a></p>
</body>
</html>`;
}

export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  res.status(200).end(buildShareMetaHtml(getQuery(req)));
}

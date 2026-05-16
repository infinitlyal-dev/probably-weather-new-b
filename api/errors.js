// /api/errors.js
// Probably Weather — client-side error sink.
//
// The browser POSTs to this endpoint when an unhandled JS error or unhandled
// promise rejection happens in production. We log it to Vercel's function
// console (searchable via the Vercel dashboard) so we have visibility into
// what's actually breaking for real users — especially relevant before ad-
// network scripts land and start injecting their own JS into our pages.
//
// Intentionally minimal: no database, no external SaaS, no SDK. Vercel's
// function logs are enough for the first launch. If volume gets noisy and we
// need grouping/dashboards/alerting, drop in Sentry on top of this.
//
// Throttled / deduped CLIENT-SIDE so a single error doesn't fire hundreds of
// reports. Server-side just accepts whatever lands.

export default async function handler(req, res) {
  // CORS preflight for same-origin POSTs from the PWA in standalone mode.
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    // Body shape (best-effort — client may send less):
    //   { message, stack, source, line, col, url, userAgent, swVersion,
    //     kind: 'error' | 'unhandledrejection', timestamp }
    const body = req.body || {};
    const summary = {
      kind: body.kind || 'error',
      message: String(body.message || 'no-message').slice(0, 500),
      url: String(body.url || '').slice(0, 300),
      source: String(body.source || '').slice(0, 300),
      line: body.line ?? null,
      col: body.col ?? null,
      sw: body.swVersion || null,
      ua: String(body.userAgent || '').slice(0, 200),
      ts: body.timestamp || new Date().toISOString(),
    };
    // Stack trace can be long — log separately on its own line so the summary
    // stays compact and grep-friendly in the Vercel log viewer.
    console.error('[pw-error]', JSON.stringify(summary));
    if (body.stack) {
      console.error('[pw-error-stack]', String(body.stack).slice(0, 4000));
    }
    res.status(204).end();
  } catch (err) {
    // Never let the error sink itself become a source of errors.
    res.status(204).end();
  }
}

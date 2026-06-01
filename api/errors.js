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
// reports.
//
// SECURITY (audit #1): this is an unauthenticated log sink. It is restricted
// to same-origin / known-origin POSTs so a third-party page can't spray the
// Vercel log retention pool with junk. The app posts same-origin via
// navigator.sendBeacon / fetch (assets/app.js reportClientError), both of
// which carry an Origin header (and, under our strict-origin-when-cross-origin
// Referrer-Policy, a Referer) for same-origin POSTs. Cross-origin browser JS
// is blocked because we never return a permissive CORS grant on preflight;
// non-browser clients are blocked by the server-side origin check below.
// NOTE: a determined non-browser client can still spoof the Origin header —
// the durable complement to this is per-IP rate limiting (audit #3), now
// implemented below via the shared Upstash limiter (fails open if unreachable).

import { checkRateLimit } from './_lib/rate-limit.js';
import { errorsLimiter } from './_lib/limiters.js';

// Production origins are always allowed. Additional origins (e.g. a Vercel
// preview host or http://localhost:3000 during dev) can be opted in via the
// PW_ERROR_ALLOWED_ORIGINS env var — a comma-separated exact-origin list.
// Deliberately NOT a wildcard: that would re-open the unauthenticated sink.
// Unset in production → only the two real origins are accepted.
const EXTRA_ORIGINS = (process.env.PW_ERROR_ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const ALLOWED_ORIGINS = new Set([
  'https://www.probablyweather.co.za',
  'https://probablyweather.co.za',
  ...EXTRA_ORIGINS,
]);

// Resolve a request's claimed origin from the Origin header, falling back to
// the origin portion of the Referer. Returns null when neither is present
// (typical of curl / scripted clients) or when parsing fails.
// The Referer fallback is what keeps Origin-less same-origin beacons working:
// under our strict-origin-when-cross-origin Referrer-Policy a same-origin POST
// always carries a full-URL Referer even when iOS Safari omits Origin. Residual
// (accepted): a browser hardened to send neither header on same-origin POST has
// its fire-and-forget error report dropped (403) — telemetry loss, not an app
// break, since the app never depends on the report succeeding.
function claimedOrigin(req) {
  const headers = req?.headers || {};
  const origin = headers.origin;
  if (typeof origin === 'string' && origin) return origin;
  const referer = headers.referer || headers.referrer;
  if (typeof referer === 'string' && referer) {
    try {
      const u = new URL(referer);
      return `${u.protocol}//${u.host}`;
    } catch {
      return null;
    }
  }
  return null;
}

function isAllowedOrigin(req) {
  const origin = claimedOrigin(req);
  return origin != null && ALLOWED_ORIGINS.has(origin);
}

// Reflect a validated Origin back (never "*"). Only set when the Origin header
// itself is on the allowlist, which is the only case a browser needs CORS for.
function applyCors(req, res) {
  const origin = req?.headers?.origin;
  if (typeof origin === 'string' && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
}

export default async function handler(req, res) {
  // CORS preflight. Only an allowlisted Origin gets a grant; everything else
  // gets a bare 204 with no Access-Control-Allow-Origin, so the browser blocks
  // the follow-up cross-origin POST.
  if (req.method === 'OPTIONS') {
    applyCors(req, res);
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  // Server-side origin gate — blocks non-browser clients that ignore CORS.
  if (!isAllowedOrigin(req)) {
    res.status(403).json({ ok: false, error: 'Forbidden' });
    return;
  }
  applyCors(req, res);

  // Per-IP rate limit (after the origin gate so only same-origin POSTs count).
  // Fails open if Upstash is unreachable — error reporting is fire-and-forget,
  // so a 429 is silently ignored client-side either way.
  const rl = await checkRateLimit(req, errorsLimiter());
  if (!rl.allowed) {
    res.status(429).json({ ok: false, error: 'Too many requests' });
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

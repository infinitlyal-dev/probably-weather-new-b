// /api/csp-report.js
// Probably Weather — Content-Security-Policy violation sink.
//
// Both CSP headers in vercel.json — the enforcing policy and the report-only
// copy kept alongside it for its first week (2026-09-15 → 2026-09-22) — carry
// `report-uri /api/csp-report`. Before this existed the report-only policy
// reported nowhere: a violation only ever reached the visitor's own console, so
// the "report-clean period" review/CSP-NOTES.md asked for could not be observed.
//
// Browsers POST {"csp-report": {...}} as application/csp-report, with no
// cookies and often no Origin header, so the origin gate is on the REPORTED
// page, not the request: a report about a page that is not ours is dropped.
// Every URL goes through sanitizeTelemetryUrl (path + lang + condition), and the
// script sample is never logged — the old /share script carried coordinates.

import { checkRateLimit } from './_lib/rate-limit.js';
import { errorsLimiter } from './_lib/limiters.js';
import { sanitizeTelemetryUrl } from '../assets/share-url.js';

const OUR_HOSTS = new Set(['www.probablyweather.co.za', 'probablyweather.co.za']);
const MAX_BODY_BYTES = 16 * 1024;

// Vercel pre-parses application/json into an object; application/csp-report can
// arrive as a string, a Buffer or an unread stream. Anything over the cap is
// treated as junk rather than read to the end.
function readBody(req) {
  const body = req.body;
  if (body != null) {
    if (typeof body === 'string') return Promise.resolve(body);
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(body)) return Promise.resolve(body.toString('utf8'));
    return Promise.resolve(body);
  }
  if (typeof req.on !== 'function') return Promise.resolve('');
  return new Promise((resolve) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => { size += chunk.length; if (size <= MAX_BODY_BYTES) chunks.push(chunk); });
    req.on('end', () => resolve(size > MAX_BODY_BYTES ? '' : Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => resolve(''));
  });
}

function parseReport(body) {
  let parsed = body;
  if (typeof body === 'string') {
    if (!body || body.length > MAX_BODY_BYTES) return null;
    try { parsed = JSON.parse(body); } catch { return null; }
  }
  // report-uri shape: { "csp-report": {...} }. Reporting API shape, should a
  // browser ever send it here: [{ type: "csp-violation", body: {...} }].
  const r = Array.isArray(parsed)
    ? parsed.find((entry) => entry?.type === 'csp-violation')?.body
    : parsed?.['csp-report'];
  if (!r || typeof r !== 'object') return null;
  return {
    document: r['document-uri'] ?? r.documentURL,
    directive: r['effective-directive'] ?? r['violated-directive'] ?? r.effectiveDirective,
    blocked: r['blocked-uri'] ?? r.blockedURL,
    disposition: r.disposition,
    source: r['source-file'] ?? r.sourceFile,
    line: r['line-number'] ?? r.lineNumber,
  };
}

function hostOf(value) {
  try { return new URL(String(value)).hostname; } catch { return ''; }
}

// 'inline' / 'eval' / 'data' stay as they are; our own URLs lose their query;
// a third-party URL keeps origin + path only.
function blockedLabel(value) {
  const v = String(value || '');
  if (!v) return null;
  if (/^(inline|eval|wasm-eval|data|blob|self)$/i.test(v)) return v.toLowerCase();
  try {
    const u = new URL(v);
    if (OUR_HOSTS.has(u.hostname)) return sanitizeTelemetryUrl(v);
    return `${u.protocol}//${u.host}${u.pathname}`.slice(0, 200);
  } catch {
    return v.slice(0, 40);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }
  // Same per-IP bucket as the client error sink; fails open without Upstash.
  const rl = await checkRateLimit(req, errorsLimiter());
  if (!rl.allowed) {
    res.status(429).end();
    return;
  }
  try {
    const report = parseReport(await readBody(req));
    if (!report) {
      res.status(400).end();
      return;
    }
    if (!OUR_HOSTS.has(hostOf(report.document))) {
      res.status(204).end();
      return;
    }
    const disposition = report.disposition === 'report' ? 'report' : 'enforce';
    const line = JSON.stringify({
      disposition,
      directive: String(report.directive || '').slice(0, 60),
      blocked: blockedLabel(report.blocked),
      page: sanitizeTelemetryUrl(String(report.document)),
      source: report.source ? sanitizeTelemetryUrl(String(report.source)) : null,
      line: Number.isFinite(Number(report.line)) ? Number(report.line) : null,
    });
    // Enforced = something was actually blocked for a visitor: error level, so
    // it reaches the runtime error table. Report-only stays at warn.
    if (disposition === 'enforce') console.error('[pw-csp]', line);
    else console.warn('[pw-csp]', line);
    res.status(204).end();
  } catch {
    // The sink must never become a source of errors.
    res.status(204).end();
  }
}

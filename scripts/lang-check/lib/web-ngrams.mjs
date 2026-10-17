// Current text from sources in good standing, kept as WORD and N-GRAM COUNTS ONLY (9 Oct 2026, Al's brief).
//
// Every page is fetched, reduced to its paragraphs in the target language, counted, and dropped: no sentence, no passage,
// no page text is written anywhere. What is stored per language is .lang-check-cache/ngrams/<lang>.json — unigram,
// bigram and trigram counts (pruned below a floor) with, per source, how many pages and tokens it gave — plus the local
// corpora already in the cache (Leipzig, NCHLT running text, Wikipedia, the Constitution), counted the same way.
//
// Manners: robots.txt is read first and obeyed for the `*` group (longest match, Allow beats Disallow on a tie, `*` and
// `$` wildcards); one request per host every 1.5 s; a named User-Agent with a contact address; pages capped per source.
// Sources that refuse (PanSALB's robots.txt disallows everything) or never answer (SABC News loops its redirects for any
// client without a browser) are reported as such and skipped — never worked around.

import fs from 'node:fs';
import path from 'node:path';
import { CACHE } from './build-index.mjs';
import { tokenize, sentences } from './text.mjs';

const UA = 'ProbablyWeather-langcheck/0.2 (+https://www.probablyweather.co.za; infinitlyal@gmail.com)';
export const NGRAM_DIR = path.join(CACHE, 'ngrams');

// lang, where to find article URLs (sitemaps, or a crawl from a section root), how many pages at most
export const WEB_SOURCES = [
  { id: 'isolezwe', lang: 'zu', name: 'Isolezwe (isiZulu daily)', host: 'https://isolezwe.co.za', sitemaps: ['/sitemap/isolezwe/izindaba/', '/sitemap/isolezwe/ezokungcebeleka/', '/sitemap/isolezwe/ezemidlalo/'], max: 300 },
  { id: 'isolezwe-xh', lang: 'xh', name: "I'solezwe lesiXhosa (isiXhosa daily)", host: 'https://isolezwelesixhosa.co.za', sitemaps: ['/sitemap-news.xml', '/sitemap.xml'], max: 300 },
  { id: 'govza-zu', lang: 'zu', name: 'gov.za isiZulu pages', host: 'https://www.gov.za', crawl: '/zu', prefix: '/zu/', max: 150 },
  { id: 'govza-xh', lang: 'xh', name: 'gov.za isiXhosa pages', host: 'https://www.gov.za', crawl: '/xh', prefix: '/xh/', max: 150 },
  { id: 'govza-st', lang: 'st', name: 'gov.za Sesotho pages', host: 'https://www.gov.za', crawl: '/st', prefix: '/st/', max: 150 },
  { id: 'govza-af', lang: 'af', name: 'gov.za Afrikaans pages', host: 'https://www.gov.za', crawl: '/af', prefix: '/af/', max: 150 },
  { id: 'maroela', lang: 'af', name: 'Maroela Media', host: 'https://maroelamedia.co.za', sitemapIndex: '/sitemap_index.xml', sitemapMatch: /post-sitemap\d+\.xml/, newestSitemaps: 3, max: 300 },
  { id: 'netwerk24', lang: 'af', name: 'Netwerk24 (open pages only)', host: 'https://www.netwerk24.com', crawl: '/netwerk24', prefix: '/netwerk24/', max: 120 },
  { id: 'biblesociety', lang: 'af', name: 'Bible Society of South Africa (site pages)', host: 'https://biblesociety.co.za', sitemapIndex: '/sitemap_index.xml', sitemapMatch: /(page|post)-sitemap\d*\.xml/, newestSitemaps: 2, max: 80 },
  { id: 'sabc', lang: 'zu', name: 'SABC News', host: 'https://www.sabcnews.com', crawl: '/sabcnews/', prefix: '/sabcnews/', max: 0, unreachable: 'robots.txt and every page redirect between http and https forever (a bot wall); not worked around' },
  { id: 'pansalb', lang: 'zu', name: 'PanSALB spelling and orthography rules', host: 'https://www.pansalb.org', max: 0, refused: 'robots.txt: User-agent * Disallow / — not fetched' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// One queue per host: each request reserves the next 1.5 s slot before it waits, so harvests running side by side on
// the same host (the four gov.za sections) cannot wake together and burst (Sol, 9 Oct 2026).
const nextSlot = new Map();
async function hostTurn(host) {
  const at = Math.max(Date.now(), nextSlot.get(host) || 0);
  nextSlot.set(host, at + 1500);
  const wait = at - Date.now();
  if (wait > 0) await sleep(wait);
}
// Redirects are followed by hand, at most three, same origin only, and each hop only if `allow` (robots) permits it.
async function politeFetch(url, allow = () => true) {
  let u = url;
  for (let hop = 0; hop < 4; hop++) {
    await hostTurn(new URL(u).host);
    try {
      const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xml;q=0.9,*/*;q=0.5' }, redirect: 'manual', signal: AbortSignal.timeout(20000) });
      if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
        const next = new URL(r.headers.get('location'), u).href;
        if (new URL(next).origin !== new URL(url).origin || !allow(next)) return { status: r.status, body: '', note: `redirect to ${next} not followed` };
        u = next; continue;
      }
      if (!r.ok) return { status: r.status, body: '' };
      return { status: r.status, body: await r.text(), url: u };
    } catch (e) { return { status: 0, body: '', error: e.message }; }
  }
  return { status: 0, body: '', error: 'too many redirects' };
}

// ---------- robots.txt (the `*` group) ----------
export function parseRobots(txt) {
  const groups = []; let cur = null; let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim(); if (!line) continue;
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line); if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === 'user-agent') { if (!lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur); } cur.agents.push(v.toLowerCase()); lastWasAgent = true; continue; }
    lastWasAgent = false;
    if (!cur) continue;
    if (k === 'allow' || k === 'disallow') cur.rules.push({ allow: k === 'allow', path: v });
  }
  const star = groups.filter((g) => g.agents.includes('*')).flatMap((g) => g.rules);
  return star;
}
export function robotsAllows(rules, pathname) {
  let best = null;
  for (const r of rules) {
    if (!r.path) { if (!r.allow) continue; }
    const re = new RegExp('^' + r.path.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$').replace(/\$$/, '$'));
    if (!re.test(pathname)) continue;
    const len = r.path.length;
    if (!best || len > best.len || (len === best.len && r.allow)) best = { len, allow: r.allow };
  }
  return best ? best.allow : true;
}

// ---------- page → paragraphs ----------
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…' };
function decode(s) { return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(parseInt(e.slice(1).replace(/^x/i, ''), e[1].toLowerCase() === 'x' ? 16 : 10)) : ENT[e.toLowerCase()] ?? ' ')); }
export function paragraphs(html) {
  const body = html.replace(/<(script|style|noscript|svg|nav|footer|header|form)[\s\S]*?<\/\1>/gi, ' ');
  const out = [];
  for (const m of body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const t = decode(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (t.length >= 40) out.push(t);
  }
  return out;
}
function links(html, base, prefix) {
  const out = new Set();
  for (const m of html.matchAll(/href="([^"#?]+)"/gi)) {
    try { const u = new URL(decode(m[1]), base); if (u.origin === new URL(base).origin && u.pathname.startsWith(prefix)) out.add(u.origin + u.pathname); } catch {}
  }
  return [...out];
}
const locs = (xml) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => decode(m[1]));

// ---------- counting ----------
export class Counts {
  constructor() { this.uni = new Map(); this.bi = new Map(); this.tri = new Map(); this.tokens = 0; }
  addText(text, lang) {
    for (const s of sentences(text)) {
      const ks = tokenize(s, lang).map((t) => t.key).filter((k) => !/^\d/.test(k));
      if (ks.length < 2) continue;
      const seq = ['<s>', ...ks, '</s>'];
      for (let i = 0; i < seq.length; i++) {
        if (i > 0 && i < seq.length - 1) { this.uni.set(seq[i], (this.uni.get(seq[i]) || 0) + 1); this.tokens++; }
        if (i > 0) { const b = `${seq[i - 1]} ${seq[i]}`; this.bi.set(b, (this.bi.get(b) || 0) + 1); }
        if (i > 1) { const t = `${seq[i - 2]} ${seq[i - 1]} ${seq[i]}`; this.tri.set(t, (this.tri.get(t) || 0) + 1); }
      }
    }
  }
  merge(o) { for (const k of ['uni', 'bi', 'tri']) for (const [w, n] of o[k]) this[k].set(w, (this[k].get(w) || 0) + n); this.tokens += o.tokens; }
}

// A paragraph counts for a language when most of its words are attested there and fewer in English.
export function inLanguage(par, lang, idx, enIdx) {
  const ks = tokenize(par, lang).map((t) => t.key).filter((k) => k.length >= 3);
  if (ks.length < 6) return false;
  const own = ks.filter((k) => idx.has(k)).length / ks.length, en = ks.filter((k) => enIdx.has(k)).length / ks.length;
  return own >= 0.5 && own > en;
}

export async function harvest(src, { idx, enIdx, log = console.log } = {}) {
  const report = { id: src.id, lang: src.lang, name: src.name, host: src.host, pages: 0, paragraphs: 0, tokens: 0, skippedByRobots: 0, failed: 0 };
  if (src.refused || src.unreachable) { report.note = src.refused || src.unreachable; return { report, counts: new Counts() }; }
  const robots = await politeFetch(`${src.host}/robots.txt`);
  const rules = robots.status === 200 ? parseRobots(robots.body) : [];
  report.robots = robots.status === 200 ? `read (${rules.length} rules for *)` : `HTTP ${robots.status || robots.error} — treated as no rules`;
  const ok = (u) => { const x = new URL(u); const a = robotsAllows(rules, x.pathname + x.search); // the query counts (Disallow: /search?q=*)
    if (!a) report.skippedByRobots++; return a; };
  let urls = [];
  if (src.sitemapIndex) {
    const ix = ok(src.host + src.sitemapIndex) ? await politeFetch(src.host + src.sitemapIndex, ok) : { body: '' };
    const maps = locs(ix.body).filter((u) => src.sitemapMatch.test(u)).sort((a, b) => Number((/(\d+)\.xml/.exec(b) || [0, 0])[1]) - Number((/(\d+)\.xml/.exec(a) || [0, 0])[1])).slice(0, src.newestSitemaps || 1);
    for (const m of maps) if (ok(m)) urls.push(...locs((await politeFetch(m, ok)).body));
  }
  // a sitemap may list further sitemaps (I'solezwe lesiXhosa: /sitemap.xml → /sitemap/iindaba/ → articles): follow two levels
  const isMap = (u) => /\.xml$|\/sitemap(\/|$)/.test(new URL(u).pathname);
  const expand = async (u, depth) => {
    if (!ok(u)) return;
    for (const l of locs((await politeFetch(u, ok)).body)) {
      if (isMap(l)) { if (depth < 2 && urls.length < src.max * 3) await expand(l, depth + 1); } else urls.push(l);
    }
  };
  for (const sm of src.sitemaps || []) await expand(src.host + sm, 0);
  log(`  ${src.id}: robots ${report.robots}; ${urls.length} URLs from sitemaps`);
  const counts = new Counts();
  const seen = new Set();
  const queue = src.crawl ? [src.host + src.crawl] : [];
  urls = [...new Set(urls)].filter((u) => { try { return new URL(u).origin === new URL(src.host).origin; } catch { return false; } });
  const take = async (u) => {
    if (seen.has(u) || !ok(u)) return null;
    seen.add(u);
    const r = await politeFetch(u, ok);
    if (!r.body) { report.failed++; return null; }
    report.pages++;
    if (report.pages % 25 === 0) log(`    ${src.id}: ${report.pages} pages…`);
    for (const p of paragraphs(r.body)) if (inLanguage(p, src.lang, idx, enIdx)) { counts.addText(p, src.lang); report.paragraphs++; }
    return r.body;
  };
  if (src.crawl) {
    while (queue.length && report.pages < src.max) {
      const body = await take(queue.shift());
      if (body) for (const l of links(body, src.host, src.prefix)) if (!seen.has(l) && !queue.includes(l)) queue.push(l);
    }
  } else {
    for (const u of urls) { if (report.pages >= src.max) break; await take(u); }
    report.sitemapUrls = urls.length;
  }
  report.tokens = counts.tokens;
  log(`  ${src.id}: ${report.pages} pages, ${report.paragraphs} paragraphs in ${src.lang}, ${report.tokens} tokens${report.skippedByRobots ? `, ${report.skippedByRobots} URLs left alone (robots)` : ''}`);
  return { report, counts };
}

// Prune and write: unigrams ≥ 1, bigrams ≥ 2, trigrams ≥ 2 — enough to attest a pairing, not to rebuild a sentence.
export function writeNgrams(lang, counts, reports) {
  fs.mkdirSync(NGRAM_DIR, { recursive: true });
  const prune = (m, min) => Object.fromEntries([...m].filter(([, n]) => n >= min));
  const doc = { lang, builtAt: new Date().toISOString(), tokens: counts.tokens, sources: reports, uni: prune(counts.uni, 1), bi: prune(counts.bi, 2), tri: prune(counts.tri, 2) };
  fs.writeFileSync(path.join(NGRAM_DIR, `${lang}.json`), JSON.stringify(doc));
  return { uni: Object.keys(doc.uni).length, bi: Object.keys(doc.bi).length, tri: Object.keys(doc.tri).length };
}

// The local corpora already in the cache, counted the same way (their text stays where it is).
export function localCounts(lang, log = console.log) {
  const files = [];
  const L = path.join(CACHE, 'leipzig');
  const PREFIX = { zu: 'zul', xh: 'xho', st: 'sot', af: 'afr' }[lang];
  if (fs.existsSync(L)) for (const d of fs.readdirSync(L)) if (d.startsWith(PREFIX) && !d.endsWith('.gz')) {
    const f = path.join(L, d, `${d}-sentences.txt`); if (fs.existsSync(f)) files.push([`leipzig:${d}`, f, 'tsv']);
  }
  const T = path.join(CACHE, 'text');
  const C3 = { zu: 'zul', xh: 'xho', st: 'sot', af: 'afr' }[lang];
  for (const f of [`constitution-${C3}.txt`, `wiki-${lang}.txt`]) if (fs.existsSync(path.join(T, f))) files.push([f.replace('.txt', ''), path.join(T, f), 'txt']);
  const N = path.join(CACHE, 'nchlt');
  if (fs.existsSync(N)) for (const f of fs.readdirSync(N)) if (f.startsWith(`${lang}.lemma.`) && f.endsWith('.data')) files.push([`nchlt:${f}`, path.join(N, f), 'txt']);
  const counts = new Counts(); const reports = [];
  for (const [name, f, kind] of files) {
    const c = new Counts();
    const raw = fs.readFileSync(f, 'utf8');
    for (const line of raw.split('\n')) { const t = kind === 'tsv' ? line.slice(line.indexOf('\t') + 1) : line; if (t.trim()) c.addText(t, lang); }
    counts.merge(c);
    reports.push({ id: name, lang, local: true, tokens: c.tokens });
    log(`  ${name}: ${c.tokens} tokens`);
  }
  return { counts, reports };
}

// Photo check, part 1 (2026-09-24): is the rotation whole? Run on main, after `node scripts/build.mjs`.
//
//   node review/eval/photo-check/rotation-check.mjs
//
// What the app SERVES, not what sits in the folders: the app's own picker (assets/image-picker.js)
// with the slot manifest the build wrote into dist/assets/app.js, every display condition (the nine
// folders and their aliases) × week 1-4 × dawn/day/dusk/night × weekday 1-7. Then the lines: the
// app's own line gates (witty-day-tags.js eligibleWittyPool / contextTagAllows, hero-lines.js,
// hero-lines-af.js) for every photograph × place in every region box and none × month × language ×
// its slots' weekdays and hours × low confidence on and off. Writes data/rotation.json.
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

const OUT = 'review/eval/photo-check';
mkdirSync(`${OUT}/data`, { recursive: true });
const fresh = (p) => import(`${pathToFileURL(path.resolve(p)).href}?t=${Date.now()}`);

// ---------- the picker, with the build's manifest ----------
const bundle = readFileSync('dist/assets/app.js', 'utf8');
const mm = bundle.match(/\{hashes:(\[[^\]]*\]),slots:(\[[^\]]*\])\}/);
if (!mm) throw new Error('slot manifest not found in dist/assets/app.js — build first');
const manifest = { hashes: JSON.parse(mm[1]), slots: JSON.parse(mm[2]) };
const pickerSrc = readFileSync('assets/image-picker.js', 'utf8').replace('/* __BG_IMAGE_SLOT_MANIFEST__ */ null', JSON.stringify(manifest));
const pickerFile = path.resolve(OUT, '.picker-built.mjs');
writeFileSync(pickerFile, pickerSrc);
const P = await import(`${pathToFileURL(pickerFile).href}?t=${Date.now()}`);
const V = await fresh('assets/weather-visuals.js');
const T = await fresh('assets/witty-day-tags.js');
const W = (await fresh('assets/weather-copy.js')).WEATHER_COPY;
const HLm = await fresh('assets/hero-lines.js');
const AFm = await fresh('assets/hero-lines-af.js');
const CROP = (await fresh('assets/hero-crop.js')).HERO_CROP_OFFSETS;
const { REGION_BOXES } = await fresh('assets/geo-regions.js');
const { loadBench } = await fresh('scripts/image-slot-manifest.mjs');
const bench = loadBench();

const FOLDERS = P.BG_IMAGE_SLOT_FOLDERS;
const TIMES = P.BG_IMAGE_SLOT_TIMES;
const ALIASES = V.WEATHER_BACKGROUND_ALIASES;
const CONDITIONS = [...FOLDERS, ...Object.keys(ALIASES)];
const hashOf = (p) => (p.match(/bg-canonical\/([0-9a-f]{64})\.webp/) || [])[1] || null;
// Strand, the year's average sunrise/sunset (equinox, SAST): the app's solar windows
// (dawn = sunrise-45 min → +30, dusk = sunset-45 → +15) give these hours a day.
const SLOT_HOURS = { dawn: 1.25, day: 10.9, dusk: 1.0, night: 10.85 };

// ---------- 1. every slot serves a photograph whose file loads ----------
const served = [];                       // one row per condition × week × time × weekday
const files = new Map();                 // url path -> { ok, width, height, bytes }
const gaps = [];
for (const cond of CONDITIONS) {
  const folder = V.getWeatherBackgroundFolder(cond);
  const fallback = V.getWeatherBackgroundFallbackFolder(cond);
  for (let week = 1; week <= 4; week++) for (const time of TIMES) for (let r = 1; r <= 7; r++) {
    const chain = P.buildPickerPaths(folder, fallback, time, week, r);
    const primary = chain[0].split('?')[0];
    const hash = hashOf(primary);
    if (!hash) gaps.push({ cond, week, time, r, why: `primary is ${primary}, not a served photograph` });
    served.push({ cond, folder, week, time, r, slot: `${folder}/week_${week}/${time}/${r}.webp`, path: primary, hash, chain: chain.map((c) => c.split('?')[0]) });
    for (const c of chain) files.set(c.split('?')[0], null);
  }
}
for (const f of files.keys()) {
  const disk = path.join('dist', f);
  if (!existsSync(disk)) { files.set(f, { ok: false, why: 'missing in dist' }); continue; }
  try {
    const meta = await sharp(disk).metadata();
    files.set(f, { ok: meta.width > 0 && meta.height > 0, width: meta.width, height: meta.height, bytes: readFileSync(disk).length });
  } catch (e) { files.set(f, { ok: false, why: `does not decode: ${e.message}` }); }
}
// And over HTTP, the way the app asks for them.
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let buf; try { buf = readFileSync(path.join('dist', p)); } catch { return res.writeHead(404).end(); }
  res.writeHead(200).end(buf);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const http404 = [];
for (const f of files.keys()) {
  const r = await fetch(base + f + (f.endsWith('.webp') ? `?v=${P.BG_IMAGE_URL_VERSION}` : ''));
  if (r.status !== 200) http404.push({ path: f, status: r.status });
}
server.close();
const deadFiles = [...files.entries()].filter(([, v]) => !v?.ok).map(([k, v]) => ({ path: k, ...v }));
const primarySizes = new Set(served.map((s) => { const v = files.get(s.path); return v ? `${v.width}x${v.height}` : '?'; }));

// ---------- 2. repeats inside a condition's week batch; one photograph in two conditions in one week ----------
const benchedSlot = (slot) => bench.bySlot?.get?.(slot) || null;
const repeats = [];
for (const folder of FOLDERS) for (let week = 1; week <= 4; week++) {
  const rows = served.filter((s) => s.cond === folder && s.week === week);
  const byHash = new Map();
  rows.forEach((s) => { if (!byHash.has(s.hash)) byHash.set(s.hash, []); byHash.get(s.hash).push(s); });
  for (const [hash, at] of byHash) {
    if (at.length < 2) continue;
    const times = [...new Set(at.map((s) => s.time))];
    const benchedHere = at.filter((s) => benchedSlot(s.slot)).map((s) => s.slot);
    const known = folder === 'cloudy' && times.length === 1 && times[0] === 'night';
    repeats.push({
      folder, week, hash, n: at.length, slots: at.map((s) => `${s.time}/${s.r}`),
      cause: known ? 'known: cloudy nights have 4 photos for 7 nights'
        : benchedHere.length ? `benched slot${benchedHere.length > 1 ? 's' : ''} ${benchedHere.join(', ')} serve${benchedHere.length > 1 ? '' : 's'} the build's stand-in (${benchedSlot(benchedHere[0]).fallback || 'week_1 slot 1'})`
          : 'the same file sits in two slots of this week',
      known,
    });
  }
}
const twoConditions = [];
for (let week = 1; week <= 4; week++) {
  const byHash = new Map();
  served.filter((s) => FOLDERS.includes(s.cond) && s.week === week).forEach((s) => {
    if (!byHash.has(s.hash)) byHash.set(s.hash, new Set());
    byHash.get(s.hash).add(s.folder);
  });
  for (const [hash, set] of byHash) if (set.size > 1) {
    twoConditions.push({ week, hash, folders: [...set], slots: served.filter((s) => s.week === week && s.hash === hash && FOLDERS.includes(s.cond)).map((s) => s.slot) });
  }
}

// ---------- the photographs, as served ----------
const photos = new Map();   // hash -> { hash, slots: [...], folders, hoursPerWeek, anchor }
for (const s of served.filter((x) => FOLDERS.includes(x.cond))) {
  if (!photos.has(s.hash)) photos.set(s.hash, { hash: s.hash, slots: [], folders: new Set(), hoursPerWeek: 0, anchor: CROP[`bg-canonical/${s.hash}.webp`] ?? null });
  const p = photos.get(s.hash);
  p.slots.push(s.slot);
  p.folders.add(s.folder);
  p.hoursPerWeek += SLOT_HOURS[s.time] / 4;         // one weekday a week, in one week of four
}

// ---------- 3. lines ----------
const heroKey = (hash) => `bg-canonical/${hash}.webp`;
const enLines = (hash) => HLm.heroLinesForKey(heroKey(hash)) || [];
const TAGS = HLm.HERO_LINE_TAGS || {};
const afOf = (en) => AFm.heroLineAf(en);
const noOwn = [];            // no line of its own in English
const noOwnAf = [];          // no Afrikaans for any of its own lines
for (const p of photos.values()) {
  const en = enLines(p.hash);
  if (!en.length) noOwn.push(p.hash);
  if (en.length && !en.some((l) => afOf(l))) noOwnAf.push(p.hash);
}
// A place inside every region box, and one inside none.
const PLACES = Object.fromEntries(Object.entries(REGION_BOXES).map(([k, b]) => [k, [(b.minLat + b.maxLat) / 2, (b.minLon + b.maxLon) / 2]]));
PLACES['no region (Kimberley)'] = [-28.7282, 24.7499];
for (const [k, [lat, lon]] of Object.entries(PLACES)) PLACES[k].regions = Object.entries(REGION_BOXES).filter(([, b]) => lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon).map(([r]) => r);
const HOURS = { dawn: [5, 6, 7], day: [8, 11, 12, 16], dusk: [17, 19], night: [20, 21, 23, 2, 4] };
const LANGS = ['en', 'af', 'zu', 'xh', 'st'];
// English, anywhere it should not be: every English line the app holds.
const ENGLISH = new Set();
const walk = (n) => { if (typeof n === 'string') ENGLISH.add(n.trim()); else if (Array.isArray(n)) n.forEach(walk); else if (n && typeof n === 'object') Object.values(n).forEach(walk); };
for (const ns of ['witty', 'witty_low_confidence']) for (const bin of Object.values(W[ns] || {})) walk(bin?.en);
for (const lines of Object.values(HLm.HERO_LINES)) walk(lines);
ENGLISH.delete('');
const KNOWN_ENGLISH = new Set(['Close it, tie it down, surrender.', "Let's call it atmosphere and go inside."]);

const blanks = [];
const english = new Map();   // `${lang}|${line}` -> contexts count
const bankOnlyContexts = new Map();  // hash -> Set of `${place} month ${m}` where no own line is in season (en)
let contexts = 0;
const bankCache = new Map();
const bankPool = (cond, time, hour, jsDay, lat, lon, month, lang, lowConfidence) => {
  const key = [cond, time, hour, jsDay, lat, lon, month, lang, lowConfidence].join('|');
  if (bankCache.has(key)) return bankCache.get(key);
  const copyCondition = T.resolveNightAwareCopyCondition({ displayCondition: cond, timeOfDay: time, hour });
  const res = T.eligibleWittyPool({ copy: W, tags: T.WITTY_DAY_TAGS, condition: copyCondition, lang, context: { day: jsDay, hour, lat, lon, month }, lowConfidence });
  const fellBackToEnglish = lang !== 'en' && !(W[res.namespace]?.[res.bin]?.[lang]);
  const out = { pool: res.pool, bin: `${res.namespace}.${res.bin}`, fellBackToEnglish };
  bankCache.set(key, out);
  return out;
};
for (const p of photos.values()) {
  const own = enLines(p.hash);
  for (const slot of p.slots) {
    const [folder, , time, file] = slot.split('/');
    const jsDay = Number(file.replace('.webp', '')) % 7;          // Mon=1..Sun=7 -> Sun=0
    const conds = CONDITIONS.filter((c) => V.getWeatherBackgroundFolder(c) === folder);
    for (const [place, ll] of Object.entries(PLACES)) for (let month = 1; month <= 12; month++) {
      const [lat, lon] = ll;
      const ownInSeason = own.filter((l) => T.contextTagAllows(TAGS[l], { lat, lon, month }));
      if (own.length && !ownInSeason.length) {
        if (!bankOnlyContexts.has(p.hash)) bankOnlyContexts.set(p.hash, new Set());
        bankOnlyContexts.get(p.hash).add(`${place}, month ${month}`);
      }
      for (const lang of LANGS) {
        const ownHere = lang === 'en' ? ownInSeason : lang === 'af' ? ownInSeason.map(afOf).filter(Boolean) : [];
        for (const cond of conds) for (const hour of HOURS[time]) for (const lowConfidence of [false, true]) {
          contexts++;
          let pool = ownHere;
          let source = 'own';
          let fell = false;
          if (!pool.length) {
            const b = bankPool(cond, time, hour, jsDay, lat, lon, month, lang, lowConfidence);
            pool = b.pool; source = b.bin; fell = b.fellBackToEnglish;
          }
          if (!pool.length) blanks.push({ slot, place, month, lang, cond, hour, lowConfidence });
          if (lang !== 'en') {
            for (const line of pool) {
              if (fell || ENGLISH.has(line.trim())) {
                const k = `${lang}|${line}|${source}${fell ? ' (no ' + lang + ' list: English fallback)' : ''}`;
                english.set(k, (english.get(k) || 0) + 1);
              }
            }
          }
        }
      }
    }
  }
}

// ---------- 4. lines against the folder their photograph sits in ----------
// A keyword read of each photograph's own lines against its folder. It flags; the verdict is by eye
// (data/rotation.json keeps every flag with the words that tripped it).
const CUES = {
  rain: /\b(rain|raining|rained|drizzle|downpour|shower|showers|umbrella|puddles?|wet|soaked|drenched)\b/i,
  storm: /\b(thunder|lightning|storm|stormy|hail)\b/i,
  sun: /\b(sunny|sunshine|blue sky|cloudless|not a cloud|clear sky|clear skies|sunscreen|sunnies)\b/i,
  heat: /\b(hot|heat|scorch\w*|swelter\w*|boiling|baking|roasting)\b/i,
  cold: /\b(cold|chilly|freezing|frost\w*|icy|ice|snow|beanie|jersey|heater|shiver\w*)\b/i,
  fog: /\b(fog|foggy|mist|misty|visibility)\b/i,
  wind: /\b(wind|windy|gusts?|gale|blow\w*|south-easter|cape doctor)\b/i,
  still: /\b(still|no wind|not a breath|windless|calm)\b/i,
  dry: /\b(dry|no rain|bone-dry)\b/i,
  cloud: /\b(cloud|clouds|cloudy|overcast|grey|gray)\b/i,
};
const CONTRADICTS = {
  clear: ['rain', 'storm', 'fog', 'cloud'],
  'cold-clear': ['rain', 'storm', 'fog', 'heat', 'cloud'],
  cloudy: ['storm', 'sun'],
  rain: ['sun', 'dry', 'heat'],
  storm: ['sun', 'dry'],
  fog: ['sun', 'storm'],
  heat: ['cold', 'rain', 'storm', 'fog'],
  cold: ['heat'],
  wind: ['still'],
};
const misfits = [];
for (const p of photos.values()) for (const folder of p.folders) for (const line of enLines(p.hash)) {
  const hits = (CONTRADICTS[folder] || []).filter((k) => CUES[k].test(line));
  if (hits.length) misfits.push({ hash: p.hash, folder, line, cues: hits, words: hits.map((k) => line.match(CUES[k])?.[0]) });
}

// ---------- the recent cuts and moves: nothing orphaned ----------
const liveText = ['assets/weather-copy.js', 'assets/hero-lines.js', 'assets/hero-lines-af.js', 'api/og.js', 'middleware.js']
  .filter(existsSync).map((f) => readFileSync(f, 'utf8')).join('\n');
const jsonStr = (s) => JSON.stringify(s).slice(1, -1);       // how the generated files spell it
const stillLive = (s) => liveText.includes(jsonStr(s)) || liveText.includes(s);
const cross = {};
// the provenance cull: the lines 8ee1cc7 took out of the table
{
  const { execFileSync } = await import('node:child_process');
  // Photograph-line pairs, content-addressed keys only: 8ee1cc7 took 417 out.
  const grab = (rev) => {
    const src = execFileSync('git', ['show', `${rev}:assets/hero-lines.js`], { encoding: 'utf8', maxBuffer: 64 << 20 });
    const end = src.indexOf('export const HERO_LINE_TAGS');
    const body = src.slice(src.indexOf('HERO_LINES = Object.freeze(') + 27, end > 0 ? end : undefined);
    const pairs = [];
    for (const m of body.matchAll(/"(bg-canonical\/[0-9a-f]{64}\.webp)": (\[.*?\]),?\n/g)) for (const l of JSON.parse(m[2])) pairs.push(`${m[1]}|${l}`);
    return pairs;
  };
  const before = grab('8ee1cc7^');
  const after = new Set(grab('8ee1cc7'));
  const cut = before.filter((p) => !after.has(p));
  const back = cut.filter((p) => { const [k, l] = p.split('|'); return (HLm.HERO_LINES[k] || []).includes(l); });
  cross.provenanceCull = { cut: cut.length, photographs: new Set(cut.map((p) => p.split('|')[0])).size, backInTheTable: back };
}
// the translation check's CUTs (the 26 from the Afrikaans page and the rest of that page)
{
  const r = JSON.parse(readFileSync('review/translation-check-ruled.json', 'utf8')).rulings.filter((x) => x.verdict === 'CUT');
  cross.translationCuts = { cut: r.length, stillLive: r.filter((x) => stillLive(x.en)).map((x) => x.en) };
}
// the season CUTs
{
  const r = JSON.parse(readFileSync('review/seasonal-ruled.json', 'utf8')).rulings;
  const cut = r.filter((x) => x.verdict === 'CUT');
  const kept = r.filter((x) => x.verdict !== 'CUT');
  cross.seasonCuts = { cut: cut.length, stillLive: cut.filter((x) => stillLive(x.en)).map((x) => x.en), kept: kept.map((x) => ({ en: x.en, live: stillLive(x.en), months: x.months })) };
}
// the place lines
{
  const r = JSON.parse(readFileSync('review/place-lines-ruled.json', 'utf8')).rulings;
  const seasonCut = new Set(JSON.parse(readFileSync('review/seasonal-ruled.json', 'utf8')).rulings.filter((x) => x.verdict === 'CUT').map((x) => x.en));
  const bankTags = [];
  for (const [bin, tags] of Object.entries(T.WITTY_DAY_TAGS.witty || {})) for (const [i, tag] of Object.entries(tags)) if (tag?.region) bankTags.push({ en: W.witty?.[bin]?.en?.[i], region: tag.region });
  const tagOf = (en) => TAGS[en]?.region || bankTags.find((b) => b.en === en)?.region || null;
  const rows = r.map((x) => ({ en: x.en, verdict: x.verdict, ruledRegion: x.region, live: stillLive(x.en), seasonCut: seasonCut.has(x.en), tagNow: tagOf(x.en) }));
  cross.placeLines = {
    tagged: rows.filter((x) => x.verdict === 'TAG').length,
    taggedLive: rows.filter((x) => x.verdict === 'TAG' && x.live).length,
    taggedGoneBySeasonCut: rows.filter((x) => x.verdict === 'TAG' && !x.live && x.seasonCut).length,
    taggedMissing: rows.filter((x) => x.verdict === 'TAG' && !x.live && !x.seasonCut).map((x) => x.en),
    taggedWithoutTag: rows.filter((x) => x.verdict === 'TAG' && x.live && !x.tagNow).map((x) => x.en),
    cutStillLive: rows.filter((x) => x.verdict === 'CUT' && x.live).map((x) => x.en),
    verdicts: [...new Set(rows.map((x) => x.verdict))],
  };
}
// the moved photographs
{
  const r = JSON.parse(readFileSync('review/bucket-check-ruled.json', 'utf8')).rows.filter((x) => x.verdict && /MOVE/i.test(x.verdict));
  const dog = JSON.parse(readFileSync('review/cold-move-ruled.json', 'utf8'));
  const moves = [...r.map((x) => ({ sha256: x.sha256, from: x.bucket, to: x.moveTo, verdict: x.verdict })),
    { sha256: dog.photo.sha256, from: 'cloudy', to: 'cold', verdict: dog.verdict }];
  cross.moves = moves.map((m) => {
    const hash = photos.has(m.sha256) ? m.sha256 : [...photos.keys()].find((h) => h.startsWith(m.sha256));
    const p = hash ? photos.get(hash) : null;
    return { ...m, servedIn: p ? [...p.folders] : [], slots: p ? p.slots : [], stillInOldFolder: p ? p.folders.has(m.from) : null, inNewFolder: p ? p.folders.has(m.to) : false, ownLines: hash ? enLines(hash).length : 0 };
  });
}
// Eskom
{
  const r = JSON.parse(readFileSync('review/eskom-ruled.json', 'utf8')).rulings;
  const seasonCut = new Set(JSON.parse(readFileSync('review/seasonal-ruled.json', 'utf8')).rulings.filter((x) => x.verdict === 'CUT').map((x) => x.en));
  cross.eskom = r.map((x) => ({ en: x.en, verdict: x.verdict, live: stillLive(x.en), seasonCut: seasonCut.has(x.en) }));
}

const out = {
  generatedOn: new Date().toISOString(), branch: 'main', build: 'dist/ (node scripts/build.mjs)',
  manifest: { slots: manifest.slots.length, photographs: manifest.hashes.length },
  served: { rows: served.length, conditions: CONDITIONS.length, files: files.size, sizes: [...primarySizes], gaps, deadFiles, http404 },
  photos: [...photos.values()].map((p) => ({ ...p, folders: [...p.folders], hoursPerWeek: Math.round(p.hoursPerWeek * 100) / 100, ownEn: enLines(p.hash).length, ownAf: enLines(p.hash).filter(afOf).length })),
  repeats, twoConditions,
  lines: { noOwn, noOwnAf, bankOnlyContexts: [...bankOnlyContexts.entries()].map(([hash, set]) => ({ hash, contexts: set.size, examples: [...set].slice(0, 6) })), contexts, blanks: blanks.slice(0, 50), blankCount: blanks.length, english: [...english.entries()].map(([k, n]) => { const [lang, line, source] = k.split('|'); return { lang, line, source, contexts: n, known: KNOWN_ENGLISH.has(line) }; }) },
  misfits,
  cross,
  servedTable: served.map(({ cond, week, time, r, slot, hash }) => ({ cond, week, time, r, slot, hash })),
};
writeFileSync(`${OUT}/data/rotation.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify({
  slots: out.manifest, served: { rows: served.length, files: files.size, sizes: out.served.sizes, gaps: gaps.length, deadFiles: deadFiles.length, http404: http404.length },
  repeats: repeats.length, repeatsKnown: repeats.filter((x) => x.known).length, twoConditions: twoConditions.length,
  photos: photos.size, noOwn: noOwn.length, noOwnAf: noOwnAf.length, bankOnlyContexts: bankOnlyContexts.size,
  contexts, blanks: blanks.length, englishLines: out.lines.english.length, englishKnown: out.lines.english.filter((x) => x.known).length,
  misfits: misfits.length,
  cross: { provenanceCull: { cut: cross.provenanceCull.cut, back: cross.provenanceCull.backInTheTable.length }, translationCuts: { cut: cross.translationCuts.cut, stillLive: cross.translationCuts.stillLive.length }, seasonCuts: { cut: cross.seasonCuts.cut, stillLive: cross.seasonCuts.stillLive.length }, placeLines: cross.placeLines, moves: cross.moves.length, eskom: cross.eskom },
}, null, 1));

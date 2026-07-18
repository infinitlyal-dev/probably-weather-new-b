// Reroll-wave-1 Leonardo driver (Phase 2, autonomous-overnight).
// Drives the ALREADY-OPEN, authenticated playwright-cli browser session on
// app.leonardo.ai/generate (GPT-Image-2, Cinematic, 1136x2048, qty 2, Prompt Enhance OFF).
// Per prompt: clear+type -> Generate -> 3-check wait (new-gen-UUID delta + >=30s min-wait
// + md5 uniqueness) -> download both candidates -> screenshot -> log.
// Idempotent: skips a slot whose _A.jpg AND _B.jpg already exist. Halts on 3 consecutive fails.
// Usage: node run-reroll-leonardo.mjs --from 0 --to 1   (canary)
//        node run-reroll-leonardo.mjs --from 1 --to 36  (rest)

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import crypto from 'node:crypto';

const HOME = process.env.USERPROFILE || process.env.HOME;
const PWCLI = 'C:/Users/27741/AppData/Roaming/npm/node_modules/@playwright/cli/playwright-cli.js';
const REPO = 'C:/Users/27741/OneDrive/Desktop/Probably weather new/probably-weather-new-c';
const SDIR = HOME.replace(/\\/g, '/') + '/.claude/skills/minnie/session-outputs/2026-07-18-pw-reroll-leonardo';
const DELIV = SDIR + '/deliverables';
const SHOTS = SDIR + '/screenshots';
const DECLOG = SDIR + '/decision-log.jsonl';
const ERRLOG = SDIR + '/error-log.jsonl';
const SUMMARY = SDIR + '/run-summary.json';

const a = process.argv.slice(2);
const argv = (n, d) => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : d; };
const FROM = parseInt(argv('--from', '0'), 10);
const TO = parseInt(argv('--to', '36'), 10);

const MIN_WAIT_MS = 32000;
const POLL_MS = 12000;
const MAX_WAIT_MS = 320000;
const MAX_RETRIES = 2;
const DL_WIDTH = 1875;

if (!fs.existsSync(PWCLI)) { console.error('FATAL: playwright-cli.js missing: ' + PWCLI); process.exit(2); }
fs.mkdirSync(DELIV, { recursive: true });
fs.mkdirSync(SHOTS, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const ts = () => new Date().toISOString();
const logLine = (f, o) => fs.appendFileSync(f, JSON.stringify(o) + '\n');

function pw(args, timeout = 130000) {
  try {
    return execFileSync(process.execPath, [PWCLI, ...args], { encoding: 'utf8', timeout, maxBuffer: 1 << 25 });
  } catch (e) {
    return (e.stdout || '') + '\n__PWERR__ ' + (e.message || '');
  }
}
function pwEval(expr, timeout = 60000) {
  const out = pw(['eval', expr], timeout);
  const i = out.indexOf('### Result');
  if (i < 0) return { __err: 'no-result', __raw: out.slice(0, 200) };
  const lines = out.slice(i + 10).split('\n').map(s => s.trim()).filter(Boolean);
  const line = lines.find(s => !s.startsWith('###')) || '';
  for (const fn of [() => JSON.parse(JSON.parse(line)), () => JSON.parse(line)]) {
    try { return fn(); } catch (e) { /* next */ }
  }
  return { __err: 'parse', __raw: line.slice(0, 200) };
}

const E_IMAGES = `(function(){var out=[];var s=document.querySelectorAll('img');for(var i=0;i<s.length;i++){var u=s[i].src||'';var k=u.indexOf('/generations/');if(k>=0){var rest=u.slice(k+13);var parts=rest.split('/');var gen=parts[0]||'';var file=(parts[1]||'').split('?')[0];if(gen&&file){out.push({gen:gen,file:file,url:u})}}}return JSON.stringify(out)})()`;
const E_TALEN = `(function(){var t=document.querySelectorAll('textarea')[0];return JSON.stringify({len:t?t.value.length:-1,head:t?t.value.slice(0,45):''})})()`;
const E_FOCUS = `(function(){var t=document.querySelectorAll('textarea')[0];if(!t)return JSON.stringify({ok:false});t.focus();return JSON.stringify({ok:true,len:t.value.length})})()`;
const E_GEN = `(function(){var b=Array.from(document.querySelectorAll('button')).find(function(x){return /generate/i.test(x.textContent)});if(!b)return JSON.stringify({ok:false});var d=!!b.disabled;if(!d)b.click();return JSON.stringify({ok:true,disabled:d,text:b.textContent.trim().slice(0,20)})})()`;
const E_FILTER = `(function(){var t=(document.body.innerText||'').toLowerCase();var ph=['this image has been flagged','violates our content policy','your prompt has been flagged'];return JSON.stringify({flagged:ph.filter(function(p){return t.indexOf(p)>=0})})})()`;

function slugFrag(p) {
  return p.replace(/[^A-Za-z0-9\s]/g, ' ').trim().split(/\s+/).slice(0, 6).join('_');
}
async function download(url, dest) {
  const full = url.split('?')[0] + '?w=' + DL_WIDTH;
  try {
    const r = await fetch(full);
    if (!r.ok) return { ok: false, err: 'http' + r.status };
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 8000) return { ok: false, err: 'small' + buf.length };
    fs.writeFileSync(dest, buf);
    return { ok: true, size: buf.length, md5: crypto.createHash('md5').update(buf).digest('hex'), url: full };
  } catch (e) { return { ok: false, err: 'fetch:' + e.message }; }
}
async function typePrompt(p) {
  pwEval(E_FOCUS);
  pw(['press', 'Control+a']);
  pw(['press', 'Delete']);
  pw(['type', p], 130000);
  await sleep(700);
  return pwEval(E_TALEN);
}

const prompts = JSON.parse(fs.readFileSync(REPO + '/review/reroll-prompts.json', 'utf8')).prompts;
const md5set = new Set();
for (const f of fs.existsSync(DELIV) ? fs.readdirSync(DELIV) : []) {
  if (f.endsWith('.jpg')) { try { md5set.add(crypto.createHash('md5').update(fs.readFileSync(DELIV + '/' + f)).digest('hex')); } catch (e) {} }
}
let shotN = fs.existsSync(SHOTS) ? fs.readdirSync(SHOTS).filter(f => /^\d/.test(f)).length : 0;

const results = [];
let consecFail = 0;

for (let i = FROM; i < TO && i < prompts.length; i++) {
  const p = prompts[i];
  const id = p.id;
  const aPath = DELIV + '/' + id + '_A.jpg', bPath = DELIV + '/' + id + '_B.jpg';
  if (fs.existsSync(aPath) && fs.existsSync(bPath)) {
    console.log(`[${i}] ${id} exists -> skip`);
    results.push({ id, status: 'skip-exists' });
    continue;
  }
  console.log(`[${i}] ${id} (${p.condition}/${p.bin}) generating...`);
  let ok = false, attempt = 0, lastErr = '';
  while (attempt <= MAX_RETRIES && !ok) {
    attempt++;
    try {
      const before = pwEval(E_IMAGES);
      const beforeGens = new Set(Array.isArray(before) ? before.map(x => x.gen) : []);
      const ta = await typePrompt(p.new_prompt);
      const want = p.new_prompt.length;
      if (!ta || Math.abs((ta.len || 0) - want) > 40) { lastErr = 'type-mismatch got=' + (ta && ta.len) + ' want=' + want; logLine(ERRLOG, { ts: ts(), id, attempt, err: lastErr }); continue; }
      const g = pwEval(E_GEN);
      if (!g || !g.ok || g.disabled) { lastErr = 'gen-btn ' + JSON.stringify(g); logLine(ERRLOG, { ts: ts(), id, attempt, err: lastErr }); await sleep(3000); continue; }
      await sleep(MIN_WAIT_MS);
      const frag = slugFrag(p.new_prompt).slice(0, 14).toLowerCase();
      let found = null, waited = MIN_WAIT_MS;
      while (waited < MAX_WAIT_MS) {
        const now = pwEval(E_IMAGES);
        if (Array.isArray(now)) {
          const byGen = {};
          for (const im of now) if (!beforeGens.has(im.gen)) (byGen[im.gen] = byGen[im.gen] || []).push(im);
          // Leonardo renders each candidate in multiple DOM nodes; keep only DISTINCT files,
          // sorted so imgs[0]=...-0 (A) and imgs[1]=...-1 (B). Require 2 distinct files present.
          for (const g0 in byGen) {
            const seen = {}, uniq = [];
            for (const im of byGen[g0]) { if (!seen[im.file]) { seen[im.file] = 1; uniq.push(im); } }
            uniq.sort((x, y) => x.file < y.file ? -1 : 1);
            byGen[g0] = uniq;
          }
          const cand = Object.entries(byGen).filter(([g0, arr]) => arr.length >= 2);
          if (cand.length === 1) found = { gen: cand[0][0], imgs: cand[0][1].slice(0, 2) };
          else if (cand.length > 1) { const m = cand.find(([g0, arr]) => arr.some(x => x.file.toLowerCase().indexOf(frag) >= 0)); if (m) found = { gen: m[0], imgs: m[1].slice(0, 2) }; }
        }
        if (found) break;
        const filt = pwEval(E_FILTER);
        if (filt && filt.flagged && filt.flagged.length) { lastErr = 'content-filter:' + filt.flagged.join('|'); logLine(ERRLOG, { ts: ts(), id, attempt, err: lastErr }); break; }
        await sleep(POLL_MS); waited += POLL_MS;
      }
      if (!found) { if (!lastErr) lastErr = 'timeout-no-new-images'; logLine(ERRLOG, { ts: ts(), id, attempt, err: lastErr }); continue; }
      const dA = await download(found.imgs[0].url, aPath);
      const dB = await download(found.imgs[1].url, bPath);
      if (!dA.ok || !dB.ok) { lastErr = 'dl A=' + JSON.stringify(dA) + ' B=' + JSON.stringify(dB); logLine(ERRLOG, { ts: ts(), id, attempt, err: lastErr }); continue; }
      if (md5set.has(dA.md5) || md5set.has(dB.md5) || dA.md5 === dB.md5) {
        lastErr = 'stale-md5 A=' + dA.md5.slice(0, 8) + ' B=' + dB.md5.slice(0, 8);
        logLine(ERRLOG, { ts: ts(), id, attempt, err: lastErr });
        try { fs.unlinkSync(aPath); fs.unlinkSync(bPath); } catch (e) {}
        await sleep(9000); continue;
      }
      md5set.add(dA.md5); md5set.add(dB.md5);
      shotN++;
      const shot = SHOTS + '/' + String(shotN).padStart(3, '0') + '-' + id + '.png';
      pw(['screenshot', '--filename', shot]);
      logLine(DECLOG, { ts: ts(), id, condition: p.condition, bin: p.bin, gen: found.gen, attempt, prompt_len: want, files: [id + '_A.jpg', id + '_B.jpg'], sizes: [dA.size, dB.size], md5: [dA.md5, dB.md5], urls: [dA.url, dB.url] });
      results.push({ id, status: 'ok', gen: found.gen, sizes: [dA.size, dB.size] });
      ok = true; consecFail = 0;
      console.log(`[${i}] ${id} OK gen=${found.gen.slice(0, 8)} A=${dA.size}b B=${dB.size}b`);
    } catch (e) { lastErr = 'exception:' + e.message; logLine(ERRLOG, { ts: ts(), id, attempt, err: lastErr }); }
  }
  if (!ok) {
    results.push({ id, status: 'fail', err: lastErr });
    consecFail++;
    console.log(`[${i}] ${id} FAILED: ${lastErr}`);
    if (consecFail >= 3) { console.log('HALT: 3 consecutive failures'); logLine(ERRLOG, { ts: ts(), halt: '3-consec-fail', at: id }); break; }
  }
}
fs.writeFileSync(SUMMARY, JSON.stringify({ generated: ts(), from: FROM, to: TO, ok: results.filter(r => r.status === 'ok').length, results }, null, 2));
console.log('DONE range', FROM, '-', TO, '| ok=', results.filter(r => r.status === 'ok').length, '/', results.length);

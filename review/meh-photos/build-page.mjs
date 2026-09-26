// Al's page for the meh photos: every flagged live photo pre-marked REPLACE, most-shown first. He unticks any
// to keep and presses Export (meh-photos-ruled.json lands in Downloads). The pairs job reads that export and
// queues a new pair for every photo left on REPLACE (review/pairs-job/run.mjs, ingestMeh).
//
//   node review/meh-photos/build-page.mjs [--out <file>]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const OUT = arg('--out', 'C:\\Users\\27741\\OneDrive\\Desktop\\Probably weather new\\probably-weather-new-c\\review\\meh-photos-for-al.html');
const doc = JSON.parse(readFileSync(path.join(HERE, 'flags.json'), 'utf8'));
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const WEATHER = { clear: 'Clear', heat: 'Heat', cloudy: 'Cloudy', rain: 'Rain', storm: 'Storm', wind: 'Wind', cold: 'Cold and wet', 'cold-clear': 'Cold and clear', fog: 'Fog' };
const TIME = { dawn: 'dawn', day: 'day', dusk: 'evening', night: 'night' };

const cards = [];
for (const f of doc.flags) {
  const file = path.join(ROOT, 'assets', 'images', 'bg', f.slots[0]);
  const src = 'data:image/jpeg;base64,' + (await sharp(file).resize(440, 782, { fit: 'cover' }).jpeg({ quality: 72 }).toBuffer()).toString('base64');
  const spots = f.spotsAll || f.spots;
  const days = f.days.length === 7 ? 'every day' : f.days.join(', ');
  const tag = f.reasons.includes('bane') ? '<span class="tag">You named it</span>' : f.reasons.includes('almeh') ? '<span class="tag">Your MEH</span>' : '';
  cards.push(`<article class="card" data-id="${f.sha256}">
  <button class="ph" type="button" aria-label="Bigger"><img src="${src}" alt="${esc(f.note)}" loading="lazy"></button>
  <div class="body"><p class="chip">${esc(WEATHER[f.folder])} · ${esc(TIME[f.time])} · ${spots} spot${spots === 1 ? '' : 's'} · ${esc(days)} ${tag}</p>
  <p class="note">${esc(f.note)}</p>
  <p class="why">${f.reasons.filter((r) => r !== 'bane' && r !== 'almeh').map((r) => esc(doc.reasons[r])).join(' · ')}</p>
  ${f.clear ? '<p class="queued">Already queued: the job is making its replacement.</p>' : ''}
  <div class="act"><button type="button" data-v="REPLACE">Replace</button><button type="button" data-v="KEEP">Keep</button></div></div>
</article>`);
}
const spotsTotal = doc.flags.reduce((s, f) => s + (f.spotsAll || f.spots), 0);
const ITEMS = doc.flags.map((f) => ({ id: f.sha256, folder: f.folder, time: f.time, spots: f.spotsAll || f.spots, slots: [...f.slots, ...(f.benchedSlots || [])], note: f.note }));

const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Meh photos</title>
<style>
:root{--bg:#f6f4ee;--fg:#1d1b18;--muted:#6b665c;--line:#dcd7cb;--card:#fffdf8;--accent:#1f5f8b;--rep:#a5452b;--keep:#2e7d4f}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#15140f;--fg:#eeebe3;--muted:#a8a296;--line:#35322b;--card:#1f1d18;--accent:#7fb6dd;--rep:#e08a6e;--keep:#7ccf9c}}
:root[data-theme="dark"]{--bg:#15140f;--fg:#eeebe3;--muted:#a8a296;--line:#35322b;--card:#1f1d18;--accent:#7fb6dd;--rep:#e08a6e;--keep:#7ccf9c}
*{box-sizing:border-box}body{margin:0;padding:18px 16px 110px;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}
main{max-width:1180px;margin:0 auto}h1{font-size:1.6rem;margin:0 0 6px}.lead{max-width:62ch;margin:0 0 6px}.small{color:var(--muted);font-size:.9rem;max-width:70ch}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px;margin-top:18px}
.card{background:var(--card);border:2px solid var(--line);border-radius:12px;overflow:hidden;display:flex;flex-direction:column}
.card.rep{border-color:var(--rep)}.card.keep{border-color:var(--keep);opacity:.72}
.ph{all:unset;cursor:zoom-in;display:block}.ph img{display:block;width:100%;aspect-ratio:9/16;object-fit:cover}
.body{padding:10px 12px 12px;display:flex;flex-direction:column;gap:4px;flex:1}.chip{font-size:.74rem;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin:0}
.tag{display:inline-block;background:var(--rep);color:#fff;border-radius:4px;padding:0 5px;margin-left:2px;letter-spacing:0}
.note{margin:0;font-weight:600}.why{margin:0;color:var(--muted);font-size:.88rem}.queued{margin:0;font-size:.82rem;color:var(--accent)}
.act{display:flex;gap:6px;margin-top:auto;padding-top:6px}.act button{flex:1;font:inherit;min-height:44px;border-radius:8px;border:1px solid var(--line);background:transparent;color:inherit;cursor:pointer}
.card.rep .act [data-v="REPLACE"]{background:var(--rep);border-color:var(--rep);color:#fff}.card.keep .act [data-v="KEEP"]{background:var(--keep);border-color:var(--keep);color:#fff}
textarea{width:100%;min-height:60px;font:inherit;border:1px solid var(--line);border-radius:8px;padding:8px;background:transparent;color:inherit;margin-top:18px}
.bar{position:fixed;left:0;right:0;bottom:0;background:var(--card);border-top:1px solid var(--line);padding:10px 16px;display:flex;gap:8px;align-items:center}
.bar button{font:inherit;min-height:44px;padding:8px 18px;border-radius:8px;border:1px solid var(--accent);background:var(--accent);color:#fff;cursor:pointer}#count{margin-right:auto;color:var(--muted);font-size:.92rem}
#out{display:none;width:100%;min-height:100px}
dialog{border:0;padding:0;background:transparent;max-width:96vw}dialog::backdrop{background:rgba(0,0,0,.85)}dialog img{display:block;max-height:92vh;max-width:96vw;border-radius:8px}
</style></head><body><main>
<h1>Meh photos</h1>
<p class="lead">${doc.flags.length} of the 300 live photos, ${spotsTotal} spots between them, most-shown first. Every one is marked <b>Replace</b>. Tap <b>Keep</b> on any you want to keep, then Export.</p>
<p class="small">Each Replace gets a new line and a new photo made together, joke first, to your recipe (aspirational settings, weather at the folder's strength, clothes for the day, a real reaction). They come to you on the pairs page. The ones marked "already queued" are your named photos, your MEHs, the house-rule breaks and the clearest stock; the job started on those without waiting for this.</p>
<p class="small">How I picked: I looked at every photo myself. The blind rater's overall score barely matched your 40 grades (the photos you loved and the ones you called fine scored the same), so I did not use it. Its stock and posed marks did match you (5 flagged, none you loved), so those count as one more pair of eyes. Tap a photo to see it bigger.</p>
<section class="grid">${cards.join('\n')}</section>
<textarea data-note="other" placeholder="Anything else (optional)"></textarea><textarea id="out" readonly></textarea></main>
<div class="bar"><span id="count"></span><button id="export" type="button">Export</button></div>
<dialog id="big"><img alt=""></dialog>
<script>
var KEY='pw-meh-photos-1',ITEMS=${JSON.stringify(ITEMS)},s={};
try{s=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){}
function pick(id){return (s[id]&&s[id].pick)||'REPLACE'}
function save(){try{localStorage.setItem(KEY,JSON.stringify(s))}catch(e){}paint()}
function paint(){var k=0;document.querySelectorAll('.card').forEach(function(c){var v=pick(c.dataset.id);c.classList.toggle('rep',v==='REPLACE');c.classList.toggle('keep',v==='KEEP');if(v==='KEEP')k++});
document.getElementById('count').textContent=(ITEMS.length-k)+' to replace'+(k?', '+k+' kept':'');var t=document.querySelector('textarea[data-note="other"]');if(t&&document.activeElement!==t)t.value=(s.other||{}).note||''}
document.addEventListener('click',function(e){var b=e.target.closest('.act button');if(b){var id=b.closest('.card').dataset.id;s[id]={pick:b.dataset.v};save();return}
var ph=e.target.closest('.ph');if(ph){var d=document.getElementById('big');d.querySelector('img').src=ph.querySelector('img').src;d.showModal();return}
var dl=e.target.closest('dialog');if(dl)dl.close()});
document.addEventListener('input',function(e){if(e.target.matches('textarea[data-note]')){s.other={note:e.target.value};try{localStorage.setItem(KEY,JSON.stringify(s))}catch(x){}}});
document.getElementById('export').addEventListener('click',function(){var j=JSON.stringify({generated:new Date().toISOString(),ruledBy:'Al, meh photos (review/meh-photos-for-al.html)',note:'REPLACE = retire the photo and its lines; a new pair takes its spots. KEEP = it stays.',photos:ITEMS.map(function(i){return{sha256:i.id,folder:i.folder,time:i.time,spots:i.spots,slots:i.slots,note:i.note,pick:pick(i.id)}}),other:(s.other||{}).note||''},null,1);
var o=document.getElementById('out');o.style.display='block';o.value=j;try{var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([j],{type:'application/json'}));a.download='meh-photos-ruled.json';a.click()}catch(x){}});
paint();
</script></body></html>`;
writeFileSync(OUT, page);
console.log(`${OUT}: ${doc.flags.length} photos, ${spotsTotal} spots, ${(page.length / 1e6).toFixed(1)} MB`);

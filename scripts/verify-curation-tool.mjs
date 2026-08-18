// Does the curation tool actually work? Drives review/crop-anchor-tool.html the
// way Al opens it, and asserts the things that would silently be wrong: the
// photograph loading, the preview being the REAL composition, the ink toggle
// flipping the scrim with the ink, verdicts persisting, and both exports coming
// out with the right shape.
//
//   node scripts/verify-curation-tool.mjs                     (file://, a double-click)
//   node scripts/verify-curation-tool.mjs http://127.0.0.1:8788/review/crop-anchor-tool.html
//
// Check BOTH when the tool changes. localStorage is the one thing that differs
// between the two origins, and every curation verdict is autosaved there.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const FILE_URL = 'file:///' + path.join(root, 'review', 'crop-anchor-tool.html').split(path.sep).join('/');
const url = process.argv[2] || FILE_URL;
const fails = [];
const ok = [];
const check = (name, cond, detail) => (cond ? ok : fails).push(`${name}${detail ? ' — ' + detail : ''}`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', (e) => fails.push('PAGE ERROR: ' + e.message));
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(1200);
await page.waitForFunction(() => { const i = document.getElementById('img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 });

const first = await page.evaluate(() => {
  const cs = getComputedStyle(document.getElementById('capRef'));
  const hero = document.getElementById('heroRef');
  const hs = getComputedStyle(hero);
  return {
    items: DATA.items.length,
    imgNatural: document.getElementById('img').naturalWidth + 'x' + document.getElementById('img').naturalHeight,
    heroBox: hero.getBoundingClientRect().width + 'x' + hero.getBoundingClientRect().height,
    heroBg: hs.backgroundImage.slice(0, 22),
    heroPos: hs.backgroundPosition,
    capText: document.getElementById('capRef').textContent,
    capFont: cs.fontFamily,
    capSize: cs.fontSize,
    capColor: cs.color,
    capBg: cs.backgroundImage.slice(0, 60),
    capPad: cs.paddingTop,
    figRef: document.getElementById('figRef').textContent,
    figWorst: document.getElementById('figWorst').textContent,
    bandH: document.getElementById('band').getBoundingClientRect().height,
    refbandH: document.getElementById('refband').getBoundingClientRect().height,
    imgH: document.getElementById('img').getBoundingClientRect().height,
    srcA: document.getElementById('img').naturalWidth / document.getElementById('img').naturalHeight,
  };
});

check('294 images loaded', first.items === 294, first.items + ' items');
check('source photograph renders', /^\d+x\d+$/.test(first.imgNatural) && first.imgNatural !== '0x0', first.imgNatural);
check('preview is the measured card box', first.heroBox === '327x518', first.heroBox);
check('preview paints the photograph', first.heroBg.startsWith('url('), first.heroBg);
check('preview uses the ruled anchor', /^\s*50%|center/.test(first.heroPos) || first.heroPos.includes('%'), first.heroPos);
check('a real witty line is shown', first.capText.length > 10, JSON.stringify(first.capText.slice(0, 46)));
check('caption is in Caveat', first.capFont.includes('Caveat Prototype'), first.capFont.split(',')[0]);
check('caption is at the shipped size', first.capSize === '33px', first.capSize);
check('caption runway matches app.css', Math.abs(parseFloat(first.capPad) - 56.8) < 0.5, first.capPad);
check('white ink by default', first.capColor === 'rgb(255, 255, 255)', first.capColor);
check('white scrim is the dark gradient', first.capBg.includes('rgba(0, 0, 0, 0.8)'), first.capBg);
check('worst-phone band matches this frame', Math.abs(first.bandH / first.imgH - Math.min(1,(248/272)*first.srcA)) < 0.01, (first.bandH / first.imgH).toFixed(3));
check('reference band matches this frame', Math.abs(first.refbandH / first.imgH - Math.min(1,(518/327)*first.srcA)) < 0.01, (first.refbandH / first.imgH).toFixed(3));
check('captions name the real devices', first.figRef.includes('327×518') && first.figWorst.includes('272×248'), first.figRef);

// ---- the ink toggle must flip the SCRIM with the ink, or dark-on-dark ------
await page.keyboard.press('d');
await page.waitForTimeout(200);
const dark = await page.evaluate(() => {
  const cs = getComputedStyle(document.getElementById('capRef'));
  return { color: cs.color, bg: cs.backgroundImage.slice(0, 70), tag: document.getElementById('tag').textContent };
});
check('dark ink applies', dark.color === 'rgb(23, 19, 13)', dark.color);
check('scrim flips to cream with it', dark.bg.includes('rgba(246, 242, 232'), dark.bg);
check('ink is recorded on the image', dark.tag.includes('dark'), dark.tag);

// ---- verdicts persist and advance ------------------------------------------
const before = await page.evaluate(() => document.getElementById('pos').textContent);
await page.keyboard.press('k');
await page.waitForTimeout(250);
const after = await page.evaluate(() => ({
  pos: document.getElementById('pos').textContent,
  tally: document.getElementById('tally').textContent,
  stored: JSON.parse(localStorage.getItem('pw_curation_v2') || '{}'),
}));
check('KEEP advances to the next image', before !== after.pos, before + ' -> ' + after.pos);
check('tally counts the keep', after.tally.includes('1 keep'), after.tally.trim());
const rec = Object.values(after.stored)[0] || {};
check('verdict autosaves with anchor + ink', rec.verdict === 'KEEP' && typeof rec.anchorY === 'number' && rec.ink === 'dark', JSON.stringify(rec));

// ---- cut a second image, then export ---------------------------------------
await page.keyboard.press('c');
await page.waitForTimeout(250);
const exported = await page.evaluate(() => {
  const files = {};
  const realCreate = URL.createObjectURL;
  const blobs = [];
  URL.createObjectURL = (b) => { blobs.push(b); return 'blob:stub'; };
  const realClick = HTMLAnchorElement.prototype.click;
  const names = [];
  HTMLAnchorElement.prototype.click = function () { names.push(this.download); };
  document.getElementById('export').click();
  URL.createObjectURL = realCreate;
  HTMLAnchorElement.prototype.click = realClick;
  return Promise.all(blobs.map((b) => b.text())).then((texts) => {
    texts.forEach((t, n) => { files[names[n]] = JSON.parse(t); });
    return files;
  });
});
const anchors = exported['set-001-crop-anchors.json'];
check('exports the anchors file', !!anchors, Object.keys(exported).join(', '));
if (anchors) {
  const one = Object.values(anchors.anchors)[0] || {};
  check('anchors carry verdict + anchorY + ink', one.verdict === 'FIXABLE' && typeof one.anchorY === 'number' && !!one.ink, JSON.stringify(one));
  check('kept count is recorded', anchors.kept === 1, String(anchors.kept));
  check('cut image is NOT in the anchors', Object.keys(anchors.anchors).length === 1, Object.keys(anchors.anchors).length + ' entries');
}

// A look at the instrument, for the same reason the tool previews the real
// composition: a passing assertion is not a picture of a usable screen.
await page.screenshot({ path: path.join(root, 'output', 'curation-tool.png') });

await browser.close();
console.log('PASS:');
for (const o of ok) console.log('  ✓ ' + o);
if (fails.length) {
  console.log('\nFAIL:');
  for (const f of fails) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log(`\n[curation tool] ${ok.length} checks pass.`);

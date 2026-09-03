import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// M1 of the mobile facelift: the contained hero card. These are static guards
// on the two things the milestone must not lose — the hero unit's structure,
// and the promise that the >=769px frame and the >=1024px desktop postcard are
// untouched by any of it.
const css = readFileSync(new URL('../assets/app.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const js = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');

const faceliftBlock = () => {
  const start = css.indexOf('MOBILE FACELIFT — CONTAINED HERO HOME');
  expect(start, 'facelift block missing from app.css').toBeGreaterThan(-1);
  return css.slice(start);
};

// The home meme block (Al's ruling 2026-08-14) is appended after the facelift
// blocks, in the same append-only style, so it is INSIDE faceliftBlock()'s
// slice — which is how the two-radius and no-1024px guards reach it for free.
// Sliced separately where a rule has to be attributed to the meme and not to
// the M1/M9 rule of the same name that it overrides.
const memeBlock = () => {
  const start = css.indexOf('THE HOME MEME — THE JOKE GETS ON THE PHOTOGRAPH');
  expect(start, 'home meme block missing from app.css').toBeGreaterThan(-1);
  return css.slice(start);
};

describe('mobile facelift — contained hero (M1)', () => {
  // RETITLED 2026-08-17. M1 put the line on a solid cream foot UNDER the photo
  // and this test guarded that. Al's ruling of 2026-08-14 retires the foot: the
  // line goes ON the photograph (the home meme), because a caption under a
  // picture is a footnote however good it is. What the test guards is unchanged
  // and now matters more, not less — the node must NOT move.
  it('puts the witty line on the photograph without moving it out of #home-screen', () => {
    // #headline must stay INSIDE #home-screen. Nesting it in .hero-card blanked
    // the desktop postcard's handwritten caption, because display:none on the
    // card at >=769px takes the whole subtree with it. This is the regression
    // guard for that: the card contains the photo and nothing else.
    expect(html).toMatch(/<section id="heroCard" class="hero-card">\s*<div id="heroPhoto" class="hero-photo">[\s\S]*?<\/div>\s*<\/section>/);
    expect(html).toMatch(/<main id="home-screen"[\s\S]*?<p id="headline" class="headline hero-caption">/);
    // It reaches the photograph by POSITION, not by parentage: main is already
    // position:relative and the card is its preceding sibling, so bottom:100%
    // lands the line's bottom edge on the photo's bottom edge.
    const meme = memeBlock();
    expect(meme).toMatch(/main#home-screen\.main > \.hero-caption\s*{[^}]*position:\s*absolute/s);
    expect(meme).toMatch(/main#home-screen\.main > \.hero-caption\s*{[^}]*bottom:\s*100%/s);
    // On a scrim, in one white ink (Al: "i dont care if we only have one colour
    // writing on the image, as long as it pops"), with the handwriting restated
    // — moving the paint target drops every rule scoped to the old cream foot,
    // and the first mockup render came out in the system sans for that reason.
    expect(meme).toMatch(/main#home-screen\.main > \.hero-caption\s*{[^}]*background:\s*linear-gradient\(/s);
    expect(meme).toMatch(/main#home-screen\.main > \.hero-caption\s*{[^}]*font-family:\s*'Caveat Prototype'/s);
    expect(meme).toMatch(/main#home-screen\.main > #headline\.hero-caption\s*{\s*color:\s*#ffffff;\s*}/);
    // The scrim's last stop is pinned to the caption's own top padding, not to
    // a percentage of a box whose height is copy-driven. With percentages, a
    // long line slid the fade down under its own top row and white measured
    // 3.0-4.0:1 on the library's ten worst photographs (4.5:1 is the bar).
    // Proof: node scripts/verify-wash-contrast.mjs --caption
    expect(meme).toMatch(/rgba\(0, 0, 0, 0\.62\)\s*calc\(100% - var\(--meme-runway\)\)/);
    expect(meme).toMatch(/padding:\s*var\(--meme-runway\)/);
  });

  it('hides the hero card on every screen except home', () => {
    // The card is a SIBLING of #home-screen, so showScreen() — which toggles
    // only the screen panels — left it painted behind every secondary panel.
    expect(faceliftBlock()).toMatch(/body:not\(\.home-active\) \.hero-card\s*{\s*display:\s*none;\s*}/);
  });

  it('lets the hidden attribute actually hide the new components', () => {
    // Author `display` rules outrank the UA rule behind [hidden], so an empty
    // badge / stats grid / hours strip would otherwise still paint.
    // EVERY facelift element that gets an author display MUST have its own
    // [hidden] guard. This was applied to .stats-row and missed on .agree-line
    // twenty lines below it, leaving a stray gold dot + chevron painted AND
    // clickable on cold load, on 0/0 source failure, and on the error screen.
    expect(faceliftBlock()).toMatch(/\.stats-row\[hidden\], \.agree-line\[hidden\]\s*{\s*display:\s*none;\s*}/);
    // Guard the whole CLASS of bug, not just the two instances: every facelift
    // element that takes an author `display` must carry its own [hidden] rule,
    // or the HTML attribute silently stops hiding it.
    const block = faceliftBlock();
    for (const sel of ['.stats-row', '.agree-line']) {
      expect(block, `${sel} takes an author display and needs a [hidden] guard`)
        .toContain(`${sel}[hidden]`);
    }
  });

  it('puts Share in the nav and Hourly in the freed stats slot', () => {
    // Al, 2026-08-07: Share is core to marketing, so it lives on EVERY screen —
    // it takes the nav slot Sources vacated. Hourly is the ad surface and takes
    // the third column of the stats band, in the witty line's yellow.
    // .m-only: without it the button painted on the >=769px frame and inside the
    // >=1024px postcard pill nav, giving desktop TWO share affordances — a
    // straight breach of the "desktop untouched" guard.
    expect(html).toMatch(/<button id="navShare" class="m-only" type="button" aria-label="Share">/);
    expect(html).not.toMatch(/id="homeShare"/);
    expect(html).not.toMatch(/id="heroShare"/);
    expect(js).toMatch(/navShare\?\.addEventListener\('click', \(\) => shareBtn\?\.click\(\)\)/);
    expect(js).toMatch(/if \(navShare\) navShare\.textContent = t\('misc', 'share'\)/);
    // Share is an ACTION, not a destination. A role="tablist" REQUIRES every
    // child to be a role="tab", so rather than lie about what Share is, the
    // container role was dropped and aria-current carries the active state.
    expect(html).toMatch(/<nav class="nav" aria-label="Primary">/);
    expect(html).not.toMatch(/<nav[^>]*role="tablist"/);
    expect(html).not.toMatch(/<button id="nav[A-Za-z]+"[^>]*role="tab"/);
    expect(html).not.toMatch(/<button id="nav[A-Za-z]+"[^>]*aria-selected=/);
    expect(html).toMatch(/<button type="button" id="homeHourly" class="hourly-cta">/);
    expect(faceliftBlock()).toMatch(/\.hourly-cta\s*{[^}]*background: var\(--brand-gold\)/s);
    // The six-hour strip was REMOVED on 2026-08-08 (Al): it cannibalised taps
    // from the Hourly button — the ad surface — and its height was why Home
    // could not fit above the fold. The CTA is the sole route now.
    expect(html).not.toMatch(/hoursStrip/);
    expect(js).not.toMatch(/hoursStrip/);
    expect(css).not.toMatch(/hours-strip/);
    // The harness measured the strip too; those probes returned 0/null forever
    // and read like proof of a thing that no longer exists.
    const harness = readFileSync(new URL('../scripts/verify-mobile-facelift.mjs', import.meta.url), 'utf8');
    expect(harness).not.toMatch(/hoursStrip/);
  });

  it('shows source agreement as plain tappable text under Low/High', () => {
    // Al, 2026-08-07: it is the app's core differentiator and had gone invisible.
    // Plain text, no pill chrome, reading the ensemble's OWN agreement count.
    expect(html).toMatch(/<button id="agreeLine" class="agree-line m-only" type="button" hidden>/);
    expect(js).toMatch(/agreeLineEl\?\.addEventListener\('click', openSources\)/);
    expect(js).toMatch(/norm\?\.conditionConfidence\?\.sourceAgreement/);
    expect(js).toMatch(/t\('misc', 'sourcesAgree'\)/);
    // Afrikaans signed off by Al 2026-08-08 — no longer a proposal.
    expect(js).toMatch(/af: "\{n\} van \{total\} bronne stem saam",\s*\/\/ APPROVED by Al/);
    expect(faceliftBlock()).toMatch(/\.agree-line\s*{[^}]*background: none/s);
    const home = html.slice(html.indexOf('<main id="home-screen"'), html.indexOf('</main>'));
    expect(home.indexOf('id="rangeLine"')).toBeLessThan(home.indexOf('id="agreeLine"'));
  });

  it('names the wind in letters as well as an arrow', () => {
    // Al approved N/NO/O/SO/S/SW/W/NW (Afrikaans) on 2026-08-07. Letters are the
    // FROM bearing, which is how a South African names a wind (a "suidwester"),
    // so unlike the arrow they are deliberately NOT flipped by 180.
    expect(js).toMatch(/function windCompass\(deg\)/);
    expect(js).toMatch(/af: "N,NO,O,SO,S,SW,W,NW"/);
    expect(js).toMatch(/en: "N,NE,E,SE,S,SW,W,NW"/);
    // zu/xh/st are placeholders and must stay greppable until native review.
    expect(js).toMatch(/PLACEHOLDER - requires_native_review/);
  });

  it('shows the current temperature on the mobile hero and the range above it', () => {
    // Al's ruling 2026-08-06 supersedes BUG-3's range hero on the mobile home ONLY.
    expect(js).toMatch(/const setHeroTemp = \(el, label, range, nowTemp\) =>/);
    expect(faceliftBlock()).toMatch(/\.temp \.hero-range\s*{\s*display:\s*none;\s*}/);
    expect(faceliftBlock()).toMatch(/@media \(min-width: 769px\)[\s\S]*\.temp \.hero-now\s*{\s*display:\s*none;\s*}/);
    // Laag / Hoog returns as its own small line, no longer a duplicate.
    expect(html).toMatch(/id="rangeLine"[^>]*class="[^"]*m-only/);
  });

  it('never aggregates the wind bearing across sources', () => {
    // A weighted mean of 350deg and 10deg is 180deg — the opposite direction.
    // Open-Meteo only, the same precedent the file already sets for hourly UV.
    const api = readFileSync(new URL('../api/weather.js', import.meta.url), 'utf8');
    expect(api).toMatch(/wind_direction_10m/);
    expect(api).toMatch(/windDir:    isNum\(norms\[0\]\?\.windDir\)/);
    expect(api).toMatch(/windDir:    isNum\(hourlies\[0\]\?\.windDirs\?\.\[i\]\)/);
    expect(api).not.toMatch(/wAvg\([^)]*windDir/);
    // LETTERS ONLY. The rotated arrow that shipped alongside them was removed:
    // the arrow showed where the air TRAVELS while the letters name where it
    // comes FROM, so side by side they pointed 180 degrees apart and invited a
    // reader to assume they agreed and read the wind exactly backwards.
    expect(js).not.toMatch(/windArrowSvg/);
    expect(js).not.toMatch(/wind-arrow/);
    expect(js).toMatch(/function windCompass\(deg\)/);

    // THE LOAD-BEARING INVARIANT. Reading windDir off slot 0 is only safe
    // because these arrays are FIXED-LENGTH and pre-filled with null, so slot 0
    // is permanently Open-Meteo. If they were ever built by pushing successful
    // sources, a failed Open-Meteo would slide another provider into slot 0 and
    // the app would show a confidently WRONG bearing instead of none. That is
    // the difference between an absent arrow and a lying one.
    expect(api).toMatch(/const norms\s+= \[null, null, null, null, null\];/);
    expect(api).toMatch(/const hourlies = \[null, null, null, null\];/);
    expect(api).toContain('      norms[0] = {');
    expect(api).toContain('      hourlies[0] = {');
    // activeNorms is a FILTERED COPY used for aggregation — it must never be
    // what windDir reads from.
    expect(api).toMatch(/const activeNorms = norms\.filter\(Boolean\);/);
    expect(api).not.toMatch(/activeNorms\[0\]\??\.windDir/);
    // Same slice bound as `winds`, so hour i lines up across both arrays.
    expect(api).toMatch(/windDirs:   om\.hourly\?\.wind_direction_10m\?\.slice\(0, 48\)/);
  });

  it('does not change desktop behaviour when the location name is clicked', () => {
    expect(js).toMatch(/locationEl\?\.addEventListener\('click', \(\) => {\s*if \(!window\.matchMedia\('\(max-width: 768px\)'\)\.matches\) return;/);
  });

  it('seeds --hero-url even when storage throws, and resolves it from the document root', () => {
    expect(html).toMatch(/function setHeroUrl\(src\)/);
    expect(html).toContain(String.raw`.replace(/["'()\\\s]/g, '')`);
    expect(html).toMatch(/var absolute = new URL\(safe, document\.baseURI\)\.href/);
    expect(html).toMatch(/setProperty\('--hero-url', 'url\("' \+ absolute \+ '"\)'\)/);
    expect(html).not.toMatch(/setProperty\('--hero-url', 'url\("' \+ safe \+ '"\)'\)/);
    expect(new URL('assets/images/bg/default.jpg', 'https://www.probablyweather.co.za/').pathname)
      .toBe('/assets/images/bg/default.jpg');
    expect(new URL('assets/images/bg-canonical/example.webp', 'https://www.probablyweather.co.za/').pathname)
      .toBe('/assets/images/bg-canonical/example.webp');
    // The catch must still seed the default rather than leave the card black.
    expect(html).toMatch(/} catch \(e\) {\s*try { setHeroUrl\('assets\/images\/bg\/default\.jpg'\); } catch \(_\) {}/);
  });

  it('crops the existing full-res asset in CSS rather than touching the image library', () => {
    const block = faceliftBlock();
    // The card paints from the same --hero-url the picker lands on...
    expect(block).toMatch(/\.hero-photo\s*{[^}]*background-image:\s*var\(--hero-url/s);
    expect(block).toMatch(/\.hero-photo\s*{[^}]*background-size:\s*cover/s);
    // Crop offset is a variable so alternatives can be shot without editing
    // rules; the ruled default is asserted in the crop/caption test below.
    expect(block).toMatch(/\.hero-photo\s*{[^}]*background-position:\s*center var\(--hero-crop/s);
    // #bgImg stays in the DOM and keeps loading — it is what SETS --hero-url,
    // persists pw_last_bg and walks the fallback chain. Hiding it with
    // display:none would stop the load in some engines; opacity:0 does not.
    expect(block).toMatch(/#bgImg\s*{\s*opacity:\s*0;\s*}/);
    expect(block).not.toMatch(/#bgImg\s*{\s*display:\s*none/);
  });

  it('seeds --hero-url at shell parse so the card is never an empty frame on cold open', () => {
    expect(html).toMatch(/setProperty\(\s*'--hero-url'/);
    expect(html).toMatch(/pw_last_bg/);
  });

  it('removes the three floating home buttons and gives each destination a new route', () => {
    expect(faceliftBlock()).toMatch(/\.share-btn,\s*\.nav-hourly-pill,\s*\.my-location-btn\s*{\s*display:\s*none;\s*}/);
    // Share delegates to the ONE #shareBtn handler — no second share code path.
    expect(js).toMatch(/navShare\?\.addEventListener\('click',\s*\(\)\s*=>\s*shareBtn\?\.click\(\)\)/);
    expect(js).toMatch(/homeHourly\?\.addEventListener\('click'/);
    expect(js).toMatch(/locationEl\?\.addEventListener\('click'/);
  });

  it('moves Sources out of the nav and into a Settings row, with a way back', () => {
    // Al, 2026-08-06: nav is Vandag / Week / Plekke / Instellings only, and the
    // Home confidence pill is gone entirely.
    expect(html).not.toMatch(/id="navSources"/);
    expect(html).not.toMatch(/id="confidenceBadge"/);
    expect(js).not.toMatch(/confidenceBadge/);
    // No orphans left behind by the removal (Sol, 2026-08-07): the const, the
    // NAV_MAP slot, the label assignment and the listener all had to go with it.
    expect(js).not.toMatch(/navSources/);
    expect(html).toMatch(/<button type="button" id="settingsSourcesRow" class="settings-row">/);
    expect(js).toMatch(/\$\('#settingsSourcesRow'\)\?\.addEventListener\('click', openSources\)/);
    // Sources keeps its full screen, so it needs its own back control.
    expect(html).toMatch(/id="sourcesBack"/);
    expect(js).toMatch(/\$\('#sourcesBack'\)\?\.addEventListener\('click', \(\) => showScreen\(screenSettings\)\)/);
  });

  it('carries the active state on aria-current, not aria-selected', () => {
    // The nav stopped being a role="tablist" when Share (an action, not a
    // destination) joined it, so aria-selected is no longer the right signal —
    // aria-current="page" is, and showScreen has always maintained it.
    expect(js).toMatch(/btn\.setAttribute\('aria-current', 'page'\)/);
    // aria-selected survives ONLY on the language menu, which is a real
    // role="listbox" where it is the correct signal. It must not come back on
    // the nav buttons.
    expect(js).not.toMatch(/btn\.setAttribute\('aria-selected'/);
  });  it('locks the ruled crop and caption treatment', () => {
    const block = faceliftBlock();
    // Crop C — low band.
    expect(block).toMatch(/background-position:\s*center var\(--hero-crop, 78%\)/);
    // Caption A — Caveat, gold, and the per-condition classes must not repaint it.
    expect(block).toMatch(/main#home-screen\.main > \.hero-caption\s*{[^}]*font-family: 'Caveat Prototype'/s);
    expect(block).toMatch(/main#home-screen\.main > \.hero-caption\s*{[^}]*color: var\(--brand-gold\)/s);
    expect(block).toMatch(/\.hero-caption\.hero-storm[^{]*{\s*color: var\(--brand-gold\)/s);
    // The wordmark steps back so the temperature is the largest thing on screen.
    expect(block).toMatch(/\.temp \.hero-probably\s*{[^}]*font-size: 0\.42em/s);
  });

  it('orders home as ruled, ending at the stats band', () => {
    const home = html.slice(html.indexOf('<main id="home-screen"'), html.indexOf('</main>'));
    const at = (needle) => home.indexOf(needle);
    expect(at('id="rangeLine"')).toBeLessThan(at('id="agreeLine"'));
    expect(at('id="agreeLine"')).toBeLessThan(at('id="statsRow"'));
    expect(at('id="statsRow"')).toBeLessThan(at('id="homeHourly"'));
    // One pill spanning two columns, the CTA taking the third.
    expect(faceliftBlock()).toMatch(/\.stats-band\s*{[^}]*grid-template-columns: 2fr 1fr/s);
  });

  it('sizes Home to fit above the fold with no scroll', () => {
    // Al ruling 2026-08-08. Two minimal trims got there, and both are load-
    // bearing: the hero came down from 40vh (the brief's "~40%, tune by eye"
    // anchor) to 36vh, and the bottom padding — which existed only to clear the
    // nav WHILE SCROLLING — dropped to a nav-clearing minimum now that there is
    // nothing below the fold to scroll to. Measured at 390x844: maxScroll 0 at
    // both a one-line and a two-line witty caption.
    expect(faceliftBlock()).toMatch(/--hero-h: var\(--hero-card-h, clamp\(230px, 36vh, 340px\)\)/);
    expect(faceliftBlock()).toMatch(/main#home-screen\.main\s*{\s*padding-bottom: calc\(var\(--nav-h, 72px\) \+ 4px/s);
    expect(faceliftBlock()).toMatch(/\.container\s*{\s*padding-bottom: 0;\s*}/);
  });  it('scopes every facelift rule to <=768px and hides the furniture above it', () => {
    const block = faceliftBlock();
    expect(block).toMatch(/@media \(max-width: 768px\)/);
    expect(block).toMatch(/@media \(min-width: 769px\)\s*{[^}]*\.hero-card\s*{\s*display:\s*none;\s*}/s);
    expect(block).toMatch(/@media \(min-width: 769px\)[\s\S]*\.m-only\s*{\s*display:\s*none\s*!important;\s*}/);
    // Every facelift node in the markup carries .m-only (or lives in #heroCard).
    // #statsRow and #homeHourly are NOT .m-only themselves — they inherit the
    // scoping from their .stats-band parent, which is.
    expect(html).toMatch(/<div class="stats-band m-only">/);
    for (const id of ['feelsLine', 'rangeLine', 'agreeLine']) {
      expect(html, `#${id} must be .m-only`).toMatch(new RegExp(`id="${id}"[^>]*class="[^"]*m-only`));
    }
  });

  it('leaves the desktop postcard composition intact', () => {
    // The postcard block owns >=1024px. If the facelift ever reaches in here,
    // these are the rules that would go first.
    expect(css).toMatch(/@media \(min-width: 1024px\)/);
    expect(css).toMatch(/#bgImg\s*{[^}]*object-position:\s*center 25%/s);
    expect(css).toMatch(/#bgImg\s*{[^}]*transform:\s*rotate\(-2\.4deg\)/s);
    expect(css).toMatch(/--postcard-photo-w:\s*clamp\(340px, 28vw, 410px\)/);
    // The facelift block must come AFTER the postcard block in source order but
    // must never widen its own media query past 768px.
    const postcardAt = css.indexOf('DESKTOP POSTCARD HOME');
    const faceliftAt = css.indexOf('MOBILE FACELIFT — CONTAINED HERO HOME');
    expect(faceliftAt).toBeGreaterThan(postcardAt);
    expect(faceliftBlock()).not.toMatch(/@media \(min-width: 1024px\)/);
  });

  it('keeps the bottom nav opaque now that it no longer sits on a photograph', () => {
    expect(faceliftBlock()).toMatch(/\.nav\s*{[^}]*background:\s*var\(--page-bg\)/s);
    expect(faceliftBlock()).toMatch(/main#home-screen\.main\s*{[^}]*padding-bottom:\s*calc\(var\(--nav-h/s);
  });

  it('holds the facelift to two corner radii', () => {
    const block = faceliftBlock();
    // Per-corner shorthands are fine (the card is top-rounded, its caption foot
    // bottom-rounded) — what must stay at two is the set of radius TOKENS.
    const radii = new Set(
      Array.from(block.matchAll(/border-radius:\s*([^;]+);/g))
        .flatMap((m) => m[1].trim().split(/\s+/))
        // 0 is a squared-off corner; 50% is a circle (share icon, badge dot).
        .filter((v) => v !== '0' && v !== '50%'),
    );
    expect(radii, `facelift uses more than two corner radii: ${[...radii].join(', ')}`)
      .toEqual(new Set(['var(--r-lg)', 'var(--r-sm)']));
  });
});

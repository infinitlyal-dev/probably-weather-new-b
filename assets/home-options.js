// DESIGN BRANCH ONLY — the proposed Home directions (launch eval step 4, 2026-09-24).
// Loaded by app.js only when the URL carries ?home=a|b|c|d. Everything here is scoped to
// body.home-a / .home-b / .home-c / .home-d, so today's Home is untouched without the parameter.
//
//   a  Tidy        — today's layout, with the things that make it feel off fixed
//   b  More meme   — the photograph takes the screen; the data folds into two rows
//   c  Paper       — the joke stays on the photograph; the data sits on a warm printed card
//   d  Blank slate — Home designed fresh from the app's pieces (Al's request, 24 Sept; below)
//
// a–c keep Al's rulings: the joke on the photograph in white over a scrim (14 Aug), the number
// stepped back (14 Aug), the photograph to the top with the header on it (17 Aug), no six-hour
// strip on Home (8 Aug), the source-agreement line and the one stats pill with the yellow Hourly
// button beside it (7 Aug), Home ad-free.

// How much of the photograph a caption may cover before it steps down in size, and the
// smallest it may step down to (Caveat below ~19 px stops reading as handwriting).
const CAP = { a: 0.42, b: 0.46, c: 0.42 };
const MIN_PX = 19;

export function initHomeOption(v) {
  document.body.classList.add('home-option', `home-${v}`);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'assets/home-options.css';
  document.head.appendChild(link);

  if (v === 'd') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initBlankSlate(link));
    else initBlankSlate(link);
    return;
  }

  // A long line steps down, 1 px at a time, until the TEXT (not the scrim's runway
  // above it) covers no more than CAP of the photograph — the isiZulu longest line ran
  // five lines and covered half the picture.
  const fit = () => {
    const cap = document.getElementById('headline');
    const photo = document.getElementById('heroPhoto');
    if (!cap) return;
    cap.style.fontSize = '';          // cleared first, so a wide window never keeps a phone size
    if (!photo || !matchMedia('(max-width: 768px)').matches) return;
    const limit = photo.getBoundingClientRect().height * CAP[v];
    const textH = () => cap.getBoundingClientRect().height - parseFloat(getComputedStyle(cap).paddingTop || '0');
    let px = parseFloat(getComputedStyle(cap).fontSize);
    for (let guard = 0; guard < 40 && textH() > limit && px > MIN_PX; guard++) {
      px -= 1;
      cap.style.fontSize = `${px}px`;
    }
  };
  const again = () => requestAnimationFrame(fit);
  const watch = new MutationObserver(again);
  const start = () => {
    const cap = document.getElementById('headline');
    if (cap) watch.observe(cap, { childList: true, characterData: true, subtree: true });
    again();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  addEventListener('resize', again);
  link.addEventListener('load', again);
}

// ═════════════ D — BLANK SLATE ═════════════
// Al, 24 Sept: if Home were designed fresh from the app's pieces — the photographs, the jokes,
// the weather — what would it look like? A film frame. The photograph is the frame, edge to edge
// and top to bottom; the temperature is the title card, top left, the biggest thing on the
// screen, with "Probably …" under it; the joke is the subtitle, big, on a soft dark fade; one
// quiet credit line of facts under it; Share on the photograph, sending the picture that is on
// screen; Hourly and the week one swipe up, on a panel with a handle you can also tap.
//
// D alone, and on this branch only, sets aside the Home layout rulings Al named for it: the
// smaller number, the yellow Hourly button, the stats pill, the separate sources link, the card.
// It adds no words: every label on it is read off what the app has already rendered (Hourly,
// Weekly, 7-Day, Share, the stats), so it is in whatever language is on screen.

const D_MIN_PX = 19;       // the joke's floor, as for a–c
const D_JOKE_MAX = 0.36;   // the joke's text takes at most this share of the screen's height
const D_OPEN_MIN = 24;     // and at least this much photograph always shows above the joke
const D_CAP_FOOT = 6;      // the joke's bottom padding when it sits at the foot (home-options.css)

const SVG_ATTRS = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pw-icon" aria-hidden="true"';
const ICON_SHARE = `<svg ${SVG_ATTRS} width="20" height="20"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>`;
const ICON_UP = `<svg ${SVG_ATTRS} width="18" height="18"><path d="M6 15l6-6 6 6"/></svg>`;

function initBlankSlate(link) {
  const $ = (s) => document.querySelector(s);
  const body = document.body;
  const root = document.documentElement;
  const main = $('#home-screen');
  const headline = $('#headline');
  if (!main || !headline) return;
  const phone = () => matchMedia('(max-width: 768px)').matches;
  const onHome = () => body.classList.contains('home-active');
  const text = (sel) => ($(sel)?.textContent || '').trim();
  // The joke that arrives late (Al, 25 Sept): on only with ?reveal=ink|word|fade (see initReveal).
  const revealOpts = revealOptions();
  let revealer = null;

  // ---------- the pieces D adds (no words of its own) ----------
  const line = document.createElement('p');
  line.id = 'dLine';
  line.className = 'd-line';
  headline.insertAdjacentElement('afterend', line);

  const share = document.createElement('button');
  share.type = 'button';
  share.id = 'dShare';
  share.className = 'd-share';
  share.innerHTML = `${ICON_SHARE}<span class="d-share-label"></span>`;
  main.appendChild(share);
  // One share code path: app.js's #shareBtn handler builds the text and the link, and on this
  // branch also attaches the picture window.__PW_SHARE_FILES hands it (see prepareShare).
  share.addEventListener('click', () => $('#shareBtn')?.click());

  const handle = document.createElement('button');
  handle.type = 'button';
  handle.id = 'dHandle';
  handle.className = 'd-handle';
  handle.setAttribute('aria-expanded', 'false');
  handle.setAttribute('aria-controls', 'dSheet');
  handle.innerHTML = `<span class="d-grip" aria-hidden="true"></span><span class="d-handle-row">${ICON_UP}<span class="d-handle-label"></span></span>`;

  const sheet = document.createElement('section');
  sheet.id = 'dSheet';
  sheet.className = 'd-sheet';
  sheet.setAttribute('aria-hidden', 'true');
  sheet.inert = true;
  sheet.innerHTML = `
    <button type="button" class="d-sheet-grip" aria-controls="dSheet" aria-expanded="true"><span class="d-grip" aria-hidden="true"></span><span class="d-sheet-title"></span></button>
    <div class="d-sheet-body">
      <h2 class="d-sheet-h" data-d="hourly"></h2>
      <div class="d-hours" role="list"></div>
      <h2 class="d-sheet-h" data-d="week"></h2>
      <div class="d-days"></div>
      <div class="d-sheet-more">
        <button type="button" class="d-more" data-d="more-hourly"></button>
        <button type="button" class="d-more" data-d="more-week"></button>
      </div>
    </div>`;
  body.append(handle, sheet);
  const sheetBody = sheet.querySelector('.d-sheet-body');

  // ---------- labels, read off the app in the language on screen ----------
  const labels = () => {
    const hourly = text('#homeHourlyLabel');
    const week = text('#navWeek');
    const shareWord = text('#navShare');
    const both = [hourly, week].filter(Boolean).join(' · ');
    handle.querySelector('.d-handle-label').textContent = both;
    sheet.querySelector('.d-sheet-title').textContent = both;
    sheet.setAttribute('aria-label', both);
    share.querySelector('.d-share-label').textContent = shareWord;
    sheet.querySelector('[data-d="hourly"]').textContent = hourly;
    sheet.querySelector('[data-d="week"]').textContent = text('#week-screen .screen-title') || week;
    sheet.querySelector('[data-d="more-hourly"]').textContent = `${hourly} ›`;
    sheet.querySelector('[data-d="more-week"]').textContent = `${week} ›`;
  };

  // ---------- the quiet line: Low · High · Rain · Wind · sources agree ----------
  // Composed from the three things the app already renders under the hero (the range line,
  // the stats pill, the agreement line), so every word and unit is the app's own. The facts
  // travel in groups that never break inside (the range; rain; wind with its gusts; the
  // agreement), and a group that starts a new line drops its leading dot (see tidyLine).
  const composeLine = () => {
    const groups = [];
    const range = $('#rangeLine');
    if (range && !range.hidden) {
      const pair = [];
      range.querySelectorAll('.range-k').forEach((k) => {
        const v = k.nextElementSibling;
        if (v?.classList.contains('range-v')) pair.push(`${k.textContent.trim()} ${v.textContent.trim()}`);
      });
      if (pair.length) groups.push(pair);
    }
    const stats = $('#statsRow');
    if (stats && !stats.hidden) {
      const cells = [...stats.querySelectorAll('.stat')];
      const rain = cells.find((c) => /%$/.test(c.querySelector('.stat-v')?.textContent.trim() || ''));
      const wind = cells.find((c) => c.querySelector('.stat-v .stat-unit'));
      if (rain) groups.push([`${rain.querySelector('.stat-k').textContent.trim()} ${rain.querySelector('.stat-v').textContent.trim()}`]);
      if (wind) {
        const v = wind.querySelector('.stat-v');
        const num = [...v.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
        const unit = v.querySelector('.stat-unit').textContent.trim();
        const [dir, ...rest] = (wind.querySelector('.stat-sub')?.textContent || '').split(' · ').map((s) => s.trim()).filter(Boolean);
        // "gusts 35" rides with the wind when the gusts are worth saying (renderStatsRow's rule).
        groups.push([[wind.querySelector('.stat-k').textContent.trim(), num, unit, dir].filter(Boolean).join(' '), ...rest]);
      }
    }
    const agree = $('#agreeLine');
    const agreeText = agree && !agree.hidden ? agree.textContent.trim() : '';
    line.replaceChildren();
    // The plain space between groups is the only place a line may break.
    groups.forEach((g, i) => {
      const s = document.createElement('span');
      s.className = 'd-part';
      if (i) { line.append(' '); s.append(sep(true)); }
      g.forEach((p, j) => { if (j) s.append(sep()); s.append(p); });
      line.append(s);
    });
    if (agreeText) {
      const s = document.createElement('span');
      s.className = `d-part d-agree${agree.classList.contains('is-low') ? ' is-low' : ''}`;
      if (groups.length) { line.append(' '); s.append(sep(true)); }
      const dot = document.createElement('span');
      dot.className = 'd-agree-dot';
      dot.setAttribute('aria-hidden', 'true');
      s.append(dot, agreeText);
      line.append(s);
    }
    line.hidden = !line.childNodes.length;
  };
  const sep = (lead = false) => {
    const s = document.createElement('span');
    s.className = lead ? 'd-sep d-lead' : 'd-sep';
    s.setAttribute('aria-hidden', 'true');
    s.textContent = lead ? '· ' : ' · ';
    return s;
  };
  // A group that opens a new line hides its leading dot. Visibility, not display: the dot keeps
  // its width, so hiding it can never pull the group back up a line and undo the measurement.
  const tidyLine = () => {
    let prev = null;
    line.querySelectorAll('.d-part').forEach((p) => {
      const top = p.getBoundingClientRect().top;
      const lead = p.querySelector('.d-lead');
      if (lead) lead.style.visibility = prev !== null && Math.abs(top - prev) > 4 ? 'hidden' : '';
      prev = top;
    });
  };

  // ---------- the panel: the next 24 hours, then the week ----------
  // Built from the rows the Hourly and Weekly screens already rendered — the same times,
  // icons, units and words. Only rows are taken: the ad slots stay on those screens, so the
  // panel, which is part of Home, carries none.
  const fillPanel = () => {
    const hours = sheet.querySelector('.d-hours');
    hours.replaceChildren();
    [...document.querySelectorAll('#hourly-timeline .hourly-row:not(.hourly-header)')].slice(0, 24).forEach((r) => {
      const cell = document.createElement('div');
      cell.className = 'd-hour';
      cell.setAttribute('role', 'listitem');
      const time = document.createElement('span');
      time.className = 'd-hour-time';
      time.textContent = r.querySelector('.h-time')?.textContent || '';
      const icon = r.querySelector('.h-icon')?.cloneNode(true) || document.createElement('span');
      icon.className = 'd-hour-icon';
      const t = r.querySelector('.h-temp');
      const temp = document.createElement('span');
      temp.className = ['d-hour-temp', ...[...(t?.classList || [])].filter((c) => c.startsWith('temp-'))].join(' ');
      temp.textContent = t?.textContent || '';
      const rain = document.createElement('span');
      rain.className = 'd-hour-rain';
      rain.textContent = r.querySelector('.h-rain')?.textContent || '';
      cell.append(time, icon, temp, rain);
      hours.append(cell);
    });
    const days = sheet.querySelector('.d-days');
    days.replaceChildren();
    document.querySelectorAll('#daily-cards .daily-row-tappable').forEach((orig) => {
      const row = orig.cloneNode(true);
      row.classList.add('d-day-row');
      row.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
      row.addEventListener('click', () => { setOpen(false); orig.click(); });
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); row.click(); }
      });
      days.append(row);
    });
  };
  sheet.querySelector('[data-d="more-hourly"]').addEventListener('click', () => { setOpen(false); $('#homeHourly')?.click(); });
  sheet.querySelector('[data-d="more-week"]').addEventListener('click', () => { setOpen(false); $('#navWeek')?.click(); });

  // ---------- open and close ----------
  let open = false;
  // Focus never stays on something that is about to disappear (Sol, 24 Sept): opening moves it
  // into the sheet when the handle had it (the handle hides), and closing brings it back to the
  // handle when it was inside the sheet (the sheet goes inert).
  function setOpen(next, { focus = false } = {}) {
    const active = document.activeElement;
    const fromHandle = active === handle;
    const fromSheet = sheet.contains(active);
    open = next;
    body.classList.toggle('d-sheet-open', open);
    handle.setAttribute('aria-expanded', String(open));
    sheet.setAttribute('aria-hidden', String(!open));
    sheet.inert = !open;
    sheet.style.transform = '';
    if (open) sheetBody.scrollTop = 0;
    if (open && (focus || fromHandle)) sheet.querySelector('.d-sheet-grip')?.focus();
    if (!open && (focus || fromSheet) && handle.getClientRects().length) handle.focus();
  }
  // A drag follows the finger; a tap (or Enter/Space) arrives as a click and toggles.
  let dragged = false;
  const drag = (el, opening) => el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !phone()) return;
    const y0 = e.clientY;
    const t0 = performance.now();
    const h = sheet.getBoundingClientRect().height;
    let dy = 0;
    let moving = false;
    try { el.setPointerCapture(e.pointerId); } catch { /* synthetic pointers have none */ }
    const move = (ev) => {
      dy = ev.clientY - y0;
      if (!moving && Math.abs(dy) < 6) return;
      moving = true;
      sheet.classList.add('is-dragging');
      const y = opening ? Math.min(h, Math.max(0, h + dy)) : Math.min(h, Math.max(0, dy));
      sheet.style.transform = `translateY(${y}px)`;
    };
    const stop = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', cancel);
      sheet.classList.remove('is-dragging');
    };
    const end = () => {
      stop();
      if (!moving) return;
      // The click that follows a drag is swallowed — and the flag clears after it either way, so
      // a drag with no click after it cannot eat the next real tap.
      dragged = true;
      setTimeout(() => { dragged = false; }, 0);
      const v = dy / Math.max(1, performance.now() - t0);
      setOpen(opening ? (dy < -h * 0.18 || v < -0.35) : !(dy > h * 0.18 || v > 0.35));
    };
    // A cancelled gesture (the browser took it) commits nothing: the sheet goes back to where it was.
    const cancel = () => {
      stop();
      sheet.style.transform = '';
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', cancel);
  });
  const grip = sheet.querySelector('.d-sheet-grip');
  drag(handle, true);
  drag(grip, false);
  handle.addEventListener('click', (e) => {
    if (dragged) { dragged = false; return; }
    setOpen(!open, { focus: e.detail === 0 });
  });
  grip.addEventListener('click', (e) => {
    if (dragged) { dragged = false; return; }
    setOpen(false, { focus: e.detail === 0 });
  });
  // One swipe up anywhere on the photograph opens it too — the handle is the visible way in,
  // the swipe is the quick one. Controls, the panel and the banners keep their own gestures.
  let swipe = null;
  document.addEventListener('touchstart', (e) => {
    swipe = null;
    if (open || !onHome() || !phone() || e.touches.length !== 1) return;
    if (e.target.closest?.('button, a, input, select, .language-menu, .install-banner, .d-sheet, .nav, #capeWindBanner, .install-modal')) return;
    swipe = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: e.timeStamp };
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (!swipe) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - swipe.x;
    const dy = t.clientY - swipe.y;
    if (dy < -56 && Math.abs(dy) > Math.abs(dx) * 1.4 && e.timeStamp - swipe.t < 700) setOpen(true);
    swipe = null;
  }, { passive: true });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) setOpen(false, { focus: true }); });

  // ---------- measure: the header, the nav, and the joke's room ----------
  // While the first-visit install banner shows, the open photograph between the title card and
  // the joke has to hold it too: the joke steps down to make that room, and D pins the banner
  // there (install.js's own placement falls back to the top edge — over the header — when the
  // strip is too small, which on D it was).
  let bannerRoom = 0;
  const reserveH = () => (handle.getClientRects().length ? innerHeight - handle.getBoundingClientRect().top : 0);
  const fit = () => {
    headline.style.fontSize = '';
    if (!phone() || !onHome()) return;
    const status = $('#weatherStatus');
    if (!status) return;
    const cs = getComputedStyle(headline);
    const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    // The handle sits on the nav; everything from its top edge down is not the joke's.
    const floor = innerHeight - reserveH() - line.getBoundingClientRect().height;
    const room = floor - status.getBoundingClientRect().bottom - Math.max(D_OPEN_MIN, bannerRoom);
    const limit = Math.min(innerHeight * D_JOKE_MAX, room - pad);
    const textH = () => headline.getBoundingClientRect().height - pad;
    let px = parseFloat(cs.fontSize);
    for (let guard = 0; guard < 40 && textH() > limit && px > D_MIN_PX; guard++) {
      px = Math.max(D_MIN_PX, px - 1);   // the floor holds: a 19.4 px start stops at 19, not 18.4
      headline.style.fontSize = `${px}px`;
    }
  };
  // The subtitle rises when the picture needs the bottom — what TV subtitlers do. Al's crop anchor
  // is where he dragged a band half the photograph tall onto its subject: the band's centre sits
  // at 25% + anchor/2 of the photograph, and its middle half is taken as the subject. The joke
  // rises under "Probably …" only when both hold: at the foot it would sit on the subject's centre,
  // and risen it clears the whole subject. A subject in the middle (the driver in the rain) keeps
  // the joke at the foot, because rising would only move the joke onto her face. No anchor, no
  // guess: the foot. Decided on geometry that does not change with the choice (the title card and
  // the credit line keep their boxes, the joke keeps its size), so it cannot flip back and forth.
  const placeJoke = () => {
    const anchor = parseFloat(getComputedStyle(root).getPropertyValue('--hero-crop'));
    let high = false;
    const status = $('#weatherStatus');
    if (Number.isFinite(anchor) && status) {
      const img = $('#bgImg');
      const iw = img?.naturalWidth || 1008;
      const ih = img?.naturalHeight || 1792;
      const k = Math.max(innerWidth / iw, innerHeight / ih);
      const dh = ih * k;
      const subjectY = (0.25 + anchor / 200) * dh + (innerHeight - dh) * (anchor / 100);
      const subjectTop = subjectY - 0.125 * dh;
      const cs = getComputedStyle(headline);
      const textH = headline.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const footTextTop = line.getBoundingClientRect().top - D_CAP_FOOT - textH;
      const risenTextBottom = status.getBoundingClientRect().bottom + textH;
      high = subjectY >= footTextTop - 8 && subjectTop >= risenTextBottom + 8;
    }
    if (window.__PW_D_FOOT_ONLY) high = false;   // the proof pages' "as sketched" shots
    body.classList.toggle('d-joke-high', high);
  };
  // Custom properties are written only when they change: D watches the root's style for the
  // photograph's own swaps, and an unchanged write would otherwise wake it every frame.
  const setVar = (name, value) => { if (root.style.getPropertyValue(name) !== value) root.style.setProperty(name, value); };
  const sync = () => {
    if (!phone()) return;
    const header = $('.header');
    const nav = $('.nav');
    const headerBottom = header ? Math.max(0, Math.round(header.getBoundingClientRect().bottom)) : 0;
    const navH = nav && nav.getClientRects().length ? Math.max(0, Math.round(innerHeight - nav.getBoundingClientRect().top)) : 0;
    setVar('--d-header-h', `${headerBottom}px`);
    setVar('--d-nav-h', `${navH}px`);
    const status = $('#weatherStatus');
    if (status) setVar('--d-sheet-top', `${Math.round(Math.min(innerHeight * 0.42, status.getBoundingClientRect().bottom - 28))}px`);
    const banner = $('#installBanner');
    const bannerOn = !!banner && !banner.classList.contains('hidden') && banner.getClientRects().length > 0;
    bannerRoom = bannerOn ? banner.offsetHeight + 16 : 0;
    tidyLine();
    fit();
    if (onHome()) placeJoke();
    if (bannerOn && status) {
      // The open photograph: between the title card and the joke, or — when the joke has risen —
      // between the joke and the credit line.
      const high = body.classList.contains('d-joke-high');
      const capBox = headline.getBoundingClientRect();
      const upper = high ? capBox.bottom - parseFloat(getComputedStyle(headline).paddingBottom) / 2 : status.getBoundingClientRect().bottom;
      const lower = high ? line.getBoundingClientRect().top : capBox.top + parseFloat(getComputedStyle(headline).paddingTop) / 2;
      const h = banner.offsetHeight;
      const y = lower - upper >= h + 16
        ? upper + (lower - upper - h) / 2                                                 // in the open photograph
        : innerHeight - reserveH() - h - 8;                                               // a tiny screen: above the handle
      setVar('--d-banner-top', `${Math.round(Math.max(status.getBoundingClientRect().bottom + 8, y))}px`);
    }
    revealer?.place();
    syncs += 1;
    prepareShare();
  };
  let syncs = 0;
  let queued = false;
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; sync(); });
  };

  const refresh = () => { labels(); composeLine(); queue(); };
  const watch = (sel, fn, opts = { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] }) => {
    const el = $(sel);
    if (el) new MutationObserver(fn).observe(el, opts);
  };
  ['#rangeLine', '#statsRow', '#agreeLine', '#homeHourlyLabel', '#navWeek', '#navShare', '#week-screen .screen-title'].forEach((s) => watch(s, refresh));
  ['#temp', '#description', '#headline', '.header'].forEach((s) => watch(s, queue));
  watch('#installBanner', queue, { attributes: true, attributeFilter: ['class'] });
  // One render rebuilds both lists; the panel follows once per frame, not once per list.
  let panelQueued = false;
  const queuePanel = () => {
    if (panelQueued) return;
    panelQueued = true;
    requestAnimationFrame(() => { panelQueued = false; fillPanel(); });
  };
  watch('#hourly-timeline', queuePanel, { childList: true });
  watch('#daily-cards', queuePanel, { childList: true });
  // Leaving Home closes the panel; coming back re-measures.
  new MutationObserver(() => { if (!onHome() && open) setOpen(false); queue(); }).observe(body, { attributes: true, attributeFilter: ['class'] });
  // The photograph itself (the picker swaps --hero-url) — the shared picture must follow it.
  new MutationObserver(queue).observe(root, { attributes: true, attributeFilter: ['style'] });
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(queue);
    ['.header', '#weatherStatus', '.nav'].forEach((s) => { const el = $(s); if (el) ro.observe(el); });
  }
  addEventListener('resize', queue);
  link.addEventListener('load', () => { refresh(); fillPanel(); });
  document.fonts?.ready?.then(queue);
  if (revealOpts) revealer = initReveal({ headline, main, status: () => $('#weatherStatus'), phone, onHome }, revealOpts);
  refresh();
  fillPanel();

  // ---------- Share sends what is on screen ----------
  // A picture of the frame, drawn from the page itself: the photograph at the crop the screen
  // shows, the same fades, and every line of text at the position, size and colour the browser
  // laid it out in. The controls (language, share, handle, nav) are left off; the address goes
  // at the foot, where the nav was. Drawn ahead of the tap, because a share sheet has to open
  // inside the tap itself; if the screen has changed since, the old picture is not sent and the
  // share falls back to today's link card.
  let shareFile = null;
  let shareSig = '';
  let shareTimer = 0;
  // With the joke that arrives late on (?reveal=…), Share sends a postcard instead (Al, 25 Sept):
  // the photograph clean, the joke written under it on a light border — never on the photograph.
  const postcard = !!revealOpts;
  const joke = () => (headline.dataset.line === 'joke' ? headline.textContent.trim() : '');
  const photoUrl = () => /url\(["']?([^"')]+)["']?\)/.exec(getComputedStyle($('#heroPhoto') || body).backgroundImage)?.[1] || '';
  // Everything the picture draws, including where it sits: the photograph and its crop, every
  // line of text and its box, the joke's size and whether it has risen, the warning bar (Sol,
  // 24 Sept: a signature of the words alone let a picture of an older layout through). The
  // postcard draws no layout, so its words and its photograph are the whole of it.
  const signature = () => {
    if (postcard) return [photoUrl(), joke(), ...POSTCARD_FACTS.map(text), document.documentElement.lang].join('|');
    const photo = getComputedStyle($('#heroPhoto') || body);
    const box = (sel) => { const el = $(sel); if (!el || !el.getClientRects().length) return '-'; const r = el.getBoundingClientRect(); return `${Math.round(r.top)},${Math.round(r.height)}`; };
    return [photo.backgroundImage, photo.backgroundPosition, innerWidth, innerHeight,
      body.classList.contains('d-joke-high'), headline.style.fontSize,
      ...['.brand-text', '.tagline', '#weatherStatus', '#headline', '#dLine', '#capeWindBanner'].map((s) => `${text(s)}@${box(s)}`),
    ].join('|');
  };
  const drawShare = () => (postcard ? drawPostcard() : drawFrame());
  function prepareShare() {
    clearTimeout(shareTimer);
    shareTimer = setTimeout(async () => {
      if (!phone() || !onHome() || document.hidden) return;
      const sig = signature();
      if (sig === shareSig && shareFile) return;
      try {
        const blob = await drawShare();
        if (blob && signature() === sig) {
          shareFile = new File([blob], 'probably-weather.jpg', { type: 'image/jpeg' });
          shareSig = sig;
        }
      } catch { shareFile = null; }
    }, 700);
  }
  window.__PW_SHARE_FILES = () => (shareFile && onHome() && phone() && signature() === shareSig ? [shareFile] : null);
  // For the proof pages: the same picture Share would send, as a data URL.
  window.__PW_D = {
    shareImage: async () => {
      const blob = await drawShare();
      return blob ? new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); }) : null;
    },
    open: () => setOpen(true),
    close: () => setOpen(false),
    syncs: () => syncs,
    reveal: revealer?.api || null,
  };

  // The postcard: the photograph whole and untouched on the print's stock, the joke under it in the
  // same hand as on screen (dark ink, balanced, stepping down to fit four lines), then the facts as
  // the screen shows them (place · temperature · Probably …) and the address. The stock and the ink
  // are the desktop postcard's own (app.css --print-stock / --print-ink): the two are one print.
  async function drawPostcard() {
    const url = photoUrl();
    if (!url) return null;
    await document.fonts?.ready;
    const img = await loadImage(url);
    const words = joke();
    const hand = getComputedStyle(headline);
    const ui = getComputedStyle(line).fontFamily;
    const handFont = (px) => `${hand.fontStyle} ${hand.fontWeight} ${px}px ${hand.fontFamily}`;
    const W = 1080;
    const B = 36;                                        // the border: sides and top
    const PW = W - 2 * B;
    const PH = Math.round(PW * img.naturalHeight / img.naturalWidth);
    const probe = document.createElement('canvas').getContext('2d');
    let px = 64;
    let lines = [];
    if (words) {
      for (;;) {
        probe.font = handFont(px);
        lines = balanceLines(probe, words, PW - 72);
        if (lines.length <= 4 || px <= 44) break;
        px -= 2;
      }
    }
    const lh = Math.round(px * 1.16);
    const [place, now, probably, desc] = POSTCARD_FACTS.map(text);
    const facts = [place, now, [probably, desc].filter(Boolean).join(' ')].filter(Boolean).join('  ·  ');
    let factPx = 27;
    probe.font = `500 ${factPx}px ${ui}`;
    while (factPx > 20 && probe.measureText(facts).width > PW - 40) { factPx -= 1; probe.font = `500 ${factPx}px ${ui}`; }
    const SITE_PX = 24;
    const jokeTop = B + PH + (words ? 40 : 24);
    const factsY = jokeTop + lines.length * lh + (words ? 26 : 0) + factPx / 2;
    const siteY = factsY + factPx / 2 + 20 + SITE_PX / 2;
    const H = Math.round(siteY + SITE_PX / 2 + 38);

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f6f2e8';                           // --print-stock
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(img, B, B, PW, PH);
    ctx.strokeStyle = 'rgba(27, 24, 19, 0.12)';          // the photograph's edge on the stock
    ctx.lineWidth = 1;
    ctx.strokeRect(B + 0.5, B + 0.5, PW - 1, PH - 1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (words) {
      ctx.font = handFont(px);
      ctx.fillStyle = '#1b1813';                         // --print-ink
      lines.forEach((l, i) => ctx.fillText(l, W / 2, jokeTop + lh * i + lh / 2));
    }
    ctx.font = `500 ${factPx}px ${ui}`;
    ctx.fillStyle = '#6f6352';                           // 5.3:1 on the stock
    ctx.fillText(facts, W / 2, factsY);
    // The address, with the app's mark in front of it.
    ctx.font = `600 ${SITE_PX}px ${ui}`;
    const site = 'probablyweather.co.za';
    const MARK = 30;
    const total = MARK + 10 + ctx.measureText(site).width;
    const x0 = W / 2 - total / 2;
    const logo = $('#logoCircle svg');
    if (logo) {
      try {
        const svg = new XMLSerializer().serializeToString(logo);
        ctx.drawImage(await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`), x0, siteY - MARK / 2, MARK, MARK);
      } catch { /* the mark is decoration */ }
    }
    ctx.fillStyle = '#8a7c68';
    ctx.textAlign = 'left';
    ctx.fillText(site, x0 + MARK + 10, siteY);
    return new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
  }

  async function drawFrame() {
    const photoEl = $('#heroPhoto');
    if (!photoEl) return null;
    const pcs = getComputedStyle(photoEl);
    const url = /url\(["']?([^"')]+)["']?\)/.exec(pcs.backgroundImage)?.[1];
    if (!url) return null;
    await document.fonts?.ready;
    const W = innerWidth;
    const H = innerHeight;
    const S = Math.min(3, Math.max(2, devicePixelRatio || 2));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(W * S);
    canvas.height = Math.round(H * S);
    const ctx = canvas.getContext('2d');
    ctx.scale(S, S);
    ctx.fillStyle = '#0d0a07';
    ctx.fillRect(0, 0, W, H);

    // The photograph, as background-size: cover at the page's own background-position.
    const img = await loadImage(url);
    const box = photoEl.getBoundingClientRect();
    const k = Math.max(box.width / img.naturalWidth, box.height / img.naturalHeight);
    const dw = img.naturalWidth * k;
    const dh = img.naturalHeight * k;
    const [px, py] = pcs.backgroundPosition.split(' ');
    const at = (v, free) => (/%$/.test(v) ? free * parseFloat(v) / 100 : parseFloat(v) || 0);
    ctx.drawImage(img, box.left + at(px, box.width - dw), box.top + at(py, box.height - dh), dw, dh);

    // The fades — the same stops home-options.css paints (keep the two in step).
    const status = $('#weatherStatus').getBoundingClientRect();
    const statusRun = parseFloat(getComputedStyle($('#weatherStatus')).paddingBottom) || 0;
    const cap = headline.getBoundingClientRect();
    const lineBox = line.getBoundingClientRect();
    if (body.classList.contains('d-joke-high')) {
      const capRun = parseFloat(getComputedStyle(headline).paddingBottom) || 0;
      fade(ctx, 0, status.bottom, [[0, 0.64], [1, 0.58]], W);
      fade(ctx, cap.top, cap.bottom, [[0, 0.58], [1 - capRun / Math.max(1, cap.height), 0.58], [1, 0]], W);
      const run = parseFloat(getComputedStyle(line, '::before').height) || 0;
      fade(ctx, lineBox.top - run, lineBox.top, [[0, 0], [1, 0.70]], W);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.70)';
      ctx.fillRect(0, lineBox.top, W, H - lineBox.top);
    } else {
      fade(ctx, 0, status.bottom, [[0, 0.64], [Math.max(0, 1 - statusRun / status.bottom), 0.52], [1, 0]], W);
      const capRun = parseFloat(getComputedStyle(headline).paddingTop) || 0;
      fade(ctx, cap.top, cap.bottom, [[0, 0], [capRun / Math.max(1, cap.height), 0.62], [1, 0.70]], W);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.70)';
      ctx.fillRect(0, cap.bottom, W, H - cap.bottom);
    }

    // The header's mark, then every line of text where the browser put it.
    const logo = $('#logoCircle svg');
    if (logo && logo.getClientRects().length) {
      const r = logo.getBoundingClientRect();
      const svg = new XMLSerializer().serializeToString(logo);
      try { ctx.drawImage(await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`), r.left, r.top, r.width, r.height); } catch { /* the mark is decoration */ }
    }
    // A wind warning is on the screen, so it is in the picture: the bar (app.css .cape-wind-banner's
    // two oranges), then its words below with the rest.
    const warn = $('#capeWindBanner');
    const warning = warn && !warn.classList.contains('hidden') && warn.getClientRects().length;
    if (warning) {
      const r = warn.getBoundingClientRect();
      const g = ctx.createLinearGradient(r.left, r.top, r.right, r.bottom);
      g.addColorStop(0, 'rgba(255, 111, 0, 0.92)');
      g.addColorStop(1, 'rgba(230, 74, 25, 0.92)');
      ctx.fillStyle = g;
      ctx.fillRect(r.left, r.top, r.width, r.height);
    }
    for (const sel of ['.brand-text', '.tagline', '#weatherStatus', '#headline', '#dLine', ...(warning ? ['#capeWindText'] : [])]) {
      const el = $(sel);
      if (el) drawText(ctx, el);
    }
    const dot = $('#dLine .d-agree-dot');
    if (dot && dot.getClientRects().length) {
      const r = dot.getBoundingClientRect();
      ctx.fillStyle = getComputedStyle(dot).backgroundColor;
      ctx.beginPath();
      ctx.arc(r.left + r.width / 2, r.top + r.height / 2, r.width / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // The address, where the controls were.
    ctx.font = `600 15px ${getComputedStyle(line).fontFamily}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('probablyweather.co.za', W / 2, lineBox.bottom + (H - lineBox.bottom) / 2);
    return new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
  }
}

// ═════════════ D — THE JOKE THAT ARRIVES LATE ═════════════
// Al, 25 Sept: Home shows the photograph and the forecast first, with no joke; a beat later the joke
// writes itself onto the photograph — "exactly the comedic timing … makes it feel more unique to me
// and like we want to see what it will say." Setup (the photograph), beat, punchline. On D behind a
// switch, so D with and without it can be compared; style and beat switch by URL for the test:
//   ?home=d&reveal=ink    the ink runs left to right, line by line, in the handwriting: it looks written
//   ?home=d&reveal=word   the words arrive one after another
//   ?home=d&reveal=fade   the whole line fades in
//   &beat=1|2|3.5         seconds from the photograph landing to the first ink (1 when left out)
//   &replay=1             every open counts as a first sight (the comparison links only)
// The clock starts when the photograph is on screen — loaded, decoded, painted, the splash gone — not
// when the page loads. Writing time grows with the line and stops at 1.6 s, so a long isiZulu line
// never drags. A joke this phone has already shown is simply there; reduced motion gets it at once; a
// screen reader has the words the moment the app writes them (the eye's copy is faded and masked, never
// taken out of the page). The joke's room is laid out from the start, so nothing moves when it lands,
// and the weather never waits: this only ever styles the joke. A tap on the photograph hides or shows
// it; a button, out of sight until a keyboard reaches it, does the same for keyboards and screen readers.

const REVEAL_STYLES = ['ink', 'word', 'fade'];
const WRITE_MS_PER_CHAR = 22;   // the pen's pace: a 60-character line in ~1.3 s
const WRITE_MIN_MS = 600;
const WRITE_MAX_MS = 1600;      // Al: never much longer than ~1.6 s, however long the line
const WORD_FADE_MS = 260;       // reveal=word: each word's own fade, inside the writing time
const FADE_MS = 600;            // reveal=fade: the whole line
const SCRIM_MS = 300;           // the joke's dark arrives just ahead of the words
const PEN_DOWN_MS = 90;         // …and the pen touches down this long after the dark starts
const TOGGLE_MS = 220;          // a tap's hide or show
const INK_EDGE = 18;            // px: the soft front of the ink
const INK_BLEED = 20;           // px: room for the text shadow around the words
const SEEN_KEY = 'pw_d_jokes_seen';
const SEEN_CAP = 400;
// The one new piece of copy: the control's name. English and Afrikaans go to Al to OK; isiZulu,
// isiXhosa and Sesotho went through the translation skills and lang-check (review/reveal/labels.md).
const JOKE_LABELS = {
  en: { show: 'Show the joke', hide: 'Hide the joke' },
  af: { show: 'Wys die grap', hide: 'Versteek die grap' },
  zu: { show: 'Bonisa ihlaya', hide: 'Fihla ihlaya' },
  xh: { show: 'Bonisa isiqhulo', hide: 'Fihla isiqhulo' },
  st: { show: 'Bontsha motlae', hide: 'Pata motlae' },
};
const MASK_PROPS = ['image', 'position', 'size', 'repeat'];

function revealOptions() {
  try {
    const q = new URLSearchParams(location.search);
    const style = q.get('reveal');
    if (!REVEAL_STYLES.includes(style)) return null;
    const beat = Number.parseFloat(q.get('beat') ?? '');
    return {
      style,
      beatMs: Number.isFinite(beat) && beat >= 0 && beat <= 10 ? Math.round(beat * 1000) : 1000,
      replay: q.get('replay') === '1',
    };
  } catch { return null; }
}

const writeMs = (s) => Math.round(Math.min(WRITE_MAX_MS, Math.max(WRITE_MIN_MS, s.length * WRITE_MS_PER_CHAR)));

// Which jokes this phone has already shown: a short hash of each, the newest few hundred.
function jokeHash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}
function seenJokes() {
  try { const v = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function rememberJoke(s) {
  try {
    const h = jokeHash(s);
    const list = seenJokes().filter((x) => x !== h);
    list.push(h);
    localStorage.setItem(SEEN_KEY, JSON.stringify(list.slice(-SEEN_CAP)));
  } catch { /* private mode: every joke is new, which is the safe side */ }
}

function initReveal({ headline, main, status, phone, onHome }, opts) {
  const body = document.body;
  const root = document.documentElement;
  const bgImg = document.getElementById('bgImg');
  const heroCard = document.getElementById('heroCard');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  body.classList.add('d-reveal', `d-reveal-${opts.style}`);

  // The joke's dark, apart from its words, so the two can arrive on their own clocks. It is placed
  // on the joke's box (place(), called from D's sync), behind the words and in front of the photograph.
  const scrim = document.createElement('div');
  scrim.id = 'dScrim';
  scrim.className = 'd-scrim';
  scrim.setAttribute('aria-hidden', 'true');
  main.prepend(scrim);
  // The control for keyboards and screen readers, read straight after the joke; a thumb uses the photograph.
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.id = 'dJokeToggle';
  toggle.className = 'd-joke-toggle';
  toggle.setAttribute('aria-controls', 'headline');
  toggle.hidden = true;
  headline.insertAdjacentElement('afterend', toggle);

  let joke = null;        // the words on screen as the joke; '' while the caption holds a status line
  let state = 'idle';     // idle · pending (the beat) · writing · shown · hidden (tapped away)
  let token = 0;          // every change bumps it; a stale wait or stroke sees it and stops
  let raf = 0;
  let landed = '';        // the photograph last seen landing on screen, and when
  let landedAt = 0;
  const marks = [];       // for the proof videos: when each photograph landed, each joke began and ended
  const mark = (what) => { marks.push({ what, at: Math.round(performance.now()), joke }); if (marks.length > 200) marks.shift(); };
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- the dark follows the joke's box ----------
  let placed = '';
  const place = () => {
    if (!phone() || !onHome()) return;
    const r = headline.getBoundingClientRect();
    const cs = getComputedStyle(headline);
    const high = body.classList.contains('d-joke-high');
    // Risen, the joke's dark starts inside the title card's fade, so the two meet without a seam.
    const ext = high ? parseFloat(getComputedStyle(status() || body).paddingBottom) || 0 : 0;
    // The keyboard's pill sits in the open photograph: under the title card with the joke at the foot,
    // above the credit line with it risen — never on the words or the facts.
    const open = high
      ? [r.bottom - parseFloat(cs.paddingBottom), document.getElementById('dLine')?.getBoundingClientRect().top ?? innerHeight]
      : [status()?.getBoundingClientRect().bottom ?? 0, r.top + parseFloat(cs.paddingTop)];
    const g = [r.left, r.top - ext, r.width, r.height + ext, (open[0] + open[1]) / 2].map(Math.round);
    if (g.join() === placed) return;
    placed = g.join();
    Object.assign(scrim.style, { left: `${g[0]}px`, top: `${g[1]}px`, width: `${g[2]}px`, height: `${g[3]}px` });
    toggle.style.setProperty('--d-toggle-top', `${g[4]}px`);
  };

  // ---------- on and off ----------
  // The words by opacity (never visibility or display: the page keeps them for a screen reader), the
  // dark by its own class, and the credit line's soft top edge while the joke is away (CSS).
  function paint(on, wordsMs, darkMs = wordsMs) {
    headline.style.transition = wordsMs ? `opacity ${wordsMs}ms ease` : 'none';
    headline.style.opacity = on ? '1' : '0';
    scrim.style.transition = darkMs ? `opacity ${darkMs}ms ease-out` : 'none';
    main.classList.toggle('d-joke-now', !darkMs);
    scrim.classList.toggle('is-on', on);
    main.classList.toggle('d-joke-off', !on);
    if (!darkMs) {
      getComputedStyle(scrim).opacity;                   // commit the jump before transitions return
      requestAnimationFrame(() => main.classList.remove('d-joke-now'));
    }
  }
  const clearMask = () => { for (const p of MASK_PROPS) { headline.style.removeProperty(`-webkit-mask-${p}`); headline.style.removeProperty(`mask-${p}`); } };
  function setMask(layers) {
    const L = layers.length ? layers : [{ img: 'linear-gradient(transparent, transparent)', x: 0, y: 0, w: 1, h: 1 }];
    const v = {
      image: L.map((l) => l.img).join(', '),
      position: L.map((l) => `${l.x.toFixed(1)}px ${l.y.toFixed(1)}px`).join(', '),
      size: L.map((l) => `${Math.max(1, l.w).toFixed(1)}px ${Math.max(1, l.h).toFixed(1)}px`).join(', '),
      repeat: 'no-repeat',
    };
    for (const p of MASK_PROPS) { headline.style.setProperty(`-webkit-mask-${p}`, v[p]); headline.style.setProperty(`mask-${p}`, v[p]); }
  }

  // ---------- where the words are ----------
  // Each word's box, grouped into the lines the browser broke; a line owns the band halfway to its
  // neighbours (so ink on one line never shows the next), a word the span halfway to its neighbours.
  const boxKey = () => { const b = headline.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map(Math.round).join() + getComputedStyle(headline).fontSize; };
  function geometry() {
    const node = headline.firstChild;
    if (!node || node.nodeType !== Node.TEXT_NODE || headline.childNodes.length !== 1) return null;
    const box = headline.getBoundingClientRect();
    const s = node.textContent;
    const range = document.createRange();
    const lines = [];
    for (const m of s.matchAll(/\S+/g)) {
      range.setStart(node, m.index);
      range.setEnd(node, m.index + m[0].length);
      for (const r of range.getClientRects()) {
        if (r.width < 0.5 || r.height < 0.5) continue;
        const p = { at: m.index, left: r.left - box.left, right: r.right - box.left, top: r.top - box.top, bottom: r.bottom - box.top };
        const mid = (p.top + p.bottom) / 2;
        let l = lines.find((x) => Math.abs(x.mid - mid) < (p.bottom - p.top) / 2);
        if (!l) { l = { mid, top: p.top, bottom: p.bottom, pieces: [] }; lines.push(l); }
        l.pieces.push(p);
        l.top = Math.min(l.top, p.top);
        l.bottom = Math.max(l.bottom, p.bottom);
      }
    }
    if (!lines.length) return null;
    lines.sort((a, b) => a.mid - b.mid);
    lines.forEach((l, i) => {
      l.pieces.sort((a, b) => a.left - b.left);
      l.left = l.pieces[0].left;
      l.right = l.pieces[l.pieces.length - 1].right;
      l.y0 = i ? (lines[i - 1].mid + l.mid) / 2 : l.top - INK_BLEED;
      l.y1 = i < lines.length - 1 ? (l.mid + lines[i + 1].mid) / 2 : l.bottom + INK_BLEED;
      l.pieces.forEach((p, j) => {
        p.x0 = j ? (l.pieces[j - 1].right + p.left) / 2 : p.left - INK_BLEED;
        p.x1 = j < l.pieces.length - 1 ? (p.right + l.pieces[j + 1].left) / 2 : p.right + INK_BLEED;
      });
    });
    return { lines, len: s.length, key: boxKey() };
  }
  // ink: one pen, one pace, line after line; each line's share of the time is its width.
  function inkLayers(g, t, ms) {
    const spans = g.lines.map((l) => l.right - l.left + INK_EDGE);
    let s = (t / ms) * spans.reduce((a, b) => a + b, 0);
    const out = [];
    for (let i = 0; i < g.lines.length && s > 0; i++) {
      const l = g.lines[i];
      const layer = { x: l.left - INK_BLEED, y: l.y0, w: l.right - l.left + 2 * INK_BLEED, h: l.y1 - l.y0 };
      const pen = INK_BLEED + s;
      layer.img = s >= spans[i] ? 'linear-gradient(#000, #000)'
        : `linear-gradient(to right, #000 ${(pen - INK_EDGE).toFixed(1)}px, rgba(0, 0, 0, 0) ${pen.toFixed(1)}px)`;
      out.push(layer);
      s -= spans[i];
    }
    return out;
  }
  // word: each word fades up on its own, starting where the pen would have reached it.
  function wordLayers(g, t, ms) {
    const span = Math.max(1, ms - WORD_FADE_MS);
    const out = [];
    for (const l of g.lines) {
      for (const p of l.pieces) {
        const a = Math.min(1, Math.max(0, (t - (p.at / Math.max(1, g.len)) * span) / WORD_FADE_MS));
        if (a <= 0) continue;
        const e = (1 - (1 - a) ** 3).toFixed(3);
        out.push({ img: `linear-gradient(rgba(0, 0, 0, ${e}), rgba(0, 0, 0, ${e}))`, x: p.x0, y: l.y0, w: p.x1 - p.x0, h: l.y1 - l.y0 });
      }
    }
    return out;
  }

  // ---------- the photograph, actually on screen ----------
  const abs = (u) => { try { return new URL(u, document.baseURI).href; } catch { return u || ''; } };
  const heroSrc = () => /url\(["']?([^"')]+)["']?\)/.exec(root.style.getPropertyValue('--hero-url'))?.[1] || '';
  // The picture the picker loaded is the one the frame paints, the splash has gone, D's stylesheet is
  // in, Home is showing, the page is in front and the panel is down. Returns that picture, or ''.
  function onScreen() {
    if (!phone() || !onHome() || document.hidden || body.classList.contains('d-sheet-open')) return '';
    const splash = document.getElementById('pwSplash');
    if (splash && parseFloat(getComputedStyle(splash).opacity) > 0.05) return '';
    if (getComputedStyle(scrim).position !== 'fixed') return '';
    if (!bgImg?.complete || !bgImg.naturalWidth) return '';
    const src = abs(bgImg.currentSrc || bgImg.src);
    return abs(heroSrc()) === src ? src : '';
  }
  // Setup, beat: waits for the photograph, then the beat counted from its landing. Anything that takes
  // the photograph away (another screen, the panel up, the app in the background) starts it over.
  async function arrive(my) {
    for (;;) {
      const src = onScreen();
      if (!src) { landed = ''; await sleep(80); if (my !== token) return; continue; }
      if (src !== landed) {
        try { await bgImg.decode(); } catch { /* decoded for the frame or not, the load is done */ }
        await frame();
        await frame();
        if (my !== token) return;
        if (onScreen() !== src) continue;
        landed = src;
        landedAt = performance.now();
        mark('photo');
      }
      const left = landedAt + opts.beatMs - performance.now();
      if (left > 0) { await sleep(Math.min(left, 100)); if (my !== token) return; continue; }
      // The hand has to be in before the pen moves, or the line re-flows mid-stroke (0.7 s at most).
      const cs = getComputedStyle(headline);
      await Promise.race([document.fonts?.load?.(`${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, joke), sleep(700)]).catch(() => {});
      if (my !== token) return;
      if (onScreen() !== landed) continue;
      write(my);
      return;
    }
  }

  // ---------- punchline ----------
  function write(my) {
    state = 'writing';
    rememberJoke(joke);
    mark('write');
    labels();
    // The dark first; the words follow on it.
    scrim.style.transition = `opacity ${SCRIM_MS}ms ease-out`;
    scrim.classList.add('is-on');
    main.classList.remove('d-joke-off');
    if (opts.style === 'fade') {
      headline.style.transition = `opacity ${FADE_MS}ms ease-out`;
      headline.style.opacity = '1';
      setTimeout(() => { if (my === token && state === 'writing') done(); }, FADE_MS);
      return;
    }
    const g = geometry();
    if (!g) { paint(true, FADE_MS, SCRIM_MS); setTimeout(() => { if (my === token && state === 'writing') done(); }, FADE_MS); return; }
    setMask([]);
    headline.style.transition = 'none';
    headline.style.opacity = '1';
    // The whole write, pen-down included, stays inside writeMs (1.6 s at most).
    const ms = writeMs(joke) - PEN_DOWN_MS;
    const t0 = performance.now() + PEN_DOWN_MS;
    const step = () => {
      if (my !== token || state !== 'writing') return;
      if (boxKey() !== g.key) return done();       // the layout moved under the pen: the rest lands at once
      const t = performance.now() - t0;
      if (t >= ms) return done();
      setMask(t <= 0 ? [] : opts.style === 'ink' ? inkLayers(g, t, ms) : wordLayers(g, t, ms));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  function done() {
    cancelAnimationFrame(raf);
    clearMask();
    headline.style.transition = '';
    headline.style.opacity = '1';
    state = 'shown';
    mark('shown');
    labels();
  }

  // ---------- a new line on the caption ----------
  function onChange() {
    const next = headline.dataset.line === 'joke' ? headline.textContent.trim() : '';
    if (next === joke) return;
    joke = next;
    token += 1;
    cancelAnimationFrame(raf);
    clearMask();
    if (!joke) { state = 'idle'; paint(true, 0); labels(); return; }       // loading, error: as they are
    // Wider than a phone, D keeps today's polaroid and there is no photograph for the joke to wait on.
    if (!phone()) { state = 'shown'; paint(true, 0); labels(); return; }
    if (reduce.matches || (!opts.replay && seenJokes().includes(jokeHash(joke)))) {
      rememberJoke(joke);
      state = 'shown';
      paint(true, 0);
      mark('there');
      labels();
      return;
    }
    state = 'pending';
    paint(false, 0);
    labels();
    arrive(token);
  }
  // Runs before the browser paints the new words, so a new joke never flashes before its beat.
  new MutationObserver(onChange).observe(headline, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['data-line'] });

  // ---------- the tap, and the button ----------
  function flip() {
    if (state === 'idle') return;
    if (state === 'pending') { token += 1; mark('tap'); write(token); return; }   // asked for: no more beat
    token += 1;
    const my = token;
    cancelAnimationFrame(raf);
    const ms = reduce.matches ? 0 : TOGGLE_MS;
    if (state === 'hidden') {
      clearMask();
      state = 'shown';
      paint(true, ms);
      mark('show');
    } else {
      // A stroke cut short fades out as it stood, and is whole when it comes back.
      state = 'hidden';
      paint(false, ms);
      mark('hide');
      setTimeout(() => { if (my === token) clearMask(); }, ms);
    }
    labels();
  }
  function labels() {
    const L = JOKE_LABELS[(root.lang || 'en').slice(0, 2)] || JOKE_LABELS.en;
    const word = state === 'pending' || state === 'hidden' ? L.show : L.hide;
    if (toggle.textContent !== word) toggle.textContent = word;
    toggle.hidden = state === 'idle';
  }
  new MutationObserver(labels).observe(root, { attributes: true, attributeFilter: ['lang'] });
  // A window widened past a phone mid-wait (or tapped away) shows the joke as the polaroid has it.
  matchMedia('(max-width: 768px)').addEventListener?.('change', () => {
    if (phone() || !joke || state === 'shown') return;
    token += 1;
    cancelAnimationFrame(raf);
    clearMask();
    state = 'shown';
    paint(true, 0);
    labels();
  });
  heroCard?.addEventListener('click', () => { if (phone() && onHome()) flip(); });
  toggle.addEventListener('click', flip);

  onChange();
  return {
    place,
    api: { style: opts.style, beatMs: opts.beatMs, replay: opts.replay, marks, state: () => state, flip, writeMs },
  };
}

// The postcard's facts, read off the screen in its language: place, temperature, "Probably", condition.
const POSTCARD_FACTS = ['#location', '#temp .hero-now', '#temp .hero-probably', '#description'];

// Lines for a canvas, broken like CSS text-wrap: balance — the fewest lines at the width, then the
// narrowest width that keeps that many, so the last line is not a lonely word.
function wrapLines(ctx, s, max) {
  const out = [];
  let cur = '';
  for (const w of s.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && ctx.measureText(next).width > max) { out.push(cur); cur = w; } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}
function balanceLines(ctx, s, max) {
  const n = wrapLines(ctx, s, max).length;
  if (n < 2) return wrapLines(ctx, s, max);
  let lo = max * 0.4;
  let hi = max;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (wrapLines(ctx, s, mid).length > n) lo = mid; else hi = mid;
  }
  return wrapLines(ctx, s, hi);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function fade(ctx, top, bottom, stops, width) {
  if (!(bottom > top)) return;
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  stops.forEach(([at, a]) => g.addColorStop(Math.min(1, Math.max(0, at)), `rgba(0, 0, 0, ${a})`));
  ctx.fillStyle = g;
  ctx.fillRect(0, top, width, bottom - top);
}

// Every character under `el`, drawn at the box the browser laid it out in — its own font,
// colour, opacity and first text-shadow — and centred in that box, so tracking, tabular figures
// (the page sets tabular-nums; a canvas cannot) and every line break come out where the screen
// has them.
function drawText(ctx, el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const s = n.textContent;
    const host = n.parentElement;
    if (!s.trim() || !host || !host.getClientRects().length) continue;
    if (host.closest('button, .language-picker')) continue;
    const st = getComputedStyle(host);
    if (st.visibility === 'hidden') continue;
    let alpha = 1;
    for (let a = host; a && a !== document.body; a = a.parentElement) alpha *= parseFloat(getComputedStyle(a).opacity) || 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `${st.fontStyle} ${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
    ctx.fillStyle = st.color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const shadow = /^(rgba?\([^)]*\)|#[0-9a-f]{3,8})\s+(-?[\d.]+)px\s+(-?[\d.]+)px(?:\s+([\d.]+)px)?/i.exec(st.textShadow || '');
    if (shadow) {
      ctx.shadowColor = shadow[1];
      ctx.shadowOffsetX = parseFloat(shadow[2]);
      ctx.shadowOffsetY = parseFloat(shadow[3]);
      ctx.shadowBlur = parseFloat(shadow[4] || '0');
    }
    for (let i = 0; i < s.length;) {
      const len = s.codePointAt(i) > 0xffff ? 2 : 1;      // never split a surrogate pair
      const ch = s.slice(i, i + len);
      range.setStart(n, i);
      range.setEnd(n, i + len);
      i += len;
      const r = range.getClientRects()[0];
      if (!r || !r.width || !ch.trim()) continue;
      ctx.fillText(ch, r.left + (r.width - ctx.measureText(ch).width) / 2, r.top + r.height / 2);
    }
    ctx.restore();
  }
}

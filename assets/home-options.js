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
  // Everything the picture draws, including where it sits: the photograph and its crop, every
  // line of text and its box, the joke's size and whether it has risen, the warning bar (Sol,
  // 24 Sept: a signature of the words alone let a picture of an older layout through).
  const signature = () => {
    const photo = getComputedStyle($('#heroPhoto') || body);
    const box = (sel) => { const el = $(sel); if (!el || !el.getClientRects().length) return '-'; const r = el.getBoundingClientRect(); return `${Math.round(r.top)},${Math.round(r.height)}`; };
    return [photo.backgroundImage, photo.backgroundPosition, innerWidth, innerHeight,
      body.classList.contains('d-joke-high'), headline.style.fontSize,
      ...['.brand-text', '.tagline', '#weatherStatus', '#headline', '#dLine', '#capeWindBanner'].map((s) => `${text(s)}@${box(s)}`),
    ].join('|');
  };
  function prepareShare() {
    clearTimeout(shareTimer);
    shareTimer = setTimeout(async () => {
      if (!phone() || !onHome() || document.hidden) return;
      const sig = signature();
      if (sig === shareSig && shareFile) return;
      try {
        const blob = await drawFrame();
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
      const blob = await drawFrame();
      return blob ? new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); }) : null;
    },
    open: () => setOpen(true),
    close: () => setOpen(false),
    syncs: () => syncs,
  };

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

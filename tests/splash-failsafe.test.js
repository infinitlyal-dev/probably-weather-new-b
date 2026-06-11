// HIGH-2 + G4 — the splash must clear even if app.js init throws or never
// reaches a render, AND a genuinely dead boot (app.js 404 / parse fail) must
// surface an honest error + reload instead of a silent forever-"Loading…"
// shell. Failsafe layers:
//   1. CSS-only auto-hide keyframe on #pwSplash (no JS).
//   2. index.html inline window error(bubble+capture) + load handlers, which
//      also show the boot-error state for a dead boot.
//   3. app.js in-handler window 'error' guard + __PW_ALIVE/__PW_FIRST_RENDER.
//
// The error/dead-boot paths are exercised behaviourally: the inline IIFE is
// extracted from index.html and run against a hand-rolled fake DOM.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const appSrc = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');

describe('splash failsafe — layer 1: CSS-only auto-hide + boot-error styles', () => {
  it('#pwSplash has a JS-independent failsafe animation', () => {
    expect(html).toMatch(/#pwSplash\s*{[\s\S]*animation:\s*pwSplashFailsafe/);
  });
  it('the failsafe keyframe hides the splash (opacity + visibility + pointer-events)', () => {
    const kf = html.match(/@keyframes pwSplashFailsafe\s*{([\s\S]*?)}/);
    expect(kf, 'pwSplashFailsafe keyframe present').toBeTruthy();
    expect(kf[1]).toMatch(/opacity:\s*0/);
    expect(kf[1]).toMatch(/visibility:\s*hidden/);
    expect(kf[1]).toMatch(/pointer-events:\s*none/);
  });
  it('the failsafe is NOT disabled by prefers-reduced-motion', () => {
    const idx = html.indexOf('@media (prefers-reduced-motion: reduce)');
    expect(idx, 'reduced-motion block present').toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 400);
    expect(block).not.toMatch(/#pwSplash\b/);
  });
  it('#pwBootError is hidden by default and sits above the splash', () => {
    expect(html).toMatch(/#pwBootError\s*{[\s\S]*display:\s*none/);
    expect(html).toMatch(/#pwBootError\.visible\s*{\s*display:\s*flex/);
  });
});

describe('splash failsafe — layer 3: app.js liveness signals', () => {
  it('app.js sets __PW_ALIVE at init and __PW_FIRST_RENDER on render', () => {
    expect(appSrc).toMatch(/window\.__PW_ALIVE\s*=\s*true/);
    expect(appSrc).toMatch(/window\.__PW_FIRST_RENDER\s*=\s*true/);
  });
  it("app.js registers a window 'error' handler that adds splash-done", () => {
    expect(appSrc).toMatch(/addEventListener\('error'[\s\S]*?pwSplash[\s\S]*?splash-done/);
  });
});

// ---------------------------------------------------------------------------
// Layer 2 — behavioural fake DOM.
// ---------------------------------------------------------------------------
function fakeEl(tag) {
  const classes = new Set();
  return {
    tagName: (tag || '').toUpperCase(),
    id: '', className: '', type: '', textContent: '',
    children: [], attrs: {}, listeners: {},
    classList: { add: (c) => classes.add(c), contains: (c) => classes.has(c) },
    setAttribute(k, v) { this.attrs[k] = v; },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); },
  };
}

function makeFakeEnv(opts = {}) {
  const splash = fakeEl('div');
  const appended = [];
  const errorListeners = [];
  const loadListeners = [];
  const timers = [];
  const win = {
    __PW_ALIVE: opts.alive ?? false,
    __PW_FIRST_RENDER: opts.rendered ?? false,
    location: { reloaded: 0, reload() { this.reloaded += 1; } },
    addEventListener(type, fn) {
      if (type === 'error') errorListeners.push(fn);
      else if (type === 'load') loadListeners.push(fn);
    },
    setTimeout(fn) { timers.push(fn); return timers.length; },
  };
  const doc = {
    getElementById: (id) => (id === 'pwSplash' ? splash : null),
    createElement: (tag) => fakeEl(tag),
    body: { appendChild: (el) => appended.push(el) },
  };
  return {
    splash, appended, win, doc,
    dispatchError: (evt) => errorListeners.forEach((fn) => fn(evt)),
    fireLoadAndGrace: () => { loadListeners.forEach((fn) => fn()); timers.forEach((fn) => fn()); },
    bootError: () => appended.find((el) => el.id === 'pwBootError'),
  };
}

function runInlineFailsafe(env) {
  const m = html.match(/<script>\s*(\/\/ Splash failsafe \(HIGH-2\)[\s\S]*?)<\/script>/);
  expect(m, 'inline failsafe script found').toBeTruthy();
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', 'setTimeout', m[1])(env.win, env.doc, env.win.setTimeout.bind(env.win));
}

const splashCleared = (env) => env.splash.classList.contains('splash-done');
const bootShown = (env) => { const b = env.bootError(); return !!b && b.classList.contains('visible'); };

describe('splash failsafe — layer 2: error / dead-boot behaviour', () => {
  it('init error BEFORE first render → clears splash AND shows boot error', () => {
    const env = makeFakeEnv({ rendered: false });
    runInlineFailsafe(env);
    env.dispatchError({ message: 'init exploded', error: new Error('boom') });
    expect(splashCleared(env)).toBe(true);
    expect(bootShown(env)).toBe(true);
  });

  it('error AFTER first render → clears splash, NO boot error (app already rendered)', () => {
    const env = makeFakeEnv({ rendered: true });
    runInlineFailsafe(env);
    env.dispatchError({ message: 'late non-fatal error' });
    expect(splashCleared(env)).toBe(true);
    expect(bootShown(env)).toBe(false);
  });

  it('a bg-image 404 neither clears the splash nor shows a boot error', () => {
    const env = makeFakeEnv();
    runInlineFailsafe(env);
    env.dispatchError({ target: { tagName: 'IMG', src: 'https://x/bg.jpg' } });
    expect(splashCleared(env)).toBe(false);
    expect(bootShown(env)).toBe(false);
  });

  it('an app.js 404 (capture-phase resource error) shows the boot error', () => {
    const env = makeFakeEnv();
    runInlineFailsafe(env);
    env.dispatchError({ target: { tagName: 'SCRIPT', src: 'https://probablyweather.co.za/assets/app.js' } });
    expect(bootShown(env)).toBe(true);
  });

  it('dead boot: load+grace with app.js never alive → clears splash + boot error', () => {
    const env = makeFakeEnv({ alive: false });
    runInlineFailsafe(env);
    env.fireLoadAndGrace();
    expect(splashCleared(env)).toBe(true);
    expect(bootShown(env)).toBe(true);
  });

  it('slow-but-alive: load+grace with __PW_ALIVE set → clears splash, NO boot error', () => {
    const env = makeFakeEnv({ alive: true });
    runInlineFailsafe(env);
    env.fireLoadAndGrace();
    expect(splashCleared(env)).toBe(true);
    expect(bootShown(env)).toBe(false);
  });

  it('the boot error offers a working reload action in five languages', () => {
    const env = makeFakeEnv({ alive: false });
    runInlineFailsafe(env);
    env.fireLoadAndGrace();
    const box = env.bootError();
    expect(box).toBeTruthy();
    const msg = box.children.find((c) => c.children.length === 5); // 5 language lines
    expect(msg, 'five language lines').toBeTruthy();
    expect(msg.children[0].textContent).toMatch(/Couldn't load/i);
    const btn = box.children.find((c) => c.tagName === 'BUTTON');
    expect(btn).toBeTruthy();
    btn.listeners.click.forEach((fn) => fn());
    expect(env.win.location.reloaded).toBe(1);
  });
});

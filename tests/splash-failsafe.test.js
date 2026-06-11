// HIGH-2 — the splash must be guaranteed to clear even if app.js init throws
// or never reaches a render. Three independent failsafes:
//   1. CSS-only auto-hide keyframe on #pwSplash (no JS).
//   2. index.html inline window 'error' + 'load' handlers.
//   3. app.js in-handler window 'error' guard.
//
// The throw path is exercised behaviourally: the inline IIFE is extracted from
// index.html and run against a hand-rolled fake window/document, then an
// 'error' event is dispatched and we assert the splash got '.splash-done'.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const appSrc = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');

describe('splash failsafe — layer 1: CSS-only auto-hide', () => {
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
    // The reduced-motion block only quiets the decorative child animations
    // (.pw-splash-logo / .pw-splash-lines span) — it must NOT reference
    // #pwSplash, so the failsafe animation always fires.
    const block = html.slice(idx, idx + 400);
    expect(block).not.toMatch(/#pwSplash\b/);
  });
});

describe('splash failsafe — layer 3: app.js in-handler guard', () => {
  it("app.js registers a window 'error' handler that adds splash-done", () => {
    expect(appSrc).toMatch(/addEventListener\('error'[\s\S]*?pwSplash[\s\S]*?splash-done/);
  });
});

// ---------------------------------------------------------------------------
// Layer 2 — behavioural: run the inline failsafe IIFE against a fake DOM and
// drive the throw + hang paths.
// ---------------------------------------------------------------------------
function makeFakeEnv() {
  const splash = {
    classes: new Set(),
    classList: {
      add(c) { splash.classes.add(c); },
      contains(c) { return splash.classes.has(c); },
    },
  };
  const listeners = {};
  const timers = [];
  const win = {
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    setTimeout(fn, ms) { timers.push({ fn, ms }); return timers.length; },
  };
  const doc = { getElementById: (id) => (id === 'pwSplash' ? splash : null) };
  return { splash, listeners, timers, win, doc };
}

function extractInlineFailsafe() {
  // The failsafe IIFE is the <script> immediately after the #pwSplash markup.
  const m = html.match(/<\/div>\s*<script>\s*([\s\S]*?kill[\s\S]*?)<\/script>/);
  expect(m, 'inline failsafe script found after splash markup').toBeTruthy();
  return m[1];
}

function runInlineFailsafe(env) {
  const body = extractInlineFailsafe();
  // Provide window/document/setTimeout as locals so the IIFE binds to the fakes.
  // eslint-disable-next-line no-new-func
  const fn = new Function('window', 'document', 'setTimeout', body);
  fn(env.win, env.doc, env.win.setTimeout.bind(env.win));
}

describe('splash failsafe — layer 2: inline window error/load (the throw path)', () => {
  it('an uncaught script error clears the splash', () => {
    const env = makeFakeEnv();
    runInlineFailsafe(env);
    expect(env.splash.classList.contains('splash-done')).toBe(false);
    // Simulate app.js init throwing → window 'error' with a message.
    env.listeners.error.forEach((fn) => fn({ message: 'init exploded', error: new Error('boom') }));
    expect(env.splash.classList.contains('splash-done')).toBe(true);
  });

  it('a resource-load error (no message/error) does NOT prematurely clear the splash', () => {
    const env = makeFakeEnv();
    runInlineFailsafe(env);
    // A bg-image 404 fires window 'error' as a bare Event with no .message/.error.
    env.listeners.error.forEach((fn) => fn({ target: { tagName: 'IMG' } }));
    expect(env.splash.classList.contains('splash-done')).toBe(false);
  });

  it('a silent hang clears the splash via load + grace timer', () => {
    const env = makeFakeEnv();
    runInlineFailsafe(env);
    env.listeners.load.forEach((fn) => fn());
    expect(env.splash.classList.contains('splash-done')).toBe(false); // not yet — grace pending
    expect(env.timers.length).toBe(1);
    env.timers[0].fn(); // fire the grace timer
    expect(env.splash.classList.contains('splash-done')).toBe(true);
  });
});

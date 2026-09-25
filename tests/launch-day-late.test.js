// Launch run (2026-09-25), Al's ticked list "day-late": late at night, today's day screen showed
// one row and an empty screen. Below six rows it now carries on through tomorrow morning.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const js = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
const sliceFn = (name) => {
  const start = js.indexOf(`function ${name}(`);
  expect(start, `${name} missing`).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = js.indexOf('{', start); i < js.length; i++) {
    if (js[i] === '{') depth++;
    else if (js[i] === '}' && --depth === 0) return js.slice(start, i + 1);
  }
  throw new Error(`unbalanced ${name}`);
};

describe('day-late: today\'s detail carries on into tomorrow morning when fewer than six hours are left', () => {
  const run = (localHour, hours = 48) => {
    const calls = [];
    const content = { innerHTML: '', children: [], appendChild(n) { this.children.push(n); } };
    const renderDayDetail = new Function('deps', `with (deps) { ${sliceFn('renderDayDetail')}\nreturn renderDayDetail; }`)({
      $: (sel) => (sel === '#day-detail-content' ? content : null),
      document: { createElement: () => ({}) },
      renderDayDetailHourly: (_, rows, start, opts) => calls.push({ rows: rows.length, start, header: opts?.header }),
      renderDayDetailSummary: () => {}, getTranslatedDayName: () => 'Sat', dayConditionLabel: () => 'Clear',
      formatTemp: (c) => `${c}°`, isNum: (v) => typeof v === 'number', debugLog: () => {}, openDayDetailIndex: null,
    });
    renderDayDetail({ localHour, utcOffsetSeconds: 7200, daily: [{ highC: 20, lowC: 10 }], hourly: Array.from({ length: hours }, (_, i) => ({ i })) }, 0);
    return { calls, divider: content.children[0] };
  };
  it('23:00 — one row tonight, then tomorrow 00:00–06:00 under a divider with no second header', () => {
    const { calls, divider } = run(23);
    expect(calls).toEqual([{ rows: 1, start: 23, header: undefined }, { rows: 7, start: 0, header: false }]);
    expect(divider.className).toBe('hourly-row hourly-divider');
    expect(divider.textContent).toMatch(/^Sat \d{2}\/\d{2}$/);
  });
  it('18:00 — six rows left, nothing added', () => {
    expect(run(18).calls).toEqual([{ rows: 6, start: 18, header: undefined }]);
  });
  it('no hours for tomorrow in the payload — no divider over nothing', () => {
    const { calls, divider } = run(23, 24);
    expect(calls).toHaveLength(1);
    expect(divider).toBeUndefined();
  });
});

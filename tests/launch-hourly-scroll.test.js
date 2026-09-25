// Launch run (2026-09-25), Al's ticked list "hourly-scroll": Hourly scrolls as one page (the table
// was a box cut mid-row), headers lined up with their columns. Measured in a browser by
// review/launch/scripts/ui-probe.mjs (review/launch/results/ui-after.json); this pins the rules.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../assets/app.css', import.meta.url), 'utf8');
const launch = css.slice(css.indexOf('/* ========== LAUNCH RUN (2026-09-25)'));

describe('hourly-scroll', () => {
  it('on a phone the table is not a scroller of its own, and the ad card starts after the last row', () => {
    expect(launch).toMatch(/@media \(max-width: 1023px\) \{[^@]*#hourly-screen \.hourly-timeline,\s*#day-detail-screen #day-detail-content \{ overflow: visible !important; flex: none !important; \}/);
    expect(launch).toContain('#day-detail-screen > .screen-panel-body { flex-shrink: 0 !important; }');
  });
  it('every header cell one size; on a phone the header and the rows share the same columns', () => {
    expect(launch).toContain('.daily-row.daily-header > span { font-size: 0.7rem; }');
    const tracks = (sel) => {
      const m = new RegExp(`${sel} \\.hourly-row \\{ grid-template-columns: ([^;]+); \\}`).exec(launch);
      expect(m, sel).not.toBeNull();
      return m[1].match(/minmax\([^)]*\)|\d+px/g).length;
    };
    expect(tracks('#hourly-screen')).toBe(8);
    expect(tracks('#day-detail-screen')).toBe(7);
  });
});

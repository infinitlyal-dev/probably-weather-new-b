import { describe, expect, it } from 'vitest';
import { parseRobots, robotsAllows, paragraphs, Counts, WEB_SOURCES } from '../scripts/lang-check/lib/web-ngrams.mjs';

// The corpus harvest's manners and its one promise (9 Oct 2026): robots.txt is obeyed for the `*` group, and only counts
// are kept — never a passage.
describe('robots.txt — the * group', () => {
  const txt = 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /_next/static/\nDisallow: /_next/\nDisallow: /search?q=*\nAllow: /\n';
  const rules = parseRobots(txt);
  it('reads only the * group (a bot-specific Disallow / does not apply to us)', () => {
    expect(rules).toHaveLength(4);
    expect(robotsAllows(rules, '/izindaba/2026-10-09-article/')).toBe(true);
  });
  it('the longest matching rule wins; Allow beats Disallow on a tie', () => {
    expect(robotsAllows(rules, '/_next/data/x.json')).toBe(false);
    expect(robotsAllows(rules, '/_next/static/a.js')).toBe(true);
    expect(robotsAllows(parseRobots('User-agent: *\nDisallow: /a\nAllow: /a\n'), '/a')).toBe(true);
  });
  it('wildcards and end anchors', () => {
    expect(robotsAllows(rules, '/search?q=rain')).toBe(false);
    expect(robotsAllows(parseRobots('User-agent: *\nDisallow: /*.pdf$\n'), '/doc.pdf')).toBe(false);
    expect(robotsAllows(parseRobots('User-agent: *\nDisallow: /*.pdf$\n'), '/doc.pdf.html')).toBe(true);
  });
  it('Disallow: / for * refuses everything (PanSALB)', () => {
    expect(robotsAllows(parseRobots('User-agent: *\nDisallow: /\n'), '/any/page')).toBe(false);
  });
  it('the refused and unreachable sources are listed and fetch nothing', () => {
    for (const s of WEB_SOURCES.filter((x) => x.refused || x.unreachable)) expect(s.max).toBe(0);
    expect(WEB_SOURCES.find((s) => s.id === 'pansalb').refused).toMatch(/Disallow/);
  });
});

describe('page text → counts only', () => {
  it('takes paragraph text, drops scripts, navigation and short scraps', () => {
    const html = '<nav><p>Home News Sport and more links here for everyone</p></nav><script>var p = "<p>no</p>"</script><p>Imvula iyana kakhulu namhlanje eThekwini, abantu bahlala ezindlini zabo.</p><p>Short.</p>';
    expect(paragraphs(html)).toEqual(['Imvula iyana kakhulu namhlanje eThekwini, abantu bahlala ezindlini zabo.']);
  });
  it('Counts keeps words, pairs and triples — and no text', () => {
    const c = new Counts();
    c.addText('Die reën val. Die reën val nog.', 'af');
    expect(c.uni.get('reën')).toBe(2);
    expect(c.bi.get('die reën')).toBe(2);
    expect(c.tri.get('die reën val')).toBe(2);
    expect(Object.keys(c)).toEqual(['uni', 'bi', 'tri', 'tokens']);
  });
});

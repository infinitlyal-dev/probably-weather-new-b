// Province in search results (1 Oct 2026): the display label, the renamed-place ordering on the
// server, and the dedupe that must never merge two different places that share a name.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { dedupeSearchResults, searchLabelParts, searchResultName } from '../assets/search-label.js';
import { haversineKm } from '../assets/refresh-behaviour.js';

describe('searchLabelParts: the province shows on every row', () => {
  const label = (r) => searchLabelParts(r).join(', ');

  it('a town reads "Name, Province"', () => {
    expect(label({ name: 'Witbank', type: 'town', address: { state: 'Northern Cape', city: 'Khâi-Ma Local Municipality', country: 'South Africa', country_code: 'za' } }))
      .toBe('Witbank, Northern Cape');
  });
  it('a city reads "Name, Province"', () => {
    expect(label({ name: 'eMalahleni', type: 'city', address: { state: 'Mpumalanga', city: 'eMalahleni', country: 'South Africa', country_code: 'za' } }))
      .toBe('eMalahleni, Mpumalanga');
  });
  it('a suburb names the town or city it sits in, then the province', () => {
    expect(label({ name: 'Witsand', type: 'suburb', address: { state: 'Western Cape', city: 'Atlantis', country: 'South Africa', country_code: 'za' } }))
      .toBe('Witsand, Atlantis, Western Cape');
  });
  it('a suburb whose container is a municipality skips it', () => {
    expect(label({ name: 'New Pietersburg', type: 'suburb', address: { state: 'Limpopo', city: 'Polokwane Local Municipality', country: 'South Africa', country_code: 'za' } }))
      .toBe('New Pietersburg, Limpopo');
    expect(label({ name: 'Soweto', type: 'suburb', address: { state: 'Gauteng', city: 'City of Johannesburg Metropolitan Municipality', country: 'South Africa' } }))
      .toBe('Soweto, Gauteng');
  });
  it('a town with a different "city" does not take that city (only suburbs do)', () => {
    expect(label({ name: 'Witsand', type: 'town', address: { state: 'Western Cape', city: 'George', country: 'South Africa', country_code: 'za' } }))
      .toBe('Witsand, Western Cape');
  });
  it('a suburb never repeats its own name as its container', () => {
    expect(label({ name: 'Sea Point', type: 'suburb', address: { suburb: 'Sea Point', city: 'Sea Point', state: 'Western Cape', country: 'South Africa' } }))
      .toBe('Sea Point, Western Cape');
  });
  it('falls back to province / region, then the country', () => {
    expect(label({ name: 'Somewhere', address: { province: 'Gauteng', country: 'South Africa' } })).toBe('Somewhere, Gauteng');
    expect(label({ name: 'Somewhere', address: { region: 'Limpopo', country: 'South Africa' } })).toBe('Somewhere, Limpopo');
    expect(label({ name: 'Somewhere', address: { country: 'South Africa' } })).toBe('Somewhere, South Africa');
    expect(label({ name: 'Somewhere', address: {} })).toBe('Somewhere');
  });
  it('outside South Africa the country stays', () => {
    expect(label({ name: 'Bryn Mawr', type: 'town', address: { state: 'Pennsylvania', country: 'United States', country_code: 'us' } }))
      .toBe('Bryn Mawr, Pennsylvania, United States');
    expect(label({ name: 'Moscow', type: 'city', address: { city: 'Moscow', country: 'Russia' } })).toBe('Moscow, Russia');
  });
  it("a province that is the place's own name does not repeat", () => {
    expect(label({ name: 'Gauteng', address: { state: 'Gauteng', country: 'South Africa' } })).toBe('Gauteng');
  });
});

describe('the STORED name is unchanged: "City, Country"', () => {
  it('keeps the shape favourites and recents already hold', () => {
    expect(searchResultName({ name: 'Witbank', address: { state: 'Northern Cape', country: 'South Africa' } })).toBe('Witbank, South Africa');
    expect(searchResultName({ name: '', address: { town: 'Strand' } })).toBe('Strand');
    expect(searchResultName({ name: '', address: {} })).toBe('Unknown');
  });
});

describe('dedupe never collapses two different places that share a name', () => {
  const za = { country: 'South Africa' };
  it('Witbank (Northern Cape) and Witbank (Mpumalanga) are 1,000+ km apart and both stay', () => {
    const rows = [
      { name: 'Witbank', lat: -29.0, lon: 21.5, address: { state: 'Northern Cape', ...za } },
      { name: 'Witbank', lat: -25.87, lon: 29.23, address: { state: 'Mpumalanga', ...za } },
    ];
    expect(haversineKm(rows[0], rows[1])).toBeGreaterThan(500);
    expect(dedupeSearchResults(rows, haversineKm)).toHaveLength(2);
  });
  it('still drops a same-name result within 1 km (the Bryn Mawr triplication)', () => {
    const rows = [
      { name: 'Bryn Mawr', lat: 40.02, lon: -75.31, address: { country: 'United States' } },
      { name: 'Bryn Mawr', lat: 40.021, lon: -75.311, address: { country: 'United States' } },
    ];
    expect(dedupeSearchResults(rows, haversineKm)).toHaveLength(1);
  });
});

// ---- server: renamed places ----
vi.mock('../api/_lib/provider-budget.js', async (importOriginal) => {
  const mod = await importOriginal();
  return { ...mod, consumeProviderBudgets: vi.fn(async (providers) => Object.fromEntries(providers.map((p) => [p, true]))) };
});
import geocodeHandler from '../api/geocode.js';

const rawRow = (name, lat, lon, address, type = 'town') => ({ display_name: `${name}, South Africa`, display_place: name, lat: String(lat), lon: String(lon), type, class: 'place', address });
const WITBANK_REPLY = [
  rawRow('Witbank', -29.0, 21.5, { state: 'Northern Cape', country: 'South Africa' }),
  rawRow('eMalahleni', -25.87, 29.23, { state: 'Mpumalanga', country: 'South Africa' }, 'city'),
  rawRow('Witsand', -34.4, 20.8, { state: 'Western Cape', city: 'George', country: 'South Africa' }),
];

const makeRes = () => ({
  statusCode: 200, headers: {}, body: undefined,
  setHeader(k, v) { this.headers[k] = v; },
  status(c) { this.statusCode = c; return this; },
  json(p) { this.body = p; return this; },
});
const searchBody = async (q, reply) => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => reply })));
  const res = makeRes();
  await geocodeHandler({ query: { type: 'search', q }, headers: {} }, res);
  return res.body;
};
const search = async (q, reply) => (await searchBody(q, reply)).results.map((r) => r.name);

describe("/api/geocode search: a renamed place's new name comes first", () => {
  beforeEach(() => { vi.stubEnv('LOCATIONIQ_TOKEN', 'test-token'); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it('"Witbank" puts eMalahleni first and keeps the rest in order', async () => {
    expect(await search('Witbank', WITBANK_REPLY)).toEqual(['eMalahleni', 'Witbank', 'Witsand']);
  });
  it('is case- and space-insensitive', async () => {
    expect(await search('  witBANK ', WITBANK_REPLY)).toEqual(['eMalahleni', 'Witbank', 'Witsand']);
  });
  it('"Port Elizabeth" promotes Gqeberha', async () => {
    const reply = [rawRow('Port Elizabeth', -1, 1, { state: 'Eastern Cape', country: 'South Africa' }), rawRow('Gqeberha', -33.96, 25.6, { state: 'Eastern Cape', country: 'South Africa' }, 'city')];
    expect(await search('Port Elizabeth', reply)).toEqual(['Gqeberha', 'Port Elizabeth']);
  });
  it("a query that is not an old name keeps LocationIQ's order", async () => {
    expect(await search('Wits', WITBANK_REPLY)).toEqual(['Witbank', 'eMalahleni', 'Witsand']);
    expect(await search('eMalahleni', WITBANK_REPLY)).toEqual(['Witbank', 'eMalahleni', 'Witsand']);
  });
  it('an old name whose new name was not returned adds nothing and reorders nothing', async () => {
    expect(await search('Witbank', [WITBANK_REPLY[2], WITBANK_REPLY[0]])).toEqual(['Witsand', 'Witbank']);
  });
  it('the results still carry the address the label is built from', async () => {
    const body = await searchBody('Witbank', WITBANK_REPLY);
    expect(body.results[0].address.state).toBe('Mpumalanga');
    expect(body.results[0].type).toBe('city');
  });
});

describe('/api/geocode search: curly apostrophes match too', () => {
  beforeEach(() => { vi.stubEnv('LOCATIONIQ_TOKEN', 'test-token'); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("\"King William’s Town\" promotes Qonce", async () => {
    const reply = [rawRow("King William's Town", -1, 1, { state: 'Eastern Cape', country: 'South Africa' }), rawRow('Qonce', -32.88, 27.4, { state: 'Eastern Cape', country: 'South Africa' }, 'city')];
    expect(await search('King William’s Town', reply)).toEqual(['Qonce', "King William's Town"]);
  });
});

import { isRegionTagAt } from './geo-regions.js';

// Structural context metadata for witty lines (replaces the old
// WEEKDAY_ONLY_FRAGMENTS substring blocklist and weekend-filter.js's Saturday
// special-case).
//
// Tags are keyed by BIN + ROW INDEX, not by language. The five language arrays in
// each bin are row-aligned (same English line at the same index in every
// language), so a tag on an index applies to all five languages — a translation
// inherits its English row's tag. This is enforced in ONE place: dayAwarePool(),
// used by app.js getWittyLine and api/og.js pickWitty.
//
// Context tag shape:
//   { day?: 'weekday'|'weekend'|'sun'|'mon'|'tue'|'wed'|'thu'|'fri'|'sat',
//     time?: ['morning'|'day'|'evening'|'night'],
//     region?: 'western-cape'|'gauteng'|'highveld'|'free-state'|'karoo',
//     months?: [1..12] }
//   (absent) — any context
//
// No wording is stored or changed here — this is metadata over the existing bank.

const DAY_INDEX = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const COPY_FALLBACK = { hail: 'storm', thunder: 'storm' };
const WINTER_MONTHS = [5, 6, 7, 8, 9];
const SUMMER_MONTHS = [10, 11, 12, 1, 2, 3];

export const WITTY_DAY_TAGS = {
  witty: {
    // Day-named lines — show only on the day they name.
    fog: {
      100: { time: ['morning'], region: 'kzn' },
      38: { time: ['morning'] },
      39: { time: ['morning'], region: 'western-cape' },
      40: { time: ['morning'] },
      41: { time: ['morning'], region: 'western-cape' },
      42: { time: ['morning'] },
      43: { time: ['morning'], region: 'western-cape' },
      44: { time: ['morning'] },
      45: { time: ['morning'] },
      46: { time: ['morning'], region: 'karoo' },
      47: { time: ['morning'], region: 'karoo' },
      48: { time: ['morning'], region: 'karoo' },
      49: { time: ['morning'], region: 'western-cape' },
      50: { time: ['morning'], region: 'western-cape' },
      51: { time: ['morning'] },
      52: { time: ['morning'] },
      53: { time: ['morning'] },
      54: { time: ['morning'] },
      55: { time: ['morning'], region: 'western-cape' },
      56: { time: ['morning'] },
      57: { time: ['morning'], region: 'western-cape' },
      58: { time: ['evening'], region: 'western-cape' },
      59: { time: ['evening'], region: 'western-cape' },
      60: { time: ['evening'] },
      61: { time: ['evening'] },
      62: { time: ['evening'] },
      63: { time: ['evening'] },
      64: { time: ['evening'] },
      65: { time: ['evening'], region: 'western-cape' },
      66: { time: ['evening'] },
      67: { time: ['evening'], region: 'gauteng' },
      68: { time: ['evening'] },
      69: { time: ['evening'], region: 'gauteng' },
      70: { time: ['evening'], region: 'western-cape' },
      71: { time: ['evening'] },
      72: { time: ['evening'], region: 'western-cape' },
      73: { time: ['evening'] },
      74: { time: ['evening'] },
      75: { time: ['evening'] },
      76: { time: ['evening'], region: 'western-cape' },
      77: { time: ['evening'] },
      78: { time: ['evening'] },
      79: { time: ['night'], region: 'western-cape' },
      80: { time: ['night'], region: 'western-cape' },
      81: { time: ['night'] },
      82: { time: ['night'], region: 'western-cape' },
      83: { time: ['night'], region: 'western-cape' },
      84: { time: ['night'] },
      85: { time: ['night'], region: 'western-cape' },
      86: { time: ['night'] },
      87: { time: ['night'], region: 'western-cape' },
      88: { time: ['night'] },
      89: { time: ['night'] },
      90: { time: ['night'], region: 'gauteng' },
      91: { time: ['night'], region: 'western-cape' },
      92: { time: ['night'] },
      93: { time: ['night'] },
      94: { time: ['night'], region: 'karoo' },
      95: { time: ['night'], region: 'karoo' },
      96: { time: ['night'], region: 'karoo' },
      97: { time: ['night'] },
      98: { time: ['night'] },
      99: { time: ['night'], region: 'western-cape' },
      7: { day: 'tue' }, // "Ghost town. But it's just Tuesday." (+ row-aligned af/zu/xh/st)
      9: { region: 'western-cape' },
      12: { time: ['morning'] },
      30: { region: 'western-cape' },
      37: { time: ['morning'] },
    },
    'partly-cloudy': {
      9: { region: 'gauteng' },
      12: { day: 'weekend' }, // "Almost a braai day." — braai PLAN
      16: { months: SUMMER_MONTHS },
    },
    weekend: {
      19: { day: 'sat' }, // "Saturday energy: maximum..."
      22: { time: ['morning'] },
    },
    // Work-week lines — Mon–Fri only. cloudy[9] names Monday, so it is 'mon'.
    cloudy: {
      38: { time: ['morning'] },
      39: { time: ['morning'] },
      40: { time: ['morning'] },
      41: { time: ['morning'] },
      42: { time: ['morning'] },
      43: { time: ['day'] },
      44: { time: ['day'] },
      45: { time: ['day'] },
      46: { time: ['day'] },
      47: { time: ['day'] },
      48: { time: ['day'] },
      49: { time: ['day'] },
      50: { time: ['day'] },
      51: { time: ['day'] },
      52: { time: ['day'] },
      53: { time: ['day'] },
      54: { time: ['day'] },
      55: { time: ['day'] },
      56: { day: 'weekend', time: ['day'] },
      57: { time: ['day'] },
      58: { time: ['day'] },
      59: { time: ['day'] },
      60: { time: ['day'] },
      61: { time: ['day'] },
      62: { time: ['evening'] },
      63: { time: ['evening'] },
      64: { time: ['evening'] },
      65: { time: ['evening'] },
      66: { time: ['evening'] },
      67: { time: ['evening'] },
      68: { time: ['evening'] },
      69: { time: ['evening'] },
      70: { time: ['evening'] },
      71: { time: ['evening'] },
      72: { time: ['evening'] },
      73: { time: ['evening'] },
      74: { time: ['night'] },
      75: { time: ['night'] },
      76: { time: ['night'] },
      77: { time: ['night'] },
      78: { time: ['night'] },
      79: { time: ['night'] },
      80: { time: ['night'] },
      81: { time: ['night'] },
      82: { time: ['night'] },
      83: { time: ['night'] },
      84: { time: ['night'] },
      85: { time: ['night'] },
      86: { time: ['night'] },
      87: { time: ['night'] },
      9: { day: 'mon' },
      18: { time: ['evening'] },
      22: { day: 'weekday' },
    },
    cold: {
      38: { time: ['morning'], months: [5, 6, 7, 8, 9] },
      39: { time: ['morning'] },
      40: { time: ['morning'] },
      41: { time: ['morning'], months: [5, 6, 7, 8, 9] },
      42: { time: ['morning'], region: 'highveld', months: [5, 6, 7, 8, 9] },
      43: { time: ['morning'] },
      44: { time: ['morning'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      45: { time: ['morning'], months: [5, 6, 7, 8, 9] },
      46: { time: ['morning'] },
      47: { time: ['morning'], months: [5, 6, 7, 8, 9] },
      48: { time: ['morning'] },
      49: { time: ['morning'], months: [5, 6, 7, 8, 9] },
      50: { time: ['day'], months: [5, 6, 7, 8, 9] },
      51: { time: ['day'], months: [5, 6, 7, 8, 9] },
      52: { time: ['day'], region: 'highveld', months: [5, 6, 7, 8, 9] },
      53: { time: ['day'], region: 'gauteng', months: [5, 6, 7, 8, 9] },
      54: { time: ['day'] },
      55: { time: ['day'], months: [5, 6, 7, 8, 9] },
      56: { time: ['day'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      57: { time: ['day'], region: 'western-cape' },
      58: { time: ['day'], months: [5, 6, 7, 8, 9] },
      59: { time: ['day'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      60: { time: ['day'], months: [5, 6, 7, 8, 9] },
      61: { time: ['day'], months: [5, 6, 7, 8, 9] },
      62: { time: ['day'], months: [5, 6, 7, 8, 9] },
      63: { time: ['day'], months: [5, 6, 7, 8, 9] },
      64: { time: ['day'] },
      65: { time: ['day'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      66: { time: ['day'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      67: { time: ['day'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      68: { time: ['day'], months: [5, 6, 7, 8, 9] },
      69: { time: ['day'], months: [5, 6, 7, 8, 9] },
      70: { time: ['day'], months: [5, 6, 7, 8, 9] },
      71: { time: ['day'], region: 'highveld', months: [5, 6, 7, 8, 9] },
      72: { time: ['day'], months: [5, 6, 7, 8, 9] },
      73: { time: ['day'] },
      74: { time: ['day'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      75: { time: ['day'], region: 'western-cape' },
      76: { time: ['day'], region: 'western-cape' },
      77: { time: ['evening'], months: [5, 6, 7, 8, 9] },
      78: { time: ['evening'], months: [5, 6, 7, 8, 9] },
      79: { time: ['evening'], region: 'highveld', months: [5, 6, 7, 8, 9] },
      80: { time: ['evening'], months: [5, 6, 7, 8, 9] },
      81: { time: ['evening'], months: [5, 6, 7, 8, 9] },
      82: { time: ['evening'] },
      83: { time: ['evening'], months: [5, 6, 7, 8, 9] },
      84: { time: ['evening'], months: [5, 6, 7, 8, 9] },
      85: { time: ['evening'] },
      86: { time: ['evening'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      87: { time: ['evening'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      88: { time: ['evening'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      89: { time: ['evening'], months: [5, 6, 7, 8, 9] },
      90: { time: ['evening'], region: 'free-state', months: [5, 6, 7, 8, 9] },
      91: { time: ['evening'], region: 'free-state', months: [5, 6, 7, 8, 9] },
      92: { time: ['night'], months: [5, 6, 7, 8, 9] },
      93: { time: ['night'], months: [5, 6, 7, 8, 9] },
      94: { time: ['night'] },
      95: { time: ['night'] },
      96: { time: ['night'], months: [5, 6, 7, 8, 9] },
      97: { time: ['night'], months: [5, 6, 7, 8, 9] },
      98: { time: ['night'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      99: { time: ['night'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      100: { time: ['night'], months: [5, 6, 7, 8, 9] },
      101: { time: ['night'], region: 'free-state', months: [5, 6, 7, 8, 9] },
      102: { time: ['night'], months: [5, 6, 7, 8, 9] },
      103: { time: ['night'] },
      104: { time: ['night'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      105: { time: ['night'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      106: { time: ['night'] },
      11: { time: ['morning'] },
      35: { time: ['morning'] },
    },
    'cold-clear': {
      30: { time: ['morning'], months: [5, 6, 7, 8, 9] },
      31: { time: ['morning'], months: [5, 6, 7, 8, 9] },
      32: { time: ['morning'], region: 'highveld', months: [5, 6, 7, 8, 9] },
      33: { time: ['morning'], months: [5, 6, 7, 8, 9] },
      34: { time: ['morning'], months: [5, 6, 7, 8, 9] },
      35: { time: ['morning'], months: [5, 6, 7, 8, 9] },
      36: { time: ['morning'], months: [5, 6, 7, 8, 9] },
      37: { time: ['morning'], months: [5, 6, 7, 8, 9] },
      38: { time: ['morning'], months: [5, 6, 7, 8, 9] },
      39: { time: ['morning'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      40: { time: ['morning'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      41: { time: ['morning'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      42: { time: ['morning'], months: [5, 6, 7, 8, 9] },
      43: { time: ['morning'], region: 'highveld', months: [5, 6, 7, 8, 9] },
      44: { time: ['morning'], months: [5, 6, 7, 8, 9] },
      45: { time: ['morning'], months: [5, 6, 7, 8, 9] },
      46: { time: ['day'], months: [5, 6, 7, 8, 9] },
      47: { time: ['day'], months: [5, 6, 7, 8, 9] },
      48: { time: ['day'], months: [5, 6, 7, 8, 9] },
      49: { time: ['day'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      50: { time: ['day'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      51: { time: ['day'], months: [5, 6, 7, 8, 9] },
      52: { time: ['day'], months: [5, 6, 7, 8, 9] },
      53: { time: ['day'], months: [5, 6, 7, 8, 9] },
      54: { time: ['day'], months: [5, 6, 7, 8, 9] },
      55: { time: ['day'], region: 'highveld', months: [5, 6, 7, 8, 9] },
      56: { time: ['day'], months: [5, 6, 7, 8, 9] },
      57: { time: ['day'], region: 'highveld', months: [5, 6, 7, 8, 9] },
      58: { time: ['day'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      59: { time: ['day'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      60: { time: ['day'], months: [5, 6, 7, 8, 9] },
      61: { time: ['day'], months: [5, 6, 7, 8, 9] },
      62: { time: ['day'], months: [5, 6, 7, 8, 9] },
      63: { time: ['day'], months: [5, 6, 7, 8, 9] },
      64: { time: ['day'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      65: { time: ['day'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      66: { time: ['day'], region: 'karoo', months: [5, 6, 7, 8, 9] },
      67: { time: ['day'], months: [5, 6, 7, 8, 9] },
      68: { time: ['day'], months: [5, 6, 7, 8, 9] },
      69: { time: ['day'], months: [5, 6, 7, 8, 9] },
      70: { time: ['day'], region: 'karoo', months: [5, 6, 7, 8, 9] },
      71: { time: ['day'], region: 'karoo', months: [5, 6, 7, 8, 9] },
      72: { time: ['day'], months: [5, 6, 7, 8, 9] },
      73: { time: ['day'], months: [5, 6, 7, 8, 9] },
      74: { time: ['day'], months: [5, 6, 7, 8, 9] },
      75: { time: ['day'], months: [5, 6, 7, 8, 9] },
      76: { time: ['day'], months: [5, 6, 7, 8, 9] },
      77: { time: ['day'], months: [5, 6, 7, 8, 9] },
      78: { time: ['day'], region: 'free-state', months: [5, 6, 7, 8, 9] },
      79: { time: ['evening'], months: [5, 6, 7, 8, 9] },
      80: { time: ['evening'], months: [5, 6, 7, 8, 9] },
      81: { time: ['evening'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      82: { time: ['evening'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      83: { time: ['evening'], months: [5, 6, 7, 8, 9] },
      84: { time: ['evening'], months: [5, 6, 7, 8, 9] },
      85: { time: ['evening'], months: [5, 6, 7, 8, 9] },
      86: { time: ['evening'], months: [5, 6, 7, 8, 9] },
      87: { time: ['evening'], months: [5, 6, 7, 8, 9] },
      88: { time: ['evening'], region: 'karoo', months: [5, 6, 7, 8, 9] },
      89: { time: ['evening'], region: 'gauteng', months: [5, 6, 7, 8, 9] },
      90: { time: ['evening'], months: [5, 6, 7, 8, 9] },
      91: { time: ['night'], months: [5, 6, 7, 8, 9] },
      92: { time: ['night'], months: [5, 6, 7, 8, 9] },
      93: { time: ['night'], months: [5, 6, 7, 8, 9] },
      94: { time: ['night'], months: [5, 6, 7, 8, 9] },
      95: { time: ['night'], region: 'highveld', months: [5, 6, 7, 8, 9] },
      96: { time: ['night'], months: [5, 6, 7, 8, 9] },
      97: { time: ['night'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      98: { time: ['night'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      99: { time: ['night'], months: [5, 6, 7, 8, 9] },
      100: { time: ['night'], months: [5, 6, 7, 8, 9] },
      101: { time: ['night'], months: [5, 6, 7, 8, 9] },
      102: { time: ['night'], months: [5, 6, 7, 8, 9] },
      103: { time: ['night'], months: [5, 6, 7, 8, 9] },
      104: { time: ['night'], region: 'highveld', months: [5, 6, 7, 8, 9] },
      105: { time: ['night'], region: 'highveld', months: [5, 6, 7, 8, 9] },
      106: { time: ['night'], region: 'highveld', months: [5, 6, 7, 8, 9] },
      107: { time: ['night'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      108: { time: ['night'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      109: { time: ['night'], months: [5, 6, 7, 8, 9] },
      110: { time: ['night'], months: [5, 6, 7, 8, 9] },
      111: { time: ['night'], months: [5, 6, 7, 8, 9] },
      0: { region: 'free-state', time: ['morning'] },
      1: { region: 'free-state', months: WINTER_MONTHS },
      3: { region: 'gauteng', months: WINTER_MONTHS },
      10: { region: 'gauteng' },
      12: { region: 'gauteng' },
      13: { time: ['evening', 'night'] },
      15: { time: ['morning'] },
      16: { region: 'karoo', time: ['morning'] },
      19: { region: 'gauteng' },
      21: { region: 'free-state' },
      28: { region: 'free-state', time: ['morning'] },
      29: { time: ['morning'] },
    },
    heat: {
      85: { time: ['morning'], region: 'lowveld', months: [10, 11, 12, 1, 2, 3] },
      86: { time: ['day'], region: 'lowveld', months: [10, 11, 12, 1, 2, 3] },
      87: { time: ['day'], region: 'lowveld', months: [10, 11, 12, 1, 2, 3] },
      88: { time: ['day'], region: 'lowveld', months: [10, 11, 12, 1, 2, 3] },
      89: { time: ['evening'], region: 'lowveld', months: [10, 11, 12, 1, 2, 3] },
      36: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      37: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      38: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      39: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      40: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      41: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      42: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      43: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      44: { time: ['morning'], region: 'western-cape', months: [10, 11, 12, 1, 2, 3] },
      45: { time: ['morning'], region: 'western-cape', months: [10, 11, 12, 1, 2, 3] },
      46: { time: ['morning'], region: 'western-cape', months: [10, 11, 12, 1, 2, 3] },
      47: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      48: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      49: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      50: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      51: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      52: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      53: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      54: { time: ['morning'], region: 'karoo', months: [10, 11, 12, 1, 2, 3] },
      55: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      56: { time: ['day'], months: [10, 11, 12, 1, 2, 3] },
      57: { time: ['day'], months: [10, 11, 12, 1, 2, 3] },
      58: { time: ['day'], months: [10, 11, 12, 1, 2, 3] },
      59: { time: ['day'], months: [10, 11, 12, 1, 2, 3] },
      60: { time: ['day'], months: [10, 11, 12, 1, 2, 3] },
      61: { time: ['day'], months: [10, 11, 12, 1, 2, 3] },
      62: { time: ['day'], region: 'western-cape', months: [10, 11, 12, 1, 2, 3] },
      63: { time: ['day'], region: 'western-cape', months: [10, 11, 12, 1, 2, 3] },
      64: { time: ['day'], region: 'western-cape', months: [10, 11, 12, 1, 2, 3] },
      65: { time: ['day'], months: [10, 11, 12, 1, 2, 3] },
      66: { time: ['day'], months: [10, 11, 12, 1, 2, 3] },
      67: { time: ['day'], months: [10, 11, 12, 1, 2, 3] },
      68: { time: ['evening'], months: [10, 11, 12, 1, 2, 3] },
      69: { time: ['evening'], months: [10, 11, 12, 1, 2, 3] },
      70: { time: ['evening'], months: [10, 11, 12, 1, 2, 3] },
      71: { time: ['evening'], months: [10, 11, 12, 1, 2, 3] },
      72: { time: ['evening'], months: [10, 11, 12, 1, 2, 3] },
      73: { time: ['evening'], months: [10, 11, 12, 1, 2, 3] },
      74: { time: ['evening'], region: 'karoo', months: [10, 11, 12, 1, 2, 3] },
      75: { time: ['evening'], months: [10, 11, 12, 1, 2, 3] },
      76: { time: ['evening'], region: 'karoo', months: [10, 11, 12, 1, 2, 3] },
      77: { time: ['evening'], region: 'western-cape', months: [10, 11, 12, 1, 2, 3] },
      78: { time: ['evening'], region: 'western-cape', months: [10, 11, 12, 1, 2, 3] },
      79: { time: ['evening'], region: 'western-cape', months: [10, 11, 12, 1, 2, 3] },
      80: { time: ['evening'], months: [10, 11, 12, 1, 2, 3] },
      81: { time: ['evening'], months: [10, 11, 12, 1, 2, 3] },
      82: { time: ['evening'], months: [10, 11, 12, 1, 2, 3] },
      83: { time: ['evening'], months: [10, 11, 12, 1, 2, 3] },
      84: { time: ['evening'], months: [10, 11, 12, 1, 2, 3] },
      5: { time: ['day'] },
      12: { day: 'weekday' },
      19: { day: 'weekday', time: ['day'] },
      21: { day: 'weekday' },
      26: { time: ['morning'] },
      33: { time: ['morning'] },
    },
    rain: {
      36: { time: ['morning'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      37: { time: ['morning'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      38: { time: ['morning'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      39: { time: ['morning'], region: 'karoo' },
      40: { time: ['morning'] },
      41: { time: ['morning'] },
      42: { time: ['morning'] },
      43: { time: ['morning'] },
      44: { time: ['morning'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      45: { time: ['morning'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      46: { time: ['morning'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      47: { time: ['morning'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      48: { time: ['morning'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      49: { time: ['morning'] },
      50: { time: ['morning'] },
      51: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      52: { time: ['morning'], region: 'highveld', months: [10, 11, 12, 1, 2, 3] },
      53: { time: ['day'], region: 'gauteng', months: [10, 11, 12, 1, 2, 3] },
      54: { time: ['day'], months: [10, 11, 12, 1, 2, 3] },
      55: { time: ['day'], region: 'gauteng', months: [10, 11, 12, 1, 2, 3] },
      56: { time: ['day'], months: [10, 11, 12, 1, 2, 3] },
      57: { time: ['day'] },
      58: { time: ['day'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      59: { time: ['day'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      60: { time: ['day'] },
      61: { time: ['day'] },
      62: { time: ['day'], region: 'highveld', months: [10, 11, 12, 1, 2, 3] },
      63: { time: ['day'], region: 'karoo', months: [10, 11, 12, 1, 2, 3] },
      64: { time: ['day'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      65: { time: ['day'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      66: { time: ['day'] },
      67: { time: ['day'] },
      68: { time: ['day'] },
      69: { time: ['evening'], region: 'gauteng', months: [10, 11, 12, 1, 2, 3] },
      70: { time: ['evening'], months: [10, 11, 12, 1, 2, 3] },
      71: { time: ['evening'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      72: { time: ['evening'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      73: { time: ['evening'] },
      74: { time: ['evening'], region: 'karoo' },
      75: { time: ['evening'], region: 'karoo' },
      76: { time: ['night'] },
      77: { time: ['night'] },
      78: { time: ['night'] },
      79: { time: ['night'], months: [10, 11, 12, 1, 2, 3] },
      80: { time: ['night'], region: 'highveld', months: [10, 11, 12, 1, 2, 3] },
      81: { time: ['night'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      82: { time: ['night'], region: 'western-cape', months: [5, 6, 7, 8, 9] },
      13: { day: 'weekday' },
      24: { day: 'weekday' },
      25: { day: 'weekday' },
      27: { day: 'weekday' },
      35: { day: 'weekday' },
    },
    clear: {
      38: { time: ['morning'] },
      39: { time: ['morning'] },
      40: { time: ['morning'] },
      41: { time: ['morning'], region: 'western-cape' },
      42: { time: ['morning'] },
      43: { time: ['morning'], region: 'highveld' },
      44: { time: ['morning'] },
      45: { time: ['morning'] },
      46: { time: ['morning'], region: 'western-cape' },
      47: { time: ['morning'] },
      48: { time: ['morning'] },
      49: { time: ['morning'] },
      50: { time: ['morning'], region: 'western-cape' },
      51: { time: ['morning'] },
      52: { time: ['morning'] },
      53: { time: ['morning'] },
      54: { time: ['morning'] },
      55: { time: ['morning'] },
      56: { time: ['morning'] },
      57: { time: ['morning'] },
      58: { time: ['day'], region: 'western-cape' },
      59: { time: ['day'], region: 'western-cape' },
      60: { time: ['day'], region: 'western-cape' },
      61: { time: ['day'], region: 'western-cape' },
      62: { time: ['day'], region: 'western-cape' },
      63: { time: ['day'], region: 'highveld' },
      64: { time: ['day'] },
      65: { day: 'weekend', time: ['day'] },
      66: { time: ['day'] },
      67: { time: ['day'], region: 'karoo' },
      68: { time: ['day'] },
      69: { time: ['day'], region: 'western-cape' },
      70: { time: ['day'] },
      71: { time: ['day'], region: 'western-cape' },
      72: { time: ['day'], region: 'western-cape' },
      73: { time: ['evening'], region: 'western-cape' },
      74: { time: ['evening'] },
      75: { time: ['evening'] },
      76: { time: ['evening'] },
      77: { day: 'weekend', time: ['evening'] },
      78: { time: ['evening'] },
      79: { time: ['evening'], region: 'highveld' },
      80: { time: ['evening'], region: 'western-cape' },
      81: { time: ['evening'] },
      82: { time: ['evening'] },
      83: { time: ['evening'] },
      84: { time: ['evening'], region: 'western-cape' },
      85: { time: ['evening'] },
      86: { time: ['evening'] },
      87: { time: ['evening'] },
      88: { time: ['evening'], region: 'western-cape' },
      89: { time: ['evening'] },
      90: { time: ['night'] },
      91: { time: ['night'] },
      92: { time: ['night'] },
      93: { time: ['night'] },
      94: { time: ['night'] },
      15: { region: 'western-cape' },
      18: { region: 'western-cape' },
    },
    uv: {
      1: { time: ['morning', 'day'] },
      13: { time: ['morning', 'day'] },
    },
    wind: {
      53: { region: 'eastern-cape' },
      54: { region: 'eastern-cape' },
      55: { region: 'eastern-cape' },
      56: { region: 'eastern-cape' },
      20: { region: 'western-cape' },
      21: { region: 'western-cape' },
      26: { region: 'western-cape' },
      29: { region: 'western-cape' },
      30: { region: 'western-cape' },
      40: { region: 'western-cape' },
      41: { region: 'western-cape' },
      2: { region: 'western-cape' },
      3: { region: 'western-cape' },
    },
    night: {
      9: { region: 'western-cape' },
      15: { region: 'western-cape' },
    },
    storm: {
      32: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      33: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      34: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      35: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      36: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      37: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      38: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      39: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      40: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      41: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      42: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      43: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      44: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      45: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      46: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      47: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      48: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      49: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      50: { time: ['morning'], months: [10, 11, 12, 1, 2, 3] },
      51: { time: ['evening'], months: [10, 11, 12, 1, 2, 3] },
      52: { time: ['evening'], months: [10, 11, 12, 1, 2, 3] },
      53: { time: ['evening'], months: [10, 11, 12, 1, 2, 3] },
      54: { time: ['night'], months: [10, 11, 12, 1, 2, 3] },
      55: { time: ['night'], months: [10, 11, 12, 1, 2, 3] },
      56: { time: ['night'], months: [10, 11, 12, 1, 2, 3] },
      57: { time: ['night'], months: [10, 11, 12, 1, 2, 3] },
      58: { time: ['night'], months: [10, 11, 12, 1, 2, 3] },
    },
  },
  witty_low_confidence: {
    clear: {
      2: { region: 'western-cape' },
    },
    fog: {
      1: { region: 'western-cape' },
    },
    wind: {
      0: { region: 'western-cape' },
    },
    cold: {
      5: { region: 'western-cape', time: ['morning'] },
    },
  },
};

export function timeSlotForHour(hour) {
  if (!Number.isFinite(Number(hour))) return null;
  const h = ((Math.floor(Number(hour)) % 24) + 24) % 24;
  if (h >= 5 && h <= 11) return 'morning';
  if (h >= 12 && h <= 16) return 'day';
  if (h >= 17 && h <= 20) return 'evening';
  return 'night';
}

export function seasonMonths(season) {
  if (season === 'winter') return [...WINTER_MONTHS];
  if (season === 'summer') return [...SUMMER_MONTHS];
  return [];
}

export function isNightWittyWindow(context = {}) {
  return timeSlotForHour(context.hour) === 'night';
}

export function resolveNightAwareCopyCondition({
  displayCondition,
  timeOfDay,
  hour,
  fallbackCondition,
} = {}) {
  const condition = displayCondition || fallbackCondition || 'clear';
  const fallback = fallbackCondition || 'clear';
  if (condition === 'night') return isNightWittyWindow({ hour }) ? 'night' : fallback;
  if (timeOfDay === 'night' && condition === 'clear' && isNightWittyWindow({ hour })) return 'night';
  return condition;
}

function normalizeContext(contextOrDay, hour) {
  if (contextOrDay && typeof contextOrDay === 'object' && !Array.isArray(contextOrDay)) {
    return contextOrDay;
  }
  return { day: contextOrDay, hour };
}

function normalizeTag(tag) {
  if (!tag) return {};
  if (typeof tag === 'string') return { day: tag };
  return tag;
}

// Fri-evening (>=16:00) counts as the weekend for braai plans, mirroring
// getWittyLine's isWeekend. Day-named tags ('sat' etc.) are exact-day only.
export function dayTagAllows(tag, day, hour) {
  const dayTag = normalizeTag(tag).day;
  if (!dayTag || !Number.isFinite(Number(day))) return true;
  if (dayTag === 'weekday') return day >= 1 && day <= 5;
  if (dayTag === 'weekend') return day === 0 || day === 6 || (day === 5 && Number(hour) >= 16);
  const named = DAY_INDEX[dayTag];
  if (named !== undefined) return day === named;
  return true; // unknown tag → don't hide
}

export function timeTagAllows(slots, hour) {
  if (!slots) return true;
  if (!Number.isFinite(Number(hour))) return true;
  const allowedSlots = Array.isArray(slots) ? slots : [slots];
  return allowedSlots.includes(timeSlotForHour(hour));
}

export function regionTagAllows(region, lat, lon) {
  if (!region) return true;
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return true;
  const regions = Array.isArray(region) ? region : [region];
  return regions.some((entry) => isRegionTagAt(entry, lat, lon));
}

export function monthTagAllows(months, month) {
  if (!months) return true;
  if (!Number.isFinite(Number(month))) return true;
  const normalized = ((Math.floor(Number(month)) - 1) % 12 + 12) % 12 + 1;
  const allowedMonths = Array.isArray(months) ? months : [months];
  return allowedMonths.includes(normalized);
}

export function contextTagAllows(tag, context = {}) {
  const t = normalizeTag(tag);
  return dayTagAllows(t.day, Number(context.day), context.hour)
    && timeTagAllows(t.time, context.hour)
    && regionTagAllows(t.region, context.lat, context.lon)
    && monthTagAllows(t.months, context.month);
}

// The single enforcement point. Returns the non-empty lines allowed by every
// present context tag. Region tags fail open when coordinates are missing so a
// line can ride rather than going dark for unknown-location cards.
export function dayAwarePool(tagMap, arr, contextOrDay, hour) {
  const context = normalizeContext(contextOrDay, hour);
  const nonEmpty = [];
  const allowed = [];
  (Array.isArray(arr) ? arr : []).forEach((s, i) => {
    if (typeof s !== 'string' || s.trim() === '') return;
    nonEmpty.push(s);
    if (contextTagAllows((tagMap || {})[i], context)) allowed.push(s);
  });
  return allowed;
}

export function isWeekendContext(context = {}) {
  return dayTagAllows({ day: 'weekend' }, Number(context.day), context.hour);
}

function localizedPool(bank, bin, lang) {
  return bank?.[bin]?.[lang] || bank?.[bin]?.en;
}

function hasUsableLine(pool) {
  return Array.isArray(pool) && pool.some((s) => typeof s === 'string' && s.trim() !== '');
}

export function eligibleWittyPool({
  copy,
  tags = WITTY_DAY_TAGS,
  condition,
  lang = 'en',
  context = {},
  lowConfidence = false,
} = {}) {
  let safeCondition = condition || 'clear';
  if (safeCondition === 'night' && !isNightWittyWindow(context)) {
    safeCondition = context.fallbackCondition || 'clear';
  }

  if (lowConfidence) {
    const lcPool = localizedPool(copy?.witty_low_confidence, safeCondition, lang);
    if (hasUsableLine(lcPool)) {
      return {
        namespace: 'witty_low_confidence',
        bin: safeCondition,
        raw: lcPool,
        pool: dayAwarePool(tags.witty_low_confidence?.[safeCondition], lcPool, context),
      };
    }
  }

  // Weekend is ADDITIVE on clear/heat — Al's ruling 2026-09-05, class A of
  // review/ROUTING-CONFLICTS.md. It used to REPLACE the condition pool, so on Sat/Sun (and
  // Fri from 16:00) no clear or heat line could fire at all: two days in seven served weekend
  // lines only. Both registers are now eligible, and the weekend keeps its character through
  // the photographs rather than through pool exclusivity.
  //
  // This governs the CONDITION BANK only. The bespoke hero path (app.js applyBespokeLine)
  // resolves lines by photograph and never calls this function, so Al's hand-matched pairings
  // are unaffected either way. What this fixes is the bank, which still serves the four
  // non-English languages in-app and every share card (api/og.js pickWitty).
  if (isWeekendContext(context) && (safeCondition === 'clear' || safeCondition === 'heat')) {
    const weekendPool = localizedPool(copy?.witty, 'weekend', lang);
    if (hasUsableLine(weekendPool)) {
      const conditionPool = localizedPool(copy?.witty, safeCondition, lang) || [];
      const merged = [
        ...dayAwarePool(tags.witty?.weekend, weekendPool, context),
        ...dayAwarePool(tags.witty?.[safeCondition], conditionPool, context),
      ];
      if (merged.length) {
        return {
          namespace: 'witty',
          bin: 'weekend',
          mergedBins: ['weekend', safeCondition],
          raw: [...weekendPool, ...conditionPool],
          pool: merged,
        };
      }
    }
  }

  const fb = COPY_FALLBACK[safeCondition];
  let bin = safeCondition;
  let lines = localizedPool(copy?.witty, safeCondition, lang);
  if (!lines && fb) { bin = fb; lines = localizedPool(copy?.witty, fb, lang); }
  if (!lines) { bin = 'clear'; lines = copy?.witty?.clear?.en || []; }

  return {
    namespace: 'witty',
    bin,
    raw: lines,
    pool: dayAwarePool(tags.witty?.[bin], lines, context),
  };
}

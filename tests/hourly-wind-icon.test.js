// 17 Oct 2026 (Al): a Windy hour shows the wind icon in the hourly row (it used to fall through to sun or cloud).
import { describe, it, expect } from 'vitest';
import { pickHourlyIcon } from '../assets/weather-emoji.js';

describe('hourly row: Windy hours show the wind icon', () => {
  it('an hour the server marks wind shows the wind icon, day and night', () => {
    expect(pickHourlyIcon({ rainPct: 5, cloudPct: 10, tempC: 22, isNight: false, condition: 'wind' })).toBe('wind');
    expect(pickHourlyIcon({ rainPct: 5, cloudPct: 10, tempC: 18, isNight: true, condition: 'wind' })).toBe('wind');
  });
  it('breezy still shows breezy, and storm and fog still win', () => {
    expect(pickHourlyIcon({ rainPct: 5, cloudPct: 10, tempC: 22, isNight: false, condition: 'breezy' })).toBe('breezy');
    expect(pickHourlyIcon({ rainPct: 60, cloudPct: 90, tempC: 22, isNight: false, condition: 'storm' })).toBe('storm');
    expect(pickHourlyIcon({ rainPct: 5, cloudPct: 90, tempC: 12, isNight: false, condition: 'fog' })).toBe('fog');
  });
  it('freezing and 35 °C+ hours keep the cold and heat icons over wind (the hero ranks them above wind)', () => {
    expect(pickHourlyIcon({ rainPct: 5, cloudPct: 10, tempC: -1, isNight: false, condition: 'wind' })).toBe('cold');
    expect(pickHourlyIcon({ rainPct: 5, cloudPct: 10, tempC: 36, isNight: false, condition: 'wind' })).toBe('heat');
  });
  it('an unmarked hour keeps the old ladder (no wind icon from the client on its own)', () => {
    expect(pickHourlyIcon({ rainPct: 5, cloudPct: 10, tempC: 22, isNight: false, condition: 'clear' })).not.toBe('wind');
  });
});

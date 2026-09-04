import { describe, expect, it } from 'vitest';
import {
  formatTimeInputInTimeZone,
  getDayKeyInTimeZone,
  getRepresentativeTimeZone,
  TIME_ZONE_OPTIONS,
  zonedDateTimeToUtc
} from '../timezones';

describe('timezones', () => {
  it('stores wall-clock values as UTC instants', () => {
    const pacific = zonedDateTimeToUtc('2026-09-04', '17:00', 'America/Los_Angeles');
    const eastern = zonedDateTimeToUtc('2026-09-04', '17:00', 'America/New_York');

    expect(pacific?.toISOString()).toBe('2026-09-05T00:00:00.000Z');
    expect(eastern?.toISOString()).toBe('2026-09-04T21:00:00.000Z');
  });

  it('renders one UTC instant in the selected timezone', () => {
    const instant = new Date('2026-09-05T00:00:00.000Z');

    expect(formatTimeInputInTimeZone(instant, 'America/Los_Angeles')).toBe('17:00');
    expect(formatTimeInputInTimeZone(instant, 'America/New_York')).toBe('20:00');
    expect(getDayKeyInTimeZone(instant, 'America/New_York')).toBe('2026-09-04');
  });

  it('offers one location per whole-hour offset without continent prefixes', () => {
    const offsets = TIME_ZONE_OPTIONS.map(option => option.label.match(/UTC([+-]\d{2}:\d{2})/)?.[1]);

    expect(new Set(offsets).size).toBe(TIME_ZONE_OPTIONS.length);
    expect(offsets.every(offset => offset?.endsWith(':00'))).toBe(true);
    expect(TIME_ZONE_OPTIONS.every(option => !option.label.split(' ')[0].includes('/'))).toBe(true);
    expect(TIME_ZONE_OPTIONS.find(option => option.value === 'America/New_York')?.label).toMatch(/^New York \(UTC/);
  });

  it('maps an unlisted timezone to the representative with the same offset', () => {
    expect(getRepresentativeTimeZone('America/Phoenix', new Date('2026-09-04T12:00:00Z'))).toBe('America/Los_Angeles');
  });
});
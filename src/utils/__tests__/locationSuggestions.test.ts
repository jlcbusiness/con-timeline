import { describe, expect, it } from 'vitest';
import type { TimelineEvent } from '../../types/timeline';
import { getLocationSuggestions } from '../locationSuggestions';

const createEvent = (id: string, location: string, updatedAt: string): TimelineEvent => ({
  id,
  title: id,
  location,
  startTime: new Date('2026-09-03T10:00:00'),
  endTime: new Date('2026-09-03T11:00:00'),
  color: '#3b82f6',
  position: 0,
  updatedAt
});

describe('getLocationSuggestions', () => {
  it('merges recent and popular locations, backfills duplicates, and sorts by popularity', () => {
    const events = [
      createEvent('a1', 'Atrium', '2026-08-01T10:00:00Z'),
      createEvent('a2', 'atrium', '2026-08-02T10:00:00Z'),
      createEvent('a3', 'Atrium', '2026-08-11T10:00:00Z'),
      createEvent('b1', 'Ballroom', '2026-08-03T10:00:00Z'),
      createEvent('b2', 'Ballroom', '2026-08-10T10:00:00Z'),
      createEvent('c1', 'Conference', '2026-08-04T10:00:00Z'),
      createEvent('c2', 'Conference', '2026-08-05T10:00:00Z'),
      createEvent('d1', 'Deck', '2026-08-09T10:00:00Z'),
      createEvent('e1', 'Exhibit Hall', '2026-08-08T10:00:00Z'),
      createEvent('f1', 'Forum', '2026-08-07T10:00:00Z'),
      createEvent('g1', 'Gallery', '2026-08-06T10:00:00Z')
    ];

    expect(getLocationSuggestions(events)).toEqual([
      'Atrium',
      'Ballroom',
      'Conference',
      'Deck',
      'Exhibit Hall',
      'Forum'
    ]);
  });

  it('returns every unique location when fewer than six exist', () => {
    const events = [
      createEvent('a', 'Atrium', '2026-08-01T10:00:00Z'),
      createEvent('b', 'Ballroom', '2026-08-02T10:00:00Z'),
      createEvent('c', 'Conference', '2026-08-03T10:00:00Z'),
      createEvent('d', 'Deck', '2026-08-04T10:00:00Z'),
      createEvent('e', 'Exhibit Hall', '2026-08-05T10:00:00Z')
    ];

    expect(getLocationSuggestions(events)).toHaveLength(5);
  });
});
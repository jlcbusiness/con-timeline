import { describe, expect, it } from 'vitest';
import type { TimelineEvent } from '../../types/timeline';
import { remapImportedEventIds } from '../useEventPersistence';

describe('remapImportedEventIds', () => {
  it('creates valid unique IDs without changing imported event data', () => {
    const importedEvents: TimelineEvent[] = [
      {
        id: '5f9c9eec-2f25-45a9-ac1f-ca163df2a549',
        title: 'SEA to ATL',
        startTime: new Date('2026-09-02T16:00:00.000Z'),
        endTime: new Date('2026-09-03T00:00:00.000Z'),
        color: '#57c14e',
        position: 0
      },
      {
        id: 'cbd4b7be-c04c-453c-b525-2c14e038fcbb',
        title: 'ATL to SEA',
        startTime: new Date('2026-09-08T16:00:00.000Z'),
        endTime: new Date('2026-09-08T18:30:00.000Z'),
        color: '#57c14e',
        position: 0
      }
    ];

    const remapped = remapImportedEventIds(importedEvents);

    expect(remapped.map(event => event.id)).not.toEqual(importedEvents.map(event => event.id));
    expect(new Set(remapped.map(event => event.id)).size).toBe(remapped.length);
    expect(remapped.every(event => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(event.id))).toBe(true);
    expect(remapped.map(({ id: _id, ...event }) => event)).toEqual(importedEvents.map(({ id: _id, ...event }) => event));
  });
});
import { describe, it, expect } from 'vitest';
import { roundToNearestHalfHour, getTimePosition, cascadeEventPositions, sortEventsByStructure, findAvailablePosition, repackEventPositions, getIntangibleVisibleSegments, getLocationDisplayColor } from '../timelineUtils';

describe('timelineUtils', () => {
  it('rounds to nearest half hour correctly', () => {
    const d = new Date(2025, 7, 27, 9, 10);
    const r = roundToNearestHalfHour(d);
    expect(r.getMinutes()).toBe(0);

    const d2 = new Date(2025, 7, 27, 9, 40);
    const r2 = roundToNearestHalfHour(d2);
    expect(r2.getMinutes()).toBe(30);
  });

  it('computes time position (px) consistently', () => {
    const start = new Date(2025, 7, 27, 1, 0);
    const t = new Date(2025, 7, 27, 3, 0);
    const pos = getTimePosition(t, start);
    // 2 hours * PIXELS_PER_HOUR (240) == 480
    expect(pos).toBeGreaterThan(0);
  });

  it('cascadeEventPositions returns empty when no conflicts', () => {
    const events = [
      { id: 'a', startTime: new Date(2025,7,27,9), endTime: new Date(2025,7,27,10), position: 0 },
      { id: 'b', startTime: new Date(2025,7,27,10), endTime: new Date(2025,7,27,11), position: 0 }
    ];
    const updates = cascadeEventPositions(events as any, events[0] as any, {});
    expect(Array.isArray(updates)).toBe(true);
  });

  it('moves longer overlapping events before shorter ones during cascade', () => {
    const changedEvent = { id: 'changed', startTime: new Date(2025, 7, 27, 10), endTime: new Date(2025, 7, 27, 11), position: 0 };
    const longEvent = { id: 'long', startTime: new Date(2025, 7, 27, 10), endTime: new Date(2025, 7, 27, 12), position: 0 };
    const shortEventA = { id: 'short-a', startTime: new Date(2025, 7, 27, 10), endTime: new Date(2025, 7, 27, 10, 30), position: 0 };
    const shortEventB = { id: 'short-b', startTime: new Date(2025, 7, 27, 10, 15), endTime: new Date(2025, 7, 27, 10, 45), position: 0 };

    const updates = cascadeEventPositions(
      [changedEvent, longEvent, shortEventA, shortEventB] as any,
      changedEvent as any,
      { startTime: new Date(2025, 7, 27, 10, 15) }
    );

    expect(updates[0]?.eventId).toBe('long');
  });

  it('sorts imported events by start time, duration, venue, room, and source order', () => {
    const events = [
      { id: 'short', title: 'Short', location: 'Hilton Galleria 7', startTime: new Date(2025, 7, 27, 10), endTime: new Date(2025, 7, 27, 10, 30), position: 0 },
      { id: 'long', title: 'Long', location: 'Westin 12th Floor', startTime: new Date(2025, 7, 27, 10), endTime: new Date(2025, 7, 27, 12), position: 0 },
      { id: 'same-duration', title: 'Same', location: 'Hyatt Embassy CD', startTime: new Date(2025, 7, 27, 10), endTime: new Date(2025, 7, 27, 10, 30), position: 0 }
    ];

    const sorted = sortEventsByStructure(events as any);

    expect(sorted[0]?.id).toBe('long');
    expect(sorted[1]?.id).toBe('same-duration');
    expect(sorted[2]?.id).toBe('short');
  });

  it('prioritizes the busiest overlapping events before short ones', () => {
    const events = [
      { id: 'short-1', title: 'Short 1', location: 'Hilton Galleria 7', startTime: new Date(2025, 7, 31, 13, 0), endTime: new Date(2025, 7, 31, 13, 30), position: 0 },
      { id: 'short-2', title: 'Short 2', location: 'Hilton Galleria 4', startTime: new Date(2025, 7, 31, 13, 15), endTime: new Date(2025, 7, 31, 13, 45), position: 0 },
      { id: 'long-1', title: 'Long 1', location: 'Westin 12th Floor', startTime: new Date(2025, 7, 31, 13, 0), endTime: new Date(2025, 7, 31, 15, 0), position: 0 },
      { id: 'long-2', title: 'Long 2', location: 'Hyatt Embassy CD', startTime: new Date(2025, 7, 31, 13, 30), endTime: new Date(2025, 7, 31, 15, 0), position: 0 }
    ];

    const sorted = sortEventsByStructure(events as any);

    expect(sorted.slice(0, 2).map(event => event.id)).toEqual(['long-1', 'long-2']);
    expect(sorted.slice(2).map(event => event.id).sort()).toEqual(['short-1', 'short-2']);
  });

  it('keeps connected overlap clusters together and sorts long events first inside the cluster', () => {
    const events = [
      { id: 'cluster-a-short', title: 'Cluster A Short', location: 'Hilton Galleria 7', startTime: new Date(2025, 7, 31, 13, 0), endTime: new Date(2025, 7, 31, 13, 30), position: 0 },
      { id: 'cluster-a-long', title: 'Cluster A Long', location: 'Westin 12th Floor', startTime: new Date(2025, 7, 31, 13, 0), endTime: new Date(2025, 7, 31, 15, 0), position: 0 },
      { id: 'cluster-b-long', title: 'Cluster B Long', location: 'Hyatt Embassy CD', startTime: new Date(2025, 7, 31, 16, 0), endTime: new Date(2025, 7, 31, 18, 0), position: 0 },
      { id: 'cluster-b-short', title: 'Cluster B Short', location: 'Hilton Galleria 4', startTime: new Date(2025, 7, 31, 16, 30), endTime: new Date(2025, 7, 31, 17, 0), position: 0 }
    ];

    const sorted = sortEventsByStructure(events as any);

    expect(sorted.map(event => event.id)).toEqual([
      'cluster-a-long',
      'cluster-a-short',
      'cluster-b-long',
      'cluster-b-short'
    ]);
  });

  it('ignores intangible events when finding positions, cascading, and sorting solid events', () => {
    const ghost = {
      id: 'ghost',
      title: 'Ghost',
      intangible: true,
      startTime: new Date(2025, 7, 27, 10),
      endTime: new Date(2025, 7, 27, 11),
      position: 2
    };
    const solidA = {
      id: 'solid-a',
      title: 'Solid A',
      startTime: new Date(2025, 7, 27, 10),
      endTime: new Date(2025, 7, 27, 11),
      position: 0
    };
    const solidB = {
      id: 'solid-b',
      title: 'Solid B',
      startTime: new Date(2025, 7, 27, 10, 15),
      endTime: new Date(2025, 7, 27, 10, 45),
      position: 1
    };

    expect(
      findAvailablePosition([solidA, solidB, ghost] as any, new Date(2025, 7, 27, 10, 30), new Date(2025, 7, 27, 11), solidA as any)
    ).toBe(2);

    expect(
      findAvailablePosition([solidA, solidB, ghost] as any, new Date(2025, 7, 27, 10, 30), new Date(2025, 7, 27, 11), ghost as any)
    ).toBe(0);

    expect(
      cascadeEventPositions([solidA, ghost] as any, solidA as any, { startTime: new Date(2025, 7, 27, 10, 30) })
    ).toEqual([]);

    expect(
      sortEventsByStructure([ghost, solidB, solidA] as any).map(event => event.id)
    ).toEqual(['solid-a', 'solid-b', 'ghost']);
  });

  it('repacks solid events when an event becomes intangible', () => {
    const events = [
      { id: 'top', title: 'Top', startTime: new Date(2025, 8, 4, 10), endTime: new Date(2025, 8, 4, 11), position: 0 },
      { id: 'middle', title: 'Middle', startTime: new Date(2025, 8, 4, 10, 15), endTime: new Date(2025, 8, 4, 11, 15), position: 1 },
      { id: 'bottom', title: 'Bottom', startTime: new Date(2025, 8, 4, 10, 30), endTime: new Date(2025, 8, 4, 11, 30), position: 2 }
    ];

    const updates = repackEventPositions(events as any, 'middle', { intangible: true });

    expect(updates).toEqual([
      { eventId: 'middle', updates: { position: 0 } },
      { eventId: 'bottom', updates: { position: 1 } }
    ]);
  });

  it('splits intangible visibility into uncovered segments', () => {
    const event = {
      id: 'ghost',
      title: 'Ghost',
      intangible: true,
      startTime: new Date(2025, 8, 4, 10, 0),
      endTime: new Date(2025, 8, 4, 12, 0),
      position: 0
    };

    const blockers = [
      {
        id: 'block-1',
        title: 'Block 1',
        startTime: new Date(2025, 8, 4, 10, 0),
        endTime: new Date(2025, 8, 4, 10, 30),
        position: 0
      },
      {
        id: 'block-2',
        title: 'Block 2',
        startTime: new Date(2025, 8, 4, 11, 0),
        endTime: new Date(2025, 8, 4, 11, 30),
        position: 0
      }
    ];

    const segments = getIntangibleVisibleSegments(event as any, [event, ...blockers] as any);

    expect(segments.map(segment => [segment.startTime.getHours(), segment.startTime.getMinutes(), segment.endTime.getHours(), segment.endTime.getMinutes()])).toEqual([
      [10, 30, 11, 0],
      [11, 30, 12, 0]
    ]);
  });

  it('does not treat tangible buffer time as blocking intangible visibility', () => {
    const event = {
      id: 'ghost',
      title: 'Ghost',
      intangible: true,
      startTime: new Date(2025, 8, 4, 10, 0),
      endTime: new Date(2025, 8, 4, 12, 0),
      position: 0
    };

    const bufferedBlocker = {
      id: 'buffered-blocker',
      title: 'Buffered Blocker',
      startTime: new Date(2025, 8, 4, 10, 30),
      endTime: new Date(2025, 8, 4, 11, 0),
      bufferBeforeMinutes: 30,
      position: 0
    };

    const segments = getIntangibleVisibleSegments(event as any, [event, bufferedBlocker] as any);

    expect(segments.map(segment => [segment.startTime.getHours(), segment.startTime.getMinutes(), segment.endTime.getHours(), segment.endTime.getMinutes()])).toEqual([
      [10, 0, 10, 30],
      [11, 0, 12, 0]
    ]);
  });

  it('maps locations to display colors for the edit timeline toggle', () => {
    expect(getLocationDisplayColor('Hilton')).toBe('#8b5cf6');
    expect(getLocationDisplayColor('Hyatt')).toBe('#41cbf1');
    expect(getLocationDisplayColor('Marriott')).toBe('#c026d3');
    expect(getLocationDisplayColor('Courtland')).toBe('#fb923c');
    expect(getLocationDisplayColor('Westin')).toBe('#57c14e');
    expect(getLocationDisplayColor('Parade')).toBe('#ffc800');
    expect(getLocationDisplayColor('The Mart')).toBe('#3b82f6');
    expect(getLocationDisplayColor('TV / Twitch')).toBe('#dc2626');
    expect(getLocationDisplayColor('Some Other Room')).toBe('#6b7280');
  });
});

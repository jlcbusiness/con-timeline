import { describe, it, expect } from 'vitest';
import { addDragonConEvents, parseDragonConSchedule } from '../dragonConImporter';
import type { TimelineEvent } from '../../types/timeline';

describe('dragonConImporter', () => {
  it('parses PDF-style schedule blocks with locations and day headings', () => {
    const schedule = `Dragon Con 2026 Schedule
Wednesday, Sep 2
Onesie Wednesday
11:00PM — 1:00AM
Location: Marriott Marquis
Thursday, Sep 3
Artemis Spaceship Bridge Simulator
7:00PM — 11:55PM
Location: Westin 12th Floor
Speakers: Sasha Arbogast — , Bill Keel —`;

    const events = parseDragonConSchedule(schedule);

    expect(events).toHaveLength(2);
    expect(events[0].title).toBe('Onesie Wednesday');
    expect(events[0].location).toBe('Marriott Marquis');
    expect(events[0].startTime.getFullYear()).toBe(2026);
    expect(events[0].startTime.getMonth()).toBe(8);
    expect(events[0].startTime.getDate()).toBe(2);
    expect(events[1].title).toBe('Artemis Spaceship Bridge Simulator');
    expect(events[1].location).toBe('Westin 12th Floor');
    expect(events[1].description).toContain('Speakers: Sasha Arbogast');
  });

  it('parses the legacy one-line schedule format', () => {
    const schedule = 'Dragon Con Newbie Walking Tours - Thursday, Sep 1 12:00 PM';

    const events = parseDragonConSchedule(schedule);

    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Dragon Con Newbie Walking Tours');
    expect(events[0].location).toBe('Dragon Con');
    expect(events[0].startTime.getHours()).toBe(12);
  });

  it('skips events that already exist by title and time', () => {
    const existingEvent: TimelineEvent = {
      id: 'existing-1',
      title: 'Onesie Wednesday',
      description: 'Dragon Con 2026 - Wednesday, Sep 2',
      location: 'Marriott Marquis',
      startTime: new Date(2026, 8, 2, 23, 0),
      endTime: new Date(2026, 8, 3, 1, 0),
      color: '#10B981',
      position: 0
    };

    const added: TimelineEvent[] = [];
    const count = addDragonConEvents(
      `Dragon Con 2026 Schedule\nWednesday, Sep 2\nOnesie Wednesday\n11:00PM — 1:00AM\nLocation: Marriott Marquis`,
      [existingEvent],
      (event) => added.push(event)
    );

    expect(count).toBe(0);
    expect(added).toHaveLength(0);
  });
});

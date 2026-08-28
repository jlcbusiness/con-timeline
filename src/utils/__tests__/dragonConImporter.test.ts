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
    expect(events[0].lockTime).toBe(true);
    expect(events[1].lockTime).toBe(true);
    expect(events[0].color).toBe('#6B7280');
    expect(events[1].color).toBe('#6B7280');
  });

  it('parses the legacy one-line schedule format', () => {
    const schedule = 'Dragon Con Newbie Walking Tours - Thursday, Sep 1 12:00 PM';

    const events = parseDragonConSchedule(schedule);

    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Dragon Con Newbie Walking Tours');
    expect(events[0].location).toBe('Dragon Con');
    expect(events[0].startTime.getHours()).toBe(12);
    expect(events[0].description).toBe('');
    expect(events[0].lockTime).toBe(true);
    expect(events[0].color).toBe('#6B7280');
  });

  it('overwrites events that already exist by title and time', () => {
    const existingEvent: TimelineEvent = {
      id: 'existing-1',
      title: 'Onesie Wednesday',
      description: 'Dragon Con 2026 - Wednesday, Sep 2',
      location: 'Marriott Marquis',
      startTime: new Date(2026, 8, 2, 23, 0),
      endTime: new Date(2026, 8, 3, 1, 0),
      color: '#10B981',
      position: 0,
      intangible: true,
      bufferBeforeMinutes: 30
    };

    const added: TimelineEvent[] = [];
    const updates: Array<{ eventId: string; updates: Partial<TimelineEvent> }> = [];
    const count = addDragonConEvents(
      `Dragon Con 2026 Schedule\nWednesday, Sep 2\nOnesie Wednesday\n11:00PM — 1:00AM\nLocation: Marriott Marquis`,
      [existingEvent],
      (event) => added.push(event),
      (eventId, update) => updates.push({ eventId, updates: update })
    );

    expect(count).toBe(1);
    expect(added).toHaveLength(0);
    expect(updates).toHaveLength(1);
    expect(updates[0]?.eventId).toBe('existing-1');
    expect(updates[0]?.updates.position).toBe(0);
    expect(updates[0]?.updates.color).toBeUndefined();
    expect(updates[0]?.updates.lockTime).toBeUndefined();
    expect(updates[0]?.updates.intangible).toBeUndefined();
    expect(updates[0]?.updates.bufferBeforeMinutes).toBeUndefined();
    expect(updates[0]?.updates.description).toBe('');
  });

  it('overwrites imported source fields on duplicate matches', () => {
    const existingEvent: TimelineEvent = {
      id: 'existing-2',
      title: 'Artemis Spaceship Bridge Simulator',
      description: 'Dragon Con 2026 - Thursday, Sep 3',
      location: 'Westin 12th Floor',
      startTime: new Date(2026, 8, 3, 19, 0),
      endTime: new Date(2026, 8, 3, 23, 55),
      color: '#6B7280',
      position: 3,
      intangible: true,
      bufferBeforeMinutes: 30
    };

    const updates: Array<{ eventId: string; updates: Partial<TimelineEvent> }> = [];

    const count = addDragonConEvents(
      `Dragon Con 2026 Schedule\nThursday, Sep 3\nArtemis Spaceship Bridge Simulator\n7:00PM — 11:55PM\nLocation: Westin 12th Floor`,
      [existingEvent],
      () => undefined,
      (eventId, update) => updates.push({ eventId, updates: update })
    );

    expect(count).toBe(1);
    expect(updates).toHaveLength(1);
    expect(updates[0]?.updates.position).toBe(3);
    expect(updates[0]?.updates.color).toBeUndefined();
    expect(updates[0]?.updates.lockTime).toBeUndefined();
    expect(updates[0]?.updates.intangible).toBeUndefined();
    expect(updates[0]?.updates.bufferBeforeMinutes).toBeUndefined();
    expect(updates[0]?.updates.description).toBe('');
  });

  it('keeps non-prefix text and spacing intact when cleaning descriptions', () => {
    const schedule = `Dragon Con 2026 Schedule
Thursday, Sep 3
Artemis Spaceship Bridge Simulator
7:00PM — 11:55PM
Location: Westin 12th Floor
Speakers:  Dr. Who  and  The  Crew`;

    const events = parseDragonConSchedule(schedule);

    expect(events).toHaveLength(1);
    expect(events[0].description).toBe('Speakers: Dr. Who  and  The  Crew');
  });

  it('also strips DragonCon-prefixed descriptions', () => {
    const schedule = `Dragon Con 2026 Schedule
Thursday, Sep 3
Artemis Spaceship Bridge Simulator
7:00PM — 11:55PM
Location: Westin 12th Floor
Speakers: DragonCon 2026 - Thursday, Sep 3. Sasha Arbogast`;

    const events = parseDragonConSchedule(schedule);

    expect(events).toHaveLength(1);
    expect(events[0].description).toBe('Speakers: Sasha Arbogast');
  });

  it('ignores guest-name lines that appear before the title in PDF extraction order', () => {
    const schedule = `Dragon Con 2026 Schedule
Saturday, Sep 5
Eugene Cordero — , Marie Vibbert — , Jack Campbell —
Cosmere on Apple +
11:30AM — 12:30PM
Location: Marriott L401-L403`;

    const events = parseDragonConSchedule(schedule);

    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Cosmere on Apple +');
    expect(events[0].location).toBe('Marriott L401-L403');
    expect(events[0].description).not.toContain('Eugene Cordero');
    expect(events[0].lockTime).toBe(true);
  });
});

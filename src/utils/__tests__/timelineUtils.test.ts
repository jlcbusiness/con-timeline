import { describe, it, expect } from 'vitest';
import type { TimelineEvent } from '../../types/timeline';
import { roundToNearestHalfHour, getTimePosition, cascadeEventPositions, sortEventsByStructure, findAvailablePosition, repackEventPositions, getIntangibleVisibleSegments, getLocationDisplayColor, eventUpdateAffectsPosition, eventUpdateAttemptsMegaLockedMovement, getRequiredStackSlotCount, getRenderedSlotCount, repackAllEventPositions } from '../timelineUtils';

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

  it('shifts intervening entries up into the source gap when moving down', () => {
    const createEvent = (id: string, position: number): TimelineEvent => ({
      id,
      title: id,
      startTime: new Date(2026, 8, 5, 19),
      endTime: new Date(2026, 8, 5, 20),
      color: '#3b82f6',
      position
    });
    const moved = createEvent('B', 1);
    const events = [
      createEvent('A', 0),
      moved,
      createEvent('C', 2),
      createEvent('D', 3),
      createEvent('E', 4)
    ];

    const updates = cascadeEventPositions(events, moved, { position: 4 }, 6);
    const positions = Object.fromEntries(updates.map(update => [update.eventId, update.updates.position]));

    expect(positions).toEqual({
      C: 1,
      D: 2,
      E: 3
    });
  });

  it('shifts intervening entries down into the source gap when moving up', () => {
    const createEvent = (id: string, position: number): TimelineEvent => ({
      id,
      title: id,
      startTime: new Date(2026, 8, 5, 19),
      endTime: new Date(2026, 8, 5, 20),
      color: '#3b82f6',
      position
    });
    const moved = createEvent('E', 3);
    const events = [createEvent('A', 0), createEvent('C', 1), createEvent('D', 2), moved];

    const updates = cascadeEventPositions(events, moved, { position: 1 }, 6);
    const positions = Object.fromEntries(updates.map(update => [update.eventId, update.updates.position]));

    expect(positions).toEqual({ C: 2, D: 3 });
  });

  it('bypasses a long event when shifting it would cause excessive displacement', () => {
    const moved: TimelineEvent = {
      id: 'moved', title: 'Moved', startTime: new Date(2026, 8, 5, 19), endTime: new Date(2026, 8, 5, 19, 30), color: '#3b82f6', position: 3
    };
    const longEvent: TimelineEvent = {
      id: 'long', title: 'Long', startTime: new Date(2026, 8, 5, 18), endTime: new Date(2026, 8, 5, 22), color: '#8b5cf6', position: 5
    };
    const shortEvents = Array.from({ length: 8 }, (_, index): TimelineEvent => ({
      id: `short-${index}`,
      title: `Short ${index}`,
      startTime: new Date(2026, 8, 5, 18, index * 30),
      endTime: new Date(2026, 8, 5, 18, (index + 1) * 30),
      color: '#10b981',
      position: 4
    }));
    const slotSevenEvent: TimelineEvent = {
      id: 'slot-seven', title: 'Slot Seven', startTime: new Date(2026, 8, 5, 19), endTime: new Date(2026, 8, 5, 19, 30), color: '#f97316', position: 6
    };

    const updates = cascadeEventPositions(
      [moved, longEvent, ...shortEvents, slotSevenEvent],
      moved,
      { position: 5 },
      9
    );
    const positions = Object.fromEntries(updates.map(update => [update.eventId, update.updates.position]));

    expect(positions).toEqual({ moved: 6, 'slot-seven': 7 });
  });

  it('lets a nested conflict jump over an expensive blocker to complete the cascade', () => {
    const createEvent = (id: string, position: number, startHour: number, endHour: number): TimelineEvent => ({
      id,
      title: id,
      startTime: new Date(2026, 8, 5, startHour),
      endTime: new Date(2026, 8, 5, endHour),
      color: '#3b82f6',
      position
    });
    const rose = createEvent('Rose', 2, 13, 17);
    const longMayShe = createEvent('Long May She', 3, 14, 15);
    const spaceMuppets = createEvent('Space Muppets', 4, 14, 15);
    const captainAmerica = createEvent('Captain America', 5, 14, 15);
    const paintBros = createEvent('Paint Bros', 3, 16, 19);
    const residentAlien = createEvent('Resident Alien', 4, 16, 17);
    const batman = createEvent('Batman', 5, 16, 17);

    const updates = cascadeEventPositions(
      [rose, longMayShe, spaceMuppets, captainAmerica, paintBros, residentAlien, batman],
      rose,
      { position: 5 },
      9
    );
    const positions = Object.fromEntries(updates.map(update => [update.eventId, update.updates.position]));

    expect(positions).toEqual({
      'Long May She': 2,
      'Space Muppets': 3,
      'Captain America': 4,
      'Resident Alien': 2,
      Batman: 4
    });
  });

  it('resolves separate time bands in opposite directions for the Sew a Kindle move', () => {
    const createEvent = (
      id: string,
      position: number,
      startHour: number,
      startMinute: number,
      endHour: number,
      endMinute: number
    ): TimelineEvent => ({
      id,
      title: id,
      startTime: new Date(2026, 8, 5, startHour, startMinute),
      endTime: new Date(2026, 8, 5, endHour, endMinute),
      color: '#3b82f6',
      position
    });
    const sew = createEvent('Sew a Kindle', 1, 16, 30, 18, 30);
    const events = [
      sew,
      createEvent('Learn to Hack', 0, 14, 0, 18, 0),
      createEvent('Cold War', 1, 13, 0, 16, 30),
      createEvent('Paint Bros', 2, 16, 0, 18, 30),
      createEvent('Resident Alien', 3, 16, 0, 17, 0),
      createEvent('Gina Torres', 3, 17, 30, 18, 30),
      createEvent('MSFM', 4, 16, 0, 17, 0),
      createEvent('Architecture', 4, 17, 30, 18, 30),
      createEvent("Tzol'kin", 5, 14, 0, 17, 0),
      createEvent('Dungeon Crawler', 5, 17, 30, 18, 30),
      createEvent('Batman', 6, 16, 0, 17, 0),
      createEvent('Medicine', 6, 17, 30, 18, 30),
      createEvent('Jim Butcher', 7, 16, 0, 17, 0),
      createEvent('Moon', 7, 17, 30, 18, 30),
      createEvent('Operational Security', 8, 16, 0, 17, 0),
      createEvent('Star Trek Science', 8, 17, 30, 18, 30),
      createEvent('Edison', 9, 16, 0, 17, 0),
      createEvent('Start Creating', 9, 17, 30, 18, 30),
      createEvent('One Piece', 10, 17, 30, 18, 30)
    ];

    const updates = cascadeEventPositions(events, sew, { position: 3 }, 11);
    const positions = Object.fromEntries(updates.map(update => [update.eventId, update.updates.position]));

    expect(positions).toEqual({
      'Gina Torres': 1,
      'Resident Alien': 4,
      MSFM: 6,
      Batman: 7,
      'Jim Butcher': 8,
      'Operational Security': 9,
      Edison: 10
    });
  });

  it('compacts the prior Sew cascade when the event moves back', () => {
    const createEvent = (id: string, position: number, startHour: number, startMinute: number, endHour: number, endMinute: number): TimelineEvent => ({
      id,
      title: id,
      startTime: new Date(2026, 8, 5, startHour, startMinute),
      endTime: new Date(2026, 8, 5, endHour, endMinute),
      color: '#3b82f6',
      position
    });
    const sew = createEvent('Sew a Kindle', 3, 16, 30, 18, 30);
    const events = [
      sew,
      createEvent('Learn to Hack', 0, 14, 0, 18, 0),
      createEvent('Cold War', 1, 13, 0, 16, 30),
      createEvent('Paint Bros', 2, 16, 0, 18, 30),
      createEvent('Resident Alien', 4, 16, 0, 17, 0),
      createEvent('Gina Torres', 1, 17, 30, 18, 30),
      createEvent('MSFM', 6, 16, 0, 17, 0),
      createEvent("Tzol'kin", 5, 14, 0, 17, 0),
      createEvent('Batman', 7, 16, 0, 17, 0),
      createEvent('Jim Butcher', 8, 16, 0, 17, 0),
      createEvent('Operational Security', 9, 16, 0, 17, 0),
      createEvent('Edison', 10, 16, 0, 17, 0)
    ];

    const updates = cascadeEventPositions(events, sew, { position: 1 }, 11);
    const positions = Object.fromEntries(updates.map(update => [update.eventId, update.updates.position]));

    expect(positions).toEqual({
      'Gina Torres': 3,
      'Resident Alien': 3,
      MSFM: 4,
      Batman: 6,
      'Jim Butcher': 7,
      'Operational Security': 8,
      Edison: 9
    });
  });

  it('bypasses long blockers when an event is dropped into the first slot', () => {
    const createEvent = (id: string, position: number, startHour: number, endHour: number): TimelineEvent => ({
      id,
      title: id,
      startTime: new Date(2026, 8, 5, startHour, 30),
      endTime: new Date(2026, 8, 5, endHour, 30),
      color: '#3b82f6',
      position
    });
    const longMaySheReign = createEvent('Long May She Reign', 3, 14, 15);
    const events = [
      longMaySheReign,
      createEvent('Learn to Hack', 0, 14, 17),
      createEvent('Cold War', 1, 13, 16)
    ];

    const updates = cascadeEventPositions(events, longMaySheReign, { position: 0 }, 11);

    expect(updates).toEqual([
      { eventId: 'Long May She Reign', updates: { position: 2 } }
    ]);
  });

  it('preserves a deliberately requested slot despite a large cascade', () => {
    const moved: TimelineEvent = {
      id: 'moved', title: 'Moved', startTime: new Date(2026, 8, 6, 19), endTime: new Date(2026, 8, 7, 0, 30), color: '#3b82f6', position: 1
    };
    const longBlocker: TimelineEvent = {
      id: 'long', title: 'Long', startTime: new Date(2026, 8, 6, 18), endTime: new Date(2026, 8, 7, 1), color: '#8b5cf6', position: 0
    };
    const cascadeBlockers = [1, 2, 3].map(position => ({
      id: `blocker-${position}`,
      title: `Blocker ${position}`,
      startTime: new Date(2026, 8, 6, 18),
      endTime: new Date(2026, 8, 6, 18, 30),
      color: '#10b981',
      position
    }));

    const updates = cascadeEventPositions(
      [moved, longBlocker, ...cascadeBlockers],
      moved,
      { position: 0 },
      6,
      true
    );
    const movedUpdate = updates.find(update => update.eventId === moved.id);
    const finalMovedPosition = movedUpdate?.updates.position ?? 0;

    expect(finalMovedPosition).toBe(0);
    expect(updates.find(update => update.eventId === longBlocker.id)?.updates.position).toBe(1);
  });

  it('rejects a deliberate move of a Mega-Locked event before honoring its destination', () => {
    const megaLockedEvent: TimelineEvent = {
      id: 'mega-locked',
      title: 'Mega-Locked',
      startTime: new Date(2026, 8, 6, 19),
      endTime: new Date(2026, 8, 6, 20),
      color: '#3b82f6',
      position: 1,
      megaLock: true
    };

    expect(cascadeEventPositions(
      [megaLockedEvent],
      megaLockedEvent,
      { position: 0 },
      2,
      true
    )).toEqual([]);
  });

  it('restores a long event into the vacated source row instead of leaving a deep gap', () => {
    const moved: TimelineEvent = {
      id: 'moved', title: 'Moved', startTime: new Date(2026, 8, 6, 19), endTime: new Date(2026, 8, 7, 0, 30), color: '#3b82f6', position: 0
    };
    const longEvent: TimelineEvent = {
      id: 'long', title: 'Long', startTime: new Date(2026, 8, 6, 10), endTime: new Date(2026, 8, 7, 0), color: '#8b5cf6', position: 1
    };
    const earlyBlockers = [11, 13, 15].map(hour => ({
      id: `early-${hour}`,
      title: `Early ${hour}`,
      startTime: new Date(2026, 8, 6, hour),
      endTime: new Date(2026, 8, 6, hour + 1),
      color: '#10b981',
      position: 0
    }));

    const updates = cascadeEventPositions(
      [moved, longEvent, ...earlyBlockers],
      moved,
      { position: 1 },
      5,
      true
    );
    const positions = Object.fromEntries(updates.map(update => [update.eventId, update.updates.position]));

    expect(positions.long).toBe(0);
    earlyBlockers.forEach(event => expect(positions[event.id]).toBe(1));
  });

  it('moves a long event into the deliberate move source before filling its old row', () => {
    const moved: TimelineEvent = {
      id: 'moved', title: 'Moved', startTime: new Date(2026, 8, 6, 19), endTime: new Date(2026, 8, 7, 0, 30), color: '#3b82f6', position: 1
    };
    const longEvent: TimelineEvent = {
      id: 'long', title: 'Long', startTime: new Date(2026, 8, 6, 10), endTime: new Date(2026, 8, 7, 0), color: '#8b5cf6', position: 0
    };
    const earlyBlockers = [11, 13, 15].map(hour => ({
      id: `early-${hour}`,
      title: `Early ${hour}`,
      startTime: new Date(2026, 8, 6, hour),
      endTime: new Date(2026, 8, 6, hour + 1),
      color: '#10b981',
      position: 1
    }));

    const updates = cascadeEventPositions(
      [moved, longEvent, ...earlyBlockers],
      moved,
      { position: 0 },
      5,
      true
    );
    const positions = Object.fromEntries(updates.map(update => [update.eventId, update.updates.position]));

    expect(positions.long).toBe(1);
    earlyBlockers.forEach(event => expect(positions[event.id]).toBe(0));
  });

  it('compacts separate events into the source row after a time move', () => {
    const createEvent = (
      id: string,
      position: number,
      startHour: number,
      startMinute: number,
      endHour: number,
      endMinute: number
    ): TimelineEvent => ({
      id,
      title: id,
      startTime: new Date(2026, 8, 5, startHour, startMinute),
      endTime: new Date(2026, 8, 5, endHour, endMinute),
      color: '#3b82f6',
      position
    });
    const sew = createEvent('Sew a Kindle', 3, 15, 0, 17, 0);
    const events = [
      createEvent('Learn to Hack', 0, 14, 30, 18, 0),
      createEvent('Cold War', 1, 13, 0, 16, 30),
      createEvent('Long May She Reign', 2, 14, 30, 15, 30),
      sew,
      createEvent('Space Muppets', 4, 14, 30, 15, 30),
      createEvent('Resident Alien', 4, 16, 0, 17, 0),
      createEvent("Tzol'kin", 5, 14, 0, 17, 0)
    ];
    const updates = cascadeEventPositions(events, sew, {
      startTime: new Date(2026, 8, 5, 12, 30),
      endTime: new Date(2026, 8, 5, 14, 30),
      position: 6
    }, 11);
    const positions = Object.fromEntries(updates.map(update => [update.eventId, update.updates.position]));

    expect(positions['Space Muppets']).toBe(3);
    expect(positions['Resident Alien']).toBe(3);
  });

  it('expands beyond the configured slots when every slot is occupied', () => {
    const createEvent = (id: string, position: number, durationHours = 1): TimelineEvent => ({
      id,
      title: id,
      startTime: new Date(2026, 8, 5, 14, 30),
      endTime: new Date(2026, 8, 5, 14 + durationHours, 30),
      color: '#3b82f6',
      position
    });
    const sew: TimelineEvent = {
      ...createEvent('Sew a Kindle', 3, 2),
      startTime: new Date(2026, 8, 5, 16, 30),
      endTime: new Date(2026, 8, 5, 18, 30)
    };
    const spaceMuppets = createEvent('Space Muppets', 3);
    const captainAmerica = createEvent('Captain America', 4);
    const tzolkin = createEvent("Tzol'kin", 5, 3);
    const stargate = createEvent('Stargate', 6);
    const amaze = createEvent('AMAZE', 7);
    const whyNotAi = createEvent('Why Not AI', 8);
    const trial = createEvent('Trial', 9);
    const dawn = createEvent('DAWN', 10);
    const events = [
      createEvent('Learn to Hack', 0, 4),
      createEvent('Cold War', 1, 3),
      createEvent('Long May She', 2),
      sew,
      spaceMuppets,
      captainAmerica,
      tzolkin,
      stargate,
      amaze,
      whyNotAi,
      trial,
      dawn
    ];

    const updatedSew = {
      ...sew,
      startTime: new Date(2026, 8, 5, 14, 30),
      endTime: new Date(2026, 8, 5, 16, 30),
      position: 3
    };
    const requiredSlots = getRequiredStackSlotCount(
      events.map(event => event.id === sew.id ? updatedSew : event),
      10
    );
    const updates = cascadeEventPositions(events, sew, updatedSew, requiredSlots);
    const positions = Object.fromEntries(updates.map(update => [update.eventId, update.updates.position]));

    expect(requiredSlots).toBe(12);
    expect(positions).toEqual({
      'Space Muppets': 4,
      'Captain America': 6,
      Stargate: 7,
      AMAZE: 8,
      'Why Not AI': 9,
      Trial: 10,
      DAWN: 11
    });
  });

  it('shrinks dynamic slots only as far as the configured minimum', () => {
    const createEvent = (id: string, position: number): TimelineEvent => ({
      id,
      title: id,
      startTime: new Date(2026, 8, 5, 14),
      endTime: new Date(2026, 8, 5, 15),
      color: '#3b82f6',
      position
    });
    const events = Array.from({ length: 12 }, (_, index) => createEvent(String(index), index));

    expect(getRequiredStackSlotCount(events, 10)).toBe(12);
    expect(getRequiredStackSlotCount(events.slice(0, 11), 10)).toBe(11);
    expect(getRequiredStackSlotCount(events.slice(0, 10), 10)).toBe(10);
    expect(getRenderedSlotCount(events.slice(0, 10), 10)).toBe(10);
  });

  it('compacts stale high positions after a stacked event is removed', () => {
    const createEvent = (id: string, position: number): TimelineEvent => ({
      id,
      title: id,
      startTime: new Date(2026, 8, 5, 14),
      endTime: new Date(2026, 8, 5, 15),
      color: '#3b82f6',
      position
    });
    const remainingEvents = Array.from({ length: 10 }, (_, index) => createEvent(String(index + 1), index + 1));
    const updates = repackAllEventPositions(remainingEvents, 10);
    const compactedEvents = remainingEvents.map(event => ({
      ...event,
      ...updates.find(update => update.eventId === event.id)?.updates
    }));

    expect(updates).toHaveLength(10);
    expect(getRenderedSlotCount(compactedEvents, 10)).toBe(10);
    expect(compactedEvents.map(event => event.position).sort((left, right) => left - right))
      .toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('keeps multiple ULTRA entries pinned during full repacking', () => {
    const createEvent = (id: string, position: number, megaLock = false): TimelineEvent => ({
      id,
      title: id,
      startTime: new Date(2026, 8, 5, 14),
      endTime: new Date(2026, 8, 5, 15),
      color: '#3b82f6',
      position,
      lockTime: megaLock,
      megaLock
    });
    const events = [
      createEvent('unlocked-a', 4),
      createEvent('unlocked-b', 6),
      createEvent('ultra-a', 8, true),
      createEvent('ultra-b', 9, true)
    ];

    const updates = repackAllEventPositions(events, 10);
    const positions = Object.fromEntries(updates.map(update => [update.eventId, update.updates.position]));

    expect(positions['ultra-a']).toBeUndefined();
    expect(positions['ultra-b']).toBeUndefined();
    expect(positions['unlocked-a']).toBe(0);
    expect(positions['unlocked-b']).toBe(1);
  });

  it('does not move a fully covered intangible ULTRA entry', () => {
    const tangible: TimelineEvent = {
      id: 'tangible', title: 'Tangible', startTime: new Date(2026, 8, 5, 14), endTime: new Date(2026, 8, 5, 16), color: '#3b82f6', position: 7
    };
    const ultraIntangible: TimelineEvent = {
      id: 'ultra-intangible', title: 'ULTRA Intangible', startTime: new Date(2026, 8, 5, 14), endTime: new Date(2026, 8, 5, 16), color: '#8b5cf6', position: 7, intangible: true, lockTime: true, megaLock: true
    };

    expect(repackAllEventPositions([tangible, ultraIntangible], 10)).toEqual([
      { eventId: 'tangible', updates: { position: 0 } }
    ]);
  });

  it('does not cascade Mega-Locked events into another slot', () => {
    const changedEvent = { id: 'changed', startTime: new Date(2025, 7, 27, 10), endTime: new Date(2025, 7, 27, 11), position: 0 };
    const megaLockedEvent = { id: 'mega-locked', megaLock: true, startTime: new Date(2025, 7, 27, 10), endTime: new Date(2025, 7, 27, 11), position: 0 };

    expect(
      cascadeEventPositions([changedEvent, megaLockedEvent] as any, changedEvent as any, {})
    ).toEqual([]);
  });

  it('repairs a collision when an unrelated event is Mega-Locked', () => {
    const changedEvent: TimelineEvent = {
      id: 'changed',
      title: 'Changed',
      startTime: new Date(2026, 8, 6, 20, 30),
      endTime: new Date(2026, 8, 7, 0),
      color: '#3b82f6',
      position: 1
    };
    const conflict: TimelineEvent = {
      id: 'conflict',
      title: 'Conflict',
      startTime: new Date(2026, 8, 6, 19),
      endTime: new Date(2026, 8, 7, 0, 30),
      color: '#3b82f6',
      position: 1
    };
    const unrelatedMegaLock: TimelineEvent = {
      id: 'unrelated-mega-lock',
      title: 'Unrelated Mega-Lock',
      startTime: new Date(2026, 8, 5, 10),
      endTime: new Date(2026, 8, 5, 11),
      color: '#3b82f6',
      position: 4,
      megaLock: true
    };

    const updates = cascadeEventPositions(
      [changedEvent, conflict, unrelatedMegaLock],
      changedEvent,
      { position: 1 },
      11
    );
    const positions = Object.fromEntries(updates.map(update => [update.eventId, update.updates.position]));
    const changedPosition = positions.changed ?? changedEvent.position;
    const conflictPosition = positions.conflict ?? conflict.position;

    expect(positions['unrelated-mega-lock']).toBeUndefined();
    expect(changedPosition).not.toBe(conflictPosition);
  });

  it('does not reposition an event when a modal save only changes its lock mode', () => {
    const event: TimelineEvent = {
      id: 'event',
      title: 'Event',
      startTime: new Date(2026, 8, 5, 19),
      endTime: new Date(2026, 8, 5, 20),
      color: '#8b5cf6',
      position: 1,
      bufferBeforeMinutes: 0,
      lockTime: true,
      megaLock: false
    };

    expect(eventUpdateAffectsPosition(event, {
      startTime: new Date(event.startTime),
      endTime: new Date(event.endTime),
      bufferBeforeMinutes: 0,
      lockTime: true,
      megaLock: true
    })).toBe(false);
  });

  it('allows buffer updates on an ULTRA lock without allowing movement', () => {
    const event: TimelineEvent = {
      id: 'ultra-event',
      title: 'ULTRA Event',
      startTime: new Date(2026, 8, 5, 19),
      endTime: new Date(2026, 8, 5, 20),
      color: '#8b5cf6',
      position: 1,
      bufferBeforeMinutes: 0,
      lockTime: true,
      megaLock: true
    };

    expect(eventUpdateAttemptsMegaLockedMovement(event, { bufferBeforeMinutes: 30 })).toBe(false);
    expect(eventUpdateAttemptsMegaLockedMovement(event, { position: 2 })).toBe(true);
    expect(eventUpdateAttemptsMegaLockedMovement(event, { startTime: new Date(2026, 8, 5, 18, 30) })).toBe(true);
  });

  it('moves an unlocked intangible conflict when a locked event becomes intangible', () => {
    const lockedEvent = {
      id: 'locked',
      lockTime: true,
      startTime: new Date(2025, 7, 27, 10),
      endTime: new Date(2025, 7, 27, 11),
      position: 0
    };
    const existingIntangibleEvent = {
      id: 'existing-intangible',
      intangible: true,
      startTime: new Date(2025, 7, 27, 10),
      endTime: new Date(2025, 7, 27, 11),
      position: 0
    };

    expect(
      cascadeEventPositions(
        [lockedEvent, existingIntangibleEvent] as any,
        lockedEvent as any,
        { intangible: true }
      )
    ).toEqual([{ eventId: 'existing-intangible', updates: { position: 1 } }]);
  });

  it('moves an intangible again when a cascade places it behind a tangible event', () => {
    const changedIntangible = {
      id: 'changed-intangible',
      title: 'Changed Intangible',
      intangible: true,
      startTime: new Date(2025, 7, 27, 10),
      endTime: new Date(2025, 7, 27, 12),
      position: 0
    };
    const cascadedIntangible = {
      id: 'cascaded-intangible',
      title: 'Cascaded Intangible',
      intangible: true,
      startTime: new Date(2025, 7, 27, 10),
      endTime: new Date(2025, 7, 27, 12),
      position: 0
    };
    const tangibleBlocker = {
      id: 'tangible-blocker',
      title: 'Tangible Blocker',
      startTime: new Date(2025, 7, 27, 10),
      endTime: new Date(2025, 7, 27, 12),
      position: 1
    };

    const updates = cascadeEventPositions(
      [changedIntangible, cascadedIntangible, tangibleBlocker] as any,
      changedIntangible as any,
      { position: 0 },
      3
    );

    expect(updates).toEqual([{ eventId: 'cascaded-intangible', updates: { position: 2 } }]);
  });

  it('moves an intangible when a tangible cascade newly covers it', () => {
    const movedTangible = {
      id: 'moved-tangible',
      title: 'Moved Tangible',
      startTime: new Date(2025, 7, 27, 10),
      endTime: new Date(2025, 7, 27, 12),
      position: 0
    };
    const intangible = {
      id: 'intangible',
      title: 'Intangible',
      intangible: true,
      startTime: new Date(2025, 7, 27, 10),
      endTime: new Date(2025, 7, 27, 12),
      position: 1
    };

    const updates = cascadeEventPositions(
      [movedTangible, intangible] as any,
      movedTangible as any,
      { position: 1 },
      3
    );

    expect(updates).toEqual([{ eventId: 'intangible', updates: { position: 0 } }]);
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

  it('moves a fully covered intangible to the nearest row with 30 visible minutes', () => {
    const events = [
      { id: 'solid-top', title: 'Solid Top', startTime: new Date(2025, 8, 4, 10), endTime: new Date(2025, 8, 4, 12), position: 0 },
      { id: 'solid-middle', title: 'Solid Middle', startTime: new Date(2025, 8, 4, 10), endTime: new Date(2025, 8, 4, 11, 45), position: 1 },
      { id: 'ghost', title: 'Ghost', intangible: true, startTime: new Date(2025, 8, 4, 10), endTime: new Date(2025, 8, 4, 12), position: 0 }
    ];

    const updates = repackAllEventPositions(events as any, 3);

    expect(updates.find(update => update.eventId === 'ghost')?.updates.position).toBe(2);
  });

  it('does not move a partially visible intangible during repacking', () => {
    const events = [
      { id: 'solid', title: 'Solid', startTime: new Date(2025, 8, 4, 10), endTime: new Date(2025, 8, 4, 11, 45), position: 0 },
      { id: 'ghost', title: 'Ghost', intangible: true, startTime: new Date(2025, 8, 4, 10), endTime: new Date(2025, 8, 4, 12), position: 0 }
    ];

    expect(repackAllEventPositions(events as any, 2)).toEqual([]);
  });

  it('moves an intangible when resizing removes its last visible section', () => {
    const events = [
      { id: 'solid', title: 'Solid', startTime: new Date(2025, 8, 4, 10), endTime: new Date(2025, 8, 4, 12), position: 0 },
      { id: 'ghost', title: 'Ghost', intangible: true, startTime: new Date(2025, 8, 4, 10), endTime: new Date(2025, 8, 4, 12, 30), position: 0 }
    ];

    const updates = repackEventPositions(events as any, 'ghost', { endTime: new Date(2025, 8, 4, 12), position: 0 }, 2);

    expect(updates.find(update => update.eventId === 'ghost')?.updates.position).toBe(1);
  });

  it('moves an intangible back when resizing restores a 30-minute visible section', () => {
    const events = [
      { id: 'solid', title: 'Solid', startTime: new Date(2025, 8, 4, 10), endTime: new Date(2025, 8, 4, 12), position: 0 },
      { id: 'ghost', title: 'Ghost', intangible: true, startTime: new Date(2025, 8, 4, 10), endTime: new Date(2025, 8, 4, 12), position: 1 }
    ];

    const updates = repackEventPositions(events as any, 'ghost', { endTime: new Date(2025, 8, 4, 12, 30), position: 1 }, 2);

    expect(updates.find(update => update.eventId === 'ghost')?.updates.position).toBe(0);
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

  it('keeps generated move sequences collision-free and settled', () => {
    const configuredSlotCount = 4;
    const timelineStart = new Date(2026, 8, 5, 9);
    const halfHourMs = 30 * 60 * 1000;
    const findCollisions = (events: TimelineEvent[]) => events.flatMap((left, leftIndex) => (
      events.slice(leftIndex + 1)
        .filter(right => (
          Boolean(left.intangible) === Boolean(right.intangible)
          && left.position === right.position
          && left.startTime < right.endTime
          && left.endTime > right.startTime
        ))
        .map(right => `${left.id}/${right.id}@${left.position}`)
    ));

    for (let seed = 1; seed <= 40; seed += 1) {
      let randomState = seed;
      const random = () => {
        randomState = (randomState * 1664525 + 1013904223) >>> 0;
        return randomState / 0x100000000;
      };
      let events: TimelineEvent[] = [];

      for (let index = 0; index < 10; index += 1) {
        const startIncrement = Math.floor(random() * 14);
        const durationIncrements = 1 + Math.floor(random() * 5);
        const event: TimelineEvent = {
          id: `seed-${seed}-event-${index}`,
          title: `Event ${index}`,
          startTime: new Date(timelineStart.getTime() + startIncrement * halfHourMs),
          endTime: new Date(timelineStart.getTime() + (startIncrement + durationIncrements) * halfHourMs),
          color: '#3b82f6',
          position: 0,
          intangible: index % 5 === 0
        };
        event.position = findAvailablePosition(events, event.startTime, event.endTime, event, 10);
        events.push(event);
      }

      for (let step = 0; step < 30; step += 1) {
        const changedEvent = events[Math.floor(random() * events.length)];
        const startIncrement = Math.floor(random() * 14);
        const durationIncrements = 1 + Math.floor(random() * 5);
        const renderedSlotCount = getRenderedSlotCount(events, configuredSlotCount);
        const updates: Partial<TimelineEvent> = {
          startTime: new Date(timelineStart.getTime() + startIncrement * halfHourMs),
          endTime: new Date(timelineStart.getTime() + (startIncrement + durationIncrements) * halfHourMs),
          position: Math.floor(random() * renderedSlotCount)
        };
        const proposedEvents = events.map(event => event.id === changedEvent.id ? { ...event, ...updates } : event);
        const requiredSlotCount = getRequiredStackSlotCount(proposedEvents, configuredSlotCount);
        const cascadeUpdates = cascadeEventPositions(events, changedEvent, updates, requiredSlotCount);
        const changedCascade = cascadeUpdates.find(update => update.eventId === changedEvent.id)?.updates;

        events = events.map(event => {
          const cascadeUpdate = cascadeUpdates.find(update => update.eventId === event.id)?.updates;
          if (event.id === changedEvent.id) return { ...event, ...updates, ...changedCascade };
          return cascadeUpdate ? { ...event, ...cascadeUpdate } : event;
        });

        expect(findCollisions(events), `seed ${seed}, step ${step}`).toEqual([]);
        events.forEach(event => {
          expect(
            cascadeEventPositions(events, event, {}, getRenderedSlotCount(events, configuredSlotCount)),
            `idempotence for seed ${seed}, step ${step}, event ${event.id}`
          ).toEqual([]);
        });
      }
    }
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

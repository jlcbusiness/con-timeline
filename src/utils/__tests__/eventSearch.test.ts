import { describe, expect, it } from 'vitest';
import type { TimelineEvent } from '../../types/timeline';
import { searchEvents, type EventSearchOptions } from '../eventSearch';

const createEvent = (overrides: Partial<TimelineEvent> & Pick<TimelineEvent, 'id' | 'title'>): TimelineEvent => ({
  description: '',
  location: '',
  startTime: new Date('2026-09-03T10:00:00'),
  endTime: new Date('2026-09-03T11:00:00'),
  color: '#3b82f6',
  position: 0,
  ...overrides
});

const defaultOptions: EventSearchOptions = {
  fields: ['title', 'description', 'location'],
  sortField: 'title',
  sortDirection: 'ascending'
};

describe('searchEvents', () => {
  const events = [
    createEvent({ id: 'panel', title: 'Writing Panel', description: 'Meet the authors', location: 'Hilton 201' }),
    createEvent({ id: 'parade', title: 'Parade', description: 'Peachtree Street', location: 'Outside' }),
    createEvent({ id: 'workshop', title: 'Armor Workshop', description: 'Build a parade prop', location: '' })
  ];

  it('matches trimmed case-insensitive substrings in selected fields', () => {
    expect(searchEvents(events, '  PARADE ', defaultOptions).map(event => event.id)).toEqual(['workshop', 'parade']);
    expect(searchEvents(events, 'authors', { ...defaultOptions, fields: ['title'] })).toEqual([]);
    expect(searchEvents(events, 'authors', { ...defaultOptions, fields: ['description'] }).map(event => event.id)).toEqual(['panel']);
  });

  it('returns no results for an empty query or no fields', () => {
    expect(searchEvents(events, '  ', defaultOptions)).toEqual([]);
    expect(searchEvents(events, 'panel', { ...defaultOptions, fields: [] })).toEqual([]);
  });

  it('sorts in either direction and uses start time then title as tie-breakers', () => {
    const sameTitleEvents = [
      createEvent({ id: 'later', title: 'Panel', startTime: new Date('2026-09-03T12:00:00'), endTime: new Date('2026-09-03T13:00:00') }),
      createEvent({ id: 'earlier', title: 'Panel', startTime: new Date('2026-09-03T09:00:00'), endTime: new Date('2026-09-03T10:00:00') })
    ];

    expect(searchEvents(sameTitleEvents, 'panel', defaultOptions).map(event => event.id)).toEqual(['earlier', 'later']);
    expect(searchEvents(events, 'a', { ...defaultOptions, sortDirection: 'descending' }).map(event => event.id)).toEqual(['panel', 'parade', 'workshop']);
  });

  it('sorts by duration', () => {
    const durationEvents = [
      createEvent({ id: 'long', title: 'Panel Long', endTime: new Date('2026-09-03T12:00:00') }),
      createEvent({ id: 'short', title: 'Panel Short', endTime: new Date('2026-09-03T10:30:00') })
    ];

    expect(searchEvents(durationEvents, 'panel', { ...defaultOptions, sortField: 'duration' }).map(event => event.id)).toEqual(['short', 'long']);
  });

  it('keeps blank locations last in either direction', () => {
    expect(searchEvents(events, 'a', { ...defaultOptions, sortField: 'location' }).map(event => event.id)).toEqual(['panel', 'parade', 'workshop']);
    expect(searchEvents(events, 'a', { ...defaultOptions, sortField: 'location', sortDirection: 'descending' }).map(event => event.id)).toEqual(['parade', 'panel', 'workshop']);
  });

  it('searches fandoms and sorts them alphabetically with blanks last', () => {
    const fandomEvents = [
      createEvent({ id: 'blank', title: 'Panel Blank' }),
      createEvent({ id: 'zelda', title: 'Panel Zelda', fandom: 'The Legend of Zelda' }),
      createEvent({ id: 'avatar', title: 'Panel Avatar', fandom: 'Avatar' })
    ];

    expect(searchEvents(fandomEvents, 'zelda', { ...defaultOptions, fields: ['fandom'] }).map(event => event.id)).toEqual(['zelda']);
    expect(searchEvents(fandomEvents, 'panel', { ...defaultOptions, sortField: 'fandom' }).map(event => event.id)).toEqual(['avatar', 'zelda', 'blank']);
    expect(searchEvents(fandomEvents, 'panel', { ...defaultOptions, sortField: 'fandom', sortDirection: 'descending' }).map(event => event.id)).toEqual(['zelda', 'avatar', 'blank']);
  });
});
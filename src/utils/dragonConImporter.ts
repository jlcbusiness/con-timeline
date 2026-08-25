import type { TimelineEvent } from '../types/timeline';
import { findAvailablePosition, sortEventsByStructure } from './timelineUtils';

const DEFAULT_DRAGONCON_YEAR = 2026;
const DRAGONCON_IMPORT_COLOR = '#6B7280';

const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11
};

const WEEKDAY_REGEX = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+([A-Za-z]+)\s+(\d{1,2})$/i;
const LEGACY_EVENT_REGEX = /^(.+?)\s*-\s*(\w+),\s*(\w+)\s+(\d+)\s+(.+)$/;
const TITLE_AND_TIME_REGEX = /^(.*?)\s+(\d{1,2}:\d{2}\s*(?:AM|PM)\s*[—-]\s*\d{1,2}:\d{2}\s*(?:AM|PM))$/i;
const TIME_RANGE_REGEX = /(\d{1,2}):(\d{2})\s*(AM|PM)\s*[—-]\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i;

const normalizeLines = (scheduleText: string) =>
  scheduleText
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

const inferYear = (scheduleText: string, fallbackYear = DEFAULT_DRAGONCON_YEAR) => {
  const headerMatch = scheduleText.match(/Dragon Con\s+(20\d{2})/i);
  return headerMatch ? Number(headerMatch[1]) : fallbackYear;
};

const monthIndexFor = (month: string) => MONTH_INDEX[month.toLowerCase()] ?? MONTH_INDEX[month.slice(0, 3).toLowerCase()];

const isNoiseLine = (line: string) => (
  /^Dragon Con\s+20\d{2}\b/i.test(line)
  || /^Print Schedule$/i.test(line)
  || /^Location:\s*$/i.test(line)
  || /^Speakers:\s*$/i.test(line)
  || /^\d+ of \d+\b/i.test(line)
  || /https?:\/\//i.test(line)
);

const parseDayHeading = (line: string, year: number) => {
  const match = line.match(WEEKDAY_REGEX);
  if (!match) return null;

  const [, , monthName, dayString] = match;
  const monthIndex = monthIndexFor(monthName);
  if (monthIndex === undefined) return null;

  return new Date(year, monthIndex, Number(dayString), 0, 0, 0, 0);
};

const parseClockTime = (hourString: string, minuteString: string, meridiem: string) => {
  let hour = Number(hourString);
  const minute = Number(minuteString);

  if (meridiem.toUpperCase() === 'PM' && hour !== 12) {
    hour += 12;
  } else if (meridiem.toUpperCase() === 'AM' && hour === 12) {
    hour = 0;
  }

  return hour * 60 + minute;
};

const parseTimeRange = (text: string) => {
  const match = text.match(TIME_RANGE_REGEX);
  if (!match) return null;

  const [, startHour, startMinute, startMeridiem, endHour, endMinute, endMeridiem] = match;

  return {
    startMinutes: parseClockTime(startHour, startMinute, startMeridiem),
    endMinutes: parseClockTime(endHour, endMinute, endMeridiem)
  };
};

const buildEventDate = (day: Date, minutesFromMidnight: number) => {
  const eventDate = new Date(day);
  eventDate.setHours(Math.floor(minutesFromMidnight / 60), minutesFromMidnight % 60, 0, 0);
  return eventDate;
};

const normalizeLocation = (value: string) => value.replace(/^Location:\s*/i, '').replace(/\s+https?:\/\/.*$/i, '').trim();
const normalizeSpeakers = (value: string) => value.replace(/^Speakers:\s*/i, '').trim();

const isLikelyGuestListLine = (line: string) => (
  line.includes('—')
  && line.includes(',')
  && /[A-Z][a-z]/.test(line)
);

const isLikelyTitleLine = (line: string) => (
  !isNoiseLine(line)
  && !parseDayHeading(line, DEFAULT_DRAGONCON_YEAR)
  && !/^Location:\s*/i.test(line)
  && !/^Speakers:\s*/i.test(line)
  && !isLikelyGuestListLine(line)
  && line.length <= 140
);

const getDurationMinutes = (title: string) => {
  const lowerTitle = title.toLowerCase();

  if (lowerTitle.includes('workshop') || lowerTitle.includes('megagame') || lowerTitle.includes('singalong')) {
    return 90;
  }

  if (lowerTitle.includes('live') || lowerTitle.includes('karaoke')) {
    return 120;
  }

  return 60;
};

const buildEvent = (
  title: string,
  day: Date,
  timeRange: { startMinutes: number; endMinutes: number },
  index: number,
  year: number,
  location?: string,
  speakers?: string
): TimelineEvent => {
  const startTime = buildEventDate(day, timeRange.startMinutes);
  const endTime = buildEventDate(day, timeRange.endMinutes);

  if (endTime <= startTime) {
    endTime.setDate(endTime.getDate() + 1);
  }

  return {
    id: `dragoncon-${year}-${index}-${Date.now()}`,
    title: title.trim(),
    description: speakers
      ? `Dragon Con ${year} - ${day.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}. Speakers: ${speakers}`
      : `Dragon Con ${year} - ${day.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`,
    location,
    startTime,
    endTime,
    color: DRAGONCON_IMPORT_COLOR,
    position: 0,
    lockTime: true
  };
};

const mergeParsedEvents = (events: TimelineEvent[]) => {
  const merged = new Map<string, TimelineEvent>();

  events.forEach(event => {
    const key = [event.title.trim().toLowerCase(), event.startTime.toISOString(), event.endTime.toISOString()].join('|');
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, event);
      return;
    }

    merged.set(key, {
      ...existing,
      ...event,
      location: event.location || existing.location,
      description: event.description || existing.description
    });
  });

  return Array.from(merged.values());
};

const parseLegacySchedule = (lines: string[], year: number) => {
  return lines.flatMap((line, index) => {
    const match = line.match(LEGACY_EVENT_REGEX);
    if (!match) return [];

    const [, title, dayOfWeek, month, day, timeText] = match;
    const timeMatch = timeText.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!timeMatch) return [];

    const [, hourString, minuteString, meridiem] = timeMatch;
    const monthIndex = monthIndexFor(month);
    if (monthIndex === undefined) return [];

    let hour = Number(hourString);
    const minute = Number(minuteString);

    if (meridiem.toUpperCase() === 'PM' && hour !== 12) {
      hour += 12;
    } else if (meridiem.toUpperCase() === 'AM' && hour === 12) {
      hour = 0;
    }

    const eventDate = new Date(year, monthIndex, Number(day), hour, minute, 0, 0);
    const durationMinutes = getDurationMinutes(title);
    const endDate = new Date(eventDate.getTime() + durationMinutes * 60 * 1000);

    return [{
      id: `dragoncon-legacy-${year}-${index}-${Date.now()}`,
      title: title.trim(),
      description: `Dragon Con ${year} - ${dayOfWeek}, ${month} ${day}`,
      location: 'Dragon Con',
      startTime: eventDate,
      endTime: endDate,
      color: DRAGONCON_IMPORT_COLOR,
      position: 0,
      lockTime: true
    }];
  });
};

const parseBlockSchedule = (lines: string[], year: number) => {
  const events: TimelineEvent[] = [];
  let currentDay: Date | null = null;
  let preEventLines: string[] = [];
  let lastEvent: TimelineEvent | null = null;

  const createEventFromBufferedLines = (timeLine: string) => {
    if (!currentDay) return false;

    const timeRange = parseTimeRange(timeLine);
    if (!timeRange) return false;

    const titleParts = preEventLines.filter(isLikelyTitleLine);
    if (titleParts.length === 0) return false;

    const title = titleParts[titleParts.length - 1].trim();
    const event = buildEvent(title, currentDay, timeRange, events.length, year);
    events.push(event);
    lastEvent = event;
    preEventLines = [];
    return true;
  };

  lines.forEach(line => {
    if (isNoiseLine(line)) return;

    const dayHeading = parseDayHeading(line, year);
    if (dayHeading) {
      currentDay = dayHeading;
      preEventLines = [];
      lastEvent = null;
      return;
    }

    if (createEventFromBufferedLines(line)) {
      return;
    }

    const titleAndTimeMatch = line.match(TITLE_AND_TIME_REGEX);
    if (titleAndTimeMatch && currentDay) {
      const [, title, timeText] = titleAndTimeMatch;
      const timeRange = parseTimeRange(timeText);
      if (timeRange) {
        const event = buildEvent(title, currentDay, timeRange, events.length, year);
        events.push(event);
        lastEvent = event;
        preEventLines = [];
        return;
      }
    }

    const locationMatch = line.match(/^Location:\s*(.+)$/i);
    if (locationMatch && lastEvent) {
      lastEvent.location = normalizeLocation(locationMatch[0]);
      return;
    }

    const speakersMatch = line.match(/^Speakers:\s*(.+)$/i);
    if (speakersMatch && lastEvent) {
      const speakers = normalizeSpeakers(speakersMatch[0]);
      lastEvent.description = `${lastEvent.description || ''}${lastEvent.description ? ' ' : ''}Speakers: ${speakers}`.trim();
      return;
    }

    if (currentDay) {
      preEventLines.push(line);
    }
  });

  return events;
};

export const parseDragonConSchedule = (scheduleText: string): TimelineEvent[] => {
  const lines = normalizeLines(scheduleText);
  const year = inferYear(scheduleText);
  const legacyEvents = parseLegacySchedule(lines, year);
  const blockEvents = parseBlockSchedule(lines, year);

  return mergeParsedEvents([...legacyEvents, ...blockEvents]);
};

const eventKey = (event: TimelineEvent) => [
  event.title.trim().toLowerCase(),
  event.startTime.toISOString(),
  event.endTime.toISOString()
].join('|');

export const addDragonConEvents = (
  scheduleText: string,
  existingEvents: TimelineEvent[],
  addEvent: (event: TimelineEvent) => void,
  updateEvent?: (eventId: string, updates: Partial<TimelineEvent>) => void
) => {
  const newEvents = sortEventsByStructure(parseDragonConSchedule(scheduleText));
  const importedKeys = new Set<string>();
  let importedCount = 0;

  newEvents.forEach(event => {
    const key = eventKey(event);
    if (importedKeys.has(key)) {
      return;
    }

    const position = findAvailablePosition(existingEvents, event.startTime, event.endTime);
    const eventWithPosition = { ...event, position };

    const existingIndex = existingEvents.findIndex(existingEvent => eventKey(existingEvent) === key);
    if (existingIndex !== -1) {
      const existingEvent = existingEvents[existingIndex];
      const replacedEvent = {
        ...eventWithPosition,
        ...existingEvent,
        id: existingEvent.id,
        createdAt: existingEvent.createdAt,
        color: existingEvent.color,
        updatedAt: new Date().toISOString()
      };

      existingEvents[existingIndex] = replacedEvent;

      if (updateEvent) {
        updateEvent(existingEvent.id, {
          ...eventWithPosition,
          id: existingEvent.id,
          createdAt: existingEvent.createdAt,
          color: existingEvent.color,
          lockTime: true,
          updatedAt: replacedEvent.updatedAt
        });
      }
    } else {
      addEvent(eventWithPosition);
      existingEvents.push(eventWithPosition);
    }

    importedKeys.add(key);
    importedCount++;
  });

  return importedCount;
};

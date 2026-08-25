import type { TimelineEvent } from '../types/timeline';
import { PIXELS_PER_HOUR } from '../config/timeline';

export const generateTimeSlots = (startDate: Date, endDate: Date): Date[] => {
  const slots: Date[] = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    slots.push(new Date(current));
    current.setHours(current.getHours() + 1);
  }
  
  return slots;
};

export const formatTimeSlot = (date: Date): string => {
  const hours = date.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours} ${ampm}`;
};

export const formatDateHeader = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
};

export const getDayKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDayKey = (dayKey: string): Date => {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year || 0, (month || 1) - 1, day || 1);
};

export const getEventDurationInHours = (startTime: Date, endTime: Date): number => {
  return (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
};

export const getEventDurationInMinutes = (startTime: Date, endTime: Date): number => {
  return (endTime.getTime() - startTime.getTime()) / (1000 * 60);
};

const VENUE_GROUP_ORDER = [
  'marriott',
  'westin',
  'hyatt',
  'hilton',
  'courtland grand',
  'mart',
  'streaming'
];

export const getVenueGroupRank = (location?: string): number => {
  if (!location?.trim()) return VENUE_GROUP_ORDER.length;

  const normalizedLocation = location.trim().toLowerCase();
  const matchedIndex = VENUE_GROUP_ORDER.findIndex(group => normalizedLocation.startsWith(group) || normalizedLocation.includes(` ${group}`));

  return matchedIndex === -1 ? VENUE_GROUP_ORDER.length : matchedIndex;
};

export const getLocationSortKey = (location?: string): string => {
  return location?.trim().toLowerCase() || '';
};

export const isIntangibleEvent = (event: TimelineEvent): boolean => event.intangible === true;

const getCollisionGroup = (event: TimelineEvent): 'tangible' | 'intangible' => (
  isIntangibleEvent(event) ? 'intangible' : 'tangible'
);

const packEventsByStructure = (events: TimelineEvent[]): TimelineEvent[] => {
  const packedEvents: TimelineEvent[] = [];

  sortEventsForPackingGroup(events).forEach(event => {
    const position = findAvailablePosition(packedEvents, event.startTime, event.endTime);
    packedEvents.push({ ...event, position });
  });

  return packedEvents;
};

const buildPackedPositionMap = (events: TimelineEvent[]): Map<string, number> => {
  return new Map(
    packEventsByStructure(events).map(event => [event.id, event.position] as const)
  );
};

const overlapsWithoutBuffer = (left: TimelineEvent, right: TimelineEvent): boolean => {
  return left.startTime < right.endTime && left.endTime > right.startTime;
};

const getConnectedOverlapCluster = (
  seed: TimelineEvent,
  events: TimelineEvent[],
  visited: Set<string>
): TimelineEvent[] => {
  const cluster: TimelineEvent[] = [];
  const stack = [seed];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || visited.has(current.id)) continue;

    visited.add(current.id);
    cluster.push(current);

    events.forEach(candidate => {
      if (!visited.has(candidate.id) && overlapsWithoutBuffer(current, candidate)) {
        stack.push(candidate);
      }
    });
  }

  return cluster;
};

const sortClusterEvents = (events: TimelineEvent[]): TimelineEvent[] => {
  return [...events].map((event, sourceIndex) => ({ event, sourceIndex })).sort((left, right) => {
    const leftDuration = getEventDurationInMinutes(left.event.startTime, left.event.endTime);
    const rightDuration = getEventDurationInMinutes(right.event.startTime, right.event.endTime);
    const leftVenueRank = getVenueGroupRank(left.event.location);
    const rightVenueRank = getVenueGroupRank(right.event.location);
    const leftLocationKey = getLocationSortKey(left.event.location);
    const rightLocationKey = getLocationSortKey(right.event.location);

    return rightDuration - leftDuration
      || leftVenueRank - rightVenueRank
      || leftLocationKey.localeCompare(rightLocationKey)
      || left.event.startTime.getTime() - right.event.startTime.getTime()
      || left.sourceIndex - right.sourceIndex;
  }).map(({ event }) => event);
};

const sortEventsForPackingGroup = (events: TimelineEvent[]): TimelineEvent[] => {
  const sortedByStart = [...events].sort((left, right) => {
    const leftStart = left.startTime.getTime();
    const rightStart = right.startTime.getTime();
    const leftDuration = getEventDurationInMinutes(left.startTime, left.endTime);
    const rightDuration = getEventDurationInMinutes(right.startTime, right.endTime);

    return leftStart - rightStart
      || rightDuration - leftDuration
      || left.endTime.getTime() - right.endTime.getTime();
  });

  const clusters: TimelineEvent[][] = [];
  const visited = new Set<string>();

  sortedByStart.forEach(event => {
    if (visited.has(event.id)) return;
    clusters.push(getConnectedOverlapCluster(event, sortedByStart, visited));
  });

  return clusters
    .map(cluster => ({
      cluster,
      clusterStart: Math.min(...cluster.map(event => event.startTime.getTime())),
      clusterLongest: Math.max(...cluster.map(event => getEventDurationInMinutes(event.startTime, event.endTime)))
    }))
    .sort((left, right) => left.clusterStart - right.clusterStart || right.clusterLongest - left.clusterLongest)
    .flatMap(({ cluster }) => sortClusterEvents(cluster));
};

export const sortEventsForPacking = (events: TimelineEvent[]): TimelineEvent[] => {
  const tangibleEvents = events.filter(event => !isIntangibleEvent(event));
  const intangibleEvents = events.filter(isIntangibleEvent);

  return sortEventsForPackingGroup(tangibleEvents).concat(sortEventsForPackingGroup(intangibleEvents));
};

export const sortEventsByStructure = (events: TimelineEvent[]): TimelineEvent[] => {
  return sortEventsForPacking(events);
};

export const getBufferedStartTime = (event: TimelineEvent): Date => {
  const bufferBeforeMinutes = event.bufferBeforeMinutes ?? 0;
  return new Date(event.startTime.getTime() - bufferBeforeMinutes * 60 * 1000);
};

export const getEventBufferWidth = (event: TimelineEvent): number => {
  const bufferBeforeMinutes = event.bufferBeforeMinutes ?? 0;
  return Math.round(bufferBeforeMinutes * (PIXELS_PER_HOUR / 60));
};

export const roundToNearestHalfHour = (date: Date): Date => {
  const minutes = date.getMinutes();
  const roundedMinutes = minutes < 15 ? 0 : minutes < 45 ? 30 : 60;
  
  const rounded = new Date(date);
  rounded.setMinutes(roundedMinutes);
  rounded.setSeconds(0);
  rounded.setMilliseconds(0);
  
  if (roundedMinutes === 60) {
    rounded.setHours(rounded.getHours() + 1);
    rounded.setMinutes(0);
  }
  
  return rounded;
};

// Check if two events overlap in time
export const eventsOverlap = (event1: TimelineEvent, event2: TimelineEvent): boolean => {
  return getBufferedStartTime(event1) < event2.endTime && event1.endTime > getBufferedStartTime(event2);
};

const eventsOverlapWithoutBuffer = (event1: TimelineEvent, event2: TimelineEvent): boolean => {
  return event1.startTime < event2.endTime && event1.endTime > event2.startTime;
};

// Find available position for a single event (now supports 10 slots: 0-9)
export const findAvailablePosition = (
  events: TimelineEvent[],
  startTime: Date,
  endTime: Date,
  groupEvent?: TimelineEvent
): number => {
  const collisionGroup = groupEvent ? getCollisionGroup(groupEvent) : undefined;
  const overlappingEvents = events.filter(event => 
    (collisionGroup ? getCollisionGroup(event) === collisionGroup : true) &&
    (startTime < event.endTime && endTime > getBufferedStartTime(event))
  );
  
  const usedPositions = new Set(overlappingEvents.map(e => e.position));
  
  for (let i = 0; i < 10; i++) { // Changed from 8 to 10
    if (!usedPositions.has(i)) {
      return i;
    }
  }
  
  return 0; // Fallback to position 0 if all positions are taken
};

// Simplified and more reliable cascading algorithm (now supports 10 slots)
export const cascadeEventPositions = (
  allEvents: TimelineEvent[],
  changedEvent: TimelineEvent,
  changedEventUpdates: Partial<TimelineEvent>
): { eventId: string; updates: Partial<TimelineEvent> }[] => {
  const updates: { eventId: string; updates: Partial<TimelineEvent> }[] = [];
  
  // Create the updated version of the changed event
  const updatedChangedEvent = { ...changedEvent, ...changedEventUpdates };

  // Get all other events
  const collisionGroup = getCollisionGroup(updatedChangedEvent);
  const otherEvents = allEvents.filter(e => e.id !== changedEvent.id && getCollisionGroup(e) === collisionGroup);
  
  // Find events that overlap in time AND are in the same position as the changed event
  const directConflicts = otherEvents.filter(event => 
    event.position === updatedChangedEvent.position && 
    eventsOverlapWithoutBuffer(updatedChangedEvent, event)
  );
  
  // If no direct conflicts, no cascading needed
  if (directConflicts.length === 0) {
    return updates;
  }
  
  // For each conflicting event, find it a new position
  const sortedConflicts = [...directConflicts].sort((left, right) => {
    const leftDuration = getEventDurationInMinutes(left.startTime, left.endTime);
    const rightDuration = getEventDurationInMinutes(right.startTime, right.endTime);
    const leftVenueRank = getVenueGroupRank(left.location);
    const rightVenueRank = getVenueGroupRank(right.location);
    const leftLocationKey = getLocationSortKey(left.location);
    const rightLocationKey = getLocationSortKey(right.location);

    return rightDuration - leftDuration
      || leftVenueRank - rightVenueRank
      || leftLocationKey.localeCompare(rightLocationKey)
      || left.position - right.position
      || left.startTime.getTime() - right.startTime.getTime()
      || left.endTime.getTime() - right.endTime.getTime();
  });

  sortedConflicts.forEach(conflictingEvent => {
    // Create a temporary list of events to check against (excluding the conflicting event)
    const eventsToCheckAgainst = [
      updatedChangedEvent, // The changed event is now in this position
      ...otherEvents.filter(e => e.id !== conflictingEvent.id)
    ];
    
    // Find the first available position for this conflicting event
    let newPosition = 0;
    let positionFound = false;
    
    for (let pos = 0; pos < 10 && !positionFound; pos++) { // Changed from 8 to 10
      // Check if this position has any time conflicts
      const hasConflict = eventsToCheckAgainst.some(otherEvent => 
        otherEvent.position === pos && eventsOverlapWithoutBuffer(conflictingEvent, otherEvent)
      );
      
      if (!hasConflict) {
        newPosition = pos;
        positionFound = true;
      }
    }
    
    // If we couldn't find a free position, use the last slot
    if (!positionFound) {
      newPosition = 9; // Changed from 7 to 9
    }
    
    // Only add update if position actually changes
    if (newPosition !== conflictingEvent.position) {
      updates.push({
        eventId: conflictingEvent.id,
        updates: { position: newPosition }
      });
      
      // Update our temporary list for the next iteration
      const eventIndex = eventsToCheckAgainst.findIndex(e => e.id === conflictingEvent.id);
      if (eventIndex !== -1) {
        eventsToCheckAgainst[eventIndex] = { ...conflictingEvent, position: newPosition };
      } else {
        eventsToCheckAgainst.push({ ...conflictingEvent, position: newPosition });
      }
    }
  });
  
  return updates;
};

export const repackEventPositions = (
  allEvents: TimelineEvent[],
  changedEventId: string,
  changedEventUpdates: Partial<TimelineEvent>
): { eventId: string; updates: Partial<TimelineEvent> }[] => {
  const updatedEvents = allEvents.map(event => (
    event.id === changedEventId ? { ...event, ...changedEventUpdates } : event
  ));

  const changedEventBeforeUpdate = allEvents.find(event => event.id === changedEventId);
  const changedEventAfterUpdate = updatedEvents.find(event => event.id === changedEventId);

  if (!changedEventAfterUpdate) {
    return [];
  }

  const affectedGroups = new Set<'tangible' | 'intangible'>([
    getCollisionGroup(changedEventAfterUpdate),
    ...(changedEventBeforeUpdate ? [getCollisionGroup(changedEventBeforeUpdate)] : [])
  ]);

  const updates: { eventId: string; updates: Partial<TimelineEvent> }[] = [];

  affectedGroups.forEach(group => {
    const groupEvents = updatedEvents.filter(event => getCollisionGroup(event) === group);
    const packedPositions = buildPackedPositionMap(groupEvents);

    groupEvents.forEach(event => {
      const nextPosition = packedPositions.get(event.id);

      if (nextPosition == null || nextPosition === event.position) {
        return;
      }

      updates.push({ eventId: event.id, updates: { position: nextPosition } });
    });
  });

  return updates;
};

export const getIntangibleVisibleSegments = (
  event: TimelineEvent,
  allEvents: TimelineEvent[]
): Array<{ startTime: Date; endTime: Date }> => {
  if (!event.intangible) {
    return [{ startTime: event.startTime, endTime: event.endTime }];
  }

  const coveringIntervals = allEvents
    .filter(otherEvent =>
      otherEvent.id !== event.id &&
      otherEvent.position === event.position &&
      !isIntangibleEvent(otherEvent)
    )
    .map(otherEvent => ({
      startTime: getBufferedStartTime(otherEvent) > event.startTime ? getBufferedStartTime(otherEvent) : event.startTime,
      endTime: otherEvent.endTime < event.endTime ? otherEvent.endTime : event.endTime
    }))
    .filter(interval => interval.endTime > interval.startTime)
    .sort((left, right) => left.startTime.getTime() - right.startTime.getTime() || left.endTime.getTime() - right.endTime.getTime());

  const mergedCoveringIntervals: Array<{ startTime: Date; endTime: Date }> = [];

  coveringIntervals.forEach(interval => {
    const lastInterval = mergedCoveringIntervals[mergedCoveringIntervals.length - 1];
    if (!lastInterval || interval.startTime > lastInterval.endTime) {
      mergedCoveringIntervals.push({ ...interval });
      return;
    }

    if (interval.endTime > lastInterval.endTime) {
      lastInterval.endTime = interval.endTime;
    }
  });

  const visibleSegments: Array<{ startTime: Date; endTime: Date }> = [];
  let currentStart = new Date(event.startTime);

  mergedCoveringIntervals.forEach(interval => {
    if (interval.startTime > currentStart) {
      visibleSegments.push({ startTime: new Date(currentStart), endTime: new Date(interval.startTime) });
    }

    if (interval.endTime > currentStart) {
      currentStart = new Date(interval.endTime);
    }
  });

  if (currentStart < event.endTime) {
    visibleSegments.push({ startTime: new Date(currentStart), endTime: new Date(event.endTime) });
  }

  return visibleSegments.filter(segment => segment.endTime > segment.startTime);
};

export const getEventColors = (): string[] => [
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#8B5CF6', // Purple
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#6B7280', // Grey - NEW 9th color!
];

// UNIFIED POSITIONING FUNCTION - used by both headers and events
export const getTimePosition = (time: Date, startDate: Date): number => {
  const timeDiffMs = time.getTime() - startDate.getTime();
  const timeDiffHours = timeDiffMs / (1000 * 60 * 60);
  // Use Math.round to ensure consistent pixel positioning
  return Math.round(timeDiffHours * PIXELS_PER_HOUR); // px per hour
};

export const getEventWidth = (startTime: Date, endTime: Date): number => {
  const durationInMs = endTime.getTime() - startTime.getTime();
  const durationInHours = durationInMs / (1000 * 60 * 60);
  // Use Math.round to ensure consistent pixel positioning
  return Math.round(durationInHours * PIXELS_PER_HOUR); // px per hour
};

// Helper function to convert time to half-hour increments for positioning
export const getHalfHourPosition = (time: Date, startDate: Date): number => {
  const diffInMs = time.getTime() - startDate.getTime();
  const diffInMinutes = diffInMs / (1000 * 60);
  const halfHourIncrements = diffInMinutes / 30;
  return halfHourIncrements * (PIXELS_PER_HOUR / 2); // px per half-hour
};

// Helper function to get event width in half-hour increments
export const getEventWidthInHalfHours = (startTime: Date, endTime: Date): number => {
  const durationInMs = endTime.getTime() - startTime.getTime();
  const durationInMinutes = durationInMs / (1000 * 60);
  const halfHourIncrements = durationInMinutes / 30;
  return halfHourIncrements * (PIXELS_PER_HOUR / 2); // px per half-hour
};

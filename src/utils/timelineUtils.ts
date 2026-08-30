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

export const getRequiredStackSlotCount = (events: TimelineEvent[], minimumSlotCount = 1): number => {
  const maximumForGroup = (groupEvents: TimelineEvent[]) => {
    const boundaries = groupEvents.flatMap(event => [
      { time: getBufferedStartTime(event).getTime(), delta: 1 },
      { time: event.endTime.getTime(), delta: -1 }
    ]).sort((left, right) => left.time - right.time || left.delta - right.delta);
    let activeCount = 0;
    let maximumCount = 0;

    boundaries.forEach(boundary => {
      activeCount += boundary.delta;
      maximumCount = Math.max(maximumCount, activeCount);
    });

    return maximumCount;
  };

  return Math.max(
    minimumSlotCount,
    maximumForGroup(events.filter(event => !isIntangibleEvent(event))),
    maximumForGroup(events.filter(isIntangibleEvent))
  );
};

export const getRenderedSlotCount = (events: TimelineEvent[], minimumSlotCount = 1): number => (
  Math.max(
    getRequiredStackSlotCount(events, minimumSlotCount),
    ...events.map(event => event.position + 1)
  )
);

const packEventsByStructure = (events: TimelineEvent[], maxSlots = 11): TimelineEvent[] => {
  const packedEvents: TimelineEvent[] = [];

  sortEventsForPackingGroup(events).forEach(event => {
    const position = findAvailablePosition(packedEvents, event.startTime, event.endTime, event, maxSlots);
    packedEvents.push({ ...event, position });
  });

  return packedEvents;
};

const buildPackedPositionMap = (events: TimelineEvent[], maxSlots = 11): Map<string, number> => {
  return new Map(
    packEventsByStructure(events, maxSlots).map(event => [event.id, event.position] as const)
  );
};

const MINIMUM_INTANGIBLE_VISIBLE_MS = 30 * 60 * 1000;

const hasMinimumIntangibleVisibility = (event: TimelineEvent, events: TimelineEvent[]): boolean => (
  getIntangibleVisibleSegments(event, events).some(segment => (
    segment.endTime.getTime() - segment.startTime.getTime() >= MINIMUM_INTANGIBLE_VISIBLE_MS
  ))
);

const adjustPackedIntangibleVisibility = (
  events: TimelineEvent[],
  maxSlots: number,
  candidateEventIds?: Set<string>
): Map<string, number> => {
  const resolvedEvents = events.map(event => ({ ...event }));
  const positions = new Map(resolvedEvents.map(event => [event.id, event.position] as const));

  resolvedEvents.filter(event => (
    isIntangibleEvent(event) && (!candidateEventIds || candidateEventIds.has(event.id))
  )).forEach(event => {
    if (getIntangibleVisibleSegments(event, resolvedEvents).length > 0) return;

    const candidatePositions = Array.from({ length: maxSlots }, (_, position) => position)
      .filter(position => position !== event.position)
      .sort((left, right) => Math.abs(left - event.position) - Math.abs(right - event.position) || left - right);
    const nextPosition = candidatePositions.find(position => {
      const candidate = { ...event, position };
      const hasIntangibleCollision = resolvedEvents.some(otherEvent => (
        otherEvent.id !== event.id
        && isIntangibleEvent(otherEvent)
        && otherEvent.position === position
        && eventsOverlapWithoutBuffer(candidate, otherEvent)
      ));

      return !hasIntangibleCollision && hasMinimumIntangibleVisibility(candidate, resolvedEvents);
    });

    if (nextPosition === undefined) return;

    event.position = nextPosition;
    positions.set(event.id, nextPosition);
  });

  return positions;
};

const buildCollisionFreePositionMap = (
  events: TimelineEvent[],
  maxSlots: number,
  preserveMegaLocks = false
): Map<string, number> => {
  const packedEvents = preserveMegaLocks
    ? events.filter(event => event.megaLock).map(event => ({ ...event }))
    : [];
  const sortedEvents = events.filter(event => !preserveMegaLocks || !event.megaLock).sort((left, right) => (
    left.startTime.getTime() - right.startTime.getTime()
    || left.endTime.getTime() - right.endTime.getTime()
    || left.id.localeCompare(right.id)
  ));

  sortedEvents.forEach(event => {
    const position = findAvailablePosition(packedEvents, event.startTime, event.endTime, event, maxSlots);
    packedEvents.push({ ...event, position });
  });

  return new Map(packedEvents.map(event => [event.id, event.position] as const));
};

export const repackAllEventPositions = (
  events: TimelineEvent[],
  maxSlots: number
): { eventId: string; updates: Partial<TimelineEvent> }[] => {
  const updates: { eventId: string; updates: Partial<TimelineEvent> }[] = [];

  (['tangible', 'intangible'] as const).forEach(group => {
    const groupEvents = events.filter(event => getCollisionGroup(event) === group);
    const packedPositions = buildPackedPositionMap(groupEvents, maxSlots);

    groupEvents.forEach(event => {
      const position = packedPositions.get(event.id);
      if (position !== undefined && position !== event.position) {
        updates.push({ eventId: event.id, updates: { position } });
      }
    });
  });

  const packedEvents = events.map(event => {
    const position = updates.find(update => update.eventId === event.id)?.updates.position;
    return position === undefined ? event : { ...event, position };
  });
  const visibilityPositions = adjustPackedIntangibleVisibility(packedEvents, maxSlots);

  packedEvents.filter(isIntangibleEvent).forEach(event => {
    const position = visibilityPositions.get(event.id);
    if (position === undefined || position === event.position) return;

    const existingUpdate = updates.find(update => update.eventId === event.id);
    if (existingUpdate) existingUpdate.updates.position = position;
    else updates.push({ eventId: event.id, updates: { position } });
  });

  return updates;
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

export const eventUpdateAffectsPosition = (
  event: TimelineEvent,
  updates: Partial<TimelineEvent>
): boolean => (
  (updates.startTime !== undefined && updates.startTime.getTime() !== event.startTime.getTime())
  || (updates.endTime !== undefined && updates.endTime.getTime() !== event.endTime.getTime())
  || (updates.bufferBeforeMinutes !== undefined && updates.bufferBeforeMinutes !== (event.bufferBeforeMinutes ?? 0))
);

const eventsOverlapWithoutBuffer = (event1: TimelineEvent, event2: TimelineEvent): boolean => {
  return event1.startTime < event2.endTime && event1.endTime > event2.startTime;
};

// Find available position for a single event.
export const findAvailablePosition = (
  events: TimelineEvent[],
  startTime: Date,
  endTime: Date,
  groupEvent?: TimelineEvent,
  maxSlots = 11
): number => {
  const collisionGroup = groupEvent ? getCollisionGroup(groupEvent) : undefined;
  const overlappingEvents = events.filter(event => 
    (collisionGroup ? getCollisionGroup(event) === collisionGroup : true) &&
    (startTime < event.endTime && endTime > getBufferedStartTime(event))
  );
  
  const usedPositions = new Set(overlappingEvents.map(e => e.position));
  
  for (let i = 0; i < maxSlots; i++) {
    if (!usedPositions.has(i)) {
      return i;
    }
  }
  
  return 0; // Fallback to position 0 if all positions are taken
};

// Simplified and more reliable cascading algorithm.
export const cascadeEventPositions = (
  allEvents: TimelineEvent[],
  changedEvent: TimelineEvent,
  changedEventUpdates: Partial<TimelineEvent>,
  maxSlots = 11,
  preserveChangedPosition = false
): { eventId: string; updates: Partial<TimelineEvent> }[] => {
  // Create the updated version of the changed event
  const updatedChangedEvent = { ...changedEvent, ...changedEventUpdates };

  if (
    changedEvent.megaLock
    && changedEventUpdates.position !== undefined
    && changedEventUpdates.position !== changedEvent.position
  ) {
    return [];
  }

  // Get all other events
  const collisionGroup = getCollisionGroup(updatedChangedEvent);
  const otherEvents = allEvents.filter(e => e.id !== changedEvent.id && getCollisionGroup(e) === collisionGroup);
  
  // Find events that overlap in time AND are in the same position as the changed event
  const directConflicts = otherEvents.filter(event => 
    event.position === updatedChangedEvent.position && 
    eventsOverlapWithoutBuffer(updatedChangedEvent, event)
  );
  
  const sortConflicts = (left: TimelineEvent, right: TimelineEvent) => {
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
  };
  const sourcePosition = changedEvent.position;
  const targetPosition = updatedChangedEvent.position;
  const preferredDirection: -1 | 1 = sourcePosition < targetPosition ? -1 : 1;
  const movementCost = (event: TimelineEvent, fromPosition: number, toPosition: number) => (
    fromPosition === toPosition
      ? 0
      : 30 + getEventDurationInMinutes(event.startTime, event.endTime) * Math.abs(toPosition - fromPosition)
  );
  const planCost = (positionUpdates: Map<string, number>) => (
    [changedEvent, ...otherEvents].reduce((cost, event) => {
      const finalPosition = positionUpdates.get(event.id)
        ?? (event.id === changedEvent.id ? targetPosition : event.position);
      const duration = getEventDurationInMinutes(event.startTime, event.endTime);
      return cost
        + movementCost(event, event.position, finalPosition)
        + duration * finalPosition;
    }, 0)
  );
  const applyIntangibleVisibility = (positionUpdates: Map<string, number>) => {
    const resolvedEvents = allEvents.map(event => {
      const updatedEvent = event.id === changedEvent.id ? updatedChangedEvent : event;
      const position = positionUpdates.get(event.id);
      return position === undefined ? updatedEvent : { ...updatedEvent, position };
    });
    const candidateEventIds = new Set(
      resolvedEvents
        .filter(event => isIntangibleEvent(event) && positionUpdates.has(event.id))
        .map(event => event.id)
    );
    const changedEventAffectsLayout = changedEvent.position !== targetPosition
      || changedEvent.startTime.getTime() !== updatedChangedEvent.startTime.getTime()
      || changedEvent.endTime.getTime() !== updatedChangedEvent.endTime.getTime()
      || changedEvent.intangible !== updatedChangedEvent.intangible;

    if (isIntangibleEvent(updatedChangedEvent) && changedEventAffectsLayout) {
      candidateEventIds.add(updatedChangedEvent.id);
    }

    resolvedEvents.filter(isIntangibleEvent).forEach(event => {
      const originalEvent = allEvents.find(original => original.id === event.id);
      if (
        originalEvent
        && getIntangibleVisibleSegments(originalEvent, allEvents).length > 0
        && getIntangibleVisibleSegments(event, resolvedEvents).length === 0
      ) {
        candidateEventIds.add(event.id);
      }
    });

    const visibilityPositions = adjustPackedIntangibleVisibility(resolvedEvents, maxSlots, candidateEventIds);
    const resolvedUpdates = new Map<string, number>();

    resolvedEvents.forEach(event => {
      const position = visibilityPositions.get(event.id) ?? event.position;
      const baselinePosition = event.id === changedEvent.id ? targetPosition : allEvents.find(original => original.id === event.id)?.position;
      if (baselinePosition !== undefined && position !== baselinePosition) {
        resolvedUpdates.set(event.id, position);
      }
    });

    return [...resolvedUpdates].map(([eventId, position]) => ({
      eventId,
      updates: { position }
    }));
  };
  const finalizePositionUpdates = (positionUpdates: Map<string, number>) => {
    const resolvedEvents = [updatedChangedEvent, ...otherEvents].map(event => {
      const position = positionUpdates.get(event.id);
      return position === undefined ? event : { ...event, position };
    });
    const hasCollision = resolvedEvents.some((event, eventIndex) => (
      resolvedEvents.slice(eventIndex + 1).some(otherEvent => (
        event.position === otherEvent.position
        && eventsOverlapWithoutBuffer(event, otherEvent)
      ))
    ));

    if (!hasCollision) {
      return applyIntangibleVisibility(positionUpdates);
    }

    const collisionInvolvesMegaLock = resolvedEvents.some((event, eventIndex) => (
      resolvedEvents.slice(eventIndex + 1).some(otherEvent => (
        event.position === otherEvent.position
        && eventsOverlapWithoutBuffer(event, otherEvent)
        && (event.megaLock || otherEvent.megaLock)
      ))
    ));
    if (collisionInvolvesMegaLock) return [];

    const eventsToPack = preserveChangedPosition
      ? resolvedEvents.map(event => event.id === changedEvent.id ? { ...event, megaLock: true } : event)
      : resolvedEvents;
    const packedPositions = buildCollisionFreePositionMap(eventsToPack, maxSlots, true);
    const packedEvents = resolvedEvents.map(event => ({
      ...event,
      position: packedPositions.get(event.id) ?? event.position
    }));
    const packedEventsHaveCollision = packedEvents.some((event, eventIndex) => (
      packedEvents.slice(eventIndex + 1).some(otherEvent => (
        event.position === otherEvent.position
        && eventsOverlapWithoutBuffer(event, otherEvent)
      ))
    ));
    if (packedEventsHaveCollision) return [];

    const packedUpdates = new Map<string, number>();
    resolvedEvents.forEach(event => {
      const packedPosition = packedPositions.get(event.id);
      const currentPosition = event.id === changedEvent.id
        ? targetPosition
        : otherEvents.find(otherEvent => otherEvent.id === event.id)?.position;

      if (packedPosition !== undefined && packedPosition !== currentPosition) {
        packedUpdates.set(event.id, packedPosition);
      }
    });

    return applyIntangibleVisibility(packedUpdates);
  };

  const buildCascadePlan = (changedPosition: number, direction: -1 | 1, allowOppositeDirection = false) => {
    const changedAtPosition = { ...updatedChangedEvent, position: changedPosition };
    const workingEvents = new Map<string, TimelineEvent>(
      [changedAtPosition, ...otherEvents].map(event => [event.id, event])
    );
    const positionUpdates = new Map<string, number>();

    if (changedPosition !== updatedChangedEvent.position) {
      positionUpdates.set(changedEvent.id, changedPosition);
    }

    const moveOneSlot = (eventToMove: TimelineEvent, moveDirection: -1 | 1, depth = 0): boolean => {
      if (eventToMove.megaLock) return false;

      const currentEvent = workingEvents.get(eventToMove.id) ?? eventToMove;
      const position = currentEvent.position + moveDirection;
      if (position < 0 || position >= maxSlots) return false;

      const eventsBeforeAttempt = new Map(workingEvents);
      const updatesBeforeAttempt = new Map(positionUpdates);
      const nearestClearPosition = Array.from(
        { length: moveDirection === -1 ? currentEvent.position : maxSlots - currentEvent.position - 1 },
        (_, index) => currentEvent.position + moveDirection * (index + 1)
      ).find(candidatePosition => [...workingEvents.values()].every(event => (
        event.id === currentEvent.id
        || event.position !== candidatePosition
        || !eventsOverlapWithoutBuffer(currentEvent, event)
      )));

      const blockers = [...workingEvents.values()]
        .filter(event => (
          event.id !== currentEvent.id
          && event.position === position
          && eventsOverlapWithoutBuffer(currentEvent, event)
        ))
        .sort(sortConflicts);
      const currentDuration = getEventDurationInMinutes(currentEvent.startTime, currentEvent.endTime);
      const canJumpLongerBlocker = blockers.some(blocker => (
        getEventDurationInMinutes(blocker.startTime, blocker.endTime) > currentDuration
      ));

      if (preserveChangedPosition && position === sourcePosition) {
        const oppositeDirection: -1 | 1 = moveDirection === -1 ? 1 : -1;
        workingEvents.set(currentEvent.id, { ...currentEvent, position });
        positionUpdates.set(currentEvent.id, position);
        const sourceGapCascadeSucceeded = blockers.every(blocker => (
          !eventsOverlapWithoutBuffer(blocker, changedAtPosition)
          && moveOneSlot(blocker, oppositeDirection, depth + 1)
        ));

        if (sourceGapCascadeSucceeded) return true;

        workingEvents.clear();
        eventsBeforeAttempt.forEach((event, eventId) => workingEvents.set(eventId, event));
        positionUpdates.clear();
        updatesBeforeAttempt.forEach((updatedPosition, eventId) => positionUpdates.set(eventId, updatedPosition));
      }

      const adjacentCascadeSucceeded = blockers.every(blocker => moveOneSlot(blocker, moveDirection, depth + 1));

      if (adjacentCascadeSucceeded) {
        const addedDisplacements = [...positionUpdates.keys()]
          .filter(eventId => !updatesBeforeAttempt.has(eventId))
          .length + 1;
        const distanceToClearPosition = nearestClearPosition === undefined
          ? null
          : Math.abs(nearestClearPosition - currentEvent.position);
        const preservesPreferredOrder = preserveChangedPosition
          || (distanceToClearPosition === null
            ? !canJumpLongerBlocker
            : addedDisplacements < distanceToClearPosition
              || (addedDisplacements === distanceToClearPosition && !canJumpLongerBlocker));

        if (preservesPreferredOrder) {
          workingEvents.set(currentEvent.id, { ...currentEvent, position });
          positionUpdates.set(currentEvent.id, position);
          return true;
        }
      }

      workingEvents.clear();
      eventsBeforeAttempt.forEach((event, eventId) => workingEvents.set(eventId, event));
      positionUpdates.clear();
      updatesBeforeAttempt.forEach((updatedPosition, eventId) => positionUpdates.set(eventId, updatedPosition));

      const jumpPosition = currentEvent.position + moveDirection * 2;
      if (!canJumpLongerBlocker || jumpPosition < 0 || jumpPosition >= maxSlots) return false;

      const jumpBlockers = [...workingEvents.values()]
        .filter(event => (
          event.id !== currentEvent.id
          && event.position === jumpPosition
          && eventsOverlapWithoutBuffer(currentEvent, event)
        ))
        .sort(sortConflicts);

      if (!jumpBlockers.every(blocker => moveOneSlot(blocker, moveDirection, depth + 1))) {
        workingEvents.clear();
        eventsBeforeAttempt.forEach((event, eventId) => workingEvents.set(eventId, event));
        positionUpdates.clear();
        updatesBeforeAttempt.forEach((updatedPosition, eventId) => positionUpdates.set(eventId, updatedPosition));
        return false;
      }

      workingEvents.set(currentEvent.id, { ...currentEvent, position: jumpPosition });
      positionUpdates.set(currentEvent.id, jumpPosition);
      return true;
    };

    const conflicts = otherEvents
      .filter(event => (
        event.position === changedPosition
        && eventsOverlapWithoutBuffer(changedAtPosition, event)
      ))
      .sort(sortConflicts);

    for (const conflict of conflicts) {
      if (positionUpdates.has(conflict.id)) continue;

      const eventsBeforeConflict = new Map(workingEvents);
      const updatesBeforeConflict = new Map(positionUpdates);
      if (moveOneSlot(conflict, direction)) continue;

      workingEvents.clear();
      eventsBeforeConflict.forEach((event, eventId) => workingEvents.set(eventId, event));
      positionUpdates.clear();
      updatesBeforeConflict.forEach((updatedPosition, eventId) => positionUpdates.set(eventId, updatedPosition));

      if (allowOppositeDirection && moveOneSlot(conflict, direction === -1 ? 1 : -1)) continue;

      return null;
    }

    return positionUpdates;
  };

  const crossedSlotCount = Math.max(1, Math.abs(targetPosition - sourcePosition));
  const changedDuration = getEventDurationInMinutes(updatedChangedEvent.startTime, updatedChangedEvent.endTime);
  const hasLongerDirectConflict = directConflicts.some(conflict => (
    getEventDurationInMinutes(conflict.startTime, conflict.endTime) > changedDuration
  ));
  const normalBypassDirection: -1 | 1 = preferredDirection === -1 ? 1 : -1;
  const normalBypassPosition = targetPosition + normalBypassDirection;

  if (
    !preserveChangedPosition
    &&
    sourcePosition !== targetPosition
    && hasLongerDirectConflict
    && (normalBypassPosition < 0 || normalBypassPosition >= maxSlots)
  ) {
    const clearBoundaryBypassPosition = Array.from(
      { length: preferredDirection === -1 ? targetPosition : maxSlots - targetPosition - 1 },
      (_, index) => targetPosition + preferredDirection * (index + 1)
    ).find(candidatePosition => otherEvents.every(event => (
      event.position !== candidatePosition
      || !eventsOverlapWithoutBuffer(updatedChangedEvent, event)
    )));

    if (clearBoundaryBypassPosition !== undefined) {
      return finalizePositionUpdates(new Map([[changedEvent.id, clearBoundaryBypassPosition]]));
    }
  }

  const preferredPlan = buildCascadePlan(targetPosition, preferredDirection, !hasLongerDirectConflict);

  let selectedPlan = preferredPlan;

  if (preserveChangedPosition) {
    const oppositeDirection: -1 | 1 = preferredDirection === -1 ? 1 : -1;
    const oppositePlan = buildCascadePlan(targetPosition, oppositeDirection);

    if (oppositePlan && (!selectedPlan || planCost(oppositePlan) < planCost(selectedPlan))) {
      selectedPlan = oppositePlan;
    }
  }

  if (!preserveChangedPosition && (!preferredPlan || (hasLongerDirectConflict && preferredPlan.size > crossedSlotCount * 2))) {
    const bypassDirection: -1 | 1 = preferredDirection === -1 ? 1 : -1;
    let bestBypassPlan: Map<string, number> | null = null;
    let bestBypassCost = Number.POSITIVE_INFINITY;

    for (
      let bypassPosition = targetPosition + bypassDirection;
      bypassPosition >= 0 && bypassPosition < maxSlots;
      bypassPosition += bypassDirection
    ) {
      const bypassPlan = buildCascadePlan(bypassPosition, bypassDirection);
      if (!bypassPlan) continue;

      const bypassCost = bypassPlan.size + Math.abs(bypassPosition - targetPosition);
      if (bypassCost < bestBypassCost) {
        bestBypassPlan = bypassPlan;
        bestBypassCost = bypassCost;
      }
    }

    if (bestBypassPlan && (!preferredPlan || bestBypassCost < preferredPlan.size)) {
      selectedPlan = bestBypassPlan;
    }
  }

  if (!selectedPlan) {
    if (directConflicts.some(event => event.megaLock)) return [];

    const fallbackEvents = [updatedChangedEvent, ...otherEvents];
    const adjacentConflict = preserveChangedPosition ? [...directConflicts].sort(sortConflicts)[0] : undefined;
    const adjacentConflictPosition = targetPosition + preferredDirection;
    const eventsToPack = preserveChangedPosition
      ? fallbackEvents.map(event => {
        if (event.id === changedEvent.id) return { ...event, megaLock: true };
        if (
          event.id === adjacentConflict?.id
          && adjacentConflictPosition >= 0
          && adjacentConflictPosition < maxSlots
        ) {
          return { ...event, position: adjacentConflictPosition, megaLock: true };
        }
        return event;
      })
      : fallbackEvents;
    const packedPositions = buildCollisionFreePositionMap(
      eventsToPack,
      maxSlots,
      true
    );

    const fallbackUpdates = new Map<string, number>();
    fallbackEvents.forEach(event => {
      const packedPosition = packedPositions.get(event.id);
      const currentPosition = event.id === changedEvent.id ? targetPosition : event.position;

      if (packedPosition !== undefined && packedPosition !== currentPosition) {
        fallbackUpdates.set(event.id, packedPosition);
      }
    });
    return finalizePositionUpdates(fallbackUpdates);
  }

  const sourceTimeChanged = changedEvent.startTime.getTime() !== updatedChangedEvent.startTime.getTime()
    || changedEvent.endTime.getTime() !== updatedChangedEvent.endTime.getTime();

  if (sourcePosition !== targetPosition && !sourceTimeChanged) {
    const finalEvents = new Map<string, TimelineEvent>(
      [updatedChangedEvent, ...otherEvents].map(event => {
        const plannedPosition = selectedPlan.get(event.id);
        return [event.id, plannedPosition === undefined ? event : { ...event, position: plannedPosition }];
      })
    );
    const compactionDirection: -1 | 1 = targetPosition < sourcePosition ? 1 : -1;
    const firstCompactionPosition = sourcePosition;

    for (
      let position = firstCompactionPosition;
      position >= 0 && position < maxSlots;
      position += compactionDirection
    ) {
      const candidates = [...finalEvents.values()]
        .filter(event => (
          event.id !== changedEvent.id
          && !event.megaLock
          && eventsOverlapWithoutBuffer(updatedChangedEvent, event)
          && (compactionDirection === 1 ? event.position > position : event.position < position)
          && Math.abs(event.position - position) <= 2
          && [...finalEvents.values()].every(blocker => (
            blocker.id === event.id
            || blocker.position !== position
            || !eventsOverlapWithoutBuffer(event, blocker)
          ))
        ))
        .sort((left, right) => (
          getEventDurationInMinutes(left.startTime, left.endTime)
          - getEventDurationInMinutes(right.startTime, right.endTime)
        ) || (
          compactionDirection === 1
            ? left.position - right.position
            : right.position - left.position
        ) || sortConflicts(left, right));

      const eventToCompact = candidates[0];
      if (!eventToCompact) continue;

      finalEvents.set(eventToCompact.id, { ...eventToCompact, position });
      selectedPlan.set(eventToCompact.id, position);
    }
  }

  if (sourceTimeChanged && !selectedPlan.has(changedEvent.id)) {
    const finalEvents = new Map<string, TimelineEvent>(
      [updatedChangedEvent, ...otherEvents].map(event => {
        const plannedPosition = selectedPlan.get(event.id);
        return [event.id, plannedPosition === undefined ? event : { ...event, position: plannedPosition }];
      })
    );
    const sourceBandCandidates = [...otherEvents]
      .filter(event => (
        !event.megaLock
        && event.position > sourcePosition
        && eventsOverlapWithoutBuffer(changedEvent, event)
      ))
      .sort((left, right) => left.position - right.position || sortConflicts(left, right));

    sourceBandCandidates.forEach(candidate => {
      const currentEvent = finalEvents.get(candidate.id) ?? candidate;

      for (let position = sourcePosition; position < currentEvent.position; position += 1) {
        const positionIsClear = [...finalEvents.values()].every(event => (
          event.id === currentEvent.id
          || event.position !== position
          || !eventsOverlapWithoutBuffer(currentEvent, event)
        ));

        if (!positionIsClear) continue;

        finalEvents.set(currentEvent.id, { ...currentEvent, position });
        selectedPlan.set(currentEvent.id, position);
        break;
      }
    });
  }

  return finalizePositionUpdates(selectedPlan);
};

export const repackEventPositions = (
  allEvents: TimelineEvent[],
  changedEventId: string,
  changedEventUpdates: Partial<TimelineEvent>,
  maxSlots = 11
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
    const packedPositions = buildPackedPositionMap(groupEvents, maxSlots);

    groupEvents.forEach(event => {
      const nextPosition = packedPositions.get(event.id);

      if (nextPosition == null || nextPosition === event.position) {
        return;
      }

      updates.push({ eventId: event.id, updates: { position: nextPosition } });
    });
  });

  const packedEvents = updatedEvents.map(event => {
    const position = updates.find(update => update.eventId === event.id)?.updates.position;
    return position === undefined ? event : { ...event, position };
  });
  const visibilityPositions = adjustPackedIntangibleVisibility(packedEvents, maxSlots);

  packedEvents.filter(isIntangibleEvent).forEach(event => {
    const position = visibilityPositions.get(event.id);
    if (position === undefined || position === event.position) return;

    const existingUpdate = updates.find(update => update.eventId === event.id);
    if (existingUpdate) existingUpdate.updates.position = position;
    else updates.push({ eventId: event.id, updates: { position } });
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
      startTime: otherEvent.startTime > event.startTime ? otherEvent.startTime : event.startTime,
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
  '#dc2626', // Red
  '#fb923c', // Orange
  '#ffc800', // Yellow
  '#57c14e', // Green
  '#41cbf1', // Cyan
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#c026d3', // Magenta / Fuchsia
  '#a16207', // Brown
  '#6b7280', // Grey - last
];

const LOCATION_COLOR_RULES = [
  { matchers: ['hilton'], color: '#8b5cf6' },
  { matchers: ['hyatt'], color: '#41cbf1' },
  { matchers: ['marriott'], color: '#c026d3' },
  { matchers: ['courtland'], color: '#fb923c' },
  { matchers: ['westin'], color: '#57c14e' },
  { matchers: ['parade'], color: '#ffc800' },
  { matchers: ['tv', 'twitch'], color: '#dc2626' },
  { matchers: ['mart', 'americasmart'], color: '#3b82f6' }
] as const;

export const getLocationDisplayColor = (location?: string): string => {
  const normalizedLocation = location?.trim().toLowerCase();

  if (!normalizedLocation) {
    return '#6b7280';
  }

  const matchedRule = LOCATION_COLOR_RULES.find(rule =>
    rule.matchers.some(matcher => normalizedLocation.includes(matcher))
  );

  return matchedRule?.color ?? '#6b7280';
};

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

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

export const getEventDurationInHours = (startTime: Date, endTime: Date): number => {
  return (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
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
  endTime: Date
): number => {
  const overlappingEvents = events.filter(event => 
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
  const otherEvents = allEvents.filter(e => e.id !== changedEvent.id);
  
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
  directConflicts.forEach(conflictingEvent => {
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

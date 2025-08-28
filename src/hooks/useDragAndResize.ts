import { useState, useCallback, useRef } from 'react';
import type { TimelineEvent } from '../types/timeline';
import { roundToNearestHalfHour, cascadeEventPositions } from '../utils/timelineUtils';

export interface DragState {
  isDragging: boolean;
  isResizing: boolean;
  dragType: 'move' | 'resize-start' | 'resize-end' | null;
  startX: number;
  startY: number;
  originalEvent: TimelineEvent | null;
}

export const useDragAndResize = (
  events: TimelineEvent[],
  onEventUpdate: (eventId: string, updates: Partial<TimelineEvent>) => void,
  onBatchUpdate: (updates: { eventId: string; updates: Partial<TimelineEvent> }[]) => void,
  startDate: Date
) => {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    isResizing: false,
    dragType: null,
    startX: 0,
    startY: 0,
    originalEvent: null
  });

  const dragRef = useRef<HTMLDivElement>(null);

  const startDrag = useCallback((
    event: TimelineEvent,
    clientX: number,
    clientY: number,
    type: 'move' | 'resize-start' | 'resize-end'
  ) => {
    setDragState({
      isDragging: type === 'move',
      isResizing: type !== 'move',
      dragType: type,
      startX: clientX,
      startY: clientY,
      originalEvent: { ...event }
    });
  }, []);

  const handleMouseMove = useCallback((clientX: number, clientY: number) => {
    if (!dragState.originalEvent || (!dragState.isDragging && !dragState.isResizing)) return;

    const deltaX = clientX - dragState.startX;
    const deltaY = clientY - dragState.startY;

    // Convert pixel movement to time increments using the same system as positioning
    // 240px = 1 hour, so 120px = 30 minutes
    const halfHourIncrements = Math.round(deltaX / 120);
    const timeChange = halfHourIncrements * 30 * 60 * 1000; // milliseconds (30 minutes)
    
    // Convert vertical movement to position change (64px = 1 position)
    const positionChange = Math.round(deltaY / 64);

    const originalEvent = dragState.originalEvent;
    const endDate = new Date(2025, 8, 2, 23, 0, 0); // September 2, 2025, 11 PM

    if (dragState.dragType === 'move') {
      // Moving the entire event
      const newStartTime = new Date(originalEvent.startTime.getTime() + timeChange);
      const newPosition = Math.max(0, Math.min(9, originalEvent.position + positionChange)); // Changed from 7 to 9

      // Round to nearest half hour
      const roundedStartTime = roundToNearestHalfHour(newStartTime);
      const duration = originalEvent.endTime.getTime() - originalEvent.startTime.getTime();
      const roundedEndTime = new Date(roundedStartTime.getTime() + duration);

      // Ensure the new time is within our timeline bounds
      if (roundedStartTime >= startDate && roundedEndTime <= endDate) {
        const updates = {
          startTime: roundedStartTime,
          endTime: roundedEndTime,
          position: newPosition
        };

        // Apply the main update
        onEventUpdate(originalEvent.id, updates);

        // Check for cascading position updates
        const cascadeUpdates = cascadeEventPositions(events, originalEvent, updates);
        if (cascadeUpdates.length > 0) {
          onBatchUpdate(cascadeUpdates);
        }
      }

    } else if (dragState.dragType === 'resize-start') {
      // Resizing from the start
      const newStartTime = new Date(originalEvent.startTime.getTime() + timeChange);
      const roundedStartTime = roundToNearestHalfHour(newStartTime);

      // Ensure minimum 30-minute duration and that start time is before end time
      const minEndTime = new Date(roundedStartTime.getTime() + 30 * 60 * 1000);
      if (roundedStartTime < originalEvent.endTime && 
          originalEvent.endTime >= minEndTime && 
          roundedStartTime >= startDate) {
        const updates = { startTime: roundedStartTime };
        
        // Apply the main update
        onEventUpdate(originalEvent.id, updates);

        // Check for cascading position updates due to time change
        const cascadeUpdates = cascadeEventPositions(events, originalEvent, updates);
        if (cascadeUpdates.length > 0) {
          onBatchUpdate(cascadeUpdates);
        }
      }

    } else if (dragState.dragType === 'resize-end') {
      // Resizing from the end
      const newEndTime = new Date(originalEvent.endTime.getTime() + timeChange);
      const roundedEndTime = roundToNearestHalfHour(newEndTime);

      // Ensure minimum 30-minute duration and that end time is after start time
      const minEndTime = new Date(originalEvent.startTime.getTime() + 30 * 60 * 1000);
      if (roundedEndTime >= minEndTime && 
          roundedEndTime > originalEvent.startTime && 
          roundedEndTime <= endDate) {
        const updates = { endTime: roundedEndTime };
        
        // Apply the main update
        onEventUpdate(originalEvent.id, updates);

        // Check for cascading position updates due to time change
        const cascadeUpdates = cascadeEventPositions(events, originalEvent, updates);
        if (cascadeUpdates.length > 0) {
          onBatchUpdate(cascadeUpdates);
        }
      }
    }
  }, [dragState, onEventUpdate, onBatchUpdate, events, startDate]);

  const endDrag = useCallback(() => {
    setDragState({
      isDragging: false,
      isResizing: false,
      dragType: null,
      startX: 0,
      startY: 0,
      originalEvent: null
    });
  }, []);

  return {
    dragState,
    startDrag,
    handleMouseMove,
    endDrag,
    dragRef
  };
};

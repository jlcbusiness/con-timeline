import { useState, useCallback, useRef } from 'react';
import type { TimelineEvent } from '../types/timeline';
import { roundToNearestHalfHour } from '../utils/timelineUtils';
import { PIXELS_PER_HOUR, PIXELS_PER_SLOT, DEFAULT_END_DATE } from '../config/timeline';

export interface DragState {
  isDragging: boolean;
  isResizing: boolean;
  dragType: 'move' | 'resize-start' | 'resize-end' | null;
  startX: number;
  startY: number;
  originalEvent: TimelineEvent | null;
  previewEvent: TimelineEvent | null;
}

interface DragPreviewOptions {
  originalEvent: TimelineEvent;
  dragType: NonNullable<DragState['dragType']>;
  deltaX: number;
  deltaY: number;
  startDate: Date;
  endDate: Date;
  slotHeight: number;
  slotCount: number;
}

export const getDragPreviewUpdates = ({
  originalEvent,
  dragType,
  deltaX,
  deltaY,
  startDate,
  endDate,
  slotHeight,
  slotCount
}: DragPreviewOptions): Partial<TimelineEvent> | null => {
  const halfHourIncrements = Math.round(deltaX / (PIXELS_PER_HOUR / 2));
  const timeChange = halfHourIncrements * 30 * 60 * 1000;
  const positionChange = Math.round(deltaY / slotHeight);

  if (dragType === 'move') {
    if (originalEvent.megaLock) return null;

    const position = Math.max(0, Math.min(Math.max(0, slotCount - 1), originalEvent.position + positionChange));
    if (originalEvent.lockTime) {
      return position === originalEvent.position ? null : { position };
    }

    const startTime = roundToNearestHalfHour(new Date(originalEvent.startTime.getTime() + timeChange));
    const duration = originalEvent.endTime.getTime() - originalEvent.startTime.getTime();
    const endTime = new Date(startTime.getTime() + duration);

    return startTime >= startDate && endTime <= endDate
      ? { startTime, endTime, position }
      : null;
  }

  if (originalEvent.lockTime || originalEvent.megaLock) return null;

  if (dragType === 'resize-start') {
    const startTime = roundToNearestHalfHour(new Date(originalEvent.startTime.getTime() + timeChange));
    const minimumEndTime = new Date(startTime.getTime() + 30 * 60 * 1000);

    return startTime < originalEvent.endTime
      && originalEvent.endTime >= minimumEndTime
      && startTime >= startDate
      ? { startTime, position: originalEvent.position }
      : null;
  }

  const endTime = roundToNearestHalfHour(new Date(originalEvent.endTime.getTime() + timeChange));
  const minimumEndTime = new Date(originalEvent.startTime.getTime() + 30 * 60 * 1000);

  return endTime >= minimumEndTime
    && endTime > originalEvent.startTime
    && endTime <= endDate
    ? { endTime, position: originalEvent.position }
    : null;
};

export const getContinuousDragPreview = ({
  originalEvent,
  dragType,
  deltaX,
  deltaY,
  startDate,
  endDate,
  slotHeight,
  slotCount
}: DragPreviewOptions): TimelineEvent => {
  if (originalEvent.megaLock) return originalEvent;

  const timeChange = deltaX / PIXELS_PER_HOUR * 60 * 60 * 1000;

  if (dragType === 'move') {
    const position = Math.max(0, Math.min(Math.max(0, slotCount - 1), originalEvent.position + deltaY / slotHeight));
    if (originalEvent.lockTime) return { ...originalEvent, position };

    const minimumTimeChange = startDate.getTime() - originalEvent.startTime.getTime();
    const maximumTimeChange = endDate.getTime() - originalEvent.endTime.getTime();
    const boundedTimeChange = Math.max(minimumTimeChange, Math.min(maximumTimeChange, timeChange));

    return {
      ...originalEvent,
      startTime: new Date(originalEvent.startTime.getTime() + boundedTimeChange),
      endTime: new Date(originalEvent.endTime.getTime() + boundedTimeChange),
      position
    };
  }

  if (originalEvent.lockTime) return originalEvent;

  if (dragType === 'resize-start') {
    const latestStartTime = originalEvent.endTime.getTime() - 30 * 60 * 1000;
    const startTime = new Date(Math.max(
      startDate.getTime(),
      Math.min(latestStartTime, originalEvent.startTime.getTime() + timeChange)
    ));

    return { ...originalEvent, startTime };
  }

  const earliestEndTime = originalEvent.startTime.getTime() + 30 * 60 * 1000;
  const endTime = new Date(Math.min(
    endDate.getTime(),
    Math.max(earliestEndTime, originalEvent.endTime.getTime() + timeChange)
  ));

  return { ...originalEvent, endTime };
};

export const useDragAndResize = (
  onEventUpdate: (eventId: string, updates: Partial<TimelineEvent>) => void,
  startDate: Date,
  endDate: Date = DEFAULT_END_DATE,
  slotHeight: number = PIXELS_PER_SLOT,
  slotCount: number = 11
) => {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    isResizing: false,
    dragType: null,
    startX: 0,
    startY: 0,
    originalEvent: null,
    previewEvent: null
  });

  const dragRef = useRef<HTMLDivElement>(null);
  const pendingUpdateRef = useRef<{ eventId: string; updates: Partial<TimelineEvent> } | null>(null);

  const startDrag = useCallback((
    event: TimelineEvent,
    clientX: number,
    clientY: number,
    type: 'move' | 'resize-start' | 'resize-end'
  ) => {
    pendingUpdateRef.current = null;
    setDragState({
      isDragging: type === 'move',
      isResizing: type !== 'move',
      dragType: type,
      startX: clientX,
      startY: clientY,
      originalEvent: { ...event },
      previewEvent: { ...event }
    });
  }, []);

  const handleMouseMove = useCallback((clientX: number, clientY: number) => {
    if (!dragState.originalEvent || (!dragState.isDragging && !dragState.isResizing)) return;

    const originalEvent = dragState.originalEvent;
    const previewOptions = {
      originalEvent,
      dragType: dragState.dragType as NonNullable<DragState['dragType']>,
      deltaX: clientX - dragState.startX,
      deltaY: clientY - dragState.startY,
      startDate,
      endDate,
      slotHeight,
      slotCount
    };
    const updates = getDragPreviewUpdates(previewOptions);
    const previewEvent = getContinuousDragPreview(previewOptions);

    if (updates) {
      pendingUpdateRef.current = { eventId: originalEvent.id, updates };
    } else {
      pendingUpdateRef.current = null;
    }

    setDragState(current => ({ ...current, previewEvent }));
  }, [dragState, startDate, endDate, slotHeight, slotCount]);

  const endDrag = useCallback(() => {
    const pendingUpdate = pendingUpdateRef.current;
    pendingUpdateRef.current = null;

    if (pendingUpdate) {
      onEventUpdate(pendingUpdate.eventId, pendingUpdate.updates);
    }

    setDragState({
      isDragging: false,
      isResizing: false,
      dragType: null,
      startX: 0,
      startY: 0,
      originalEvent: null,
      previewEvent: null
    });
  }, [onEventUpdate]);

  const cancelDrag = useCallback(() => {
    pendingUpdateRef.current = null;
    setDragState({
      isDragging: false,
      isResizing: false,
      dragType: null,
      startX: 0,
      startY: 0,
      originalEvent: null,
      previewEvent: null
    });
  }, []);

  return {
    dragState,
    startDrag,
    handleMouseMove,
    endDrag,
    cancelDrag,
    dragRef
  };
};

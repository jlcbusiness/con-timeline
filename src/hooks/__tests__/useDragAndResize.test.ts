import { describe, expect, it } from 'vitest';
import type { TimelineEvent } from '../../types/timeline';
import { getContinuousDragPreview, getDragPreviewUpdates } from '../useDragAndResize';

const event: TimelineEvent = {
  id: 'event',
  title: 'Event',
  startTime: new Date(2026, 8, 5, 19),
  endTime: new Date(2026, 8, 5, 20),
  color: '#8b5cf6',
  position: 1
};

const options = {
  originalEvent: event,
  dragType: 'move' as const,
  startDate: new Date(2026, 8, 5, 12),
  endDate: new Date(2026, 8, 6, 2),
  slotHeight: 64,
  slotCount: 8
};

describe('getDragPreviewUpdates', () => {
  it('moves continuously between snapped time and slot positions', () => {
    const preview = getContinuousDragPreview({
      ...options,
      deltaX: 60,
      deltaY: 32
    });

    expect(preview.startTime).toEqual(new Date(2026, 8, 5, 19, 15));
    expect(preview.endTime).toEqual(new Date(2026, 8, 5, 20, 15));
    expect(preview.position).toBe(1.5);
  });

  it('calculates a preview without mutating the stored event', () => {
    const updates = getDragPreviewUpdates({
      ...options,
      deltaX: 120,
      deltaY: 64
    });

    expect(updates).toEqual({
      startTime: new Date(2026, 8, 5, 19, 30),
      endTime: new Date(2026, 8, 5, 20, 30),
      position: 2
    });
    expect(event.startTime).toEqual(new Date(2026, 8, 5, 19));
    expect(event.position).toBe(1);
  });

  it('returns no pending update when a locked event returns to its original slot', () => {
    expect(getDragPreviewUpdates({
      ...options,
      originalEvent: { ...event, lockTime: true },
      deltaX: 120,
      deltaY: 0
    })).toBeNull();
  });

  it('keeps a resized event in its original slot for release-time cascading', () => {
    expect(getDragPreviewUpdates({
      ...options,
      dragType: 'resize-end',
      deltaX: 120,
      deltaY: 0
    })).toEqual({
      endTime: new Date(2026, 8, 5, 20, 30),
      position: 1
    });
  });
});
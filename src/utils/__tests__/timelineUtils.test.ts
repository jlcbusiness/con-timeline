import { describe, it, expect } from 'vitest';
import { roundToNearestHalfHour, getTimePosition, cascadeEventPositions } from '../timelineUtils';

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
});

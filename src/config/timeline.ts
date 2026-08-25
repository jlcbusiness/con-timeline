export const PIXELS_PER_HOUR = 240;
export const PIXELS_PER_SLOT = 56;
export const EVENT_BUFFER_OPTIONS_MINUTES = [0, 30, 60, 120] as const;

// Default timeline range (can be overridden by configuration or server data)
export const DEFAULT_START_DATE = new Date(2026, 7, 26, 1, 0, 0); // Aug 26, 2026 1:00 AM
export const DEFAULT_END_DATE = new Date(2026, 8, 7, 23, 0, 0); // Sept 7, 2026 11:00 PM

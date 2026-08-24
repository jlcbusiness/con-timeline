export const PIXELS_PER_HOUR = 240;
export const PIXELS_PER_SLOT = 56;
export const EVENT_BUFFER_OPTIONS_MINUTES = [0, 30, 60, 120] as const;

// Default timeline range (can be overridden by configuration or server data)
export const DEFAULT_START_DATE = new Date(2025, 7, 27, 1, 0, 0); // Aug 27, 2025 1:00 AM
export const DEFAULT_END_DATE = new Date(2025, 8, 2, 23, 0, 0); // Sept 2, 2025 11:00 PM

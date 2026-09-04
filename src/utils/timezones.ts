import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const DRAGON_CON_TIME_ZONE = 'America/New_York';

export interface TimeZoneOption {
  value: string;
  label: string;
  abbreviation: string;
}

const REPRESENTATIVE_TIME_ZONES = [
  'Pacific/Pago_Pago',
  'Pacific/Honolulu',
  'Pacific/Gambier',
  'America/Anchorage',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Sao_Paulo',
  'Atlantic/South_Georgia',
  'Atlantic/Cape_Verde',
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'Europe/Istanbul',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Brisbane',
  'Pacific/Noumea',
  'Pacific/Auckland',
  'Pacific/Kanton',
  'Pacific/Kiritimati'
];

export const getTimeZoneAbbreviation = (timeZone: string, date = new Date()): string => (
  formatInTimeZone(date, timeZone, 'zzz')
);

export const getTimeZoneOffset = (timeZone: string, date = new Date()): string => (
  formatInTimeZone(date, timeZone, 'XXX').replace('Z', '+00:00')
);

export const TIME_ZONE_OPTIONS: TimeZoneOption[] = REPRESENTATIVE_TIME_ZONES.map(value => {
  const abbreviation = getTimeZoneAbbreviation(value);
  const offset = getTimeZoneOffset(value);
  const name = value === 'UTC' ? 'UTC' : value.split('/').at(-1)?.replaceAll('_', ' ') ?? value;

  return {
    value,
    abbreviation,
    label: `${name} (UTC${offset}, ${abbreviation})`
  };
});

export const getRepresentativeTimeZone = (timeZone: string, date = new Date()): string => {
  if (REPRESENTATIVE_TIME_ZONES.includes(timeZone)) return timeZone;

  const offset = getTimeZoneOffset(timeZone, date);
  return REPRESENTATIVE_TIME_ZONES.find(candidate => getTimeZoneOffset(candidate, date) === offset) ?? 'UTC';
};

export const DEFAULT_TIME_ZONE = getRepresentativeTimeZone(
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
);

export const getEventTimeZoneOptions = (date = new Date()): TimeZoneOption[] => (
  REPRESENTATIVE_TIME_ZONES.map(value => ({
    value,
    abbreviation: getTimeZoneAbbreviation(value, date),
    label: getTimeZoneAbbreviation(value, date)
  }))
);

export const formatDateInputInTimeZone = (date: Date, timeZone: string): string => (
  formatInTimeZone(date, timeZone, 'yyyy-MM-dd')
);

export const formatTimeInputInTimeZone = (date: Date, timeZone: string): string => (
  formatInTimeZone(date, timeZone, 'HH:mm')
);

export const zonedDateTimeToUtc = (dateValue: string, timeValue: string, timeZone: string): Date | null => {
  if (!dateValue || !timeValue) return null;

  const parsed = fromZonedTime(`${dateValue}T${timeValue}:00`, timeZone);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatInTimelineTimeZone = (
  date: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions
): string => date.toLocaleString('en-US', { ...options, timeZone });

export const getDayKeyInTimeZone = (date: Date, timeZone: string): string => (
  formatInTimeZone(date, timeZone, 'yyyy-MM-dd')
);

export const getHourInTimeZone = (date: Date, timeZone: string): number => (
  Number(formatInTimeZone(date, timeZone, 'H'))
);

export const addCalendarDaysInTimeZone = (date: Date, days: number, timeZone: string): Date => {
  const dateValue = formatDateInputInTimeZone(date, timeZone);
  const timeValue = formatTimeInputInTimeZone(date, timeZone);
  const calendarDate = new Date(`${dateValue}T00:00:00Z`);
  calendarDate.setUTCDate(calendarDate.getUTCDate() + days);

  return zonedDateTimeToUtc(calendarDate.toISOString().slice(0, 10), timeValue, timeZone) ?? date;
};
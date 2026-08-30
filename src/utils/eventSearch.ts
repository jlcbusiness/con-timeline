import type { TimelineEvent } from '../types/timeline';

export type SearchField = 'title' | 'description' | 'location' | 'fandom';
export type EventSortField = 'title' | 'startTime' | 'location' | 'fandom' | 'duration';
export type SortDirection = 'ascending' | 'descending';

export interface EventSearchOptions {
  fields: SearchField[];
  sortField: EventSortField;
  sortDirection: SortDirection;
}

const compareText = (left: string, right: string) =>
  left.localeCompare(right, undefined, { sensitivity: 'base' });

const compareStableFallback = (left: TimelineEvent, right: TimelineEvent) => {
  const startDifference = left.startTime.getTime() - right.startTime.getTime();
  return startDifference || compareText(left.title, right.title) || left.id.localeCompare(right.id);
};

const compareOptionalText = (leftValue: string | undefined, rightValue: string | undefined) => {
  const leftText = leftValue?.trim() ?? '';
  const rightText = rightValue?.trim() ?? '';

  if (!leftText && rightText) return 1;
  if (leftText && !rightText) return -1;
  return compareText(leftText, rightText);
};

const compareByField = (left: TimelineEvent, right: TimelineEvent, field: EventSortField) => {
  if (field === 'title') return compareText(left.title, right.title);
  if (field === 'startTime') return left.startTime.getTime() - right.startTime.getTime();
  if (field === 'location') return compareOptionalText(left.location, right.location);
  if (field === 'fandom') return compareOptionalText(left.fandom, right.fandom);

  const leftDuration = left.endTime.getTime() - left.startTime.getTime();
  const rightDuration = right.endTime.getTime() - right.startTime.getTime();
  return leftDuration - rightDuration;
};

export const searchEvents = (
  events: TimelineEvent[],
  query: string,
  options: EventSearchOptions
): TimelineEvent[] => {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery || options.fields.length === 0) return [];

  const matches = events.filter(event => options.fields.some(field => {
    const value = event[field] ?? '';
    return value.toLocaleLowerCase().includes(normalizedQuery);
  }));

  return matches.sort((left, right) => {
    const primaryComparison = compareByField(left, right, options.sortField);
    if (primaryComparison === 0) return compareStableFallback(left, right);

    if (options.sortField === 'location' || options.sortField === 'fandom') {
      const leftIsBlank = !left[options.sortField]?.trim();
      const rightIsBlank = !right[options.sortField]?.trim();
      if (leftIsBlank !== rightIsBlank) return primaryComparison;
    }

    return options.sortDirection === 'ascending' ? primaryComparison : -primaryComparison;
  });
};
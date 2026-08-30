import type { TimelineEvent } from '../types/timeline';

interface LocationUsage {
  key: string;
  name: string;
  count: number;
  lastUsed: number;
}

const comparePopularity = (left: LocationUsage, right: LocationUsage) =>
  right.count - left.count
  || right.lastUsed - left.lastUsed
  || left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });

const getValueUsage = (
  events: TimelineEvent[],
  getValue: (event: TimelineEvent) => string | undefined
) => {
  const usage = new Map<string, LocationUsage>();

  events.forEach((event, index) => {
    const name = getValue(event)?.trim();
    if (!name) return;

    const key = name.toLocaleLowerCase();
    const storedTimestamp = event.updatedAt || event.createdAt;
    const parsedTimestamp = storedTimestamp ? new Date(storedTimestamp).getTime() : Number.NaN;
    const lastUsed = Number.isNaN(parsedTimestamp) ? index : parsedTimestamp;
    const existing = usage.get(key);

    if (existing) {
      existing.count += 1;
      existing.lastUsed = Math.max(existing.lastUsed, lastUsed);
      existing.name = name;
      return;
    }

    usage.set(key, { key, name, count: 1, lastUsed });
  });

  return [...usage.values()];
};

const getSuggestions = (
  events: TimelineEvent[],
  getValue: (event: TimelineEvent) => string | undefined,
  groupSize = 3
): string[] => {
  const usage = getValueUsage(events, getValue);

  const byRecentUse = [...usage].sort((left, right) =>
    right.lastUsed - left.lastUsed || comparePopularity(left, right)
  );
  const byPopularity = [...usage].sort(comparePopularity);
  const targetCount = Math.min(groupSize * 2, usage.length);
  const selected = new Map<string, LocationUsage>();

  byRecentUse.slice(0, groupSize).forEach(item => selected.set(item.key, item));
  byPopularity.slice(0, groupSize).forEach(item => selected.set(item.key, item));

  for (const item of byPopularity) {
    if (selected.size >= targetCount) break;
    selected.set(item.key, item);
  }

  return [...selected.values()]
    .sort(comparePopularity)
    .map(item => item.name);
};

export const getLocationSuggestions = (events: TimelineEvent[], groupSize = 3) =>
  getSuggestions(events, event => event.location, groupSize);

export const getFandomSuggestions = (events: TimelineEvent[], groupSize = 3) =>
  getSuggestions(events, event => event.fandom, groupSize);

export const getFandomSuggestionGroups = (events: TimelineEvent[], groupSize = 3) => {
  const usage = getValueUsage(events, event => event.fandom);
  const recent = [...usage]
    .sort((left, right) => right.lastUsed - left.lastUsed || comparePopularity(left, right))
    .slice(0, groupSize);
  const recentKeys = new Set(recent.map(item => item.key));
  const popular = [...usage]
    .filter(item => !recentKeys.has(item.key))
    .sort(comparePopularity)
    .slice(0, groupSize);

  return {
    recent: recent.map(item => item.name),
    popular: popular.map(item => item.name)
  };
};
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { CosplayEntry } from '../types/timeline';
import { getDayKey } from '../utils/timelineUtils';

const STORAGE_PREFIX = 'con-timeline-cosplay-entries';

const isMissingTableError = (error: any) =>
  error?.code === 'PGRST205' || error?.code === '42P01' || /could not find the table/i.test(String(error?.message || ''));

const createUuid = () => {
  if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
    return (crypto as any).randomUUID();
  }

  if (typeof crypto !== 'undefined' && (crypto as any).getRandomValues) {
    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, char =>
      ((Number(char) ^ ((crypto as any).getRandomValues(new Uint8Array(1))[0] & 15) >> (Number(char) / 4))).toString(16)
    );
  }

  return `10000000-1000-4000-8000-${Date.now().toString(16).padStart(12, '0').slice(-12)}`;
};

const storageKey = (timelineId: string) => `${STORAGE_PREFIX}-${timelineId}`;

const getLocalEntries = (timelineId: string): CosplayEntry[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(storageKey(timelineId));
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((entry): entry is CosplayEntry => Boolean(entry && typeof entry.id === 'string' && typeof entry.title === 'string' && typeof entry.dayKey === 'string'))
      .map(entry => ({
        ...entry,
        title: String(entry.title).trim(),
        dayKey: String(entry.dayKey)
      }))
      .filter(entry => Boolean(entry.title));
  } catch {
    return [];
  }
};

const saveLocalEntries = (timelineId: string, entries: CosplayEntry[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey(timelineId), JSON.stringify(entries));
};

const mapRow = (row: any): CosplayEntry => ({
  id: row.id,
  title: row.title,
  dayKey: row.day_key,
  createdAt: row.created_at || undefined,
  updatedAt: row.updated_at || undefined
});

const buildRow = (entry: CosplayEntry, timelineId: string, userId: string) => ({
  id: entry.id,
  timeline_id: timelineId,
  user_id: userId,
  day_key: entry.dayKey,
  title: entry.title,
  created_at: entry.createdAt || new Date().toISOString(),
  updated_at: entry.updatedAt || new Date().toISOString()
});

export const useCosplayEntryPersistence = (activeTimelineId?: string | null, days: Date[] = []) => {
  const [entries, setEntries] = useState<CosplayEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const hydratedTimelineIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeTimelineId || hydratedTimelineIdRef.current !== activeTimelineId) return;
    saveLocalEntries(activeTimelineId, entries);
    void persistEntries(entries);
  }, [activeTimelineId, entries]);

  useEffect(() => {
    let cancelled = false;

    const loadEntries = async () => {
      setIsLoading(true);

      try {
        if (!activeTimelineId) {
          if (!cancelled) {
            setEntries([]);
          }
          return;
        }

        const localEntries = getLocalEntries(activeTimelineId);

        if (!supabase) {
          if (!cancelled) {
            setEntries(localEntries);
            hydratedTimelineIdRef.current = activeTimelineId;
          }
          return;
        }

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        const user = userData.user;
        if (!user) {
          if (!cancelled) {
            setEntries(localEntries);
            hydratedTimelineIdRef.current = activeTimelineId;
          }
          return;
        }

        const { data, error } = await supabase
          .from('cosplay_entries')
          .select('*')
          .eq('user_id', user.id)
          .eq('timeline_id', activeTimelineId)
          .order('day_key', { ascending: true });

        if (error) throw error;

        if (!cancelled) {
          setEntries((data ?? []).map(mapRow));
          hydratedTimelineIdRef.current = activeTimelineId ?? null;
        }
      } catch (error) {
        if (isMissingTableError(error)) {
          if (!cancelled) {
            setEntries(activeTimelineId ? getLocalEntries(activeTimelineId) : []);
            hydratedTimelineIdRef.current = activeTimelineId ?? null;
          }
          return;
        }

        console.error('Failed to load cosplay entries', error);
        if (!cancelled) {
          setEntries(activeTimelineId ? getLocalEntries(activeTimelineId) : []);
          hydratedTimelineIdRef.current = activeTimelineId ?? null;
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadEntries();

    return () => {
      cancelled = true;
    };
  }, [activeTimelineId]);

  const persistEntries = async (nextEntries: CosplayEntry[]) => {
    if (!activeTimelineId) return;

    if (!supabase) return;

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const user = userData.user;
      if (!user) return;

      const { error: deleteError } = await supabase
        .from('cosplay_entries')
        .delete()
        .eq('timeline_id', activeTimelineId)
        .eq('user_id', user.id);

      if (deleteError) {
        if (isMissingTableError(deleteError)) return;
        throw deleteError;
      }

      if (nextEntries.length > 0) {
        const { error: insertError } = await supabase
          .from('cosplay_entries')
          .insert(nextEntries.map(entry => buildRow(entry, activeTimelineId, user.id)));

        if (insertError) {
          if (isMissingTableError(insertError)) return;
          throw insertError;
        }
      }
    } catch (error) {
      if (!isMissingTableError(error)) {
        console.error('Failed to save cosplay entries', error);
      }
    }
  };

  const sortEntries = (nextEntries: CosplayEntry[]) => {
    const dayOrder = new Map(days.map((day, index) => [getDayKey(day), index]));

    return [...nextEntries].sort((left, right) => {
      const leftIndex = dayOrder.get(left.dayKey) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = dayOrder.get(right.dayKey) ?? Number.MAX_SAFE_INTEGER;
      return leftIndex - rightIndex;
    });
  };

  const commitEntries = (nextEntries: CosplayEntry[]) => {
    setEntries(nextEntries);
  };

  const shiftEntryAcrossDays = (prevEntries: CosplayEntry[], entryId: string, targetDayKey: string) => {
    const movingEntry = prevEntries.find(entry => entry.id === entryId);

    if (!movingEntry || movingEntry.dayKey === targetDayKey) {
      return prevEntries;
    }

    const dayOrder = days.map(day => getDayKey(day));
    const sourceIndex = dayOrder.indexOf(movingEntry.dayKey);
    const targetIndex = dayOrder.indexOf(targetDayKey);

    if (sourceIndex === -1 || targetIndex === -1) {
      return prevEntries;
    }

    const updatedAt = new Date().toISOString();
    const movedEntry: CosplayEntry = {
      ...movingEntry,
      dayKey: targetDayKey,
      updatedAt
    };

    const nextEntries = prevEntries
      .filter(entry => entry.id !== entryId)
      .map(entry => {
        const entryIndex = dayOrder.indexOf(entry.dayKey);

        if (sourceIndex < targetIndex && entryIndex > sourceIndex && entryIndex <= targetIndex) {
          return {
            ...entry,
            dayKey: dayOrder[entryIndex - 1],
            updatedAt
          };
        }

        if (sourceIndex > targetIndex && entryIndex >= targetIndex && entryIndex < sourceIndex) {
          return {
            ...entry,
            dayKey: dayOrder[entryIndex + 1],
            updatedAt
          };
        }

        return entry;
      });

    return sortEntries([...nextEntries, movedEntry]);
  };

  const addEntry = (dayKey: string, title: string) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    const nextEntry: CosplayEntry = {
      id: createUuid(),
      title: trimmedTitle,
      dayKey,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const nextEntries = sortEntries([...entries.filter(entry => entry.dayKey !== dayKey), nextEntry]);
    commitEntries(nextEntries);
  };

  const updateEntry = (entryId: string, title: string, dayKey?: string) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    if (dayKey) {
      setEntries(prevEntries => {
        const shiftedEntries = shiftEntryAcrossDays(prevEntries, entryId, dayKey);

        return sortEntries(shiftedEntries.map(entry =>
          entry.id === entryId
            ? { ...entry, title: trimmedTitle, dayKey, updatedAt: new Date().toISOString() }
            : entry
        ));
      });
      return;
    }

    const nextEntries = sortEntries(entries.map(entry =>
      entry.id === entryId
        ? { ...entry, title: trimmedTitle, updatedAt: new Date().toISOString() }
        : entry
    ));
    commitEntries(nextEntries);
  };

  const deleteEntry = (entryId: string) => {
    const nextEntries = sortEntries(entries.filter(entry => entry.id !== entryId));
    commitEntries(nextEntries);
  };

  const moveEntry = (entryId: string, targetDayKey: string) => {
    setEntries(prevEntries => shiftEntryAcrossDays(prevEntries, entryId, targetDayKey));
  };

  return {
    entries,
    isLoading,
    addEntry,
    updateEntry,
    deleteEntry,
    moveEntry
  };
};
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DEFAULT_TIME_ZONE } from '../utils/timezones';

export interface TimelineMeta {
  id: string;
  name: string;
  createdAt: string;
  startDate: string;
  endDate: string;
  timeZone: string;
  slotCount: number;
  archived?: boolean;
  archivedAt?: string | null;
}

const ACTIVE_KEY = 'active-timeline-id';
const LEGACY_START_DATE = '2026-08-26T01:00:00';
const LEGACY_END_DATE = '2026-09-07T23:00:00';
const DEFAULT_SLOT_COUNT = 11;

const uuid = () => (typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : Date.now().toString());

const isMissingTableError = (error: any) =>
  error?.code === 'PGRST205' || error?.code === '42P01' || /could not find the table/i.test(String(error?.message || ''));

const mapTimelineRow = (timeline: any): TimelineMeta => ({
  id: timeline.id,
  name: timeline.name,
  createdAt: timeline.created_at || new Date().toISOString(),
  startDate: timeline.start_date || LEGACY_START_DATE,
  endDate: timeline.end_date || LEGACY_END_DATE,
  timeZone: timeline.time_zone || DEFAULT_TIME_ZONE,
  slotCount: Number.isFinite(Number(timeline.slot_count)) ? Number(timeline.slot_count) : DEFAULT_SLOT_COUNT,
  archived: Boolean(timeline.archived),
  archivedAt: timeline.archived_at || null
});

export const useTimelinePersistence = () => {
  const [timelines, setTimelines] = useState<TimelineMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadTimelines = async () => {
      setIsLoaded(false);

      try {
        if (!supabase) {
          setTimelines([]);
          setActiveId(null);
          return;
        }

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        const user = userData.user;
        if (!user) {
          setTimelines([]);
          setActiveId(null);
          return;
        }

        const { data, error } = await supabase
          .from('timelines')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });

        if (error) {
          if (isMissingTableError(error)) {
            const fallbackTimeline = {
              id: uuid(),
              user_id: user.id,
              name: 'Default Timeline',
              start_date: LEGACY_START_DATE,
              end_date: LEGACY_END_DATE,
              time_zone: DEFAULT_TIME_ZONE,
              slot_count: DEFAULT_SLOT_COUNT,
              archived: false,
              archived_at: null
            };

            const loadedFallbackTimelines = [mapTimelineRow(fallbackTimeline)];
            if (cancelled) return;

            setTimelines(loadedFallbackTimelines);

            const activeKey = `active-timeline-id:${user.id}`;
            const preferredActiveId = localStorage.getItem(activeKey) || localStorage.getItem(ACTIVE_KEY);
            const nextActiveId = preferredActiveId && loadedFallbackTimelines.some(timeline => timeline.id === preferredActiveId)
              ? preferredActiveId
              : loadedFallbackTimelines[0].id;

            setActiveId(nextActiveId);
            localStorage.setItem(activeKey, nextActiveId);
            return;
          }

          throw error;
        }

        let loadedTimelines: TimelineMeta[] = (data ?? []).map(mapTimelineRow);

        if (loadedTimelines.length === 0) {
          const defaultTimeline = {
            id: uuid(),
            user_id: user.id,
            name: 'Default Timeline',
            start_date: LEGACY_START_DATE,
            end_date: LEGACY_END_DATE,
            time_zone: DEFAULT_TIME_ZONE,
            slot_count: DEFAULT_SLOT_COUNT,
            archived: false,
            archived_at: null
          };

          const { data: inserted, error: insertError } = await supabase
            .from('timelines')
            .insert(defaultTimeline)
            .select('*')
            .single();

          if (insertError) {
            if (isMissingTableError(insertError)) {
              loadedTimelines = [mapTimelineRow(defaultTimeline)];
            } else {
              throw insertError;
            }
          } else {
            loadedTimelines = inserted ? [mapTimelineRow(inserted)] : [];
          }
        }

        if (cancelled) return;

        setTimelines(loadedTimelines);

        const activeKey = `active-timeline-id:${user.id}`;
        const preferredActiveId = localStorage.getItem(activeKey) || localStorage.getItem(ACTIVE_KEY);
        const nextActiveId = preferredActiveId && loadedTimelines.some(timeline => timeline.id === preferredActiveId)
          ? preferredActiveId
          : loadedTimelines.find(timeline => !timeline.archived)?.id ?? loadedTimelines[0]?.id ?? null;

        setActiveId(nextActiveId);

        if (nextActiveId) {
          localStorage.setItem(activeKey, nextActiveId);
        }
      } catch (error) {
        console.error('Failed to load timelines', error);
      } finally {
        if (!cancelled) {
          setIsLoaded(true);
        }
      }
    };

    void loadTimelines();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!supabase || !activeId) return;

    void supabase.auth.getUser().then(({ data }: any) => {
      const user = data.user;
      if (user) {
        localStorage.setItem(`active-timeline-id:${user.id}`, activeId);
      }
    });
  }, [activeId]);

  useEffect(() => {
    if (!isLoaded) return;

    if (!supabase) return;
  }, [timelines, isLoaded]);

  const createTimeline = async (name: string, startDate: string, endDate: string, slotCount = DEFAULT_SLOT_COUNT, timeZone = DEFAULT_TIME_ZONE) => {
    const id = uuid();
    const newMeta: TimelineMeta = {
      id,
      name: name || 'Untitled',
      createdAt: new Date().toISOString(),
      startDate,
      endDate,
      timeZone,
      slotCount
    };
    setTimelines(prev => [...prev, newMeta]);
    setActiveId(id);

    if (supabase) {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data.user;
        if (!user) return newMeta;

        const { error } = await supabase.from('timelines').insert({
          id,
          user_id: user.id,
          name: newMeta.name,
          start_date: startDate,
          end_date: endDate,
          time_zone: timeZone,
          slot_count: slotCount,
          archived: false,
          archived_at: null
        });

        if (error && !isMissingTableError(error)) {
          console.error('Failed to create timeline in Supabase', error);
        }
      } catch (error) {
        if (isMissingTableError(error)) {
          return newMeta;
        }

        console.error('Failed to create timeline in Supabase', error);
      }
    }

    return newMeta;
  };

  const renameTimeline = async (id: string, name: string) => {
    setTimelines(prev => prev.map(t => t.id === id ? { ...t, name } : t));

    if (supabase) {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data.user;
        if (!user) return;

        const { error } = await supabase.from('timelines')
          .update({ name })
          .eq('id', id)
          .eq('user_id', user.id);

        if (error) {
          console.error('Failed to rename timeline in Supabase', error);
        }
      } catch (error) {
        console.error('Failed to rename timeline in Supabase', error);
      }
    }
  };

  const updateTimelineDates = async (id: string, startDate: string, endDate: string, slotCount: number, timeZone: string) => {
    if (supabase) {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data.user;
        if (!user) {
          throw new Error('You must be signed in to save timeline changes.');
        }

        const { error } = await supabase.from('timelines')
          .update({ start_date: startDate, end_date: endDate, slot_count: slotCount, time_zone: timeZone })
          .eq('id', id)
          .eq('user_id', user.id);

        if (error) {
          throw error;
        }
      } catch (error) {
        console.error('Failed to update timeline dates in Supabase', error);
        throw error;
      }
    }

    setTimelines(prev => prev.map(t => t.id === id ? { ...t, startDate, endDate, slotCount, timeZone } : t));
  };

  const deleteTimeline = (id: string) => {
    setTimelines(prev => prev.filter(t => t.id !== id));

    if (supabase) {
      void supabase.auth.getUser().then(async ({ data }: any) => {
        const user = data.user;
        if (!user) return;

        const { error } = await supabase.from('timelines')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);

        if (error) {
          console.error('Failed to delete timeline in Supabase', error);
        }
      });
    }

    if (activeId === id) {
      const first = timelines.find(t => t.id !== id && !t.archived);
      const newActive = first ? first.id : null;
      setActiveId(newActive);
    }
  };

  const archiveTimeline = (id: string) => {
    setTimelines(prev => prev.map(t => t.id === id ? { ...t, archived: true, archivedAt: new Date().toISOString() } : t));

    if (supabase) {
      void supabase.auth.getUser().then(async ({ data }: any) => {
        const user = data.user;
        if (!user) return;

        const archivedAt = new Date().toISOString();
        const { error } = await supabase.from('timelines')
          .update({ archived: true, archived_at: archivedAt })
          .eq('id', id)
          .eq('user_id', user.id);

        if (error) {
          console.error('Failed to archive timeline in Supabase', error);
        }
      });
    }

    if (activeId === id) {
      const first = timelines.find(t => t.id !== id && !t.archived);
      setActiveId(first ? first.id : null);
    }
  };

  const unarchiveTimeline = (id: string) => {
    setTimelines(prev => prev.map(t => t.id === id ? { ...t, archived: false, archivedAt: null } : t));

    if (supabase) {
      void supabase.auth.getUser().then(async ({ data }: any) => {
        const user = data.user;
        if (!user) return;

        const { error } = await supabase.from('timelines')
          .update({ archived: false, archived_at: null })
          .eq('id', id)
          .eq('user_id', user.id);

        if (error) {
          console.error('Failed to unarchive timeline in Supabase', error);
        }
      });
    }
  };

  return {
    timelines,
    activeId,
    isLoading: !isLoaded,
    createTimeline,
    renameTimeline,
    updateTimelineDates,
    deleteTimeline,
    archiveTimeline,
    unarchiveTimeline,
    setActiveId
  };
};

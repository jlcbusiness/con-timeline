import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { TimelineEvent } from '../types/timeline';

// Use an active timeline id to namespace storage keys so multiple timelines can coexist.
const serializeEvent = (event: TimelineEvent) => ({
  ...event,
  startTime: event.startTime.toISOString(),
  endTime: event.endTime.toISOString()
});

const mapEventRow = (event: any): TimelineEvent => ({
  id: event.id,
  title: event.title,
  description: event.description || '',
  location: event.metadata?.location || '',
  fandom: event.metadata?.fandom || '',
  startTime: new Date(event.start_time),
  endTime: new Date(event.end_time),
  color: event.metadata?.color || '#3B82F6',
  position: event.position ?? 0,
  bufferBeforeMinutes: event.metadata?.bufferBeforeMinutes ?? 0,
  lockTime: event.metadata?.lockTime ?? false,
  megaLock: event.metadata?.megaLock ?? false,
  intangible: event.metadata?.intangible ?? false,
  createdAt: event.created_at || undefined,
  updatedAt: event.updated_at || undefined
});

const buildEventRow = (event: TimelineEvent, timelineId: string, userId: string) => ({
  id: event.id,
  timeline_id: timelineId,
  user_id: userId,
  title: event.title,
  description: event.description || null,
  start_time: event.startTime.toISOString(),
  end_time: event.endTime.toISOString(),
  position: event.position,
  metadata: {
    color: event.color,
    location: event.location || '',
    fandom: event.fandom || '',
    bufferBeforeMinutes: event.bufferBeforeMinutes ?? 0,
    lockTime: event.lockTime ?? false,
    megaLock: event.megaLock ?? false,
    intangible: event.intangible ?? false
  },
  created_at: event.createdAt || event.startTime.toISOString(),
  updated_at: event.updatedAt || new Date().toISOString()
});

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

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

const normalizeImportedEvent = (event: any): TimelineEvent => {
  const nextId = typeof event.id === 'string' && isUuid(event.id)
    ? event.id
    : createUuid();

  return {
    ...event,
    id: nextId,
    startTime: new Date(event.startTime),
    endTime: new Date(event.endTime)
  };
};

export const remapImportedEventIds = (events: TimelineEvent[]): TimelineEvent[] => (
  events.map(event => ({ ...event, id: createUuid() }))
);

const isMissingTableError = (error: any) =>
  error?.code === 'PGRST205' || error?.code === '42P01' || /could not find the table/i.test(String(error?.message || ''));

export const readImportedEvents = (file: File) => {
  return new Promise<TimelineEvent[]>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importedEvents = JSON.parse(content);

        if (!Array.isArray(importedEvents)) {
          return reject(new Error('Invalid file format: expected array'));
        }

        const validEvents = importedEvents
          .filter((event: any) => event.id && event.title && event.startTime && event.endTime)
          .map(normalizeImportedEvent) as TimelineEvent[];

        resolve(validEvents);
      } catch (error) {
        reject(new Error('Invalid file format'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

export const useEventPersistence = (activeTimelineId?: string | null) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const nowIso = () => new Date().toISOString();

  useEffect(() => {
    let cancelled = false;

    const loadEvents = async () => {
      setIsLoading(true);

      try {
        if (!supabase || !activeTimelineId) {
          setEvents([]);
          return;
        }

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        const user = userData.user;
        if (!user) {
          setEvents([]);
          return;
        }

        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('user_id', user.id)
          .eq('timeline_id', activeTimelineId)
          .order('position', { ascending: true })
          .order('created_at', { ascending: true });

        if (error) throw error;

        if (!cancelled) {
          setEvents((data ?? []).map(mapEventRow));
        }
      } catch (error) {
        if (isMissingTableError(error)) {
          if (!cancelled) {
            setEvents([]);
          }
          return;
        }

        console.error('Failed to load events', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadEvents();

    return () => {
      cancelled = true;
    };
  }, [activeTimelineId]);

  const persistEvent = async (event: TimelineEvent) => {
    if (!supabase || !activeTimelineId) return;

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;

    const user = userData.user;
    if (!user) return;

    const { error } = await supabase
      .from('events')
      .upsert(buildEventRow(event, activeTimelineId, user.id), { onConflict: 'id' });

    if (error) {
      throw error;
    }
  };

  const replaceEventsInBackend = async (timelineId: string, nextEvents: TimelineEvent[]) => {
    if (!supabase) return;

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;

    const user = userData.user;
    if (!user) return;

    const { error: deleteError } = await supabase
      .from('events')
      .delete()
      .eq('timeline_id', timelineId)
      .eq('user_id', user.id);

    if (deleteError) {
      if (isMissingTableError(deleteError)) return;
      throw deleteError;
    }

    if (nextEvents.length > 0) {
      const { error: insertError } = await supabase
        .from('events')
        .insert(nextEvents.map(event => buildEventRow(event, timelineId, user.id)));

      if (insertError) {
        if (isMissingTableError(insertError)) return;
        throw insertError;
      }
    }
  };

  const addEvent = (event: TimelineEvent) => {
    const timestamp = nowIso();
    const nextEvent = { ...event, createdAt: event.createdAt || timestamp, updatedAt: timestamp };
    setEvents(prevEvents => [...prevEvents, nextEvent]);

    void persistEvent(nextEvent).catch(error => {
      console.error('Failed to save event', error);
    });
  };

  const updateEvent = (eventId: string, updates: Partial<TimelineEvent>) => {
    const existingEvent = events.find(event => event.id === eventId);

    setEvents(prevEvents =>
      prevEvents.map(event =>
        event.id === eventId ? { ...event, ...updates, updatedAt: nowIso() } : event
      )
    );

    if (existingEvent) {
      void persistEvent({ ...existingEvent, ...updates, updatedAt: nowIso() }).catch(error => {
        console.error('Failed to update event', error);
      });
    }
  };

  // Batch update multiple events at once (for cascading position changes)
  const batchUpdateEvents = (updates: { eventId: string; updates: Partial<TimelineEvent> }[]) => {
    const updatedIds = new Set(updates.map(({ eventId }) => eventId));
    const nextEvents = events.map(event => {
      const update = updates.find(item => item.eventId === event.id);
      return update ? { ...event, ...update.updates, updatedAt: nowIso() } : event;
    });

    setEvents(nextEvents);

    void Promise.all(
      nextEvents
        .filter(event => updatedIds.has(event.id))
        .map(event => persistEvent(event))
    ).catch(error => {
      console.error('Failed to batch update events', error);
    });
  };

  const deleteEvent = (eventId: string) => {
    setEvents(prevEvents => prevEvents.filter(event => event.id !== eventId));

    if (supabase && activeTimelineId) {
      void supabase.auth.getUser().then(async ({ data }: any) => {
        const user = data.user;
        if (!user) return;

        const { error } = await supabase
          .from('events')
          .delete()
          .eq('id', eventId)
          .eq('timeline_id', activeTimelineId)
          .eq('user_id', user.id);

        if (error) {
          console.error('Failed to delete event', error);
        }
      });
    }
  };

  const clearAllEvents = () => {
    setEvents([]);

    if (supabase && activeTimelineId) {
      void supabase.auth.getUser().then(async ({ data }: any) => {
        const user = data.user;
        if (!user) return;

        const { error } = await supabase
          .from('events')
          .delete()
          .eq('timeline_id', activeTimelineId)
          .eq('user_id', user.id);

        if (error) {
          console.error('Failed to clear events', error);
        }
      });
    }
  };

  const exportEvents = () => {
    const dataStr = JSON.stringify(events.map(serializeEvent), null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `timeline-events-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Import merges by default (appends) and validates basic fields
  const importEvents = (file: File, options?: { replace?: boolean; timelineId?: string }) => {
    return readImportedEvents(file).then(async validEvents => {
      const targetTimelineId = options?.timelineId || activeTimelineId;

      if (!targetTimelineId) {
        return validEvents;
      }

      const importedEvents = options?.timelineId
        ? remapImportedEventIds(validEvents)
        : validEvents;

      const nextEvents = options?.replace
        ? importedEvents
        : (() => {
            const existingIds = new Set(events.map(event => event.id));
            const deduped = importedEvents.map(event => (
              existingIds.has(event.id) ? { ...event, id: createUuid() } : event
            ));

            return options?.timelineId ? deduped : [...events, ...deduped];
          })();

      if (targetTimelineId === activeTimelineId) {
        setEvents(nextEvents);
      }

      try {
        await replaceEventsInBackend(targetTimelineId, nextEvents);
      } catch (error) {
        console.error('Failed to import events', error);
        if (isMissingTableError(error)) {
          setEvents(nextEvents);
          return validEvents;
        }
        throw error;
      }

      setEvents(nextEvents);

      return validEvents;
    });
  };

  return {
    events,
    isLoading,
    addEvent,
    updateEvent,
    batchUpdateEvents, // New function for batch updates
    deleteEvent,
    clearAllEvents,
    exportEvents,
    readImportedEvents,
    importEvents,
    setEvents // For bulk operations like replacing all events
  };
};

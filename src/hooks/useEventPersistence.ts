import { useState, useEffect } from 'react';
import type { TimelineEvent } from '../types/timeline';

// Use an active timeline id to namespace storage keys so multiple timelines can coexist.
const getActiveTimelineId = () => {
  try {
    return localStorage.getItem('active-timeline-id') || 'default';
  } catch (e) {
    return 'default';
  }
};

const serializeEvent = (event: TimelineEvent) => ({
  ...event,
  startTime: event.startTime.toISOString(),
  endTime: event.endTime.toISOString()
});

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
          .map((event: any) => ({
            ...event,
            startTime: new Date(event.startTime),
            endTime: new Date(event.endTime)
          })) as TimelineEvent[];

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

  // Compute storage key using active timeline id
  const storageKey = `timeline-events:${activeTimelineId || getActiveTimelineId()}`;

  // Load events from localStorage on mount
  useEffect(() => {
    try {
      const savedEvents = localStorage.getItem(storageKey);
      if (savedEvents) {
        const parsedEvents = JSON.parse(savedEvents);
        // Convert date strings back to Date objects
        const eventsWithDates = parsedEvents.map((event: any) => ({
          ...event,
          startTime: new Date(event.startTime),
          endTime: new Date(event.endTime)
        }));
        setEvents(eventsWithDates);
      }
    } catch (error) {
      console.error('Failed to load events from localStorage:', error);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Save events to localStorage whenever events change
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(events.map(serializeEvent)));
      } catch (error) {
        console.error('Failed to save events to localStorage:', error);
      }
    }
  }, [events, isLoading, storageKey]);

  const addEvent = (event: TimelineEvent) => {
    const timestamp = nowIso();
    setEvents(prevEvents => [...prevEvents, { ...event, createdAt: event.createdAt || timestamp, updatedAt: timestamp }]);
  };

  const updateEvent = (eventId: string, updates: Partial<TimelineEvent>) => {
    setEvents(prevEvents => 
      prevEvents.map(event => 
        event.id === eventId ? { ...event, ...updates, updatedAt: nowIso() } : event
      )
    );
  };

  // Batch update multiple events at once (for cascading position changes)
  const batchUpdateEvents = (updates: { eventId: string; updates: Partial<TimelineEvent> }[]) => {
    setEvents(prevEvents => {
      const updatedEvents = [...prevEvents];
      
      updates.forEach(({ eventId, updates: eventUpdates }) => {
        const eventIndex = updatedEvents.findIndex(e => e.id === eventId);
        if (eventIndex !== -1) {
          updatedEvents[eventIndex] = { ...updatedEvents[eventIndex], ...eventUpdates, updatedAt: nowIso() };
        }
      });
      
      return updatedEvents;
    });
  };

  const deleteEvent = (eventId: string) => {
    setEvents(prevEvents => prevEvents.filter(event => event.id !== eventId));
  };

  const clearAllEvents = () => {
    setEvents([]);
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
    return readImportedEvents(file).then(validEvents => {
      const targetTimelineId = options?.timelineId || activeTimelineId || getActiveTimelineId();
      const targetStorageKey = `timeline-events:${targetTimelineId}`;
      const serializableEvents = validEvents.map(serializeEvent);

      if (!options?.timelineId) {
        if (options?.replace) {
          setEvents(validEvents);
        } else {
          setEvents(prev => {
            const existingIds = new Set(prev.map(e => e.id));
            const deduped = validEvents.map(ev => (
              existingIds.has(ev.id) ? { ...ev, id: `${ev.id}-${Date.now()}` } : ev
            ));
            return [...prev, ...deduped];
          });
        }
      }

      if (options?.timelineId) {
        try {
          localStorage.setItem(targetStorageKey, JSON.stringify(serializableEvents));
        } catch (error) {
          console.error('Failed to save imported events to localStorage:', error);
        }
        return validEvents;
      }

      if (options?.replace) {
        setEvents(validEvents);
      } else {
        setEvents(prev => {
          const existingIds = new Set(prev.map(e => e.id));
          const deduped = validEvents.map(ev => (
            existingIds.has(ev.id) ? { ...ev, id: `${ev.id}-${Date.now()}` } : ev
          ));
          return [...prev, ...deduped];
        });
      }

      try {
        localStorage.setItem(targetStorageKey, JSON.stringify(serializableEvents));
      } catch (error) {
        console.error('Failed to save imported events to localStorage:', error);
      }

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

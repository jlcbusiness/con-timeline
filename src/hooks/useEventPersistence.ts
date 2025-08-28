import { useState, useEffect } from 'react';
import type { TimelineEvent } from '../types/timeline';

const STORAGE_KEY = 'timeline-events';

export const useEventPersistence = () => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load events from localStorage on mount
  useEffect(() => {
    try {
      const savedEvents = localStorage.getItem(STORAGE_KEY);
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
  }, []);

  // Save events to localStorage whenever events change
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
      } catch (error) {
        console.error('Failed to save events to localStorage:', error);
      }
    }
  }, [events, isLoading]);

  const addEvent = (event: TimelineEvent) => {
    setEvents(prevEvents => [...prevEvents, event]);
  };

  const updateEvent = (eventId: string, updates: Partial<TimelineEvent>) => {
    setEvents(prevEvents => 
      prevEvents.map(event => 
        event.id === eventId ? { ...event, ...updates } : event
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
          updatedEvents[eventIndex] = { ...updatedEvents[eventIndex], ...eventUpdates };
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
    const dataStr = JSON.stringify(events, null, 2);
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

  const importEvents = (file: File) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const importedEvents = JSON.parse(content);
          
          // Validate and convert dates
          const validEvents = importedEvents
            .filter((event: any) => 
              event.id && event.title && event.startTime && event.endTime
            )
            .map((event: any) => ({
              ...event,
              startTime: new Date(event.startTime),
              endTime: new Date(event.endTime)
            }));

          setEvents(validEvents);
          resolve();
        } catch (error) {
          reject(new Error('Invalid file format'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
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
    importEvents,
    setEvents // For bulk operations like replacing all events
  };
};

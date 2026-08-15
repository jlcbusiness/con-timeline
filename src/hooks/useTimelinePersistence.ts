import { useState, useEffect } from 'react';

export interface TimelineMeta {
  id: string;
  name: string;
  createdAt: string;
  startDate: string;
  endDate: string;
  archived?: boolean;
  archivedAt?: string | null;
}

const TIMELINES_KEY = 'timelines';
const ACTIVE_KEY = 'active-timeline-id';
const LEGACY_START_DATE = '2025-08-27T01:00:00';
const LEGACY_END_DATE = '2025-09-02T23:00:00';

const uuid = () => (typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : Date.now().toString());

export const useTimelinePersistence = () => {
  const [timelines, setTimelines] = useState<TimelineMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TIMELINES_KEY);
      const parsed: TimelineMeta[] = raw ? JSON.parse(raw) : [];
      if (parsed.length === 0) {
        const defaultId = 'default';
        const defaultTimeline: TimelineMeta = {
          id: defaultId,
          name: 'Default Timeline',
          createdAt: new Date().toISOString(),
          startDate: LEGACY_START_DATE,
          endDate: LEGACY_END_DATE
        };
        setTimelines([defaultTimeline]);
        setActiveId(defaultId);
        localStorage.setItem(TIMELINES_KEY, JSON.stringify([defaultTimeline]));
        localStorage.setItem(ACTIVE_KEY, defaultId);
      } else {
        const migratedTimelines = parsed.map(timeline => ({
          ...timeline,
          startDate: timeline.startDate || LEGACY_START_DATE,
          endDate: timeline.endDate || LEGACY_END_DATE
        }));
        setTimelines(migratedTimelines);
        const a = localStorage.getItem(ACTIVE_KEY) || parsed[0].id;
        setActiveId(a);
      }
    } catch (e) {
      console.error('Failed to load timelines', e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    try {
      localStorage.setItem(TIMELINES_KEY, JSON.stringify(timelines));
    } catch (e) {
      console.error('Failed to save timelines', e);
    }
  }, [timelines, isLoaded]);

  useEffect(() => {
    try {
      if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
    } catch (e) {
      console.error('Failed to save active timeline', e);
    }
  }, [activeId]);

  const createTimeline = (name: string, startDate: string, endDate: string) => {
    const id = uuid();
    const newMeta: TimelineMeta = {
      id,
      name: name || 'Untitled',
      createdAt: new Date().toISOString(),
      startDate,
      endDate
    };
    setTimelines(prev => [...prev, newMeta]);
    setActiveId(id);
    return newMeta;
  };

  const renameTimeline = (id: string, name: string) => {
    setTimelines(prev => prev.map(t => t.id === id ? { ...t, name } : t));
  };

  const updateTimelineDates = (id: string, startDate: string, endDate: string) => {
    setTimelines(prev => prev.map(t => t.id === id ? { ...t, startDate, endDate } : t));
  };

  const deleteTimeline = (id: string) => {
    setTimelines(prev => prev.filter(t => t.id !== id));
    // delete associated events from localStorage
    try { localStorage.removeItem(`timeline-events:${id}`); } catch (_) {}
    if (activeId === id) {
      const first = timelines.find(t => t.id !== id && !t.archived);
      const newActive = first ? first.id : null;
      setActiveId(newActive);
    }
  };

  const archiveTimeline = (id: string) => {
    setTimelines(prev => prev.map(t => t.id === id ? { ...t, archived: true, archivedAt: new Date().toISOString() } : t));
    if (activeId === id) {
      const first = timelines.find(t => t.id !== id && !t.archived);
      setActiveId(first ? first.id : null);
    }
  };

  const unarchiveTimeline = (id: string) => {
    setTimelines(prev => prev.map(t => t.id === id ? { ...t, archived: false, archivedAt: null } : t));
  };

  return {
    timelines,
    activeId,
    createTimeline,
    renameTimeline,
    updateTimelineDates,
    deleteTimeline,
    archiveTimeline,
    unarchiveTimeline,
    setActiveId
  };
};

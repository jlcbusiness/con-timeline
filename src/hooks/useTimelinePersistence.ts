import { useState, useEffect } from 'react';

export interface TimelineMeta {
  id: string;
  name: string;
  createdAt: string;
}

const TIMELINES_KEY = 'timelines';
const ACTIVE_KEY = 'active-timeline-id';

const uuid = () => (typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : Date.now().toString());

export const useTimelinePersistence = () => {
  const [timelines, setTimelines] = useState<TimelineMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TIMELINES_KEY);
      const parsed: TimelineMeta[] = raw ? JSON.parse(raw) : [];
      if (parsed.length === 0) {
        const defaultId = 'default';
        const defaultTimeline: TimelineMeta = { id: defaultId, name: 'Default Timeline', createdAt: new Date().toISOString() };
        setTimelines([defaultTimeline]);
        setActiveId(defaultId);
        localStorage.setItem(TIMELINES_KEY, JSON.stringify([defaultTimeline]));
        localStorage.setItem(ACTIVE_KEY, defaultId);
      } else {
        setTimelines(parsed);
        const a = localStorage.getItem(ACTIVE_KEY) || parsed[0].id;
        setActiveId(a);
      }
    } catch (e) {
      console.error('Failed to load timelines', e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(TIMELINES_KEY, JSON.stringify(timelines));
    } catch (e) {
      console.error('Failed to save timelines', e);
    }
  }, [timelines]);

  useEffect(() => {
    try {
      if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
    } catch (e) {
      console.error('Failed to save active timeline', e);
    }
  }, [activeId]);

  const createTimeline = (name: string) => {
    const id = uuid();
    const newMeta: TimelineMeta = { id, name: name || 'Untitled', createdAt: new Date().toISOString() };
    setTimelines(prev => [...prev, newMeta]);
    setActiveId(id);
    return newMeta;
  };

  const renameTimeline = (id: string, name: string) => {
    setTimelines(prev => prev.map(t => t.id === id ? { ...t, name } : t));
  };

  const deleteTimeline = (id: string) => {
    setTimelines(prev => prev.filter(t => t.id !== id));
    // delete associated events from localStorage
    try { localStorage.removeItem(`timeline-events:${id}`); } catch (_) {}
    if (activeId === id) {
      const first = timelines.find(t => t.id !== id);
      const newActive = first ? first.id : null;
      setActiveId(newActive);
    }
  };

  return {
    timelines,
    activeId,
    createTimeline,
    renameTimeline,
    deleteTimeline,
    setActiveId
  };
};

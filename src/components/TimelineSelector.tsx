import React from 'react';
import { useTimelinePersistence } from '../hooks/useTimelinePersistence';

export const TimelineSelector: React.FC = () => {
  const { timelines, activeId, createTimeline, renameTimeline, deleteTimeline, setActiveId } = useTimelinePersistence();
  const [editingName, setEditingName] = React.useState('');

  const handleCreate = () => {
    const name = window.prompt('Name for new timeline:', 'New Timeline');
    if (name) createTimeline(name);
  };

  const handleRename = () => {
    if (!activeId) return;
    const existing = timelines.find(t => t.id === activeId);
    const name = window.prompt('Rename timeline:', existing?.name || '');
    if (name) renameTimeline(activeId, name);
  };

  const handleDelete = () => {
    if (!activeId) return;
    const existing = timelines.find(t => t.id === activeId);
    const ok = window.confirm(`Delete timeline "${existing?.name}"? This will remove its events from local storage.`);
    if (ok) deleteTimeline(activeId);
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={activeId || ''}
        onChange={(e) => setActiveId(e.target.value)}
        className="px-2 py-1 rounded border"
      >
        {timelines.map(t => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>

      <button onClick={handleCreate} className="px-2 py-1 bg-gray-100 rounded">New</button>
      <button onClick={handleRename} className="px-2 py-1 bg-gray-100 rounded">Rename</button>
      <button onClick={handleDelete} className="px-2 py-1 bg-red-100 rounded text-red-600">Delete</button>
    </div>
  );
};

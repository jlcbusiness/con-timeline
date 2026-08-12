import React from 'react';

interface Props {
  timelines: any[];
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  onCreate: (name: string) => void;
  onManage: () => void;
}

export const TimelineSelector: React.FC<Props> = ({ timelines, activeId, setActiveId, onCreate, onManage }) => {
  const activeTimelines = timelines.filter(t => !t.archived);

  return (
    <div className="flex items-center gap-2">
      <select
        value={activeId || ''}
        onChange={(e) => setActiveId(e.target.value)}
        className="px-2 py-1 rounded border"
      >
        {activeTimelines.map(t => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>

      <button onClick={() => {
        const name = window.prompt('Name for new timeline:', 'New Timeline');
        if (name) onCreate(name);
      }} className="px-2 py-1 bg-gray-100 rounded">New</button>

      <button onClick={onManage} className="px-2 py-1 bg-gray-100 rounded">Manage</button>
    </div>
  );
};

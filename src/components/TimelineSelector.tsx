import React, { useState } from 'react';

interface Props {
  timelines: any[];
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  onCreate: (name: string) => void;
  onManage: () => void;
}

export const TimelineSelector: React.FC<Props> = ({ timelines, activeId, setActiveId, onCreate, onManage }) => {
  const activeTimelines = timelines.filter(t => !t.archived);
  const activeTimeline = activeTimelines.find(t => t.id === activeId);
  const [isOpen, setIsOpen] = useState(false);

  const handleCreate = () => {
    const name = window.prompt('Name for new timeline:', 'New Timeline');
    if (name) onCreate(name);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 rounded border border-gray-300 bg-white text-sm font-medium text-gray-800 hover:bg-gray-50"
      >
        {activeTimeline?.name ?? 'Select timeline'}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-full z-40 mt-1 w-56 overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-lg">
            <div className="max-h-64 overflow-y-auto px-1">
              {activeTimelines.map(timeline => (
                <button
                  key={timeline.id}
                  type="button"
                  onClick={() => {
                    setActiveId(timeline.id);
                    setIsOpen(false);
                  }}
                  className={`w-full rounded px-3 py-2 text-left text-sm ${timeline.id === activeId ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  {timeline.name}
                </button>
              ))}
            </div>
            <div className="mt-1 border-t border-gray-200 px-1 pt-1">
              <button
                type="button"
                onClick={handleCreate}
                className="w-full rounded px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                New timeline
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onManage();
                }}
                className="w-full rounded px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Manage timelines
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

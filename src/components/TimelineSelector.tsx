import React, { useState } from 'react';
import { Edit3 } from 'lucide-react';
import type { TimelineMeta } from '../hooks/useTimelinePersistence';

interface Props {
  timelines: TimelineMeta[];
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  onCreate: (name: string, startDate: string, endDate: string) => void;
  onEditCurrent: () => void;
  onManage: () => void;
}

export const TimelineSelector: React.FC<Props> = ({ timelines, activeId, setActiveId, onCreate, onEditCurrent, onManage }) => {
  const activeTimelines = timelines.filter(t => !t.archived);
  const activeTimeline = activeTimelines.find(t => t.id === activeId);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const openCreateDialog = () => {
    const year = new Date().getFullYear();
    setName('New Timeline');
    setStartDate(`${year}-09-01`);
    setEndDate(`${year}-09-08`);
    setIsOpen(false);
    setIsCreateOpen(true);
  };

  const handleCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !startDate || !endDate || endDate < startDate) return;

    onCreate(`${name.trim()}`, `${startDate}T01:00:00`, `${endDate}T23:00:00`);
    setIsCreateOpen(false);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="max-w-[10rem] truncate rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 md:max-w-none"
        >
          {activeTimeline?.name ?? 'Select timeline'}
        </button>

        <button
          type="button"
          onClick={onEditCurrent}
          disabled={!activeTimeline}
          className="inline-flex items-center justify-center rounded border border-gray-300 bg-gray-50 p-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 md:px-3 md:py-1.5"
          title="Edit current timeline"
        >
          <Edit3 size={14} className="md:hidden" />
          <span className="hidden md:inline">Edit</span>
        </button>
      </div>

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
                onClick={openCreateDialog}
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

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <form onSubmit={handleCreate} className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">New timeline</h2>
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Name
                <input
                  autoFocus
                  value={name}
                  onChange={event => setName(event.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                  required
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-gray-700">
                  Start date
                  <input
                    type="date"
                    value={startDate}
                    onChange={event => setStartDate(event.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                    required
                  />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  End date
                  <input
                    type="date"
                    min={startDate}
                    value={endDate}
                    onChange={event => setEndDate(event.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                    required
                  />
                </label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Create timeline
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

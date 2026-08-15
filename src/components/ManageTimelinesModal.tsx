import React from 'react';
import type { TimelineMeta } from '../hooks/useTimelinePersistence';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  timelines: TimelineMeta[];
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  renameTimeline: (id: string, name: string) => void;
  updateTimelineDates: (id: string, startDate: string, endDate: string) => void;
  deleteTimeline: (id: string) => void;
  archiveTimeline: (id: string) => void;
  unarchiveTimeline: (id: string) => void;
}

export const ManageTimelinesModal: React.FC<Props> = ({ isOpen, onClose, timelines, activeId, setActiveId, renameTimeline, updateTimelineDates, deleteTimeline, archiveTimeline, unarchiveTimeline }) => {
  if (!isOpen) return null;

  const active = timelines.filter(t => !t.archived);
  const archived = timelines.filter(t => t.archived);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-6">
      <div className="absolute inset-0 bg-black opacity-40" onClick={onClose}></div>
      <div className="relative bg-white rounded shadow-lg w-full max-w-4xl p-6 grid grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold mb-4">Active Timelines</h2>
          <ul className="space-y-2">
            {active.map(t => (
              <li key={t.id} className="p-3 border rounded">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <input type="radio" checked={activeId === t.id} onChange={() => setActiveId(t.id)} />
                    <span>{t.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => {
                      const name = window.prompt('Rename timeline:', t.name);
                      if (name) renameTimeline(t.id, name);
                    }} className="px-2 py-1 bg-gray-100 rounded">Rename</button>
                    <button onClick={() => archiveTimeline(t.id)} className="px-2 py-1 bg-yellow-100 rounded">Archive</button>
                    <button onClick={() => { if (confirm(`Delete timeline "${t.name}"? This will remove its events from storage.`)) deleteTimeline(t.id); }} className="px-2 py-1 bg-red-100 rounded text-red-600">Delete</button>
                  </div>
                </div>
                <form
                  className="mt-3 flex items-end gap-2"
                  onSubmit={event => {
                    event.preventDefault();
                    const formData = new FormData(event.currentTarget);
                    const startDate = String(formData.get('startDate'));
                    const endDate = String(formData.get('endDate'));
                    if (startDate && endDate && endDate >= startDate) {
                      updateTimelineDates(t.id, `${startDate}T01:00:00`, `${endDate}T23:00:00`);
                    }
                  }}
                >
                  <label className="flex-1 text-xs text-gray-600">
                    Start
                    <input name="startDate" type="date" defaultValue={t.startDate.slice(0, 10)} className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900" required />
                  </label>
                  <label className="flex-1 text-xs text-gray-600">
                    End
                    <input name="endDate" type="date" defaultValue={t.endDate.slice(0, 10)} className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900" required />
                  </label>
                  <button type="submit" className="rounded bg-gray-100 px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-200">Save dates</button>
                </form>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">Archived Timelines</h2>
          <ul className="space-y-2">
            {archived.map(t => (
              <li key={t.id} className="flex items-center justify-between p-2 border rounded">
                <div>{t.name}</div>
                <div className="flex items-center gap-2">
                  <button onClick={() => unarchiveTimeline(t.id)} className="px-2 py-1 bg-green-100 rounded">Unarchive</button>
                  <button onClick={() => { if (confirm(`Delete archived timeline "${t.name}"?`)) deleteTimeline(t.id); }} className="px-2 py-1 bg-red-100 rounded text-red-600">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="col-span-2 text-right">
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 rounded">Close</button>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
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
  const [editingTimeline, setEditingTimeline] = useState<TimelineMeta | null>(null);

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
                    <button onClick={() => setEditingTimeline(t)} className="px-2 py-1 bg-gray-100 rounded">Edit</button>
                    <button onClick={() => archiveTimeline(t.id)} className="px-2 py-1 bg-yellow-100 rounded">Archive</button>
                    <button onClick={() => { if (confirm(`Delete timeline "${t.name}"? This will remove its events from storage.`)) deleteTimeline(t.id); }} className="px-2 py-1 bg-red-100 rounded text-red-600">Delete</button>
                  </div>
                </div>
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

      {editingTimeline && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black bg-opacity-40 p-6">
          <form
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onSubmit={event => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const name = String(formData.get('name')).trim();
              const startDate = String(formData.get('startDate'));
              const endDate = String(formData.get('endDate'));
              if (!name || !startDate || !endDate || endDate < startDate) return;

              renameTimeline(editingTimeline.id, name);
              updateTimelineDates(editingTimeline.id, `${startDate}T01:00:00`, `${endDate}T23:00:00`);
              setEditingTimeline(null);
            }}
          >
            <h2 className="text-lg font-semibold text-gray-900">Edit timeline</h2>
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Name
                <input name="name" defaultValue={editingTimeline.name} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-gray-900" required />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-gray-700">
                  Start date
                  <input name="startDate" type="date" defaultValue={editingTimeline.startDate.slice(0, 10)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-gray-900" required />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  End date
                  <input name="endDate" type="date" defaultValue={editingTimeline.endDate.slice(0, 10)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-gray-900" required />
                </label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setEditingTimeline(null)} className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

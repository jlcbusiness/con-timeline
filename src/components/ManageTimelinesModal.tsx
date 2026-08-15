import React, { useState } from 'react';
import { LocationManager } from './LocationManager';
import type { TimelineMeta } from '../hooks/useTimelinePersistence';
import type { Location } from '../types/timeline';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  mode: 'manage' | 'edit';
  timelines: TimelineMeta[];
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  renameTimeline: (id: string, name: string) => void;
  updateTimelineDates: (id: string, startDate: string, endDate: string) => void;
  locations: Location[];
  onAddLocation: (name: string) => Location;
  onUpdateLocation: (locationId: string, name: string) => void;
  onDeleteLocation: (locationId: string) => void;
  onExportLocations: () => void;
  onImportLocations: (file: File) => Promise<unknown>;
  deleteTimeline: (id: string) => void;
  archiveTimeline: (id: string) => void;
  unarchiveTimeline: (id: string) => void;
  initialEditingTimelineId?: string | null;
  initialSection?: 'timeline' | 'locations';
}

export const ManageTimelinesModal: React.FC<Props> = ({ isOpen, onClose, mode, timelines, activeId, setActiveId, renameTimeline, updateTimelineDates, locations, onAddLocation, onUpdateLocation, onDeleteLocation, onExportLocations, onImportLocations, deleteTimeline, archiveTimeline, unarchiveTimeline, initialEditingTimelineId, initialSection }) => {
  const [editingTimeline, setEditingTimeline] = useState<TimelineMeta | null>(null);
  const [editingSection, setEditingSection] = useState<'timeline' | 'locations'>('timeline');
  const directEditMode = mode === 'edit';

  React.useEffect(() => {
    if (!isOpen) {
      setEditingTimeline(null);
      setEditingSection('timeline');
      return;
    }

    if (directEditMode && initialEditingTimelineId) {
      const timeline = timelines.find(item => item.id === initialEditingTimelineId) || null;
      setEditingTimeline(timeline);
      setEditingSection(initialSection || 'timeline');
      return;
    }

    setEditingTimeline(null);
    setEditingSection(initialSection || 'timeline');
  }, [directEditMode, isOpen, initialEditingTimelineId, initialSection, timelines]);

  if (!isOpen) return null;

  const active = timelines.filter(t => !t.archived);
  const archived = timelines.filter(t => t.archived);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-6">
      <div className="absolute inset-0 bg-black opacity-40" onClick={onClose}></div>
      {!directEditMode && (
        <div className="relative flex max-h-[calc(100dvh-1rem)] w-full max-w-4xl flex-col overflow-hidden rounded bg-white shadow-lg sm:max-h-[calc(100dvh-3rem)] md:grid md:grid-cols-2 md:gap-6 md:p-6">
          <div>
            <h2 className="mb-4 text-lg font-semibold">Active Timelines</h2>
            <ul className="space-y-2">
              {active.map(t => (
                <li key={t.id} className="rounded border p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <input type="radio" checked={activeId === t.id} onChange={() => setActiveId(t.id)} />
                      <span className="truncate">{t.name}</span>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button onClick={() => archiveTimeline(t.id)} className="rounded bg-yellow-100 px-2 py-1 text-sm">Archive</button>
                      <button onClick={() => { if (confirm(`Delete timeline "${t.name}"? This will remove its events from storage.`)) deleteTimeline(t.id); }} className="rounded bg-red-100 px-2 py-1 text-sm text-red-600">Delete</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="mb-4 text-lg font-semibold">Archived Timelines</h2>
            <ul className="space-y-2">
              {archived.map(t => (
                <li key={t.id} className="flex flex-col gap-3 rounded border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="truncate">{t.name}</div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button onClick={() => unarchiveTimeline(t.id)} className="rounded bg-green-100 px-2 py-1 text-sm">Unarchive</button>
                    <button onClick={() => { if (confirm(`Delete archived timeline "${t.name}"?`)) deleteTimeline(t.id); }} className="rounded bg-red-100 px-2 py-1 text-sm text-red-600">Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-2 text-right">
            <button onClick={onClose} className="rounded bg-gray-100 px-4 py-2">Close</button>
          </div>
        </div>
      )}

      {directEditMode && editingTimeline && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black bg-opacity-40 p-2 sm:p-6">
          <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl sm:max-h-[calc(100dvh-3rem)]">
            <div className="flex items-center justify-between gap-4 border-b p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-900">Edit timeline</h2>
              <button
                type="button"
                onClick={() => {
                  setEditingTimeline(null);
                  if (directEditMode) {
                    onClose();
                  }
                }}
                className="text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-4 py-3 sm:px-6">
              <button
                type="button"
                onClick={() => setEditingSection('timeline')}
                className={`rounded px-3 py-1.5 text-sm font-medium ${editingSection === 'timeline' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Timeline properties
              </button>
              <button
                onClick={() => setEditingSection('locations')}
                className={`rounded px-3 py-1.5 text-sm font-medium ${editingSection === 'locations' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Manage locations
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            {editingSection === 'timeline' ? (
              <form
                className="space-y-4"
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
                <label className="block text-sm font-medium text-gray-700">
                  Name
                  <input name="name" defaultValue={editingTimeline.name} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-gray-900" required />
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Start date
                    <input name="startDate" type="date" defaultValue={editingTimeline.startDate.slice(0, 10)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-gray-900" required />
                  </label>
                  <label className="block text-sm font-medium text-gray-700">
                    End date
                    <input name="endDate" type="date" defaultValue={editingTimeline.endDate.slice(0, 10)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-gray-900" required />
                  </label>
                </div>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setEditingTimeline(null)} className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Save</button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="mt-4 space-y-4">
                <LocationManager
                  isOpen={true}
                  embedded
                  onClose={() => setEditingSection('timeline')}
                  locations={locations}
                  onAddLocation={onAddLocation}
                  onUpdateLocation={onUpdateLocation}
                  onDeleteLocation={onDeleteLocation}
                  onExportLocations={onExportLocations}
                  onImportLocations={onImportLocations}
                />
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (directEditMode) {
                        setEditingTimeline(null);
                        onClose();
                        return;
                      }
                      setEditingSection('timeline');
                    }}
                    className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

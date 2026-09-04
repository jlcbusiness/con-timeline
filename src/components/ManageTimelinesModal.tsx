import React, { useState } from 'react';
import { LocationManager } from './LocationManager';
import type { TimelineMeta } from '../hooks/useTimelinePersistence';
import type { Location } from '../types/timeline';
import { TIME_ZONE_OPTIONS, formatDateInputInTimeZone, getRepresentativeTimeZone, zonedDateTimeToUtc } from '../utils/timezones';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  mode: 'manage' | 'edit';
  timelines: TimelineMeta[];
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  renameTimeline: (id: string, name: string) => Promise<void>;
  updateTimelineDates: (id: string, startDate: string, endDate: string, slotCount: number, timeZone: string) => Promise<void>;
  useLocationColors: boolean;
  onToggleUseLocationColors: (enabled: boolean) => void;
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

export const ManageTimelinesModal: React.FC<Props> = ({ isOpen, onClose, mode, timelines, activeId, setActiveId, renameTimeline, updateTimelineDates, useLocationColors, onToggleUseLocationColors, locations, onAddLocation, onUpdateLocation, onDeleteLocation, onExportLocations, onImportLocations, deleteTimeline, archiveTimeline, unarchiveTimeline, initialEditingTimelineId, initialSection }) => {
  const [editingTimeline, setEditingTimeline] = useState<TimelineMeta | null>(null);
  const [editingSection, setEditingSection] = useState<'timeline' | 'locations'>('timeline');
  const [isSaving, setIsSaving] = useState(false);
  const directEditMode = mode === 'edit';

  React.useEffect(() => {
    if (!isOpen) {
      setEditingTimeline(null);
      setEditingSection('timeline');
      setIsSaving(false);
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
              <div className="space-y-4">
                <form
                  className="space-y-4"
                  onSubmit={async event => {
                    event.preventDefault();
                    if (isSaving) return;

                    setIsSaving(true);
                    const formData = new FormData(event.currentTarget);
                    const name = String(formData.get('name')).trim();
                    const startDate = String(formData.get('startDate'));
                    const endDate = String(formData.get('endDate'));
                    const timeZone = String(formData.get('timeZone'));
                    const slotCount = Number(formData.get('slotCount'));
                    if (!name || !startDate || !endDate || endDate < startDate) {
                      setIsSaving(false);
                      return;
                    }
                    if (!Number.isFinite(slotCount) || slotCount < 1) {
                      setIsSaving(false);
                      return;
                    }

                    try {
                      const nextStartDate = zonedDateTimeToUtc(startDate, '01:00', timeZone);
                      const nextEndDate = zonedDateTimeToUtc(endDate, '23:00', timeZone);
                      if (!nextStartDate || !nextEndDate) return;
                      const hasNameChange = name !== editingTimeline.name;
                      const hasTimelineChange = nextStartDate.toISOString() !== new Date(editingTimeline.startDate).toISOString()
                        || nextEndDate.toISOString() !== new Date(editingTimeline.endDate).toISOString()
                        || Math.floor(slotCount) !== editingTimeline.slotCount
                        || timeZone !== editingTimeline.timeZone;

                      if (hasNameChange) {
                        await renameTimeline(editingTimeline.id, name);
                      }
                      if (hasTimelineChange) {
                        await updateTimelineDates(editingTimeline.id, nextStartDate.toISOString(), nextEndDate.toISOString(), Math.floor(slotCount), timeZone);
                      }
                      setEditingTimeline(null);
                      if (directEditMode) {
                        onClose();
                      }
                    } catch (error) {
                      console.error('Failed to save timeline changes', error);
                      alert('Timeline changes could not be saved. Please try again.');
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                >
                  <label className="block text-sm font-medium text-gray-700">
                    Name
                    <input name="name" defaultValue={editingTimeline.name} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-gray-900" required />
                  </label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Start date
                      <input name="startDate" type="date" defaultValue={formatDateInputInTimeZone(new Date(editingTimeline.startDate), editingTimeline.timeZone)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-gray-900" required />
                    </label>
                    <label className="block text-sm font-medium text-gray-700">
                      End date
                      <input name="endDate" type="date" defaultValue={formatDateInputInTimeZone(new Date(editingTimeline.endDate), editingTimeline.timeZone)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-gray-900" required />
                    </label>
                  </div>
                  <label className="block text-sm font-medium text-gray-700">
                    Timezone
                    <select name="timeZone" defaultValue={getRepresentativeTimeZone(editingTimeline.timeZone, new Date(editingTimeline.startDate))} className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900">
                      {TIME_ZONE_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                    <label className="flex flex-col items-start text-sm font-medium text-gray-700">
                      Slots
                      <input
                        name="slotCount"
                        type="number"
                        min={1}
                        max={24}
                        defaultValue={editingTimeline.slotCount}
                        className="mt-1 block w-24 rounded border border-gray-300 px-3 py-2 text-gray-900"
                        required
                      />
                    </label>

                    <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 sm:min-w-56 sm:gap-4 sm:px-4">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900">Color by location</div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={useLocationColors}
                        onClick={() => onToggleUseLocationColors(!useLocationColors)}
                        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${useLocationColors ? 'bg-blue-600' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${useLocationColors ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
                    <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-row">
                      <button
                        type="button"
                        onClick={() => {
                          archiveTimeline(editingTimeline.id);
                          setEditingTimeline(null);
                          if (directEditMode) {
                            onClose();
                          }
                        }}
                        className="w-full rounded border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm font-medium text-yellow-800 hover:bg-yellow-100 sm:w-auto sm:px-4"
                      >
                        Archive
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!confirm(`Delete timeline "${editingTimeline.name}"? This will remove its events from storage.`)) return;

                          deleteTimeline(editingTimeline.id);
                          setEditingTimeline(null);
                          if (directEditMode) {
                            onClose();
                          }
                        }}
                        className="w-full rounded border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 sm:w-auto sm:px-4"
                      >
                        Delete
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-end">
                      <button type="button" onClick={() => setEditingTimeline(null)} disabled={isSaving} className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-4">Cancel</button>
                      <button type="submit" disabled={isSaving} className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-4">{isSaving ? 'Saving...' : 'Save'}</button>
                    </div>
                  </div>
                </form>
              </div>
            ) : (
              <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4">
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

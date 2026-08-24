import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { CosplayEntry } from '../types/timeline';
import { formatDateHeader, getDayKey, parseDayKey } from '../utils/timelineUtils';

interface CosplayEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dayKey: string, title: string, entryId?: string) => void;
  onDelete: (entryId: string) => void;
  entry?: CosplayEntry | null;
  dayKey?: string | null;
  days: Date[];
}

export const CosplayEntryModal: React.FC<CosplayEntryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  entry,
  dayKey,
  days
}) => {
  const [title, setTitle] = useState('');
  const [selectedDayKey, setSelectedDayKey] = useState('');

  useEffect(() => {
    setTitle(entry?.title || '');
    setSelectedDayKey(entry?.dayKey || dayKey || '');
  }, [entry, dayKey, isOpen]);

  if (!isOpen) return null;

  const currentDayKey = entry?.dayKey || dayKey || '';
  const currentDay = currentDayKey ? parseDayKey(currentDayKey) : null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !selectedDayKey) return;

    onSave(selectedDayKey, trimmedTitle, entry?.id);
    onClose();
  };

  const handleDelete = () => {
    if (!entry) return;
    onDelete(entry.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
      <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-md flex-col overflow-hidden rounded-lg bg-white shadow-xl sm:max-h-[90vh]">
        <div className="flex shrink-0 items-center justify-between border-b p-4 sm:p-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {entry ? 'Edit Cosplay Entry' : 'Create Cosplay Entry'}
            </h2>
            {currentDay && (
              <p className="mt-1 text-sm text-gray-500">{formatDateHeader(currentDay)}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 transition-colors hover:text-gray-600"
            type="button"
            aria-label="Close cosplay entry editor"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          <div>
            <label htmlFor="cosplay-entry-title" className="mb-2 block text-sm font-medium text-gray-700">
              Title
            </label>
            <input
              id="cosplay-entry-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter cosplay entry title"
              autoComplete="off"
              required
            />
          </div>

          <div>
            <label htmlFor="cosplay-entry-day" className="mb-2 block text-sm font-medium text-gray-700">
              Date
            </label>
            <select
              id="cosplay-entry-day"
              value={selectedDayKey}
              onChange={(event) => setSelectedDayKey(event.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {days.map(day => {
                const optionKey = getDayKey(day);

                return (
                  <option key={optionKey} value={optionKey}>
                    {formatDateHeader(day)}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <div>
              {entry && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
                >
                  Delete
                </button>
              )}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
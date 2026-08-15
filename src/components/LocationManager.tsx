import React, { useRef, useState } from 'react';
import { X, Plus, Edit3, Trash2, MapPin, Check, Download, Upload } from 'lucide-react';
import type { Location } from '../types/timeline';

interface LocationManagerProps {
  isOpen: boolean;
  onClose: () => void;
  locations: Location[];
  onAddLocation: (name: string) => Location;
  onUpdateLocation: (locationId: string, name: string) => void;
  onDeleteLocation: (locationId: string) => void;
  onExportLocations: () => void;
  onImportLocations: (file: File) => Promise<unknown>;
  embedded?: boolean;
}

export const LocationManager: React.FC<LocationManagerProps> = ({
  isOpen,
  onClose,
  locations,
  onAddLocation,
  onUpdateLocation,
  onDeleteLocation,
  onExportLocations,
  onImportLocations,
  embedded = false
}) => {
  const [newLocationName, setNewLocationName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      await onImportLocations(file);
    } catch (error) {
      alert('Failed to import locations. Please check the file format.');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAddLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocationName.trim()) return;

    // Check if location already exists
    const existingLocation = locations.find(
      loc => loc.name.toLowerCase() === newLocationName.trim().toLowerCase()
    );

    if (existingLocation) {
      alert('A location with this name already exists.');
      return;
    }

    onAddLocation(newLocationName.trim());
    setNewLocationName('');
  };

  const handleStartEdit = (location: Location) => {
    setEditingId(location.id);
    setEditingName(location.name);
  };

  const handleSaveEdit = () => {
    if (!editingName.trim() || !editingId) return;

    // Check if another location already has this name
    const existingLocation = locations.find(
      loc => loc.id !== editingId && loc.name.toLowerCase() === editingName.trim().toLowerCase()
    );

    if (existingLocation) {
      alert('A location with this name already exists.');
      return;
    }

    onUpdateLocation(editingId, editingName.trim());
    setEditingId(null);
    setEditingName('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleDeleteLocation = (locationId: string) => {
    const location = locations.find(loc => loc.id === locationId);
    if (!location) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${location.name}"? This action cannot be undone.`
    );

    if (confirmed) {
      onDeleteLocation(locationId);
    }
  };

  if (!isOpen && !embedded) return null;

  const shell = embedded
    ? 'w-full min-h-0 flex flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white'
    : 'bg-white rounded-lg shadow-xl w-full max-w-md max-h-[calc(100dvh-1rem)] flex flex-col overflow-hidden sm:max-h-[80vh]';

  const content = (
    <div className={shell}>
        <div className="border-b p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 sm:text-xl">
              <MapPin size={20} />
              Manage Locations
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 transition-colors hover:text-gray-600 sm:hidden"
              type="button"
            >
              <X size={24} />
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onExportLocations}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-3"
              disabled={locations.length === 0}
            >
              <Download size={14} />
              Export
            </button>
            <button
              type="button"
              onClick={handleImportClick}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-3"
              disabled={isImporting}
            >
              <Upload size={14} />
              {isImporting ? 'Importing...' : 'Import'}
            </button>
            <button
              onClick={onClose}
              className="hidden text-gray-400 transition-colors hover:text-gray-600 sm:block"
              type="button"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {/* Add new location form */}
          <form onSubmit={handleAddLocation} className="mb-5 sm:mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Add New Location
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                placeholder="Enter location name"
                maxLength={50}
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                disabled={!newLocationName.trim()}
              >
                <Plus size={16} />
              </button>
            </div>
          </form>

          {/* Locations list */}
          <div>
            <h3 className="mb-3 text-sm font-medium text-gray-700">
              Current Locations ({locations.length})
            </h3>

            {locations.length === 0 ? (
              <p className="text-gray-500 text-sm italic">No locations added yet.</p>
            ) : (
                <div className="space-y-2">
                {locations
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((location) => (
                    <div
                      key={location.id}
                        className="group flex items-center gap-2 rounded-md bg-gray-50 p-3"
                    >
                      <MapPin size={14} className="text-gray-400 flex-shrink-0" />

                      {editingId === location.id ? (
                        <>
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            maxLength={50}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit();
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                          />
                          <button
                            onClick={handleSaveEdit}
                            className="p-1 text-green-600 hover:text-green-700 transition-colors"
                            title="Save changes"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Cancel editing"
                          >
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm text-gray-900">
                            {location.name}
                          </span>
                          <div className="flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                            <button
                              onClick={() => handleStartEdit(location)}
                              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Edit location"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteLocation(location.id)}
                              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                              title="Delete location"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t p-4 sm:p-6">
          <button
            onClick={onClose}
            className="w-full rounded-md bg-gray-300 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-400"
          >
            {embedded ? 'Back to Timeline' : 'Done'}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      {content}
    </div>
  );
};

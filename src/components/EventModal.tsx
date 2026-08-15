import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Palette, MapPin, Plus } from 'lucide-react';
import type { TimelineEvent, Location } from '../types/timeline';
import { getEventColors, roundToNearestHalfHour } from '../utils/timelineUtils';
import { EVENT_BUFFER_OPTIONS_MINUTES } from '../config/timeline';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: Omit<TimelineEvent, 'id' | 'position'>) => void;
  onDelete?: (eventId: string) => void;
  event?: TimelineEvent;
  initialStartTime?: Date;
  locations: Location[];
  onAddLocation: (name: string) => Location;
  recentLocations: string[];
  popularLocations: string[];
}

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  event,
  initialStartTime,
  locations,
  onAddLocation,
  recentLocations,
  popularLocations
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startDateValue, setStartDateValue] = useState('');
  const [startTimeValue, setStartTimeValue] = useState('');
  const [endDateValue, setEndDateValue] = useState('');
  const [endTimeValue, setEndTimeValue] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [bufferBeforeMinutes, setBufferBeforeMinutes] = useState(0);
  const [isCreateLocationOpen, setIsCreateLocationOpen] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');

  // Get colors once, outside of useEffect
  const colors = getEventColors();

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description || '');
      setLocation(event.location || '');
      setStartDateValue(formatDateValue(event.startTime));
      setStartTimeValue(formatTimeValue(event.startTime));
      setEndDateValue(formatDateValue(event.endTime));
      setEndTimeValue(formatTimeValue(event.endTime));
      setColor(event.color);
      setBufferBeforeMinutes(event.bufferBeforeMinutes ?? 0);
      setIsCreateLocationOpen(false);
      setNewLocationName('');
    } else if (initialStartTime) {
      const rounded = roundToNearestHalfHour(initialStartTime);
      const end = new Date(rounded);
      end.setMinutes(end.getMinutes() + 30);
      
      setTitle('');
      setDescription('');
      setLocation('');
      setStartDateValue(formatDateValue(rounded));
      setStartTimeValue(formatTimeValue(rounded));
      setEndDateValue(formatDateValue(end));
      setEndTimeValue(formatTimeValue(end));
      setColor('#3B82F6'); // Use static color instead of colors[0]
      setBufferBeforeMinutes(0);
      setIsCreateLocationOpen(false);
      setNewLocationName('');
    }
  }, [event, initialStartTime]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const startTime = buildDateTime(startDateValue, startTimeValue);
    const endTime = buildDateTime(endDateValue, endTimeValue);

    if (!startTime || !endTime || endTime <= startTime) return;

    onSave({
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      startTime,
      endTime,
      color,
      bufferBeforeMinutes
    });
    onClose();
  };

  const handleDelete = () => {
    if (event && onDelete) {
      onDelete(event.id);
      onClose();
    }
  };

  const formatDateValue = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatTimeValue = (date: Date): string => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const buildDateTime = (dateValue: string, timeValue: string): Date | null => {
    if (!dateValue || !timeValue) return null;

    const parsed = new Date(`${dateValue}T${timeValue}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const handleStartDateChange = (value: string) => {
    setStartDateValue(value);

    const newStartTime = buildDateTime(value, startTimeValue);
    const currentEndTime = buildDateTime(endDateValue, endTimeValue);

    if (newStartTime && currentEndTime && newStartTime >= currentEndTime) {
      const newEndTime = new Date(newStartTime);
      newEndTime.setMinutes(newEndTime.getMinutes() + 30);
      setEndDateValue(formatDateValue(newEndTime));
      setEndTimeValue(formatTimeValue(newEndTime));
    }
  };

  const handleStartTimeChange = (value: string) => {
    setStartTimeValue(value);

    const newStartTime = buildDateTime(startDateValue, value);
    const currentEndTime = buildDateTime(endDateValue, endTimeValue);

    if (newStartTime && currentEndTime && newStartTime >= currentEndTime) {
      const newEndTime = new Date(newStartTime);
      newEndTime.setMinutes(newEndTime.getMinutes() + 30);
      setEndDateValue(formatDateValue(newEndTime));
      setEndTimeValue(formatTimeValue(newEndTime));
    }
  };

  const handleEndDateChange = (value: string) => {
    setEndDateValue(value);
  };

  const handleEndTimeChange = (value: string) => {
    setEndTimeValue(value);
  };

  const handleLocationSelect = (selectedLocation: string) => {
    setLocation(selectedLocation);
  };

  const handleCreateLocation = () => {
    const trimmedName = newLocationName.trim();
    if (!trimmedName) return;

    const existingLocation = locations.find(
      loc => loc.name.toLowerCase() === trimmedName.toLowerCase()
    );

    const savedLocation = existingLocation || onAddLocation(trimmedName);
    setLocation(savedLocation.name);
    setNewLocationName('');
    setIsCreateLocationOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-2 sm:p-4">
      <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-md flex-col overflow-hidden rounded-lg bg-white shadow-xl sm:max-h-[90vh]">
        <div className="flex shrink-0 items-center justify-between border-b p-4 sm:p-6">
          <h2 className="text-xl font-semibold text-gray-900">
            {event ? 'Edit Event' : 'Create Event'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            type="button"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          <div>
            <label htmlFor="event-title" className="block text-sm font-medium text-gray-700 mb-2">
              Event Title
            </label>
            <input
              id="event-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
              placeholder="Enter event title"
              autoComplete="off"
              required
            />
          </div>

          <div>
            <label htmlFor="event-description" className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              id="event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white resize-none"
              placeholder="Enter event description"
              rows={3}
              autoComplete="off"
            />
          </div>

          <div className="relative">
            <label htmlFor="event-location" className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin size={16} className="inline mr-1" />
              Location (Optional)
            </label>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  id="event-location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                  placeholder="Enter or select location"
                  list="locations-list"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => {
                    setNewLocationName(location.trim());
                    setIsCreateLocationOpen(true);
                  }}
                  className="shrink-0 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-700 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  aria-label="Add a new location"
                  title="Add a new location"
                >
                  <Plus size={16} />
                </button>
              </div>
              
              <datalist id="locations-list">
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.name} />
                ))}
              </datalist>

              {(recentLocations.length > 0 || popularLocations.length > 0) && (
                <div className="space-y-2">
                  {recentLocations.length > 0 && (
                    <div>
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Recent</div>
                      <div className="flex flex-wrap gap-1">
                        {recentLocations.map((name) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => handleLocationSelect(name)}
                            className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                              location === name
                                ? 'bg-blue-100 border-blue-300 text-blue-700'
                                : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {popularLocations.length > 0 && (
                    <div>
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Popular</div>
                      <div className="flex flex-wrap gap-1">
                        {popularLocations.map((name) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => handleLocationSelect(name)}
                            className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                              location === name
                                ? 'bg-blue-100 border-blue-300 text-blue-700'
                                : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar size={16} className="inline mr-1" />
                  Start Date
                </label>
                <input
                  id="start-date"
                  type="date"
                  value={startDateValue}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                  required
                />
              </div>

              <div>
                <label htmlFor="start-time" className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock size={16} className="inline mr-1" />
                  Start Time
                </label>
                <input
                  id="start-time"
                  type="time"
                  value={startTimeValue}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                  step="1800"
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar size={16} className="inline mr-1" />
                  End Date
                </label>
                <input
                  id="end-date"
                  type="date"
                  value={endDateValue}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                  min={startDateValue}
                  required
                />
              </div>

              <div>
                <label htmlFor="end-time" className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock size={16} className="inline mr-1" />
                  End Time
                </label>
                <input
                  id="end-time"
                  type="time"
                  value={endTimeValue}
                  onChange={(e) => handleEndTimeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                  step="1800"
                  min={endDateValue === startDateValue ? startTimeValue : undefined}
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Palette size={16} className="inline mr-1" />
              Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {colors.map((colorOption) => (
                <button
                  key={colorOption}
                  type="button"
                  onClick={() => setColor(colorOption)}
                  className={`w-8 h-8 rounded-full border-2 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                    color === colorOption
                      ? 'border-gray-800 scale-110'
                      : 'border-gray-300 hover:border-gray-500'
                  }`}
                  style={{ backgroundColor: colorOption }}
                  aria-label={`Select color ${colorOption}`}
                />
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="buffer-before" className="block text-sm font-medium text-gray-700 mb-2">
              <Clock size={16} className="inline mr-1" />
              Waiting Buffer
            </label>
            <select
              id="buffer-before"
              value={bufferBeforeMinutes}
              onChange={(e) => setBufferBeforeMinutes(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {EVENT_BUFFER_OPTIONS_MINUTES.map(option => (
                <option key={option} value={option}>
                  {option === 0 ? 'None' : option === 30 ? '30 min' : option === 60 ? '1 hr' : '2 hrs'}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">Reserves time before the event so other events avoid it.</p>
          </div>

          <div className="flex flex-col gap-3 pt-4 sm:flex-row">
            <div className="flex flex-1 gap-3">
              {event && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors font-medium"
                >
                  Delete
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>

            <button
              type="submit"
              className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors font-medium sm:self-end"
            >
              {event ? 'Save' : 'Save'}
            </button>
          </div>
        </form>

        {isCreateLocationOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
            <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl sm:p-5">
              <h3 className="text-base font-semibold text-gray-900">Add location</h3>
              <p className="mt-1 text-sm text-gray-600">
                Create a new location for this event.
              </p>
              <input
                autoFocus
                type="text"
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
                className="mt-4 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Location name"
              />
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateLocationOpen(false);
                    setNewLocationName('');
                  }}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateLocation}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

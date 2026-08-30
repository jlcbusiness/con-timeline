import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, Clock, Palette, MapPin, Plus, Lock, ChevronDown, Heart } from 'lucide-react';
import type { TimelineEvent, Location } from '../types/timeline';
import { getEventColors, roundToNearestHalfHour } from '../utils/timelineUtils';
import { EVENT_BUFFER_OPTIONS_MINUTES } from '../config/timeline';

const normalizeColor = (color: string) => color.trim().toLowerCase();
type LockMode = 'off' | 'time' | 'mega';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: Omit<TimelineEvent, 'id' | 'position'>) => void;
  onDelete?: (eventId: string) => void;
  event?: TimelineEvent;
  initialEvent?: Omit<TimelineEvent, 'id' | 'position'>;
  initialStartTime?: Date;
  locations: Location[];
  onAddLocation: (name: string) => Location;
  locationOptions: string[];
  suggestedLocations: string[];
  fandomOptions: string[];
  suggestedFandoms: string[];
  onAddFandom: (name: string) => { name: string };
}

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  event,
  initialEvent,
  initialStartTime,
  locations,
  onAddLocation,
  locationOptions,
  suggestedLocations,
  fandomOptions,
  suggestedFandoms,
  onAddFandom
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [fandom, setFandom] = useState('');
  const [startDateValue, setStartDateValue] = useState('');
  const [startTimeValue, setStartTimeValue] = useState('');
  const [endDateValue, setEndDateValue] = useState('');
  const [endTimeValue, setEndTimeValue] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [bufferBeforeMinutes, setBufferBeforeMinutes] = useState(0);
  const [lockMode, setLockMode] = useState<LockMode>('off');
  const [intangible, setIntangible] = useState(false);
  const [isCreateLocationOpen, setIsCreateLocationOpen] = useState(false);
  const [isLocationMenuOpen, setIsLocationMenuOpen] = useState(false);
  const [locationFilterQuery, setLocationFilterQuery] = useState('');
  const [newLocationName, setNewLocationName] = useState('');
  const [isCreateFandomOpen, setIsCreateFandomOpen] = useState(false);
  const [isFandomMenuOpen, setIsFandomMenuOpen] = useState(false);
  const [fandomFilterQuery, setFandomFilterQuery] = useState('');
  const [newFandomName, setNewFandomName] = useState('');
  const locationPickerRef = useRef<HTMLDivElement>(null);
  const fandomPickerRef = useRef<HTMLDivElement>(null);

  // Get colors once, outside of useEffect
  const colors = getEventColors();
  const topRowColors = colors.slice(0, 5);
  const bottomRowColors = colors.slice(5);
  const swatchLayoutStyle = {
    '--swatch-size': '2rem',
    '--swatch-gap': '0.5rem',
  } as React.CSSProperties;

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description || '');
      setLocation(event.location || '');
      setFandom(event.fandom || '');
      setStartDateValue(formatDateValue(event.startTime));
      setStartTimeValue(formatTimeValue(event.startTime));
      setEndDateValue(formatDateValue(event.endTime));
      setEndTimeValue(formatTimeValue(event.endTime));
      setColor(event.color);
      setBufferBeforeMinutes(event.bufferBeforeMinutes ?? 0);
      setLockMode(event.megaLock ? 'mega' : event.lockTime ? 'time' : 'off');
      setIntangible(event.intangible ?? false);
      setIsCreateLocationOpen(false);
      setIsLocationMenuOpen(false);
      setLocationFilterQuery('');
      setNewLocationName('');
    } else if (initialEvent) {
      setTitle(initialEvent.title);
      setDescription(initialEvent.description || '');
      setLocation(initialEvent.location || '');
      setFandom(initialEvent.fandom || '');
      setStartDateValue(formatDateValue(initialEvent.startTime));
      setStartTimeValue(formatTimeValue(initialEvent.startTime));
      setEndDateValue(formatDateValue(initialEvent.endTime));
      setEndTimeValue(formatTimeValue(initialEvent.endTime));
      setColor(initialEvent.color);
      setBufferBeforeMinutes(initialEvent.bufferBeforeMinutes ?? 0);
      setLockMode(initialEvent.megaLock ? 'mega' : initialEvent.lockTime ? 'time' : 'off');
      setIntangible(initialEvent.intangible ?? false);
      setIsCreateLocationOpen(false);
      setIsLocationMenuOpen(false);
      setLocationFilterQuery('');
      setNewLocationName('');
    } else if (initialStartTime) {
      const rounded = roundToNearestHalfHour(initialStartTime);
      const end = new Date(rounded);
      end.setMinutes(end.getMinutes() + 30);
      
      setTitle('');
      setDescription('');
      setLocation('');
      setFandom('');
      setStartDateValue(formatDateValue(rounded));
      setStartTimeValue(formatTimeValue(rounded));
      setEndDateValue(formatDateValue(end));
      setEndTimeValue(formatTimeValue(end));
      setColor('#3b82f6'); // Use static color instead of colors[0]
      setBufferBeforeMinutes(0);
      setLockMode('off');
      setIntangible(false);
      setIsCreateLocationOpen(false);
      setIsLocationMenuOpen(false);
      setLocationFilterQuery('');
      setNewLocationName('');
    }
  }, [event, initialEvent, initialStartTime]);

  useEffect(() => {
    if (!isLocationMenuOpen) return;

    const handlePointerDown = (pointerEvent: PointerEvent) => {
      if (!locationPickerRef.current?.contains(pointerEvent.target as Node)) {
        setIsLocationMenuOpen(false);
        setLocationFilterQuery('');
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isLocationMenuOpen]);

  useEffect(() => {
    if (!isFandomMenuOpen) return;

    const handlePointerDown = (pointerEvent: PointerEvent) => {
      if (!fandomPickerRef.current?.contains(pointerEvent.target as Node)) {
        setIsFandomMenuOpen(false);
        setFandomFilterQuery('');
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isFandomMenuOpen]);

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
      fandom: fandom.trim(),
      startTime,
      endTime,
      color,
      bufferBeforeMinutes,
      lockTime: lockMode !== 'off',
      megaLock: lockMode === 'mega',
      intangible
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

  const startDateTime = buildDateTime(startDateValue, startTimeValue);
  const endDateTime = buildDateTime(endDateValue, endTimeValue);
  const hasInvalidTimeRange = Boolean(startDateTime && endDateTime && endDateTime <= startDateTime);

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
    setIsLocationMenuOpen(false);
    setLocationFilterQuery('');
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

  const handleFandomSelect = (selectedFandom: string) => {
    setFandom(selectedFandom);
    setIsFandomMenuOpen(false);
    setFandomFilterQuery('');
  };

  const handleCreateFandom = () => {
    const trimmedName = newFandomName.trim();
    if (!trimmedName) return;

    const savedFandom = onAddFandom(trimmedName);
    setFandom(savedFandom.name);
    setNewFandomName('');
    setIsCreateFandomOpen(false);
  };

  if (!isOpen) return null;

  const normalizedLocationQuery = locationFilterQuery.trim().toLocaleLowerCase();
  const filteredLocations = locationOptions.filter(name =>
    !normalizedLocationQuery || name.toLocaleLowerCase().includes(normalizedLocationQuery)
  );
  const normalizedFandomQuery = fandomFilterQuery.trim().toLocaleLowerCase();
  const filteredFandoms = fandomOptions.filter(name =>
    !normalizedFandomQuery || name.toLocaleLowerCase().includes(normalizedFandomQuery)
  );

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

          <div className="relative">
            <label htmlFor="event-location" className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin size={16} className="inline mr-1" />
              Location (Optional)
            </label>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div ref={locationPickerRef} className="relative min-w-0 flex-1">
                  <input
                    id="event-location"
                    type="text"
                    role="combobox"
                    aria-expanded={isLocationMenuOpen}
                    aria-controls="event-location-options"
                    value={location}
                    onFocus={() => {
                      setLocationFilterQuery('');
                      setIsLocationMenuOpen(true);
                    }}
                    onChange={(e) => {
                      setLocation(e.target.value);
                      setLocationFilterQuery(e.target.value);
                      setIsLocationMenuOpen(true);
                    }}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 pr-10 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter or select location"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (isLocationMenuOpen) {
                        setIsLocationMenuOpen(false);
                        setLocationFilterQuery('');
                        return;
                      }

                      setLocationFilterQuery('');
                      setIsLocationMenuOpen(true);
                    }}
                    className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-gray-500 hover:text-gray-800"
                    title="Show locations"
                    aria-label="Show locations"
                  >
                    <ChevronDown size={17} className={`transition-transform ${isLocationMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isLocationMenuOpen && (
                    <div
                      id="event-location-options"
                      role="listbox"
                      className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
                    >
                      {filteredLocations.length > 0 ? filteredLocations.map(name => (
                        <button
                          key={name.toLocaleLowerCase()}
                          type="button"
                          role="option"
                          aria-selected={location.toLocaleLowerCase() === name.toLocaleLowerCase()}
                          onClick={() => handleLocationSelect(name)}
                          className={`block w-full px-3 py-2 text-left text-sm ${
                            location.toLocaleLowerCase() === name.toLocaleLowerCase()
                              ? 'bg-blue-50 font-medium text-blue-700'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {name}
                        </button>
                      )) : (
                        <div className="px-3 py-2 text-sm text-gray-500">No matching locations</div>
                      )}
                    </div>
                  )}
                </div>
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

              {suggestedLocations.length > 0 && (
                <div>
                  <div className="flex flex-wrap gap-1">
                    {suggestedLocations.map((name) => (
                      <button
                        key={name.toLocaleLowerCase()}
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
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Palette size={16} className="inline mr-1" />
              Color
            </label>
            <div
              className="mx-auto flex w-fit flex-col items-center gap-[var(--swatch-gap)]"
              style={swatchLayoutStyle}
            >
              <div
                className="grid w-fit grid-cols-5 gap-[var(--swatch-gap)]"
                style={{ transform: 'translateX(calc((var(--swatch-size) + var(--swatch-gap)) / -4))' }}
              >
                {topRowColors.map((colorOption) => (
                  <button
                    key={colorOption}
                    type="button"
                    onClick={() => setColor(colorOption)}
                    className={`w-[var(--swatch-size)] h-[var(--swatch-size)] rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                      normalizeColor(color) === normalizeColor(colorOption)
                        ? 'border-2 border-gray-800 shadow-[inset_0_0_0_1px_white] scale-110'
                        : 'border border-gray-300 hover:border-gray-500'
                    }`}
                    style={{ backgroundColor: colorOption }}
                    aria-label={`Select color ${colorOption}`}
                  />
                ))}
              </div>
              <div
                className="grid w-fit grid-cols-5 gap-[var(--swatch-gap)]"
                style={{ transform: 'translateX(calc((var(--swatch-size) + var(--swatch-gap)) / 4))' }}
              >
                {bottomRowColors.map((colorOption) => (
                  <button
                    key={colorOption}
                    type="button"
                    onClick={() => setColor(colorOption)}
                    className={`w-[var(--swatch-size)] h-[var(--swatch-size)] rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                      normalizeColor(color) === normalizeColor(colorOption)
                        ? 'border-2 border-gray-800 shadow-[inset_0_0_0_1px_white]'
                        : 'border border-gray-300 hover:border-gray-500'
                    }`}
                    style={{ backgroundColor: colorOption }}
                    aria-label={`Select color ${colorOption}`}
                  />
                ))}
              </div>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-500"
                  step="1800"
                  min={endDateValue === startDateValue ? startTimeValue : undefined}
                  required
                />
              </div>

              {hasInvalidTimeRange && (
                <p className="text-sm font-medium text-red-600">
                  We can&apos;t go back in time yet, McFly!
                </p>
              )}
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
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
            >
              {EVENT_BUFFER_OPTIONS_MINUTES.map(option => (
                <option key={option} value={option}>
                  {option === 0 ? 'None' : option === 30 ? '30 min' : option === 60 ? '1 hr' : '2 hrs'}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">Reserves time before the event so other events avoid it.</p>
          </div>

          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
            <div className="flex items-center justify-between gap-3 text-sm font-medium text-gray-900">
              <div className="flex items-center gap-2">
                <Lock size={14} />
                Lock
              </div>
              <div className="grid grid-cols-3 overflow-hidden rounded-md border border-gray-300 bg-white" role="radiogroup" aria-label="Event lock mode">
                {(['off', 'time', 'mega'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={lockMode === mode}
                    onClick={() => setLockMode(mode)}
                    className={`border-r border-gray-300 px-2 py-1.5 text-xs font-medium last:border-r-0 ${lockMode === mode ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    {mode === 'off' ? 'Off' : mode === 'time' ? 'Time' : 'MEGA'}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-600">
              {lockMode === 'mega'
                ? 'Locks both the event\'s time and its slot position when dragged.'
                : lockMode === 'time'
                  ? 'Keeps the event on the same time range. You can still move it between slots.'
                  : 'Allows dragging to change both time and slot position.'}
            </p>
          </div>

          <div className="flex items-start gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
            <input
              id="event-intangible"
              type="checkbox"
              checked={intangible}
              onChange={(e) => setIntangible(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="min-w-0">
              <label htmlFor="event-intangible" className="flex items-center gap-2 text-sm font-medium text-gray-900">
                Intangible
              </label>
              <p className="text-xs text-gray-600">
                Fades the event and keeps it out of collision and automatic sorting.
              </p>
            </div>
          </div>

          <div className="relative">
            <div className="mb-2 flex items-center justify-between gap-2">
              <label htmlFor="event-fandom" className="block text-sm font-medium text-gray-700">
                <Heart size={16} className="mr-1 inline" />
                Fandom (Optional)
              </label>
              {fandom.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    setFandom('');
                    setFandomFilterQuery('');
                    setIsFandomMenuOpen(false);
                  }}
                  className="text-xs font-medium text-red-800 hover:text-red-950 hover:underline"
                >
                  (Remove)
                </button>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div ref={fandomPickerRef} className="relative min-w-0 flex-1">
                  <input
                    id="event-fandom"
                    type="text"
                    role="combobox"
                    aria-expanded={isFandomMenuOpen}
                    aria-controls="event-fandom-options"
                    value={fandom}
                    onFocus={() => {
                      setFandomFilterQuery('');
                      setIsFandomMenuOpen(true);
                    }}
                    onChange={(changeEvent) => {
                      setFandom(changeEvent.target.value);
                      setFandomFilterQuery(changeEvent.target.value);
                      setIsFandomMenuOpen(true);
                    }}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 pr-10 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter or select fandom"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFandomFilterQuery('');
                      setIsFandomMenuOpen(current => !current);
                    }}
                    className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-gray-500 hover:text-gray-800"
                    title="Show fandoms"
                    aria-label="Show fandoms"
                  >
                    <ChevronDown size={17} className={`transition-transform ${isFandomMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isFandomMenuOpen && (
                    <div id="event-fandom-options" role="listbox" aria-label="Fandoms" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                      {filteredFandoms.length > 0 ? filteredFandoms.map(name => (
                        <button
                          key={name.toLocaleLowerCase()}
                          type="button"
                          role="option"
                          aria-selected={fandom.toLocaleLowerCase() === name.toLocaleLowerCase()}
                          onClick={() => handleFandomSelect(name)}
                          className={`block w-full px-3 py-2 text-left text-sm ${fandom.toLocaleLowerCase() === name.toLocaleLowerCase() ? 'bg-blue-50 font-medium text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                          {name}
                        </button>
                      )) : <div className="px-3 py-2 text-sm text-gray-500">No matching fandoms</div>}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNewFandomName(fandom.trim());
                    setIsCreateFandomOpen(true);
                  }}
                  className="inline-flex shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-700 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  aria-label="Add a new fandom"
                  title="Add a new fandom"
                >
                  <Plus size={16} />
                </button>
              </div>
              {suggestedFandoms.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {suggestedFandoms.map(name => (
                    <button key={name.toLocaleLowerCase()} type="button" onClick={() => handleFandomSelect(name)} className={`rounded-md border px-2 py-1 text-xs transition-colors ${fandom === name ? 'border-blue-300 bg-blue-100 text-blue-700' : 'border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
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

        {isCreateFandomOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
            <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl sm:p-5">
              <h3 className="text-base font-semibold text-gray-900">Add fandom</h3>
              <p className="mt-1 text-sm text-gray-600">Create a new fandom for this event.</p>
              <input autoFocus type="text" value={newFandomName} onChange={(changeEvent) => setNewFandomName(changeEvent.target.value)} className="mt-4 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Fandom name" />
              <div className="mt-5 flex justify-end gap-3">
                <button type="button" onClick={() => { setIsCreateFandomOpen(false); setNewFandomName(''); }} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="button" onClick={handleCreateFandom} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Save</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Palette, MapPin } from 'lucide-react';
import type { TimelineEvent, Location } from '../types/timeline';
import { getEventColors, roundToNearestHalfHour } from '../utils/timelineUtils';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: Omit<TimelineEvent, 'id' | 'position'>) => void;
  onDelete?: (eventId: string) => void;
  event?: TimelineEvent;
  initialStartTime?: Date;
  locations: Location[];
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
  recentLocations,
  popularLocations
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [color, setColor] = useState('#3B82F6');

  // Get colors once, outside of useEffect
  const colors = getEventColors();

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description || '');
      setLocation(event.location || '');
      setStartTime(event.startTime);
      setEndTime(event.endTime);
      setColor(event.color);
    } else if (initialStartTime) {
      const rounded = roundToNearestHalfHour(initialStartTime);
      const end = new Date(rounded);
      end.setMinutes(end.getMinutes() + 30);
      
      setTitle('');
      setDescription('');
      setLocation('');
      setStartTime(rounded);
      setEndTime(end);
      setColor('#3B82F6'); // Use static color instead of colors[0]
    }
  }, [event, initialStartTime]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      startTime,
      endTime,
      color
    });
    onClose();
  };

  const handleDelete = () => {
    if (event && onDelete) {
      onDelete(event.id);
      onClose();
    }
  };

  const formatDateTimeLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleStartTimeChange = (value: string) => {
    const newStartTime = new Date(value);
    setStartTime(newStartTime);
    
    // Ensure end time is at least 30 minutes after start time
    if (newStartTime >= endTime) {
      const newEndTime = new Date(newStartTime);
      newEndTime.setMinutes(newEndTime.getMinutes() + 30);
      setEndTime(newEndTime);
    }
  };

  const handleEndTimeChange = (value: string) => {
    const newEndTime = new Date(value);
    
    // Ensure end time is at least 30 minutes after start time
    if (newEndTime > startTime) {
      setEndTime(newEndTime);
    }
  };

  const handleLocationSelect = (selectedLocation: string) => {
    setLocation(selectedLocation);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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

          <div>
            <label htmlFor="event-location" className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin size={16} className="inline mr-1" />
              Location (Optional)
            </label>
            
            <div className="space-y-2">
              {/* Location input with datalist */}
              <input
                id="event-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                placeholder="Enter or select location"
                list="locations-list"
                autoComplete="off"
              />
              
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
            <div>
              <label htmlFor="start-time" className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar size={16} className="inline mr-1" />
                Start Time
              </label>
              <input
                id="start-time"
                type="datetime-local"
                value={formatDateTimeLocal(startTime)}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                step="1800"
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
                type="datetime-local"
                value={formatDateTimeLocal(endTime)}
                onChange={(e) => handleEndTimeChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                step="1800"
                min={formatDateTimeLocal(new Date(startTime.getTime() + 30 * 60 * 1000))}
                required
              />
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

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors font-medium"
            >
              {event ? 'Update Event' : 'Create Event'}
            </button>
            
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
        </form>
      </div>
    </div>
  );
};

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, ChevronLeft, ChevronRight, Save, Sparkles } from 'lucide-react';
import type { TimelineEvent as TimelineEventType } from '../types/timeline';
import { TimelineEvent } from './TimelineEvent';
import { EventModal } from './EventModal';
import { LocationManager } from './LocationManager';
import { EventManagementMenu } from './EventManagementMenu';
import { DragonConImporter } from './DragonConImporter';
import { useDragAndResize } from '../hooks/useDragAndResize';
import { useEventPersistence } from '../hooks/useEventPersistence';
import { useLocationPersistence } from '../hooks/useLocationPersistence';
import {
  generateTimeSlots,
  formatTimeSlot,
  formatDateHeader,
  findAvailablePosition,
  getTimePosition
} from '../utils/timelineUtils';

export const Timeline: React.FC = () => {
  // Timeline configuration
  const startDate = new Date(2025, 7, 27, 1, 0, 0); // August 27, 2025, 1 AM
  const endDate = new Date(2025, 8, 2, 23, 0, 0); // September 2, 2025, 11 PM
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLocationManagerOpen, setIsLocationManagerOpen] = useState(false);
  const [isDragonConImporterOpen, setIsDragonConImporterOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEventType | undefined>();
  const [clickedTime, setClickedTime] = useState<Date | undefined>();
  const [scrollPosition, setScrollPosition] = useState(0);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  const timelineContentRef = useRef<HTMLDivElement>(null);
  
  const timeSlots = generateTimeSlots(startDate, endDate);

  // Calculate total timeline width based on actual time duration
  const totalDurationMs = endDate.getTime() - startDate.getTime();
  const totalDurationHours = totalDurationMs / (1000 * 60 * 60);
  const totalTimelineWidth = Math.round(totalDurationHours * 240); // 240px per hour, rounded

  // Event persistence
  const {
    events,
    isLoading: eventsLoading,
    addEvent,
    updateEvent,
    batchUpdateEvents,
    deleteEvent,
    clearAllEvents,
    exportEvents,
    importEvents
  } = useEventPersistence();

  // Location persistence
  const {
    locations,
    isLoading: locationsLoading,
    addLocation,
    updateLocation,
    deleteLocation
  } = useLocationPersistence();

  // Handle event updates for drag and resize
  const handleEventUpdate = (eventId: string, updates: Partial<TimelineEventType>) => {
    updateEvent(eventId, updates);
    setLastSaved(new Date());
  };

  // Handle batch updates for cascading position changes
  const handleBatchUpdate = (updates: { eventId: string; updates: Partial<TimelineEventType> }[]) => {
    batchUpdateEvents(updates);
    setLastSaved(new Date());
  };

  // Drag and resize functionality with cascading support
  const { dragState, startDrag, handleMouseMove, endDrag } = useDragAndResize(
    events,
    handleEventUpdate,
    handleBatchUpdate,
    startDate
  );

  // Track scroll position for navigation
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollPosition(e.currentTarget.scrollLeft);
  }, []);

  // Auto-scroll to current time on mount
  useEffect(() => {
    const now = new Date();
    if (now >= startDate && now <= endDate && timelineContentRef.current) {
      const hoursFromStart = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60);
      const scrollLeft = hoursFromStart * 240 - 400; // Center current time
      const finalScrollLeft = Math.max(0, scrollLeft);
      
      timelineContentRef.current.scrollLeft = finalScrollLeft;
      setScrollPosition(finalScrollLeft);
    }
  }, [startDate, endDate]);

  // Global mouse event handlers for drag and resize
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (dragState.isDragging || dragState.isResizing) {
        e.preventDefault();
        handleMouseMove(e.clientX, e.clientY);
      }
    };

    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (dragState.isDragging || dragState.isResizing) {
        e.preventDefault();
        endDrag();
      }
    };

    if (dragState.isDragging || dragState.isResizing) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.body.style.cursor = dragState.isDragging ? 'grabbing' : 'ew-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragState, handleMouseMove, endDrag]);

  const handleTimeSlotClick = (time: Date) => {
    // Don't create new events if we're dragging
    if (dragState.isDragging || dragState.isResizing) return;
    
    setClickedTime(time);
    setEditingEvent(undefined);
    setIsModalOpen(true);
  };

  const handleEventEdit = (event: TimelineEventType) => {
    // Don't edit if we're dragging
    if (dragState.isDragging || dragState.isResizing) return;
    
    setEditingEvent(event);
    setClickedTime(undefined);
    setIsModalOpen(true);
  };

  const handleEventSave = (eventData: Omit<TimelineEventType, 'id' | 'position'>) => {
    if (editingEvent) {
      // Update existing event
      const position = findAvailablePosition(
        events.filter(e => e.id !== editingEvent.id),
        eventData.startTime,
        eventData.endTime
      );
      
      updateEvent(editingEvent.id, { ...eventData, position });
    } else {
      // Create new event
      const position = findAvailablePosition(events, eventData.startTime, eventData.endTime);
      const newEvent: TimelineEventType = {
        ...eventData,
        id: Date.now().toString(),
        position
      };
      addEvent(newEvent);
    }
    setLastSaved(new Date());
  };

  const handleEventDelete = (eventId: string) => {
    deleteEvent(eventId);
    setLastSaved(new Date());
  };

  const handleImportEvents = async (file: File) => {
    await importEvents(file);
    setLastSaved(new Date());
  };

  const handleClearAllEvents = () => {
    clearAllEvents();
    setLastSaved(new Date());
  };

  const handleDragonConEventAdd = (event: TimelineEventType) => {
    addEvent(event);
    setLastSaved(new Date());
  };

  // Fixed navigation functions for single container
  const scrollTimeline = (direction: 'left' | 'right') => {
    if (timelineContentRef.current) {
      const scrollAmount = 960; // 4 hours worth of scrolling
      const currentScroll = scrollPosition;
      const newScrollLeft = direction === 'left' 
        ? currentScroll - scrollAmount
        : currentScroll + scrollAmount;
      
      const finalScrollLeft = Math.max(0, newScrollLeft);
      
      timelineContentRef.current.scrollTo({
        left: finalScrollLeft,
        behavior: 'smooth'
      });
      
      setScrollPosition(finalScrollLeft);
    }
  };

  // Function to scroll to a specific date
  const scrollToDate = (targetDate: Date) => {
    if (timelineContentRef.current) {
      const eventPosition = getTimePosition(targetDate, startDate);
      const viewportWidth = timelineContentRef.current.clientWidth;
      const scrollLeft = eventPosition - viewportWidth / 2; // Center the date
      const finalScrollLeft = Math.max(0, scrollLeft);
      
      timelineContentRef.current.scrollTo({
        left: finalScrollLeft,
        behavior: 'smooth'
      });
      
      setScrollPosition(finalScrollLeft);
    }
  };

  const getCurrentDateRange = (): string => {
    if (!timelineContentRef.current) return '';
    
    const scrollLeft = scrollPosition;
    const viewportWidth = timelineContentRef.current.clientWidth;
    
    const startHour = Math.floor(scrollLeft / 240);
    const endHour = Math.floor((scrollLeft + viewportWidth) / 240);
    
    const visibleStartTime = new Date(startDate);
    visibleStartTime.setHours(visibleStartTime.getHours() + startHour);
    
    const visibleEndTime = new Date(startDate);
    visibleEndTime.setHours(visibleEndTime.getHours() + endHour);
    
    if (visibleStartTime.toDateString() === visibleEndTime.toDateString()) {
      return formatDateHeader(visibleStartTime);
    } else {
      return `${formatDateHeader(visibleStartTime)} - ${formatDateHeader(visibleEndTime)}`;
    }
  };

  const groupEventsByDate = () => {
    const grouped: { [key: string]: TimelineEventType[] } = {};
    
    events.forEach(event => {
      const dateKey = event.startTime.toDateString();
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
    });
    
    return grouped;
  };

  const formatLastSaved = (): string => {
    if (!lastSaved) return '';
    return lastSaved.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Define the specific jump-to dates
  const jumpToDates = [
    { date: new Date(2025, 7, 27, 9, 0, 0), label: 'Weds 27' }, // August 27, 9 AM
    { date: new Date(2025, 7, 28, 9, 0, 0), label: 'Thurs 28' }, // August 28, 9 AM
    { date: new Date(2025, 7, 29, 9, 0, 0), label: 'Fri 29' }, // August 29, 9 AM
    { date: new Date(2025, 7, 30, 9, 0, 0), label: 'Sat 30' }, // August 30, 9 AM
    { date: new Date(2025, 7, 31, 9, 0, 0), label: 'Sun 31' }, // August 31, 9 AM
    { date: new Date(2025, 8, 1, 9, 0, 0), label: 'Mon 1' },   // September 1, 9 AM
    { date: new Date(2025, 8, 2, 9, 0, 0), label: 'Sep 2' }    // September 2, 9 AM
  ];

  if (eventsLoading || locationsLoading) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your timeline...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Timeline</h1>
            <p className="text-sm text-gray-600 mt-1">
              August 27 - September 2, 2025 • {getCurrentDateRange()}
              {(dragState.isDragging || dragState.isResizing) && (
                <span className="ml-2 text-blue-600 font-medium">
                  {dragState.isDragging ? '🔄 Moving event...' : '↔️ Resizing event...'}
                </span>
              )}
              {lastSaved && (
                <span className="ml-2 text-green-600 text-xs">
                  <Save size={12} className="inline mr-1" />
                  Saved at {formatLastSaved()}
                </span>
              )}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                onClick={() => scrollTimeline('left')}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                title="Scroll left"
                disabled={dragState.isDragging || dragState.isResizing}
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => scrollTimeline('right')}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                title="Scroll right"
                disabled={dragState.isDragging || dragState.isResizing}
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Jump to specific dates */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">Jump to:</span>
              {jumpToDates.map(({ date, label }) => (
                <button
                  key={label}
                  onClick={() => scrollToDate(date)}
                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                  title={`Go to ${date.toLocaleDateString()}`}
                  disabled={dragState.isDragging || dragState.isResizing}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsDragonConImporterOpen(true)}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={dragState.isDragging || dragState.isResizing}
              title="Import Dragon Con schedule"
            >
              <Sparkles size={16} />
              Dragon Con
            </button>

            <EventManagementMenu
              onExport={exportEvents}
              onImport={handleImportEvents}
              onClearAll={handleClearAllEvents}
              eventCount={events.length}
            />      
            
            <button
              onClick={() => {
                setClickedTime(new Date());
                setEditingEvent(undefined);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={dragState.isDragging || dragState.isResizing}
            >
              <Plus size={16} />
              Add Event
            </button>
          </div>
        </div>
      </div>

      {/* Timeline Container */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Single scrollable container with headers and events */}
        <div className="flex-1 flex overflow-hidden">
          {/* Time Labels */}
          <div className="w-20 flex-shrink-0 bg-gray-50 border-r">
            <div className="h-full flex flex-col">
              {/* Header space - matches the header height exactly */}
              <div className="h-12 border-b border-gray-200 bg-gray-50"></div>
              {/* Slot labels - now 10 slots with precise alignment */}
              {Array.from({ length: 10 }, (_, i) => (
                <div 
                  key={i}
                  className="border-b border-gray-200 flex items-center justify-center text-xs text-gray-500 font-medium"
                  style={{ height: '64px' }}
                >
                  Slot {i + 1}
                </div>
              ))}
            </div>
          </div>

          {/* Single Timeline Content with Headers and Events */}
          <div className="flex-1 relative overflow-hidden">
            <div 
              ref={timelineContentRef}
              className="h-full overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
              onScroll={handleScroll}
            >
              <div 
                className="relative bg-white"
                style={{ 
                  width: `${totalTimelineWidth}px`,
                  height: '100%'
                }}
              >
                {/* Headers - Fixed at top */}
                <div className="absolute top-0 left-0 right-0 h-12 bg-white border-b z-20">
                  {timeSlots.map((slot, index) => {
                    const isNewDay = index === 0 || slot.getDate() !== timeSlots[index - 1].getDate();
                    const leftPosition = getTimePosition(slot, startDate);
                    
                    return (
                      <div 
                        key={slot.getTime()} 
                        className="absolute top-0"
                        style={{ 
                          left: `${leftPosition}px`,
                          width: '240px',
                          height: '48px'
                        }}
                      >
                        {isNewDay && (
                          <div className="absolute top-0 left-0 right-0 bg-blue-50 border-b border-blue-200 px-2 py-1 text-xs font-semibold text-blue-800 z-10">
                            {formatDateHeader(slot)}
                          </div>
                        )}
                        <div 
                          className={`h-full border-r border-gray-200 flex items-end justify-center pb-2 text-xs font-medium text-gray-600 ${
                            isNewDay ? 'pt-6' : 'pt-2'
                          }`}
                        >
                          {formatTimeSlot(slot)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Grid and Events Area - Updated height for 10 slots with proper alignment */}
                <div className="absolute top-12 left-0 right-0" style={{ height: '640px' }}>
                  {/* Grid Lines */}
                  {timeSlots.map((slot) => {
                    const leftPosition = getTimePosition(slot, startDate);
                    
                    return (
                      <div
                        key={slot.getTime()}
                        className={`absolute top-0 bottom-0 border-r border-gray-100 transition-colors group ${
                          dragState.isDragging || dragState.isResizing 
                            ? 'cursor-not-allowed' 
                            : 'hover:bg-blue-50 cursor-pointer'
                        }`}
                        style={{ 
                          left: `${leftPosition}px`,
                          width: '240px'
                        }}
                        onClick={() => handleTimeSlotClick(slot)}
                      >
                        {!dragState.isDragging && !dragState.isResizing && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Plus size={16} className="text-blue-600" />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Horizontal Grid Lines - FIXED: positioned to align perfectly with slot labels */}
                  {Array.from({ length: 9 }, (_, i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 border-b border-gray-100"
                      style={{ top: `${(i + 1) * 64}px` }}
                    />
                  ))}

                  {/* Events - positioned with proper alignment */}
                  {events.map(event => (
                    <TimelineEvent
                      key={event.id}
                      event={event}
                      startDate={startDate}
                      onEdit={handleEventEdit}
                      onDragStart={startDrag}
                      isDragging={dragState.isDragging && dragState.originalEvent?.id === event.id}
                      isResizing={dragState.isResizing && dragState.originalEvent?.id === event.id}
                    />
                  ))}

                  {/* Current Time Indicator */}
                  {(() => {
                    const now = new Date();
                    if (now >= startDate && now <= endDate) {
                      const leftPosition = getTimePosition(now, startDate);
                      
                      return (
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 pointer-events-none"
                          style={{ left: `${leftPosition}px` }}
                        >
                          <div className="absolute -top-2 -left-2 w-4 h-4 bg-red-500 rounded-full"></div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Event Modal */}
      <EventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleEventSave}
        onDelete={handleEventDelete}
        event={editingEvent}
        initialStartTime={clickedTime}
        locations={locations}
        onManageLocations={() => setIsLocationManagerOpen(true)}
      />

      {/* Location Manager Modal */}
      <LocationManager
        isOpen={isLocationManagerOpen}
        onClose={() => setIsLocationManagerOpen(false)}
        locations={locations}
        onAddLocation={addLocation}
        onUpdateLocation={updateLocation}
        onDeleteLocation={deleteLocation}
      />

      {/* Dragon Con Importer Modal */}
      <DragonConImporter
        isOpen={isDragonConImporterOpen}
        onClose={() => setIsDragonConImporterOpen(false)}
        existingEvents={events}
        onAddEvent={handleDragonConEventAdd}
      />

      {/* Event Summary */}
      {events.length > 0 && (
        <div className="bg-white border-t px-6 py-3">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>{events.length} event{events.length !== 1 ? 's' : ''} scheduled</span>
            <div className="flex items-center gap-4">
              {Object.entries(groupEventsByDate()).map(([date, dateEvents]) => (
                <span key={date} className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: {dateEvents.length}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
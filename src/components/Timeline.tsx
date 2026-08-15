import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Save } from 'lucide-react';
import type { TimelineEvent as TimelineEventType } from '../types/timeline';
import { TimelineEvent } from './TimelineEvent';
import { EventModal } from './EventModal';
import { EventManagementMenu } from './EventManagementMenu';
import { DragonConImporter } from './DragonConImporter';
import { useDragAndResize } from '../hooks/useDragAndResize';
import { useEventPersistence } from '../hooks/useEventPersistence';
import { useLocationPersistence } from '../hooks/useLocationPersistence';
import { TimelineSelector } from './TimelineSelector';
import { ManageTimelinesModal } from './ManageTimelinesModal';
import { useTimelinePersistence } from '../hooks/useTimelinePersistence';
import { readImportedEvents } from '../hooks/useEventPersistence';
import { PIXELS_PER_HOUR, DEFAULT_START_DATE, DEFAULT_END_DATE } from '../config/timeline';
import { useSupabaseSession } from '../hooks/useSupabaseSession';
import { supabase } from '../lib/supabase';
import { AccountMenu } from './AccountMenu';
import {
  generateTimeSlots,
  formatTimeSlot,
  formatDateHeader,
  findAvailablePosition,
  getTimePosition
} from '../utils/timelineUtils';

export const Timeline: React.FC = () => {
  const { user } = useSupabaseSession();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDragonConImporterOpen, setIsDragonConImporterOpen] = useState(false);
  const [manageEditTimelineId, setManageEditTimelineId] = useState<string | null>(null);
  const [manageEditSection, setManageEditSection] = useState<'timeline' | 'locations'>('timeline');
  const [manageMode, setManageMode] = useState<'manage' | 'edit' | null>(null);
  const [isDraggingOverDeleteTarget, setIsDraggingOverDeleteTarget] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEventType | undefined>();
  const [clickedTime, setClickedTime] = useState<Date | undefined>();
  const [scrollPosition, setScrollPosition] = useState(0);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const timelineContentRef = useRef<HTMLDivElement>(null);
  const bottomDeleteTargetRef = useRef<HTMLDivElement>(null);

  const isPointInsideBottomDeleteTarget = (clientX: number, clientY: number) => {
    if (!bottomDeleteTargetRef.current) return false;

    const rect = bottomDeleteTargetRef.current.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  };

  // Timeline persistence (must initialize before event persistence so active id is set)
  const {
    timelines,
    activeId,
    isLoading: timelinesLoading,
    createTimeline,
    renameTimeline,
    updateTimelineDates,
    deleteTimeline,
    archiveTimeline,
    unarchiveTimeline,
    setActiveId
  } = useTimelinePersistence();

  const activeTimeline = timelines.find(timeline => timeline.id === activeId);
  const timelineStartDate = activeTimeline?.startDate;
  const timelineEndDate = activeTimeline?.endDate;
  const startDate = new Date(timelineStartDate || DEFAULT_START_DATE);
  const endDate = new Date(timelineEndDate || DEFAULT_END_DATE);
  const timeSlots = generateTimeSlots(startDate, endDate);

  // Calculate total timeline width based on actual time duration
  const totalDurationMs = endDate.getTime() - startDate.getTime();
  const totalDurationHours = totalDurationMs / (1000 * 60 * 60);
  const totalTimelineWidth = Math.round(totalDurationHours * PIXELS_PER_HOUR); // px per hour
  const slotCount = 11;
  const deleteSlotIndex = 10;
  const gridSlotHeight = 64;

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
  } = useEventPersistence(activeId);

  const [isManageOpen, setIsManageOpen] = useState(false);

  // Location persistence
  const {
    locations,
    isLoading: locationsLoading,
    addLocation,
    updateLocation,
    deleteLocation,
    mergeLocations,
    exportLocations,
    importLocations
  } = useLocationPersistence(activeId);

  const buildTimelineSpan = (eventsToInspect: TimelineEventType[]) => {
    const datedEvents = eventsToInspect.filter(event => event.startTime && event.endTime);

    if (datedEvents.length === 0) {
      const fallbackStart = new Date(DEFAULT_START_DATE);
      const fallbackEnd = new Date(DEFAULT_END_DATE);
      return { startDate: fallbackStart, endDate: fallbackEnd };
    }

    const earliest = new Date(Math.min(...datedEvents.map(event => event.startTime.getTime())));
    const latest = new Date(Math.max(...datedEvents.map(event => event.endTime.getTime())));

    const startDate = new Date(earliest);
    startDate.setHours(1, 0, 0, 0);

    const endDate = new Date(latest);
    endDate.setHours(23, 0, 0, 0);

    return { startDate, endDate };
  };

  const formatTimelineName = (startDate: Date, endDate: Date) => {
    const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
    const startDay = startDate.getDate();
    const endDay = endDate.getDate();
    const year = endDate.getFullYear();

    if (startDate.getFullYear() === endDate.getFullYear() && startMonth === endMonth) {
      return `${startMonth} ${startDay} - ${endDay}, ${year}`;
    }

    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
  };

  const getLocationSuggestions = () => {
    const usage = new Map<string, { name: string; count: number; lastUsed: number }>();

    events.forEach((event, index) => {
      const name = event.location?.trim();
      if (!name) return;

      const key = name.toLowerCase();
      const timestamp = new Date(event.updatedAt || event.createdAt || index).getTime();
      const existing = usage.get(key);

      if (existing) {
        existing.count += 1;
        existing.lastUsed = Math.max(existing.lastUsed, timestamp);
        existing.name = name;
      } else {
        usage.set(key, { name, count: 1, lastUsed: timestamp });
      }
    });

    const sortedByRecentUse = [...usage.values()]
      .sort((a, b) => b.lastUsed - a.lastUsed)
      .map(item => item.name);

    const recentLocations = sortedByRecentUse.slice(0, 3);
    const recentKeys = new Set(recentLocations.map(name => name.toLowerCase()));

    const popularLocations = [...usage.values()]
      .filter(item => !recentKeys.has(item.name.toLowerCase()))
      .sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed)
      .slice(0, 3)
      .map(item => item.name);

    return { recentLocations, popularLocations };
  };

  const { recentLocations, popularLocations } = getLocationSuggestions();

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
    startDate,
    endDate
  );

  // Track scroll position for navigation
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollPosition(e.currentTarget.scrollLeft);
  }, []);

  const handleWheelScroll = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (!timelineContentRef.current) return;

    const delta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
    if (delta === 0) return;

    event.preventDefault();
    timelineContentRef.current.scrollLeft += delta;
    setScrollPosition(timelineContentRef.current.scrollLeft);
  }, []);

  // Center the current date whenever the active timeline's calendar span changes.
  useEffect(() => {
    if (!eventsLoading && !locationsLoading && timelineContentRef.current) {
      const now = new Date();
      if (now >= startDate && now <= endDate) {
        const hoursFromStart = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60);
        const scrollLeft = hoursFromStart * PIXELS_PER_HOUR - 400;
        const finalScrollLeft = Math.max(0, scrollLeft);

        timelineContentRef.current.scrollLeft = finalScrollLeft;
        setScrollPosition(finalScrollLeft);
      }
    }
  }, [timelineStartDate, timelineEndDate, eventsLoading, locationsLoading]);

  // Global mouse event handlers for drag and resize
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (dragState.isDragging || dragState.isResizing) {
        e.preventDefault();
        handleMouseMove(e.clientX, e.clientY);

        if (dragState.isDragging) {
          setIsDraggingOverDeleteTarget(isPointInsideBottomDeleteTarget(e.clientX, e.clientY));
        }
      }
    };

    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (dragState.isDragging || dragState.isResizing) {
        e.preventDefault();

        if (dragState.isDragging && dragState.originalEvent && isPointInsideBottomDeleteTarget(e.clientX, e.clientY)) {
          const confirmed = window.confirm(`Delete event "${dragState.originalEvent.title}"?`);
          if (confirmed) {
            deleteEvent(dragState.originalEvent.id);
            setLastSaved(new Date());
          }
        }

        setIsDraggingOverDeleteTarget(false);
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
        id: typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : Date.now().toString(),
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
    const importedEvents = await readImportedEvents(file);
    if (importedEvents.length === 0) {
      alert('No valid events were found in that file.');
      return;
    }

    const { startDate: inferredStartDate, endDate: inferredEndDate } = buildTimelineSpan(importedEvents);
    const suggestedName = formatTimelineName(inferredStartDate, inferredEndDate);
    const importedTimelineName = window.prompt('Name for the imported timeline:', suggestedName)?.trim();

    if (!importedTimelineName) return;

    const createdTimeline = await createTimeline(
      importedTimelineName,
      inferredStartDate.toISOString(),
      inferredEndDate.toISOString()
    );

    setActiveId(createdTimeline.id);

    await importEvents(file, { timelineId: createdTimeline.id, replace: true });

    const importedLocationNames = importedEvents
      .map((event: TimelineEventType) => event.location?.trim())
      .filter((location: string | undefined): location is string => Boolean(location));

    if (importedLocationNames.length > 0) {
      mergeLocations(importedLocationNames);
    }

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

  // Function to scroll to a specific date
  const scrollToDate = (targetDate: Date) => {
    if (timelineContentRef.current) {
      const eventPosition = getTimePosition(targetDate, startDate);
      const viewportWidth = timelineContentRef.current.clientWidth;
      const scrollLeft = eventPosition - viewportWidth / 2; // Center the date
      const maxScroll = totalTimelineWidth - viewportWidth;
      const finalScrollLeft = Math.max(0, Math.min(scrollLeft, maxScroll));

      timelineContentRef.current.scrollTo({
        left: finalScrollLeft,
        behavior: 'smooth'
      });

      setScrollPosition(finalScrollLeft);
    }
  };

  // (removed unused scrollToEvent helper)

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

  const formatLastSaved = (): string => {
    if (!lastSaved) return '';
    return lastSaved.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const commitHash = import.meta.env.VITE_COMMIT_HASH || '';
  const shortCommitHash = commitHash ? commitHash.slice(0, 7) : 'unknown';

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    window.history.replaceState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const jumpToDates = [];
  const jumpDate = new Date(startDate);
  jumpDate.setHours(9, 0, 0, 0);
  const lastJumpDate = new Date(endDate);
  lastJumpDate.setHours(9, 0, 0, 0);
  while (jumpDate <= lastJumpDate) {
    jumpToDates.push({
      date: new Date(jumpDate),
      label: jumpDate.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
    });
    jumpDate.setDate(jumpDate.getDate() + 1);
  }

  if (timelinesLoading || eventsLoading || locationsLoading) {
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
      <div
        className="hidden shadow-sm border-b px-6 py-4 bg-white md:block"
      >
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-4">
          <div className="min-w-0">
            <div className="flex flex-col items-start">
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">Con Timeline</h1>
              <div className="mt-1 flex items-center gap-2 text-xs font-mono text-gray-500">
                <span>{shortCommitHash}</span>
                {lastSaved && (
                  <span className="inline-flex items-center gap-1 text-green-600">
                    <Save size={12} />
                    Saved at {formatLastSaved()}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-col items-center justify-center pt-1 gap-2 justify-self-center">
            <span className="text-[12pt] font-medium text-gray-700 text-center">{getCurrentDateRange()}</span>
            <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                {jumpToDates.map(({ date, label }) => (
                  <button
                    key={date.toISOString()}
                    onClick={() => scrollToDate(date)}
                    className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
                    title={`Go to ${date.toLocaleDateString()}`}
                    disabled={dragState.isDragging || dragState.isResizing}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <TimelineSelector
              timelines={timelines}
              activeId={activeId}
              setActiveId={setActiveId}
              onCreate={createTimeline}
              onEditCurrent={() => {
                if (!activeId) return;
                setManageEditTimelineId(activeId);
                setManageEditSection('timeline');
                setManageMode('edit');
                setIsManageOpen(true);
              }}
              onManage={() => {
                setManageEditTimelineId(null);
                setManageMode('manage');
                setIsManageOpen(true);
              }}
            />

            <button
              onClick={() => {
                setClickedTime(new Date());
                setEditingEvent(undefined);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 whitespace-nowrap bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={dragState.isDragging || dragState.isResizing}
              title="Create new event"
            >
              <Plus size={16} />
              New Event
            </button>

            <EventManagementMenu
              onExport={exportEvents}
              onImport={handleImportEvents}
              onClearAll={handleClearAllEvents}
              onDragonCon={() => setIsDragonConImporterOpen(true)}
              eventCount={events.length}
            />

            {user && (
              <div className="ml-auto">
                <AccountMenu user={user} onSignOut={handleSignOut} />
              </div>
            )}
          </div>

        </div>
      </div>

      <div className="border-b bg-white px-3 py-3 md:hidden">
        <div className="flex w-full flex-wrap items-center justify-center gap-2 overflow-visible">
          <TimelineSelector
            timelines={timelines}
            activeId={activeId}
            setActiveId={setActiveId}
            onCreate={createTimeline}
            onEditCurrent={() => {
              if (!activeId) return;
              setManageEditTimelineId(activeId);
              setManageEditSection('timeline');
              setManageMode('edit');
              setIsManageOpen(true);
            }}
            onManage={() => {
              setManageEditTimelineId(null);
              setManageMode('manage');
              setIsManageOpen(true);
            }}
          />

          <EventManagementMenu
            onExport={exportEvents}
            onImport={handleImportEvents}
            onClearAll={handleClearAllEvents}
            onDragonCon={() => setIsDragonConImporterOpen(true)}
            eventCount={events.length}
          />

          {user && <AccountMenu user={user} onSignOut={handleSignOut} />}
        </div>

        <div className="mt-2 flex min-w-0 flex-col items-center justify-center gap-1">
          <span className="text-sm font-medium text-gray-700 text-center">{getCurrentDateRange()}</span>
          <div className="flex max-w-full flex-wrap items-center justify-center gap-2 text-xs text-gray-600">
            <div className="flex max-w-full flex-wrap items-center justify-center gap-1">
              {jumpToDates.map(({ date, label }) => (
                <button
                  key={date.toISOString()}
                  onClick={() => scrollToDate(date)}
                  className="rounded-md bg-gray-200 px-2 py-1 transition-colors hover:bg-gray-300"
                  title={`Go to ${date.toLocaleDateString()}`}
                  disabled={dragState.isDragging || dragState.isResizing}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ManageTimelinesModal
        isOpen={isManageOpen}
        onClose={() => {
          setIsManageOpen(false);
          setManageMode(null);
          setManageEditTimelineId(null);
        }}
        mode={manageMode === 'edit' ? 'edit' : 'manage'}
        timelines={timelines}
        activeId={activeId}
        setActiveId={setActiveId}
        renameTimeline={renameTimeline}
        updateTimelineDates={updateTimelineDates}
        locations={locations}
        onAddLocation={addLocation}
        onUpdateLocation={updateLocation}
        onDeleteLocation={deleteLocation}
        onExportLocations={exportLocations}
        onImportLocations={importLocations}
        deleteTimeline={deleteTimeline}
        archiveTimeline={archiveTimeline}
        unarchiveTimeline={unarchiveTimeline}
        initialEditingTimelineId={manageMode === 'edit' ? manageEditTimelineId : null}
        initialSection={manageEditSection}
      />

      {/* Timeline Container */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Single scrollable container with headers and events */}
        <div className="flex-1 flex overflow-hidden">
          {/* Time Labels */}
          <div className="w-20 flex-shrink-0 bg-gray-50 border-r">
            <div className="h-full flex flex-col">
              {/* Header space - matches the header height exactly */}
              <div className="h-12 border-b border-gray-200 bg-gray-50 md:bg-gray-50">
                <button
                  type="button"
                  onClick={() => {
                    setClickedTime(new Date());
                    setEditingEvent(undefined);
                    setIsModalOpen(true);
                  }}
                  className="flex h-full w-full items-center justify-center bg-blue-50 px-2 text-[11px] font-medium text-blue-700 transition-colors hover:bg-blue-100 md:hidden"
                  disabled={dragState.isDragging || dragState.isResizing}
                  title="Create new event"
                >
                  New
                </button>
              </div>
              {/* Slot labels - 10 event slots plus 1 delete slot */}
              {Array.from({ length: slotCount }, (_, i) => (
                <div
                  key={i}
                  className={`border-b border-gray-200 flex items-center justify-center text-xs font-medium ${
                    i === deleteSlotIndex ? 'bg-red-50 text-red-600' : 'text-gray-500'
                  }`}
                  style={{ height: `${gridSlotHeight}px` }}
                >
                  {i === deleteSlotIndex ? 'Delete' : (
                    <>
                      <span className="md:hidden">{i + 1}</span>
                      <span className="hidden md:inline">Slot {i + 1}</span>
                    </>
                  )}
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
              onWheel={handleWheelScroll}
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

                {/* Grid and Events Area - 10 event slots plus 1 delete slot */}
                <div className="absolute top-12 left-0 right-0" style={{ height: `${slotCount * gridSlotHeight}px` }}>
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

                  {/* Horizontal Grid Lines - positioned to align perfectly with slot labels */}
                  {Array.from({ length: slotCount - 1 }, (_, i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 border-b border-gray-100"
                      style={{ top: `${(i + 1) * gridSlotHeight}px` }}
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

                  {/* Delete Slot - visible 11th lane */}
                  <div
                    ref={bottomDeleteTargetRef}
                    className={`absolute left-0 right-0 z-0 border-t border-red-200 flex items-center justify-center text-sm font-medium transition-colors ${
                      isDraggingOverDeleteTarget ? 'bg-red-200 text-red-800' : 'bg-red-50 text-red-600'
                    }`}
                    style={{ top: `${deleteSlotIndex * gridSlotHeight}px`, height: `${gridSlotHeight}px` }}
                  >
                    {isDraggingOverDeleteTarget ? 'Drop here to delete' : 'Delete'}
                  </div>
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
        onAddLocation={addLocation}
        recentLocations={recentLocations}
        popularLocations={popularLocations}
      />

      {/* Dragon Con Importer Modal */}
      <DragonConImporter
        isOpen={isDragonConImporterOpen}
        onClose={() => setIsDragonConImporterOpen(false)}
        existingEvents={events}
        onAddEvent={handleDragonConEventAdd}
      />
    </div>
  );
};

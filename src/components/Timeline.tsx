import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { CalendarDays, Minus, Palette, Plus, RotateCcw, Save } from 'lucide-react';
import type { CosplayEntry, TimelineEvent as TimelineEventType } from '../types/timeline';
import { TimelineEvent } from './TimelineEvent';
import { DayColumnsView } from './DayColumnsView';
import { EventModal } from './EventModal';
import { CosplayEntryModal } from './CosplayEntryModal';
import { EventManagementMenu } from './EventManagementMenu';
import { DragonConImporter } from './DragonConImporter';
import { useDragAndResize } from '../hooks/useDragAndResize';
import { useEventPersistence } from '../hooks/useEventPersistence';
import { useLocationPersistence } from '../hooks/useLocationPersistence';
import { TimelineSelector } from './TimelineSelector';
import { ManageTimelinesModal } from './ManageTimelinesModal';
import { useTimelinePersistence } from '../hooks/useTimelinePersistence';
import { readImportedEvents } from '../hooks/useEventPersistence';
import { useCosplayEntryPersistence } from '../hooks/useCosplayEntryPersistence';
import { PIXELS_PER_HOUR, PIXELS_PER_SLOT, DEFAULT_START_DATE, DEFAULT_END_DATE } from '../config/timeline';
import { useSupabaseSession } from '../hooks/useSupabaseSession';
import { supabase } from '../lib/supabase';
import { AccountMenu } from './AccountMenu';
import {
  generateTimeSlots,
  formatTimeSlot,
  formatDateHeader,
  findAvailablePosition,
  cascadeEventPositions,
  repackEventPositions,
  getIntangibleVisibleSegments,
  getDayKey,
  getTimePosition,
  getEventColors,
  getLocationDisplayColor
} from '../utils/timelineUtils';

const DAY_COLUMN_WIDTH_STEP = 0.25;
const DEFAULT_SELECTED_COLOR = '#10B981';

const normalizeColor = (color: string) => color.trim().toLowerCase();

const isSameDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const getDaysInSpan = (start: Date, end: Date) => {
  const days: Date[] = [];
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);

  const last = new Date(end);
  last.setHours(0, 0, 0, 0);

  while (current <= last) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return days;
};

export const Timeline: React.FC = () => {
  const { user } = useSupabaseSession();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDragonConImporterOpen, setIsDragonConImporterOpen] = useState(false);
  const [manageEditTimelineId, setManageEditTimelineId] = useState<string | null>(null);
  const [manageEditSection, setManageEditSection] = useState<'timeline' | 'locations'>('timeline');
  const [manageMode, setManageMode] = useState<'manage' | 'edit' | null>(null);
  const [editingEvent, setEditingEvent] = useState<TimelineEventType | undefined>();
  const [clickedTime, setClickedTime] = useState<Date | undefined>();
  const [scrollPosition, setScrollPosition] = useState(0);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'day-columns'>('timeline');
  const [selectedColor, setSelectedColor] = useState(DEFAULT_SELECTED_COLOR);
  const [dayColumnScale, setDayColumnScale] = useState(1);
  const [timelineViewportWidth, setTimelineViewportWidth] = useState(0);
  const [timelineViewportHeight, setTimelineViewportHeight] = useState(0);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isCosplayModalOpen, setIsCosplayModalOpen] = useState(false);
  const [editingCosplayEntry, setEditingCosplayEntry] = useState<CosplayEntry | null>(null);
  const [clickedCosplayDayKey, setClickedCosplayDayKey] = useState<string | null>(null);
  const [useLocationColors, setUseLocationColors] = useState(false);

  const timelineContentRef = useRef<HTMLDivElement>(null);
  const initialScrollTimelineIdRef = useRef<string | null>(null);
  const initialScrollFrameRef = useRef<number | null>(null);

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
  const slotCount = activeTimeline?.slotCount ?? 11;
  const startDate = new Date(timelineStartDate || DEFAULT_START_DATE);
  const endDate = new Date(timelineEndDate || DEFAULT_END_DATE);
  const timeSlots = generateTimeSlots(startDate, endDate);

  // Calculate total timeline width based on actual time duration
  const totalDurationMs = endDate.getTime() - startDate.getTime();
  const totalDurationHours = totalDurationMs / (1000 * 60 * 60);
  const totalTimelineWidth = Math.round(totalDurationHours * PIXELS_PER_HOUR); // px per hour
  const dayColumns = getDaysInSpan(startDate, endDate);
  const viewportWidth = timelineViewportWidth > 0
    ? timelineViewportWidth
    : (typeof window !== 'undefined' ? window.innerWidth : 0);
  const isMobileViewport = typeof window !== 'undefined'
    ? window.innerWidth < 768
    : viewportWidth > 0 && viewportWidth < 768;
  const fittedDayColumnWidth = dayColumns.length > 0
    ? viewportWidth / dayColumns.length
    : viewportWidth;
  const dayColumnWidth = isMobileViewport
    ? Math.max(typeof window !== 'undefined' ? window.innerWidth : viewportWidth, 1)
    : Math.max(fittedDayColumnWidth, 1) * dayColumnScale;
  const colorOptions = getEventColors();
  const timelineHeaderHeight = 48;
  const timelineChromeHeight = 12;
  const gridSlotHeight = isMobileViewport && timelineViewportHeight > 0
    ? Math.max(40, Math.floor((timelineViewportHeight - timelineHeaderHeight - timelineChromeHeight) / slotCount))
    : PIXELS_PER_SLOT;

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

  const {
    entries: cosplayEntries,
    isLoading: cosplayEntriesLoading,
    addEntry: addCosplayEntry,
    updateEntry: updateCosplayEntry,
    deleteEntry: deleteCosplayEntry,
    moveEntry: moveCosplayEntry
  } = useCosplayEntryPersistence(activeId, dayColumns);

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

  // Handle event updates for drag, resize, modal edits, and context-menu toggles
  const handleEventUpdate = (eventId: string, updates: Partial<TimelineEventType>) => {
    const existingEvent = events.find(event => event.id === eventId);

    if (!existingEvent) {
      return;
    }

    const nextEvent = { ...existingEvent, ...updates };
    const hasExplicitPosition = typeof updates.position === 'number';

    if (existingEvent.intangible !== nextEvent.intangible) {
      const repackUpdates = repackEventPositions(events, eventId, updates, slotCount);
      const positionForEditedEvent = repackUpdates.find(update => update.eventId === eventId)?.updates.position ?? existingEvent.position;

      batchUpdateEvents([
        {
          eventId,
          updates: {
            ...updates,
            position: positionForEditedEvent
          }
        },
        ...repackUpdates.filter(update => update.eventId !== eventId)
      ]);
    } else if (hasExplicitPosition) {
      updateEvent(eventId, updates);

      const cascadeUpdates = cascadeEventPositions(events, existingEvent, updates, slotCount);
      if (cascadeUpdates.length > 0) {
        batchUpdateEvents(cascadeUpdates);
      }
    } else {
      const position = findAvailablePosition(
        events.filter(event => event.id !== eventId),
        nextEvent.startTime,
        nextEvent.endTime,
        nextEvent,
        slotCount
      );

      updateEvent(eventId, { ...updates, position });
    }

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
    endDate,
    gridSlotHeight,
    slotCount
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

  useEffect(() => {
    const element = timelineContentRef.current;
    if (!element) return;

    const updateWidth = () => {
      const measuredWidth = element.getBoundingClientRect().width;
      const measuredHeight = element.getBoundingClientRect().height;
      setTimelineViewportWidth(Math.max(measuredWidth, window.innerWidth));
      setTimelineViewportHeight(Math.max(measuredHeight, 1));
    };

    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => {
        window.removeEventListener('resize', updateWidth);
      };
    }

    const observer = new ResizeObserver(() => {
      updateWidth();
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  const handleToggleViewMode = () => {
    const nextMode = viewMode === 'timeline' ? 'day-columns' : 'timeline';
    setViewMode(nextMode);

    if (timelineContentRef.current) {
      timelineContentRef.current.scrollLeft = 0;
    }
    setScrollPosition(0);

    if (nextMode === 'day-columns') {
      setDayColumnScale(1);
    }
  };

  const handleDayColumnScaleChange = (delta: number) => {
    setDayColumnScale(prev => Math.max(1, Math.round((prev + delta) * 100) / 100));
  };

  const handleResetDayColumnWidth = () => {
    setDayColumnScale(1);
    setScrollPosition(0);

    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
    setTimelineViewportWidth(viewportWidth);

    if (timelineContentRef.current) {
      timelineContentRef.current.scrollLeft = 0;
    }
  };

  const colorChoices = colorOptions.map(color => ({
    value: color,
    label: {
      '#3b82f6': 'Blue',
      '#ef4444': 'Red',
      '#10b981': 'Green',
      '#f59e0b': 'Yellow',
      '#8b5cf6': 'Purple',
      '#f97316': 'Orange',
      '#06b6d4': 'Cyan',
      '#84cc16': 'Lime',
      '#6b7280': 'Gray'
    }[normalizeColor(color)] ?? color
  }));

  const spanViewControls = (
    <div className="flex flex-wrap items-center gap-1">
      {viewMode === 'day-columns' && (
        <>
          <div className="hidden items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 md:flex">
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsColorPickerOpen(prev => !prev)}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-300 bg-white px-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-100"
                title="Change color"
              >
                <Palette size={14} className="text-gray-500" />
                <span
                  className="h-3 w-3 rounded-full border border-gray-300"
                  style={{ backgroundColor: selectedColor }}
                  aria-hidden="true"
                />
              </button>

              {isColorPickerOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsColorPickerOpen(false)} />
                  <div className="absolute left-0 top-full z-40 mt-2 grid w-max grid-cols-3 gap-3 rounded-md border border-gray-200 bg-white p-3 shadow-lg">
                    {colorChoices.map(color => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => {
                          setSelectedColor(color.value);
                          setIsColorPickerOpen(false);
                        }}
                        className={`h-8 w-8 rounded-md border ${selectedColor === color.value ? 'border-gray-900 ring-2 ring-gray-300' : 'border-gray-200'} hover:scale-105`}
                        style={{ backgroundColor: color.value }}
                        title={color.label}
                        aria-label={color.label}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="hidden items-center gap-1 md:flex">
              <button
                type="button"
                onClick={() => handleDayColumnScaleChange(-DAY_COLUMN_WIDTH_STEP)}
                disabled={dayColumnScale <= 1}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                title="Decrease column width"
              >
                <Minus size={16} />
              </button>
              <button
                type="button"
                onClick={() => handleDayColumnScaleChange(DAY_COLUMN_WIDTH_STEP)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                title="Increase column width"
              >
                <Plus size={16} />
              </button>
              <button
                type="button"
                onClick={handleResetDayColumnWidth}
                className="inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                title="Reset columns to fit the screen"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>

        </>
      )}
    </div>
  );

  // Set the initial horizontal position from the first event, or the first hour if there are no events.
  useLayoutEffect(() => {
    if (viewMode !== 'timeline') return;

    if (initialScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(initialScrollFrameRef.current);
      initialScrollFrameRef.current = null;
    }

    if (!eventsLoading && !locationsLoading && timelineContentRef.current) {
      const timelineId = activeTimeline?.id ?? null;
      if (initialScrollTimelineIdRef.current === timelineId) return;

      const firstEvent = [...events].sort((left, right) => left.startTime.getTime() - right.startTime.getTime())[0];
      const targetTime = firstEvent?.startTime ?? startDate;
      const scrollLeft = Math.max(0, getTimePosition(targetTime, startDate));

      initialScrollFrameRef.current = window.requestAnimationFrame(() => {
        initialScrollFrameRef.current = window.requestAnimationFrame(() => {
          if (!timelineContentRef.current) return;

          timelineContentRef.current.scrollLeft = scrollLeft;
          setScrollPosition(scrollLeft);
          initialScrollTimelineIdRef.current = timelineId;
          initialScrollFrameRef.current = null;
        });
      });
    }

    return () => {
      if (initialScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(initialScrollFrameRef.current);
        initialScrollFrameRef.current = null;
      }
    };
  }, [activeTimeline?.id, events, eventsLoading, locationsLoading, viewMode, startDate]);

  // Global pointer event handlers for drag and resize
  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (dragState.isDragging || dragState.isResizing) {
        e.preventDefault();
        handleMouseMove(e.clientX, e.clientY);
      }
    };

    const handleGlobalPointerUp = (e: PointerEvent) => {
      if (dragState.isDragging || dragState.isResizing) {
        e.preventDefault();
        endDrag();
      }
    };

    if (dragState.isDragging || dragState.isResizing) {
      document.addEventListener('pointermove', handleGlobalPointerMove);
      document.addEventListener('pointerup', handleGlobalPointerUp);
      document.addEventListener('pointercancel', handleGlobalPointerUp);
      document.body.style.cursor = dragState.isDragging ? 'grabbing' : 'ew-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('pointermove', handleGlobalPointerMove);
      document.removeEventListener('pointerup', handleGlobalPointerUp);
      document.removeEventListener('pointercancel', handleGlobalPointerUp);
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
      handleEventUpdate(editingEvent.id, eventData);
    } else {
      // Create new event
      const position = findAvailablePosition(events, eventData.startTime, eventData.endTime, eventData as TimelineEventType, slotCount);
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

  const handleCosplayEntryCreate = (day: Date) => {
    setEditingCosplayEntry(null);
    setClickedCosplayDayKey(getDayKey(day));
    setIsCosplayModalOpen(true);
  };

  const handleCosplayEntryEdit = (entry: CosplayEntry) => {
    setEditingCosplayEntry(entry);
    setClickedCosplayDayKey(entry.dayKey);
    setIsCosplayModalOpen(true);
  };

  const handleCosplayEntrySave = (dayKey: string, title: string, entryId?: string) => {
    if (entryId) {
      updateCosplayEntry(entryId, title, dayKey);
    } else {
      addCosplayEntry(dayKey, title);
    }

    setLastSaved(new Date());
  };

  const handleCosplayEntryDelete = (entryId: string) => {
    deleteCosplayEntry(entryId);
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
      inferredEndDate.toISOString(),
      slotCount
    );

    setActiveId(createdTimeline.id);

    await importEvents(file, { timelineId: createdTimeline.id, replace: true });

    const importedLocationNames = importedEvents
      .map((event: TimelineEventType) => event.location?.trim())
      .filter((location: string | undefined): location is string => Boolean(location));

    if (importedLocationNames.length > 0) {
      await mergeLocations(importedLocationNames, createdTimeline.id);
    }

    setLastSaved(new Date());
    setViewMode('timeline');
    setDayColumnScale(1);
  };

  const handleClearAllEvents = () => {
    clearAllEvents();
    setLastSaved(new Date());
  };

  const handleDragonConEventAdd = (event: TimelineEventType) => {
    addEvent(event);
    setLastSaved(new Date());
  };

  const getDisplayColorForEvent = (event: TimelineEventType) => {
    return useLocationColors ? getLocationDisplayColor(event.location) : event.color;
  };

  const getJumpTargetForDate = (day: Date) => {
    const sameDayEventsBeforeNine = events
      .filter(event => {
        const eventStart = event.startTime;
        return (
          eventStart.getFullYear() === day.getFullYear() &&
          eventStart.getMonth() === day.getMonth() &&
          eventStart.getDate() === day.getDate() &&
          eventStart.getHours() < 9
        );
      })
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    return sameDayEventsBeforeNine[0]?.startTime ?? (() => {
      const fallback = new Date(day);
      fallback.setHours(9, 0, 0, 0);
      return fallback;
    })();
  };

  // Function to scroll to a specific date
  const scrollToDate = (targetDate: Date) => {
    if (timelineContentRef.current) {
      const viewportWidth = timelineContentRef.current.clientWidth;
      const scrollLeft = viewMode === 'day-columns'
        ? Math.max(0, dayColumns.findIndex(day => isSameDay(day, targetDate)) * dayColumnWidth)
        : getTimePosition(targetDate, startDate);
      const contentWidth = viewMode === 'day-columns'
        ? dayColumns.length * dayColumnWidth
        : totalTimelineWidth;
      const maxScroll = Math.max(0, contentWidth - viewportWidth);
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

  const currentRangeLabel = viewMode === 'day-columns'
    ? formatTimelineName(startDate, endDate)
    : getCurrentDateRange();

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
    const day = new Date(jumpDate);
    jumpToDates.push({
      date: getJumpTargetForDate(day),
      label: jumpDate.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
    });
    jumpDate.setDate(jumpDate.getDate() + 1);
  }
  const mobileJumpToDateSplit = Math.floor(jumpToDates.length / 2);
  const mobileJumpToDateRows = [
    jumpToDates.slice(0, mobileJumpToDateSplit),
    jumpToDates.slice(mobileJumpToDateSplit)
  ].filter(row => row.length > 0);

  if (timelinesLoading || eventsLoading || locationsLoading || cosplayEntriesLoading) {
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
            <span className="text-[12pt] font-medium text-gray-700 text-center">{currentRangeLabel}</span>
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

          <div className="flex items-center justify-end gap-1">
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

            {spanViewControls}

            <button
              type="button"
              onClick={handleToggleViewMode}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
              title={viewMode === 'timeline' ? 'Switch to day columns' : 'Return to timeline view'}
            >
              <CalendarDays size={16} className={viewMode === 'timeline' ? 'text-blue-600' : 'text-amber-500'} />
            </button>

            <button
              onClick={() => {
                setClickedTime(new Date());
                setEditingEvent(undefined);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 whitespace-nowrap bg-blue-600 px-3 py-2 rounded-md font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 md:px-4"
              disabled={dragState.isDragging || dragState.isResizing}
              title="Create new event"
            >
              <Plus size={16} />
              <span className="md:hidden">+New</span>
              <span className="hidden md:inline">New</span>
            </button>

            <EventManagementMenu
              onExport={exportEvents}
              onImport={handleImportEvents}
              onClearAll={handleClearAllEvents}
              onDragonCon={() => setIsDragonConImporterOpen(true)}
              eventCount={events.length}
            />

            {user && (
              <div className="ml-auto shrink-0 whitespace-nowrap">
                <AccountMenu user={user} onSignOut={handleSignOut} />
              </div>
            )}
          </div>

        </div>
      </div>

      <div className="border-b bg-white px-3 py-3 md:hidden">
        <div className="flex w-full flex-wrap items-center justify-center gap-1 overflow-visible">
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
            type="button"
            onClick={handleToggleViewMode}
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white p-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
            title={viewMode === 'timeline' ? 'Switch to day columns' : 'Return to timeline view'}
          >
            <CalendarDays size={16} className={viewMode === 'timeline' ? 'text-blue-600' : 'text-amber-500'} />
          </button>

          {spanViewControls}

          <EventManagementMenu
            onExport={exportEvents}
            onImport={handleImportEvents}
            onClearAll={handleClearAllEvents}
            onDragonCon={() => setIsDragonConImporterOpen(true)}
            eventCount={events.length}
          />

          {user && (
            <div className="shrink-0 whitespace-nowrap">
              <AccountMenu user={user} onSignOut={handleSignOut} />
            </div>
          )}
        </div>

        <div className="mt-2 flex min-w-0 flex-col items-center justify-center gap-1">
          <span className="text-sm font-medium text-gray-700 text-center">{currentRangeLabel}</span>
          <div className="flex w-full flex-col items-center gap-1 py-[2mm] text-xs text-gray-600 md:hidden">
            {mobileJumpToDateRows.map((row, rowIndex) => (
              <div key={`${rowIndex}-${row.length}`} className="flex justify-center gap-1">
                {row.map(({ date, label }) => (
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
            ))}
          </div>

          {viewMode === 'day-columns' && (
            <div className="grid w-full grid-cols-9 gap-2 pt-[1mm] md:hidden">
              {colorChoices.map(color => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setSelectedColor(color.value)}
                  className={`aspect-square w-full rounded-md border ${selectedColor === color.value ? 'border-gray-900 ring-2 ring-gray-300' : 'border-gray-200'} transition-transform hover:scale-105`}
                  style={{ backgroundColor: color.value }}
                  title={color.label}
                  aria-label={color.label}
                />
              ))}
            </div>
          )}
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
        useLocationColors={useLocationColors}
        onToggleUseLocationColors={setUseLocationColors}
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
        {viewMode === 'timeline' ? (
          <div className="flex-1 flex overflow-hidden">
            {/* Time Labels */}
            <div className="w-fit flex-shrink-0 bg-gray-50 border-r">
              <div className="h-full flex flex-col">
                <div className="h-12 shrink-0 border-b border-gray-200 bg-gray-50 md:bg-gray-50">
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
                    +New
                  </button>
                </div>
                {Array.from({ length: slotCount }, (_, i) => (
                  <div
                    key={i}
                    className="shrink-0 border-b border-gray-200 flex items-center justify-center px-[2mm] text-xs font-medium text-gray-500"
                    style={{ height: `${gridSlotHeight}px` }}
                  >
                    <>
                      <span className="md:hidden">{i + 1}</span>
                      <span className="hidden md:inline">Slot {i + 1}</span>
                    </>
                  </div>
                ))}
              </div>
            </div>

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

                  <div className="absolute top-12 left-0 right-0" style={{ height: `${slotCount * gridSlotHeight}px` }}>
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
                          onDoubleClick={() => handleTimeSlotClick(slot)}
                          title="Double-click to create new event"
                        >
                          {!dragState.isDragging && !dragState.isResizing && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Plus size={16} className="text-blue-600" />
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {Array.from({ length: slotCount - 1 }, (_, i) => (
                      <div
                        key={i}
                        className="absolute left-0 right-0 border-b border-gray-100"
                        style={{ top: `${(i + 1) * gridSlotHeight}px` }}
                      />
                    ))}

                    {events.map(event => (
                      <TimelineEvent
                        key={event.id}
                        event={event}
                        startDate={startDate}
                        slotHeight={gridSlotHeight}
                        displayColor={useLocationColors ? getDisplayColorForEvent(event) : undefined}
                        onEdit={handleEventEdit}
                        onUpdateEvent={handleEventUpdate}
                        onDeleteEvent={handleEventDelete}
                        onDragStart={startDrag}
                        isDragging={dragState.isDragging && dragState.originalEvent?.id === event.id}
                        isResizing={dragState.isResizing && dragState.originalEvent?.id === event.id}
                      />
                    ))}

                    {events
                      .filter(event => event.intangible)
                      .flatMap(event => {
                        const visibleSegments = getIntangibleVisibleSegments(event, events);

                        return visibleSegments.flatMap((segment) => {
                          const leftPosition = getTimePosition(segment.startTime, startDate);
                          const segmentWidth = Math.max(getTimePosition(segment.endTime, startDate) - leftPosition, 0);

                          if (segmentWidth < 24) {
                            return [];
                          }

                          return (
                            <div
                              key={`${event.id}-${segment.startTime.getTime()}-${segment.endTime.getTime()}`}
                              className="absolute z-20 pointer-events-none flex items-center justify-center px-2 text-[11px] font-semibold"
                              style={{
                                left: `${leftPosition}px`,
                                top: `${event.position * gridSlotHeight + 4}px`,
                                width: `${segmentWidth}px`,
                                height: `${Math.max(gridSlotHeight - 8, 40)}px`,
                                color: `color-mix(in srgb, ${getDisplayColorForEvent(event)} 60%, black)`,
                                opacity: 0.8
                              }}
                            >
                                <span className={`whitespace-normal break-words text-center leading-snug ${event.location?.trim() ? '-translate-y-px' : ''}`}>
                                  {event.title}
                                </span>
                            </div>
                          );
                        });
                      })}

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
        ) : (
          <div className="flex-1 relative overflow-hidden">
            <div
              ref={timelineContentRef}
              className="h-full overflow-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
              onScroll={handleScroll}
              onWheel={handleWheelScroll}
            >
              <DayColumnsView
                days={dayColumns}
                events={events.filter(event => normalizeColor(event.color) === normalizeColor(selectedColor))}
                cosplayEntries={cosplayEntries}
                selectedColor={selectedColor}
                columnWidth={dayColumnWidth}
                onEventEdit={handleEventEdit}
                onCosplayEntryCreate={handleCosplayEntryCreate}
                onCosplayEntryEdit={handleCosplayEntryEdit}
                onCosplayEntryMove={moveCosplayEntry}
              />
            </div>
          </div>
        )}
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

      <CosplayEntryModal
        isOpen={isCosplayModalOpen}
        onClose={() => {
          setIsCosplayModalOpen(false);
          setEditingCosplayEntry(null);
          setClickedCosplayDayKey(null);
        }}
        onSave={handleCosplayEntrySave}
        onDelete={handleCosplayEntryDelete}
        entry={editingCosplayEntry}
        dayKey={clickedCosplayDayKey}
        days={dayColumns}
      />

      {/* Dragon Con Importer Modal */}
      <DragonConImporter
        isOpen={isDragonConImporterOpen}
        onClose={() => setIsDragonConImporterOpen(false)}
        existingEvents={events}
        onAddEvent={handleDragonConEventAdd}
        onUpdateEvent={updateEvent}
        onAddLocations={async (locationNames) => {
          if (locationNames.length === 0) return;
          await mergeLocations(locationNames, activeId || undefined);
        }}
      />
    </div>
  );
};

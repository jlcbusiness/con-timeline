import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { CalendarDays, Minus, Palette, Plus, RotateCcw, Save, Search } from 'lucide-react';
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
import { useFandomPersistence } from '../hooks/useFandomPersistence';
import { TimelineSelector } from './TimelineSelector';
import { ManageTimelinesModal } from './ManageTimelinesModal';
import { useTimelinePersistence } from '../hooks/useTimelinePersistence';
import { readImportedEvents } from '../hooks/useEventPersistence';
import { useCosplayEntryPersistence } from '../hooks/useCosplayEntryPersistence';
import { PIXELS_PER_HOUR, PIXELS_PER_SLOT, DEFAULT_START_DATE, DEFAULT_END_DATE } from '../config/timeline';
import { useSupabaseSession } from '../hooks/useSupabaseSession';
import { supabase } from '../lib/supabase';
import { AccountMenu } from './AccountMenu';
import { EventSearchPane } from './EventSearchPane';
import { getFandomSuggestions, getLocationSuggestions } from '../utils/locationSuggestions';
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
  getLocationDisplayColor,
  eventUpdateAffectsPosition,
  getRequiredStackSlotCount,
  getRenderedSlotCount,
  repackAllEventPositions
} from '../utils/timelineUtils';

const DAY_COLUMN_WIDTH_STEP = 0.25;
const DEFAULT_SELECTED_COLOR = '#57c14e';
const VIEW_MODE_STORAGE_KEY = 'timeline-view-mode';
const LOCATION_COLORS_STORAGE_KEY = 'timeline-use-location-colors';
const NOW_JUMP_LABEL = 'Now';

type ViewMode = 'timeline' | 'priority-columns' | 'daily-columns';

type NowJumpPopupState = {
  message: string;
  closeLabel: string;
} | null;

const normalizeViewMode = (storedViewMode: string | null): ViewMode => {
  if (storedViewMode === 'timeline' || storedViewMode === 'priority-columns' || storedViewMode === 'daily-columns') {
    return storedViewMode;
  }

  if (storedViewMode === 'day-columns') {
    return 'priority-columns';
  }

  if (storedViewMode === 'slot-columns') {
    return 'daily-columns';
  }

  return 'timeline';
};

const getInitialViewMode = (): ViewMode => {
  if (typeof window === 'undefined') {
    return 'timeline';
  }

  return normalizeViewMode(window.localStorage.getItem(VIEW_MODE_STORAGE_KEY));
};

const getInitialUseLocationColors = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(LOCATION_COLORS_STORAGE_KEY) === 'true';
};

const formatJumpAmount = (durationMs: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(durationMs / 1000));
  const totalMinutes = Math.max(0, Math.ceil(durationMs / (60 * 1000)));
  const totalHours = Math.max(0, Math.ceil(durationMs / (60 * 60 * 1000)));
  const totalDays = Math.max(0, Math.ceil(durationMs / (24 * 60 * 60 * 1000)));

  if (totalDays >= 1) {
    return `${totalDays} day${totalDays === 1 ? '' : 's'}`;
  }

  if (totalHours >= 1) {
    return `${totalHours} hour${totalHours === 1 ? '' : 's'}`;
  }

  if (totalMinutes >= 1) {
    return `${totalMinutes} minute${totalMinutes === 1 ? '' : 's'}`;
  }

  return `${Math.max(1, totalSeconds)} second${totalSeconds === 1 ? '' : 's'}`;
};

const getNowJumpPopup = (now: Date, startDate: Date, endDate: Date): NowJumpPopupState => {
  if (now < startDate) {
    return {
      message: `Hold your horses!\n You've still got ${formatJumpAmount(startDate.getTime() - now.getTime())} until this shindig starts!`,
      closeLabel: "I'm waiting, I'm waiting!"
    };
  }

  if (now > endDate) {
    return {
      message: "You're looking at then, sir.\nEverything that happens now is happening now, and then doesn't have now, just then.",
      closeLabel: 'WHO?!'
    };
  }

  return null;
};

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
  const [copiedEvent, setCopiedEvent] = useState<Omit<TimelineEventType, 'id' | 'position'> | undefined>();
  const [clickedTime, setClickedTime] = useState<Date | undefined>();
  const [scrollPosition, setScrollPosition] = useState(0);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode);
  const [selectedColor, setSelectedColor] = useState(DEFAULT_SELECTED_COLOR);
  const [dayColumnScale, setDayColumnScale] = useState(1);
  const [mobileDayIndex, setMobileDayIndex] = useState(0);
  const [timelineViewportWidth, setTimelineViewportWidth] = useState(0);
  const [timelineViewportHeight, setTimelineViewportHeight] = useState(0);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isCosplayModalOpen, setIsCosplayModalOpen] = useState(false);
  const [editingCosplayEntry, setEditingCosplayEntry] = useState<CosplayEntry | null>(null);
  const [clickedCosplayDayKey, setClickedCosplayDayKey] = useState<string | null>(null);
  const [nowJumpPopup, setNowJumpPopup] = useState<NowJumpPopupState>(null);
  const [useLocationColors, setUseLocationColors] = useState(getInitialUseLocationColors);
  const [headerSearchQuery, setHeaderSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchImmediately, setSearchImmediately] = useState(false);
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null);
  const [pendingCenteredEventId, setPendingCenteredEventId] = useState<string | null>(null);

  const timelineContentRef = useRef<HTMLDivElement | null>(null);
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
  const configuredSlotCount = activeTimeline?.slotCount ?? 11;
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
  const isPriorityView = viewMode === 'priority-columns';
  const isDailyView = viewMode === 'daily-columns';
  const isDayColumnView = isPriorityView || isDailyView;
  const isMobileDayPager = isDayColumnView && isMobileViewport;
  const visibleDayColumns = isMobileDayPager
    ? [dayColumns[Math.min(mobileDayIndex, Math.max(dayColumns.length - 1, 0))] ?? dayColumns[0]].filter(Boolean)
    : dayColumns;
  const dayColumnWidth = isMobileDayPager
    ? Math.max(viewportWidth, 1)
    : Math.max(fittedDayColumnWidth, 1) * dayColumnScale;
  const colorOptions = getEventColors();
  const timelineHeaderHeight = 48;
  const timelineChromeHeight = 12;
  useEffect(() => {
    setHeaderSearchQuery('');
    setIsSearchOpen(false);
    setHighlightedEventId(null);
    setPendingCenteredEventId(null);
  }, [activeId]);

  useEffect(() => {
    if (!isDayColumnView) return;

    setMobileDayIndex(prev => Math.min(prev, Math.max(dayColumns.length - 1, 0)));
  }, [dayColumns.length, isDayColumnView]);

  useEffect(() => {
    if (!isMobileDayPager) return;

    const element = timelineContentRef.current;
    if (!element) return;

    element.scrollTop = 0;
  }, [mobileDayIndex, isMobileDayPager]);

  useEffect(() => {
    if (!highlightedEventId) return;

    const timeout = window.setTimeout(() => setHighlightedEventId(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [highlightedEventId]);

  useEffect(() => {
    if (!pendingCenteredEventId || !isMobileDayPager || !timelineContentRef.current) return;

    const frame = window.requestAnimationFrame(() => {
      const eventElement = Array.from(
        timelineContentRef.current?.querySelectorAll<HTMLElement>('[data-event-id]') ?? []
      ).find(element => element.dataset.eventId === pendingCenteredEventId);

      if (!eventElement) return;

      eventElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      setPendingCenteredEventId(null);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isMobileDayPager, mobileDayIndex, pendingCenteredEventId, viewMode]);

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

  const slotCount = getRenderedSlotCount(events, configuredSlotCount);
  const gridSlotHeight = isMobileViewport && timelineViewportHeight > 0
    ? Math.max(40, Math.floor((timelineViewportHeight - timelineHeaderHeight - timelineChromeHeight) / slotCount))
    : PIXELS_PER_SLOT;

  useEffect(() => {
    if (eventsLoading) return;

    const requiredSlotCount = getRequiredStackSlotCount(events, configuredSlotCount);
    if (!events.some(event => event.position >= requiredSlotCount)) return;

    const repackUpdates = repackAllEventPositions(events, requiredSlotCount);
    if (repackUpdates.length > 0) {
      batchUpdateEvents(repackUpdates);
    }
  }, [activeId, batchUpdateEvents, configuredSlotCount, events, eventsLoading]);

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

  const suggestedLocations = getLocationSuggestions(events);
  const locationOptions = Array.from(new Map(
    [
      ...locations.map(item => item.name),
      ...events.map(event => event.location?.trim()).filter((name): name is string => Boolean(name))
    ].map(name => [name.toLocaleLowerCase(), name])
  ).values()).sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));
  const { fandoms, addFandom } = useFandomPersistence(activeId);
  const suggestedFandoms = getFandomSuggestions(events);
  const fandomOptions = Array.from(new Map(
    [
      ...fandoms.map(item => item.name),
      ...events.map(event => event.fandom?.trim()).filter((name): name is string => Boolean(name))
    ].map(name => [name.toLocaleLowerCase(), name])
  ).values()).sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));

  // Handle event updates for drag, resize, modal edits, and context-menu toggles
  const handleEventUpdate = (eventId: string, updates: Partial<TimelineEventType>) => {
    const existingEvent = events.find(event => event.id === eventId);

    if (!existingEvent) {
      return;
    }

    const nextEvent = { ...existingEvent, ...updates };
    const nextEvents = events.map(event => event.id === eventId ? nextEvent : event);
    const requiredSlotCount = getRequiredStackSlotCount(nextEvents, configuredSlotCount);
    const hasExplicitPosition = typeof updates.position === 'number';
    const affectsPosition = eventUpdateAffectsPosition(existingEvent, updates);
    const attemptsMegaLockedMovement = existingEvent.megaLock && (
      affectsPosition
      || (hasExplicitPosition && updates.position !== existingEvent.position)
    );
    const conflictsWithMegaLock = hasExplicitPosition && events.some(event => (
      event.id !== eventId
      && event.megaLock
      && event.intangible === nextEvent.intangible
      && event.position === updates.position
      && nextEvent.startTime < event.endTime
      && nextEvent.endTime > event.startTime
    ));

    if (attemptsMegaLockedMovement || conflictsWithMegaLock) {
      return;
    }

    if (!existingEvent.intangible && nextEvent.intangible && existingEvent.lockTime) {
      const cascadeUpdates = cascadeEventPositions(events, existingEvent, updates, requiredSlotCount);
      const conflictsWithExistingMegaLock = events.some(event => (
        event.id !== eventId
        && event.megaLock
        && event.intangible
        && event.position === existingEvent.position
        && nextEvent.startTime < event.endTime
        && nextEvent.endTime > event.startTime
      ));

      if (conflictsWithExistingMegaLock) {
        const position = findAvailablePosition(
          events.filter(event => event.id !== eventId),
          nextEvent.startTime,
          nextEvent.endTime,
          nextEvent,
          requiredSlotCount
        );

        updateEvent(eventId, { ...updates, position });
      } else {
        batchUpdateEvents([
          { eventId, updates },
          ...cascadeUpdates
        ]);
      }
    } else if (existingEvent.intangible !== nextEvent.intangible) {
      const repackUpdates = repackEventPositions(events, eventId, updates, requiredSlotCount);
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
      const cascadeUpdates = cascadeEventPositions(events, existingEvent, updates, requiredSlotCount, true);
      const changedEventCascade = cascadeUpdates.find(update => update.eventId === eventId);
      batchUpdateEvents([
        { eventId, updates: { ...updates, ...changedEventCascade?.updates } },
        ...cascadeUpdates.filter(update => update.eventId !== eventId)
      ]);
    } else if (!affectsPosition) {
      updateEvent(eventId, updates);
    } else {
      const position = findAvailablePosition(
        events.filter(event => event.id !== eventId),
        nextEvent.startTime,
        nextEvent.endTime,
        nextEvent,
        requiredSlotCount
      );

      updateEvent(eventId, { ...updates, position });
    }

    setLastSaved(new Date());
  };

  // Drag and resize functionality with cascading support
  const { dragState, startDrag, handleMouseMove, endDrag, cancelDrag } = useDragAndResize(
    handleEventUpdate,
    startDate,
    endDate,
    gridSlotHeight,
    slotCount
  );

  // Track scroll position for navigation
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollPosition(e.currentTarget.scrollLeft);
  }, []);

  const handleWheelScroll = useCallback((event: WheelEvent | React.WheelEvent<HTMLDivElement>) => {
    if (!timelineContentRef.current) return;

    const delta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
    if (delta === 0) return;

    event.preventDefault();
    timelineContentRef.current.scrollLeft += delta;
    setScrollPosition(timelineContentRef.current.scrollLeft);
  }, []);

  const setTimelineContentElement = useCallback((element: HTMLDivElement | null) => {
    timelineContentRef.current?.removeEventListener('wheel', handleWheelScroll);
    timelineContentRef.current = element;
    element?.addEventListener('wheel', handleWheelScroll, { passive: false });
  }, [handleWheelScroll]);

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
    const nextMode = viewMode === 'timeline'
      ? 'priority-columns'
      : viewMode === 'priority-columns'
        ? 'daily-columns'
        : 'timeline';
    setViewMode(nextMode);

    if (timelineContentRef.current) {
      timelineContentRef.current.scrollLeft = 0;
    }
    setScrollPosition(0);

    if (nextMode !== 'timeline') {
      setDayColumnScale(1);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.localStorage.setItem(LOCATION_COLORS_STORAGE_KEY, String(useLocationColors));
  }, [useLocationColors]);

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
      '#14b8a6': 'Teal',
      '#84cc16': 'Lime',
      '#6b7280': 'Gray'
    }[normalizeColor(color)] ?? color
  }));
  const spanViewControls = isPriorityView ? (
    <div className="flex flex-wrap items-center gap-1">
      <div className="hidden items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 md:flex">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsColorPickerOpen(prev => !prev)}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-300 bg-white px-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-100"
            title="Change priority color"
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
                    className={`h-8 w-8 rounded-md ${normalizeColor(selectedColor) === normalizeColor(color.value) ? 'border-2 border-gray-900 shadow-[inset_0_0_0_1px_white] ring-2 ring-gray-300' : 'border border-gray-200'} hover:scale-105`}
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
    </div>
  ) : null;

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

    const handleGlobalPointerCancel = (e: PointerEvent) => {
      if (dragState.isDragging || dragState.isResizing) {
        e.preventDefault();
        cancelDrag();
      }
    };

    if (dragState.isDragging || dragState.isResizing) {
      document.addEventListener('pointermove', handleGlobalPointerMove);
      document.addEventListener('pointerup', handleGlobalPointerUp);
      document.addEventListener('pointercancel', handleGlobalPointerCancel);
      document.body.style.cursor = dragState.isDragging ? 'grabbing' : 'ew-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('pointermove', handleGlobalPointerMove);
      document.removeEventListener('pointerup', handleGlobalPointerUp);
      document.removeEventListener('pointercancel', handleGlobalPointerCancel);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragState, handleMouseMove, endDrag, cancelDrag]);

  const handleTimeSlotClick = (time: Date) => {
    // Don't create new events if we're dragging
    if (dragState.isDragging || dragState.isResizing) return;

    setCopiedEvent(undefined);
    setClickedTime(time);
    setEditingEvent(undefined);
    setIsModalOpen(true);
  };

  const handleEventEdit = (event: TimelineEventType) => {
    // Don't edit if we're dragging
    if (dragState.isDragging || dragState.isResizing) return;

    setCopiedEvent(undefined);
    setEditingEvent(event);
    setClickedTime(undefined);
    setIsModalOpen(true);
  };

  const handleDesktopSearchSubmit = (submitEvent: React.FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    if (!headerSearchQuery.trim()) return;

    setSearchImmediately(true);
    setIsSearchOpen(true);
  };

  const handleMobileSearchOpen = () => {
    setHeaderSearchQuery('');
    setSearchImmediately(false);
    setIsSearchOpen(true);
  };

  const handleSearchResultSelect = (event: TimelineEventType) => {
    setIsSearchOpen(false);
    setHighlightedEventId(event.id);

    if (viewMode === 'timeline') {
      const viewport = timelineContentRef.current;
      if (!viewport) return;

      const eventPosition = getTimePosition(event.startTime, startDate);
      const maxScroll = Math.max(0, totalTimelineWidth - viewport.clientWidth);
      const targetPosition = isMobileViewport
        ? eventPosition - PIXELS_PER_HOUR / 2
        : eventPosition - viewport.clientWidth / 2;
      const centeredPosition = Math.max(0, Math.min(targetPosition, maxScroll));
      viewport.scrollTo({ left: centeredPosition, behavior: 'smooth' });
      setScrollPosition(centeredPosition);
      return;
    }

    if (isMobileViewport) {
      if (viewMode === 'priority-columns' && normalizeColor(event.color) !== normalizeColor(selectedColor)) {
        setViewMode('daily-columns');
      }

      const targetIndex = dayColumns.findIndex(day => isSameDay(day, event.startTime));
      if (targetIndex >= 0) setMobileDayIndex(targetIndex);
      setPendingCenteredEventId(event.id);
      return;
    }

    handleEventEdit(event);
  };

  const handleEventCopy = (event: TimelineEventType) => {
    const startTime = new Date(event.startTime);
    const endTime = new Date(event.endTime);
    startTime.setDate(startTime.getDate() + 1);
    endTime.setDate(endTime.getDate() + 1);

    setEditingEvent(undefined);
    setClickedTime(undefined);
    setCopiedEvent({
      title: event.title,
      description: event.description,
      location: event.location,
      fandom: event.fandom,
      startTime,
      endTime,
      color: event.color,
      bufferBeforeMinutes: event.bufferBeforeMinutes,
      lockTime: event.lockTime,
        megaLock: event.megaLock,
      intangible: event.intangible
    });
    setIsModalOpen(true);
  };

  const handleEventSave = (eventData: Omit<TimelineEventType, 'id' | 'position'>) => {
    if (editingEvent) {
      handleEventUpdate(editingEvent.id, eventData);
    } else {
      // Create new event
      const eventForPlacement: TimelineEventType = {
        ...eventData,
        id: typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : Date.now().toString(),
        position: 0
      };
      const requiredSlotCount = getRequiredStackSlotCount([...events, eventForPlacement], configuredSlotCount);
      const position = findAvailablePosition(
        events,
        eventData.startTime,
        eventData.endTime,
        eventForPlacement,
        requiredSlotCount
      );
      const newEvent: TimelineEventType = {
        ...eventForPlacement,
        position
      };
      addEvent(newEvent);

      if (copiedEvent) {
        scrollToDate(newEvent.startTime, newEvent.startTime);
      }
    }
    setLastSaved(new Date());
  };

  const handleEventDelete = (eventId: string) => {
    const remainingEvents = events.filter(event => event.id !== eventId);
    const requiredSlotCount = getRequiredStackSlotCount(remainingEvents, configuredSlotCount);
    const needsCompaction = remainingEvents.some(event => event.position >= requiredSlotCount);
    const repackUpdates = needsCompaction
      ? repackAllEventPositions(remainingEvents, requiredSlotCount)
      : [];

    if (repackUpdates.length > 0) {
      batchUpdateEvents(repackUpdates);
    }

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
      configuredSlotCount
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
  const scrollToDate = (targetDate: Date, targetDay?: Date) => {
    if (isMobileDayPager && isDayColumnView && targetDay) {
      const targetIndex = dayColumns.findIndex(day => isSameDay(day, targetDay));
      if (targetIndex >= 0) {
        setMobileDayIndex(targetIndex);
      }
      return;
    }

    if (timelineContentRef.current) {
      const viewportWidth = timelineContentRef.current.clientWidth;
      const scrollLeft = isDayColumnView
        ? Math.max(0, dayColumns.findIndex(day => isSameDay(day, targetDate)) * dayColumnWidth)
        : getTimePosition(targetDate, startDate);
      const contentWidth = isDayColumnView
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

  const handleNowJump = () => {
    const now = new Date();
    const popup = getNowJumpPopup(now, startDate, endDate);

    if (popup) {
      setNowJumpPopup(popup);
      return;
    }

    scrollToDate(now, now);
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

  const currentRangeLabel = isMobileDayPager && visibleDayColumns[0]
    ? formatDateHeader(visibleDayColumns[0])
    : isDayColumnView
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

  const jumpToDates = dayColumns.map(day => ({
    day,
    target: getJumpTargetForDate(day),
    label: day.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
  }));
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

  const mobileJumpButtonWidth = 52;
  const mobileJumpButtonGap = 4;
  const mobileJumpHorizontalPadding = 24;
  const mobileJumpButtons = jumpToDates.length + 1;
  const mobileJumpButtonsFitOnOneRow = viewportWidth >= (
    mobileJumpButtons * mobileJumpButtonWidth
    + Math.max(mobileJumpButtons - 1, 0) * mobileJumpButtonGap
    + mobileJumpHorizontalPadding
  );
  const mobileJumpColumnCount = mobileJumpButtonsFitOnOneRow
    ? mobileJumpButtons
    : Math.ceil(mobileJumpButtons / 2);
  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <div
        className="hidden shadow-sm border-b px-6 py-4 bg-white min-[1100px]:block"
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
                {jumpToDates.map(({ day, target, label }) => (
                  <button
                    key={day.toISOString()}
                    onClick={() => scrollToDate(target, day)}
                    className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
                    title={`Go to ${day.toLocaleDateString()}`}
                    disabled={dragState.isDragging || dragState.isResizing}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleNowJump}
                  className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
                  title="Jump to the current time"
                  disabled={dragState.isDragging || dragState.isResizing}
                >
                  {NOW_JUMP_LABEL}
                </button>
              </div>
            </div>
          </div>

          <div className="relative flex items-start justify-end gap-1 pb-10 min-[1400px]:items-center min-[1400px]:pb-0">
            <div className="contents min-[1400px]:flex min-[1400px]:flex-row-reverse min-[1400px]:items-center min-[1400px]:gap-1">
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

              <form onSubmit={handleDesktopSearchSubmit} className="absolute bottom-0 right-0 w-36 lg:w-44 xl:w-56 min-[1400px]:static">
                <label>
                  <span className="sr-only">Search events</span>
                  <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="search"
                    value={headerSearchQuery}
                    onChange={event => setHeaderSearchQuery(event.target.value)}
                    placeholder="Search events"
                    className="h-9 w-full rounded-md border border-gray-300 bg-white pl-8 pr-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </label>
              </form>
            </div>

            {spanViewControls}

            <button
              type="button"
              onClick={handleToggleViewMode}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
              title={viewMode === 'timeline' ? 'Switch to priority view' : viewMode === 'priority-columns' ? 'Switch to daily view' : 'Return to timeline view'}
            >
              <CalendarDays size={16} className={viewMode === 'timeline' ? 'text-blue-600' : viewMode === 'priority-columns' ? 'text-amber-500' : 'text-violet-600'} />
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

      <div className="border-b bg-white px-3 py-3 min-[1100px]:hidden">
        <div className="flex w-full items-center gap-1 overflow-visible">
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
            fillAvailableWidth
          />

          <EventManagementMenu
            onExport={exportEvents}
            onImport={handleImportEvents}
            onClearAll={handleClearAllEvents}
            onDragonCon={() => setIsDragonConImporterOpen(true)}
            eventCount={events.length}
          />

          <button
            type="button"
            onClick={handleToggleViewMode}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-800 hover:bg-gray-50"
            title={viewMode === 'timeline' ? 'Switch to priority view' : viewMode === 'priority-columns' ? 'Switch to daily view' : 'Return to timeline view'}
          >
            <CalendarDays size={16} className={viewMode === 'timeline' ? 'text-blue-600' : viewMode === 'priority-columns' ? 'text-amber-500' : 'text-violet-600'} />
          </button>

          <button
            type="button"
            onClick={handleMobileSearchOpen}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            title="Search events"
            aria-label="Search events"
          >
            <Search size={16} />
          </button>

          {user && (
            <div className="shrink-0 whitespace-nowrap">
              <AccountMenu user={user} onSignOut={handleSignOut} />
            </div>
          )}
        </div>

        <div className="mt-2 flex min-w-0 flex-col items-center justify-center gap-1">
          <span className="text-sm font-medium text-gray-700 text-center">{currentRangeLabel}</span>
          <div
            className="grid w-full justify-center gap-1 py-[2mm] text-xs text-gray-600 min-[1100px]:hidden"
            style={{ gridTemplateColumns: `repeat(${mobileJumpColumnCount}, max-content)` }}
          >
            {jumpToDates.map(({ day, target, label }) => (
              <button
                key={day.toISOString()}
                onClick={() => scrollToDate(target, day)}
                className="whitespace-nowrap rounded-md bg-gray-200 px-2 py-1 transition-colors hover:bg-gray-300"
                title={`Go to ${day.toLocaleDateString()}`}
                disabled={dragState.isDragging || dragState.isResizing}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={handleNowJump}
              className="whitespace-nowrap rounded-md bg-gray-200 px-2 py-1 transition-colors hover:bg-gray-300"
              title="Jump to the current time"
              disabled={dragState.isDragging || dragState.isResizing}
            >
              {NOW_JUMP_LABEL}
            </button>
          </div>

          {isPriorityView && (
            <div className="grid w-full grid-cols-10 gap-1 pt-[1mm] min-[1100px]:hidden">
              {colorChoices.map(color => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setSelectedColor(color.value)}
                  className={`aspect-square w-full rounded-md ${normalizeColor(selectedColor) === normalizeColor(color.value) ? 'border-2 border-gray-900 shadow-[inset_0_0_0_1px_white] ring-2 ring-gray-300' : 'border border-gray-200'} transition-transform hover:scale-105`}
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

      {nowJumpPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 text-center shadow-xl">
            <p className="whitespace-pre-line text-base font-medium text-gray-900">{nowJumpPopup.message}</p>
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => setNowJumpPopup(null)}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                {nowJumpPopup.closeLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timeline Container */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {viewMode === 'timeline' ? (
          <div className="flex-1 flex items-start overflow-x-hidden overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
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
                ref={setTimelineContentElement}
                className="overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
                style={{ height: `${timelineHeaderHeight + slotCount * gridSlotHeight}px` }}
                onScroll={handleScroll}
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
                      const isOvernight = slot.getHours() >= 21 || slot.getHours() < 6;

                      return (
                        <div
                          key={slot.getTime()}
                          className={`absolute top-0 ${isOvernight ? 'bg-[#dbe7f3]' : 'bg-white'}`}
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
                            className={`h-full border-r flex items-end justify-center pb-2 text-xs font-medium text-gray-600 ${
                              isOvernight ? 'border-[#b7c8dc]' : 'border-gray-200'
                            } ${
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
                      const isOvernight = slot.getHours() >= 21 || slot.getHours() < 6;

                      return (
                        <div
                          key={slot.getTime()}
                          className={`absolute top-0 bottom-0 border-r transition-colors group ${
                            dragState.isDragging || dragState.isResizing
                              ? `${isOvernight ? 'z-[1] border-[#b7c8dc] bg-[#dbe7f3]' : 'border-gray-100'} cursor-not-allowed`
                              : isOvernight
                                ? 'z-[1] border-[#b7c8dc] bg-[#dbe7f3] hover:bg-[#cedded] cursor-pointer'
                                : 'border-gray-100 hover:bg-blue-50 cursor-pointer'
                          }`}
                          style={{
                            left: `${leftPosition}px`,
                            width: '240px',
                            backgroundImage: isOvernight
                              ? `repeating-linear-gradient(to bottom, transparent 0, transparent ${gridSlotHeight - 1}px, #b7c8dc ${gridSlotHeight - 1}px, #b7c8dc ${gridSlotHeight}px)`
                              : undefined
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
                        event={dragState.previewEvent?.id === event.id ? dragState.previewEvent : event}
                        startDate={startDate}
                        slotHeight={gridSlotHeight}
                        displayColor={useLocationColors ? getDisplayColorForEvent(event) : undefined}
                        onEdit={handleEventEdit}
                        onCopy={handleEventCopy}
                        onUpdateEvent={handleEventUpdate}
                        onDeleteEvent={handleEventDelete}
                        fandomSuggestions={suggestedFandoms}
                        onAddFandom={addFandom}
                        onDragStart={startDrag}
                        onDragCancel={cancelDrag}
                        isDragging={dragState.isDragging && dragState.originalEvent?.id === event.id}
                        isResizing={dragState.isResizing && dragState.originalEvent?.id === event.id}
                        isSearchHighlighted={highlightedEventId === event.id}
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
              className={isMobileDayPager
                ? 'h-full overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100'
                : 'h-full overflow-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100'}
              onScroll={handleScroll}
              onWheel={isMobileDayPager ? undefined : handleWheelScroll}
            >
              <DayColumnsView
                days={visibleDayColumns}
                events={isPriorityView
                  ? events.filter(event => normalizeColor(event.color) === normalizeColor(selectedColor))
                  : events}
                cosplayEntries={cosplayEntries}
                columnWidth={dayColumnWidth}
                useLocationColors={useLocationColors}
                onEventEdit={handleEventEdit}
                onEventCopy={handleEventCopy}
                onEventUpdate={handleEventUpdate}
                onEventDelete={handleEventDelete}
                fandomSuggestions={suggestedFandoms}
                onAddFandom={addFandom}
                onCosplayEntryCreate={handleCosplayEntryCreate}
                onCosplayEntryEdit={handleCosplayEntryEdit}
                onCosplayEntryMove={moveCosplayEntry}
                highlightedEventId={highlightedEventId}
              />
            </div>
          </div>
        )}
      </div>

      {isSearchOpen && (
        <EventSearchPane
          events={events}
          initialQuery={headerSearchQuery}
          searchImmediately={searchImmediately}
          getEventColor={getDisplayColorForEvent}
          onQueryChange={setHeaderSearchQuery}
          onClose={() => setIsSearchOpen(false)}
          onSelect={handleSearchResultSelect}
        />
      )}

      {/* Event Modal */}
      <EventModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setCopiedEvent(undefined);
        }}
        onSave={handleEventSave}
        onDelete={handleEventDelete}
        event={editingEvent}
        initialEvent={copiedEvent}
        initialStartTime={clickedTime}
        locations={locations}
        onAddLocation={addLocation}
        locationOptions={locationOptions}
        suggestedLocations={suggestedLocations}
        fandomOptions={fandomOptions}
        suggestedFandoms={suggestedFandoms}
        onAddFandom={addFandom}
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

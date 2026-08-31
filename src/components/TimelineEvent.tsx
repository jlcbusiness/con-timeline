import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Edit3, GripVertical, ChevronLeft, ChevronRight, Lock, ChevronRight as ChevronRightIcon } from 'lucide-react';
import type { TimelineEvent as TimelineEventType } from '../types/timeline';
import { getTimePosition, getEventWidth, getEventBufferWidth, getEventColors } from '../utils/timelineUtils';
import { EVENT_BUFFER_OPTIONS_MINUTES } from '../config/timeline';

const normalizeColor = (color: string) => color.trim().toLowerCase();
const formatBuffer = (minutes: number) => minutes === 0 ? 'None' : minutes === 30 ? '30 min' : minutes === 60 ? '1 hr' : '2 hrs';
type LockMode = 'off' | 'time' | 'mega';
type SubmenuPlacement = { opensLeft: boolean; width: number };

const openContextMenuClosers = new Set<() => void>();
let contextMenuBlockerInstalled = false;
const openTooltipClosers = new Set<() => void>();
let tooltipBlockerInstalled = false;

const closeAllContextMenus = () => {
  openContextMenuClosers.forEach(close => close());
};

const isNodeInsideAnyContextMenu = (target: EventTarget | null) => {
  if (!(target instanceof Node)) return false;

  return Array.from(document.querySelectorAll('[data-event-context-menu="true"]')).some(element =>
    element.contains(target)
  );
};

const installContextMenuBlocker = () => {
  if (contextMenuBlockerInstalled) return;

  const handlePointerDownCapture = (event: PointerEvent) => {
    if (openContextMenuClosers.size === 0) return;
    if (isNodeInsideAnyContextMenu(event.target)) return;

    event.preventDefault();
    event.stopPropagation();
    closeAllContextMenus();
  };

  const handleContextMenuCapture = (event: MouseEvent) => {
    if (openContextMenuClosers.size === 0) return;
    if (isNodeInsideAnyContextMenu(event.target)) return;

    event.preventDefault();
    event.stopPropagation();
    closeAllContextMenus();
  };

  document.addEventListener('pointerdown', handlePointerDownCapture, true);
  document.addEventListener('contextmenu', handleContextMenuCapture, true);
  contextMenuBlockerInstalled = true;
};

const closeAllTooltips = () => {
  openTooltipClosers.forEach(close => close());
};

const isNodeInsideAnyTooltip = (target: EventTarget | null) => {
  if (!(target instanceof Node)) return false;

  return Array.from(document.querySelectorAll('[data-event-tooltip="true"]')).some(element =>
    element.contains(target)
  );
};

const installTooltipBlocker = () => {
  if (tooltipBlockerInstalled) return;

  const handlePointerDownCapture = (event: PointerEvent) => {
    if (openTooltipClosers.size === 0) return;
    if (isNodeInsideAnyTooltip(event.target)) return;

    closeAllTooltips();
  };

  document.addEventListener('pointerdown', handlePointerDownCapture, true);
  tooltipBlockerInstalled = true;
};

interface TimelineEventProps {
  event: TimelineEventType;
  startDate: Date;
  slotHeight: number;
  displayColor?: string;
  onEdit: (event: TimelineEventType) => void;
  onCopy: (event: TimelineEventType) => void;
  onUpdateEvent: (eventId: string, updates: Partial<TimelineEventType>) => void;
  onDeleteEvent: (eventId: string) => void;
  fandomSuggestions: string[];
  onAddFandom: (name: string) => { name: string };
  onDragStart: (event: TimelineEventType, clientX: number, clientY: number, type: 'move' | 'resize-start' | 'resize-end') => void;
  onDragCancel: () => void;
  isDragging?: boolean;
  isResizing?: boolean;
  isSearchHighlighted?: boolean;
}

export const TimelineEvent: React.FC<TimelineEventProps> = ({
  event,
  startDate,
  slotHeight,
  displayColor,
  onEdit,
  onCopy,
  onUpdateEvent,
  onDeleteEvent,
  fandomSuggestions,
  onAddFandom,
  onDragStart,
  onDragCancel,
  isDragging = false,
  isResizing = false,
  isSearchHighlighted = false
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const lockSubmenuTriggerRef = useRef<HTMLDivElement>(null);
  const colorSubmenuTriggerRef = useRef<HTMLDivElement>(null);
  const fandomSubmenuTriggerRef = useRef<HTMLDivElement>(null);
  const bufferSubmenuTriggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const locationRef = useRef<HTMLSpanElement>(null);
  const fandomTagRef = useRef<HTMLSpanElement>(null);
  const fandomTagFloorRef = useRef<HTMLSpanElement>(null);
  const lockBadgeRef = useRef<HTMLDivElement>(null);
  const colorSubmenuCloseTimer = useRef<number | null>(null);
  const lockSubmenuCloseTimer = useRef<number | null>(null);
  const fandomSubmenuCloseTimer = useRef<number | null>(null);
  const bufferSubmenuCloseTimer = useRef<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties | null>(null);
  const [isColorSubmenuOpen, setIsColorSubmenuOpen] = useState(false);
  const [isLockSubmenuOpen, setIsLockSubmenuOpen] = useState(false);
  const [isFandomSubmenuOpen, setIsFandomSubmenuOpen] = useState(false);
  const [isBufferSubmenuOpen, setIsBufferSubmenuOpen] = useState(false);
  const [isAddingFandom, setIsAddingFandom] = useState(false);
  const [newFandomName, setNewFandomName] = useState('');
  const [lockSubmenuPlacement, setLockSubmenuPlacement] = useState<SubmenuPlacement>({ opensLeft: false, width: 160 });
  const [colorSubmenuPlacement, setColorSubmenuPlacement] = useState<SubmenuPlacement>({ opensLeft: false, width: 124 });
  const [fandomSubmenuPlacement, setFandomSubmenuPlacement] = useState<SubmenuPlacement>({ opensLeft: false, width: 220 });
  const [bufferSubmenuPlacement, setBufferSubmenuPlacement] = useState<SubmenuPlacement>({ opensLeft: false, width: 140 });
  const [fandomTagMaxWidth, setFandomTagMaxWidth] = useState<number | null>(null);
  const [isTitleTruncated, setIsTitleTruncated] = useState(false);
  const [isLocationTruncated, setIsLocationTruncated] = useState(false);
  const hasDescription = Boolean(event.description?.trim());

  // Use the unified positioning functions
  const leftPosition = getTimePosition(event.startTime, startDate);
  const width = getEventWidth(event.startTime, event.endTime);
  const bufferWidth = getEventBufferWidth(event);
  const isAtLeastTwoHours = event.endTime.getTime() - event.startTime.getTime() >= 2 * 60 * 60 * 1000;
  const resizeWingWidth = 12;
  const resizeWingOffset = resizeWingWidth / 2;
  const effectiveColor = displayColor ?? event.color;
  const isYellowTangible = !event.intangible && normalizeColor(effectiveColor) === '#ffc800';
  const renderedColor = isYellowTangible ? '#ffe53b' : effectiveColor;
  const tangibleTextColor = isYellowTangible ? '#925d01' : 'white';
  const ultraLockLineColor = `color-mix(in srgb, ${renderedColor} 55%, black)`;
  const eventStackClass = event.intangible ? 'z-[5]' : bufferWidth > 0 ? 'z-30' : 'z-10';
  const timeLockedClass = event.lockTime ? 'ring-2 ring-white/40 ring-inset' : '';
  const intangibleBodyClass = event.intangible ? 'opacity-[0.35] saturate-75' : '';
  const hoverClass = event.intangible ? 'hover:shadow-sm' : 'hover:shadow-md hover:z-40 hover:w-[calc(var(--event-width)+12px)]';
  
  // Fixed positioning calculation to align with slot headers
  // Each slot is 64px high, and we add 4px margin from the top of each slot
  const topPosition = event.position * slotHeight + 4;

  const colorChoices = getEventColors();

  const getSubmenuPlacement = (triggerElement: HTMLDivElement | null, preferredWidth: number): SubmenuPlacement => {
    if (!triggerElement) return { opensLeft: false, width: preferredWidth };

    const viewportPadding = 8;
    const submenuGap = 4;
    const triggerRect = triggerElement.getBoundingClientRect();
    const spaceToLeft = Math.max(0, triggerRect.left - viewportPadding - submenuGap);
    const spaceToRight = Math.max(0, window.innerWidth - triggerRect.right - viewportPadding - submenuGap);
    const opensLeft = spaceToLeft > spaceToRight;

    return {
      opensLeft,
      width: Math.min(preferredWidth, opensLeft ? spaceToLeft : spaceToRight)
    };
  };

  const handleMouseDown = (e: React.MouseEvent, type: 'move' | 'resize-start' | 'resize-end') => {
    e.preventDefault();
    e.stopPropagation();
    onDragStart(event, e.clientX, e.clientY, type);
  };

  const handlePointerDown = (e: React.PointerEvent, type: 'move' | 'resize-start' | 'resize-end') => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    onDragStart(event, e.clientX, e.clientY, type);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit(event);
  };

  const closeTooltip = React.useCallback(() => {
    setTooltipStyle(null);
  }, []);

  const updateTooltipPosition = React.useCallback(() => {
    const hostElement = hostRef.current;
    if (!hostElement) return;

    const rect = hostElement.getBoundingClientRect();
    const viewportPadding = 8;
    const visibleLeft = Math.max(rect.left, viewportPadding);
    const visibleRight = Math.min(rect.right, window.innerWidth - viewportPadding);
    const centerX = visibleRight > visibleLeft
      ? visibleLeft + (visibleRight - visibleLeft) / 2
      : rect.left + rect.width / 2;

    setTooltipStyle({
      position: 'fixed',
      left: `${centerX}px`,
      top: `${rect.top}px`,
      transform: 'translate(-50%, calc(-100% - 0.5rem))'
    });
  }, []);

  const openTooltip = () => {
    if (!hasDescription && !isTitleTruncated && !isLocationTruncated) {
      closeTooltip();
      return;
    }

    closeAllTooltips();
    installTooltipBlocker();
    openTooltipClosers.add(closeTooltip);
    updateTooltipPosition();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDragCancel();
    closeAllContextMenus();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = React.useCallback(() => {
    setContextMenu(null);
    setIsColorSubmenuOpen(false);
    setIsLockSubmenuOpen(false);
    setIsFandomSubmenuOpen(false);
    setIsBufferSubmenuOpen(false);
    setIsAddingFandom(false);
    setNewFandomName('');
  }, []);

  useLayoutEffect(() => {
    const menuElement = menuRef.current;
    if (!contextMenu || !menuElement) return;

    const viewportPadding = 8;
    const menuRect = menuElement.getBoundingClientRect();
    const x = Math.max(viewportPadding, Math.min(contextMenu.x, window.innerWidth - menuRect.width - viewportPadding));
    const y = Math.max(viewportPadding, Math.min(contextMenu.y, window.innerHeight - menuRect.height - viewportPadding));

    if (Math.abs(x - contextMenu.x) > 0.5 || Math.abs(y - contextMenu.y) > 0.5) {
      setContextMenu({ x, y });
    }
  }, [contextMenu, closeContextMenu]);

  const setLockMode = (lockMode: LockMode) => {
    onUpdateEvent(event.id, {
      lockTime: lockMode !== 'off',
      megaLock: lockMode === 'mega'
    });
    closeContextMenu();
  };

  const openLockSubmenu = () => {
    if (lockSubmenuCloseTimer.current !== null) {
      window.clearTimeout(lockSubmenuCloseTimer.current);
      lockSubmenuCloseTimer.current = null;
    }

    setLockSubmenuPlacement(getSubmenuPlacement(lockSubmenuTriggerRef.current, 160));
    setIsLockSubmenuOpen(true);
  };

  const closeLockSubmenuSoon = () => {
    if (lockSubmenuCloseTimer.current !== null) {
      window.clearTimeout(lockSubmenuCloseTimer.current);
    }

    lockSubmenuCloseTimer.current = window.setTimeout(() => {
      setIsLockSubmenuOpen(false);
      lockSubmenuCloseTimer.current = null;
    }, 140);
  };

  const toggleIntangible = () => {
    onUpdateEvent(event.id, { intangible: !event.intangible });
    closeContextMenu();
  };

  const handleDelete = () => {
    closeContextMenu();

    const confirmed = window.confirm(`Delete event "${event.title}"?`);
    if (!confirmed) return;

    onDeleteEvent(event.id);
  };

  const handleCopy = () => {
    closeContextMenu();
    onCopy(event);
  };

  const handleEdit = () => {
    closeContextMenu();
    onEdit(event);
  };

  const updateEventColor = (color: string) => {
    onUpdateEvent(event.id, { color });
    setIsColorSubmenuOpen(false);
    closeContextMenu();
  };

  const openColorSubmenu = () => {
    if (colorSubmenuCloseTimer.current !== null) {
      window.clearTimeout(colorSubmenuCloseTimer.current);
      colorSubmenuCloseTimer.current = null;
    }

    setColorSubmenuPlacement(getSubmenuPlacement(colorSubmenuTriggerRef.current, 124));
    setIsColorSubmenuOpen(true);
  };

  const closeColorSubmenuSoon = () => {
    if (colorSubmenuCloseTimer.current !== null) {
      window.clearTimeout(colorSubmenuCloseTimer.current);
    }

    colorSubmenuCloseTimer.current = window.setTimeout(() => {
      setIsColorSubmenuOpen(false);
      colorSubmenuCloseTimer.current = null;
    }, 140);
  };

  const openFandomSubmenu = () => {
    if (fandomSubmenuCloseTimer.current !== null) {
      window.clearTimeout(fandomSubmenuCloseTimer.current);
      fandomSubmenuCloseTimer.current = null;
    }

    setFandomSubmenuPlacement(getSubmenuPlacement(fandomSubmenuTriggerRef.current, 220));
    setIsFandomSubmenuOpen(true);
  };

  const closeFandomSubmenuSoon = () => {
    if (fandomSubmenuCloseTimer.current !== null) {
      window.clearTimeout(fandomSubmenuCloseTimer.current);
    }

    fandomSubmenuCloseTimer.current = window.setTimeout(() => {
      setIsFandomSubmenuOpen(false);
      fandomSubmenuCloseTimer.current = null;
    }, 140);
  };

  const updateEventFandom = (fandom?: string) => {
    onUpdateEvent(event.id, { fandom });
    setIsFandomSubmenuOpen(false);
    closeContextMenu();
  };

  const updateEventBuffer = (bufferBeforeMinutes: number) => {
    onUpdateEvent(event.id, { bufferBeforeMinutes });
    setIsBufferSubmenuOpen(false);
    closeContextMenu();
  };

  const openBufferSubmenu = () => {
    if (bufferSubmenuCloseTimer.current !== null) {
      window.clearTimeout(bufferSubmenuCloseTimer.current);
      bufferSubmenuCloseTimer.current = null;
    }

    setBufferSubmenuPlacement(getSubmenuPlacement(bufferSubmenuTriggerRef.current, 140));
    setIsBufferSubmenuOpen(true);
  };

  const closeBufferSubmenuSoon = () => {
    if (bufferSubmenuCloseTimer.current !== null) {
      window.clearTimeout(bufferSubmenuCloseTimer.current);
    }

    bufferSubmenuCloseTimer.current = window.setTimeout(() => {
      setIsBufferSubmenuOpen(false);
      bufferSubmenuCloseTimer.current = null;
    }, 140);
  };

  const handleNewFandomKeyDown = (keyboardEvent: React.KeyboardEvent<HTMLInputElement>) => {
    if (keyboardEvent.key !== 'Enter') return;

    keyboardEvent.preventDefault();
    keyboardEvent.stopPropagation();
    const name = newFandomName.trim();
    if (!name) return;

    updateEventFandom(onAddFandom(name).name);
  };

  useEffect(() => {
    if (!contextMenu) return;

    openContextMenuClosers.add(closeContextMenu);
    installContextMenuBlocker();

    const handlePointerDown = (pointerEvent: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(pointerEvent.target as Node)) {
        closeContextMenu();
      }
    };

    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === 'Escape') {
        closeContextMenu();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      openContextMenuClosers.delete(closeContextMenu);
    };
  }, [contextMenu, closeContextMenu]);

  useEffect(() => {
    if (!tooltipStyle) return;

    openTooltipClosers.add(closeTooltip);
    installTooltipBlocker();

    const handlePointerDown = (pointerEvent: PointerEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(pointerEvent.target as Node)) {
        closeTooltip();
      }
    };

    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === 'Escape') {
        closeTooltip();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      openTooltipClosers.delete(closeTooltip);
    };
  }, [tooltipStyle, closeTooltip]);

  useEffect(() => {
    const handleScrollOrResize = () => {
      if (tooltipStyle) {
        updateTooltipPosition();
      }
    };

    if (!tooltipStyle) return;

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [tooltipStyle, updateTooltipPosition]);

  useLayoutEffect(() => {
    const titleElement = titleRef.current;
    if (!titleElement || event.intangible) {
      setIsTitleTruncated(false);
      return;
    }

    const updateTitleTruncation = () => {
      const isTruncated = titleElement.scrollWidth > titleElement.clientWidth;
      setIsTitleTruncated(current => current === isTruncated ? current : isTruncated);
    };

    updateTitleTruncation();
    const resizeObserver = new ResizeObserver(updateTitleTruncation);
    resizeObserver.observe(titleElement);
    if (hostRef.current) resizeObserver.observe(hostRef.current);

    return () => resizeObserver.disconnect();
  }, [event.endTime, event.intangible, event.startTime, event.title]);

  useLayoutEffect(() => {
    const locationElement = locationRef.current;
    if (!locationElement || event.intangible) {
      setIsLocationTruncated(false);
      return;
    }

    const updateLocationTruncation = () => {
      const isTruncated = locationElement.scrollWidth > locationElement.clientWidth
        || locationElement.scrollHeight > locationElement.clientHeight;
      setIsLocationTruncated(current => current === isTruncated ? current : isTruncated);
    };

    updateLocationTruncation();
    const resizeObserver = new ResizeObserver(updateLocationTruncation);
    resizeObserver.observe(locationElement);
    if (hostRef.current) resizeObserver.observe(hostRef.current);

    return () => resizeObserver.disconnect();
  }, [event.endTime, event.intangible, event.location, event.startTime, slotHeight]);

  useLayoutEffect(() => {
    const hostElement = hostRef.current;
    const locationElement = locationRef.current;
    if (event.intangible || !event.fandom?.trim() || !locationElement || !hostElement) {
      setFandomTagMaxWidth(null);
      return;
    }

    const updateFandomTagWidth = () => {
      const hostRect = hostElement.getBoundingClientRect();
      const locationRect = locationElement.getBoundingClientRect();
      const lockRect = lockBadgeRef.current?.getBoundingClientRect();
      const tagRightEdge = lockRect ? lockRect.left - 4 : hostRect.right - 4;
      const availableWidth = Math.max(0, Math.floor(tagRightEdge - locationRect.right - 4));
      const naturalTagWidth = fandomTagRef.current?.scrollWidth ?? 0;
      const floorWidth = fandomTagFloorRef.current?.getBoundingClientRect().width ?? 0;
      const constrainedWidth = naturalTagWidth > availableWidth
        ? Math.max(availableWidth, Math.ceil(floorWidth))
        : availableWidth;
      setFandomTagMaxWidth(current => current === constrainedWidth ? current : constrainedWidth);
    };

    updateFandomTagWidth();
    const resizeObserver = new ResizeObserver(updateFandomTagWidth);
    resizeObserver.observe(hostElement);
    resizeObserver.observe(locationElement);
    if (lockBadgeRef.current) resizeObserver.observe(lockBadgeRef.current);

    return () => resizeObserver.disconnect();
  }, [event.fandom, event.intangible, event.location, event.lockTime, event.megaLock, slotHeight]);

  useEffect(() => {
    return () => {
      if (colorSubmenuCloseTimer.current !== null) {
        window.clearTimeout(colorSubmenuCloseTimer.current);
      }
      if (lockSubmenuCloseTimer.current !== null) {
        window.clearTimeout(lockSubmenuCloseTimer.current);
      }
      if (fandomSubmenuCloseTimer.current !== null) {
        window.clearTimeout(fandomSubmenuCloseTimer.current);
      }
      if (bufferSubmenuCloseTimer.current !== null) {
        window.clearTimeout(bufferSubmenuCloseTimer.current);
      }
    };
  }, []);

  return (
    <div
      ref={hostRef}
      data-event-id={event.id}
      className={`absolute ${eventStackClass} ${timeLockedClass} rounded-md shadow-sm border border-opacity-20 border-white group select-none touch-none transition-[width,transform,box-shadow] duration-150 ${
        isDragging || isResizing 
          ? 'shadow-lg z-50 cursor-grabbing'
          : `${hoverClass} cursor-grab`
      }`}
      style={{
        left: `${leftPosition}px`,
        top: `${topPosition}px`,
        ['--event-width']: `${Math.max(width, 80)}px`,
        width: 'var(--event-width)',
        height: `${Math.max(slotHeight - 8, 40)}px`,
        backgroundColor: event.intangible ? 'transparent' : renderedColor,
        color: event.intangible ? 'white' : tangibleTextColor,
        borderWidth: isSearchHighlighted ? '4px' : undefined,
        borderColor: isSearchHighlighted ? '#fde047' : undefined
      } as React.CSSProperties & { ['--event-width']: string }}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={hasDescription || isTitleTruncated || isLocationTruncated ? openTooltip : undefined}
      onMouseMove={hasDescription || isTitleTruncated || isLocationTruncated ? updateTooltipPosition : undefined}
      onMouseLeave={hasDescription || isTitleTruncated || isLocationTruncated ? closeTooltip : undefined}
      onPointerLeave={hasDescription || isTitleTruncated || isLocationTruncated ? closeTooltip : undefined}
      title={undefined}
    >
      {bufferWidth > 0 && (
        <div
          className="absolute top-0 bottom-0 z-0 rounded-l-md pointer-events-none"
          style={{
            left: `${-bufferWidth}px`,
            width: `${bufferWidth}px`,
            backgroundColor: renderedColor,
            opacity: 0.18,
            borderLeft: '1px solid rgba(255, 255, 255, 0.35)',
            borderTopLeftRadius: '0.375rem',
            borderBottomLeftRadius: '0.375rem'
          }}
        />
      )}

      <div
        className={`absolute inset-0 z-10 rounded-md overflow-hidden ${intangibleBodyClass}`}
        style={{ backgroundColor: event.intangible ? effectiveColor : 'transparent' }}
      >
        {/* Under-wing left shadow for contrast on white gaps */}
        <div
          className="absolute top-0 bottom-0 z-0 rounded-l-md opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{
            left: `${-resizeWingOffset}px`,
            width: `${resizeWingWidth}px`,
            backgroundColor: renderedColor
          }}
        />

        {/* Resize handle - Start */}
        <div
          className="absolute top-0 bottom-0 z-30 cursor-ew-resize opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-colors bg-white/25 hover:bg-white/40 rounded-l-md flex items-center justify-center touch-none"
          style={{
            left: `${-resizeWingOffset}px`,
            width: `${resizeWingWidth}px`
          }}
          onMouseDown={(e) => handleMouseDown(e, 'resize-start')}
          onPointerDown={(e) => handlePointerDown(e, 'resize-start')}
          title="Drag to resize start time"
        >
          <ChevronLeft size={10} className="text-white" />
        </div>

        {/* Main event content */}
        <div
          className="flex h-full min-h-0 flex-col justify-center overflow-hidden px-3 py-1.5 text-xs font-medium cursor-grab active:cursor-grabbing touch-none"
          onMouseDown={(e) => handleMouseDown(e, 'move')}
          onPointerDown={(e) => handlePointerDown(e, 'move')}
        >
          {/* First line: Title with icons and edit button */}
          <div className="flex shrink-0 items-start justify-between min-w-0 gap-1">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              {!event.intangible && <GripVertical size={10} className="flex-shrink-0 opacity-60" />}
              <span ref={titleRef} data-event-title="true" className={event.intangible ? 'sr-only' : 'truncate whitespace-nowrap font-medium'}>{event.title}</span>
            </div>
            
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-1">
              <Edit3 size={10} />
            </div>
          </div>

          {/* Second line: Location (if present) */}
          {event.location && (
            <div className="mt-0.5 flex min-w-0 shrink-0 items-start gap-1 overflow-hidden">
              <div className="w-2.5 shrink-0"></div> {/* Spacer to align with title */}
              {event.intangible ? (
                <span className="sr-only">{event.location}</span>
              ) : (
                <span
                  ref={locationRef}
                  data-event-location="true"
                  className="block min-w-0 flex-1 truncate whitespace-nowrap text-xs leading-snug opacity-90"
                >
                  {event.location}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Under-wing right shadow for contrast on white gaps */}
        <div
          className="absolute top-0 bottom-0 z-0 rounded-r-md opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{
            right: `${-resizeWingOffset}px`,
            width: `${resizeWingWidth}px`,
            backgroundColor: renderedColor
          }}
        />

        {/* Resize handle - End */}
        <div
          className="absolute top-0 bottom-0 z-30 cursor-ew-resize opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-colors bg-white/25 hover:bg-white/40 rounded-r-md flex items-center justify-center touch-none"
          style={{
            right: `${-resizeWingOffset}px`,
            width: `${resizeWingWidth}px`
          }}
          onMouseDown={(e) => handleMouseDown(e, 'resize-end')}
          onPointerDown={(e) => handlePointerDown(e, 'resize-end')}
          title="Drag to resize end time"
        >
          <ChevronRight size={10} className="text-white" />
        </div>
      </div>

      {event.intangible && isAtLeastTwoHours && event.fandom?.trim() && (
        <span
          data-event-fandom-tag="true"
          className="pointer-events-none absolute right-1 top-1 z-20 max-w-[calc(100%-0.5rem)] truncate rounded-md border border-current px-1.5 py-0.5 text-[11px] font-medium leading-snug shadow-sm"
          title={event.fandom}
          style={{ color: `color-mix(in srgb, ${effectiveColor} 60%, black)`, opacity: 0.35 }}
        >
          {event.fandom}
        </span>
      )}

      {event.intangible && (event.location?.trim() || (!isAtLeastTwoHours && event.fandom?.trim())) && (
        <div
          className="absolute inset-x-0 bottom-1 z-20 pointer-events-none flex items-end gap-1 px-2 text-[11px] font-medium"
          style={{ color: `color-mix(in srgb, ${effectiveColor} 60%, black)`, opacity: 0.35 }}
        >
          {event.location?.trim() && (
            <span className="min-w-0 flex-1 truncate whitespace-nowrap text-left leading-snug">
              {event.location}
            </span>
          )}
          {isAtLeastTwoHours && event.location?.trim() && (
            <span className="flex-shrink-0 whitespace-nowrap text-right leading-snug">
              {event.location}
            </span>
          )}
          {!isAtLeastTwoHours && event.fandom?.trim() && (
            <span
              data-event-fandom-tag="true"
              className="-mr-1 ml-auto max-w-full shrink-0 truncate rounded-md border border-current px-1.5 py-0.5 leading-snug shadow-sm"
              title={event.fandom}
            >
              {event.fandom}
            </span>
          )}
        </div>
      )}
      
      {/* Enhanced tooltip on hover */}
      {tooltipStyle && createPortal(
        <div
          ref={tooltipRef}
          data-event-tooltip="true"
          className="pointer-events-none z-[9998] rounded shadow-lg bg-gray-900 text-white text-xs whitespace-pre-line text-center"
          style={tooltipStyle}
        >
          <div className="px-3 py-2 rounded">
            {isTitleTruncated && <div className="max-w-xs font-semibold text-white">{event.title}</div>}
            {isLocationTruncated && <div className={`max-w-xs text-gray-200 ${isTitleTruncated ? 'mt-1' : ''}`}>{event.location}</div>}
            {hasDescription && <div className={`max-w-xs text-gray-300 ${isTitleTruncated || isLocationTruncated ? 'mt-1' : ''}`}>{event.description}</div>}
          </div>
          <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
        </div>,
        document.body
      )}

      {/* Visual feedback during drag/resize */}
      {(isDragging || isResizing) && (
        <div className="absolute -inset-1 border-2 border-white border-dashed rounded-md pointer-events-none"></div>
      )}

      {((!event.intangible && event.fandom?.trim()) || event.lockTime || event.megaLock) && (
        <div className="pointer-events-none absolute bottom-1 right-1 z-20 flex max-w-[calc(100%-0.5rem)] items-center justify-end gap-1">
          {!event.intangible && event.fandom?.trim() && (
            <>
              <span
                ref={fandomTagFloorRef}
                className="invisible absolute whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-snug"
                aria-hidden="true"
              >
                Superman
              </span>
              <span
                ref={fandomTagRef}
                data-event-fandom-tag="true"
                className="min-w-0 max-w-full truncate rounded-md border border-white/70 px-1.5 py-0.5 text-[11px] font-medium leading-snug shadow-sm"
                title={event.fandom}
                style={{ backgroundColor: renderedColor, color: tangibleTextColor, maxWidth: fandomTagMaxWidth === null ? undefined : `${fandomTagMaxWidth}px` }}
              >
                {event.fandom}
              </span>
            </>
          )}
          {(event.lockTime || event.megaLock) && (
            <div
              ref={lockBadgeRef}
              className={`shrink-0 rounded-full px-[1mm] py-[1mm] ${event.megaLock ? 'border' : ''}`}
              style={event.megaLock
                ? {
                    backgroundColor: 'rgba(255, 255, 255, 0.70)',
                    backdropFilter: 'blur(3px)',
                    WebkitBackdropFilter: 'blur(3px)',
                    borderColor: ultraLockLineColor,
                    color: ultraLockLineColor
                  }
                : event.lockTime ? { backgroundColor: renderedColor } : undefined}
            >
              <Lock size={10} className={event.megaLock ? '' : 'text-white opacity-90'} />
            </div>
          )}
        </div>
      )}

      {contextMenu && createPortal(
        <div
          ref={menuRef}
          data-event-context-menu="true"
          className="fixed z-[9999] min-w-[13rem] overflow-visible rounded-md border border-gray-200 bg-white py-1 shadow-xl"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          role="menu"
          aria-label={`Event actions for ${event.title}`}
        >
          <div
            ref={lockSubmenuTriggerRef}
            className="relative"
            onMouseEnter={openLockSubmenu}
            onMouseLeave={closeLockSubmenuSoon}
          >
            <button
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={isLockSubmenuOpen}
              onClick={openLockSubmenu}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              <span>Lock</span>
              <ChevronRightIcon size={14} className="text-gray-400" />
            </button>

            {isLockSubmenuOpen && (
              <div
                className={`absolute top-0 z-[10000] min-w-0 rounded-md border border-gray-200 bg-white py-1 shadow-xl ${lockSubmenuPlacement.opensLeft ? 'right-full mr-1' : 'left-full ml-1'}`}
                style={{ width: `${lockSubmenuPlacement.width}px` }}
                onMouseEnter={openLockSubmenu}
                onMouseLeave={closeLockSubmenuSoon}
              >
                <div className="flex flex-col" role="radiogroup" aria-label="Event lock mode">
                  {(['off', 'time', 'mega'] as const).map(mode => {
                    const currentMode: LockMode = event.megaLock ? 'mega' : event.lockTime ? 'time' : 'off';
                    return (
                      <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={currentMode === mode}
                        onClick={() => setLockMode(mode)}
                        className={`w-full px-3 py-2 text-left text-sm ${currentMode === mode ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                      >
                        {mode === 'off' ? 'Off' : mode === 'time' ? 'Time' : 'ULTRA'}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={event.intangible}
            onClick={toggleIntangible}
            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
          >
            <span>Intangible</span>
            <span className="text-xs text-gray-500">{event.intangible ? 'ON' : 'off'}</span>
          </button>
          <div
            ref={colorSubmenuTriggerRef}
            className="relative"
            onMouseEnter={openColorSubmenu}
            onMouseLeave={closeColorSubmenuSoon}
          >
            <button
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={isColorSubmenuOpen}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              <span>Color</span>
              <ChevronRightIcon size={14} className="text-gray-400" />
            </button>

            {isColorSubmenuOpen && (
              <div
                className={`absolute top-0 z-[10000] min-w-0 overflow-hidden rounded-md border border-gray-200 bg-white p-2 shadow-xl ${colorSubmenuPlacement.opensLeft ? 'right-full mr-1' : 'left-full ml-1'}`}
                style={{ width: `${colorSubmenuPlacement.width}px` }}
                onMouseEnter={openColorSubmenu}
                onMouseLeave={closeColorSubmenuSoon}
              >
                <div className="grid grid-cols-[repeat(auto-fit,2rem)] place-content-center justify-center gap-2">
                  {colorChoices.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => updateEventColor(color)}
                      className={`h-8 w-8 rounded-md transition-transform hover:scale-105 ${normalizeColor(event.color) === normalizeColor(color) ? 'border-2 border-gray-900 shadow-[inset_0_0_0_1px_white] ring-2 ring-gray-300' : 'border border-gray-200'}`}
                      style={{ backgroundColor: color }}
                      aria-label={`Set event color to ${color}`}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          <div
            ref={fandomSubmenuTriggerRef}
            className="relative"
            onMouseEnter={openFandomSubmenu}
            onMouseLeave={closeFandomSubmenuSoon}
          >
            <button
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={isFandomSubmenuOpen}
              onClick={openFandomSubmenu}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              <span>Fandom</span>
              <ChevronRightIcon size={14} className="text-gray-400" />
            </button>

            {isFandomSubmenuOpen && (
              <div
                className={`absolute top-0 z-[10000] min-w-0 overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-xl ${fandomSubmenuPlacement.opensLeft ? 'right-full mr-1' : 'left-full ml-1'}`}
                style={{ width: `${fandomSubmenuPlacement.width}px` }}
                onMouseEnter={openFandomSubmenu}
                onMouseLeave={closeFandomSubmenuSoon}
                role="menu"
                aria-label="Set event fandom"
              >
                {event.fandom?.trim() && (
                  <button type="button" role="menuitem" onClick={() => updateEventFandom(undefined)} className="w-full truncate px-3 py-2 text-left text-sm text-red-800 hover:bg-red-50" title={`Remove ${event.fandom}`}>
                    Remove
                  </button>
                )}
                {isAddingFandom ? (
                  <div className="border-t border-gray-100 px-2 py-2">
                    <input
                      autoFocus
                      type="text"
                      value={newFandomName}
                      onChange={changeEvent => setNewFandomName(changeEvent.target.value)}
                      onKeyDown={handleNewFandomKeyDown}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="Fandom name"
                      aria-label="New fandom name"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => setIsAddingFandom(true)}
                    className="w-full border-t border-gray-100 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Add
                  </button>
                )}
                {fandomSuggestions.length > 0 && (
                  <div className="border-t border-gray-100 pt-1">
                    {fandomSuggestions.map(fandom => (
                      <button key={fandom.toLocaleLowerCase()} type="button" role="menuitemradio" aria-checked={event.fandom?.toLocaleLowerCase() === fandom.toLocaleLowerCase()} onClick={() => updateEventFandom(fandom)} className={`w-full truncate px-3 py-2 text-left text-sm ${event.fandom?.toLocaleLowerCase() === fandom.toLocaleLowerCase() ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`} title={fandom}>
                        {fandom}
                      </button>
                    ))}
                  </div>
                )}
                {fandomSuggestions.length === 0 && (
                  <div className="px-3 py-2 text-sm text-gray-500">No fandoms yet</div>
                )}
              </div>
            )}
          </div>
          <div
            ref={bufferSubmenuTriggerRef}
            className="relative"
            onMouseEnter={openBufferSubmenu}
            onMouseLeave={closeBufferSubmenuSoon}
          >
            <button
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={isBufferSubmenuOpen}
              onClick={openBufferSubmenu}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              <span>Buffer</span>
              <ChevronRightIcon size={14} className="text-gray-400" />
            </button>

            {isBufferSubmenuOpen && (
              <div
                className={`absolute top-0 z-[10000] min-w-0 overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-xl ${bufferSubmenuPlacement.opensLeft ? 'right-full mr-1' : 'left-full ml-1'}`}
                style={{ width: `${bufferSubmenuPlacement.width}px` }}
                onMouseEnter={openBufferSubmenu}
                onMouseLeave={closeBufferSubmenuSoon}
                role="radiogroup"
                aria-label="Event waiting buffer"
              >
                {EVENT_BUFFER_OPTIONS_MINUTES.map(minutes => (
                  <button
                    key={minutes}
                    type="button"
                    role="radio"
                    aria-checked={(event.bufferBeforeMinutes ?? 0) === minutes}
                    onClick={() => updateEventBuffer(minutes)}
                    className={`w-full px-3 py-2 text-left text-sm ${(event.bufferBeforeMinutes ?? 0) === minutes ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    {formatBuffer(minutes)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={handleEdit}
            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
          >
            <span>Edit</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleCopy}
            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
          >
            <span>Copy</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleDelete}
            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
          >
            <span>Delete</span>
          </button>
        </div>,
        document.body
      )}
    </div>
  );
};

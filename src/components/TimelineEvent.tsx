import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Edit3, GripVertical, ChevronLeft, ChevronRight, MapPin, Lock, ChevronRight as ChevronRightIcon } from 'lucide-react';
import type { TimelineEvent as TimelineEventType } from '../types/timeline';
import { getTimePosition, getEventWidth, getEventBufferWidth, getEventColors } from '../utils/timelineUtils';

const normalizeColor = (color: string) => color.trim().toLowerCase();

const openContextMenuClosers = new Set<() => void>();
let contextMenuBlockerInstalled = false;

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

interface TimelineEventProps {
  event: TimelineEventType;
  startDate: Date;
  slotHeight: number;
  displayColor?: string;
  onEdit: (event: TimelineEventType) => void;
  onCopy: (event: TimelineEventType) => void;
  onUpdateEvent: (eventId: string, updates: Partial<TimelineEventType>) => void;
  onDeleteEvent: (eventId: string) => void;
  onDragStart: (event: TimelineEventType, clientX: number, clientY: number, type: 'move' | 'resize-start' | 'resize-end') => void;
  isDragging?: boolean;
  isResizing?: boolean;
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
  onDragStart,
  isDragging = false,
  isResizing = false
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const colorSubmenuCloseTimer = useRef<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties | null>(null);
  const [isColorSubmenuOpen, setIsColorSubmenuOpen] = useState(false);

  // Use the unified positioning functions
  const leftPosition = getTimePosition(event.startTime, startDate);
  const width = getEventWidth(event.startTime, event.endTime);
  const bufferWidth = getEventBufferWidth(event);
  const resizeWingWidth = 12;
  const resizeWingOffset = resizeWingWidth / 2;
  const effectiveColor = displayColor ?? event.color;
  const eventStackClass = event.intangible ? 'z-[5]' : bufferWidth > 0 ? 'z-30' : 'z-10';
  const timeLockedClass = event.lockTime ? 'ring-2 ring-white/40 ring-inset' : '';
  const intangibleBodyClass = event.intangible ? 'opacity-[0.35] saturate-75' : '';
  const hoverClass = event.intangible ? 'hover:shadow-sm' : 'hover:shadow-md hover:z-40 hover:w-[calc(var(--event-width)+12px)]';
  
  // Fixed positioning calculation to align with slot headers
  // Each slot is 64px high, and we add 4px margin from the top of each slot
  const topPosition = event.position * slotHeight + 4;

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const colorChoices = getEventColors();

  const getDuration = (): string => {
    const durationMs = event.endTime.getTime() - event.startTime.getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours === 0) {
      return `${minutes}m`;
    } else if (minutes === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h ${minutes}m`;
    }
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

  const updateTooltipPosition = () => {
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
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    closeAllContextMenus();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
    openContextMenuClosers.delete(closeContextMenu);
    setIsColorSubmenuOpen(false);
  };

  const toggleLockTime = () => {
    onUpdateEvent(event.id, { lockTime: !event.lockTime });
    closeContextMenu();
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
  }, [contextMenu]);

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
  }, [tooltipStyle]);

  useEffect(() => {
    return () => {
      if (colorSubmenuCloseTimer.current !== null) {
        window.clearTimeout(colorSubmenuCloseTimer.current);
      }
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className={`absolute ${eventStackClass} ${timeLockedClass} rounded-md shadow-sm border border-opacity-20 border-white group select-none touch-none transition-[width,transform,box-shadow] duration-150 ${
        isDragging || isResizing 
          ? 'shadow-lg z-50 cursor-grabbing'
          : `${hoverClass} cursor-grab`
      }`}
      style={{
        left: `${leftPosition}px`,
        top: `${topPosition}px`,
        ['--event-width' as any]: `${Math.max(width, 80)}px`,
        width: 'var(--event-width)',
        height: `${Math.max(slotHeight - 8, 40)}px`,
        backgroundColor: event.intangible ? 'transparent' : effectiveColor,
        color: 'white'
      }}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={updateTooltipPosition}
      onMouseMove={updateTooltipPosition}
      onMouseLeave={() => setTooltipStyle(null)}
      title={`${event.title}${event.location ? ` @ ${event.location}` : ''}\n${formatTime(event.startTime)} - ${formatTime(event.endTime)}\n${getDuration()}\nDouble-click to edit, drag to move, drag edges to resize`}
    >
      {bufferWidth > 0 && (
        <div
          className="absolute top-0 bottom-0 z-0 rounded-l-md pointer-events-none"
          style={{
            left: `${-bufferWidth}px`,
            width: `${bufferWidth}px`,
            backgroundColor: effectiveColor,
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
            backgroundColor: effectiveColor
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
          className="flex flex-col justify-center h-full px-3 py-2 text-xs font-medium cursor-grab active:cursor-grabbing touch-none"
          onMouseDown={(e) => handleMouseDown(e, 'move')}
          onPointerDown={(e) => handlePointerDown(e, 'move')}
        >
          {/* First line: Title with icons and edit button */}
          <div className="flex items-start justify-between min-w-0 gap-1">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              {!event.intangible && <GripVertical size={10} className="flex-shrink-0 opacity-60" />}
              <span className={event.intangible ? 'sr-only' : 'truncate whitespace-nowrap font-medium'}>{event.title}</span>
            </div>
            
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-1">
              <Edit3 size={10} />
            </div>
          </div>

          {/* Second line: Location (if present) */}
          {event.location && (
            <div className="flex items-start gap-1 mt-1 min-w-0">
              <div className="w-2.5"></div> {/* Spacer to align with title */}
              {event.intangible ? (
                <span className="sr-only">{event.location}</span>
              ) : (
                <span
                  className="whitespace-normal break-words text-xs leading-snug opacity-90"
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
            backgroundColor: effectiveColor
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

      {event.intangible && event.location?.trim() && (
        <div
          className="absolute inset-x-0 bottom-1 z-20 pointer-events-none flex items-end px-2 text-[11px] font-medium"
          style={{ color: `color-mix(in srgb, ${effectiveColor} 60%, black)`, opacity: 0.35 }}
        >
          <span className="min-w-0 flex-1 truncate whitespace-nowrap text-left leading-snug">
            {event.location}
          </span>
          {((event.endTime.getTime() - event.startTime.getTime()) / (1000 * 60 * 60)) >= 2 && (
            <span className="flex-shrink-0 whitespace-nowrap text-right leading-snug">
              {event.location}
            </span>
          )}
        </div>
      )}
      
      {/* Enhanced tooltip on hover */}
      {tooltipStyle && createPortal(
        <div
          ref={tooltipRef}
          className="pointer-events-none z-[9998] rounded shadow-lg bg-gray-900 text-white text-xs whitespace-nowrap"
          style={tooltipStyle}
        >
          <div className="px-3 py-2 rounded">
            <div className="font-medium">{event.title}</div>
            <div className="text-gray-300">
              {formatTime(event.startTime)} - {formatTime(event.endTime)} ({getDuration()})
            </div>
            {event.location && (
              <div className="text-gray-300 flex items-center gap-1">
                <MapPin size={10} />
                {event.location}
              </div>
            )}
            {event.description && (
              <div className="text-gray-300 mt-1 max-w-xs">{event.description}</div>
            )}
            <div className="text-gray-400 text-xs mt-1">
              Double-click to edit • Drag to move • Drag edges to resize
            </div>
          </div>
          <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
        </div>,
        document.body
      )}

      {/* Visual feedback during drag/resize */}
      {(isDragging || isResizing) && (
        <div className="absolute -inset-1 border-2 border-white border-dashed rounded-md pointer-events-none"></div>
      )}

      {!event.intangible && event.lockTime && (
        <div
          className="absolute bottom-1 right-1 z-20 pointer-events-none rounded-full px-[1mm] py-[1mm]"
          style={{ backgroundColor: effectiveColor }}
        >
          <Lock size={10} className="opacity-90" />
        </div>
      )}

      {contextMenu && createPortal(
        <div
          ref={menuRef}
          data-event-context-menu="true"
          className="fixed z-[9999] min-w-52 overflow-visible rounded-md border border-gray-200 bg-white py-1 shadow-xl"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          role="menu"
          aria-label={`Event actions for ${event.title}`}
        >
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={event.lockTime}
            onClick={toggleLockTime}
            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
          >
            <span>Lock</span>
            <span className="text-xs text-gray-500">{event.lockTime ? 'ON' : 'off'}</span>
          </button>
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
                className="absolute left-full top-0 z-[10000] ml-1 w-[7.75rem] rounded-md border border-gray-200 bg-white p-2 shadow-xl"
                onMouseEnter={openColorSubmenu}
                onMouseLeave={closeColorSubmenuSoon}
              >
                <div className="grid grid-cols-3 place-items-center gap-2">
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

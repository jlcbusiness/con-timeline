import React from 'react';
import { Edit3, GripVertical, ChevronLeft, ChevronRight, MapPin, Lock } from 'lucide-react';
import type { TimelineEvent as TimelineEventType } from '../types/timeline';
import { getTimePosition, getEventWidth, getEventBufferWidth } from '../utils/timelineUtils';

interface TimelineEventProps {
  event: TimelineEventType;
  startDate: Date;
  slotHeight: number;
  onEdit: (event: TimelineEventType) => void;
  onDragStart: (event: TimelineEventType, clientX: number, clientY: number, type: 'move' | 'resize-start' | 'resize-end') => void;
  isDragging?: boolean;
  isResizing?: boolean;
}

export const TimelineEvent: React.FC<TimelineEventProps> = ({
  event,
  startDate,
  slotHeight,
  onEdit,
  onDragStart,
  isDragging = false,
  isResizing = false
}) => {
  // Use the unified positioning functions
  const leftPosition = getTimePosition(event.startTime, startDate);
  const width = getEventWidth(event.startTime, event.endTime);
  const bufferWidth = getEventBufferWidth(event);
  const resizeWingWidth = 12;
  const resizeWingOffset = resizeWingWidth / 2;
  const eventStackClass = event.intangible ? 'z-[5]' : bufferWidth > 0 ? 'z-30' : 'z-10';
  const timeLockedClass = event.lockTime ? 'ring-2 ring-white/40 ring-inset' : '';
  const intangibleClass = event.intangible ? 'opacity-[0.35] saturate-75' : '';
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

  return (
    <div
      className={`absolute ${eventStackClass} ${intangibleClass} ${timeLockedClass} rounded-md shadow-sm border border-opacity-20 border-white group select-none touch-none transition-[width,transform,box-shadow] duration-150 ${
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
        backgroundColor: event.color,
        color: 'white'
      }}
      onDoubleClick={handleDoubleClick}
      title={`${event.title}${event.location ? ` @ ${event.location}` : ''}\n${formatTime(event.startTime)} - ${formatTime(event.endTime)}\n${getDuration()}\nDouble-click to edit, drag to move, drag edges to resize`}
    >
      {bufferWidth > 0 && (
        <div
          className="absolute top-0 bottom-0 z-20 rounded-l-md pointer-events-none"
          style={{
            left: `${-bufferWidth}px`,
            width: `${bufferWidth}px`,
            backgroundColor: event.color,
            opacity: 0.18,
            borderLeft: '1px solid rgba(255, 255, 255, 0.35)',
            borderTopLeftRadius: '0.375rem',
            borderBottomLeftRadius: '0.375rem'
          }}
        />
      )}

      {/* Under-wing left shadow for contrast on white gaps */}
      <div
        className="absolute top-0 bottom-0 z-0 rounded-l-md opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{
          left: `${-resizeWingOffset}px`,
          width: `${resizeWingWidth}px`,
          backgroundColor: event.color
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
            <span className="whitespace-normal break-words text-xs leading-snug opacity-90">{event.location}</span>
          </div>
        )}
      </div>

      {/* Under-wing right shadow for contrast on white gaps */}
      <div
        className="absolute top-0 bottom-0 z-0 rounded-r-md opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{
          right: `${-resizeWingOffset}px`,
          width: `${resizeWingWidth}px`,
          backgroundColor: event.color
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
      
      {/* Enhanced tooltip on hover */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
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
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
      </div>

      {/* Visual feedback during drag/resize */}
      {(isDragging || isResizing) && (
        <div className="absolute -inset-1 border-2 border-white border-dashed rounded-md pointer-events-none"></div>
      )}

      {!event.intangible && event.lockTime && (
        <div
          className="absolute bottom-1 right-1 z-20 pointer-events-none rounded-full px-[1mm] py-[1mm]"
          style={{ backgroundColor: event.color }}
        >
          <Lock size={10} className="opacity-90" />
        </div>
      )}
    </div>
  );
};

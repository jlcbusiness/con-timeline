import React from 'react';
import { Edit3, Clock, GripVertical, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import type { TimelineEvent as TimelineEventType } from '../types/timeline';
import { getTimePosition, getEventWidth } from '../utils/timelineUtils';

interface TimelineEventProps {
  event: TimelineEventType;
  startDate: Date;
  onEdit: (event: TimelineEventType) => void;
  onDragStart: (event: TimelineEventType, clientX: number, clientY: number, type: 'move' | 'resize-start' | 'resize-end') => void;
  isDragging?: boolean;
  isResizing?: boolean;
}

export const TimelineEvent: React.FC<TimelineEventProps> = ({
  event,
  startDate,
  onEdit,
  onDragStart,
  isDragging = false,
  isResizing = false
}) => {
  // Use the unified positioning functions
  const leftPosition = getTimePosition(event.startTime, startDate);
  const width = getEventWidth(event.startTime, event.endTime);
  const resizeWingWidth = 12;
  const resizeWingOffset = resizeWingWidth / 2;
  
  // Fixed positioning calculation to align with slot headers
  // Each slot is 64px high, and we add 4px margin from the top of each slot
  const topPosition = event.position * 64 + 4;

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

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit(event);
  };

  return (
    <div
      className={`absolute z-10 rounded-md shadow-sm border border-opacity-20 border-white group select-none transition-[width,transform,box-shadow] duration-150 ${
        isDragging || isResizing 
          ? 'shadow-lg z-50 cursor-grabbing'
          : 'hover:shadow-md hover:z-10 hover:w-[calc(var(--event-width)+12px)] cursor-grab'
      }`}
      style={{
        left: `${leftPosition}px`,
        top: `${topPosition}px`,
        ['--event-width' as any]: `${Math.max(width, 80)}px`,
        width: 'var(--event-width)',
        height: '56px', // Fixed height to fit within 64px slot with margins
        backgroundColor: event.color,
        color: 'white'
      }}
      onDoubleClick={handleDoubleClick}
      title={`${event.title}${event.location ? ` @ ${event.location}` : ''}\n${formatTime(event.startTime)} - ${formatTime(event.endTime)}\n${getDuration()}\nDouble-click to edit, drag to move, drag edges to resize`}
    >
      {/* Under-wing left shadow for contrast on white gaps */}
      <div
        className="absolute top-0 bottom-0 z-0 rounded-l-md bg-gray-400/70 opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none"
        style={{ left: `${-resizeWingOffset}px`, width: `${resizeWingWidth}px` }}
      />

      {/* Resize handle - Start */}
      <div
        className="absolute top-0 bottom-0 z-20 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-colors bg-white/25 hover:bg-white/40 rounded-l-md flex items-center justify-center"
        style={{
          left: `${-resizeWingOffset}px`,
          width: `${resizeWingWidth}px`
        }}
        onMouseDown={(e) => handleMouseDown(e, 'resize-start')}
        title="Drag to resize start time"
      >
        <ChevronLeft size={10} className="text-white" />
      </div>

      {/* Main event content */}
      <div
        className="flex flex-col justify-center h-full px-3 py-2 text-xs font-medium cursor-grab active:cursor-grabbing"
        onMouseDown={(e) => handleMouseDown(e, 'move')}
      >
        {/* First line: Title with icons and edit button */}
        <div className="flex items-center justify-between min-w-0">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <GripVertical size={10} className="flex-shrink-0 opacity-60" />
            <Clock size={10} className="flex-shrink-0 opacity-80" />
            <span className="truncate font-medium">{event.title}</span>
          </div>
          
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-1">
            <Edit3 size={10} />
          </div>
        </div>

        {/* Second line: Location (if present) */}
        {event.location && (
          <div className="flex items-center gap-1 mt-1 min-w-0">
            <div className="w-2.5"></div> {/* Spacer to align with title */}
            <MapPin size={8} className="flex-shrink-0 opacity-80" />
            <span className="truncate text-xs opacity-90">{event.location}</span>
          </div>
        )}
      </div>

      {/* Under-wing right shadow for contrast on white gaps */}
      <div
        className="absolute top-0 bottom-0 z-0 rounded-r-md bg-gray-400/70 opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none"
        style={{ right: `${-resizeWingOffset}px`, width: `${resizeWingWidth}px` }}
      />

      {/* Resize handle - End */}
      <div
        className="absolute top-0 bottom-0 z-20 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-colors bg-white/25 hover:bg-white/40 rounded-r-md flex items-center justify-center"
        style={{
          right: `${-resizeWingOffset}px`,
          width: `${resizeWingWidth}px`
        }}
        onMouseDown={(e) => handleMouseDown(e, 'resize-end')}
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
    </div>
  );
};

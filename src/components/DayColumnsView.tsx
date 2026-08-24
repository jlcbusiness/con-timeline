import React from 'react';
import { Clock, MapPin } from 'lucide-react';
import type { TimelineEvent as TimelineEventType } from '../types/timeline';
import { formatDateHeader } from '../utils/timelineUtils';

interface DayColumnsViewProps {
  days: Date[];
  events: TimelineEventType[];
  selectedColor: string;
  columnWidth: number;
  onEventEdit: (event: TimelineEventType) => void;
}

const normalizeColor = (color: string) => color.trim().toLowerCase();

const isSameDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const formatTime = (date: Date): string =>
  date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime();
  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
};

export const DayColumnsView: React.FC<DayColumnsViewProps> = ({
  days,
  events,
  selectedColor,
  columnWidth,
  onEventEdit
}) => {
  const selectedColorKey = normalizeColor(selectedColor);
  const filteredEvents = events
    .filter(event => normalizeColor(event.color) === selectedColorKey)
    .sort((left, right) => left.startTime.getTime() - right.startTime.getTime());

  const groupedEvents = days.map(day =>
    filteredEvents.filter(event => isSameDay(event.startTime, day))
  );

  const boardWidth = Math.max(days.length * columnWidth, columnWidth);

  return (
    <div className="min-h-full bg-slate-100/70" style={{ width: `${boardWidth}px` }}>
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div
          className="flex border-b border-slate-200 bg-slate-50"
          style={{ width: `${boardWidth}px` }}
        >
          {days.map(day => {
            return (
              <div
                key={day.toISOString()}
                className="border-r border-slate-200 px-3 py-3 last:border-r-0"
                style={{ width: `${columnWidth}px`, flex: `0 0 ${columnWidth}px` }}
              >
                <div className="text-sm font-semibold text-slate-900">{formatDateHeader(day)}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-stretch" style={{ width: `${boardWidth}px` }}>
        {days.map((day, dayIndex) => {
          const dayEvents = groupedEvents[dayIndex];

          return (
            <section
              key={day.toISOString()}
              className="flex min-h-full flex-col border-r border-slate-200 bg-slate-50/80 last:border-r-0"
              style={{ width: `${columnWidth}px`, flex: `0 0 ${columnWidth}px` }}
            >
              <div className="min-h-0 flex-1 p-3">
                {dayEvents.length === 0 ? (
                  <div className="flex h-full min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/75 px-4 py-6 text-center text-sm text-slate-500">
                    <div>
                      <div className="font-medium text-slate-700">No events</div>
                      <div className="mt-1 text-xs text-slate-400">This day has nothing in the selected color.</div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dayEvents.map(event => (
                      <button
                        key={event.id}
                        type="button"
                        className="group w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-300"
                        onClick={() => onEventEdit(event)}
                        onDoubleClick={() => onEventEdit(event)}
                        title={`${event.title}\n${formatTime(event.startTime)} - ${formatTime(event.endTime)} (${formatDuration(event.startTime, event.endTime)})${event.location ? `\n${event.location}` : ''}${event.description ? `\n${event.description}` : ''}`}
                      >
                        <div className="h-1.5 w-full" style={{ backgroundColor: event.color }} />
                        <div className="space-y-2 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold text-slate-900">{event.title}</div>
                              <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                                <Clock size={11} className="flex-shrink-0" />
                                <span>{formatTime(event.startTime)} - {formatTime(event.endTime)}</span>
                              </div>
                            </div>
                            <div className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                              {formatDuration(event.startTime, event.endTime)}
                            </div>
                          </div>

                          {event.location && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-600">
                              <MapPin size={11} className="flex-shrink-0 text-slate-400" />
                              <span className="truncate">{event.location}</span>
                            </div>
                          )}

                          {event.description && (
                            <div className="max-h-16 overflow-hidden text-[11px] leading-5 text-slate-500">
                              {event.description}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
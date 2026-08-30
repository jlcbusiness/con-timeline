import React from 'react';
import { Clock, GripVertical, MapPin } from 'lucide-react';
import type { CosplayEntry, TimelineEvent as TimelineEventType } from '../types/timeline';
import { formatDateHeader, getDayKey, getLocationDisplayColor } from '../utils/timelineUtils';

interface DayColumnsViewProps {
  days: Date[];
  events: TimelineEventType[];
  cosplayEntries: CosplayEntry[];
  columnWidth: number;
  useLocationColors: boolean;
  onEventEdit: (event: TimelineEventType) => void;
  onCosplayEntryCreate: (day: Date) => void;
  onCosplayEntryEdit: (entry: CosplayEntry) => void;
  onCosplayEntryMove: (entryId: string, targetDayKey: string) => void;
  highlightedEventId?: string | null;
}

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
  cosplayEntries,
  columnWidth,
  useLocationColors,
  onEventEdit,
  onCosplayEntryCreate,
  onCosplayEntryEdit,
  onCosplayEntryMove,
  highlightedEventId
}) => {
  const dragTouchStateRef = React.useRef<{ activeEntryId: string | null; lastDayKey: string | null }>({
    activeEntryId: null,
    lastDayKey: null
  });
  const dragPointerIdRef = React.useRef<number | null>(null);

  const filteredEvents = [...events]
    .sort((left, right) => left.startTime.getTime() - right.startTime.getTime());

  const groupedEvents = days.map(day =>
    filteredEvents.filter(event => isSameDay(event.startTime, day))
  );

  const cosplayEntriesByDay = new Map(cosplayEntries.map(entry => [entry.dayKey, entry]));
  const handleCosplayDrop = (dayKey: string, dataTransfer: DataTransfer) => {
    const rawPayload = dataTransfer.getData('application/x-cosplay-entry') || dataTransfer.getData('text/plain');

    if (!rawPayload) return;

    try {
      const payload = JSON.parse(rawPayload) as { entryId?: string };
      if (payload.entryId) {
        onCosplayEntryMove(payload.entryId, dayKey);
      }
    } catch {
      return;
    }
  };

  const handleCosplayTouchMove = (clientX: number, clientY: number) => {
    if (!dragTouchStateRef.current.activeEntryId) return;

    const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const targetSection = element?.closest('[data-cosplay-day-key]') as HTMLElement | null;
    const targetDayKey = targetSection?.dataset.cosplayDayKey;

    if (!targetDayKey || targetDayKey === dragTouchStateRef.current.lastDayKey) {
      return;
    }

    dragTouchStateRef.current.lastDayKey = targetDayKey;
    onCosplayEntryMove(dragTouchStateRef.current.activeEntryId, targetDayKey);
  };

  const handleCosplayTouchEnd = () => {
    dragTouchStateRef.current.activeEntryId = null;
    dragTouchStateRef.current.lastDayKey = null;
    dragPointerIdRef.current = null;
  };

  const handleCosplayRailPointerDown = (event: React.PointerEvent<HTMLElement>, entryId: string, currentDayKey: string) => {
    if (event.pointerType !== 'touch') return;

    event.preventDefault();
    event.stopPropagation();
    dragPointerIdRef.current = event.pointerId;
    dragTouchStateRef.current.activeEntryId = entryId;
    dragTouchStateRef.current.lastDayKey = currentDayKey;

    const handleElement = event.currentTarget;
    if (typeof handleElement.setPointerCapture === 'function') {
      try {
        handleElement.setPointerCapture(event.pointerId);
      } catch {
        // Ignore synthetic or unsupported capture failures.
      }
    }
  };

  const handleCosplayRailPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'touch') return;
    if (dragPointerIdRef.current !== event.pointerId) return;

    event.preventDefault();
    handleCosplayTouchMove(event.clientX, event.clientY);
  };

  const handleCosplayRailPointerEnd = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'touch') return;
    if (dragPointerIdRef.current !== event.pointerId) return;

    event.preventDefault();
    handleCosplayTouchEnd();
  };

  const renderCosplayRail = (entryId: string, currentDayKey: string, side: 'left' | 'right') => (
    <div
      className={`flex min-h-full w-7 shrink-0 items-center justify-center bg-fuchsia-200 text-fuchsia-600 transition-colors duration-150 hover:bg-fuchsia-300 hover:text-fuchsia-700 active:cursor-grabbing ${side === 'left' ? 'rounded-l-2xl border-r border-fuchsia-200' : 'rounded-r-2xl border-l border-fuchsia-200'}`}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('application/x-cosplay-entry', JSON.stringify({ entryId }));
        event.dataTransfer.setData('text/plain', JSON.stringify({ entryId }));
        if (event.currentTarget.parentElement) {
          event.dataTransfer.setDragImage(event.currentTarget.parentElement, 20, 20);
        }
      }}
      onPointerDown={(event) => handleCosplayRailPointerDown(event, entryId, currentDayKey)}
      onPointerMove={handleCosplayRailPointerMove}
      onPointerUp={handleCosplayRailPointerEnd}
      onPointerCancel={handleCosplayRailPointerEnd}
      aria-label="Drag cosplay entry"
      title="Drag to another day"
      style={{ touchAction: 'none' }}
    >
      <GripVertical size={12} />
    </div>
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
          const dayKey = getDayKey(day);
          const cosplayEntry = cosplayEntriesByDay.get(dayKey);

          return (
            <section
              key={day.toISOString()}
              className="flex min-h-full flex-col border-r border-slate-200 bg-slate-50/80 last:border-r-0"
              data-cosplay-day-key={dayKey}
              style={{ width: `${columnWidth}px`, flex: `0 0 ${columnWidth}px` }}
              onDragEnter={(event) => {
                event.preventDefault();
                handleCosplayDrop(dayKey, event.dataTransfer);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                handleCosplayDrop(dayKey, event.dataTransfer);
              }}
            >
              <div className="min-h-0 flex-1 p-3">
                <div className="mb-3">
                  {cosplayEntry ? (
                    <div
                      className="group flex min-h-[72px] w-full overflow-hidden rounded-2xl border border-slate-300 bg-white text-left shadow-sm transition-colors duration-150 focus-within:ring-2 focus-within:ring-slate-300"
                      title={`${cosplayEntry.title}\nDouble-click to edit, drag either rail to another day`}
                    >
                      {renderCosplayRail(cosplayEntry.id, dayKey, 'left')}
                      <button
                        type="button"
                        className="min-w-0 flex-1 bg-white px-3 py-3 text-left transition-colors duration-150 hover:bg-slate-50 focus:outline-none"
                        onDoubleClick={() => onCosplayEntryEdit(cosplayEntry)}
                      >
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {cosplayEntry.title}
                        </div>
                      </button>
                      {renderCosplayRail(cosplayEntry.id, dayKey, 'right')}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="flex min-h-[72px] w-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/75 px-4 py-4 text-center text-sm text-slate-500 transition-colors hover:border-slate-400 hover:bg-white"
                      onClick={() => onCosplayEntryCreate(day)}
                      title="Add cosplay entry"
                    >
                      <div>
                        <div className="font-medium text-slate-700">Cosplay Entry</div>
                      </div>
                    </button>
                  )}
                </div>

                {dayEvents.length === 0 ? (
                  <div className="flex h-full min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/75 px-4 py-6 text-center text-sm text-slate-500">
                    <div>
                      <div className="font-medium text-slate-700">No events</div>
                      <div className="mt-1 text-xs text-slate-400">This day has no matching entries.</div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dayEvents.map(event => {
                      const displayColor = useLocationColors ? getLocationDisplayColor(event.location) : event.color;

                      return (
                      <button
                        key={event.id}
                        type="button"
                        data-event-id={event.id}
                        className={`group w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-300 ${event.intangible ? 'opacity-[0.65] saturate-75' : ''}`}
                        style={highlightedEventId === event.id ? { borderWidth: '4px', borderColor: '#fde047' } : undefined}
                        onClick={() => onEventEdit(event)}
                        onDoubleClick={() => onEventEdit(event)}
                        title={`${event.title}\n${formatTime(event.startTime)} - ${formatTime(event.endTime)} (${formatDuration(event.startTime, event.endTime)})${event.location ? `\n${event.location}` : ''}${event.description ? `\n${event.description}` : ''}`}
                      >
                        <div className="h-1.5 w-full" style={{ backgroundColor: displayColor }} />
                        <div className="space-y-2 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold text-slate-900">{event.title}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 whitespace-nowrap text-[11px] text-slate-500">
                            <Clock size={11} className="flex-shrink-0" />
                            <span>{formatTime(event.startTime)} - {formatTime(event.endTime)}</span>
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

                          <div className="flex min-w-0 items-center justify-between gap-2 pt-1">
                            {!event.intangible && event.fandom?.trim() && (
                              <span
                                data-event-fandom-tag="true"
                                className="inline-flex min-w-0 items-center overflow-hidden whitespace-nowrap rounded-md border border-slate-300 px-1.5 py-[3.25px] text-[10px] font-semibold leading-normal text-slate-700"
                                title={event.fandom}
                              >
                                <span className="min-w-0 translate-y-px truncate">{event.fandom}</span>
                              </span>
                            )}
                            <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                              {formatDuration(event.startTime, event.endTime)}
                            </span>
                          </div>
                        </div>
                      </button>
                      );
                    })}
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
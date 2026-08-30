import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Clock, Hourglass, MapPin, Search, X } from 'lucide-react';
import type { TimelineEvent } from '../types/timeline';
import {
  searchEvents,
  type EventSortField,
  type SearchField,
  type SortDirection
} from '../utils/eventSearch';

interface EventSearchPaneProps {
  events: TimelineEvent[];
  initialQuery: string;
  searchImmediately: boolean;
  getEventColor: (event: TimelineEvent) => string;
  onQueryChange: (query: string) => void;
  onClose: () => void;
  onSelect: (event: TimelineEvent) => void;
}

const SEARCH_FIELDS: { field: SearchField; label: string }[] = [
  { field: 'title', label: 'Title' },
  { field: 'description', label: 'Description' },
  { field: 'location', label: 'Location' }
];

const SORT_FIELDS: EventSortField[] = ['title', 'startTime', 'location', 'duration'];

const SORT_LABELS: Record<EventSortField, string> = {
  title: 'title',
  startTime: 'start time',
  location: 'location',
  duration: 'duration'
};

const formatTime = (date: Date) => date.toLocaleTimeString('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true
});

const formatDuration = (event: TimelineEvent) => {
  const minutes = Math.max(0, Math.round((event.endTime.getTime() - event.startTime.getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes}m`;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
};

const SortFieldIcon: React.FC<{ field: EventSortField }> = ({ field }) => {
  if (field === 'title') {
    return <span className="font-serif text-lg font-bold leading-none" aria-hidden="true">T</span>;
  }
  if (field === 'startTime') return <Clock size={17} aria-hidden="true" />;
  if (field === 'location') return <MapPin size={17} aria-hidden="true" />;
  return <Hourglass size={17} aria-hidden="true" />;
};

export const EventSearchPane: React.FC<EventSearchPaneProps> = ({
  events,
  initialQuery,
  searchImmediately,
  getEventColor,
  onQueryChange,
  onClose,
  onSelect
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [selectedFields, setSelectedFields] = useState<SearchField[]>(['title', 'description', 'location']);
  const [submittedQuery, setSubmittedQuery] = useState(searchImmediately ? initialQuery.trim() : '');
  const [submittedFields, setSubmittedFields] = useState<SearchField[]>(['title', 'description', 'location']);
  const [hasSearched, setHasSearched] = useState(searchImmediately && Boolean(initialQuery.trim()));
  const [sortField, setSortField] = useState<EventSortField>('title');
  const [sortDirection, setSortDirection] = useState<SortDirection>('ascending');

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const results = hasSearched
    ? searchEvents(events, submittedQuery, {
        fields: submittedFields,
        sortField,
        sortDirection
      })
    : [];

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    setSubmittedQuery(trimmedQuery);
    setSubmittedFields(selectedFields);
    setHasSearched(true);
  };

  const handleFieldToggle = (field: SearchField) => {
    setSelectedFields(current => {
      if (current.includes(field)) {
        return current.length === 1 ? current : current.filter(item => item !== field);
      }
      return [...current, field];
    });
  };

  const handleSortFieldCycle = () => {
    const currentIndex = SORT_FIELDS.indexOf(sortField);
    setSortField(SORT_FIELDS[(currentIndex + 1) % SORT_FIELDS.length]);
  };

  const nextSortField = SORT_FIELDS[(SORT_FIELDS.indexOf(sortField) + 1) % SORT_FIELDS.length];
  const nextDirection: SortDirection = sortDirection === 'ascending' ? 'descending' : 'ascending';

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label="Search events">
      <button
        type="button"
        className="absolute inset-0 hidden bg-black/35 md:block"
        onClick={onClose}
        aria-label="Close search"
      />

      <section className="relative flex h-full w-full flex-col bg-white shadow-2xl md:max-w-xl">
        <header className="flex items-center justify-between gap-4 border-b border-gray-200 px-4 py-3 sm:px-5">
          <h2 className="text-lg font-semibold text-gray-900">Search events</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            title="Close search"
            aria-label="Close search"
          >
            <X size={20} />
          </button>
        </header>

        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-4 sm:px-5">
          <form onSubmit={handleSubmit}>
            <div className="flex gap-2">
              <label className="min-w-0 flex-1">
                <span className="sr-only">Search term</span>
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={event => {
                    setQuery(event.target.value);
                    onQueryChange(event.target.value);
                  }}
                  placeholder="Search events"
                  className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </label>
              <button
                type="submit"
                disabled={!query.trim()}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto md:gap-2 md:px-3"
                title="Search"
                aria-label="Search"
              >
                <Search size={16} />
                <span className="sr-only md:not-sr-only">Search</span>
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <fieldset className="flex min-w-0 items-center gap-2 md:gap-x-3">
                <legend className="sr-only">Search fields</legend>
                {SEARCH_FIELDS.map(({ field, label }) => {
                  const checked = selectedFields.includes(field);
                  const disabled = checked && selectedFields.length === 1;

                  return (
                    <label key={field} className={`inline-flex min-w-0 items-center gap-1.5 text-xs sm:text-sm ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => handleFieldToggle(field)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      {field === 'description' ? (
                        <>
                          <span className="md:hidden">Descript</span>
                          <span className="hidden md:inline">{label}</span>
                        </>
                      ) : label}
                    </label>
                  );
                })}
              </fieldset>

              <div className="flex shrink-0 items-center gap-1" aria-label="Sort controls">
                <button
                  type="button"
                  onClick={handleSortFieldCycle}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  title={`Sorting by ${SORT_LABELS[sortField]}. Click to sort by ${SORT_LABELS[nextSortField]}.`}
                  aria-label={`Sorting by ${SORT_LABELS[sortField]}. Change to ${SORT_LABELS[nextSortField]}.`}
                >
                  <SortFieldIcon field={sortField} />
                </button>
                <button
                  type="button"
                  onClick={() => setSortDirection(nextDirection)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  title={`Sorting ${sortDirection}. Click for ${nextDirection}.`}
                  aria-label={`Sorting ${sortDirection}. Change to ${nextDirection}.`}
                >
                  {sortDirection === 'ascending' ? <ArrowUp size={17} /> : <ArrowDown size={17} />}
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 px-4 py-4 sm:px-5">
          {!hasSearched ? (
            <div className="flex min-h-48 items-center justify-center text-center text-sm text-gray-500">
              Enter a term to search this timeline.
            </div>
          ) : results.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center text-center text-sm text-gray-500">
              No events match &ldquo;{submittedQuery}&rdquo;.
            </div>
          ) : (
            <>
              <div className="mb-3 text-xs font-medium uppercase text-gray-500">
                {results.length} {results.length === 1 ? 'result' : 'results'}
              </div>
              <div className="space-y-2">
                {results.map(event => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onSelect(event)}
                    className="relative w-full overflow-hidden rounded-md border border-gray-200 bg-white py-3 pl-5 pr-4 text-left shadow-sm hover:border-blue-300 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <span
                      className="absolute inset-y-0 left-0 w-1.5"
                      style={{
                        backgroundColor: getEventColor(event),
                        opacity: event.intangible ? 0.35 : 1
                      }}
                      aria-hidden="true"
                    />
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">{event.title}</span>
                      <span className="shrink-0 text-xs font-medium text-gray-500">{formatDuration(event)}</span>
                    </div>
                    <div className="mt-1 text-xs text-gray-600">
                      {event.startTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      {' | '}{formatTime(event.startTime)} - {formatTime(event.endTime)}
                    </div>
                    {event.location?.trim() && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-gray-600">
                        <MapPin size={12} className="shrink-0 text-gray-400" />
                        <span className="truncate">{event.location}</span>
                      </div>
                    )}
                    {event.description?.trim() && (
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-500">{event.description}</p>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
};
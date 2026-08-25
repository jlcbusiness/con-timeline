import React, { useState } from 'react';
import { Upload, Calendar, Sparkles, X } from 'lucide-react';
import type { TimelineEvent } from '../types/timeline';
import { addDragonConEvents, parseDragonConSchedule } from '../utils/dragonConImporter';
import { extractDragonConScheduleTextFromPdf } from '../utils/dragonConPdf';

interface DragonConImporterProps {
  isOpen: boolean;
  onClose: () => void;
  existingEvents: TimelineEvent[];
  onAddEvent: (event: TimelineEvent) => void;
  onUpdateEvent?: (eventId: string, updates: Partial<TimelineEvent>) => void;
  onAddLocations?: (locationNames: string[]) => Promise<void> | void;
}

export const DragonConImporter: React.FC<DragonConImporterProps> = ({
  isOpen,
  onClose,
  existingEvents,
  onAddEvent,
  onUpdateEvent,
  onAddLocations
}) => {
  const [scheduleText, setScheduleText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  const persistLocations = async (text: string) => {
    if (!onAddLocations) return;

    const importedEvents = parseDragonConSchedule(text);
    const locationNames = Array.from(new Set(
      importedEvents
        .map(event => event.location?.trim())
        .filter((location): location is string => Boolean(location) && location !== 'Dragon Con')
    ));

    if (locationNames.length > 0) {
      await onAddLocations(locationNames);
    }
  };

  const handleImport = async () => {
    if (!scheduleText.trim()) return;

    setIsImporting(true);
    try {
      const eventCount = addDragonConEvents(scheduleText, existingEvents, onAddEvent, onUpdateEvent);
      await persistLocations(scheduleText);
      setImportResult(`Successfully imported or updated ${eventCount} Dragon Con events!`);
      setScheduleText('');

      setTimeout(() => {
        onClose();
        setImportResult(null);
      }, 2000);
    } catch (error) {
      setImportResult('Failed to import events. Please check the format.');
    } finally {
      setIsImporting(false);
    }
  };

  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoadingPdf(true);
    try {
      const extractedText = await extractDragonConScheduleTextFromPdf(file);
      setScheduleText(extractedText);
    } catch (error) {
      console.error('Failed to read PDF:', error);
      setImportResult('Failed to read the PDF. Please try another file.');
    } finally {
      setIsLoadingPdf(false);
      event.target.value = '';
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setScheduleText(text);
    } catch (error) {
      console.error('Failed to read from clipboard:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles size={20} className="text-purple-600" />
            Import Dragon Con Schedule
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            type="button"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {importResult ? (
            <div className="text-center py-8">
              <div className="text-green-600 text-lg font-medium mb-2">
                ✅ {importResult}
              </div>
              <div className="text-gray-500 text-sm">
                Closing automatically...
              </div>
            </div>
          ) : (
            <>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h3 className="font-medium text-purple-900 mb-2 flex items-center gap-2">
                  <Calendar size={16} />
                  How to Import Your Dragon Con Schedule
                </h3>
                <ul className="text-sm text-purple-800 space-y-1">
                  <li>• Upload the Dragon Con PDF or paste the extracted text</li>
                  <li>• The importer reads event titles, times, and locations from the schedule</li>
                  <li>• It also supports the older one-line text format</li>
                  <li>• Each event should appear as a separate block or line</li>
                </ul>
              </div>

              <div>
                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <label htmlFor="schedule-text" className="block text-sm font-medium text-gray-700">
                    Dragon Con Schedule Text or PDF Extract
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handlePasteFromClipboard}
                      className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
                    >
                      <Upload size={12} />
                      Paste from Clipboard
                    </button>
                    <label className="flex cursor-pointer items-center gap-1 text-xs text-blue-600 transition-colors hover:text-blue-700">
                      <Upload size={12} />
                      {isLoadingPdf ? 'Reading PDF...' : 'Upload PDF'}
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handlePdfUpload}
                        className="hidden"
                        disabled={isLoadingPdf}
                      />
                    </label>
                  </div>
                </div>
                <textarea
                  id="schedule-text"
                  value={scheduleText}
                  onChange={(e) => setScheduleText(e.target.value)}
                  className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white resize-none font-mono text-xs"
                  placeholder="Paste your Dragon Con schedule here...

Example format:
Dragon Con Newbie Walking Tours - Thursday, Sep 1 12:00 PM
Dragon Con 104: Tips & Tricks from Con Elders - Thursday, Sep 1 7:00 PM
Skies Over Dragon Con - Thursday, Sep 1 8:30 PM"
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Import Features:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Automatically categorizes events by type (Star Trek, Science, etc.)</li>
                  <li>• Assigns consistent colors to event categories</li>
                  <li>• Infers event durations when only a start time is present</li>
                  <li>• Finds optimal positioning to avoid overlaps</li>
                  <li>• Keeps real locations from the PDF and ignores duplicates</li>
                </ul>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleImport}
                  disabled={!scheduleText.trim() || isImporting || isLoadingPdf}
                  className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isImporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Importing...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      Import Events
                    </>
                  )}
                </button>
















                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

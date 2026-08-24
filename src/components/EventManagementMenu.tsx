import React, { useRef } from 'react';
import { Download, Upload, Trash2, Sparkles, ArrowUpDown } from 'lucide-react';

interface EventManagementMenuProps {
  onExport: () => void;
  onImport: (file: File) => Promise<void>;
  onClearAll: () => void;
  onDragonCon: () => void;
  eventCount: number;
}

export const EventManagementMenu: React.FC<EventManagementMenuProps> = ({
  onExport,
  onImport,
  onClearAll,
  onDragonCon,
  eventCount
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const getImportErrorMessage = (error: unknown) => {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    if (typeof error === 'string' && error.trim()) {
      return error;
    }

    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== '{}') {
        return serialized;
      }
    } catch {
      // ignore JSON stringify failures and fall through to the generic message
    }

    return 'Failed to import events. Please check the file format or your Supabase connection.';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      await onImport(file);
      setIsOpen(false);
    } catch (error) {
      alert(getImportErrorMessage(error));
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClearAll = () => {
    if (eventCount === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete all ${eventCount} events? This action cannot be undone.`
    );

    if (confirmed) {
      onClearAll();
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-gray-300 bg-white p-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900 md:px-3 md:py-2"
        title="Import/export options"
        aria-label="Import/export options"
      >
        <ArrowUpDown size={16} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu - Updated with higher z-index */}
          <div className="absolute right-0 top-full z-50 mt-1 w-48 max-w-[calc(100vw-1rem)] overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-lg">
            <button
              onClick={() => {
                onExport();
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              disabled={eventCount === 0}
            >
              <Download size={16} />
              Export to file
            </button>

            <button
              onClick={handleImportClick}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              disabled={isImporting}
            >
              <Upload size={16} />
              {isImporting ? 'Importing...' : 'Import from file'}
            </button>

            <button
              onClick={() => {
                onDragonCon();
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            >
              <Sparkles size={16} />
              Dragon Con
            </button>




            <hr className="my-1 border-gray-200" />

            <button
              onClick={handleClearAll}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={eventCount === 0}
            >
              <Trash2 size={16} />
              Clear All Events
            </button>
          </div>
        </>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
};

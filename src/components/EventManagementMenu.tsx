import React, { useRef } from 'react';
import { Download, Upload, Trash2, MoreVertical } from 'lucide-react';

interface EventManagementMenuProps {
  onExport: () => void;
  onImport: (file: File) => Promise<void>;
  onClearAll: () => void;
  eventCount: number;
}

export const EventManagementMenu: React.FC<EventManagementMenuProps> = ({
  onExport,
  onImport,
  onClearAll,
  eventCount
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      await onImport(file);
      setIsOpen(false);
    } catch (error) {
      alert('Failed to import events. Please check the file format.');
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
        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
        title="Event management options"
      >
        <MoreVertical size={20} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu - Updated with higher z-index */}
          <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-40">
            <button
              onClick={() => {
                onExport();
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              disabled={eventCount === 0}
            >
              <Download size={16} />
              Export Events ({eventCount})
            </button>

            <button
              onClick={handleImportClick}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              disabled={isImporting}
            >
              <Upload size={16} />
              {isImporting ? 'Importing...' : 'Import Events'}
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
